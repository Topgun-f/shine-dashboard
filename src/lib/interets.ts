// Simulation d'intérêts composés pour un PEA investi sur un ETF, avec
// versements mensuels programmés (DCA).

/** Plafond des versements sur un PEA classique */
export const PLAFOND_PEA = 150000;
/** Prélèvements sociaux sur les gains d'un PEA de plus de 5 ans (CSG à 10,6 % depuis 2026) */
export const PS_PEA = 0.186;
/** PFU (12,8 % IR + 18,6 % PS) en cas de retrait avant 5 ans */
export const PFU = 0.314;

export interface ParamsInterets {
  capitalInitial: number;
  dcaMensuel: number;
  /** Rendement annuel espéré, en % */
  tauxAnnuel: number;
  dureeAnnees: number;
  /** Frais annuels de l'ETF (TER), en % */
  fraisAnnuels: number;
  respecterPlafond: boolean;
}

export interface PointAnnuel {
  annee: number;
  verse: number;
  valeur: number;
  interets: number;
}

export interface ResultatInterets {
  points: PointAnnuel[];
  verse: number;
  valeur: number;
  interets: number;
  impots: number;
  tauxImpot: number;
  valeurNette: number;
  multiplicateur: number;
  /** Première année où les intérêts cumulés dépassent les versements */
  anneeBascule: number | null;
  /** Année où le plafond de versements est atteint */
  anneePlafond: number | null;
}

export function simulerInterets(p: ParamsInterets, decalageTaux = 0): ResultatInterets {
  const duree = Math.max(0, Math.min(60, Math.round(p.dureeAnnees)));
  const tauxNet = (1 + (p.tauxAnnuel + decalageTaux) / 100) * (1 - p.fraisAnnuels / 100) - 1;
  const rMensuel = Math.pow(1 + Math.max(-0.99, tauxNet), 1 / 12) - 1;
  const plafond = p.respecterPlafond ? PLAFOND_PEA : Infinity;

  let verse = Math.min(Math.max(0, p.capitalInitial), plafond);
  let valeur = verse;
  let anneeBascule: number | null = null;
  let anneePlafond: number | null = verse >= plafond ? 0 : null;
  const points: PointAnnuel[] = [{ annee: 0, verse, valeur, interets: 0 }];

  for (let a = 1; a <= duree; a++) {
    for (let m = 0; m < 12; m++) {
      // Versement en début de mois, puis capitalisation sur le mois
      const v = Math.max(0, Math.min(p.dcaMensuel, plafond - verse));
      verse += v;
      valeur += v;
      valeur *= 1 + rMensuel;
      if (anneePlafond === null && verse >= plafond) anneePlafond = a;
    }
    const interets = valeur - verse;
    if (anneeBascule === null && interets > verse) anneeBascule = a;
    points.push({ annee: a, verse, valeur, interets });
  }

  const interets = valeur - verse;
  const tauxImpot = duree >= 5 ? PS_PEA : PFU;
  const impots = Math.max(0, interets) * tauxImpot;
  return {
    points,
    verse,
    valeur,
    interets,
    impots,
    tauxImpot,
    valeurNette: valeur - impots,
    multiplicateur: verse > 0 ? valeur / verse : 0,
    anneeBascule,
    anneePlafond,
  };
}
