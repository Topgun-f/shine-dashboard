"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const TVA_RATE = 0.20;
const URSSAF_RATE = 0.261;
const CFP_RATE = 0.002;

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
  isShine: boolean;
  attachments: { nom: string; attachmentId: string; messageId: string }[];
}

const PERIODES = [
  { label: "7 derniers jours", value: "7d" },
  { label: "30 derniers jours", value: "30d" },
  { label: "90 derniers jours", value: "90d" },
  { label: "Cette année", value: "365d" },
];

function GmailSection({ onInjectCA }: { onInjectCA: (montant: number) => void }) {
  const { data: session, status } = useSession();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState("365d");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [pattern, setPattern] = useState("");
  const [modeDate, setModeDate] = useState<"preset" | "custom">("preset");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [pdfResults, setPdfResults] = useState<Record<string, { montant: number | null; tous: number[] }>>({});

  const toggleSelect = async (facture: Facture) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(facture.id!)) {
      newSelected.delete(facture.id!);
    } else {
      newSelected.add(facture.id!);
      // Lire le PDF si pas encore fait
      if (!pdfResults[facture.id!] && (facture.attachments?.length ?? 0) > 0) {
        setPdfLoading(facture.id!);
        try {
          const att = facture.attachments[0];
          const res = await fetch(`/api/gmail/attachment?messageId=${att.messageId}&attachmentId=${att.attachmentId}`);
          const data = await res.json();
          setPdfResults((prev) => ({ ...prev, [facture.id!]: data }));
          if (data.montant) onInjectCA(data.montant);
        } catch {
          // silence
        } finally {
          setPdfLoading(null);
        }
      } else if (pdfResults[facture.id!]?.montant) {
        onInjectCA(pdfResults[facture.id!].montant!);
      } else if (facture.montant) {
        onInjectCA(facture.montant);
      }
    }
    setSelectedIds(newSelected);
  };

  const fetchFactures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (modeDate === "custom" && dateDebut && dateFin) {
        params.set("dateDebut", dateDebut);
        params.set("dateFin", dateFin);
      } else {
        params.set("periode", periode);
      }
      if (pattern.trim()) params.set("pattern", pattern.trim());

      const res = await fetch(`/api/gmail?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur lors de la récupération");
      const data = await res.json();
      setFactures(data.factures || []);
    } catch {
      setError("Impossible de charger les factures.");
    } finally {
      setLoading(false);
    }
  }, [periode, dateDebut, dateFin, pattern, modeDate]);

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
      {/* Header */}
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

      {/* Filtres */}
      <div className="flex flex-col gap-3 border border-white/5 rounded-xl p-3 bg-white/[0.02]">
        {/* Toggle preset / custom */}
        <div className="flex gap-2">
          <button
            onClick={() => setModeDate("preset")}
            className={`text-xs rounded-lg px-3 py-1.5 transition-all ${modeDate === "preset" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"}`}
          >
            Période prédéfinie
          </button>
          <button
            onClick={() => setModeDate("custom")}
            className={`text-xs rounded-lg px-3 py-1.5 transition-all ${modeDate === "custom" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"}`}
          >
            Dates personnalisées
          </button>
        </div>

        {/* Périodes prédéfinies */}
        {modeDate === "preset" && (
          <div className="flex flex-wrap gap-2">
            {PERIODES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriode(p.value)}
                className={`text-xs rounded-lg px-3 py-1.5 transition-all ${periode === p.value ? "bg-white/15 text-white border border-white/20" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Dates custom */}
        {modeDate === "custom" && (
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-indigo-500/60 transition-all"
            />
            <span className="text-white/30 text-xs">→</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-indigo-500/60 transition-all"
            />
          </div>
        )}

        {/* Pattern */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Filtrer par mot-clé (ex: shine, stripe, paypal…)"
            className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-all"
          />
          {pattern && (
            <button onClick={() => setPattern("")} className="text-white/30 hover:text-white/60 text-xs transition-all">✕</button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {!loading && factures.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
            <span className="text-white/50">{factures.length} facture{factures.length > 1 ? "s" : ""} trouvée{factures.length > 1 ? "s" : ""}</span>
            {totalFactures > 0 && (
              <span className="font-bold text-emerald-400">{formatEur(totalFactures)} total</span>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {factures.map((f) => {
              const isSelected = selectedIds.has(f.id!);
              const isLoadingPdf = pdfLoading === f.id;
              const pdfResult = pdfResults[f.id!];
              const montantAffiche = pdfResult?.montant ?? f.montant;

              return (
                <div
                  key={f.id}
                  onClick={() => toggleSelect(f)}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : f.isShine
                      ? "bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                    {isLoadingPdf ? (
                      <span className="text-xs animate-spin">⏳</span>
                    ) : isSelected ? (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>

                  {/* Contenu */}
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {f.isShine && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-300 rounded-full px-2 py-0.5 font-medium shrink-0">Shine</span>
                      )}
                      <div className="text-sm font-medium truncate">{f.sujet || "(Sans sujet)"}</div>
                    </div>
                    <div className="text-xs text-white/40 truncate">{f.expediteur}</div>
                    <div className="text-xs text-white/20">{new Date(f.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                    {(f.attachments?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.attachments.map((a) => (
                          <span key={a.attachmentId} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white/40 flex items-center gap-1">
                            📎 {a.nom}
                          </span>
                        ))}
                      </div>
                    )}
                    {pdfResult && pdfResult.tous.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pdfResult.tous.map((m) => (
                          <button
                            key={m}
                            onClick={(e) => { e.stopPropagation(); onInjectCA(m); }}
                            className={`text-xs rounded px-2 py-0.5 border transition-all ${m === pdfResult.montant ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"}`}
                          >
                            {formatEur(m)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Montant */}
                  {montantAffiche !== null && (
                    <div className={`text-sm font-bold shrink-0 ${isSelected ? "text-emerald-400" : "text-white/50"}`}>
                      {formatEur(montantAffiche)}
                    </div>
                  )}
                </div>
              );
            })}
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

const TAUX_IR_FIXE = 0.241; // taux effectif réel à 154k CA/an

export default function Home() {
  const [ca, setCa] = useState<number>(154000);
  const [input, setInput] = useState("154000");
  const [caFromFactures, setCaFromFactures] = useState<number | null>(null);
  const [modeFacture, setModeFacture] = useState(false);

  const handleInjectCA = (montant: number) => {
    setCaFromFactures(montant);
    setInput(String(montant));
    setCa(montant);
    setModeFacture(true);
  };

  const handleResetCA = () => {
    setCaFromFactures(null);
    setModeFacture(false);
    setCa(154000);
    setInput("154000");
  };

  const calc = useMemo(() => {
    const tva = ca * (TVA_RATE / (1 + TVA_RATE));
    const caHT = ca / (1 + TVA_RATE);
    const urssaf = caHT * URSSAF_RATE;
    const cfp = caHT * CFP_RATE;
    const revenuImposable = caHT - urssaf - cfp;
    // En mode facture unique : taux effectif annuel fixe (24.1%)
    // En mode annuel : calcul par tranches réel
    const ir = modeFacture
      ? revenuImposable * TAUX_IR_FIXE
      : computeIR(revenuImposable);
    const net = revenuImposable - ir;
    const tauxIREffectif = revenuImposable > 0 ? ir / revenuImposable : 0;
    return { tva, caHT, urssaf, cfp, revenuImposable, ir, net, tauxIREffectif };
  }, [ca, modeFacture]);

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
            max={200000}
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
            <span>200 000 €</span>
          </div>
          {modeFacture && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mt-1">
              <span className="text-xs text-emerald-300 flex items-center gap-2">
                📎 Mode facture — IR à taux effectif fixe 24.1%
              </span>
              <button onClick={handleResetCA} className="text-xs text-white/30 hover:text-white/60 transition-all">
                ✕ Réinitialiser
              </button>
            </div>
          )}
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
        <StatCard label="Formation pro (CFP)" value={formatEur(calc.cfp)} sub="taux 0.2% du CA HT" color="bg-purple-500" icon="🎓" />
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
            { label: "— Formation pro CFP (0.2% HT)", val: `- ${formatEur(calc.cfp)}`, color: "text-purple-400" },
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
      <GmailSection onInjectCA={handleInjectCA} />

      <div className="text-center text-xs text-white/20 pb-4">
        Calculs basés sur les taux 2025 • Non contractuel
      </div>
    </main>
  );
}
