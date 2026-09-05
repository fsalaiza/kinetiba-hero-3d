param([switch]$Build)
$ErrorActionPreference = 'Stop'
$probeRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$engineRoot = 'C:\Program Files\Epic Games\UE_5.7'
$projectFile = Join-Path $probeRoot 'KinetiStream.uproject'
$logsDir = Join-Path $probeRoot 'logs'
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
foreach ($probePort in @(8898,8899)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $probePort -ErrorAction SilentlyContinue) {
        throw "Port $probePort is already occupied. Stop the existing isolated probe before restarting."
    }
}
if ($Build -or !(Test-Path -LiteralPath (Join-Path $probeRoot 'Binaries\Win64\UnrealEditor-KinetiStream.dll'))) {
    & "$engineRoot\Engine\Build\BatchFiles\Build.bat" KinetiStreamEditor Win64 Development "-Project=$projectFile" -WaitMutex -NoHotReloadFromIDE -MaxParallelActions=4 -NoUBA
    if ($LASTEXITCODE -ne 0) { throw 'Unreal probe build failed.' }
}
$nodeExecutable = (Get-Command node.exe).Source
$serverFile = Join-Path $probeRoot 'server.mjs'
$serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $probeRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logsDir 'server.log') -RedirectStandardError (Join-Path $logsDir 'server-error.log') -PassThru
$engineArgs = @(
    '"' + $projectFile + '"', '/Engine/Maps/Entry', '-game', '-RenderOffscreen', '-Unattended', '-NoSplash', '-NoSound', '-NoMessaging',
    '-ResX=1280', '-ResY=720', '-ForceRes', '-Windowed', '-NoVSync', '-stdout', '-FullStdOutLogOutput',
    '-PixelStreamingConnectionURL=ws://127.0.0.1:8898', '-PixelStreamingID=Kineti', '-PixelStreamingEncoderCodec=H264',
    '-PixelStreamingWebRTCFps=60', '-PixelStreamingWebRTCMinBitrate=5000000', '-PixelStreamingWebRTCMaxBitrate=20000000'
)
$engineProcess = Start-Process -FilePath "$engineRoot\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" -ArgumentList $engineArgs -WorkingDirectory $probeRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logsDir 'unreal.log') -RedirectStandardError (Join-Path $logsDir 'unreal-error.log') -PassThru
@{ server = $serverProcess.Id; unreal = $engineProcess.Id; project = $projectFile; created = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $probeRoot 'runtime-pids.json') -Encoding utf8
Write-Output "Browser: http://127.0.0.1:8899; server PID $($serverProcess.Id), Unreal PID $($engineProcess.Id)."
Write-Output "First launch can compile shaders. Inspect $logsDir\unreal.log for KINETI_READY."
