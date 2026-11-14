@echo off
rem Configure tools for this command session, without changing system settings.
for %%I in ("%~dp0..\.toolchain") do set "STUDY_TOOLS=%%~fI"
set "JAVA_HOME=%STUDY_TOOLS%\jdk17"
set "ANDROID_HOME=%STUDY_TOOLS%\android-sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "ANDROID_USER_HOME=%STUDY_TOOLS%\android-user"
set "GRADLE_USER_HOME=%STUDY_TOOLS%\gradle-user"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo JDK 17 is missing from .toolchain\jdk17.
  exit /b 1
)
if not exist "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" (
  echo Android command-line tools are missing from .toolchain\android-sdk.
  exit /b 1
)
if not exist "%ANDROID_USER_HOME%" mkdir "%ANDROID_USER_HOME%"
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%"
exit /b 0
