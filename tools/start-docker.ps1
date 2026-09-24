$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a abrir este archivo.'
    }
    docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) { throw 'Abre Docker Desktop y espera a que termine de iniciar.' }
    if (-not (Test-Path -LiteralPath '.docker.env')) {
        $databasePassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        Set-Content -LiteralPath '.docker.env' -Value "INVENTIC_DB_PASSWORD=$databasePassword" -Encoding ASCII
    }
    docker compose --env-file .docker.env up --build --detach --wait --wait-timeout 240
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar InventIC. Revisa el mensaje anterior y comprueba que el puerto 3000 esté libre.' }
    Write-Host 'InventIC disponible en http://localhost:3000'
} catch {
    Write-Host $_.Exception.Message
    exit 1
}
