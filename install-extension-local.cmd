@echo off
setlocal enableextensions

echo ===========================
echo Install Extension Locally
echo ===========================

:: Check if the VSIX exists
if not exist baseline-guardrails-vscode.vsix (
    echo VSIX not found. Building extension first...
    call npm run vsce:package
    
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to build extension!
        exit /b 1
    )
)

:: Install the extension
echo Installing extension from VSIX...
call code --install-extension baseline-guardrails-vscode.vsix

if %ERRORLEVEL% EQU 0 (
    echo Successfully installed the extension!
    echo To apply changes, please reload VS Code.
) else (
    echo Failed to install extension.
    exit /b 1
)

endlocal