"use client";

import { Card, GrosChiffre } from "@/components/ui";
import type { Agregats } from "@/lib/agregats";
import {
  MOIS_NOMS_LONG,
  PLAFOND_MICRO_BNC,
  TAUX_IR_FIXE,
  TVA_RATE,
  type Calc,
  formatEur,
  formatPct,
} from "@/lib/finance";

function Tuile({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Card as="article" className="flex flex-col gap-2.5 rounded-[14px] p-[18px]">
      <h3 className="m-0 text-xs font-semibold text-muted">{titre}</h3>
      {children}
    </Card>
  );
}

export default function Indicateurs({
  ag, annee, calc, tauxIR, tauxSimuleActif, onOuvrirImpots,
}: {
  ag: Agregats;
  annee: number;
  calc: Calc;
  tauxIR: number;
  tauxSimuleActif: boolean;
  onOuvrirImpots: () => void;
}) {
  const max = Math.max(...ag.mensuel, ...ag.prevu, 1);
  const caHT = ag.caADate / (1 + TVA_RATE);
  const ratioPlafond = caHT / PLAFOND_MICRO_BNC;
  const echelle = Math.max(PLAFOND_MICRO_BNC * 1.3, caHT * 1.05);
  const posPlafond = (PLAFOND_MICRO_BNC / echelle) * 100;
  const posCA = (caHT / echelle) * 100;
  const ecartTaux = (TAUX_IR_FIXE - tauxIR) * calc.baseIR;

  return (
    <section aria-label="Indicateurs" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      <Tuile titre={`CA encaissé ${annee}`}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <GrosChiffre size="md">{formatEur(ag.caADate)}</GrosChiffre>
            <div className="mt-0.5 text-xs text-net">
              {ag.encaisseCeMois > 0 ? `+${formatEur(ag.encaisseCeMois)} en ${MOIS_NOMS_LONG[ag.maintenant.mois].toLowerCase()}` : "TTC"}
            </div>
          </div>
          <div aria-hidden="true" className="flex h-10 items-end gap-[3px]">
            {ag.mensuel.map((v, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-sm ${v > 0 ? "bg-ca" : ag.prevu[i] > 0 ? "bg-line-strong" : "bg-line"}`}
                style={{ height: `${Math.max(6, ((v || ag.prevu[i]) / max) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </Tuile>

      <Tuile titre="Plafond micro-BNC">
        <div className="flex items-baseline gap-2">
          <GrosChiffre size="md">{formatEur(caHT)}</GrosChiffre>
          <span className="text-xs text-faint">HT / {formatEur(PLAFOND_MICRO_BNC)}</span>
        </div>
        <div aria-hidden="true" className="relative h-2 rounded-full bg-line-soft">
          <div className="absolute inset-y-0 left-0 rounded-l-full bg-ca" style={{ width: `${Math.min(posCA, posPlafond)}%` }} />
          {posCA > posPlafond && (
            <div className="absolute inset-y-0 rounded-r-full bg-ir" style={{ left: `${posPlafond}%`, width: `${posCA - posPlafond}%` }} />
          )}
          <div className="absolute -inset-y-1 w-0.5 bg-txt" style={{ left: `${posPlafond}%` }} />
        </div>
        <div className={`text-xs ${ratioPlafond > 1 ? "text-ir" : "text-muted"}`}>
          {ratioPlafond > 1
            ? "Au-dessus du plafond (proratisé l'année de création) : 2 années consécutives = sortie du micro"
            : `Encore ${formatEur(PLAFOND_MICRO_BNC - caHT)} HT avant le plafond`}
        </div>
      </Tuile>

      <Tuile titre="Taux d'impôt appliqué">
        <div className="flex items-baseline gap-2">
          <GrosChiffre size="md" className="text-ir">{formatPct(tauxIR)}</GrosChiffre>
          <span className="text-xs text-faint">{tauxSimuleActif ? "simulé · barème 2026" : "taux fixe"}</span>
        </div>
        <div className="text-xs text-muted">
          {tauxSimuleActif
            ? ecartTaux >= 0
              ? <>au lieu de 24 % fixe, soit <strong className="text-net">{formatEur(ecartTaux)}</strong> de provision en moins</>
              : <>au-dessus des 24 % fixes : <strong className="text-tva">{formatEur(-ecartTaux)}</strong> de provision en plus</>
            : "Active le taux simulé dans l'onglet Impôts pour un calcul au barème"}
        </div>
        <button type="button" onClick={onOuvrirImpots} className="self-start text-xs text-ca hover:text-ca-light">
          Ouvrir la simulation →
        </button>
      </Tuile>

      <Tuile titre="Encaissement moyen">
        <div className="flex items-baseline gap-2">
          <GrosChiffre size="md">{formatEur(ag.moyenne)}</GrosChiffre>
          <span className="text-xs text-faint">TTC / mois</span>
        </div>
        <div className="text-xs text-muted">
          {ag.prochain?.montantTTC
            ? <>Prochain encaissement attendu : <strong className="text-txt">{formatEur(ag.prochain.montantTTC)}</strong> en {MOIS_NOMS_LONG[ag.prochain.encaissement.mois].toLowerCase()} (facture de {MOIS_NOMS_LONG[ag.prochain.facture.mois].toLowerCase()})</>
            : "Aucun encaissement à venir détecté"}
        </div>
      </Tuile>
    </section>
  );
}
