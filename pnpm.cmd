@echo off
setlocal
set "PNPM_HOME=%~dp0.toolchain\pnpm12"
set "XDG_RUNTIME_DIR=%~dp0.toolchain\runtime"
set "TEMP=%~dp0.toolchain\tmp"
set "TMP=%TEMP%"
if not exist "%XDG_RUNTIME_DIR%" mkdir "%XDG_RUNTIME_DIR%"
if not exist "%TEMP%" mkdir "%TEMP%"
set "PATH=%PNPM_HOME%;%PATH%"
set "__UNSAFE_EXPO_HOME_DIRECTORY=%~dp0.toolchain\expo-home"
set "EXPO_NO_TELEMETRY=1"
if not exist "%PNPM_HOME%\pnpm.exe" (
  node "%~dp0scripts\bootstrap-pnpm.mjs"
  if errorlevel 1 exit /b 1
)
"%PNPM_HOME%\pnpm.exe" %*
exit /b %ERRORLEVEL%
