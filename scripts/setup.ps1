# One-shot dev setup for PowerShell.
# Bring up Postgres via docker compose, push schema, generate Prisma client, seed.

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Created .env.local from .env.example. Edit it to add ANTHROPIC_API_KEY."
}

# Make sure DATABASE_URL points at the docker-compose Postgres.
$envText = Get-Content ".env.local" -Raw
if ($envText -notmatch 'DATABASE_URL=.*localhost:5432') {
    $envText = [regex]::Replace(
        $envText,
        '(?m)^DATABASE_URL=.*$',
        'DATABASE_URL="postgresql://revline:revline@localhost:5432/revline?schema=public"'
    )
    Set-Content -Path ".env.local" -Value $envText -NoNewline
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "-> Starting Postgres via docker compose"
    docker compose up -d postgres

    Write-Host "-> Waiting for Postgres to be healthy"
    for ($i = 1; $i -le 30; $i++) {
        docker compose exec -T postgres pg_isready -U revline -d revline 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 1
    }
} else {
    Write-Host "Docker not found. Make sure DATABASE_URL in .env.local points at a running Postgres."
}

Write-Host "-> Generating Prisma client"
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "-> Pushing schema"
npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "-> Seeding demo data"
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Run: npm run dev"
Write-Host "Open:    http://localhost:3000"
