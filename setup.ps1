# One-time setup for the cartoon 3D shorts skill (Windows).
# Run from this folder:  powershell -ExecutionPolicy Bypass -File setup.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "MISSING: $cmd  ->  $hint" -ForegroundColor Red; $script:bad = $true }
  else { Write-Host "ok  $cmd" }
}
$bad = $false
Need node   "install Node.js LTS: winget install OpenJS.NodeJS.LTS"
Need python "install Python 3: winget install Python.Python.3.12"
Need ffmpeg "install ffmpeg: winget install Gyan.FFmpeg"
if ($bad) { Write-Host "Install the missing tools, open a new terminal, then run setup.ps1 again."; exit 1 }

Write-Host "`n1/4  Python packages (numpy, scipy) for the sound"
python -m pip install --quiet --user numpy scipy

Write-Host "`n2/4  npm packages (Remotion, three.js)"
Push-Location "$here\studio"
npm install --no-audit --no-fund

Write-Host "`n3/4  Free Kenney 3D models (CC0)"
node scripts/get-models.mjs
Pop-Location

Write-Host "`n4/4  Render temp folder"
# every render bundle leaves a copy of public/ in the temp folder: put it on the drive with the most free space
$drive = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free } | Sort-Object Free -Descending | Select-Object -First 1
$tmp = "$($drive.Root)remotion-tmp" -replace '\\', '/'
[Environment]::SetEnvironmentVariable("REMOTION_TMP", $tmp, "User")
$env:REMOTION_TMP = $tmp
Write-Host "REMOTION_TMP = $tmp  ($([math]::Round($drive.Free / 1GB)) GB free)"

# make the skill visible to Claude Code
$skills = "$HOME\.claude\skills"
$link = "$skills\cartoon-3d-short"
if (-not (Test-Path $link)) {
  New-Item -ItemType Directory -Force $skills | Out-Null
  New-Item -ItemType Junction -Path $link -Target $here | Out-Null
  Write-Host "`nSkill linked: $link -> $here"
}

Write-Host "`nDone. Open Claude Code in this folder and say:" -ForegroundColor Green
Write-Host '  Use the cartoon short skill and make a short about ...'
