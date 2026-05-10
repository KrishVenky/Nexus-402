/* global React */
const useStateE = React.useState;
const useMemoE = React.useMemo;
const DE = window.NEXUS_DATA;
const UE = window.NEXUS_UTIL;

const FILTERS = ["All", "Initialized", "Proof Submitted", "Disbursed", "Cancelled"];

// ============================================================
// Job card (escrow grid)
// ============================================================
function JobCard({ job }) {
  const accent = job.status === "Disbursed" ? "var(--green)"
               : job.status === "Cancelled" ? "var(--red)"
               : job.status === "Proof Submitted" ? "var(--yellow)"
               : "var(--blue)";
  return (
    <div className="panel" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* accent bar top */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}33)` }}/>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon.Hash s={11}/> Job
          </span>
          <StatusBadge status={job.status} size="sm"/>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <MonoAddr value={job.jobId} kind="hash" head={10} tail={6}/>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-1)", padding: "2px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-1)", borderRadius: 4 }}>{job.asset}</span>
        </div>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* amount big */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="label">Amount</span>
            <SolAmount lamports={job.amountLamports} size="lg" color={accent} showLamports={false}/>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
            <span className="label">Time</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--fg-1)" }}>{UE.timeAgo(job.createdAt)}</span>
          </div>
        </div>

        {/* worker / buyer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <KVCard label="Buyer" value={<MonoAddr value={job.buyer} link={UE.explorerAddr(job.buyer)} showCopy={false}/>}/>
          <KVCard label="Worker" value={<MonoAddr value={job.worker} link={UE.explorerAddr(job.worker)} showCopy={false}/>}/>
        </div>

        {/* proof hash */}
        <KVCard
          label="Proof Hash"
          value={job.proofHash
            ? <MonoAddr value={job.proofHash} kind="hash" head={10} tail={8}/>
            : <span className="mono dim" style={{ fontSize: 11.5 }}>not submitted</span>
          }
        />

        {/* timing details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Mini label="Inference" value={job.inferenceMs ? `${job.inferenceMs}ms` : "—"}/>
          <Mini label="Backend" value={job.backend}/>
          <Mini label="Model" value={job.model.split("-").slice(0,2).join("-")}/>
        </div>

        {/* tx links footer */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTop: "1px solid var(--border-1)" }}>
          <TxChip kind="init"     sig={job.initSig}/>
          <TxChip kind="proof"    sig={job.proofSig}/>
          <TxChip kind="disburse" sig={job.disburseSig}/>
        </div>

        {job.cancelReason && (
          <div style={{
            padding: "8px 10px", background: "var(--red-dim)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 6, fontSize: 11.5, color: "var(--red)",
            fontFamily: "var(--font-mono)",
          }}>
            Warning: {job.cancelReason}
          </div>
        )}
      </div>
    </div>
  );
}

function KVCard({ label, value }) {
  return (
    <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.018)", border: "1px solid var(--border-1)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span className="label" style={{ fontSize: 9.5 }}>{label}</span>
      <span style={{ minWidth: 0 }}>{value}</span>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span className="label" style={{ fontSize: 9 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: "var(--fg-1)" }}>{value}</span>
    </div>
  );
}

function TxChip({ kind, sig }) {
  const labels = { init: "init", proof: "proof", disburse: "disburse" };
  if (!sig) return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", border: "1px dashed var(--border-1)",
      borderRadius: 4, fontSize: 10, color: "var(--fg-4)",
      fontFamily: "var(--font-mono)",
    }}>
      {labels[kind]} —
    </span>
  );
  return (
    <a href={UE.explorerTx(sig)} target="_blank" rel="noreferrer" style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px",
      background: "rgba(96,165,250,0.06)",
      border: "1px solid var(--border-blue)",
      borderRadius: 4, fontSize: 10,
      fontFamily: "var(--font-mono)", color: "var(--blue)",
    }}>
      {labels[kind]} · {UE.truncatePubkey(sig, 4, 4)}
      <Icon.Ext s={9}/>
    </a>
  );
}

// ============================================================
// Empty state
// ============================================================
function EmptyState({ filter }) {
  return (
    <div className="panel" style={{ padding: "60px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
      <svg width="120" height="80" viewBox="0 0 120 80" style={{ opacity: 0.6 }}>
        <defs>
          <linearGradient id="empty-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="var(--purple)" stopOpacity="0.2"/>
          </linearGradient>
        </defs>
        {/* nested escrow boxes */}
        <rect x="10" y="20" width="40" height="40" rx="4" stroke="var(--border-2)" fill="none" strokeWidth="1"/>
        <rect x="40" y="10" width="40" height="40" rx="4" stroke="var(--border-2)" fill="none" strokeWidth="1"/>
        <rect x="70" y="22" width="40" height="40" rx="4" stroke="url(#empty-grad)" fill="rgba(96,165,250,0.04)" strokeWidth="1"/>
        <line x1="50" y1="40" x2="70" y2="40" stroke="var(--border-2)" strokeDasharray="2 2"/>
        <circle cx="90" cy="42" r="2" fill="var(--blue)"/>
      </svg>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)", marginBottom: 6 }}>No jobs found</div>
        <div style={{ fontSize: 12.5, color: "var(--fg-3)" }}>
          {filter === "All" ? "Trigger a new analysis cycle to populate the registry." : `No jobs currently match the "${filter}" filter.`}
        </div>
      </div>
      <a href="#/" className="btn btn-primary"><Icon.Play s={12} filled/> Run a cycle</a>
    </div>
  );
}

// ============================================================
// EscrowPage
// ============================================================
function EscrowPage({ jobs }) {
  const [filter, setFilter] = useStateE("All");
  const [search, setSearch] = useStateE("");

  const counts = useMemoE(() => {
    const c = { All: jobs.length };
    for (const j of jobs) c[j.status] = (c[j.status] || 0) + 1;
    return c;
  }, [jobs]);

  const filtered = useMemoE(() => {
    return jobs.filter(j => {
      if (filter !== "All" && j.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!j.jobId.toLowerCase().includes(q) &&
            !j.worker.toLowerCase().includes(q) &&
            !(j.proofHash || "").toLowerCase().includes(q) &&
            !(j.asset || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [jobs, filter, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* title */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Explorer</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>
            Escrow Jobs
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", maxWidth: 580, marginTop: 4 }}>
            Per-job state, proof attestations, and on-chain transactions.
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", height: 36, background: "rgba(255,255,255,0.025)", border: "1px solid var(--border-1)", borderRadius: 8, padding: "0 12px", gap: 8, minWidth: 280 }}>
          <Icon.Search s={13}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobId, worker, proof hash…"
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--fg-0)", fontSize: 12.5, flex: 1, fontFamily: "var(--font-mono)" }}
          />
          <span className="kbd">/</span>
        </div>
      </div>

      {/* filter bar */}
      <div className="panel" style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FILTERS.map(f => {
            const active = filter === f;
            const n = counts[f] || 0;
            return (
              <button key={f}
                onClick={() => setFilter(f)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  height: 30, padding: "0 12px",
                  background: active ? "rgba(96,165,250,0.10)" : "transparent",
                  border: `1px solid ${active ? "var(--border-blue)" : "transparent"}`,
                  borderRadius: 6,
                  color: active ? "var(--fg-0)" : "var(--fg-2)",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "var(--font-sans)",
                  transition: "all 120ms ease",
                }}>
                {f}
                <span className="mono" style={{
                  fontSize: 10.5, color: active ? "var(--blue)" : "var(--fg-3)",
                  background: active ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)",
                  padding: "1px 6px", borderRadius: 999, minWidth: 18, textAlign: "center",
                }}>{n}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>{filtered.length} of {jobs.length}</span>
          <button className="btn"><Icon.Filter s={12}/> Advanced</button>
        </div>
      </div>

      {/* grid or empty */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter}/>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
          {filtered.map(j => <JobCard key={j.jobId} job={j}/>)}
        </div>
      )}
    </div>
  );
}

window.EscrowPage = EscrowPage;
