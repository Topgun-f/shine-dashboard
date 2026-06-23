"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const TVA_RATE = 0.20;
const URSSAF_RATE = 0.261;

const IR_TRANCHES = [
  { max: 11497, rate: 0 },
  { max: 29315, rate: 0.11 },
  { max: 83823, rate: 0.30 },
  { max: 180294, rate: 0.41 },
  { max: Infinity, rate: 0.45 },
];

function computeIR(revenuImposable: number): number {
  let impot = 0;
  let prev = 0;
  for (const tranche of IR_TRANCHES) {
    if (revenuImposable <= prev) break;
    const trancheMax = Math.min(revenuImposable, tranche.max);
    impot += (trancheMax - prev) * tranche.rate;
    prev = tranche.max;
  }
  return impot;
}

function formatEur(val: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatPct(val: number) {
  return (val * 100).toFixed(1) + " %";
}

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-2 border border-white/5 bg-white/[0.03]">
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-2xl ${color}`} />
      <div className="flex items-center gap-2 text-white/50 text-sm font-medium">
        <span className="text-lg">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-white/40">{sub}</div>}
    </div>
  );
}

interface Facture {
  id: string;
  sujet: string;
  expediteur: string;
  date: string;
  montant: number | null;
  snippet: string;
}

function GmailSection() {
  const { data: session, status } = useSession();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFactures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail");
      if (!res.ok) throw new Error("Erreur lors de la récupération");
      const data = await res.json();
      setFactures(data.factures || []);
    } catch {
      setError("Impossible de charger les factures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchFactures();
  }, [session, fetchFactures]);

  const totalFactures = factures
    .filter((f) => f.montant !== null)
    .reduce((sum, f) => sum + (f.montant || 0), 0);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 flex items-center gap-3 text-white/40">
        <span className="animate-spin text-xl">⏳</span>
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl shrink-0">📧</div>
          <div>
            <div className="font-semibold text-sm">Import Gmail — Factures automatiques</div>
            <div className="text-xs text-white/40">Connecte ton compte Google pour lire tes factures</div>
          </div>
        </div>
        <button
          onClick={() => signIn("google")}
          className="flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold rounded-xl px-5 py-3 text-sm hover:bg-gray-100 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Connecter Gmail
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-base">📧</div>
          <div>
            <div className="font-semibold text-sm">Gmail connecté</div>
            <div className="text-xs text-white/40">{session.user?.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFactures}
            disabled={loading}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-all disabled:opacity-40"
          >
            {loading ? "⏳" : "🔄 Actualiser"}
          </button>
          <button
            onClick={() => signOut()}
            className="text-xs text-white/30 hover:text-white/60 transition-all"
          >
            Déconnecter
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {!loading && factures.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
            <span className="text-white/50">{factures.length} factures trouvées (90 derniers jours)</span>
            {totalFactures > 0 && (
              <span className="font-bold text-emerald-400">{formatEur(totalFactures)} total</span>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {factures.map((f) => (
              <div key={f.id} className="flex items-start justify-between gap-3 bg-white/[0.02] rounded-xl px-3 py-2.5 border border-white/5">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="text-sm font-medium truncate">{f.sujet || "(Sans sujet)"}</div>
                  <div className="text-xs text-white/40 truncate">{f.expediteur}</div>
                  <div className="text-xs text-white/20">{f.date}</div>
                </div>
                {f.montant !== null && (
                  <div className="text-sm font-bold text-emerald-400 shrink-0">{formatEur(f.montant)}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && factures.length === 0 && !error && (
        <div className="text-sm text-white/30 text-center py-4">
          Aucune facture trouvée dans les 90 derniers jours
        </div>
      )}

      {loading && (
        <div className="text-sm text-white/40 text-center py-4 flex items-center justify-center gap-2">
          <span className="animate-spin">⏳</span> Lecture de tes emails...
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [ca, setCa] = useState<number>(5000);
  const [input, setInput] = useState("5000");

  const calc = useMemo(() => {
    const tva = ca * (TVA_RATE / (1 + TVA_RATE));
    const caHT = ca / (1 + TVA_RATE);
    const urssaf = caHT * URSSAF_RATE;
    const revenuImposable = caHT - urssaf;
    const ir = computeIR(revenuImposable);
    const net = revenuImposable - ir;
    const tauxIREffectif = revenuImposable > 0 ? ir / revenuImposable : 0;
    return { tva, caHT, urssaf, revenuImposable, ir, net, tauxIREffectif };
  }, [ca]);

  const handleInput = (val: string) => {
    setInput(val);
    const num = parseFloat(val.replace(",", "."));
    if (!isNaN(num) && num >= 0) setCa(num);
  };

  const netPct = ca > 0 ? (calc.net / ca) * 100 : 0;

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">💎</div>
          <h1 className="text-2xl font-bold tracking-tight">Shine Dashboard</h1>
        </div>
        <p className="text-white/40 text-sm pl-12">Micro-entreprise BNC • TVA 20%</p>
      </div>

      {/* Saisie CA */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/50 font-medium">Chiffre d&apos;affaires encaissé (TTC)</label>
          <div className="relative mt-1">
            <input
              type="number"
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-2xl font-bold outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              min={0}
              step={100}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-xl font-bold">€</span>
          </div>
          <input
            type="range"
            min={0}
            max={50000}
            step={100}
            value={ca}
            onChange={(e) => {
              setCa(Number(e.target.value));
              setInput(String(e.target.value));
            }}
            className="mt-3"
          />
          <div className="flex justify-between text-xs text-white/20 mt-1">
            <span>0 €</span>
            <span>50 000 €</span>
          </div>
        </div>

        {/* Barre de répartition */}
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Répartition du CA</div>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            <div className="bg-red-500/80 transition-all duration-300" style={{ width: ca > 0 ? `${(calc.tva / ca) * 100}%` : "0%" }} />
            <div className="bg-orange-500/80 transition-all duration-300" style={{ width: ca > 0 ? `${(calc.urssaf / ca) * 100}%` : "0%" }} />
            <div className="bg-yellow-500/80 transition-all duration-300" style={{ width: ca > 0 ? `${(calc.ir / ca) * 100}%` : "0%" }} />
            <div className="bg-emerald-500/80 transition-all duration-300 flex-1 min-w-0" />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/80 inline-block" />TVA</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500/80 inline-block" />URSSAF</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500/80 inline-block" />Impôt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" />Net</span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="TVA à rendre" value={formatEur(calc.tva)} sub="à la DGFiP • taux 20%" color="bg-red-500" icon="🏛️" />
        <StatCard label="URSSAF" value={formatEur(calc.urssaf)} sub="BNC • taux 26.1%" color="bg-orange-500" icon="🏥" />
        <StatCard label="Impôt sur le revenu" value={formatEur(calc.ir)} sub={`Taux effectif ${formatPct(calc.tauxIREffectif)}`} color="bg-yellow-500" icon="📊" />
        <StatCard label="Net disponible" value={formatEur(calc.net)} sub={`${netPct.toFixed(0)}% de ton CA TTC`} color="bg-emerald-500" icon="💸" />
      </div>

      {/* Détail tranches IR */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 flex flex-col gap-4">
        <div className="text-sm font-medium text-white/50 uppercase tracking-wider">Tranches d&apos;imposition</div>
        <div className="flex flex-col gap-1">
          {IR_TRANCHES.map((t, i) => {
            const prev = i === 0 ? 0 : IR_TRANCHES[i - 1].max;
            const isActive = calc.revenuImposable > prev;
            return (
              <div key={i} className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 transition-all ${isActive ? "bg-white/5 text-white" : "text-white/20"}`}>
                <span>
                  {i === IR_TRANCHES.length - 1
                    ? `> ${new Intl.NumberFormat("fr-FR").format(prev)} €`
                    : `${new Intl.NumberFormat("fr-FR").format(prev)} – ${new Intl.NumberFormat("fr-FR").format(t.max)} €`}
                </span>
                <span className={`font-bold ${isActive ? "text-yellow-400" : ""}`}>{(t.rate * 100).toFixed(0)} %</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/5 pt-3 flex justify-between text-sm">
          <span className="text-white/50">Revenu imposable (après URSSAF)</span>
          <span className="font-semibold">{formatEur(calc.revenuImposable)}</span>
        </div>
      </div>

      {/* Récap final */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 flex flex-col gap-3">
        <div className="text-sm font-medium text-indigo-300 uppercase tracking-wider">Récapitulatif</div>
        <div className="flex flex-col gap-2 text-sm">
          {[
            { label: "CA encaissé (TTC)", val: formatEur(ca), color: "text-white" },
            { label: "CA hors taxes (HT)", val: formatEur(calc.caHT), color: "text-white/70" },
            { label: "— TVA DGFiP (20%)", val: `- ${formatEur(calc.tva)}`, color: "text-red-400" },
            { label: "— URSSAF BNC (26.1% HT)", val: `- ${formatEur(calc.urssaf)}`, color: "text-orange-400" },
            { label: "— Impôt sur le revenu", val: `- ${formatEur(calc.ir)}`, color: "text-yellow-400" },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-white/50">{label}</span>
              <span className={`font-semibold ${color}`}>{val}</span>
            </div>
          ))}
          <div className="border-t border-white/10 mt-1 pt-3 flex justify-between items-center">
            <span className="font-bold text-emerald-300">= Net à te virer</span>
            <span className="text-xl font-black text-emerald-400">{formatEur(calc.net)}</span>
          </div>
        </div>
      </div>

      {/* Gmail */}
      <GmailSection />

      <div className="text-center text-xs text-white/20 pb-4">
        Calculs basés sur les taux 2025 • Non contractuel
      </div>
    </main>
  );
}
