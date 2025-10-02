@echo off
setlocal enableextensions

:: Set colors for output (Windows console)
set GREEN=92m
set YELLOW=93m
set RED=91m
set NC=0m

:: Function to print colored text
:print_color
echo [%~1%~2[%NC%
goto :eof

:: Display header
call :print_color %YELLOW% "========================================"
call :print_color %YELLOW% "   Baseline Guardrails VS Code Publish  "
call :print_color %YELLOW% "========================================"

:: Process arguments
set VERSION_TYPE=%1
set SKIP_PUBLISH=false

if "%1" == "--skip-publish" (
  set SKIP_PUBLISH=true
  set VERSION_TYPE=
)

if "%2" == "--skip-publish" (
  set SKIP_PUBLISH=true
)

:: Validate version type
if not "%VERSION_TYPE%" == "" (
  if not "%VERSION_TYPE%" == "patch" (
    if not "%VERSION_TYPE%" == "minor" (
      if not "%VERSION_TYPE%" == "major" (
        call :print_color %RED% "Error: Version type must be patch, minor, or major."
        echo Usage: publish-vscode-extension.cmd [patch^|minor^|major] [--skip-publish]
        exit /b 1
      )
    )
  )
)

:: Build the extension first
call :print_color %YELLOW% "Building the extension..."
call npm run build

:: Publish with specified version if provided
if not "%VERSION_TYPE%" == "" (
  call :print_color %YELLOW% "Publishing with %VERSION_TYPE% version increment..."
  if "%SKIP_PUBLISH%" == "true" (
    call npm --prefix packages/vscode-extension run publish:%VERSION_TYPE% -- --skip-publish
  ) else (
    call npm --prefix packages/vscode-extension run publish:%VERSION_TYPE%
  )
) else (
  call :print_color %YELLOW% "Publishing with current version..."
  if "%SKIP_PUBLISH%" == "true" (
    call npm --prefix packages/vscode-extension run publish -- --skip-publish
  ) else (
    call npm --prefix packages/vscode-extension run publish
  )
)

:: Check if successful
if %ERRORLEVEL% EQU 0 (
  call :print_color %GREEN% "✓ Extension publish process completed!"
  echo - The .vsix file is available at: baseline-guardrails-vscode.vsix
  if "%SKIP_PUBLISH%" == "false" (
    echo - Published to VS Code Marketplace
  )
) else (
  call :print_color %RED% "✗ Extension publish process failed!"
  exit /b 1
)

endlocal