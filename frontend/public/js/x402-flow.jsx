/* global React */
const { useState: useStateF, useEffect: useEffectF, useRef: useRefF, useMemo: useMemoF } = React;
const UF = window.NEXUS_UTIL;

// ============================================================
// X402 FlowDiagram — the hero animated component
// ============================================================
const PHASES = [
  { id: "request",   label: "REQUEST",        sub: "GET /infer/sentiment",                 icon: <Icon.Send s={14}/> },
  { id: "invoice",   label: "402 INVOICE",    sub: "Payment required",                     icon: <Icon.Receipt s={14}/> },
  { id: "escrow",    label: "ESCROW LOCK",    sub: "PDA · 0.025 SOL",                      icon: <Icon.Lock s={14}/> },
  { id: "inference", label: "INFERENCE",      sub: "Hailo-8 NPU",                          icon: <Icon.Chip s={14}/> },
  { id: "proof",     label: "PROOF",          sub: "SHA256 attestation",                   icon: <Icon.Hash s={14}/> },
  { id: "disburse",  label: "DISBURSE",       sub: "Worker payout",                        icon: <Icon.Coin s={14}/> },
];

function X402FlowDiagram({ activePhase = -1, completedThrough = -1, escrowSig, proofHash, disburseSig, asset = "SOL" }) {
  // activePhase: index currently animating, -1 means idle
  // completedThrough: highest index completed (green)
  return (
    <div className="panel" style={{ padding: "20px 22px", background: "linear-gradient(180deg, rgba(15,15,26,0.78), rgba(10,10,18,0.72))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="label" style={{ color: "var(--fg-1)" }}>A2A · x402 Protocol Flow</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>asset={asset}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--fg-4)" }}/> idle
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
            <span className="pulse-dot" style={{ color: "var(--blue)" }}/> active
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--green)" }}/> done
          </span>
        </div>
      </div>

      {/* The flow row */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0 }}>
        {PHASES.map((ph, i) => {
          const isDone = i <= completedThrough;
          const isActive = i === activePhase;
          const isPending = !isDone && !isActive;
          const color = isDone ? "var(--green)" : isActive ? "var(--blue)" : "var(--fg-4)";
          const bg = isDone ? "var(--green-dim)" : isActive ? "var(--blue-dim)" : "rgba(255,255,255,0.025)";
          // Resolve the artifact shown under each phase
          let artifact = null;
          if (ph.id === "escrow" && (isDone || (isActive && escrowSig))) {
            artifact = escrowSig ? <ArtifactLink kind="tx" value={escrowSig}/> : null;
          } else if (ph.id === "proof" && (isDone || (isActive && proofHash))) {
            artifact = proofHash ? <ArtifactLink kind="hash" value={proofHash}/> : null;
          } else if (ph.id === "disburse" && (isDone || (isActive && disburseSig))) {
            artifact = disburseSig ? <ArtifactLink kind="tx" value={disburseSig}/> : null;
          }

          return (
            <div key={ph.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", paddingTop: 6 }}>
              {/* connector LEFT (skip on first) */}
              {i > 0 && (
                <FlowConnector
                  done={i - 1 < completedThrough || i - 1 === completedThrough && i <= activePhase}
                  active={i === activePhase}
                  side="left"
                />
              )}
              {/* node */}
              <div style={{
                position: "relative",
                width: 44, height: 44, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: bg,
                border: `1px solid ${isPending ? "var(--border-1)" : color}66`,
                color: isPending ? "var(--fg-3)" : color,
                boxShadow: isActive ? `0 0 0 3px ${color}1a, 0 0 24px -4px ${color}` : isDone ? `0 0 0 1px ${color}33` : "none",
                transition: "all 240ms ease",
                zIndex: 2,
              }}>
                {ph.icon}
                {isActive && (
                  <span style={{
                    position: "absolute", top: -3, right: -3,
                    width: 10, height: 10, borderRadius: 999,
                    background: color, color,
                  }} className="pulse-dot"/>
                )}
                {isDone && !isActive && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    width: 14, height: 14, borderRadius: 999,
                    background: "var(--green)", color: "#0a0a12",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 2px var(--bg-1)",
                  }}>
                    <Icon.Check s={9}/>
                  </span>
                )}
              </div>
              {/* labels */}
              <div style={{ marginTop: 12, textAlign: "center", padding: "0 6px" }}>
                <div className="mono" style={{
                  fontSize: 10, letterSpacing: "0.10em", fontWeight: 600,
                  color: isPending ? "var(--fg-3)" : color,
                  marginBottom: 3,
                }}>
                  {String(i+1).padStart(2,"0")} · {ph.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.3, fontFamily: "var(--font-mono)" }}>
                  {ph.sub}
                </div>
                <div style={{ marginTop: 8, minHeight: 18 }}>{artifact}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowConnector({ done, active, side }) {
  // horizontal line that sits between two nodes; positioned absolutely from the node center
  const color = done ? "var(--green)" : active ? "var(--blue)" : "var(--fg-4)";
  return (
    <div style={{
      position: "absolute",
      top: 28, // node center
      left: side === "left" ? "calc(-50% + 22px)" : "auto",
      right: side === "right" ? "calc(-50% + 22px)" : "auto",
      width: "calc(100% - 44px)",
      height: 2,
      zIndex: 1,
    }}>
      <svg width="100%" height="2" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <line x1="0" y1="1" x2="100%" y2="1"
          stroke={color}
          strokeWidth={active ? 1.5 : 1}
          strokeDasharray={active ? "4 4" : done ? "none" : "3 3"}
          opacity={done ? 0.7 : active ? 1 : 0.3}
          className={active ? "flow-line-active" : ""}
        />
      </svg>
    </div>
  );
}

function ArtifactLink({ kind, value }) {
  const link = kind === "tx" ? UF.explorerTx(value) : null;
  const display = UF.truncatePubkey(value, 5, 4);
  return (
    <a href={link || "#"} target={link ? "_blank" : undefined} rel="noreferrer"
      onClick={(e)=>{ if (!link) e.preventDefault(); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 6px",
        background: "rgba(96, 165, 250, 0.08)",
        border: "1px solid var(--border-blue)",
        borderRadius: 4,
        fontSize: 10, fontFamily: "var(--font-mono)",
        color: "var(--blue)",
      }}>
      {display}
      {link && <Icon.Ext s={9}/>}
    </a>
  );
}

window.X402FlowDiagram = X402FlowDiagram;
