$ErrorActionPreference = 'Stop'
$probeRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$pidFile = Join-Path $probeRoot 'runtime-pids.json'
if (!(Test-Path -LiteralPath $pidFile)) { Write-Output 'No isolated probe PID record.'; exit 0 }
$record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
foreach ($name in @('server','unreal')) {
    $probeProcessId = [int]$record.$name
    $probeProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $probeProcessId" -ErrorAction SilentlyContinue
    if (!$probeProcess) { continue }
    $expectedFile = if ($name -eq 'server') { Join-Path $probeRoot 'server.mjs' } else { Join-Path $probeRoot 'KinetiStream.uproject' }
    if (!$probeProcess.CommandLine.Contains($expectedFile)) { throw "PID $probeProcessId no longer belongs to this isolated probe." }
    Stop-Process -Id $probeProcessId
    Write-Output "Stopped only $name PID $probeProcessId."
}
Remove-Item -LiteralPath $pidFile
