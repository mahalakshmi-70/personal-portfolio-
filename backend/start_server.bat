@echo off
cd /d "%~dp0"
set "PYTHON=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
    echo Project virtual environment not found at "%PYTHON%".
    echo Create it and install backend\requirements.txt before starting the server.
    pause
    exit /b 1
)
"%PYTHON%" app.py