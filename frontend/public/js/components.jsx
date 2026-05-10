/* global React */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const U = window.NEXUS_UTIL;

// ============================================================
// Icons (minimal stroke icons, 16px default)
// ============================================================
const Icon = {
  Bolt: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  ),
  Copy: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  Check: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
  ),
  Ext: ({ s = 12 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>
  ),
  Play: ({ s = 14, filled }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4 20 12 6 20Z"/></svg>
  ),
  Search: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  ),
  Filter: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
  ),
  Chip: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>
  ),
  Cube: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7Z"/><path d="m3 7 9 5 9-5"/><path d="M12 12v10"/></svg>
  ),
  Coin: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 9h5a2 2 0 1 1 0 4H9m0 0h6a2 2 0 1 1 0 4H9V8"/></svg>
  ),
  Activity: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
  ),
  Stopwatch: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>
  ),
  Box: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
  ),
  Lock: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
  ),
  Send: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-8-7 18-3-7Z"/><path d="m11 13 6-6"/></svg>
  ),
  Hash: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/></svg>
  ),
  Receipt: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
  ),
  Inbox: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13h5l1 3h6l1-3h5"/><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/></svg>
  ),
  Spark: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>
  ),
  Refresh: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
  ),
};

// ============================================================
// LiveIndicator
// ============================================================
function LiveIndicator({ label = "LIVE", color = "var(--green)" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 600,
      color: color, fontFamily: "var(--font-mono)"
    }}>
      <span className="pulse-dot" style={{ color }} />
      {label}
    </span>
  );
}

// ============================================================
// CopyButton (icon-only)
// ============================================================
function CopyButton({ value, size = 12 }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).catch(()=>{});
        setCopied(true);
        setTimeout(() => setCopied(false), 1100);
      }}
      title={copied ? "Copied" : "Copy"}
      style={{
        background: "transparent", border: "none", padding: 2, cursor: "pointer",
        color: copied ? "var(--green)" : "var(--fg-3)",
        display: "inline-flex", alignItems: "center",
        transition: "color 120ms ease",
      }}
      onMouseEnter={(e)=>{ if (!copied) e.currentTarget.style.color = "var(--fg-1)"; }}
      onMouseLeave={(e)=>{ if (!copied) e.currentTarget.style.color = "var(--fg-3)"; }}
    >
      {copied ? <Icon.Check s={size}/> : <Icon.Copy s={size}/>}
    </button>
  );
}

// ============================================================
// ProofHashDisplay / Pubkey display
// ============================================================
function MonoAddr({ value, kind = "pub", showCopy = true, link, head, tail }) {
  if (!value) return <span className="mono dim">—</span>;
  const display = U.truncatePubkey(value, head ?? (kind === "hash" ? 6 : 4), tail ?? 4);
  const inner = (
    <span className="mono" style={{ fontSize: 12, color: "var(--fg-1)" }}>{display}</span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {inner}
          <span style={{ color: "var(--fg-3)" }}><Icon.Ext s={10}/></span>
        </a>
      ) : inner}
      {showCopy && <CopyButton value={value} />}
    </span>
  );
}

// ============================================================
// StatusBadge
// ============================================================
const STATUS_STYLES = {
  "Initialized":     { color: "var(--blue)",   bg: "var(--blue-dim)",   pulse: true,  label: "INITIALIZED" },
  "Escrow Locked":   { color: "var(--blue)",   bg: "var(--blue-dim)",   pulse: true,  label: "ESCROW LOCKED" },
  "Proof Submitted": { color: "var(--yellow)", bg: "var(--yellow-dim)", pulse: true,  label: "PROOF SUBMITTED" },
  "Disbursed":       { color: "var(--green)",  bg: "var(--green-dim)",  pulse: false, label: "DISBURSED" },
  "Cancelled":       { color: "var(--red)",    bg: "var(--red-dim)",    pulse: false, label: "CANCELLED" },
  "Processing":      { color: "var(--yellow)", bg: "var(--yellow-dim)", pulse: true,  label: "PROCESSING" },
  "online":          { color: "var(--green)",  bg: "var(--green-dim)",  pulse: true,  label: "ONLINE" },
  "offline":         { color: "var(--red)",    bg: "var(--red-dim)",    pulse: false, label: "OFFLINE" },
  "active":          { color: "var(--green)",  bg: "var(--green-dim)",  pulse: true,  label: "ACTIVE" },
};

function StatusBadge({ status, size = "md" }) {
  const s = STATUS_STYLES[status] || { color: "var(--fg-2)", bg: "rgba(255,255,255,0.06)", pulse: false, label: String(status).toUpperCase() };
  const heights = { sm: 18, md: 22, lg: 26 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: heights[size], padding: "0 8px",
      background: s.bg,
      border: `1px solid ${s.color}33`,
      borderRadius: 999,
      fontSize: size === "lg" ? 11.5 : 10.5,
      fontWeight: 600,
      letterSpacing: "0.08em",
      color: s.color,
      fontFamily: "var(--font-mono)",
      whiteSpace: "nowrap",
    }}>
      {s.pulse ? <span className="pulse-dot" style={{ color: s.color }} /> : (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color, opacity: 0.85 }} />
      )}
      {s.label}
    </span>
  );
}

// ============================================================
// SolAmount
// ============================================================
function SolAmount({ lamports, size = "md", color, showLamports = true, sign }) {
  const sol = U.lamportsToSol(lamports);
  const fontSize = size === "lg" ? 22 : size === "sm" ? 13 : 16;
  const decimals = size === "lg" ? 4 : 5;
  const c = color || "var(--fg-0)";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span className="mono" style={{ fontSize, color: c, fontWeight: 600, letterSpacing: "-0.01em" }}>
        {sign === "-" ? "-" : sign === "+" ? "+" : ""}{sol.toFixed(decimals)}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", letterSpacing: "0.04em" }}>SOL</span>
      {showLamports && size !== "lg" && (
        <span className="mono" style={{ fontSize: 10, color: "var(--fg-4)", marginLeft: 4 }}>
          {lamports.toLocaleString()} lamports
        </span>
      )}
    </span>
  );
}

// ============================================================
// AgentAvatar — deterministic geometric from pubkey
// ============================================================
function pubkeyToColors(pk) {
  let h = 0;
  for (let i = 0; i < pk.length; i++) h = (h * 31 + pk.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (h >> 8) % 360;
  return [
    `oklch(0.72 0.18 ${hue1})`,
    `oklch(0.55 0.20 ${hue2})`,
    `oklch(0.40 0.14 ${(hue1 + 60) % 360})`,
  ];
}

function AgentAvatar({ pubkey, size = 40 }) {
  const [a, b, c] = useMemo(() => pubkeyToColors(pubkey || "x"), [pubkey]);
  // build a 4x4 deterministic grid (mirrored)
  const cells = useMemo(() => {
    const grid = [];
    let h = 0;
    for (let i = 0; i < (pubkey || "x").length; i++) h = (h * 33 + pubkey.charCodeAt(i)) >>> 0;
    for (let r = 0; r < 4; r++) {
      const row = [];
      for (let col = 0; col < 2; col++) {
        h = (h * 1103515245 + 12345) >>> 0;
        row.push((h >> col) & 1);
      }
      // mirror
      grid.push([...row, row[1], row[0]]);
    }
    return grid;
  }, [pubkey]);

  const cell = size / 4;
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: `linear-gradient(135deg, ${a}, ${c})`,
      position: "relative", overflow: "hidden",
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 24px -8px ${b}`,
      flexShrink: 0,
    }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        {cells.map((row, r) => row.map((on, col) => on ? (
          <rect key={`${r}-${col}`} x={col*cell} y={r*cell} width={cell} height={cell} fill={b} opacity={0.85}/>
        ) : null))}
      </svg>
    </div>
  );
}

// ============================================================
// Stat card
// ============================================================
function StatCard({ label, value, sub, accent, icon, sparkline, trend }) {
  const c = accent || "var(--fg-0)";
  return (
    <div className="panel" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minHeight: 110, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="label" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {icon && <span style={{ color: "var(--fg-3)" }}>{icon}</span>}
          {label}
        </div>
        {trend && (
          <span className="mono" style={{ fontSize: 11, color: trend.startsWith("+") ? "var(--green)" : trend.startsWith("-") ? "var(--red)" : "var(--fg-2)" }}>
            {trend}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="mono" style={{ fontSize: 26, fontWeight: 600, color: c, letterSpacing: "-0.02em" }}>{value}</span>
        {sub && <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>{sub}</span>}
      </div>
      {sparkline && (
        <svg viewBox="0 0 120 24" preserveAspectRatio="none" style={{ width: "100%", height: 24, marginTop: -4 }}>
          <path className="spark" style={{ stroke: c, opacity: 0.7 }} d={sparkline}/>
        </svg>
      )}
    </div>
  );
}

// build a deterministic organic sparkline using seeded random-walk with mean reversion
function buildSpark(seed, points = 24) {
  const w = 120, h = 24, step = w / (points - 1);
  // seed the LCG from a stable hash of the seed float
  let rng = Math.abs(Math.sin(seed * 127.1 + 311.7) * 233280) | 0;
  let v = 0.42 + (rng % 100) / 600; // start near middle
  let s = "";
  for (let i = 0; i < points; i++) {
    rng = (rng * 9301 + 49297) % 233280;
    const delta = (rng / 233280 - 0.5) * 0.24;
    // gentle mean reversion so it doesn't rail at extremes
    v = Math.max(0.06, Math.min(0.94, v + delta + (0.5 - v) * 0.06));
    // y=2 at top (v=1), y=22 at bottom (v=0) — always within viewBox
    const y = 2 + (1 - v) * 20;
    s += (i === 0 ? "M" : "L") + (i * step).toFixed(1) + "," + y.toFixed(1) + " ";
  }
  return s;
}

// ============================================================
// Sentiment gauge
// ============================================================
function SentimentBar({ asset, data }) {
  const labelColor = data.label === "positive" ? "var(--green)" : data.label === "negative" ? "var(--red)" : "var(--yellow)";
  const score = data.score; // 0..1, 0.5 = neutral
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--border-1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "0.02em", minWidth: 38 }}>{asset}</span>
          <span style={{
            fontSize: 9.5, letterSpacing: "0.12em", fontWeight: 600,
            color: labelColor, padding: "2px 7px",
            background: `${labelColor}1a`, borderRadius: 4,
            fontFamily: "var(--font-mono)",
          }}>{data.label.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>{data.score.toFixed(3)}</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>conf {(data.confidence*100).toFixed(0)}%</span>
        </div>
      </div>
      {/* bipolar bar: -1 left, 0 center, +1 right; score 0..1 maps to -1..+1 */}
      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "visible" }}>
        <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 10, background: "var(--fg-4)" }} />
        {(() => {
          const pct = (score - 0.5) * 100; // -50..+50
          const left = pct >= 0 ? 50 : 50 + pct;
          const width = Math.abs(pct);
          return (
            <div style={{
              position: "absolute", top: 0, height: "100%",
              left: `${left}%`, width: `${width}%`,
              background: `linear-gradient(90deg, ${labelColor}80, ${labelColor})`,
              borderRadius: 3,
              boxShadow: `0 0 12px -2px ${labelColor}`,
            }} />
          );
        })()}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-4)" }}>BEARISH</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-4)" }}>n={data.samples}</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-4)" }}>BULLISH</span>
      </div>
    </div>
  );
}

// ============================================================
// Section header
// ============================================================
function SectionHead({ title, sub, right, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && <span style={{ color: "var(--fg-3)" }}>{icon}</span>}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{sub}</div>}
        </div>
      </div>
      <div>{right}</div>
    </div>
  );
}

// ============================================================
// Export
// ============================================================
Object.assign(window, {
  Icon, LiveIndicator, CopyButton, MonoAddr, StatusBadge, SolAmount,
  AgentAvatar, StatCard, SentimentBar, SectionHead, buildSpark,
});
