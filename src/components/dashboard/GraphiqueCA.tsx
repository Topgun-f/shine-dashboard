"use client";

import { useState } from "react";
import { Card, Titre } from "@/components/ui";
import type { Agregats } from "@/lib/agregats";
import { MOIS_NOMS_COURT, MOIS_NOMS_LONG, formatEur } from "@/lib/finance";

function kEur(v: number) {
  return v === 0 ? "0" : `${Math.round(v / 1000)} k€`;
}

export default function GraphiqueCA({ ag, annee }: { ag: Agregats; annee: number }) {
  const [survol, setSurvol] = useState<number | null>(null);

  const valeurs = ag.mensuel.map((v, i) => v + ag.prevu[i]);
  const maxM = Math.max(3000, Math.ceil(Math.max(...valeurs) / 3000) * 3000);
  const cumuls = valeurs.map((_, i) => valeurs.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const maxC = Math.max(1, cumuls[11] * 1.08);

  // Dernier mois réellement encaissé (la courbe pleine s'arrête là)
  const iNow = ag.maintenant.annee === annee ? ag.maintenant.mois : ag.maintenant.annee > annee ? 11 : -1;
  const premier = valeurs.findIndex((v) => v > 0);
  const dernierPrevu = ag.prevu.reduce((d, v, i) => (v > 0 ? i : d), -1);
  const pt = (i: number) => `${(((i + 0.5) / 12) * 100).toFixed(2)},${(100 - (cumuls[i] / maxC) * 100).toFixed(2)}`;
  const reel: string[] = [];
  const prevision: string[] = [];
  if (premier >= 0) {
    for (let i = premier; i <= Math.min(iNow, 11); i++) reel.push(pt(i));
    if (dernierPrevu > iNow) for (let i = Math.max(iNow, premier); i <= dernierPrevu; i++) prevision.push(pt(i));
  }

  const s = survol;
  const f = s !== null ? ag.factureParMois[s] : null;
  const alignement = s === null ? "" : s < 2 ? "translate-x-0" : s > 9 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <Card aria-labelledby="titre-graph" className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titre id="titre-graph" sub="Règlement à facture + 2 mois · TTC">CA encaissé par mois</Titre>
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-ca" />Mensuel</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3.5 bg-net" />Cumul</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-dashed border-ca" />Prévision</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div aria-hidden="true" className="flex h-60 w-11 shrink-0 flex-col justify-between text-right text-[11px] text-faint">
          {[1, 2 / 3, 1 / 3, 0].map((t) => <span key={t}>{kEur(maxM * t)}</span>)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            role="img"
            aria-label={`CA encaissé ${annee} : ${formatEur(ag.caADate)} à date${ag.caPrevu > 0 ? `, ${formatEur(ag.caPrevu)} attendus` : ""}`}
            className="relative h-60 border-b border-line-strong"
            onMouseLeave={() => setSurvol(null)}
          >
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-dashed border-line-soft" />
              <div className="border-t border-dashed border-line-soft" />
              <div className="border-t border-dashed border-line-soft" />
              <div />
            </div>
            <div className="absolute inset-0 grid grid-cols-12 items-end gap-1.5 sm:gap-2.5">
              {valeurs.map((v, i) => {
                const prevu = ag.prevu[i] > 0;
                return (
                  <div
                    key={i}
                    className={`rounded-t-md rounded-b-sm transition-all duration-300 ${
                      prevu ? "border-[1.5px] border-dashed border-ca bg-transparent" : survol === i ? "bg-ca-light" : "bg-ca"
                    }`}
                    style={{ height: `${(v / maxM) * 100}%` }}
                  />
                );
              })}
            </div>
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              {reel.length > 1 && (
                <polyline points={reel.join(" ")} fill="none" stroke="#3DD68C" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              )}
              {prevision.length > 1 && (
                <polyline points={prevision.join(" ")} fill="none" stroke="#3DD68C" strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            <div className="absolute inset-0 grid grid-cols-12">
              {valeurs.map((_, i) => (
                <div key={i} onMouseEnter={() => setSurvol(i)} className={survol === i ? "bg-white/[0.03]" : ""} />
              ))}
            </div>
            {s !== null && valeurs[s] > 0 && (
              <div
                className={`pointer-events-none absolute top-1 rounded-[10px] border border-line-strong bg-chip px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${alignement}`}
                style={{ left: `${((s + 0.5) / 12) * 100}%` }}
              >
                <div className="whitespace-nowrap text-muted">
                  {MOIS_NOMS_LONG[s]} {annee}
                  {f && ` · facture ${MOIS_NOMS_LONG[f.facture.mois].toLowerCase()}`}
                  {ag.prevu[s] > 0 && " · attendu"}
                </div>
                <div className="mt-0.5 whitespace-nowrap font-bold">
                  {formatEur(valeurs[s])} <span className="font-semibold text-net">· cumul {formatEur(cumuls[s])}</span>
                </div>
              </div>
            )}
          </div>
          <div aria-hidden="true" className="grid grid-cols-12 gap-1.5 text-center text-[11px] text-faint sm:gap-2.5">
            {MOIS_NOMS_COURT.map((m, i) => (
              <span key={m} className={i === iNow ? "font-semibold text-txt" : ""}>{m}</span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
