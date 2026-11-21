# Watchtower

**See what your PC is secretly doing.** Watchtower shows which apps used your microphone, camera and location, maps where your internet traffic goes around the world, and uses Gemini to explain it all in plain English.

Built solo at **HackCC 2026** (Nov 21–22).

## Why

Windows quietly logs every time an app touches your mic, camera or location, and your PC talks to dozens of servers, trackers and ad networks all day. That information is buried several menus deep, or doesn't exist in a readable form at all. Most people (students, families, older relatives) never see any of it.

Watchtower puts it in one place, explains it, and helps you act on it.

## Features

- **Who's Watching:** reads Windows' own privacy log (`CapabilityAccessManager\ConsentStore`) and shows every app that used the mic, camera or location, with a timeline, night-time and background-program flags, and a transparent privacy score. Windows only remembers the last use per app; Watchtower keeps the history.
- **Where Data Goes:** a live 3D globe of every outbound connection, per app, with arcs to each server's country. Connections are tagged as ad tracker, analytics, social tracker, telemetry or normal, and show encryption (HTTPS vs plain HTTP).
- **Gemini explains:** click any place on the globe and Gemini says who those servers are, why your apps talk to them, and whether it's worth worrying about.
- **Ask Watchtower:** chat with Gemini about your own PC ("What did my PC do last night?"), grounded only in Watchtower's data.
- **Quality globe:** real Earth imagery lit by the actual current position of the sun, city lights at night, and live cloud cover (updated every 3 hours).
- **Local-first:** no account, no cloud database. Settings let you turn off map lookups and AI entirely.

## Run it

Requires Windows 10/11 and Node.js 18+.

```
npm install
npm run dev
```

Add a free Gemini API key from [Google AI Studio](https://aistudio.google.com) in **Settings**, or put it in a `key.txt` file in the project folder (it's git-ignored).

## How it works

| Part | Source |
|---|---|
| Sensor history | Windows registry, `HKCU/HKLM\...\CapabilityAccessManager\ConsentStore` (via PowerShell) |
| Live connections | `netstat -ano` + `tasklist`, with a PowerShell `Get-NetTCPConnection` fallback |
| Website names | Windows DNS cache (`Get-DnsClientCache`) |
| Server locations | [ip-api.com](https://ip-api.com) (server IPs only; can be turned off) |
| Tracker labels | Built-in list of ~120 ad, analytics, social and telemetry domains |
| AI | Google Gemini API (`gemini-flash-latest`, with automatic fallback models) |
| Globe | [react-globe.gl](https://github.com/vasturiano/react-globe.gl) / three.js |
| Live clouds | [matteason/live-cloud-maps](https://github.com/matteason/live-cloud-maps) |

Stack: Electron, React, Vite.

## Privacy

- Sensor history, connections and settings stay in your Windows user profile.
- Only server IP addresses go to the location service, and only the details shown in the app go to Gemini, never your files or browsing content.
- Gemini is instructed to treat collected data (domain names, app names) as untrusted, so crafted names can't steer its answers.
