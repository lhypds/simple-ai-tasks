@echo off
REM Build script for Windows: produces dist\stask.exe using pkg
setlocal

echo Building stask.exe...
pushd "%~dp0"

:: Install dependencies if needed
if not exist node_modules (
  echo Installing npm dependencies...
  npm install
)

:: Ensure output dir
if not exist dist mkdir dist

:: Use npx to run pkg (works whether pkg is local or not)
npx pkg . --targets node18-win-x64 --output dist\stask.exe
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Build failed with exit code %ERRORLEVEL%.
  pause
  popd
  exit /b %ERRORLEVEL%
)

necho.
echo Build succeeded: %CD%\dist\stask.exe
pause
popd
endlocal
