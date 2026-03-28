#!/usr/bin/env bash
set -euo pipefail

mask(){ echo "$1" | sed -E 's#(postgres://[^:]+:)([^@]+)(@)([^:/]{3})[^:]+(:[0-9]+/)([^?]+)#\1****\3\4…\5****#'; }
log(){ echo -e "\n===== $1 =====\n${2-}"; }
run(){ echo "> $*"; bash -lc "$*"; return ${PIPESTATUS[0]}; }
fileExists(){ [ -s "$1" ]; }

ROOT="$(pwd)"
ENV_FILE=""; DB_URL=""; TS=$(date +%Y%m%d_%H%M%S)

log "Detect environment and Prisma version"
run "node -v || true"; run "npm -v || true"; run "npx prisma -v"; run "uname -a || true"

log "Locate DATABASE_URL"
for f in .env.local .env .env.production; do
  if [ -f "$f" ] && grep -q '^DATABASE_URL=' "$f"; then ENV_FILE="$f"; break; fi
done
if [ -z "$ENV_FILE" ]; then echo "FAIL: No env file with DATABASE_URL"; exit 1; fi
DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/^DATABASE_URL=//')
echo "Active env: $ENV_FILE"
echo "URL: $(mask "$DB_URL")"

log "Backup env file"
cp "$ENV_FILE" "$ENV_FILE.backup_$TS" && echo "Backup: $ENV_FILE.backup_$TS"

# helpers to update/remove URL params inline
update_param(){
  local key="$1" val="$2";
  python3 - "$ENV_FILE" "$key" "$val" << 'PY'
import sys,re,urllib.parse
f,key,val=sys.argv[1:4]
s=open(f).read()
m=re.search(r'^DATABASE_URL=(.*)$',s,flags=re.M)
if not m: sys.exit(0)
url=m.group(1)
p=urllib.parse.urlparse(url)
q=dict(urllib.parse.parse_qsl(p.query,keep_blank_values=True))
q[key]=val
new=urllib.parse.urlunparse(p._replace(query=urllib.parse.urlencode(q)))
open(f,'w').write(s.replace('DATABASE_URL='+url,'DATABASE_URL='+new))
print('OK')
PY
}
remove_param(){
  local key="$1";
  python3 - "$ENV_FILE" "$key" << 'PY'
import sys,re,urllib.parse
f,key=sys.argv[1:3]
s=open(f).read()
m=re.search(r'^DATABASE_URL=(.*)$',s,flags=re.M)
if not m: sys.exit(0)
url=m.group(1)
p=urllib.parse.urlparse(url)
q=[(k,v) for k,v in urllib.parse.parse_qsl(p.query,keep_blank_values=True) if k!=key]
new=urllib.parse.urlunparse(p._replace(query=urllib.parse.urlencode(q)))
open(f,'w').write(s.replace('DATABASE_URL='+url,'DATABASE_URL='+new))
print('OK')
PY
}

log "Parse region from DB host"
HOST=$(python3 - << 'PY'
import os,urllib.parse
u=os.environ.get('URL');
p=urllib.parse.urlparse(u)
print(p.hostname or '')
PY
URL="$DB_URL" HOST=$(URL="$DB_URL" bash -lc "python3 - << 'PY'
import os,urllib.parse
u=os.environ.get('URL')
p=urllib.parse.urlparse(u)
print(p.hostname or '')
PY
")
REGION=$(echo "$HOST" | sed -n 's/.*\.?\(us-[a-z-0-9]*\)\.rds\.amazonaws\.com.*/\1/p')
if [ -z "$REGION" ]; then REGION=us-east-1; echo "WARN: Could not parse region. Defaulting to $REGION"; else echo "Region: $REGION"; fi

log "Validate previous CA (if any)"
if fileExists rds-ca.pem; then
  if grep -q "BEGIN CERTIFICATE" rds-ca.pem; then echo "Existing rds-ca.pem looks like PEM"; else echo "Invalid rds-ca.pem; replacing"; rm -f rds-ca.pem; fi
fi

log "Download regional RDS CA bundle"
run "curl -fsSL https://truststore.pki.rds.amazonaws.com/$REGION/$REGION-bundle.pem -o rds-ca.pem" || true
if ! fileExists rds-ca.pem || ! grep -q "BEGIN CERTIFICATE" rds-ca.pem; then echo "FAIL: Regional bundle missing or invalid"; exit 1; fi

log "Show CA bundle (first cert)"
run "awk 'BEGIN{c=0}/-----BEGIN CERTIFICATE-----/{c++} {print} /-----END CERTIFICATE/{print \"\"; if(c>0) exit}' rds-ca.pem"

log "Ensure DATABASE_URL secure baseline"
remove_param sslaccept >/dev/null 2>&1 || true
update_param sslmode require >/dev/null 2>&1 || true

log "Method 1: PGSSLROOTCERT session and prisma db push"
export PGSSLROOTCERT="$ROOT/rds-ca.pem"; echo "PGSSLROOTCERT set"
if run "npx prisma db push --accept-data-loss"; then
  echo "SUCCESS: Method 1"
  if ! grep -q '^PGSSLROOTCERT=' "$ENV_FILE"; then echo "PGSSLROOTCERT=./rds-ca.pem" >> "$ENV_FILE"; fi
  OK=1
else
  OK=0
fi

if [ "$OK" != "1" ]; then
  log "Method 2: Add sslrootcert param and retry"
  remove_param sslrootcert >/dev/null 2>&1 || true
  update_param sslrootcert "./rds-ca.pem" >/dev/null 2>&1 || true
  if run "npx prisma db push --accept-data-loss"; then
    echo "SUCCESS: Method 2"
    OK=1
  else
    OK=0
  fi
fi

if [ "$OK" != "1" ]; then
  log "Method 3: verify-full tweak with CA"
  update_param sslmode verify-full >/dev/null 2>&1 || true
  if run "npx prisma db push --accept-data-loss"; then
    echo "SUCCESS: Method 3"
    OK=1
  else
    # revert mode
    update_param sslmode require >/dev/null 2>&1 || true
  fi
fi

if [ "$OK" = "1" ]; then
  log "Verification"
  run "npx prisma db pull"
  run "node -e \"const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();console.log(await p.$queryRaw`select now() as now;`);await p.$disconnect();})();\""
  log "Docker notes"
  echo "docker-compose:"
  echo "  environment:\n    - PGSSLROOTCERT=/app/rds-ca.pem"
  echo "  volumes:\n    - ./rds-ca.pem:/app/rds-ca.pem:ro"
  echo "Dockerfile:\n  COPY rds-ca.pem /app/rds-ca.pem\n  ENV PGSSLROOTCERT=/app/rds-ca.pem"
  exit 0
else
  log "All methods failed"
  echo "Host: $(echo "$HOST" | sed -E 's/^(.{4}).*/\1…/')  Region: $REGION"
  echo "Tried: regional bundle CA with PGSSLROOTCERT, sslrootcert, verify-full"
  echo "Next: Check Lightsail TLS config; test psql: PGSSLROOTCERT=./rds-ca.pem psql \"<DB_URL with sslmode=require>\" -c 'select version();'"
  exit 1
fi
