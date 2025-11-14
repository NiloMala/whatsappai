$ErrorActionPreference = 'Stop'
$headers = @{ 'User-Agent' = 'powershell' }
Write-Output "Fetching latest stripe-cli release info from GitHub..."
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/stripe/stripe-cli/releases/latest' -Headers $headers
$asset = $release.assets | Where-Object { $_.name -match 'windows.*zip' -or $_.name -match 'windows.*exe' } | Select-Object -First 1
if (-not $asset) { Write-Error 'No Windows asset found in latest release.'; exit 1 }
$zipUrl = $asset.browser_download_url
$zipPath = Join-Path $env:TEMP 'stripe_cli.zip'
Write-Output "Downloading $($asset.name) from $zipUrl to $zipPath..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -Headers $headers
$extractPath = Join-Path $env:TEMP 'stripe_cli'
if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
Write-Output "Extracting $zipPath to $extractPath..."
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
# find stripe.exe
$exe = Get-ChildItem -Path $extractPath -Filter 'stripe.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) { Write-Error 'stripe.exe not found in archive'; exit 1 }
$destDir = Join-Path $env:APPDATA 'npm'
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
$dest = Join-Path $destDir 'stripe.exe'
Write-Output "Copying $($exe.FullName) to $dest..."
Copy-Item -Path $exe.FullName -Destination $dest -Force
Write-Output "Cleaning up..."
Remove-Item $zipPath -Force
# verify
Write-Output "Running 'stripe version' to verify install..."
& $dest version
Write-Output 'Stripe CLI installation complete.'
