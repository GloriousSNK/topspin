# Launch both the ML service (port 8000) and the web app (port 3000) in separate windows.
# Usage:  ./dev.ps1   (from the repo root)

$root = $PSScriptRoot

Write-Host "Starting ML service on :8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\ml-service'; ./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000"
)

Write-Host "Starting web app on :3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\web'; npm run dev"
)

Write-Host "`nWeb:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "API:  http://localhost:8000/docs" -ForegroundColor Cyan
