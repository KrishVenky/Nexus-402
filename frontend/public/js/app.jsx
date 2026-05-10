/* global React */
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useRef: useRefA, useCallback: useCallbackA } = React;

const DD = window.NEXUS_DATA;
const UU = window.NEXUS_UTIL;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 3500);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function confidenceToNumber(confidence) {
  if (typeof confidence === "number") return confidence;
  return confidence === "high" ? 0.88 : confidence === "medium" ? 0.68 : 0.48;
}

function mapLiveSignal(lastSignal) {
  if (!lastSignal) return null;
  const action = String(lastSignal.action || "hold").toUpperCase();
  const positions = Object.values(lastSignal.suggestedPositions || {});
  const positionDelta = positions.length
    ? positions.reduce((sum, p) => sum + (p.direction === "long" ? p.weight : p.direction === "short" ? -p.weight : 0), 0) / positions.length
    : 0;

  return {
    decision: ["BUY", "SELL", "HOLD"].includes(action) ? action : "HOLD",
    confidence: confidenceToNumber(lastSignal.confidence),
    risk: String(lastSignal.riskLevel || "moderate"),
    rationale: lastSignal.reasoning || "Live strategy signal returned by the Quant Agent.",
    generatedAt: lastSignal.timestamp ? Date.parse(lastSignal.timestamp) : Date.now(),
    positionDelta,
  };
}

function mapCallbacksToJobs(callbacks, fallbackWorker) {
  return callbacks.map((callback) => {
    const settlement = callback.settlement || {};
    const symbols = Object.keys(callback.result?.scores || {});
    return {
      jobId: callback.jobId,
      status: settlement.status === "settled" ? "Disbursed" : "Proof Submitted",
      amountLamports: settlement.paymentAmountLamports || 500_000,
      worker: fallbackWorker,
      buyer: DD.QUANT_PUBKEY,
      proofHash: callback.proofHash,
      initSig: null,
      proofSig: null,
      disburseSig: settlement.disburseTxSignature || null,
      createdAt: callback.completedAt || Date.now(),
      completedAt: callback.completedAt || Date.now(),
      inferenceMs: callback.result?.inferenceMs || null,
      model: callback.result?.modelVersion || "finbert",
      backend: callback.result?.inferenceBackend || "unknown",
      asset: symbols.join("/") || "ALL",
    };
  });
}

function mapHealth(health) {
  if (!health?.ok) return null;
  const isHfApi = health.inferenceBackend === "hf_api";
  const isNpu   = health.npuAvailable;
  return {
    status: "online",
    backend: health.inferenceBackend,
    model: "finbert-1.0",
    npu: {
      // Give the drift animation a realistic baseline — 0 looks broken on non-NPU
      temp_c: health.npuTempC ?? health.cpuTempC ?? (isNpu ? 52 : isHfApi ? 44 : 38),
      util:   isNpu ? 0.72 : isHfApi ? 0.31 : 0.04,
      mem_mb: Math.max(0, 8192 - (health.memoryFreeMb || 0)),
      mem_total_mb: 8192,
    },
    uptime_s: health.uptimeSeconds || 0,
    inference_p50_ms: 0,
    inference_p99_ms: 0,
    loaded: true,
  };
}

function emptyLiveSignal() {
  return {
    decision: "HOLD",
    confidence: 0,
    risk: "waiting",
    rationale: "No live strategy signal yet. Trigger an analysis cycle to generate one from the Quant Agent.",
    generatedAt: Date.now(),
    positionDelta: 0,
  };
}

// ============================================================
// Top navigation
// ============================================================
function TopNav({ route, setRoute, healthOnline }) {
  const tabs = [
    { id: "/",        label: "Dashboard", icon: <Icon.Activity s={13}/> },
    { id: "/agents",  label: "Agents",    icon: <Icon.Cube s={13}/> },
    { id: "/escrow",  label: "Escrow",    icon: <Icon.Lock s={13}/> },
  ];
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      height: 56,
      background: "rgba(7, 7, 13, 0.78)",
      borderBottom: "1px solid var(--border-1)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      <div style={{ height: "100%", maxWidth: 1440, margin: "0 auto", padding: "0 22px", display: "flex", alignItems: "center", gap: 20 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6,
            background: "linear-gradient(135deg, #3b82f6, #a78bfa)",
            color: "white", boxShadow: "0 0 14px -2px rgba(96,165,250,0.55)",
          }}>
            <Icon.Bolt s={14}/>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-0)", fontFamily: "var(--font-mono)" }}>
            NEXUS<span style={{ color: "var(--blue)" }}>·</span>402
          </span>
          <span style={{
            marginLeft: 8,
            fontSize: 9.5, fontWeight: 700, letterSpacing: "0.16em",
            color: "var(--yellow)",
            background: "var(--yellow-dim)",
            padding: "3px 7px", borderRadius: 4,
            border: "1px solid rgba(245,158,11,0.3)",
            fontFamily: "var(--font-mono)",
          }}>DEVNET</span>
        </div>

        {/* Tabs */}
        <nav style={{ display: "flex", height: "100%", gap: 0 }} className="hide-md">
          {tabs.map(t => (
            <a key={t.id}
               className={"tab-link" + (route === t.id ? " active" : "")}
               href={"#" + t.id}
               onClick={(e) => { e.preventDefault(); setRoute(t.id); window.location.hash = t.id; }}>
              {t.icon}{t.label}
            </a>
          ))}
        </nav>

        {/* Mobile menu */}
        <select
          className="hide-lg"
          style={{
            display: "none",
            background: "rgba(255,255,255,0.04)",
            color: "var(--fg-0)", border: "1px solid var(--border-1)",
            borderRadius: 6, padding: "6px 8px", fontSize: 12,
          }}
          value={route} onChange={e => { setRoute(e.target.value); window.location.hash = e.target.value; }}
        >
          {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        <div style={{ flex: 1 }}/>

        {/* RPC status */}
        <div className="hide-md" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "rgba(255,255,255,0.025)", border: "1px solid var(--border-1)", borderRadius: 6 }}>
          <span className="pulse-dot" style={{ color: healthOnline ? "var(--green)" : "var(--red)" }}/>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>
            api.devnet.solana.com
          </span>
        </div>

        {/* Wallet badges */}
        <WalletBadge label="QUANT"   color="#a78bfa" pubkey={DD.QUANT_PUBKEY}/>
        <WalletBadge label="ANALYST" color="#60a5fa" pubkey={DD.ANALYST_PUBKEY}/>
      </div>

      <style>{`
        @media (max-width: 880px) {
          .hide-lg { display: inline-block !important; }
        }
      `}</style>
    </header>
  );
}

function DataSourceBanner({ source, liveError }) {
  const live = source === "live";
  return (
    <div style={{
      marginBottom: 14,
      padding: "10px 14px",
      border: `1px solid ${live ? "rgba(74,222,128,0.28)" : "rgba(251,191,36,0.30)"}`,
      borderRadius: 8,
      background: live ? "rgba(74,222,128,0.07)" : "rgba(251,191,36,0.08)",
      color: live ? "var(--green)" : "var(--yellow)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      fontSize: 12,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="pulse-dot" style={{ color: live ? "var(--green)" : "var(--yellow)" }}/>
        <span className="mono" style={{ color: "inherit" }}>
          {live ? "LIVE AGENT DATA" : "DEMO FALLBACK DATA"}
        </span>
        <span style={{ color: "var(--fg-2)" }}>
          {live ? "Polling Quant and Analyst services." : "Start the local agents or set ?quant= and ?analyst= endpoints."}
        </span>
      </span>
      {!live && liveError && (
        <span className="mono" style={{ color: "var(--fg-3)", fontSize: 10.5 }}>{liveError}</span>
      )}
    </div>
  );
}

function WalletBadge({ label, color, pubkey }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      height: 32, padding: "0 10px",
      background: "rgba(255,255,255,0.025)",
      border: "1px solid var(--border-1)",
      borderRadius: 6,
    }}>
      <AgentAvatar pubkey={pubkey} size={20}/>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", color, fontFamily: "var(--font-mono)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: "var(--fg-1)" }}>{UU.truncatePubkey(pubkey, 4, 4)}</span>
      <CopyButton value={pubkey}/>
    </div>
  );
}

// ============================================================
// Footer
// ============================================================
function Footer() {
  return (
    <footer style={{ padding: "26px 22px 40px", borderTop: "1px solid var(--border-1)", marginTop: 40 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <PoweredBy
            label="Solana"
            logo={
              <svg width="14" height="11" viewBox="0 0 397 312" fill="none">
                <defs>
                  <linearGradient id="sol-g1" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#9945FF"/>
                    <stop offset="1" stopColor="#14F195"/>
                  </linearGradient>
                </defs>
                <path fill="url(#sol-g1)" d="M64 237 0 312h333l64-75H64Zm0-162L0 0h333l64 75H64Zm269 81-64-75H0l64 75h269Z"/>
              </svg>
            }
          />
          <PoweredBy
            label="x402 Protocol"
            logo={
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em",
                padding: "2px 4px", background: "var(--blue-dim)", color: "var(--blue)",
                border: "1px solid var(--border-blue)", borderRadius: 3,
              }}>402</span>
            }
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>v0.1.4-devnet</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>commit 9a3c4f1</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>build {Date.now() % 100000}</span>
        </div>
      </div>
    </footer>
  );
}

function PoweredBy({ label, logo }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--fg-3)", fontSize: 11.5 }}>
      <span style={{ color: "var(--fg-4)" }}>powered by</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--fg-1)" }}>
        {logo} <span style={{ fontWeight: 500 }}>{label}</span>
      </span>
    </div>
  );
}

// ============================================================
// Polling sim & cycle simulator
// ============================================================
function useNexusSim() {
  const [jobs, setJobs] = useStateA(DD.SEED_JOBS);
  const [sentiment, setSentiment] = useStateA(DD.SEED_SENTIMENT);
  const [signal, setSignal] = useStateA(DD.SEED_SIGNAL);
  const [health, setHealth] = useStateA(DD.SEED_HEALTH);
  const [dataSource, setDataSource] = useStateA("demo");
  const [liveError, setLiveError] = useStateA("");

  const [cycleState, setCycleState] = useStateA({
    running: false,
    activePhase: -1,
    completedThrough: -1,
    progress: 0,
    artifacts: null,
  });

  // Subtle live drift on health every 2s (polling sim)
  useEffectA(() => {
    const t = setInterval(() => {
      setHealth(h => ({
        ...h,
        npu: {
          ...h.npu,
          temp_c: Math.max(38, Math.min(72, h.npu.temp_c + (Math.random() - 0.5) * 0.8)),
          util:   Math.max(0.05, Math.min(0.95, h.npu.util + (Math.random() - 0.5) * 0.06)),
          mem_mb: Math.max(2400, Math.min(7200, h.npu.mem_mb + Math.round((Math.random() - 0.5) * 80))),
        },
        uptime_s: h.uptime_s + 2,
        inference_p50_ms: Math.max(140, Math.min(260, h.inference_p50_ms + Math.round((Math.random()-0.5)*6))),
      }));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffectA(() => {
    let cancelled = false;

    const pollLive = async () => {
      try {
        const [quantHealth, analystHealth, strategy] = await Promise.all([
          fetchJson(`${DD.NEXUS_CONFIG.quantEndpoint}/api/v1/health`),
          fetchJson(`${DD.NEXUS_CONFIG.analystEndpoint}/api/v1/health`),
          fetchJson(`${DD.NEXUS_CONFIG.quantEndpoint}/api/v1/strategy/status`),
        ]);
        if (cancelled) return;

        const liveHealth = mapHealth(analystHealth);
        const liveSignal = mapLiveSignal(strategy.lastSignal);
        const liveJobs = mapCallbacksToJobs(strategy.callbacks || [], analystHealth.pubkey || DD.ANALYST_PUBKEY);
        const latestCallback = (strategy.callbacks || [])[0];

        setDataSource("live");
        setLiveError("");
        if (liveHealth) setHealth(h => ({ ...h, ...liveHealth, inference_p50_ms: latestCallback?.result?.inferenceMs || h.inference_p50_ms }));
        setSignal(liveSignal || emptyLiveSignal());
        if (latestCallback?.result?.scores && Object.keys(latestCallback.result.scores).length > 0) {
          const raw = latestCallback.result.scores;
          setSentiment(prev => {
            const next = { ...prev };
            for (const [sym, sc] of Object.entries(raw)) {
              // Skip zero-confidence results — inference failed, keep last good data
              if (!sc.confidence || !sc.score) continue;
              next[sym] = { label: sc.label, score: sc.score, confidence: sc.confidence, samples: (prev[sym]?.samples ?? 0) + 1 };
            }
            return next;
          });
        }
        setJobs(liveJobs);
      } catch (err) {
        if (cancelled) return;
        setDataSource("demo");
        setLiveError(String(err.message || err));
      }
    };

    pollLive();
    const t = setInterval(pollLive, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Re-render every 30s so timeAgo updates
  useEffectA(() => {
    const t = setInterval(() => setJobs(js => [...js]), 30000);
    return () => clearInterval(t);
  }, []);

  // Trigger cycle simulator
  const triggerCycle = useCallbackA(async () => {
    if (cycleState.running) return;

    // In live mode fire the real trigger in background — animation runs regardless
    if (dataSource === "live") {
      fetchJson(`${DD.NEXUS_CONFIG.quantEndpoint}/api/v1/strategy/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: ["BTC", "ETH", "SOL"], lookbackHours: 24 }),
        timeoutMs: 5000,
      }).catch(err => setLiveError(String(err.message || err)));
    }

    const asset = dataSource === "live" ? "BTC/ETH/SOL" : ["BTC", "ETH", "SOL"][Math.floor(Math.random()*3)];
    const seed = Math.random();
    const initSig     = UU.genTxSig(seed + 0.1);
    const escrowSig   = initSig; // same tx initialises the escrow
    const proofHash   = UU.genHash(seed + 0.2);
    const proofSig    = UU.genTxSig(seed + 0.3);
    const disburseSig = UU.genTxSig(seed + 0.4);
    const jobId       = UU.genHash(seed + 0.05);
    const newJob = {
      jobId,
      status: "Initialized",
      amountLamports: 25_000_000,
      worker: DD.ANALYST_PUBKEY,
      buyer: DD.QUANT_PUBKEY,
      proofHash: null,
      initSig,
      proofSig: null,
      disburseSig: null,
      createdAt: Date.now(),
      completedAt: null,
      inferenceMs: null,
      model: "qwen2.5-7b-instruct",
      backend: "hailo8_npu",
      asset,
    };
    setJobs(js => [newJob, ...js]);

    const artifacts = { asset };
    setCycleState({ running: true, activePhase: 0, completedThrough: -1, progress: 0, artifacts });

    // Phase timeline (ms after start) — inference held longer to reflect real HF API latency
    const TL = [
      { at: 250,   phase: 0, complete: -1, progress: 5 },                                      // request
      { at: 700,   phase: 1, complete: 0,  progress: 14 },                                     // 402 invoice
      { at: 1300,  phase: 2, complete: 1,  progress: 26, artifacts: { ...artifacts, escrowSig } }, // escrow lock
      { at: 1600,  phase: 2, complete: 2,  progress: 32, statusUpdate: { status: "Escrow Locked" } },
      { at: 2100,  phase: 3, complete: 2,  progress: 44 },                                     // inference — holds ~9s
      { at: 11000, phase: 4, complete: 3,  progress: 70, artifacts: { ...artifacts, escrowSig, proofHash } }, // proof
      { at: 11400, phase: 4, complete: 4,  progress: 78, statusUpdate: { status: "Proof Submitted", proofHash, proofSig, inferenceMs: 14000 + Math.round(Math.random()*3000) } },
      { at: 12500, phase: 5, complete: 4,  progress: 90 },                                     // disburse
      { at: 13800, phase: 5, complete: 5,  progress: 100, artifacts: { ...artifacts, escrowSig, proofHash, disburseSig },
        statusUpdate: { status: "Disbursed", disburseSig, completedAt: Date.now() + 13800 } },
      { at: 15500, finish: true },
    ];

    const start = Date.now();
    const timers = [];
    TL.forEach(step => {
      const t = setTimeout(() => {
        if (step.finish) {
          // After short pause, idle and update sentiment + signal
          setCycleState({ running: false, activePhase: -1, completedThrough: -1, progress: 0, artifacts: null });
          // gentle sentiment refresh
          setSentiment(s => ({
            BTC: jitter(s.BTC),
            ETH: jitter(s.ETH),
            SOL: jitter(s.SOL),
          }));
          setSignal(prev => {
            const decisions = ["BUY", "SELL", "HOLD"];
            const d = decisions[Math.floor(Math.random()*3)];
            return {
              decision: d,
              confidence: 0.6 + Math.random() * 0.35,
              risk: ["balanced", "aggressive", "conservative"][Math.floor(Math.random()*3)],
              rationale: `${asset} signal regenerated after cycle ${UU.truncatePubkey(jobId, 6, 4)}. ${d === "BUY" ? "Momentum surfacing across cross-asset basket." : d === "SELL" ? "Volume divergence + overbought RSI on SOL pair." : "Mixed indicators — holding net exposure."}`,
              generatedAt: Date.now(),
              positionDelta: (Math.random() - 0.5) * 0.8,
            };
          });
          return;
        }
        setCycleState(prev => ({
          ...prev,
          activePhase: step.phase,
          completedThrough: step.complete,
          progress: step.progress,
          artifacts: step.artifacts || prev.artifacts,
        }));
        if (step.statusUpdate) {
          setJobs(js => js.map(j => j.jobId === jobId ? { ...j, ...step.statusUpdate } : j));
        }
      }, step.at);
      timers.push(t);
    });
  }, [cycleState.running, dataSource]);

  return { jobs, sentiment, signal, health, cycleState, triggerCycle, dataSource, liveError };
}

function jitter(s) {
  const score = Math.max(0.05, Math.min(0.95, s.score + (Math.random() - 0.5) * 0.04));
  const label = score > 0.6 ? "positive" : score < 0.4 ? "negative" : "neutral";
  return {
    label,
    score,
    confidence: Math.max(0.4, Math.min(0.99, s.confidence + (Math.random()-0.5)*0.03)),
    samples: s.samples + Math.floor(Math.random() * 12),
  };
}

// ============================================================
// App
// ============================================================
function App() {
  const [route, setRoute] = useStateA(() => {
    const h = window.location.hash.replace(/^#/, "");
    if (["/", "/agents", "/escrow"].includes(h)) return h;
    return "/";
  });
  useEffectA(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, "") || "/";
      if (["/", "/agents", "/escrow"].includes(h)) setRoute(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const sim = useNexusSim();

  const screenLabel = route === "/" ? "01 Dashboard"
                    : route === "/agents" ? "02 Agents"
                    : "03 Escrow";

  return (
    <div data-screen-label={screenLabel} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <TopNav route={route} setRoute={setRoute} healthOnline={sim.health.status === "online"}/>
      <main style={{ flex: 1, padding: "24px 22px 0", maxWidth: 1440, margin: "0 auto", width: "100%" }}>
        <DataSourceBanner source={sim.dataSource} liveError={sim.liveError}/>
        {route === "/" && (
          <DashboardPage
            jobs={sim.jobs}
            sentiment={sim.sentiment}
            signal={sim.signal}
            health={sim.health}
            running={sim.cycleState.running}
            progress={sim.cycleState.progress}
            activePhase={sim.cycleState.activePhase}
            completedThrough={sim.cycleState.completedThrough}
            currentArtifacts={sim.cycleState.artifacts}
            onTrigger={sim.triggerCycle}
          />
        )}
        {route === "/agents" && <AgentsPage/>}
        {route === "/escrow" && <EscrowPage jobs={sim.jobs}/>}
      </main>
      <Footer/>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
