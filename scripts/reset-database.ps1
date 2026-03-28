# =============================================================================
# DATABASE RESET SCRIPT FOR WINDOWS
# =============================================================================
# This script performs a complete database reset:
# 1. Kills any running Node processes (prevents EPERM errors)
# 2. Deletes Prisma generated client
# 3. Regenerates Prisma client
# 4. Resets database schema
# 5. Seeds only SUPER_ADMIN user
#
# USAGE: Run from project root in PowerShell
#   .\scripts\reset-database.ps1
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DATABASE RESET SCRIPT (WINDOWS)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# PHASE 1: CLEANUP
# -----------------------------------------------------------------------------
Write-Host "[1/5] Cleaning up Node processes..." -ForegroundColor Yellow

# Kill all Node processes (prevents EPERM file lock issues)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   Found $($nodeProcesses.Count) Node process(es). Terminating..." -ForegroundColor Gray
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   ✓ Node processes terminated" -ForegroundColor Green
} else {
    Write-Host "   ✓ No Node processes running" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# PHASE 2: DELETE PRISMA CLIENT
# -----------------------------------------------------------------------------
Write-Host "[2/5] Removing Prisma generated client..." -ForegroundColor Yellow

$prismaClientPath = ".\node_modules\.prisma"
if (Test-Path $prismaClientPath) {
    Remove-Item -Path $prismaClientPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Deleted $prismaClientPath" -ForegroundColor Green
} else {
    Write-Host "   ✓ Prisma client not found (already clean)" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# PHASE 3: REGENERATE PRISMA CLIENT
# -----------------------------------------------------------------------------
Write-Host "[3/5] Regenerating Prisma client..." -ForegroundColor Yellow

npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ Prisma client generated" -ForegroundColor Green

# -----------------------------------------------------------------------------
# PHASE 4: RESET DATABASE
# -----------------------------------------------------------------------------
Write-Host "[4/5] Resetting database schema..." -ForegroundColor Yellow
Write-Host "   This will DROP all data and recreate tables" -ForegroundColor Gray

# Attempt migrate reset first (preferred)
Write-Host "   Attempting: npx prisma migrate reset --force --skip-seed" -ForegroundColor Gray
npx prisma migrate reset --force --skip-seed

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠ Migrate reset failed, trying db push --force-reset" -ForegroundColor Yellow
    npx prisma db push --force-reset --skip-generate
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Database reset failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "   ✓ Database schema reset complete" -ForegroundColor Green

# -----------------------------------------------------------------------------
# PHASE 5: SEED SUPER_ADMIN
# -----------------------------------------------------------------------------
Write-Host "[5/5] Seeding SUPER_ADMIN user..." -ForegroundColor Yellow

npx prisma db seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ Seed failed" -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# VERIFICATION
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESET COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Database has been reset to factory state" -ForegroundColor Green
Write-Host ""
Write-Host "🔐 Login Credentials:" -ForegroundColor Cyan
Write-Host "   Username: admin@quicktrackinc.com" -ForegroundColor White
Write-Host "   Password: ChangeMe123!" -ForegroundColor White
Write-Host ""
Write-Host "💡 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Start dev server: npm run dev" -ForegroundColor Gray
Write-Host "   2. Navigate to: http://localhost:3000/login" -ForegroundColor Gray
Write-Host "   3. Login with credentials above" -ForegroundColor Gray
Write-Host "   4. Create stores, banks, and users" -ForegroundColor Gray
Write-Host ""
