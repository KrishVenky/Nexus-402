/* global React */
const DA = window.NEXUS_DATA;
const UA = window.NEXUS_UTIL;

// ============================================================
// Agent card — NFT-style with glowing border
// ============================================================
function AgentCard({ pubkey, role, title, subtitle, stats, badges, accent }) {
  return (
    <div style={{
      position: "relative",
      borderRadius: 14,
      padding: 1,
      background: `linear-gradient(135deg, ${accent}aa, ${accent}11 35%, ${accent}55 85%)`,
      boxShadow: `0 0 60px -20px ${accent}, 0 0 0 1px ${accent}33`,
    }}>
      <div style={{
        background: "linear-gradient(180deg, rgba(15,15,26,0.96), rgba(8,8,14,0.96))",
        borderRadius: 13,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* watermark grid */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 80% 0%, ${accent}22, transparent 50%)`,
          pointerEvents: "none",
        }}/>

        <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid var(--border-1)", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{
              fontSize: 10, letterSpacing: "0.16em", fontWeight: 700, color: accent,
              fontFamily: "var(--font-mono)",
              padding: "3px 9px", background: `${accent}1a`, borderRadius: 4,
              border: `1px solid ${accent}55`,
            }}>{role}</span>
            <LiveIndicator label="ACTIVE"/>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <AgentAvatar pubkey={pubkey} size={56}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginBottom: 6 }}>{subtitle}</div>
              <MonoAddr value={pubkey} link={UA.explorerAddr(pubkey)}/>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 22px 16px", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
          {/* big stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-1)", borderRadius: 8 }}>
                <span className="label" style={{ fontSize: 9.5 }}>{s.label}</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: s.color || "var(--fg-0)", letterSpacing: "-0.02em" }}>{s.value}</span>
                {s.sub && <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{s.sub}</span>}
              </div>
            ))}
          </div>

          {/* meta badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {badges.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: i ? "1px solid var(--border-1)" : "none" }}>
                <span className="label">{b.label}</span>
                {b.value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Reputation stars (5)
// ============================================================
function Reputation({ score }) {
  // score 0..1 -> stars 0..5
  const filled = score * 5;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "inline-flex", gap: 2 }}>
        {[0,1,2,3,4].map(i => {
          const fill = Math.max(0, Math.min(1, filled - i)); // 0..1
          return (
            <svg key={i} width="13" height="13" viewBox="0 0 24 24">
              <defs>
                <linearGradient id={`s${i}-${score}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset={`${fill * 100}%`} stopColor="var(--yellow)" />
                  <stop offset={`${fill * 100}%`} stopColor="rgba(255,255,255,0.08)" />
                </linearGradient>
              </defs>
              <path
                d="M12 2.5 14.5 9l6.7.5-5.1 4.4 1.6 6.6L12 17l-5.7 3.5L7.9 13.9 2.8 9.5 9.5 9Z"
                fill={`url(#s${i}-${score})`}
                stroke="var(--yellow)"
                strokeWidth="0.6"
                strokeOpacity="0.4"
              />
            </svg>
          );
        })}
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{(score*5).toFixed(2)}</span>
    </div>
  );
}

// ============================================================
// How It Works step
// ============================================================
const HOW_STEPS = [
  { n: "01", title: "Discovery",   body: "Buyer agent locates a worker via on-chain registry and pulls its capability manifest.", icon: <Icon.Search s={16}/> },
  { n: "02", title: "Request",     body: "HTTP request sent to worker endpoint with a JWT identity proof.",                       icon: <Icon.Send s={16}/> },
  { n: "03", title: "402 Invoice", body: "Worker responds with HTTP 402 + payment requirements (lamports, recipient, nonce).",     icon: <Icon.Receipt s={16}/> },
  { n: "04", title: "Escrow Lock", body: "Buyer initializes a Solana escrow PDA, locking funds until a valid proof is posted.",    icon: <Icon.Lock s={16}/> },
  { n: "05", title: "Inference",   body: "Worker runs the job on its inference backend and signs a SHA-256 attestation.",          icon: <Icon.Chip s={16}/> },
  { n: "06", title: "Disburse",    body: "Proof submitted on-chain triggers atomic disbursement to the worker's wallet.",          icon: <Icon.Coin s={16}/> },
];

function HowItWorks() {
  return (
    <div className="panel" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Protocol</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>How it works · x402 over Solana</div>
        </div>
        <a href="#/" className="btn">View flow live <Icon.Ext s={11}/></a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {HOW_STEPS.map((s, i) => (
          <div key={s.n} style={{
            position: "relative",
            padding: 16,
            background: "rgba(255,255,255,0.015)",
            border: "1px solid var(--border-1)",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--blue-dim)",
                border: "1px solid var(--border-blue)",
                color: "var(--blue)",
              }}>{s.icon}</div>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.1em" }}>{s.n}</span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5, textWrap: "pretty" }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// AgentsPage
// ============================================================
function AgentsPage() {
  const q = DA.QUANT_STATS;
  const a = DA.ANALYST_STATS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Title block */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Registry</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>
            Agent Marketplace
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", maxWidth: 580, marginTop: 4, textWrap: "pretty" }}>
            Two autonomous services participating in the Nexus-402 hire-loop. Both agents publish their
            capability manifest and accept paid jobs over the x402 protocol.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon.Refresh s={12}/> Refresh registry</button>
          <button className="btn">Manifest <Icon.Ext s={11}/></button>
        </div>
      </div>

      {/* Two cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="agents-grid">
        <AgentCard
          pubkey={DA.QUANT_PUBKEY}
          role="BUYER"
          title="Quant Agent"
          subtitle="Trading strategy orchestrator"
          accent="#a78bfa"
          stats={[
            { label: "Jobs initiated", value: q.jobsInitiated },
            { label: "SOL spent", value: UA.lamportsToSol(q.totalSpentLamports).toFixed(3), color: "var(--red)", sub: "lifetime out" },
          ]}
          badges={[
            { label: "Strategy model", value: <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-1)" }}>{q.model}</span> },
            { label: "Strategy", value: <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-1)" }}>{q.strategy}</span> },
            { label: "Status", value: <StatusBadge status={q.status} size="sm"/> },
            { label: "Reputation", value: <Reputation score={q.reputation}/> },
          ]}
        />
        <AgentCard
          pubkey={DA.ANALYST_PUBKEY}
          role="WORKER"
          title="Analyst Agent"
          subtitle="On-device sentiment inference"
          accent="#60a5fa"
          stats={[
            { label: "Jobs completed", value: a.jobsCompleted },
            { label: "SOL earned", value: UA.lamportsToSol(a.totalEarnedLamports).toFixed(3), color: "var(--green)", sub: "lifetime in" },
          ]}
          badges={[
            { label: "Inference backend", value:
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--blue)",
                background: "var(--blue-dim)", padding: "2px 7px", borderRadius: 4,
                border: "1px solid var(--border-blue)",
              }}>{a.backend}</span>
            },
            { label: "Proofs accepted", value: <span className="mono" style={{ fontSize: 11.5, color: "var(--green)" }}>{a.proofsValidated} / {a.proofsValidated + a.proofsRejected}</span> },
            { label: "Uptime (30d)", value: <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-1)" }}>{(a.uptime*100).toFixed(2)}%</span> },
            { label: "Reputation", value: <Reputation score={a.reputation}/> },
          ]}
        />
      </div>

      {/* How it works */}
      <HowItWorks />

      <style>{`
        @media (max-width: 880px) {
          .agents-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

window.AgentsPage = AgentsPage;
