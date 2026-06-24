# restart-dev.ps1
# Beendet einen haengenden Next.js Dev-Server auf Port 3000 und startet ihn frisch.
# Aufruf:  ./restart-dev.ps1   (im Projektordner)

$ErrorActionPreference = 'SilentlyContinue'
$port = 3000

Write-Host "Suche Prozess auf Port $port ..." -ForegroundColor Cyan
$pids = Get-NetTCPConnection -LocalPort $port |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -and $_ -ne 0 }

if ($pids) {
    foreach ($procId in $pids) {
        $p = Get-Process -Id $procId
        Write-Host "  Beende PID $procId ($($p.ProcessName)) ..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "  Kein Prozess auf Port $port aktiv." -ForegroundColor DarkGray
}

# Sicherstellen, dass der Port wirklich frei ist
$still = Get-NetTCPConnection -LocalPort $port
if ($still) {
    Write-Host "WARNUNG: Port $port ist noch belegt. Bitte manuell pruefen." -ForegroundColor Red
}

Write-Host "Starte Dev-Server (npm run dev) ..." -ForegroundColor Cyan
npm run dev
