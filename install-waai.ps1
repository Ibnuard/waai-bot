$Mode = "release" # Default mode

# Check if script was called with -Trial flag
if ($args -contains "-Trial") {
    $Mode = "trial"
}

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "   WAAI Bot Installer for Windows   " -ForegroundColor Cyan
Write-Host "   Mode: $Mode" -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "[1/5] Checking for Node.js..." -ForegroundColor Cyan
try {
    $nodeVer = node -v
    Write-Host "Node.js is already installed ($nodeVer)" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Downloading and installing Node.js LTS..." -ForegroundColor Yellow
    $url = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
    $out = "$env:TEMP\node-v22.msi"
    Invoke-WebRequest -Uri $url -OutFile $out
    Write-Host "Installing... Please wait." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i $out /quiet /qn /norestart" -Wait
    Write-Host "Node.js installed. Note: If 'npm' fails later, please restart your terminal." -ForegroundColor Green
}

# 2. Download Project
Write-Host "[2/5] Downloading project from GitHub..." -ForegroundColor Cyan
# Replace with the actual ZIP URL of your repo
$repoUrl = "https://github.com/Ibnuard/waai-bot/archive/refs/heads/master.zip"
$zipPath = "waai-bot.zip"
Invoke-WebRequest -Uri $repoUrl -OutFile $zipPath
Write-Host "Extracting project..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath "waai-bot-temp" -Force
Copy-Item -Path "waai-bot-temp\waai-bot-master\*" -Destination "." -Recurse -Force
Remove-Item -Path "waai-bot-temp" -Recurse -Force
Remove-Item -Path $zipPath -Force

# 3. Configure START.bat
Write-Host "[3/5] Configuring START.bat..." -ForegroundColor Cyan
$batContent = @"
@echo off
TITLE WAAI Bot Dashboard
echo Starting WAAI Bot in Production Mode...
SET APP_MODE=$Mode
echo Mode: %APP_MODE%
npm run prod
pause
"@
$batContent | Out-File -FilePath "START.bat" -Encoding ascii

# 4. Install Dependencies
Write-Host "[4/5] Installing dependencies... (may take 1-2 minutes)" -ForegroundColor Cyan
npm install

# 5. Build Project
Write-Host "[5/5] Building client..." -ForegroundColor Cyan
npm run build

Write-Host "====================================" -ForegroundColor Green
Write-Host "      INSTALLATION SUCCESSFUL!      " -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host "To start the bot, double-click: START.bat" -ForegroundColor Cyan
Write-Host "Current mode: $Mode" -ForegroundColor Yellow
pause
