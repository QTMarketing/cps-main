/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import https from "https";

const root = process.cwd();
const envCandidates = [".env.local", ".env", ".env.production"];
const log = (title, details="") => {
  const bar = "─".repeat(Math.max(12, title.length));
  console.log(`\n${bar}\n${title}\n${bar}${details ? "\n"+details : ""}`);
};
const mask = (s) => {
  if (!s) return s;
  try {
    const url = new URL(s.replace(/^"(.*)"$/, "$1"));
    const host = url.hostname;
    const maskedHost = host.length > 8 ? host.slice(0, 4) + "…" + host.slice(-4) : "****";
    const pwd = url.password ? "****" : "";
    url.password = pwd;
    url.hostname = maskedHost;
    return url.toString();
  } catch {
    return s.replace(/:\/\/([^@]+)@/, "://****@");
  }
};
const fileExists = (p) => { try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; } };
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, c) => fs.writeFileSync(p, c);
const backup = (p) => { const ts = new Date().toISOString().replace(/[-:T]/g,"").slice(0,14); const b = `${p}.backup_${ts}`; fs.copyFileSync(p, b); return b; };
const run = (cmd, env = {}) => { try { const out = execSync(cmd, { stdio: "pipe", env: { ...process.env, ...env } }); return { code: 0, stdout: out.toString(), stderr: "" }; } catch (e) { return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? "", stderr: e.stderr?.toString() ?? e.message }; } };
const download = (url, outPath) => new Promise((resolve, reject) => { const file = fs.createWriteStream(outPath); https.get(url, (res) => { if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; } res.pipe(file); file.on("finish", () => file.close(() => resolve(true))); }).on("error", reject); });

const detectEnvFile = () => envCandidates.find(f => fileExists(path.join(root, f)));
const getEnvKeyRaw = (content, key) => { const m = content.match(new RegExp(`^\\s*${key}\\s*=(.*)$`, "m")); return m ? m[1].trim() : null; };
const setEnvKey = (content, key, rawVal) => { const val = rawVal.startsWith('"') || rawVal.startsWith("'") ? rawVal : `"${rawVal}"`; if (new RegExp(`^\\s*${key}\\s*=`, "m").test(content)) { return content.replace(new RegExp(`^\\s*${key}\\s*=.*$`, "m"), `${key}=${val}`); } const sep = content.endsWith("\n") ? "" : "\n"; return content + `${sep}${key}=${val}\n`; };
const stripQuotes = (v) => v?.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
const parseDbUrl = (u) => { const raw = stripQuotes(u); const url = new URL(raw); return { url, raw }; };
const ensureParam = (url, key, val) => { url.searchParams.set(key, val); };
const removeParam = (url, key) => { url.searchParams.delete(key); };
const isPEM = (p) => fileExists(p) && read(p).includes("-----BEGIN CERTIFICATE-----");

(async () => {
  try {
    log("Detect environment & Prisma");
    console.log(run("node -v").stdout.trim());
    console.log(run("npx prisma -v").stdout.trim());

    const envFile = detectEnvFile();
    if (!envFile) { console.error("No .env.local / .env / .env.production found."); process.exit(1); }
    const envPath = path.join(root, envFile);
    let envContent = read(envPath);
    const dbRaw = getEnvKeyRaw(envContent, "DATABASE_URL");
    if (!dbRaw) { console.error(`DATABASE_URL not found in ${envFile}`); process.exit(1); }
    console.log("Using env file:", envFile);
    console.log("DATABASE_URL:", mask(stripQuotes(dbRaw)));

    log("Backup env");
    const backupPath = backup(envPath); console.log("Backup created:", backupPath);

    log("Parse region from hostname");
    const { url: dbUrl } = parseDbUrl(dbRaw);
    const host = dbUrl.hostname;
    let region = (host.match(/([a-z]{2}-[a-z]+-\d)/) || [])[1] || "us-east-1";
    console.log("Detected host:", host.replace(/^(.{4}).*(.{4})$/, "$1…$2"));
    console.log("Assumed region:", region);

    log("Download regional RDS bundle");
    const pemPath = path.join(root, "rds-ca.pem");
    if (fileExists(pemPath) && !isPEM(pemPath)) fs.unlinkSync(pemPath);
    const urlPem = `https://truststore.pki.rds.amazonaws.com/${region}/${region}-bundle.pem`;
    try { await download(urlPem, pemPath); } catch (e) { console.warn("Regional download failed, trying GLOBAL:", e.message); }
    if (!isPEM(pemPath)) { await download("https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem", pemPath); }
    if (!isPEM(pemPath)) { console.error("Downloaded PEM invalid."); process.exit(1); }
    console.log("PEM downloaded at:", pemPath);

    log("Ensure secure sslmode=require (remove sslaccept)");
    ensureParam(dbUrl, "sslmode", "require");
    removeParam(dbUrl, "sslaccept");
    let updated = dbUrl.toString();
    envContent = setEnvKey(envContent, "DATABASE_URL", updated);
    write(envPath, envContent);
    console.log("DATABASE_URL updated (masked):", mask(updated));

    const sessionEnv = { PGSSLROOTCERT: pemPath };

    log("Method 1: PGSSLROOTCERT env + prisma db push");
    let r = run("npx prisma db push --accept-data-loss", sessionEnv);
    console.log(r.stdout || r.stderr);
    if (r.code === 0) {
      log("SUCCESS (Method 1)");
      envContent = setEnvKey(envContent, "PGSSLROOTCERT", "./rds-ca.pem");
      write(envPath, envContent);
      log("Verify prisma db pull");
      const r2 = run("npx prisma db pull", sessionEnv);
      console.log(r2.stdout || r2.stderr);
      if (r2.code !== 0) process.exit(r2.code);
      log("Done", "Persisted: sslmode=require + PGSSLROOTCERT=./rds-ca.pem");
      process.exit(0);
    }

    log("Method 2: add sslrootcert param and retry");
    ensureParam(dbUrl, "sslrootcert", pemPath);
    updated = dbUrl.toString();
    envContent = setEnvKey(envContent, "DATABASE_URL", updated);
    write(envPath, envContent);
    console.log("DATABASE_URL with sslrootcert (masked):", mask(updated));

    r = run("npx prisma db push --accept-data-loss", sessionEnv);
    console.log(r.stdout || r.stderr);
    if (r.code === 0) {
      log("SUCCESS (Method 2)");
      ensureParam(dbUrl, "sslrootcert", "./rds-ca.pem");
      updated = dbUrl.toString();
      envContent = setEnvKey(envContent, "DATABASE_URL", updated);
      envContent = setEnvKey(envContent, "PGSSLROOTCERT", "./rds-ca.pem");
      write(envPath, envContent);

      log("Verify prisma db pull");
      const r2 = run("npx prisma db pull", sessionEnv);
      console.log(r2.stdout || r2.stderr);
      if (r2.code !== 0) process.exit(r2.code);
      log("Done", "Persisted: sslmode=require + sslrootcert=./rds-ca.pem + PGSSLROOTCERT=./rds-ca.pem");
      process.exit(0);
    }

    log("Method 3: try sslmode=verify-full");
    ensureParam(dbUrl, "sslmode", "verify-full");
    updated = dbUrl.toString();
    envContent = setEnvKey(envContent, "DATABASE_URL", updated);
    write(envPath, envContent);
    console.log("DATABASE_URL verify-full (masked):", mask(updated));

    r = run("npx prisma db push --accept-data-loss", sessionEnv);
    console.log(r.stdout || r.stderr);
    if (r.code === 0) {
      log("SUCCESS (Method 3)");
      ensureParam(dbUrl, "sslrootcert", "./rds-ca.pem");
      updated = dbUrl.toString();
      envContent = setEnvKey(envContent, "DATABASE_URL", updated);
      envContent = setEnvKey(envContent, "PGSSLROOTCERT", "./rds-ca.pem");
      write(envPath, envContent);

      log("Verify prisma db pull");
      const r2 = run("npx prisma db pull", sessionEnv);
      console.log(r2.stdout || r2.stderr);
      if (r2.code !== 0) process.exit(r2.code);
      log("Done", "Persisted: sslmode=verify-full + sslrootcert=./rds-ca.pem + PGSSLROOTCERT=./rds-ca.pem");
      process.exit(0);
    }

    log("All methods failed – external checks");
    try {
      const psql = run(`psql --version`);
      if (psql.code === 0) {
        const testUrl = new URL(dbUrl.toString());
        ensureParam(testUrl, "sslmode", "require");
        console.log("Trying psql (masked):", mask(testUrl.toString()));
        const p1 = run(`PGSSLROOTCERT="${pemPath}" psql "${testUrl.toString()}" -c "select version();"`, sessionEnv);
        console.log(p1.stdout || p1.stderr);
      } else {
        console.log("psql not installed; skipping psql test.");
      }
    } catch (e) { console.log("psql test error:", e.message); }

    console.log("\nOpenSSL peek (first lines):");
    const hostMasked = dbUrl.hostname;
    const peek = spawnSync(process.platform === "win32" ? "cmd" : "sh",
      process.platform === "win32"
        ? ["/C", `openssl s_client -showcerts -servername ${hostMasked} -connect ${hostMasked}:${dbUrl.port || 5432} < NUL`]
        : ["-lc", `openssl s_client -showcerts -servername ${hostMasked} -connect ${hostMasked}:${dbUrl.port || 5432} </dev/null | head -n 60`],
      { encoding: "utf8" }
    );
    console.log(peek.stdout || peek.stderr);

    ensureParam(dbUrl, "sslmode", "require");
    removeParam(dbUrl, "sslaccept");
    updated = dbUrl.toString();
    envContent = setEnvKey(envContent, "DATABASE_URL", updated);
    write(envPath, envContent);
    log("Summary",
      `Tried: PGSSLROOTCERT, sslrootcert param, verify-full.\n` +
      `Env file: ${envFile}\n` +
      `Current DATABASE_URL (masked): ${mask(updated)}\n` +
      `Next steps: Confirm Lightsail TLS/CA for your instance. If psql works with PGSSLROOTCERT but Prisma fails, it may be engine/host routing.\n`);
    process.exit(2);
  } catch (e) {
    console.error("Fatal:", e.message);
    process.exit(1);
  }
})();
