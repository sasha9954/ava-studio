@echo off
echo Starting ava-studio backend and frontend in two windows...
start "ava backend" cmd /k "%~dp0start_backend.bat"
start "ava frontend" cmd /k "%~dp0start_frontend.bat"
