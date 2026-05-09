/* global React */
const useStateD = React.useState;
const useEffectD = React.useEffect;
const useRefD = React.useRef;
const useMemoD = React.useMemo;
const useCallbackD = React.useCallback;

const D = window.NEXUS_DATA;
const UD = window.NEXUS_UTIL;

// ============================================================
// Trigger Cycle button
// ============================================================
function TriggerButton({ running, progress, onTrigger }) {
  return (
    <button
      onClick={onTrigger}
      disabled={running}
      className="btn-primary"
      style={{
        position: "relative",
        height: 56,
        padding: "0 28px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.06em",
        cursor: running ? "wait" : "pointer",
        overflow: "hidden",
        minWidth: 320,
        background: running
          ? "linear-gradient(180deg, #2563eb, #1d4ed8)"
          : "linear-gradient(180deg, #3b82f6, #2563eb)",
        border: "1px solid rgba(96, 165, 250, 0.6)",
        color: "white",
        boxShadow: "0 0 0 1px rgba(96,165,250,0.18), 0 12px 40px -10px rgba(59,130,246,0.6), inset 0 1px 0 rgba(255,255,255,0.22)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12,
      }}
    >
      {/* progress fill */}
      {running && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.18) ${progress}%, transparent ${progress}%)`,
          transition: "background 240ms ease",
        }}/>
      )}
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12 }}>
        {running ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="2"/>
              <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>EXECUTING CYCLE · {progress}%</span>
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Icon.Play s={14} filled/>
            <span>TRIGGER ANALYSIS CYCLE</span>
            <span style={{ fontSize: 10, opacity: 0.75, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", borderLeft: "1px solid rgba(255,255,255,0.25)", paddingLeft: 10 }}>
              POST · /strategy/trigger
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

// ============================================================
// Trading signal panel
// ============================================================
function TradingSignal({ signal }) {
  const colorMap = {
    BUY:  { c: "var(--green)",  bg: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.04))" },
    SELL: { c: "var(--red)",    bg: "linear-gradient(135deg, rgba(239,68,68,0.20), rgba(239,68,68,0.04))" },
    HOLD: { c: "var(--yellow)", bg: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.04))" },
  };
  const m = colorMap[signal.decision] || colorMap.HOLD;
  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <SectionHead
        icon={<Icon.Activity s={14}/>}
        title="Trading Signal"
        sub="Quant strategy output · last cycle"
        right={<LiveIndicator label="LIVE" />}
      />
      <div style={{ padding: "22px 24px 18px", background: m.bg, borderBottom: "1px solid var(--border-1)" }}>
        <div className="label" style={{ marginBottom: 6 }}>Decision</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div className="mono" style={{
            fontSize: 88, lineHeight: 0.95, fontWeight: 700, color: m.c,
            letterSpacing: "-0.04em",
            textShadow: `0 0 60px ${m.c}33`,
          }}>
            {signal.decision}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 6 }}>
            <Pill label="Confidence" value={`${(signal.confidence*100).toFixed(0)}%`} />
            <Pill label="Risk" value={signal.risk.toUpperCase()} />
            <Pill label="Δ position" value={`${signal.positionDelta > 0 ? "+" : ""}${(signal.positionDelta*100).toFixed(0)}%`} valueColor={signal.positionDelta < 0 ? "var(--red)" : "var(--green)"}/>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="label">Rationale</div>
        <div style={{ fontSize: 12.5, color: "var(--fg-1)", lineHeight: 1.55, textWrap: "pretty" }}>
          {signal.rationale}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>generated {UD.timeAgo(signal.generatedAt)}</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>strategy: momentum-rsi-divergence</span>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, valueColor }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-1)", borderRadius: 6 }}>
      <span className="label" style={{ fontSize: 9.5 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: valueColor || "var(--fg-0)" }}>{value}</span>
    </div>
  );
}

// ============================================================
// Analyst Health panel
// ============================================================
function AnalystHealth({ health }) {
  const tempHot = health.npu.temp_c > 70;
  const memPct = (health.npu.mem_mb / health.npu.mem_total_mb) * 100;
  const utilPct = health.npu.util * 100;
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <SectionHead
        icon={<Icon.Chip s={14}/>}
        title="Analyst Agent · Health"
        sub={`uptime ${Math.floor(health.uptime_s/3600)}h ${Math.floor((health.uptime_s%3600)/60)}m`}
        right={<StatusBadge status={health.status}/>}
      />
      <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <KV k="Backend" v={
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--blue)",
            background: "var(--blue-dim)", padding: "2px 7px", borderRadius: 4,
            border: "1px solid var(--border-blue)",
          }}>{health.backend}</span>
        } />
        <KV k="Model" v={<span className="mono" style={{ fontSize: 11.5, color: "var(--fg-1)" }}>{health.model}</span>} />
        <KV k="p50 inference" v={<span className="mono" style={{ fontSize: 12, color: "var(--fg-0)" }}>{health.inference_p50_ms}ms</span>} />
        <KV k="p99 inference" v={<span className="mono" style={{ fontSize: 12, color: "var(--fg-0)" }}>{health.inference_p99_ms}ms</span>} />
      </div>
      <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Meter label="NPU temp" value={`${health.npu.temp_c.toFixed(1)}°C`} pct={(health.npu.temp_c / 90) * 100} color={tempHot ? "var(--red)" : "var(--green)"} />
        <Meter label="NPU util" value={`${utilPct.toFixed(0)}%`} pct={utilPct} color="var(--blue)"/>
        <Meter label="VRAM" value={`${(health.npu.mem_mb/1024).toFixed(1)} / ${(health.npu.mem_total_mb/1024).toFixed(0)} GB`} pct={memPct} color="var(--purple)"/>
      </div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="label">{k}</div>
      <div>{v}</div>
    </div>
  );
}

function Meter({ label, value, pct, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="label">{label}</span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-1)" }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.min(100, pct)}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          boxShadow: `0 0 8px -2px ${color}`,
        }}/>
      </div>
    </div>
  );
}

// ============================================================
// Job history table
// ============================================================
function JobHistoryTable({ jobs, onSelect }) {
  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <SectionHead
        icon={<Icon.Inbox s={14}/>}
        title="Job History"
        sub={`${jobs.length} escrow events`}
        right={
          <a href="#/escrow" style={{ fontSize: 11.5, color: "var(--fg-2)", display: "inline-flex", alignItems: "center", gap: 4 }}
             onMouseEnter={(e)=> e.currentTarget.style.color = "var(--blue)"}
             onMouseLeave={(e)=> e.currentTarget.style.color = "var(--fg-2)"}>
            view all <Icon.Ext s={11}/>
          </a>
        }
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.015)" }}>
              <Th>Job ID</Th>
              <Th>Status</Th>
              <Th>Asset</Th>
              <Th align="right">Amount</Th>
              <Th>Worker</Th>
              <Th>Time</Th>
              <Th align="right">Disburse Tx</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.jobId} className="row-hover" style={{ borderTop: "1px solid var(--border-1)", cursor: "pointer" }} onClick={() => onSelect && onSelect(j)}>
                <Td><MonoAddr value={j.jobId} kind="hash" head={8} tail={6} showCopy={false}/></Td>
                <Td><StatusBadge status={j.status} size="sm"/></Td>
                <Td><span className="mono" style={{ color: "var(--fg-1)", fontWeight: 600, fontSize: 11.5 }}>{j.asset}</span></Td>
                <Td align="right"><SolAmount lamports={j.amountLamports} size="sm" showLamports={false}/></Td>
                <Td><MonoAddr value={j.worker} link={UD.explorerAddr(j.worker)} showCopy={false}/></Td>
                <Td><span className="mono" style={{ color: "var(--fg-3)", fontSize: 11 }}>{UD.timeAgo(j.createdAt)}</span></Td>
                <Td align="right">
                  {j.disburseSig ? (
                    <a href={UD.explorerTx(j.disburseSig)} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}
                       style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                      {UD.truncatePubkey(j.disburseSig, 5, 4)}
                      <Icon.Ext s={10}/>
                    </a>
                  ) : <span className="mono dim" style={{ fontSize: 11 }}>—</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th style={{
      textAlign: align, padding: "10px 16px",
      fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
      fontWeight: 500, color: "var(--fg-3)",
      borderBottom: "1px solid var(--border-1)",
      whiteSpace: "nowrap",
    }}>{children}</th>
  );
}
function Td({ children, align = "left" }) {
  return (
    <td style={{ padding: "12px 16px", textAlign: align, color: "var(--fg-1)", whiteSpace: "nowrap" }}>{children}</td>
  );
}

// ============================================================
// Sentiment panel
// ============================================================
function SentimentPanel({ sentiment }) {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <SectionHead
        icon={<Icon.Spark s={14}/>}
        title="Asset Sentiment"
        sub="Latest cross-asset analysis"
        right={<span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>n=3,830</span>}
      />
      <div style={{ padding: "4px 18px 14px" }}>
        {Object.entries(sentiment).map(([asset, data]) => (
          <SentimentBar key={asset} asset={asset} data={data} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Dashboard page
// ============================================================
function DashboardPage({ jobs, sentiment, signal, health, running, progress, activePhase, completedThrough, currentArtifacts, onTrigger }) {

  const totalJobs = jobs.length;
  const totalDisbursedLamports = jobs.filter(j => j.status === "Disbursed").reduce((a, j) => a + j.amountLamports, 0);
  const activeEscrows = jobs.filter(j => j.status === "Initialized" || j.status === "Proof Submitted" || j.status === "Escrow Locked").length + (running ? 1 : 0);
  const inferenceTimes = jobs.filter(j => j.inferenceMs).map(j => j.inferenceMs);
  const avgInf = inferenceTimes.length ? Math.round(inferenceTimes.reduce((a,b)=>a+b,0) / inferenceTimes.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Hero stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <StatCard
          label="Total Jobs"
          value={totalJobs}
          sub="all-time"
          accent="var(--fg-0)"
          icon={<Icon.Inbox s={12}/>}
          sparkline={buildSpark(2.1)}
          trend="+12%"
        />
        <StatCard
          label="SOL Disbursed"
          value={UD.lamportsToSol(totalDisbursedLamports).toFixed(4)}
          sub="SOL"
          accent="var(--green)"
          icon={<Icon.Coin s={12}/>}
          sparkline={buildSpark(7.4)}
          trend="+0.075"
        />
        <StatCard
          label="Active Escrows"
          value={activeEscrows}
          sub="locked"
          accent="var(--blue)"
          icon={<Icon.Lock s={12}/>}
          sparkline={buildSpark(11.2)}
        />
        <StatCard
          label="Avg Inference"
          value={`${avgInf}ms`}
          sub="p50"
          accent="var(--yellow)"
          icon={<Icon.Stopwatch s={12}/>}
          sparkline={buildSpark(3.8)}
          trend="-8ms"
        />
      </div>

      {/* Trigger + flow */}
      <div className="glow-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="label" style={{ color: "var(--fg-2)" }}>Hire-loop control</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>
              Manual cycle dispatch
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-2)", maxWidth: 540 }}>
              Quant agent issues a paid request to the Analyst worker. Each cycle locks{" "}
              <span className="mono" style={{ color: "var(--fg-1)" }}>0.025 SOL</span> in escrow until proof of
              inference is submitted on-chain.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <TriggerButton running={running} progress={progress} onTrigger={onTrigger}/>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>POST · localhost:3001</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                <Icon.Refresh s={10}/> polling 2s
              </span>
            </div>
          </div>
        </div>
        <X402FlowDiagram
          activePhase={activePhase}
          completedThrough={completedThrough}
          escrowSig={currentArtifacts?.escrowSig}
          proofHash={currentArtifacts?.proofHash}
          disburseSig={currentArtifacts?.disburseSig}
          asset={currentArtifacts?.asset || "SOL"}
        />
      </div>

      {/* Two-col: signal + analyst */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, alignItems: "stretch" }}
           className="dash-two-col">
        <TradingSignal signal={signal}/>
        <AnalystHealth health={health}/>
      </div>

      {/* Sentiment */}
      <SentimentPanel sentiment={sentiment}/>

      {/* Job history */}
      <JobHistoryTable jobs={jobs}/>

      <style>{`
        @media (max-width: 920px) {
          .dash-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

window.DashboardPage = DashboardPage;
