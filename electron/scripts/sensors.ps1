# Watchtower: reads Windows' hidden privacy log (CapabilityAccessManager ConsentStore).
# For every app that touched the microphone, camera or location, Windows keeps
# LastUsedTimeStart / LastUsedTimeStop (FILETIME). Stop = 0 means "in use right now".
# Output: one JSON object on stdout.

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$caps  = @('microphone', 'webcam', 'location')
$roots = @(
  @{ path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'; scope = 'user' },
  @{ path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'; scope = 'machine' }
)

function To-UnixMs([object]$ft) {
  if ($null -eq $ft) { return 0 }
  $v = [int64]$ft
  if ($v -le 0) { return 0 }
  try { return [DateTimeOffset]::FromFileTime($v).ToUnixTimeMilliseconds() } catch { return 0 }
}

$apps     = New-Object System.Collections.Generic.List[object]
$settings = @{}
$descCache = @{}

foreach ($root in $roots) {
  foreach ($cap in $caps) {
    $base = Join-Path $root.path $cap
    if (-not (Test-Path $base)) { continue }

    # Global switch for this sensor ("Allow" / "Deny")
    $g = Get-ItemProperty -Path $base
    if ($g.Value -and -not $settings.ContainsKey("$($root.scope):$cap")) {
      $settings["$($root.scope):$cap"] = [string]$g.Value
    }

    # Store (packaged) apps
    foreach ($k in (Get-ChildItem -Path $base | Where-Object { $_.PSChildName -ne 'NonPackaged' })) {
      $p = Get-ItemProperty -Path $k.PSPath
      $apps.Add([pscustomobject]@{
        cap = $cap; id = $k.PSChildName; packaged = $true; scope = $root.scope
        start = (To-UnixMs $p.LastUsedTimeStart); stop = (To-UnixMs $p.LastUsedTimeStop)
        allowed = [string]$p.Value; path = $null; description = $null
      })
    }

    # Desktop (non-packaged) apps: key name is the exe path with '\' replaced by '#'
    $np = Join-Path $base 'NonPackaged'
    if (Test-Path $np) {
      foreach ($k in (Get-ChildItem -Path $np)) {
        $p = Get-ItemProperty -Path $k.PSPath
        $exe = $k.PSChildName -replace '#', '\'
        $desc = $null
        if ($descCache.ContainsKey($exe)) { $desc = $descCache[$exe] }
        elseif (Test-Path -LiteralPath $exe) {
          $vi = (Get-Item -LiteralPath $exe).VersionInfo
          $desc = if ($vi.FileDescription) { $vi.FileDescription } elseif ($vi.ProductName) { $vi.ProductName } else { $null }
          $descCache[$exe] = $desc
        }
        $apps.Add([pscustomobject]@{
          cap = $cap; id = $k.PSChildName; packaged = $false; scope = $root.scope
          start = (To-UnixMs $p.LastUsedTimeStart); stop = (To-UnixMs $p.LastUsedTimeStop)
          allowed = [string]$p.Value; path = $exe; description = $desc
        })
      }
    }
  }
}

[pscustomobject]@{
  now      = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  settings = $settings
  apps     = $apps
} | ConvertTo-Json -Depth 4 -Compress
