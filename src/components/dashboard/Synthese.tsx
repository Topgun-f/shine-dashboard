"use client";

import { Card, Eyebrow, GrosChiffre, Pastille } from "@/components/ui";
import type { Agregats } from "@/lib/agregats";
import { type Calc, formatEur, formatPct } from "@/lib/finance";
import { PARAMETRES_IR_2026 } from "@/lib/impot";
import type { Vue } from "./AppHeader";

const kEur = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k€` : `${Math.round(v)} €`);

export function NetCascade({
  calc, vue, tauxIR, libelleTaux, caProjection, onCaProjection, estimation, annee,
}: {
  calc: Calc;
  vue: Vue;
  tauxIR: number;
  libelleTaux: string;
  caProjection: number;
  onCaProjection: (v: number) => void;
  estimation: number | null;
  annee: number;
}) {
  const ca = calc.caTTC;
  const pct = (v: number) => (ca > 0 ? (v / ca) * 100 : 0);
  const baseImposable = calc.caHT * (1 - PARAMETRES_IR_2026.microBnc.taux);

  // Colonnes de la cascade : [bas, hauteur] en % du CA TTC
  const colonnes = [
    { label: "CA TTC", valeur: formatEur(ca), court: kEur(ca), bas: 0, haut: 100, couleur: "#8B93FF" },
    { label: "TVA", valeur: `−${formatEur(calc.tva)}`, court: `−${kEur(calc.tva)}`, bas: pct(ca - calc.tva), haut: pct(calc.tva), couleur: "#FF7A6B" },
    { label: "URSSAF", valeur: `−${formatEur(calc.urssaf)}`, court: `−${kEur(calc.urssaf)}`, bas: pct(calc.baseIR + calc.cfp), haut: pct(calc.urssaf), couleur: "#C79BFF" },
    { label: "CFP", valeur: `−${formatEur(calc.cfp)}`, court: `−${kEur(calc.cfp)}`, bas: pct(calc.baseIR), haut: pct(calc.cfp), couleur: "#8B95A7" },
    { label: "Impôt", valeur: `−${formatEur(calc.ir)}`, court: `−${kEur(calc.ir)}`, bas: pct(calc.net), haut: pct(calc.ir), couleur: "#F5B83D" },
    { label: "Net", valeur: formatEur(calc.net), court: kEur(calc.net), bas: 0, haut: pct(calc.net), couleur: "#3DD68C" },
  ];

  return (
    <Card as="article" aria-labelledby="titre-net" className="flex flex-col gap-[18px] p-6 lg:col-span-2">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <Eyebrow id="titre-net">
            Net disponible · {vue === "encaisse" ? `encaissé à date ${annee}` : `projection ${annee}`}
          </Eyebrow>
          <GrosChiffre size="xl" className="mt-1.5 text-net">{formatEur(calc.net)}</GrosChiffre>
          <div className="text-[13px] text-muted">
            {ca > 0
              ? `${formatPct(calc.net / ca)} des ${formatEur(ca)} TTC ${vue === "encaisse" ? "encaissés depuis janvier" : "prévus sur l'année"}`
              : vue === "encaisse"
                ? "Aucun encaissement trouvé : connecte Gmail ou passe en projection annuelle"
                : "Saisis ton CA annuel prévu"}
          </div>
        </div>
        <dl className="m-0 grid grid-cols-2 content-start gap-x-7 gap-y-1.5 text-xs">
          <dt className="text-faint">CA HT</dt>
          <dd className="m-0 text-right font-semibold">{formatEur(calc.caHT)}</dd>
          <dt className="text-faint">Base imposable (−34 %)</dt>
          <dd className="m-0 text-right font-semibold">{formatEur(baseImposable)}</dd>
          <dt className="text-faint">{libelleTaux}</dt>
          <dd className="m-0 text-right font-semibold text-ir">{formatPct(tauxIR)}</dd>
        </dl>
      </div>

      {vue === "projection" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line bg-bar px-4 py-3">
          <label htmlFor="ca-projection" className="text-xs text-muted">CA annuel prévu (TTC)</label>
          <div className="relative">
            <input
              id="ca-projection"
              type="number"
              min={0}
              step={100}
              value={Math.round(caProjection)}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                onCaProjection(isNaN(n) || n < 0 ? 0 : n);
              }}
              className="w-36 rounded-lg border border-line bg-panel px-3 py-2 pr-7 text-sm font-semibold outline-none focus:border-ca"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">€</span>
          </div>
          <input
            type="range"
            aria-label="Ajuster le CA annuel prévu"
            min={0}
            max={250000}
            step={500}
            value={caProjection}
            onChange={(e) => onCaProjection(Number(e.target.value))}
            className="min-w-[160px] flex-1"
          />
          {estimation !== null && (
            <button
              type="button"
              onClick={() => onCaProjection(Math.round(estimation))}
              className="text-xs text-ca hover:text-ca-light"
            >
              Estimer depuis les factures ({formatEur(estimation)})
            </button>
          )}
        </div>
      )}

      <div
        role="img"
        aria-label={`Cascade : CA TTC ${formatEur(ca)}, TVA ${formatEur(calc.tva)}, URSSAF ${formatEur(calc.urssaf)}, CFP ${formatEur(calc.cfp)}, impôt ${formatEur(calc.ir)}, net ${formatEur(calc.net)}`}
        className="mt-4 grid grid-cols-6 items-end gap-2 sm:gap-3.5"
      >
        {colonnes.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-2">
            <div className="relative h-[210px] border-b border-line-strong">
              <div
                className="absolute inset-x-0 min-h-[3px] rounded-md transition-all duration-500"
                style={{ bottom: `${c.bas}%`, height: `${c.haut}%`, background: c.couleur }}
              />
              <div
                className="absolute inset-x-0 whitespace-nowrap pb-1.5 text-center text-[10px] font-semibold sm:text-xs"
                style={{ bottom: `${c.bas + c.haut}%`, color: c.couleur }}
              >
                <span className="hidden sm:inline">{c.valeur}</span>
                <span className="sm:hidden">{c.court}</span>
              </div>
            </div>
            <div className="text-center text-[11px] text-muted sm:text-xs">{c.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Reserve({ ag, tauxIR, annee }: { ag: Agregats; tauxIR: number; annee: number }) {
  const total = ag.tvaDue + ag.urssafDue + ag.irAnnee;
  const lignes = [
    { couleur: "bg-tva", label: "TVA à reverser", sub: "encaissée, pas encore déclarée", montant: ag.tvaDue },
    { couleur: "bg-urssaf", label: "URSSAF + CFP", sub: "sur les encaissements à déclarer", montant: ag.urssafDue },
    {
      couleur: "bg-ir",
      label: `Provision impôt ${annee}`,
      sub: `${formatPct(tauxIR)} de la base · dont ${formatEur(ag.irVire)} déjà virés`,
      montant: ag.irAnnee,
    },
  ];
  return (
    <Card as="article" aria-labelledby="titre-reserve" className="flex flex-col gap-4 p-6">
      <div>
        <Eyebrow id="titre-reserve">À garder sur Shine</Eyebrow>
        <GrosChiffre className="mt-1.5">{formatEur(total)}</GrosChiffre>
        <div className="text-[13px] text-muted">Ce qui n&apos;est pas à toi : impôts et cotisations à venir</div>
      </div>
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line-soft">
        {total > 0 && lignes.map((l) => (
          <div key={l.label} className={l.couleur} style={{ width: `${(l.montant / total) * 100}%` }} />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lignes.map((l) => (
          <li key={l.label} className="flex items-center gap-2.5">
            <Pastille className={l.couleur} />
            <span className="flex-1 text-muted">
              {l.label}
              <span className="block text-[11px] text-faint">{l.sub}</span>
            </span>
            <span className="font-semibold">{formatEur(l.montant)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-[10px] border border-[#1d3a2a] bg-[#0f1a14] px-3.5 py-3 text-xs text-[#9fe3bf]">
        Astuce : crée une poche Shine « Impôts » et vire-y la provision à chaque encaissement.
      </div>
    </Card>
  );
}
