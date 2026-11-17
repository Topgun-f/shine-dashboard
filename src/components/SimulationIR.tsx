"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PARAMETRES_IR_2026,
  type FoyerFiscal,
  type RegimeBnc,
  type Situation,
  impotDeclarationsSeparees,
  impotImputableBnc,
  simulerIR,
} from "@/lib/impot";

const STORAGE_KEY = "shine-simulation-ir";

interface Reglages {
  situation: Situation;
  enfants: number;
  parentIsole: boolean;
  regimeBnc: RegimeBnc;
  lieAuDashboard: boolean;
  montantBncManuel: number;
  salaires1: number;
  salaires2: number;
  autresRevenus: number;
  chargesDeductibles: number;
}

const REGLAGES_DEFAUT: Reglages = {
  situation: "seul",
  enfants: 0,
  parentIsole: false,
  regimeBnc: "micro",
  lieAuDashboard: true,
  montantBncManuel: 0,
  salaires1: 0,
  salaires2: 0,
  autresRevenus: 0,
  chargesDeductibles: 0,
};

function formatEur(val: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
}

function formatPct(val: number, digits = 1) {
  return (val * 100).toFixed(digits).replace(".", ",") + " %";
}

function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/10 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 text-xs rounded-lg px-3 py-1.5 transition-all ${
            value === o.value ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/30" : "text-white/40 border border-transparent hover:bg-white/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChampEuro({
  label, value, onChange, hint, disabled,
}: { label: string; value: number; onChange: (v: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-white/45">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={0}
          step={100}
          value={Number.isFinite(value) ? Math.round(value) : 0}
          disabled={disabled}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            onChange(isNaN(n) ? 0 : n);
          }}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-7 text-sm font-semibold outline-none focus:border-indigo-500/60 transition-all disabled:opacity-50"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 text-xs">€</span>
      </div>
      {hint && <span className="text-[10px] text-white/25">{hint}</span>}
    </label>
  );
}

function Ligne({ label, value, color, strong, sub }: { label: string; value: string; color?: string; strong?: boolean; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className={strong ? "text-white/70 font-semibold" : "text-white/40"}>
        {label}
        {sub && <span className="text-white/20 text-[10px] ml-1.5">{sub}</span>}
      </span>
      <span className={`font-semibold tabular-nums ${color ?? "text-white/80"} ${strong ? "text-sm" : ""}`}>{value}</span>
    </div>
  );
}

const COULEURS_TRANCHES = ["bg-white/15", "bg-sky-400/70", "bg-indigo-400/80", "bg-violet-400/80", "bg-fuchsia-400/80"];

export default function SimulationIR({
  caHT,
  baseImposableDashboard,
  modeTaux,
  tauxFixe,
  onModeTauxChange,
  onTauxSimuleChange,
}: {
  /** CA HT annuel saisi dans le dashboard */
  caHT: number;
  /** Base sur laquelle le dashboard applique le taux d'IR (CA HT − URSSAF − CFP) */
  baseImposableDashboard: number;
  modeTaux: "fixe" | "simule";
  tauxFixe: number;
  onModeTauxChange: (mode: "fixe" | "simule") => void;
  onTauxSimuleChange: (taux: number | null) => void;
}) {
  const [r, setR] = useState<Reglages>(REGLAGES_DEFAUT);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Lecture après hydratation pour éviter un décalage SSR/client
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setR({ ...REGLAGES_DEFAUT, ...JSON.parse(raw) });
    } catch {
      // silence
    }
    setCharge(true);
  }, []);

  useEffect(() => {
    if (!charge) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } catch {
      // silence
    }
  }, [r, charge]);

  const maj = <K extends keyof Reglages>(k: K, v: Reglages[K]) => setR((prev) => ({ ...prev, [k]: v }));

  // Montant BNC : recettes HT en micro, bénéfice en déclaration contrôlée
  const montantBncLie = r.regimeBnc === "micro" ? caHT : baseImposableDashboard;
  const montantBnc = r.lieAuDashboard ? montantBncLie : r.montantBncManuel;

  const foyer: FoyerFiscal = useMemo(() => ({
    situation: r.situation,
    enfants: r.enfants,
    parentIsole: r.parentIsole,
    regimeBnc: r.regimeBnc,
    montantBnc,
    salaires1: r.salaires1,
    salaires2: r.situation === "couple" ? r.salaires2 : 0,
    autresRevenus: r.autresRevenus,
    chargesDeductibles: r.chargesDeductibles,
  }), [r, montantBnc]);

  const res = useMemo(() => simulerIR(foyer), [foyer]);
  const impotBnc = useMemo(() => impotImputableBnc(foyer), [foyer]);
  const impotSepare = useMemo(() => (r.situation === "couple" ? impotDeclarationsSeparees(foyer) : null), [foyer, r.situation]);

  // Taux à appliquer à la base du dashboard pour retrouver l'impôt imputable à l'activité
  const tauxEquivalent = r.lieAuDashboard && baseImposableDashboard > 0 ? impotBnc / baseImposableDashboard : null;

  useEffect(() => {
    onTauxSimuleChange(tauxEquivalent);
  }, [tauxEquivalent, onTauxSimuleChange]);

  const maxTrancheBase = Math.max(...res.detailTranches.map((t) => t.base), 1);
  const gainCommun = impotSepare !== null ? impotSepare - res.impotNet : null;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-base">🧮</div>
          <div>
            <div className="font-semibold text-sm">Simulation impôt sur le revenu</div>
            <div className="text-xs text-white/40">
              Barème progressif, quotient familial, décote — {PARAMETRES_IR_2026.label}
            </div>
          </div>
        </div>
        <button
          onClick={() => setR(REGLAGES_DEFAUT)}
          className="text-xs text-white/30 hover:text-white/60 transition-all"
        >
          ↺ Réinitialiser
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-5">
        {/* ───── Paramètres du foyer ───── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Foyer fiscal</div>
            <Segmented
              value={r.situation}
              onChange={(v) => maj("situation", v)}
              options={[{ value: "seul", label: "Célibataire" }, { value: "couple", label: "Marié · Pacsé" }]}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/45">Enfants à charge</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => maj("enfants", Math.max(0, r.enfants - 1))}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                >−</button>
                <span className="w-5 text-center text-sm font-bold">{r.enfants}</span>
                <button
                  onClick={() => maj("enfants", Math.min(10, r.enfants + 1))}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                >+</button>
              </div>
            </div>
            {r.situation === "seul" && r.enfants > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-white/45 cursor-pointer">
                <input
                  type="checkbox"
                  checked={r.parentIsole}
                  onChange={(e) => maj("parentIsole", e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-500"
                />
                Parent isolé (case T)
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Activité BNC</div>
            <Segmented
              value={r.regimeBnc}
              onChange={(v) => maj("regimeBnc", v)}
              options={[{ value: "micro", label: "Micro-BNC (−34 %)" }, { value: "reel", label: "Déclaration contrôlée" }]}
            />
            <label className="flex items-center gap-2 text-[11px] text-white/45 cursor-pointer">
              <input
                type="checkbox"
                checked={r.lieAuDashboard}
                onChange={(e) => {
                  const lie = e.target.checked;
                  setR((prev) => ({ ...prev, lieAuDashboard: lie, montantBncManuel: lie ? prev.montantBncManuel : Math.round(montantBncLie) }));
                }}
                className="w-3.5 h-3.5 accent-indigo-500"
              />
              Utiliser le CA annuel du dashboard
            </label>
            <ChampEuro
              label={r.regimeBnc === "micro" ? "Recettes encaissées HT (année)" : "Bénéfice BNC (recettes − charges)"}
              value={montantBnc}
              disabled={r.lieAuDashboard}
              onChange={(v) => maj("montantBncManuel", v)}
              hint={
                r.lieAuDashboard
                  ? r.regimeBnc === "micro"
                    ? "CA HT du dashboard — abattement forfaitaire de 34 % (min. 305 €)"
                    : "CA HT − URSSAF − CFP du dashboard (autres frais réels non déduits)"
                  : undefined
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Autres revenus</div>
            <ChampEuro
              label="Tes salaires nets imposables"
              value={r.salaires1}
              onChange={(v) => maj("salaires1", v)}
              hint={r.salaires1 > 0 ? "Abattement 10 % appliqué automatiquement" : undefined}
            />
            {r.situation === "couple" && (
              <ChampEuro
                label="Salaires nets imposables du / de la conjoint·e"
                value={r.salaires2}
                onChange={(v) => maj("salaires2", v)}
                hint="Abattement 10 % appliqué automatiquement"
              />
            )}
            <ChampEuro
              label="Autres revenus nets imposables"
              value={r.autresRevenus}
              onChange={(v) => maj("autresRevenus", v)}
              hint="Fonciers, pensions… déjà nets d'abattements"
            />
            <ChampEuro
              label="Charges déductibles (PER, pension alimentaire…)"
              value={r.chargesDeductibles}
              onChange={(v) => maj("chargesDeductibles", v)}
            />
          </div>
        </div>

        {/* ───── Résultats ───── */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="rounded-2xl border border-yellow-500/25 bg-gradient-to-br from-yellow-500/10 to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold text-yellow-300/60 uppercase tracking-widest mb-1">Impôt net du foyer</div>
              <div className="text-4xl font-black text-yellow-400 tracking-tight">{formatEur(res.impotNet)}</div>
              <div className="text-xs text-white/30 mt-1">soit {formatEur(res.impotNet / 12)} / mois</div>
            </div>
            <div className="grid grid-cols-3 gap-5 text-right">
              <div>
                <div className="text-[10px] text-white/25 uppercase tracking-wider">Taux moyen</div>
                <div className="text-lg font-bold">{formatPct(res.tauxMoyen)}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/25 uppercase tracking-wider">TMI</div>
                <div className="text-lg font-bold">{formatPct(res.tmi, 0)}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/25 uppercase tracking-wider">Parts</div>
                <div className="text-lg font-bold">{res.parts.toString().replace(".", ",")}</div>
              </div>
            </div>
          </div>

          {res.depassementPlafondMicro && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-xs text-orange-200">
              ⚠️ Recettes au-dessus du plafond micro-BNC ({formatEur(PARAMETRES_IR_2026.microBnc.plafond)}, proratisé l&apos;année de création).
              Le régime micro reste applicable tant que le plafond n&apos;est pas dépassé deux années consécutives — au-delà, passage en déclaration contrôlée.
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Détail du calcul */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-1.5 text-xs">
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Détail du calcul</div>
              <Ligne label="BNC imposable" value={formatEur(res.bncImposable)} sub={r.regimeBnc === "micro" ? "après abattement 34 %" : "bénéfice"} />
              {res.salairesNets > 0 && <Ligne label="Salaires nets" value={formatEur(res.salairesNets)} sub="après 10 %" />}
              {r.autresRevenus > 0 && <Ligne label="Autres revenus" value={formatEur(r.autresRevenus)} />}
              {r.chargesDeductibles > 0 && <Ligne label="Charges déductibles" value={`- ${formatEur(r.chargesDeductibles)}`} color="text-emerald-400" />}
              <div className="border-t border-white/5 my-1" />
              <Ligne label="Revenu net imposable" value={formatEur(res.revenuImposable)} strong />
              <Ligne label="Quotient familial" value={formatEur(res.quotient)} sub={`÷ ${res.parts.toString().replace(".", ",")} part${res.parts > 1 ? "s" : ""}`} />
              <Ligne label="Impôt brut (barème)" value={formatEur(res.impotAvantPlafond)} />
              {res.plafonnementQF > 0 && <Ligne label="Plafonnement du QF" value={`+ ${formatEur(res.plafonnementQF)}`} color="text-red-400" />}
              {res.decote > 0 && <Ligne label="Décote" value={`- ${formatEur(res.decote)}`} color="text-emerald-400" />}
              {res.cehr > 0 && <Ligne label="Contribution hauts revenus" value={`+ ${formatEur(res.cehr)}`} color="text-red-400" />}
              <div className="border-t border-white/5 my-1" />
              <Ligne label="Impôt net" value={formatEur(res.impotNet)} color="text-yellow-400" strong />
            </div>

            {/* Répartition par tranche */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-2.5 text-xs">
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Revenu taxé par tranche</div>
              {res.detailTranches.map((t, i) => (
                <div key={t.taux} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px]">
                    <span className={t.base > 0 ? "text-white/60" : "text-white/20"}>
                      {formatPct(t.taux, 0)}
                      <span className="text-white/20 ml-1.5">
                        {t.max === Infinity ? `> ${formatEur(t.min)}` : `${formatEur(t.min)} – ${formatEur(t.max)}`} / part
                      </span>
                    </span>
                    <span className={t.base > 0 ? "text-white/70 font-semibold tabular-nums" : "text-white/20"}>
                      {formatEur(t.impot)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${COULEURS_TRANCHES[i] ?? "bg-white/30"}`}
                      style={{ width: `${(t.base / maxTrancheBase) * 100}%` }}
                    />
                  </div>
                  {t.base > 0 && <div className="text-[10px] text-white/25">{formatEur(t.base)} de revenu dans cette tranche</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Part liée à l'activité + application au dashboard */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex flex-col gap-2 text-xs">
              <div className="text-[10px] font-semibold text-indigo-300/60 uppercase tracking-widest">Impôt imputable à l&apos;activité</div>
              <div className="text-2xl font-black text-indigo-300">{formatEur(impotBnc)}</div>
              <div className="text-white/35">
                Différence entre l&apos;impôt du foyer avec et sans les revenus BNC
                {tauxEquivalent !== null && (
                  <> — soit <strong className="text-white/70">{formatPct(tauxEquivalent)}</strong> de la base du dashboard (CA HT − URSSAF − CFP)</>
                )}
                .
              </div>
              {tauxEquivalent !== null ? (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {modeTaux === "simule" ? (
                    <>
                      <span className="text-emerald-300">✓ Taux simulé utilisé par le dashboard</span>
                      <button
                        onClick={() => onModeTauxChange("fixe")}
                        className="text-white/30 hover:text-white/60 transition-all"
                      >
                        Revenir au taux fixe {formatPct(tauxFixe, 0)}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onModeTauxChange("simule")}
                      className="bg-indigo-500/25 border border-indigo-500/40 text-indigo-100 rounded-lg px-3 py-1.5 hover:bg-indigo-500/35 transition-all"
                    >
                      Utiliser ce taux dans le dashboard (au lieu de {formatPct(tauxFixe, 0)})
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-white/25">Coche « Utiliser le CA annuel du dashboard » pour appliquer le taux au dashboard.</div>
              )}
            </div>

            {/* Imposition commune vs séparée */}
            {gainCommun !== null ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-2 text-xs">
                <div className="text-[10px] font-semibold text-emerald-300/60 uppercase tracking-widest">Déclaration commune vs séparée</div>
                <div className="flex justify-between"><span className="text-white/40">Si chacun déclarait seul</span><span className="font-semibold">{formatEur(impotSepare ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Déclaration commune</span><span className="font-semibold">{formatEur(res.impotNet)}</span></div>
                <div className="border-t border-white/5 pt-1.5 flex justify-between items-baseline">
                  <span className="text-white/60 font-semibold">{gainCommun >= 0 ? "Économie" : "Surcoût"}</span>
                  <span className={`text-xl font-black ${gainCommun >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatEur(Math.abs(gainCommun))}</span>
                </div>
                <div className="text-[10px] text-white/25">Enfants rattachés à toi dans le cas séparé. L&apos;année du mariage/PACS, l&apos;imposition commune s&apos;applique à toute l&apos;année (option séparée possible).</div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-1 text-xs text-white/35">
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Bon à savoir</div>
                <div>Passe en « Marié · Pacsé » pour comparer avec des déclarations séparées.</div>
                <div>Le taux moyen ({formatPct(res.tauxMoyen)}) est proche du taux de prélèvement à la source du foyer.</div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-white/20">
            Simulation indicative : barème des revenus 2025 (LF 2026), en attendant la loi de finances 2027. Hors réductions/crédits d&apos;impôt,
            prélèvements sociaux et contribution différentielle sur les hauts revenus. Pour le chiffre officiel : simulateur impots.gouv.fr.
          </div>
        </div>
      </div>
    </div>
  );
}
