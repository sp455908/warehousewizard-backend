@echo off
REM Password Reset Script for Warehouse Wizard
REM Usage: reset-password.bat <email> <new-password>

if "%~2"=="" (
    echo Usage: reset-password.bat ^<email^> ^<new-password^>
    echo Example: reset-password.bat shubhampatil@gmail.com newpassword123
    pause
    exit /b 1
)

echo Resetting password for: %1
node reset-password.js %1 %2
pause
