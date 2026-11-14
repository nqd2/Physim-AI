@echo off
setlocal
call "%~dp0toolchain.cmd"
if errorlevel 1 exit /b 1
pushd "%~dp0"
call gradlew.bat --no-daemon --console=plain assembleDebug
set "STUDY_BUILD_RESULT=%ERRORLEVEL%"
popd
if not "%STUDY_BUILD_RESULT%"=="0" exit /b %STUDY_BUILD_RESULT%
echo APK: %~dp0app\build\outputs\apk\debug\app-debug.apk
exit /b 0
