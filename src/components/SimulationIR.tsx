"use client";

import { Card, Eyebrow, GrosChiffre, Segmented, Titre } from "@/components/ui";
import {
  CFP_RATE,
  type FactureInfo,
  MOIS_NOMS_LONG,
  TAUX_IR_FIXE,
  URSSAF_RATE,
  cleDeclaration,
  computeCalc,
  formatEur,
  formatPct,
  idxMois,
  moisCourant,
} from "@/lib/finance";
import { PARAMETRES_IR_2026 } from "@/lib/impot";
import { REGLAGES_IR_DEFAUT, type ReglagesIR, type SimulationDashboard } from "@/lib/reglagesIR";

const COULEURS_TRANCHES = ["#3A4050", "#7FB2FF", "#8B93FF", "#F5B83D", "#FF7A6B"];

function ChampEuro({
  id, label, value, onChange, hint, disabled,
}: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={0}
          step={100}
          value={Number.isFinite(value) ? Math.round(value) : 0}
          disabled={disabled}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            onChange(isNaN(n) ? 0 : n);
          }}
          className="min-h-10 w-full rounded-[9px] border border-line bg-bar px-3 pr-7 text-sm font-semibold outline-none transition-colors focus:border-ca disabled:opacity-60"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">€</span>
      </div>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

function Legende({ children }: { children: React.ReactNode }) {
  return <legend className="mb-2 p-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{children}</legend>;
}

function Ligne({ label, value, cls = "", fort }: { label: string; value: string; cls?: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={fort ? "font-semibold text-txt" : "text-muted"}>{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

export default function SimulationIR({
  r, setR, sim, caTTC, caHT, baseDashboard, annee, modeTaux, onModeTaux, encaisseesAnnee, toutesAnnee, faits, basculer,
}: {
  r: ReglagesIR;
  setR: (fn: (prev: ReglagesIR) => ReglagesIR) => void;
  sim: SimulationDashboard;
  caTTC: number;
  caHT: number;
  baseDashboard: number;
  annee: number;
  modeTaux: "fixe" | "simule";
  onModeTaux: (m: "fixe" | "simule") => void;
  encaisseesAnnee: FactureInfo[];
  toutesAnnee: FactureInfo[];
  faits: Set<string>;
  basculer: (cle: string) => void;
}) {
  const maj = <K extends keyof ReglagesIR>(k: K, v: ReglagesIR[K]) => setR((prev) => ({ ...prev, [k]: v }));
  const { res, impotBnc, impotSepare, tauxEquivalent } = sim;

  const tauxPourProvision = modeTaux === "simule" && tauxEquivalent !== null ? tauxEquivalent : TAUX_IR_FIXE;
  const irFixe = baseDashboard * TAUX_IR_FIXE;
  const tranchesActives = res.detailTranches.filter((t) => t.base > 0);
  const totalBase = Math.max(1, tranchesActives.reduce((s, t) => s + t.base, 0));
  const partImposable = r.regimeBnc === "micro" ? 1 - PARAMETRES_IR_2026.microBnc.taux : 1 - URSSAF_RATE - CFP_RATE;
  const coutMarginal = URSSAF_RATE + CFP_RATE + res.tmi * partImposable;
  const gainCommun = impotSepare !== null ? impotSepare - res.impotNet : null;

  const iNow = idxMois(moisCourant());
  const encaissees = new Set(encaisseesAnnee.map((f) => f.id));
  const provisions = [...toutesAnnee]
    .filter((f) => f.montantTTC)
    .sort((a, b) => idxMois(a.encaissement) - idxMois(b.encaissement))
    .map((f) => {
      const cle = cleDeclaration(f.facture, "ir");
      return {
        f,
        cle,
        fait: faits.has(cle),
        ir: computeCalc(f.montantTTC ?? 0, tauxPourProvision).ir,
        aVenir: !encaissees.has(f.id) && idxMois(f.encaissement) > iNow,
      };
    });
  const provisionne = provisions.filter((p) => p.fait && !p.aVenir).reduce((s, p) => s + p.ir, 0);
  const resteAVirer = provisions.filter((p) => !p.fait && !p.aVenir).reduce((s, p) => s + p.ir, 0);

  const stats = [
    { label: "Taux moyen", value: formatPct(res.tauxMoyen) },
    { label: "TMI", value: formatPct(res.tmi, 0) },
    { label: "Parts", value: res.parts.toString().replace(".", ",") },
    { label: "Taux dashboard", value: tauxEquivalent !== null ? formatPct(tauxEquivalent) : "—" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">Impôt sur le revenu {annee}</h1>
          <div className="mt-1 text-[13px] text-muted">
            {PARAMETRES_IR_2026.label} · projection sur {formatEur(caTTC)} TTC ({formatEur(caHT)} HT)
          </div>
        </div>
        <button type="button" onClick={() => setR(() => REGLAGES_IR_DEFAUT)} className="text-xs text-faint hover:text-muted">
          ↺ Réinitialiser le foyer
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* ───── Foyer ───── */}
        <Card as="form" aria-label="Ton foyer fiscal" onSubmit={(e) => e.preventDefault()} className="box-border flex max-w-full flex-[1_1_300px] flex-col gap-[18px] p-5 lg:max-w-[360px]">
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <Legende>Foyer</Legende>
            <Segmented
              label="Situation"
              size="md"
              value={r.situation}
              onChange={(v) => maj("situation", v)}
              options={[{ value: "seul", label: "Célibataire" }, { value: "couple", label: "Marié · Pacsé" }]}
            />
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted" id="label-enfants">Enfants à charge</span>
              <div className="flex items-center gap-1" role="group" aria-labelledby="label-enfants">
                <button type="button" aria-label="Retirer un enfant" onClick={() => maj("enfants", Math.max(0, r.enfants - 1))}
                  className="h-9 w-9 rounded-[9px] border border-line-strong bg-panel-2 text-base hover:bg-chip">−</button>
                <span className="w-7 text-center font-bold" aria-live="polite">{r.enfants}</span>
                <button type="button" aria-label="Ajouter un enfant" onClick={() => maj("enfants", Math.min(10, r.enfants + 1))}
                  className="h-9 w-9 rounded-[9px] border border-line-strong bg-panel-2 text-base hover:bg-chip">+</button>
              </div>
            </div>
            {r.situation === "seul" && r.enfants > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={r.parentIsole} onChange={(e) => maj("parentIsole", e.target.checked)} className="h-4 w-4 accent-[#8b93ff]" />
                Parent isolé (case T)
              </label>
            )}
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <Legende>Activité</Legende>
            <Segmented
              label="Régime"
              size="md"
              value={r.regimeBnc}
              onChange={(v) => maj("regimeBnc", v)}
              options={[{ value: "micro", label: "Micro-BNC" }, { value: "reel", label: "Réel (2035)" }]}
            />
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={r.lieAuDashboard}
                onChange={(e) => {
                  const lie = e.target.checked;
                  setR((prev) => ({ ...prev, lieAuDashboard: lie, montantBncManuel: lie ? prev.montantBncManuel : Math.round(sim.montantBncLie) }));
                }}
                className="h-4 w-4 accent-[#8b93ff]"
              />
              Lier au CA annuel prévu
            </label>
            <ChampEuro
              id="montant-bnc"
              label={r.regimeBnc === "micro" ? "Recettes HT de l'année" : "Bénéfice BNC (recettes − charges)"}
              value={sim.montantBnc}
              disabled={r.lieAuDashboard}
              onChange={(v) => maj("montantBncManuel", v)}
              hint={r.lieAuDashboard ? (r.regimeBnc === "micro" ? "Abattement forfaitaire de 34 % (min. 305 €)" : "CA HT − URSSAF − CFP (autres frais non déduits)") : undefined}
            />
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <Legende>Autres revenus et déductions</Legende>
            <ChampEuro id="sal1" label="Tes salaires nets imposables" value={r.salaires1} onChange={(v) => maj("salaires1", v)} />
            {r.situation === "couple" && (
              <ChampEuro id="sal2" label="Salaires nets imposables du / de la conjoint·e" value={r.salaires2} onChange={(v) => maj("salaires2", v)} hint="Abattement 10 % appliqué automatiquement" />
            )}
            <ChampEuro id="autres" label="Autres revenus nets imposables" value={r.autresRevenus} onChange={(v) => maj("autresRevenus", v)} hint="Fonciers, pensions… déjà nets d'abattements" />
            <ChampEuro id="per" label="Charges déductibles (PER, pension alimentaire…)" value={r.chargesDeductibles} onChange={(v) => maj("chargesDeductibles", v)} />
          </fieldset>
        </Card>

        {/* ───── Résultats ───── */}
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card aria-label="Résultat" className="flex flex-wrap items-center justify-between gap-5 p-6">
            <div>
              <Eyebrow>Impôt net du foyer</Eyebrow>
              <GrosChiffre size="xl" className="mt-1 text-ir">{formatEur(res.impotNet)}</GrosChiffre>
              <div className="text-[13px] text-muted">soit {formatEur(res.impotNet / 12)} par mois</div>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-7 gap-y-3 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-[11px] text-faint">{s.label}</dt>
                  <dd className="m-0 mt-1 font-display text-xl font-bold">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {res.depassementPlafondMicro && (
            <div className="rounded-xl border border-[#4a3512] bg-[#21190b] px-4 py-3 text-xs text-[#ffd98a]">
              Recettes au-dessus du plafond micro-BNC ({formatEur(PARAMETRES_IR_2026.microBnc.plafond)}, proratisé l&apos;année de création).
              Le régime micro reste applicable tant que le plafond n&apos;est pas dépassé deux années consécutives ; au-delà, passage en déclaration contrôlée.
            </div>
          )}

          <Card aria-labelledby="titre-bareme" className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap justify-between gap-2">
              <Titre id="titre-bareme">Ton revenu dans le barème</Titre>
              <span className="text-xs text-muted">
                Revenu net imposable {formatEur(res.revenuImposable)} · {res.parts.toString().replace(".", ",")} part{res.parts > 1 ? "s" : ""}
              </span>
            </div>
            <div
              role="img"
              aria-label={`Revenu réparti : ${tranchesActives.map((t) => `${formatEur(t.base)} à ${formatPct(t.taux, 0)}`).join(", ")}`}
              className="flex h-11 gap-0.5 overflow-hidden rounded-[10px] bg-line-soft"
            >
              {tranchesActives.map((t) => {
                const i = res.detailTranches.indexOf(t);
                const w = (t.base / totalBase) * 100;
                return (
                  <div
                    key={t.taux}
                    className="flex min-w-1 items-center justify-center text-xs font-bold text-ink transition-all duration-500"
                    style={{ width: `${w}%`, background: COULEURS_TRANCHES[i] }}
                  >
                    {w > 6 ? formatPct(t.taux, 0) : ""}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              {res.detailTranches.map((t, i) => (
                <div key={t.taux} className={`flex items-start gap-2.5 ${t.base > 0 ? "" : "opacity-40"}`}>
                  <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: COULEURS_TRANCHES[i] }} />
                  <div>
                    <div className="text-xs text-muted">Tranche {formatPct(t.taux, 0)}</div>
                    <div className="font-bold">{formatEur(t.impot)}</div>
                    <div className="text-[11px] text-faint">sur {formatEur(t.base)}</div>
                  </div>
                </div>
              ))}
            </div>
            <details className="rounded-xl border border-line bg-bar px-4 py-3 text-xs">
              <summary className="cursor-pointer text-muted">Détail du calcul</summary>
              <div className="mt-3 flex flex-col gap-1.5">
                <Ligne label={r.regimeBnc === "micro" ? "BNC après abattement 34 %" : "Bénéfice BNC"} value={formatEur(res.bncImposable)} />
                {res.salairesNets > 0 && <Ligne label="Salaires après 10 %" value={formatEur(res.salairesNets)} />}
                {r.autresRevenus > 0 && <Ligne label="Autres revenus" value={formatEur(r.autresRevenus)} />}
                {r.chargesDeductibles > 0 && <Ligne label="Charges déductibles" value={`− ${formatEur(r.chargesDeductibles)}`} cls="text-net" />}
                <Ligne label="Revenu net imposable" value={formatEur(res.revenuImposable)} fort />
                <Ligne label={`Quotient familial (÷ ${res.parts.toString().replace(".", ",")})`} value={formatEur(res.quotient)} />
                <Ligne label="Impôt brut (barème)" value={formatEur(res.impotAvantPlafond)} />
                {res.plafonnementQF > 0 && <Ligne label="Plafonnement du quotient familial" value={`+ ${formatEur(res.plafonnementQF)}`} cls="text-tva" />}
                {res.decote > 0 && <Ligne label="Décote" value={`− ${formatEur(res.decote)}`} cls="text-net" />}
                {res.cehr > 0 && <Ligne label="Contribution hauts revenus" value={`+ ${formatEur(res.cehr)}`} cls="text-tva" />}
                <Ligne label="Impôt net" value={formatEur(res.impotNet)} cls="text-ir" fort />
              </div>
            </details>
            <div className="text-xs text-muted">
              Chaque euro de CA HT supplémentaire te coûte <strong className="text-txt">≈ {Math.round(coutMarginal * 100)} centimes</strong>{" "}
              (URSSAF + CFP {formatPct(URSSAF_RATE + CFP_RATE)} et IR {formatPct(res.tmi, 0)} sur {Math.round(partImposable * 100)} %).
            </div>
          </Card>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            <Card aria-labelledby="titre-taux" className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <Titre id="titre-taux">Taux du dashboard</Titre>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={modeTaux === "simule"}
                    disabled={tauxEquivalent === null}
                    onChange={(e) => onModeTaux(e.target.checked ? "simule" : "fixe")}
                    className="h-[18px] w-[18px] accent-[#3dd68c]"
                  />
                  Taux simulé
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className={`rounded-[10px] border p-3 ${modeTaux === "fixe" ? "border-line-strong bg-panel-2" : "border-line bg-bar"}`}>
                  <div className="text-[11px] text-faint">Fixe {formatPct(TAUX_IR_FIXE, 0)}</div>
                  <div className={`mt-0.5 text-lg font-bold ${modeTaux === "simule" ? "text-faint line-through" : ""}`}>{formatEur(irFixe)}</div>
                </div>
                <div className={`rounded-[10px] border p-3 ${modeTaux === "simule" ? "border-[#1d3a2a] bg-[#0f1a14]" : "border-line bg-bar"}`}>
                  <div className="text-[11px] text-[#9fe3bf]">Simulé {tauxEquivalent !== null ? formatPct(tauxEquivalent) : "—"}</div>
                  <div className={`mt-0.5 text-lg font-bold ${modeTaux === "simule" ? "text-net" : "text-muted"}`}>{formatEur(impotBnc)}</div>
                </div>
              </div>
              <div className="text-xs text-muted">
                {tauxEquivalent === null
                  ? "Lie la simulation au CA annuel prévu pour pouvoir appliquer le taux."
                  : irFixe >= impotBnc
                    ? `${formatEur(irFixe - impotBnc)} de moins à bloquer sur l'année avec le taux simulé.`
                    : `Le taux simulé demande ${formatEur(impotBnc - irFixe)} de plus que les 24 % fixes.`}
              </div>
            </Card>

            <Card aria-labelledby="titre-couple" className="flex flex-col gap-3 p-5">
              <Titre id="titre-couple">Et en couple ?</Titre>
              {gainCommun !== null ? (
                <>
                  <div className="flex flex-col gap-1.5 text-[13px]">
                    <Ligne label="Deux déclarations séparées" value={formatEur(impotSepare ?? 0)} />
                    <Ligne label="Déclaration commune" value={formatEur(res.impotNet)} />
                  </div>
                  <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                    <span className="font-semibold">{gainCommun >= 0 ? "Économie" : "Surcoût"}</span>
                    <span className={`font-display text-[22px] font-bold ${gainCommun >= 0 ? "text-net" : "text-tva"}`}>{formatEur(Math.abs(gainCommun))}</span>
                  </div>
                  <div className="text-[11px] text-faint">
                    Enfants rattachés à toi dans le cas séparé. L&apos;année du mariage ou du PACS, l&apos;imposition commune vaut pour toute l&apos;année (option séparée possible).
                  </div>
                </>
              ) : (
                <div className="text-[13px] text-muted">
                  Passe en « Marié · Pacsé » et renseigne les salaires de ton / ta conjoint·e pour comparer déclaration commune et séparée.
                </div>
              )}
            </Card>
          </div>

          <Card aria-labelledby="titre-prov" className="flex flex-col gap-3.5 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Titre id="titre-prov" sub={`Taux ${formatPct(tauxPourProvision)} · par mois d'encaissement`}>Provision mois par mois</Titre>
              <span className="text-xs text-muted">Coche quand le virement vers la poche Impôts est fait</span>
            </div>
            {provisions.length === 0 ? (
              <div className="py-4 text-center text-sm text-faint">Aucune facture encaissée en {annee} pour l&apos;instant</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
                {provisions.map((p) => (
                  <label
                    key={p.cle}
                    className={`flex flex-col gap-1.5 rounded-xl border p-3 transition-colors ${
                      p.aVenir ? "cursor-default border-dashed border-line opacity-60" : p.fait ? "cursor-pointer border-[#3a2e14] bg-[#191710]" : "cursor-pointer border-line bg-panel hover:bg-panel-2"
                    }`}
                  >
                    <span className="flex items-center justify-between text-xs text-muted">
                      {MOIS_NOMS_LONG[p.f.encaissement.mois]}
                      <input
                        type="checkbox"
                        checked={p.fait}
                        disabled={p.aVenir}
                        onChange={() => basculer(p.cle)}
                        className="m-0 h-4 w-4 accent-[#f5b83d]"
                      />
                    </span>
                    <span className={`text-base font-bold ${p.fait ? "text-ir" : ""}`}>{formatEur(p.ir)}</span>
                    <span className="text-[11px] text-faint">{p.aVenir ? "à venir" : `CA ${formatEur(p.f.montantTTC ?? 0)}`}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
              <span className="text-muted">Provisionné : <strong className="text-txt">{formatEur(provisionne)}</strong></span>
              <span className="text-muted">Reste à virer : <strong className="text-ir">{formatEur(resteAVirer)}</strong></span>
            </div>
          </Card>

          <p className="m-0 text-[11px] text-faint">
            Simulation indicative : barème des revenus 2025 (LF 2026), en attendant la loi de finances 2027. Hors réductions et crédits d&apos;impôt,
            prélèvements sociaux et contribution différentielle sur les hauts revenus. Pour le chiffre officiel : simulateur impots.gouv.fr.
          </p>
        </div>
      </div>
    </div>
  );
}
