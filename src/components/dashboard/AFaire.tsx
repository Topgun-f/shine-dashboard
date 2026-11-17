"use client";

import { IconeCheck } from "@/components/ui";
import type { Agregats } from "@/lib/agregats";
import {
  CFP_RATE,
  DELAI_ENCAISSEMENT,
  MOIS_NOMS_LONG,
  TVA_RATE,
  URSSAF_RATE,
  cleDeclaration,
  computeCalc,
  decaler,
  echeanceMois,
  formatDateCourte,
  formatEur,
  formatPct,
  joursAvant,
  libelleMois,
  moisFactureADeclarer,
} from "@/lib/finance";

interface Tache {
  cle: string;
  tag: string;
  tagCls: string;
  badge: string;
  badgeCls: string;
  titre: string;
  montant: string;
  sub: string;
}

export default function AFaire({
  ag, tauxIR, faits, basculer, onVoirEcheances,
}: {
  ag: Agregats;
  tauxIR: number;
  faits: Set<string>;
  basculer: (cle: string) => void;
  onVoirEcheances: () => void;
}) {
  const now = ag.maintenant;
  const factDecl = moisFactureADeclarer();
  const moisEnc = decaler(now, -1);
  const fDecl = ag.factureADeclarer;
  const ttc = fDecl?.montantTTC ?? null;
  const ht = ttc !== null ? ttc / (1 + TVA_RATE) : null;
  const echeance = echeanceMois(now);
  const j = joursAvant(echeance);
  const introuvable = `Facture de ${libelleMois(factDecl).toLowerCase()} introuvable dans Gmail`;

  const factIR = decaler(now, -DELAI_ENCAISSEMENT);
  const fIR = ag.factureEncaisseeCeMois;
  const ir = fIR?.montantTTC ? computeCalc(fIR.montantTTC, tauxIR).ir : null;

  const taches: Tache[] = [
    {
      cle: cleDeclaration(factDecl, "urssaf"),
      tag: "URSSAF",
      tagCls: "text-urssaf",
      badge: `${j >= 0 ? `J-${j}` : `J+${-j}`} · ${formatDateCourte(echeance)}`,
      badgeCls: j <= 5 ? "bg-[#3a1e1c] text-[#ffb4aa]" : "bg-[#2a2140] text-[#d9c2ff]",
      titre: `Déclarer le CA encaissé en ${MOIS_NOMS_LONG[moisEnc.mois].toLowerCase()}`,
      montant: ht !== null ? `${formatEur(ht)} HT` : "—",
      sub: ht !== null ? `Cotisations + CFP : ${formatEur(ht * (URSSAF_RATE + CFP_RATE))}` : introuvable,
    },
    {
      cle: cleDeclaration(factDecl, "tva"),
      tag: "TVA · CA3",
      tagCls: "text-tva",
      badge: MOIS_NOMS_LONG[now.mois],
      badgeCls: "bg-[#3a1e1c] text-[#ffb4aa]",
      titre: `TVA collectée sur les encaissements de ${MOIS_NOMS_LONG[moisEnc.mois].toLowerCase()}`,
      montant: ttc !== null ? formatEur(ttc * (TVA_RATE / (1 + TVA_RATE))) : "—",
      sub: ttc !== null ? "Date limite selon ton SIE" : introuvable,
    },
    {
      cle: cleDeclaration(factIR, "ir"),
      tag: "Impôt · provision",
      tagCls: "text-ir",
      badge: "Ce mois-ci",
      badgeCls: "bg-[#3a2e14] text-[#ffd98a]",
      titre: "Virer la provision d'impôt vers ta poche Impôts",
      montant: ir !== null ? formatEur(ir) : "—",
      sub: ir !== null
        ? `Facture de ${MOIS_NOMS_LONG[factIR.mois].toLowerCase()} · taux ${formatPct(tauxIR)}`
        : `Facture de ${libelleMois(factIR).toLowerCase()} introuvable dans Gmail`,
    },
  ];

  return (
    <section aria-labelledby="titre-afaire" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="titre-afaire" className="m-0 font-display text-[15px] font-semibold">
          À faire en {MOIS_NOMS_LONG[now.mois].toLowerCase()}
        </h2>
        <button type="button" onClick={onVoirEcheances} className="text-xs text-muted hover:text-txt">
          Tout le calendrier →
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        {taches.map((t) => {
          const fait = faits.has(t.cle);
          return (
            <article
              key={t.cle}
              className={`flex flex-col gap-2.5 rounded-[14px] border px-[18px] py-4 transition-colors ${
                fait ? "border-[#1d3a2a] bg-[#0f1612]" : "border-line bg-panel"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.04em] ${t.tagCls}`}>{t.tag}</span>
                <span className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${fait ? "bg-[#13291e] text-[#8be6b5]" : t.badgeCls}`}>
                  {fait ? "Fait" : t.badge}
                </span>
              </div>
              <div className={`text-[13px] text-muted ${fait ? "line-through" : ""}`}>{t.titre}</div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className={`font-display text-2xl font-bold tracking-[-0.02em] ${fait ? "text-faint" : ""}`}>{t.montant}</div>
                  <div className="mt-0.5 text-xs text-faint">{t.sub}</div>
                </div>
                <button
                  type="button"
                  aria-pressed={fait}
                  onClick={() => basculer(t.cle)}
                  className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-[9px] border px-3 text-xs font-medium transition-colors ${
                    fait ? "border-[#1d3a2a] bg-[#13291e] text-net" : "border-line-strong bg-panel-2 text-txt hover:bg-chip"
                  }`}
                >
                  <IconeCheck />
                  {fait ? "Annuler" : "Fait"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
