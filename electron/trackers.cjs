// Domain -> { category, company }. Matched on the domain or any parent domain.
// Categories: ads, analytics, social, telemetry. Everything else is "normal".
const LIST = {
  // Ads
  'doubleclick.net': ['ads', 'Google Ads'],
  'googlesyndication.com': ['ads', 'Google Ads'],
  'googleadservices.com': ['ads', 'Google Ads'],
  'adservice.google.com': ['ads', 'Google Ads'],
  'google-analytics.com': ['analytics', 'Google Analytics'],
  'googletagmanager.com': ['analytics', 'Google Tag Manager'],
  'googletagservices.com': ['ads', 'Google Ads'],
  'adnxs.com': ['ads', 'Xandr (Microsoft Ads)'],
  'criteo.com': ['ads', 'Criteo'],
  'criteo.net': ['ads', 'Criteo'],
  'taboola.com': ['ads', 'Taboola'],
  'outbrain.com': ['ads', 'Outbrain'],
  'amazon-adsystem.com': ['ads', 'Amazon Ads'],
  'adsrvr.org': ['ads', 'The Trade Desk'],
  'rubiconproject.com': ['ads', 'Magnite'],
  'pubmatic.com': ['ads', 'PubMatic'],
  'openx.net': ['ads', 'OpenX'],
  'casalemedia.com': ['ads', 'Index Exchange'],
  'moatads.com': ['ads', 'Oracle Moat'],
  'scorecardresearch.com': ['analytics', 'Comscore'],
  'quantserve.com': ['analytics', 'Quantcast'],
  'bidswitch.net': ['ads', 'BidSwitch'],
  'smartadserver.com': ['ads', 'Equativ'],
  'media.net': ['ads', 'Media.net'],
  'adform.net': ['ads', 'Adform'],
  'spotxchange.com': ['ads', 'SpotX'],
  'ads-twitter.com': ['ads', 'X (Twitter) Ads'],
  'ads.linkedin.com': ['ads', 'LinkedIn Ads'],
  'adsafeprotected.com': ['ads', 'Integral Ad Science'],
  'doubleverify.com': ['ads', 'DoubleVerify'],
  'spotify.map.fastly.net': ['normal', 'Spotify'],
  'ads.spotify.com': ['ads', 'Spotify Ads'],
  'spclient.wg.spotify.com': ['normal', 'Spotify'],
  'unityads.unity3d.com': ['ads', 'Unity Ads'],
  'applovin.com': ['ads', 'AppLovin'],
  // Analytics
  'segment.io': ['analytics', 'Segment'],
  'segment.com': ['analytics', 'Segment'],
  'mixpanel.com': ['analytics', 'Mixpanel'],
  'hotjar.com': ['analytics', 'Hotjar'],
  'amplitude.com': ['analytics', 'Amplitude'],
  'newrelic.com': ['analytics', 'New Relic'],
  'nr-data.net': ['analytics', 'New Relic'],
  'sentry.io': ['analytics', 'Sentry'],
  'datadoghq.com': ['analytics', 'Datadog'],
  'clarity.ms': ['analytics', 'Microsoft Clarity'],
  'branch.io': ['analytics', 'Branch'],
  'appsflyer.com': ['analytics', 'AppsFlyer'],
  'adjust.com': ['analytics', 'Adjust'],
  'braze.com': ['analytics', 'Braze'],
  'optimizely.com': ['analytics', 'Optimizely'],
  'fullstory.com': ['analytics', 'FullStory'],
  'chartbeat.com': ['analytics', 'Chartbeat'],
  'stats.wp.com': ['analytics', 'WordPress Stats'],
  // Social
  'facebook.com': ['social', 'Meta'],
  'facebook.net': ['social', 'Meta'],
  'fbcdn.net': ['social', 'Meta'],
  'instagram.com': ['social', 'Meta'],
  'whatsapp.net': ['social', 'Meta'],
  'tiktok.com': ['social', 'TikTok'],
  'tiktokcdn.com': ['social', 'TikTok'],
  'byteoversea.com': ['social', 'TikTok (ByteDance)'],
  'twitter.com': ['social', 'X (Twitter)'],
  'x.com': ['social', 'X (Twitter)'],
  'twimg.com': ['social', 'X (Twitter)'],
  'linkedin.com': ['social', 'LinkedIn'],
  'snapchat.com': ['social', 'Snap'],
  'reddit.com': ['social', 'Reddit'],
  'pinterest.com': ['social', 'Pinterest'],
  // Telemetry
  'events.data.microsoft.com': ['telemetry', 'Microsoft telemetry'],
  'vortex.data.microsoft.com': ['telemetry', 'Microsoft telemetry'],
  'settings-win.data.microsoft.com': ['telemetry', 'Microsoft telemetry'],
  'browser.events.data.msn.com': ['telemetry', 'Microsoft telemetry'],
  'telemetry.microsoft.com': ['telemetry', 'Microsoft telemetry'],
  'watson.telemetry.microsoft.com': ['telemetry', 'Microsoft telemetry'],
  'telemetry.nvidia.com': ['telemetry', 'NVIDIA telemetry'],
  'gfe.nvidia.com': ['telemetry', 'NVIDIA telemetry'],
  'telemetry.dell.com': ['telemetry', 'Dell telemetry'],
  'tm.dell.com': ['telemetry', 'Dell telemetry'],
  'metrics.icloud.com': ['telemetry', 'Apple telemetry'],
  'crashlytics.com': ['telemetry', 'Google Crashlytics'],
  'app-measurement.com': ['analytics', 'Google Firebase Analytics'],
  'telemetry.discord.com': ['telemetry', 'Discord telemetry'],
  'sentry.discord.com': ['telemetry', 'Discord telemetry'],
  'logs.roblox.com': ['telemetry', 'Roblox telemetry'],
  'ecsv2.roblox.com': ['telemetry', 'Roblox telemetry'],
  'telemetry.riotgames.com': ['telemetry', 'Riot telemetry'],
  'data.riotgames.com': ['telemetry', 'Riot telemetry'],
  'mozilla.cloudflare-dns.com': ['normal', 'Cloudflare DNS'],
  'incoming.telemetry.mozilla.org': ['telemetry', 'Mozilla telemetry'],
};

// Company names for common normal services
const COMPANIES = {
  'google.com': 'Google', 'googleapis.com': 'Google', 'gstatic.com': 'Google', 'youtube.com': 'YouTube', 'googlevideo.com': 'YouTube', 'ytimg.com': 'YouTube',
  'microsoft.com': 'Microsoft', 'msn.com': 'Microsoft', 'live.com': 'Microsoft', 'office.com': 'Microsoft', 'windows.com': 'Microsoft', 'bing.com': 'Microsoft Bing', 'azureedge.net': 'Microsoft Azure', 'msedge.net': 'Microsoft',
  'discord.com': 'Discord', 'discord.gg': 'Discord', 'discordapp.com': 'Discord', 'discordapp.net': 'Discord', 'discord.media': 'Discord',
  'spotify.com': 'Spotify', 'scdn.co': 'Spotify', 'roblox.com': 'Roblox', 'rbxcdn.com': 'Roblox', 'riotgames.com': 'Riot Games', 'steampowered.com': 'Valve (Steam)', 'steamcommunity.com': 'Valve (Steam)', 'steamserver.net': 'Valve (Steam)',
  'epicgames.com': 'Epic Games', 'unrealengine.com': 'Epic Games', 'ea.com': 'EA', 'nvidia.com': 'NVIDIA', 'dell.com': 'Dell', 'apple.com': 'Apple', 'icloud.com': 'Apple',
  'amazonaws.com': 'Amazon AWS', 'amazon.com': 'Amazon', 'cloudfront.net': 'Amazon CloudFront', 'akamaized.net': 'Akamai', 'akamaiedge.net': 'Akamai', 'akamai.net': 'Akamai', 'fastly.net': 'Fastly', 'cloudflare.com': 'Cloudflare',
  'github.com': 'GitHub', 'githubusercontent.com': 'GitHub', 'anthropic.com': 'Anthropic', 'claude.ai': 'Anthropic', 'openai.com': 'OpenAI', 'chatgpt.com': 'OpenAI',
  'tradingview.com': 'TradingView', 'brave.com': 'Brave', 'bravesoftware.com': 'Brave', 'zoom.us': 'Zoom', 'slack.com': 'Slack', 'whatsapp.com': 'Meta',
};

function lookup(domain, table) {
  if (!domain) return null;
  const parts = domain.toLowerCase().replace(/\.$/, '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join('.');
    if (table[d]) return table[d];
  }
  return null;
}

function classify(domain, org) {
  const hit = lookup(domain, LIST);
  if (hit) return { category: hit[0], company: hit[1] };
  const company = lookup(domain, COMPANIES);
  if (company) return { category: 'normal', company };
  const o = String(org || '');
  if (/facebook|meta platforms/i.test(o)) return { category: 'social', company: 'Meta' };
  if (/bytedance|tiktok/i.test(o)) return { category: 'social', company: 'TikTok (ByteDance)' };
  return { category: 'normal', company: null };
}

module.exports = { classify };
