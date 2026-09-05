param([ValidateSet('web', 'lab')][string]$View = 'lab')
$ErrorActionPreference = 'Stop'
$kinetiRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$kinetiNode = (Get-Command node.exe -ErrorAction Stop).Source
$kinetiVite = Join-Path $kinetiRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $kinetiVite)) { throw 'Faltan dependencias. Ejecuta npm ci en la carpeta de Kineti.' }
$kinetiBase = 'http://127.0.0.1:5173'
function Test-KinetiServer {
  try {
    $kinetiResponse = Invoke-WebRequest -Uri $kinetiBase -UseBasicParsing -TimeoutSec 2
    return $kinetiResponse.StatusCode -eq 200 -and $kinetiResponse.Content -match 'Kineti'
  } catch { return $false }
}
if (-not (Test-KinetiServer)) {
  Start-Process -FilePath $kinetiNode -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $kinetiRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $kinetiRoot 'kineti-server.log') -RedirectStandardError (Join-Path $kinetiRoot 'kineti-server-error.log')
  for ($kinetiAttempt = 0; $kinetiAttempt -lt 40; $kinetiAttempt++) {
    if (Test-KinetiServer) { break }
    Start-Sleep -Milliseconds 250
  }
}
if (-not (Test-KinetiServer)) { throw 'No se pudo iniciar Kineti en el puerto 5173. Revisa kineti-server-error.log.' }
$kinetiUrl = if ($View -eq 'lab') { "$kinetiBase/research/ab.html" } else { "$kinetiBase/" }
$kinetiChrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (Test-Path -LiteralPath $kinetiChrome) { Start-Process -FilePath $kinetiChrome -ArgumentList $kinetiUrl }
else { Start-Process $kinetiUrl }
