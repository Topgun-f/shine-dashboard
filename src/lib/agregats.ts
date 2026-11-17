import {
  CFP_RATE,
  DELAI_ENCAISSEMENT,
  type FactureInfo,
  type Mois,
  TVA_RATE,
  URSSAF_RATE,
  computeCalc,
  decaler,
  idxMois,
  moisCourant,
  moisFactureADeclarer,
} from "./finance";

const memeMois = (a: Mois, b: Mois) => a.mois === b.mois && a.annee === b.annee;
const somme = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Agrégats de l'année affichée, calculés à partir des factures analysées */
export function agreger(infos: FactureInfo[], annee: number, tauxIR: number, ref: Date = new Date()) {
  const maintenant = moisCourant(ref);
  const iNow = idxMois(maintenant);

  const mensuel: number[] = Array(12).fill(0);
  const prevu: number[] = Array(12).fill(0);
  const factureParMois: (FactureInfo | null)[] = Array(12).fill(null);
  for (const f of infos) {
    if (f.encaissement.annee !== annee || !f.montantTTC) continue;
    const i = f.encaissement.mois;
    factureParMois[i] = f;
    if (idxMois(f.encaissement) <= iNow) mensuel[i] += f.montantTTC;
    else prevu[i] += f.montantTTC;
  }

  const caADate = somme(mensuel);
  const caPrevu = somme(prevu);
  const moisAvecCA = mensuel.filter((v) => v > 0);
  const moyenne = moisAvecCA.length ? caADate / moisAvecCA.length : 0;
  const encaisseCeMois = annee === maintenant.annee ? mensuel[maintenant.mois] : 0;
  const prochain =
    infos
      .filter((f) => f.montantTTC && idxMois(f.encaissement) > iNow)
      .sort((a, b) => idxMois(a.encaissement) - idxMois(b.encaissement))[0] ?? null;

  // Ce qui est à faire ce mois-ci
  const factureADeclarer = infos.find((f) => memeMois(f.facture, moisFactureADeclarer(ref))) ?? null;
  const factureEncaisseeCeMois = infos.find((f) => memeMois(f.facture, decaler(maintenant, -DELAI_ENCAISSEMENT))) ?? null;

  // Montants encaissés mais pas encore reversés (déclaration ce mois-ci ou le mois prochain)
  const dues = infos.filter((f) => f.montantTTC && idxMois(f.encaissement) <= iNow && idxMois(f.declaration) >= iNow);
  const tvaDue = somme(dues.filter((f) => !f.tvaFaite).map((f) => (f.montantTTC ?? 0) * (TVA_RATE / (1 + TVA_RATE))));
  const urssafDue = somme(dues.filter((f) => !f.urssafFaite).map((f) => ((f.montantTTC ?? 0) / (1 + TVA_RATE)) * (URSSAF_RATE + CFP_RATE)));

  const encaisseesAnnee = infos.filter((f) => f.montantTTC && f.encaissement.annee === annee && idxMois(f.encaissement) <= iNow);
  const irAnnee = somme(encaisseesAnnee.map((f) => computeCalc(f.montantTTC ?? 0, tauxIR).ir));
  const irVire = somme(encaisseesAnnee.filter((f) => f.provisionFaite).map((f) => computeCalc(f.montantTTC ?? 0, tauxIR).ir));

  return {
    maintenant,
    mensuel,
    prevu,
    factureParMois,
    caADate,
    caPrevu,
    moyenne,
    encaisseCeMois,
    prochain,
    factureADeclarer,
    factureEncaisseeCeMois,
    tvaDue,
    urssafDue,
    irAnnee,
    irVire,
    encaisseesAnnee,
  };
}

export type Agregats = ReturnType<typeof agreger>;
