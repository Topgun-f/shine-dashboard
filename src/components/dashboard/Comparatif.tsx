"use client";

import { useMemo } from "react";
import { Card, Titre } from "@/components/ui";
import {
  PARAMS_COMPARATIF_DEFAUT,
  type ParamsComparatif,
  type ResultatStatut,
  comparerStatuts,
} from "@/lib/comparatif";
import { formatEur, formatPct } from "@/lib/finance";
import type { ReglagesIR } from "@/lib/reglagesIR";
import { useStoredValue } from "@/lib/useStored";

interface Reglages extends ParamsComparatif {
  lieAuDashboard: boolean;
}

const DEFAUT: Reglages = { ...PARAMS_COMPARATIF_DEFAUT, lieAuDashboard: true };

const SEGMENTS: { cle: keyof ResultatStatut | "prelevements"; label: string; couleur: string }[] = [
  { cle: "fraisGestion", label: "Frais", couleur: "#5B6272" },
  { cle: "cotisations", label: "Cotisations", couleur: "#C79BFF" },
  { cle: "is", label: "IS", couleur: "#FF7A6B" },
  { cle: "prelevements", label: "IR + flat tax", couleur: "#F5B83D" },
  { cle: "netEnPoche", label: "Net en poche", couleur: "#3DD68C" },
  { cle: "tresorerie", label: "Gardé en société", couleur: "#8B93FF" },
];

function valeurSegment(s: ResultatStatut, cle: (typeof SEGMENTS)[number]["cle"]): number {
  if (cle === "prelevements") return s.ir + s.prelevementsDividendes;
  return Math.max(0, s[cle] as number);
}

function ChampNombre({
  id, label, value, onChange, suffixe, step = 100, min = 0, max, disabled, hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffixe: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            onChange(isNaN(n) ? 0 : Math.max(min, max !== undefined ? Math.min(max, n) : n));
          }}
          className="min-h-10 w-full rounded-[9px] border border-line bg-bar px-3 pr-12 text-sm font-semibold outline-none transition-colors focus:border-ca disabled:opacity-60"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffixe}</span>
      </div>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

export default function Comparatif({ caHTDashboard, foyer }: { caHTDashboard: number; foyer: ReglagesIR }) {
  const [stocke, setStocke] = useStoredValue<Reglages>("shine-comparatif", DEFAUT);
  const r = useMemo(() => ({ ...DEFAUT, ...stocke }), [stocke]);
  const maj = <K extends keyof Reglages>(k: K, v: Reglages[K]) => setStocke((prev) => ({ ...DEFAUT, ...prev, [k]: v }));

  const caHT = r.lieAuDashboard ? Math.round(caHTDashboard) : r.caHT;
  const statuts = useMemo(() => comparerStatuts({ ...r, caHT }, foyer), [r, caHT, foyer]);

  const meilleurNet = statuts.reduce((m, s) => (s.netEnPoche > m.netEnPoche ? s : m), statuts[0]);
  const meilleurTotal = statuts.reduce((m, s) => (s.netEnPoche + s.tresorerie > m.netEnPoche + m.tresorerie ? s : m), statuts[0]);
  const avecSociete = statuts.some((s) => s.tresorerie > 0);
  const foyerLibelle = `${foyer.situation === "couple" ? "marié·e / pacsé·e" : "célibataire"}${foyer.enfants > 0 ? `, ${foyer.enfants} enfant${foyer.enfants > 1 ? "s" : ""}` : ""}${foyer.situation === "couple" && foyer.salaires2 > 0 ? `, conjoint·e à ${formatEur(foyer.salaires2)}` : ""}`;

  const lignes: { label: string; valeur: (s: ResultatStatut) => string; cls?: string; fort?: boolean }[] = [
    { label: "Frais (pro, comptable, portage)", valeur: (s) => formatEur(s.fraisGestion) },
    { label: "Cotisations sociales", valeur: (s) => formatEur(s.cotisations), cls: "text-urssaf" },
    { label: "Impôt sur les sociétés", valeur: (s) => (s.is > 0 ? formatEur(s.is) : "—"), cls: "text-tva" },
    { label: "Rémunération nette", valeur: (s) => formatEur(s.remunerationNette) },
    { label: "Dividendes versés", valeur: (s) => (s.dividendes > 0 ? formatEur(s.dividendes) : "—") },
    { label: "Impôt sur le revenu (part activité)", valeur: (s) => formatEur(s.ir), cls: "text-ir" },
    { label: "Flat tax / prélèvements sur dividendes", valeur: (s) => (s.prelevementsDividendes > 0 ? formatEur(s.prelevementsDividendes) : "—"), cls: "text-ir" },
    { label: "Net en poche", valeur: (s) => formatEur(s.netEnPoche), cls: "text-net", fort: true },
    { label: "Gardé dans la société (après IS)", valeur: (s) => (s.tresorerie > 0 ? formatEur(s.tresorerie) : "—"), cls: "text-ca" },
    { label: "Taux de prélèvement global", valeur: (s) => formatPct(caHT > 0 ? (s.cotisations + s.is + s.ir + s.prelevementsDividendes) / caHT : 0, 0) },
    { label: "Net en poche / mois", valeur: (s) => formatEur(s.netEnPoche / 12) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">Comparatif des statuts</h1>
          <div className="mt-1 text-[13px] text-muted">
            Ce qu&apos;il te reste sur {formatEur(caHT)} HT selon le statut · foyer fiscal : {foyerLibelle} (onglet Impôts)
          </div>
        </div>
        <button type="button" onClick={() => setStocke(DEFAUT)} className="text-xs text-faint hover:text-muted">
          ↺ Réinitialiser
        </button>
      </div>

      {/* ───── Paramètres ───── */}
      <Card as="form" aria-label="Paramètres de la comparaison" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <div className="flex flex-col gap-1.5">
            <ChampNombre id="cmp-ca" label="Chiffre d'affaires HT annuel" value={caHT} onChange={(v) => maj("caHT", v)} suffixe="€" step={1000} disabled={r.lieAuDashboard} />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={r.lieAuDashboard}
                onChange={(e) => setStocke((prev) => ({ ...DEFAUT, ...prev, lieAuDashboard: e.target.checked, caHT: Math.round(caHTDashboard) }))}
                className="h-4 w-4 accent-[#8b93ff]"
              />
              Lier au CA annuel prévu
            </label>
          </div>
          <ChampNombre id="cmp-frais" label="Frais professionnels réels / an" value={r.fraisPro} onChange={(v) => maj("fraisPro", v)} suffixe="€" hint="Matériel, logiciels, déplacements…" />
          <div className="flex flex-col gap-1.5">
            <ChampNombre
              id="cmp-rem"
              label="Rémunération du dirigeant (coût société)"
              value={r.remuneration}
              onChange={(v) => maj("remuneration", v)}
              suffixe="€ / an"
              step={1000}
              hint="EURL à l'IS et SASU"
            />
            <input
              type="range"
              aria-label="Ajuster la rémunération du dirigeant"
              min={0}
              max={Math.max(10000, Math.round(caHT))}
              step={1000}
              value={r.remuneration}
              onChange={(e) => maj("remuneration", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ChampNombre
              id="cmp-div"
              label="Bénéfice versé en dividendes"
              value={Math.round(r.partDividendes * 100)}
              onChange={(v) => maj("partDividendes", v / 100)}
              suffixe="%"
              step={5}
              max={100}
              hint="Le reste est gardé dans la société"
            />
            <input
              type="range"
              aria-label="Ajuster la part distribuée en dividendes"
              min={0}
              max={100}
              step={5}
              value={Math.round(r.partDividendes * 100)}
              onChange={(e) => maj("partDividendes", Number(e.target.value) / 100)}
            />
          </div>
        </div>
        <details className="rounded-xl border border-line bg-bar px-4 py-3">
          <summary className="cursor-pointer text-xs text-muted">Hypothèses (comptable, capital, portage)</summary>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            <ChampNombre id="cmp-cpt-ei" label="Comptable EI au réel" value={r.comptaEI} onChange={(v) => maj("comptaEI", v)} suffixe="€ / an" />
            <ChampNombre id="cmp-cpt-eurl" label="Comptable EURL" value={r.comptaEURL} onChange={(v) => maj("comptaEURL", v)} suffixe="€ / an" />
            <ChampNombre id="cmp-cpt-sasu" label="Comptable SASU (avec paie)" value={r.comptaSASU} onChange={(v) => maj("comptaSASU", v)} suffixe="€ / an" />
            <ChampNombre id="cmp-capital" label="Capital de l'EURL" value={r.capitalEURL} onChange={(v) => maj("capitalEURL", v)} suffixe="€" />
            <ChampNombre id="cmp-portage" label="Frais de gestion portage" value={Math.round(r.fraisPortage * 1000) / 10} onChange={(v) => maj("fraisPortage", v / 100)} suffixe="%" step={0.5} max={30} />
          </div>
        </details>
      </Card>

      {/* ───── Où va ton CA ───── */}
      <Card aria-labelledby="titre-repartition" className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Titre id="titre-repartition" sub="Répartition de ton CA HT, du plus au moins favorable pour ce qui arrive sur ton compte">
            Où va ton chiffre d&apos;affaires
          </Titre>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            {SEGMENTS.map((sg) => (
              <span key={sg.cle} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: sg.couleur }} />
                {sg.label}
              </span>
            ))}
          </div>
        </div>

        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {[...statuts].sort((a, b) => b.netEnPoche - a.netEnPoche).map((s) => {
            const total = Math.max(1, SEGMENTS.reduce((t, sg) => t + valeurSegment(s, sg.cle), 0));
            const estMeilleurNet = s.id === meilleurNet.id;
            const estMeilleurTotal = avecSociete && s.id === meilleurTotal.id;
            return (
              <li key={s.id} className="grid grid-cols-1 items-center gap-x-5 gap-y-2 md:grid-cols-[190px_minmax(0,1fr)_200px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.nom}
                    {estMeilleurNet && <span className="rounded-full bg-[#13291e] px-2 py-0.5 text-[10px] font-semibold text-[#8be6b5]">+ de net</span>}
                    {estMeilleurTotal && !estMeilleurNet && <span className="rounded-full bg-[#1b2240] px-2 py-0.5 text-[10px] font-semibold text-[#b7bcff]">+ de patrimoine</span>}
                  </div>
                  <div className="text-xs text-faint">{s.sousTitre}</div>
                </div>
                <div
                  role="img"
                  aria-label={`${s.nom} : ${SEGMENTS.map((sg) => `${sg.label} ${formatEur(valeurSegment(s, sg.cle))}`).join(", ")}`}
                  className="flex h-7 gap-0.5 overflow-hidden rounded-lg bg-line-soft"
                >
                  {SEGMENTS.map((sg) => {
                    const v = valeurSegment(s, sg.cle);
                    if (v <= 0) return null;
                    const w = (v / total) * 100;
                    return (
                      <div
                        key={sg.cle}
                        title={`${sg.label} : ${formatEur(v)}`}
                        className="flex items-center justify-center overflow-hidden text-[11px] font-bold text-ink transition-all duration-500"
                        style={{ width: `${w}%`, background: sg.couleur }}
                      >
                        {w > 9 ? formatPct(v / total, 0) : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="md:text-right">
                  <div className={`font-display text-xl font-bold ${estMeilleurNet ? "text-net" : ""}`}>{formatEur(s.netEnPoche)}</div>
                  <div className="text-xs text-faint">
                    {s.tresorerie > 0 ? <>net en poche + <span className="text-ca">{formatEur(s.tresorerie)}</span> en société</> : "net en poche / an"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ───── Tableau détaillé ───── */}
      <Card aria-labelledby="titre-detail-statuts" className="flex flex-col gap-3.5 p-6">
        <Titre id="titre-detail-statuts">Détail par statut</Titre>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-faint">
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold" />
                {statuts.map((s) => (
                  <th key={s.id} scope="col" className={`border-b border-line px-3 py-2.5 text-right font-semibold ${s.id === meilleurNet.id ? "text-net" : ""}`}>
                    {s.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.label} className={l.fort ? "bg-[#0f1612]" : "hover:bg-white/[0.02]"}>
                  <th scope="row" className={`border-b border-[#1b1f28] p-3 text-left font-normal ${l.fort ? "font-semibold text-txt" : "text-muted"}`}>{l.label}</th>
                  {statuts.map((s) => (
                    <td key={s.id} className={`border-b border-[#1b1f28] p-3 text-right ${l.fort ? "font-bold" : ""} ${l.cls ?? ""}`}>{l.valeur(s)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="border-b border-[#1b1f28] p-3 text-left font-normal text-muted">Protection sociale</th>
                {statuts.map((s) => <td key={s.id} className="border-b border-[#1b1f28] p-3 text-right text-xs text-muted">{s.protection}</td>)}
              </tr>
              <tr>
                <th scope="row" className="border-b border-[#1b1f28] p-3 text-left font-normal text-muted">Gestion</th>
                {statuts.map((s) => <td key={s.id} className="border-b border-[#1b1f28] p-3 text-right text-xs text-muted">{s.gestion}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        {statuts.some((s) => s.alerte) && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {statuts.filter((s) => s.alerte).map((s) => (
              <li key={s.id} className="rounded-lg border border-[#4a3512] bg-[#21190b] px-3 py-2 text-xs text-[#ffd98a]">
                <strong>{s.nom}</strong> : {s.alerte}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-5 text-xs text-muted">
        <div className="font-display text-[15px] font-semibold text-txt">Comment lire la comparaison</div>
        <p className="m-0">
          <strong className="text-txt">Net en poche</strong> : ce qui arrive sur ton compte perso après cotisations, impôts et frais.{" "}
          <strong className="text-txt">Gardé en société</strong> : bénéfice laissé dans l&apos;EURL ou la SASU après impôt sur les sociétés ; il reste à toi, mais sera taxé s&apos;il est sorti plus tard en dividendes.
        </p>
        <p className="m-0">
          En EURL à l&apos;IS, les dividendes au-delà de 10 % du capital supportent les cotisations TNS ; en SASU, seulement la flat tax de 31,4 %, mais un salaire y coûte plus cher. Joue avec la rémunération et la part de dividendes pour trouver le bon dosage.
        </p>
        <p className="m-0 text-faint">
          Hypothèses 2026 : cotisations TNS avec abattement de 26 % (PASS 48 060 €), président de SASU sans assurance chômage (≈ 41 % patronales, 21 % salariales), salarié porté ≈ 45 % / 22,5 %, IS 15 % jusqu&apos;à 42 500 € puis 25 %, flat tax 31,4 %, IR au barème 2026 du foyer. Ordres de grandeur : à valider avec un expert-comptable avant de changer de statut.
        </p>
      </Card>
    </div>
  );
}
