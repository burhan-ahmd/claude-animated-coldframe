# fastdl.ps1 - parallel-segment downloader for GitHub release assets (Range-enabled URLs).
# Splits the file into N byte-ranges downloaded simultaneously by curl.exe, then stitches them.
# Usage:  powershell -File scripts\fastdl.ps1 -Url <browser_download_url> -Out <path.mp4> [-Segments 8]
# Requires: curl.exe (ships with Windows 10+). Works on PowerShell 5.1+.
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Segments = 8
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$sw = [Diagnostics.Stopwatch]::StartNew()

# 1) Size via HEAD (follow redirects; release asset URLs redirect to signed blob storage)
$hdr = & curl.exe -sIL $Url
$cl = ($hdr | Select-String -CaseSensitive:$false '^content-length' | Select-Object -Last 1) -replace '\D', ''
if (-not $cl) { throw "No Content-Length from $Url - URL wrong or private?" }
$size = [long]$cl

# 2) Small files: single stream is fine
if ($size -lt 5MB -or $Segments -lt 2) {
  & curl.exe -sL --retry 3 -o $Out $Url
  $sw.Stop()
  "single-stream: {0:N1} MB in {1:N1}s = {2:N1} MB/s" -f ($size / 1MB), $sw.Elapsed.TotalSeconds, ($size / 1MB / [math]::Max($sw.Elapsed.TotalSeconds, 0.01))
  return
}

# 3) Segment ranges
$part = [math]::Ceiling($size / $Segments)
$tmp = "$Out.parts"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$procs = @()
for ($i = 0; $i -lt $Segments; $i++) {
  $a = $i * $part
  $b = [math]::Min($a + $part - 1, $size - 1)
  if ($a -gt $b) { break }
  $seg = Join-Path $tmp "seg_$i"
  $procs += Start-Process -FilePath curl.exe -ArgumentList @('-sL', '--retry', '3', '-r', "$a-$b", '-o', $seg, $Url) -PassThru -NoNewWindow
}
$procs | Wait-Process

# 4) Verify every segment landed with the exact expected size
for ($i = 0; $i -lt $Segments; $i++) {
  $a = $i * $part
  $b = [math]::Min($a + $part - 1, $size - 1)
  if ($a -gt $b) { break }
  $seg = Join-Path $tmp "seg_$i"
  $want = $b - $a + 1
  $got = (Get-Item $seg -ErrorAction Stop).Length
  if ($got -ne $want) { throw "segment $i incomplete: $got / $want bytes" }
}

# 5) Stitch
$fs = [IO.File]::Open($Out, [IO.FileMode]::Create)
try {
  foreach ($f in (Get-ChildItem $tmp -Filter 'seg_*' | Sort-Object Name)) {
    $bytes = [IO.File]::ReadAllBytes($f.FullName)
    $fs.Write($bytes, 0, $bytes.Length)
  }
} finally { $fs.Close() }
if ((Get-Item $Out).Length -ne $size) { throw "final size mismatch" }
Remove-Item $tmp -Recurse -Force
$sw.Stop()
"parallel x${Segments}: {0:N1} MB in {1:N1}s = {2:N1} MB/s" -f ($size / 1MB), $sw.Elapsed.TotalSeconds, ($size / 1MB / [math]::Max($sw.Elapsed.TotalSeconds, 0.01))
