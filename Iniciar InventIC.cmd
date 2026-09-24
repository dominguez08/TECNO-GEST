@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Falta Node.js 22 o superior. Instalalo desde https://nodejs.org
  echo Tambien puedes usar Iniciar con Docker.cmd si tienes Docker Desktop.
  pause
  exit /b 1
)
echo Iniciando InventIC...
echo La primera vez se preparan las dependencias y la base de datos.
echo Al terminar abre la direccion que aparece en esta ventana.
node tools/start.cjs
if errorlevel 1 pause
