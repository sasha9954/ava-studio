@echo off
cd /d "%~dp0..\frontend"
if not exist .env copy .env.example .env
npm install
npm run dev
