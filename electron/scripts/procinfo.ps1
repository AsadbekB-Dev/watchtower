# Watchtower: slow-changing details, fetched every ~20 seconds.
# Process paths/descriptions (for icons and names) and the DNS cache (IP -> website name).

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$procs = New-Object System.Collections.Generic.List[object]
foreach ($p in Get-Process) {
  if ($p.Path) {
    $procs.Add([pscustomobject]@{ pid = [int]$p.Id; name = $p.ProcessName; path = $p.Path; desc = $p.Description })
  }
}

$dns = New-Object System.Collections.Generic.List[object]
foreach ($r in (Get-DnsClientCache)) {
  if ($r.Type -eq 1 -or $r.Type -eq 28) {
    $dns.Add([pscustomobject]@{ name = [string]$r.Entry; ip = [string]$r.Data })
  }
}

[pscustomobject]@{ procs = $procs; dns = $dns } | ConvertTo-Json -Depth 3 -Compress
