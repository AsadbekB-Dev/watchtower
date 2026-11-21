# Watchtower: live outbound connections, which app owns each one, and the
# domain names Windows resolved recently (DNS cache), as one JSON object.

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$procs = @{}
foreach ($p in Get-Process) {
  $procs[[int]$p.Id] = [pscustomobject]@{ name = $p.ProcessName; path = $p.Path; title = $p.MainWindowTitle; desc = $p.Description }
}

$conns = New-Object System.Collections.Generic.List[object]
foreach ($c in (Get-NetTCPConnection -State Established)) {
  $ip = [string]$c.RemoteAddress
  if ($ip -match '^(127\.|0\.|::1$|::$|fe80:|169\.254\.)') { continue }
  $p = $procs[[int]$c.OwningProcess]
  $conns.Add([pscustomobject]@{
    ip = $ip; port = [int]$c.RemotePort; pid = [int]$c.OwningProcess
    proc = if ($p) { $p.name } else { $null }
    path = if ($p) { $p.path } else { $null }
    desc = if ($p) { $p.desc } else { $null }
  })
}

# IP -> names, from records Windows resolved recently
$dns = New-Object System.Collections.Generic.List[object]
foreach ($r in (Get-DnsClientCache)) {
  if ($r.Type -eq 1 -or $r.Type -eq 28) {
    $dns.Add([pscustomobject]@{ name = [string]$r.Entry; ip = [string]$r.Data })
  }
}

[pscustomobject]@{
  now   = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  conns = $conns
  dns   = $dns
} | ConvertTo-Json -Depth 4 -Compress
