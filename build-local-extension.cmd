@echo off
setlocal enableextensions

:: Make a working directory for our temporary copy
echo Creating working directory...
if not exist temp-extension mkdir temp-extension
del /S /Q temp-extension\* 2>nul

:: Copy core and extension files
echo Copying core and extension files...
xcopy /E /I /Y packages\core temp-extension\core
xcopy /E /I /Y packages\vscode-extension temp-extension\vscode-extension

:: Update the package.json to use a file dependency
echo Updating package.json...
cd temp-extension\vscode-extension
powershell -Command "(Get-Content package.json) -replace '\"@baseline-tools/core\": \"workspace:\*\"', '\"@baseline-tools/core\": \"file:../core\"' | Set-Content package.json"

:: Install dependencies
echo Installing dependencies...
npm install

:: Build the extension
echo Building extension...
npm run build

:: Package the extension with dependencies
echo Packaging extension...
npx @vscode/vsce package --out ..\..\baseline-guardrails-local.vsix

:: Cleanup
cd ..\..
echo Done! Your local installable extension is ready at: baseline-guardrails-local.vsix
echo.
echo Installation instructions:
echo 1. In VS Code: Extensions panel -^> ... menu -^> Install from VSIX
echo 2. Select baseline-guardrails-local.vsix
echo 3. Reload VS Code when prompted
echo.
echo The extension should now work with all features.

endlocal