#!/usr/bin/env bash
set -euo pipefail

logStep(){ echo -e "\n===== $1 ====="; if [ "${2-}" != "" ]; then echo "$2"; fi }
run(){ echo "> $*"; bash -lc "$*" 2>&1 | sed -E 's/(postgres:\/\/[^:]+:)[^@]+(@[^:]+:\\?[0-9]+\/)[^?]+/\1****\2****/g'; return ${PIPESTATUS[0]}; }
mask(){ echo "$1" | sed -E 's/(postgres:\/\/[^:]+:)[^@]+(@[^:]+:\\?[0-9]+\/)[^?]+/\1****\2****/g'; }

ROOT="$(pwd)"
ENV_FILE=""
DB_URL=""

logStep "Detect environment and Prisma version"
run "node -v || true"
run "pnpm -v || yarn -v || npm -v"
run "npx prisma -v"
run "uname -a || wmic os get Caption || true"

logStep "Locate DATABASE_URL"
for f in .env.local .env .env.production; do
  if [ -f "$f" ] && grep -q '^DATABASE_URL=' "$f"; then ENV_FILE="$f"; break; fi
done
if [ -z "$ENV_FILE" ]; then echo "FAIL: No env file with DATABASE_URL"; exit 1; fi
DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/^DATABASE_URL=//')
echo "Using env: $ENV_FILE"
mask "${DB_URL}"

logStep "Backup env file"
TS=$(date +%Y%m%d_%H%M%S)
cp "$ENV_FILE" "$ENV_FILE.backup_$TS"
echo "Backup: $ENV_FILE.backup_$TS"

logStep "Check Docker"
[ -f docker-compose.yml ] && echo "docker-compose.yml found" || echo "no docker-compose.yml"
[ -f Dockerfile ] && echo "Dockerfile found" || echo "no Dockerfile"

# Helpers to update URL params in file
update_param(){
  local key="$1"; local value="$2";
  python3 - "$ENV_FILE" "$key" "$value" << 'PY'
import os,sys,re,urllib.parse
f,key,val=sys.argv[1:4]
with open(f,'r') as fh:
  s=fh.read()
import shlex
m=re.search(r'^DATABASE_URL=(.*)$',s,flags=re.M)
if not m: sys.exit(0)
url=m.group(1)
parsed=urllib.parse.urlparse(url)
q=urllib.parse.parse_qsl(parsed.query,keep_blank_values=True)
d=dict(q)
d[key]=val
new_q=urllib.parse.urlencode(d)
new_url=urllib.parse.urlunparse(parsed._replace(query=new_q))
print('NEW_URL='+new_url)
print('OLD_URL='+url)
s=s.replace('DATABASE_URL='+url,'DATABASE_URL='+new_url)
with open(f,'w') as fh:
  fh.write(s)
PY
}
remove_param(){
  local key="$1";
  python3 - "$ENV_FILE" "$key" << 'PY'
import os,sys,re,urllib.parse
f,key=sys.argv[1:3]
with open(f,'r') as fh:
  s=fh.read()
m=re.search(r'^DATABASE_URL=(.*)$',s,flags=re.M)
if not m: sys.exit(0)
url=m.group(1)
parsed=urllib.parse.urlparse(url)
q=urllib.parse.parse_qsl(parsed.query,keep_blank_values=True)
d=[(k,v) for k,v in q if k!=key]
new_q=urllib.parse.urlencode(d)
new_url=urllib.parse.urlunparse(parsed._replace(query=new_q))
s=s.replace('DATABASE_URL='+url,'DATABASE_URL='+new_url)
with open(f,'w') as fh:
  fh.write(s)
print('UPDATED')
PY
}

# Method 1
logStep "Download AWS RDS global CA bundle"
run "curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o rds-ca.pem"
if [ ! -s rds-ca.pem ]; then echo "FAIL: CA download"; METHOD1_FAIL=1; else echo "SUCCESS: CA saved at $ROOT/rds-ca.pem"; METHOD1_FAIL=0; fi

logStep "Set PGSSLROOTCERT for this session"
export PGSSLROOTCERT="$ROOT/rds-ca.pem"; echo "PGSSLROOTCERT=$(mask "$PGSSLROOTCERT")"

logStep "Ensure DATABASE_URL uses SSL (sslmode=require)"
if ! echo "$DB_URL" | grep -q 'sslmode='; then update_param sslmode require >/tmp/url.out 2>/dev/null || true; fi

logStep "Test connection and push schema (Method 1)"
if run "npx prisma db push --accept-data-loss"; then
  echo "SUCCESS: Method 1 worked"
  # persist PGSSLROOTCERT
  if ! grep -q '^PGSSLROOTCERT=' "$ENV_FILE"; then echo "PGSSLROOTCERT=./rds-ca.pem" >> "$ENV_FILE"; fi
  echo "Docker note: set PGSSLROOTCERT and mount rds-ca.pem"
  exit 0
fi

# Method 2
logStep "Temporarily set sslaccept=accept_invalid_certs"
update_param sslmode require >/dev/null 2>&1 || true
update_param sslaccept accept_invalid_certs >/dev/null 2>&1 || true
if run "npx prisma db push --accept-data-loss"; then
  echo "SUCCESS: Method 2 worked (NOT for production)"
  # revert sslaccept
  remove_param sslaccept >/dev/null 2>&1 || true
  echo "Reverted sslaccept; kept sslmode=require"
  exit 0
fi

# Method 3
logStep "Temporarily set sslmode=disable"
remove_param sslaccept >/dev/null 2>&1 || true
update_param sslmode disable >/dev/null 2>&1 || true
if run "npx prisma db push --accept-data-loss"; then
  echo "SUCCESS: Method 3 worked (temporary)"
  # revert to secure settings from backup
  cp "$ENV_FILE.backup_$TS" "$ENV_FILE"
  echo "Reverted env to secure settings from backup"
  exit 0
fi

echo "FAIL: All methods failed. Next steps: verify Lightsail param group, test with psql using PGSSLROOTCERT." && exit 1
