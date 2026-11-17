"use client";

import { useMemo, useState } from "react";
import { Card, Eyebrow, GrosChiffre, Titre } from "@/components/ui";
import { formatEur, formatPct } from "@/lib/finance";
import { PLAFOND_PEA, PS_PEA, PFU, type ParamsInterets, simulerInterets } from "@/lib/interets";
import { useStoredValue } from "@/lib/useStored";

interface Reglages extends ParamsInterets {
  etf: string;
}

const DEFAUT: Reglages = {
  etf: "",
  capitalInitial: 10000,
  dcaMensuel: 500,
  tauxAnnuel: 7,
  dureeAnnees: 20,
  fraisAnnuels: 0,
  respecterPlafond: true,
};

const ECART_SCENARIOS = 2;

function Champ({
  id, label, value, onChange, suffixe, step = 1, min = 0, max, hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffixe: string;
  step?: number;
  min?: number;
  max?: number;
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
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            onChange(isNaN(n) ? 0 : Math.max(min, max !== undefined ? Math.min(max, n) : n));
          }}
          className="min-h-10 w-full rounded-[9px] border border-line bg-bar px-3 pr-12 text-sm font-semibold outline-none transition-colors focus:border-ca"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffixe}</span>
      </div>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

function kEur(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} M€`;
  if (v >= 1000) return `${Math.round(v / 1000)} k€`;
  return `${Math.round(v)} €`;
}

export default function InteretsComposes() {
  const [stocke, setStocke] = useStoredValue<Reglages>("shine-interets-composes", DEFAUT);
  const r = useMemo(() => ({ ...DEFAUT, ...stocke }), [stocke]);
  const maj = <K extends keyof Reglages>(k: K, v: Reglages[K]) => setStocke((prev) => ({ ...DEFAUT, ...prev, [k]: v }));
  const [survol, setSurvol] = useState<number | null>(null);

  const res = useMemo(() => simulerInterets(r), [r]);
  const bas = useMemo(() => simulerInterets(r, -ECART_SCENARIOS), [r]);
  const haut = useMemo(() => simulerInterets(r, ECART_SCENARIOS), [r]);

  const anneeDepart = new Date().getFullYear();
  const n = res.points.length - 1;
  const brut = Math.max(1, haut.valeur, res.valeur) * 1.02;
  const quart = Math.pow(10, Math.floor(Math.log10(brut))) / 4;
  const maxY = Math.ceil(brut / quart) * quart;
  const x = (a: number) => (n > 0 ? (a / n) * 100 : 0);
  const y = (v: number) => 100 - (v / maxY) * 100;
  const ligne = (pts: { annee: number; v: number }[]) => pts.map((p) => `${x(p.annee).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ");

  const ptsVerse = res.points.map((p) => ({ annee: p.annee, v: p.verse }));
  const ptsValeur = res.points.map((p) => ({ annee: p.annee, v: p.valeur }));
  const aireVerse = `0,100 ${ligne(ptsVerse)} 100,100`;
  const aireInterets = `${ligne(ptsVerse)} ${ligne([...ptsValeur].reverse())}`;
  const pas = Math.max(1, Math.ceil(n / 6));
  const graduationsX = res.points.filter((p) => p.annee % pas === 0 || p.annee === n).map((p) => p.annee);

  const s = survol !== null ? res.points[survol] : null;
  const nom = r.etf.trim() || "ton ETF";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">Intérêts composés</h1>
          <div className="mt-1 text-[13px] text-muted">
            PEA investi sur {nom} · versements mensuels programmés · capitalisation mensuelle
          </div>
        </div>
        <button type="button" onClick={() => setStocke(DEFAUT)} className="text-xs text-faint hover:text-muted">
          ↺ Réinitialiser
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* ───── Paramètres ───── */}
        <Card as="form" aria-label="Paramètres de l'investissement" onSubmit={(e) => e.preventDefault()} className="box-border flex max-w-full flex-[1_1_300px] flex-col gap-4 p-5 lg:max-w-[360px]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="etf" className="text-[13px] text-muted">ETF</label>
            <input
              id="etf"
              type="text"
              value={r.etf}
              placeholder="ex. MSCI World"
              onChange={(e) => maj("etf", e.target.value)}
              className="min-h-10 w-full rounded-[9px] border border-line bg-bar px-3 text-sm font-semibold outline-none transition-colors placeholder:font-normal placeholder:text-faint focus:border-ca"
            />
          </div>
          <Champ id="capital" label="Capital de départ" value={r.capitalInitial} onChange={(v) => maj("capitalInitial", v)} suffixe="€" step={500} />
          <Champ id="dca" label="Versement mensuel (DCA)" value={r.dcaMensuel} onChange={(v) => maj("dcaMensuel", v)} suffixe="€ / mois" step={50} />

          <div className="flex flex-col gap-1.5">
            <Champ id="taux" label="Rendement annuel espéré" value={r.tauxAnnuel} onChange={(v) => maj("tauxAnnuel", v)} suffixe="% / an" step={0.1} max={30} />
            <input
              type="range"
              aria-label="Ajuster le rendement annuel"
              min={0}
              max={15}
              step={0.1}
              value={r.tauxAnnuel}
              onChange={(e) => maj("tauxAnnuel", Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Champ id="duree" label="Durée" value={r.dureeAnnees} onChange={(v) => maj("dureeAnnees", Math.round(v))} suffixe="ans" min={1} max={60} />
            <input
              type="range"
              aria-label="Ajuster la durée"
              min={1}
              max={40}
              step={1}
              value={r.dureeAnnees}
              onChange={(e) => maj("dureeAnnees", Number(e.target.value))}
            />
          </div>

          <Champ
            id="frais"
            label="Frais annuels de l'ETF (TER)"
            value={r.fraisAnnuels}
            onChange={(v) => maj("fraisAnnuels", v)}
            suffixe="% / an"
            step={0.01}
            max={5}
            hint="Facultatif : déduits chaque année du rendement"
          />

          <label className="flex cursor-pointer items-start gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={r.respecterPlafond}
              onChange={(e) => maj("respecterPlafond", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#8b93ff]"
            />
            <span>Arrêter les versements au plafond du PEA ({formatEur(PLAFOND_PEA)})</span>
          </label>
        </Card>

        {/* ───── Résultats ───── */}
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card aria-label="Résultat" className="flex flex-wrap items-center justify-between gap-5 p-6">
            <div>
              <Eyebrow>Valeur estimée en {anneeDepart + n}</Eyebrow>
              <GrosChiffre size="xl" className="mt-1 text-net">{formatEur(res.valeur)}</GrosChiffre>
              <div className="text-[13px] text-muted">
                soit {formatEur(res.valeurNette)} nets après {formatPct(res.tauxImpot)} {n >= 5 ? "de prélèvements sociaux" : "de flat tax (retrait avant 5 ans)"}
              </div>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-7 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] text-faint">Total versé</dt>
                <dd className="m-0 mt-1 font-display text-xl font-bold text-ca">{formatEur(res.verse)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Intérêts générés</dt>
                <dd className="m-0 mt-1 font-display text-xl font-bold text-net">{formatEur(res.interets)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Multiplicateur</dt>
                <dd className="m-0 mt-1 font-display text-xl font-bold">×{res.multiplicateur.toFixed(2).replace(".", ",")}</dd>
              </div>
            </dl>
          </Card>

          <Card aria-labelledby="titre-courbe" className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Titre id="titre-courbe" sub={`Fourchette : rendement de ${formatPct((r.tauxAnnuel - ECART_SCENARIOS) / 100)} à ${formatPct((r.tauxAnnuel + ECART_SCENARIOS) / 100)}`}>
                Courbe d&apos;estimation
              </Titre>
              <div className="flex flex-wrap gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-ca" />Versé</span>
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-net" />Intérêts</span>
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0 w-3.5 border-t-2 border-dashed border-muted" />±{ECART_SCENARIOS} pts</span>
              </div>
            </div>

            <div className="flex gap-3">
              <div aria-hidden="true" className="flex h-72 w-12 shrink-0 flex-col justify-between text-right text-[11px] text-faint">
                {[1, 0.75, 0.5, 0.25, 0].map((t) => <span key={t}>{kEur(maxY * t)}</span>)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div
                  role="img"
                  aria-label={`Valeur estimée : ${formatEur(res.valeur)} après ${n} ans, dont ${formatEur(res.verse)} versés. Fourchette ${formatEur(bas.valeur)} à ${formatEur(haut.valeur)}.`}
                  className="relative h-72 border-b border-l border-line-strong"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const i = Math.round(((e.clientX - rect.left) / rect.width) * n);
                    setSurvol(Math.max(0, Math.min(n, i)));
                  }}
                  onMouseLeave={() => setSurvol(null)}
                >
                  <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-dashed border-line-soft" />)}
                    <div />
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                    <polygon points={aireVerse} fill="#8B93FF" fillOpacity={0.55} />
                    <polygon points={aireInterets} fill="#3DD68C" fillOpacity={0.35} />
                    <polyline points={ligne(ptsValeur)} fill="none" stroke="#3DD68C" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                    <polyline points={ligne(haut.points.map((p) => ({ annee: p.annee, v: p.valeur })))} fill="none" stroke="#A3A8B4" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                    <polyline points={ligne(bas.points.map((p) => ({ annee: p.annee, v: p.valeur })))} fill="none" stroke="#A3A8B4" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                    {s && <line x1={x(s.annee)} x2={x(s.annee)} y1={0} y2={100} stroke="#ECEDF1" strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
                  </svg>
                  {s && (
                    <div
                      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-net"
                      style={{ left: `${x(s.annee)}%`, top: `${y(s.valeur)}%` }}
                    />
                  )}
                  {s && (
                    <div
                      className={`pointer-events-none absolute top-2 rounded-[10px] border border-line-strong bg-chip px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${
                        x(s.annee) < 25 ? "translate-x-2" : x(s.annee) > 75 ? "-translate-x-[calc(100%+8px)]" : "-translate-x-1/2"
                      }`}
                      style={{ left: `${x(s.annee)}%` }}
                    >
                      <div className="whitespace-nowrap text-muted">{anneeDepart + s.annee} · année {s.annee}</div>
                      <div className="mt-1 whitespace-nowrap font-bold text-net">{formatEur(s.valeur)}</div>
                      <div className="whitespace-nowrap text-muted">
                        versé <span className="font-semibold text-ca">{formatEur(s.verse)}</span> · intérêts <span className="font-semibold text-net">{formatEur(s.interets)}</span>
                      </div>
                      <div className="whitespace-nowrap text-faint">
                        fourchette {formatEur(bas.points[s.annee].valeur)} – {formatEur(haut.points[s.annee].valeur)}
                      </div>
                    </div>
                  )}
                </div>
                <div aria-hidden="true" className="relative h-4 text-[11px] text-faint">
                  {graduationsX.map((a) => (
                    <span
                      key={a}
                      className={`absolute ${a === 0 ? "" : a === n ? "-translate-x-full" : "hidden -translate-x-1/2 sm:inline"}`}
                      style={{ left: `${x(a)}%` }}
                    >
                      {anneeDepart + a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <Card as="article" className="flex flex-col gap-1.5 rounded-[14px] p-[18px]">
              <h3 className="m-0 text-xs font-semibold text-muted">Effet boule de neige</h3>
              <div className="font-display text-xl font-bold">
                {res.anneeBascule !== null ? `${anneeDepart + res.anneeBascule}` : "Pas sur la durée"}
              </div>
              <div className="text-xs text-muted">
                {res.anneeBascule !== null
                  ? `Après ${res.anneeBascule} ans, les intérêts cumulés dépassent ce que tu as versé.`
                  : "Les intérêts ne dépassent pas encore tes versements : allonge la durée pour voir la bascule."}
              </div>
            </Card>
            <Card as="article" className="flex flex-col gap-1.5 rounded-[14px] p-[18px]">
              <h3 className="m-0 text-xs font-semibold text-muted">Plafond du PEA</h3>
              <div className={`font-display text-xl font-bold ${res.anneePlafond !== null ? "text-ir" : ""}`}>
                {res.anneePlafond !== null ? `Atteint en ${anneeDepart + res.anneePlafond}` : `${formatEur(Math.max(0, PLAFOND_PEA - res.verse))} de marge`}
              </div>
              <div className="text-xs text-muted">
                {res.anneePlafond !== null
                  ? r.respecterPlafond
                    ? "Les versements s'arrêtent là ; le capital continue de fructifier."
                    : "Au-delà, il faudrait un compte-titres ou une assurance-vie."
                  : `Versements plafonnés à ${formatEur(PLAFOND_PEA)} ; les gains, eux, ne sont pas plafonnés.`}
              </div>
            </Card>
            <Card as="article" className="flex flex-col gap-1.5 rounded-[14px] p-[18px]">
              <h3 className="m-0 text-xs font-semibold text-muted">Fiscalité à la sortie</h3>
              <div className="font-display text-xl font-bold text-tva">−{formatEur(res.impots)}</div>
              <div className="text-xs text-muted">
                Après 5 ans : {formatPct(PS_PEA)} de prélèvements sociaux sur les gains, pas d&apos;impôt sur le revenu. Avant 5 ans : {formatPct(PFU)} et clôture du plan.
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <details>
              <summary className="cursor-pointer font-display text-[15px] font-semibold">Détail année par année</summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-faint">
                      <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Année</th>
                      <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Versé cumulé</th>
                      <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Intérêts cumulés</th>
                      <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.points.slice(1).map((p) => (
                      <tr key={p.annee} className="hover:bg-white/[0.02]">
                        <td className="border-b border-[#1b1f28] p-3 text-muted">{anneeDepart + p.annee} <span className="text-faint">· an {p.annee}</span></td>
                        <td className="border-b border-[#1b1f28] p-3 text-right">{formatEur(p.verse)}</td>
                        <td className="border-b border-[#1b1f28] p-3 text-right text-net">{formatEur(p.interets)}</td>
                        <td className="border-b border-[#1b1f28] p-3 text-right font-semibold">{formatEur(p.valeur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>

          <p className="m-0 text-[11px] text-faint">
            Estimation à rendement constant : les marchés ne progressent pas en ligne droite et les performances passées ne préjugent pas des futures.
            Montants en euros courants (non corrigés de l&apos;inflation). Ce n&apos;est pas un conseil en investissement.
          </p>
        </div>
      </div>
    </div>
  );
}
