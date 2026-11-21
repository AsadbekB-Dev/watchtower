# Watchtower: slow-changing details, fetched every ~20 seconds.
# Process paths/descriptions (for icons and names) and the DNS cache, including
# CNAME aliases: trackers usually hide behind them (securepubads.g.doubleclick.net
# -> pubads-pagead.l.google.com -> IP), so the alias is the name that matters.

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
  # 1 = A, 28 = AAAA, 5 = CNAME
  if ($r.Type -eq 1 -or $r.Type -eq 28 -or $r.Type -eq 5) {
    $dns.Add([pscustomobject]@{ entry = [string]$r.Entry; name = [string]$r.Name; data = [string]$r.Data; type = [int]$r.Type })
  }
}

[pscustomobject]@{ procs = $procs; dns = $dns } | ConvertTo-Json -Depth 3 -Compress
