@echo off
setlocal
rem Portable toolchain, scoped to this process. No machine settings are changed.
for %%I in ("%~dp0..") do set "PHYSIM_ROOT=%%~fI"
set "JAVA_HOME=%PHYSIM_ROOT%\.toolchain\jdk17"
set "ANDROID_HOME=%PHYSIM_ROOT%\.toolchain\android-sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "ANDROID_USER_HOME=%PHYSIM_ROOT%\.toolchain\android-user"
set "GRADLE_USER_HOME=%PHYSIM_ROOT%\.toolchain\gradle-user"
set "__UNSAFE_EXPO_HOME_DIRECTORY=%PHYSIM_ROOT%\.toolchain\expo-home"
set "EXPO_NO_TELEMETRY=1"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%"
set "PHYSIM_VARIANT=%~1"
if not defined PHYSIM_VARIANT set "PHYSIM_VARIANT=release"
if /i "%PHYSIM_VARIANT%"=="release" (
  set "PHYSIM_TASK=assembleRelease"
) else if /i "%PHYSIM_VARIANT%"=="debug" (
  set "PHYSIM_TASK=assembleDebug"
) else (
  echo Usage: scripts\build-physim-android.cmd [release^|debug] [ABI]
  exit /b 2
)
set "PHYSIM_ABI=%~2"
if not defined PHYSIM_ABI set "PHYSIM_ABI=arm64-v8a"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo Missing portable JDK 17: %JAVA_HOME%
  exit /b 1
)
if not exist "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" (
  echo Missing Android command-line tools: %ANDROID_HOME%
  exit /b 1
)
if not exist "%PHYSIM_ROOT%\node_modules\expo\bin\cli" (
  echo Install workspace dependencies first: pnpm install
  exit /b 1
)
if not exist "%ANDROID_USER_HOME%" mkdir "%ANDROID_USER_HOME%"
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"
pushd "%PHYSIM_ROOT%\apps\mobile"
node "%PHYSIM_ROOT%\node_modules\expo\bin\cli" prebuild --platform android --no-install --no-clean
if errorlevel 1 (
  popd
  exit /b 1
)
cd android
call gradlew.bat %PHYSIM_TASK% --no-daemon --console=plain --max-workers=2 "-PreactNativeArchitectures=%PHYSIM_ABI%" -Pandroid.cmakeVersion=3.30.5
set "PHYSIM_RESULT=%ERRORLEVEL%"
popd
if not "%PHYSIM_RESULT%"=="0" exit /b %PHYSIM_RESULT%
echo APK: %PHYSIM_ROOT%\apps\mobile\android\app\build\outputs\apk\%PHYSIM_VARIANT%\app-%PHYSIM_VARIANT%.apk
if /i "%PHYSIM_VARIANT%"=="release" echo Pilot build signed with the development key. Configure a private signing key before store publication.
if /i "%PHYSIM_VARIANT%"=="debug" echo Development build requires Metro. Use release for a standalone pilot APK.
exit /b 0
