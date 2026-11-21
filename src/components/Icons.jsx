const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const MicIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const CamIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
);

export const PinIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const EyeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const GlobeIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

export const SparkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
);

export const MoonIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);

export const ClockIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const ArrowIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const TowerLogo = (p) => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" {...p}>
    <defs>
      <linearGradient id="wt-g" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0" stopColor="#5eead4" />
        <stop offset="1" stopColor="#38bdf8" />
      </linearGradient>
    </defs>
    <path d="M16 3 9 29h14L16 3Z" stroke="url(#wt-g)" strokeWidth="2" strokeLinejoin="round" />
    <path d="M11.5 20h9M13 14h6" stroke="url(#wt-g)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="8.5" r="2" fill="url(#wt-g)" />
    <path d="M9 6.5a9 9 0 0 1 0 4M23 6.5a9 9 0 0 0 0 4M6 4.5a13 13 0 0 1 0 8M26 4.5a13 13 0 0 0 0 8" stroke="url(#wt-g)" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
  </svg>
);

export const capIcon = (cap, p) =>
  cap === 'microphone' ? <MicIcon {...p} /> : cap === 'webcam' ? <CamIcon {...p} /> : <PinIcon {...p} />;
