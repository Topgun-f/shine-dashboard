"use client";

import { Card, Titre } from "@/components/ui";
import {
  CFP_RATE,
  type FactureInfo,
  MOIS_NOMS_LONG,
  TVA_RATE,
  URSSAF_RATE,
  cleDeclaration,
  echeanceMois,
  formatDateCourte,
  formatEur,
  idxMois,
  libelleMois,
  moisCourant,
} from "@/lib/finance";

export default function Echeances({
  infos, faits, basculer, annee,
}: {
  infos: FactureInfo[];
  faits: Set<string>;
  basculer: (cle: string) => void;
  annee: number;
}) {
  const iNow = idxMois(moisCourant());
  const lignes = [...infos].sort((a, b) => idxMois(b.declaration) - idxMois(a.declaration));

  const rdv = [
    { titre: "Acompte de prélèvement à la source", quand: "Le 15 de chaque mois", detail: "Prélevé automatiquement par la DGFiP sur ton compte, d'après ta dernière déclaration." },
    { titre: `Déclaration des revenus ${annee}`, quand: `Printemps ${annee + 1}`, detail: "Recettes micro-BNC (déclaration 2042-C-PRO) : le CA HT encaissé dans l'année, l'abattement de 34 % est automatique." },
    { titre: "Cotisation foncière des entreprises (CFE)", quand: "Mi-décembre", detail: "Exonérée l'année de création ; ensuite, avis à régler sur impots.gouv (espace professionnel)." },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">Échéances</h1>
        <div className="mt-1 text-[13px] text-muted">
          URSSAF et TVA se déclarent le mois qui suit l&apos;encaissement. Coche au fur et à mesure.
        </div>
      </div>

      <Card aria-labelledby="titre-decl" className="flex flex-col gap-3.5 p-6">
        <Titre id="titre-decl" sub="Une ligne par facture, au mois où elle doit être déclarée">Déclarations mensuelles</Titre>
        {lignes.length === 0 ? (
          <div className="py-6 text-center text-sm text-faint">Aucune facture importée pour l&apos;instant</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-faint">
                  <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">À déclarer en</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Encaissement</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">CA HT</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">URSSAF + CFP</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">TVA</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((f) => {
                  const ttc = f.montantTTC;
                  const ht = ttc !== null ? ttc / (1 + TVA_RATE) : null;
                  const iDecl = idxMois(f.declaration);
                  const courant = iDecl === iNow;
                  const cleU = cleDeclaration(f.facture, "urssaf");
                  const cleT = cleDeclaration(f.facture, "tva");
                  return (
                    <tr key={f.id} className={courant ? "bg-[#1b1a10]" : "hover:bg-white/[0.02]"}>
                      <td className="border-b border-[#1b1f28] p-3">
                        <div className="font-semibold">{libelleMois(f.declaration)}</div>
                        <div className="text-[11px] text-faint">
                          {courant ? `ce mois-ci · avant le ${formatDateCourte(echeanceMois(f.declaration))}` : iDecl > iNow ? "à venir" : ""}
                        </div>
                      </td>
                      <td className="border-b border-[#1b1f28] p-3 text-muted">
                        {MOIS_NOMS_LONG[f.encaissement.mois]} {f.encaissement.annee}
                        <div className="text-[11px] text-faint">facture {libelleMois(f.facture).toLowerCase()}</div>
                      </td>
                      <td className="border-b border-[#1b1f28] p-3 text-right font-semibold">{ht !== null ? formatEur(ht) : "—"}</td>
                      <td className="border-b border-[#1b1f28] p-3">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={faits.has(cleU)} onChange={() => basculer(cleU)} className="h-4 w-4 accent-[#3dd68c]" />
                          <span className={faits.has(cleU) ? "text-faint line-through" : ""}>{ht !== null ? formatEur(ht * (URSSAF_RATE + CFP_RATE)) : "—"}</span>
                        </label>
                      </td>
                      <td className="border-b border-[#1b1f28] p-3">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={faits.has(cleT)} onChange={() => basculer(cleT)} className="h-4 w-4 accent-[#3dd68c]" />
                          <span className={faits.has(cleT) ? "text-faint line-through" : ""}>{ttc !== null ? formatEur(ttc * (TVA_RATE / (1 + TVA_RATE))) : "—"}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card aria-labelledby="titre-rdv" className="flex flex-col gap-3 p-6">
        <Titre id="titre-rdv">Autres rendez-vous fiscaux</Titre>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 p-0">
          {rdv.map((r) => (
            <li key={r.titre} className="flex flex-col gap-1 rounded-xl border border-line bg-bar p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ir">{r.quand}</span>
              <span className="font-semibold">{r.titre}</span>
              <span className="text-xs text-muted">{r.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
