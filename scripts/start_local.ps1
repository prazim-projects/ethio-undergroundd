$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$logDirectory = Join-Path $workspace '.tmp'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
function Available-Port([int] $start) {
    for ($candidate = $start; $candidate -lt ($start + 20); $candidate++) {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
        try { $listener.Start(); return $candidate } catch { } finally { $listener.Stop() }
    }
    throw "No free local port near $start"
}
$webPort = Available-Port 3000
$apiPort = Available-Port 8000
$env:VITE_API_URL = "http://127.0.0.1:$apiPort/graphql/"
$env:WEB_ORIGINS = "http://127.0.0.1:$webPort,http://localhost:$webPort,http://127.0.0.1:4173,http://localhost:4173"
$python = Join-Path $workspace 'apps/api/venv-underground/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Create the API virtual environment first; see apps/api/requirements.txt.' }
$apiProcess = Start-Process -FilePath $python -ArgumentList @('manage.py', 'runserver', "127.0.0.1:$apiPort", '--noreload') -WorkingDirectory (Join-Path $workspace 'apps/api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'api-out.log') -RedirectStandardError (Join-Path $logDirectory 'api-error.log')
$webProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('../../node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', "$webPort", '--strictPort') -WorkingDirectory (Join-Path $workspace 'apps/web') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'web-out.log') -RedirectStandardError (Join-Path $logDirectory 'web-error.log')
Write-Output "Web: http://127.0.0.1:$webPort (PID $($webProcess.Id))"
Write-Output "API: http://127.0.0.1:$apiPort (PID $($apiProcess.Id))"
