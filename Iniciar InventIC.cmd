@echo off
cd /d "%~dp0"
echo Iniciando InventIC...
echo Abre http://localhost:3000 en tu navegador.
node tools/start.cjs
if errorlevel 1 pause
