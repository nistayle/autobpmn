@echo off
title AutoBPMN - 1-Click Starter
echo ============================================================
echo           AutoBPMN - Memulai Aplikasi Otomatis
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Memeriksa API Key di .env...
if not exist ".env" (
    echo [PERINGATAN] File .env belum ditemukan!
    echo Membuat .env dari contoh...
    copy .env.example .env >nul
    echo Silakan buka file .env dan isi salah satu API Key:
    echo - GROQ_API_KEY (Rekomendasi: cepat & gratis di https://console.groq.com)
    echo - GEMINI_API_KEY (Gratis di https://aistudio.google.com)
    echo - OPENROUTER_API_KEY (Gratis di https://openrouter.ai)
    echo.
)

echo [2/3] Menjalankan Backend Server (Port 8000)...
start "AutoBPMN Backend" cmd /k "cd /d "%~dp0backend" && ..\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Menjalankan Frontend Web (Port 5173)...
start "AutoBPMN Frontend" cmd /k "cd /d "%~dp0frontend" && npx vite"

echo.
echo ============================================================
echo Selesai! Tunggu 3 detik, browser akan otomatis dibuka...
echo ============================================================
timeout /t 3 /nobreak >nul
start http://localhost:5173
exit
