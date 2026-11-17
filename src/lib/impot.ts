// Moteur de simulation de l'impôt sur le revenu (barème progressif français).
//
// Paramètres : loi de finances pour 2026 (loi n° 2026-103 du 19 février 2026),
// barème applicable aux revenus 2025, revalorisé de +0,9 %. Tant que la loi de
// finances 2027 n'est pas votée, c'est la meilleure estimation disponible pour
// les revenus 2026. Simulation indicative, non contractuelle.

export interface Tranche {
  /** Borne haute de la tranche, pour 1 part */
  max: number;
  taux: number;
}

export interface ParametresIR {
  label: string;
  tranches: Tranche[];
  /** Plafond de l'avantage procuré par chaque demi-part supplémentaire */
  plafondDemiPart: number;
  /** Plafond spécifique de la part (2 demi-parts) du 1er enfant d'un parent isolé */
  plafondParentIsole: number;
  decote: { seul: number; couple: number; taux: number };
  abattementSalaires: { taux: number; min: number; max: number };
  microBnc: { taux: number; min: number; plafond: number };
  /** Impôt non mis en recouvrement en dessous de ce montant */
  seuilRecouvrement: number;
}

export const PARAMETRES_IR_2026: ParametresIR = {
  label: "Barème LF 2026 (revenus 2025)",
  tranches: [
    { max: 11600, taux: 0 },
    { max: 29579, taux: 0.11 },
    { max: 84577, taux: 0.30 },
    { max: 181917, taux: 0.41 },
    { max: Infinity, taux: 0.45 },
  ],
  plafondDemiPart: 1807,
  plafondParentIsole: 4262,
  decote: { seul: 897, couple: 1483, taux: 0.4525 },
  abattementSalaires: { taux: 0.10, min: 509, max: 14555 },
  microBnc: { taux: 0.34, min: 305, plafond: 83600 },
  seuilRecouvrement: 61,
};

export type Situation = "seul" | "couple";
export type RegimeBnc = "micro" | "reel";

export interface FoyerFiscal {
  situation: Situation;
  /** Nombre d'enfants à charge (résidence exclusive) */
  enfants: number;
  /** Case T : parent vivant seul qui élève ses enfants */
  parentIsole: boolean;
  /** Déclarant 1 — activité BNC */
  regimeBnc: RegimeBnc;
  /** Recettes HT encaissées (micro-BNC) ou bénéfice net (déclaration contrôlée) */
  montantBnc: number;
  /** Salaires nets imposables du déclarant 1 */
  salaires1: number;
  /** Salaires nets imposables du déclarant 2 (si couple) */
  salaires2: number;
  /** Autres revenus nets imposables du foyer (déjà nets d'abattements) */
  autresRevenus: number;
  /** Charges déductibles du revenu global (versements PER, pensions alimentaires…) */
  chargesDeductibles: number;
}

export interface DetailTranche {
  taux: number;
  min: number;
  max: number;
  /** Revenu du foyer taxé dans la tranche (base × parts) */
  base: number;
  impot: number;
}

export interface ResultatIR {
  bncImposable: number;
  salairesNets: number;
  revenuImposable: number;
  parts: number;
  partsBase: number;
  quotient: number;
  impotAvantPlafond: number;
  plafonnementQF: number;
  impotBrut: number;
  decote: number;
  cehr: number;
  impotNet: number;
  tauxMoyen: number;
  tmi: number;
  detailTranches: DetailTranche[];
  depassementPlafondMicro: boolean;
}

const round = (n: number) => Math.round(n);

export function abattementSalaires(salaires: number, p: ParametresIR = PARAMETRES_IR_2026): number {
  if (salaires <= 0) return 0;
  const { taux, min, max } = p.abattementSalaires;
  return Math.min(salaires, Math.min(max, Math.max(min, salaires * taux)));
}

export function bncImposable(regime: RegimeBnc, montant: number, p: ParametresIR = PARAMETRES_IR_2026): number {
  if (montant <= 0) return regime === "reel" ? montant : 0;
  if (regime === "reel") return montant;
  const abatt = Math.max(p.microBnc.min, montant * p.microBnc.taux);
  return Math.max(0, montant - abatt);
}

export function nombreDeParts(f: Pick<FoyerFiscal, "situation" | "enfants" | "parentIsole">): { parts: number; partsBase: number } {
  const partsBase = f.situation === "couple" ? 2 : 1;
  const enfants = Math.max(0, Math.floor(f.enfants));
  let partsEnfants = Math.min(enfants, 2) * 0.5 + Math.max(0, enfants - 2) * 1;
  if (f.situation === "seul" && f.parentIsole && enfants > 0) partsEnfants += 0.5;
  return { parts: partsBase + partsEnfants, partsBase };
}

/** Impôt issu du barème pour un revenu et un nombre de parts donnés */
export function impotBareme(revenu: number, parts: number, p: ParametresIR = PARAMETRES_IR_2026): number {
  if (revenu <= 0 || parts <= 0) return 0;
  const q = revenu / parts;
  let impot = 0;
  let min = 0;
  for (const t of p.tranches) {
    if (q > min) impot += (Math.min(q, t.max) - min) * t.taux;
    min = t.max;
  }
  return impot * parts;
}

function detailParTranche(revenu: number, parts: number, p: ParametresIR): DetailTranche[] {
  const q = parts > 0 ? Math.max(0, revenu) / parts : 0;
  let min = 0;
  return p.tranches.map((t) => {
    const baseQ = Math.max(0, Math.min(q, t.max) - min);
    const d = { taux: t.taux, min, max: t.max, base: baseQ * parts, impot: baseQ * t.taux * parts };
    min = t.max;
    return d;
  });
}

function plafondAvantageQF(f: FoyerFiscal, parts: number, partsBase: number, p: ParametresIR): number {
  const demiParts = Math.round((parts - partsBase) * 2);
  if (demiParts <= 0) return 0;
  if (f.situation === "seul" && f.parentIsole && f.enfants > 0) {
    // Parent isolé : la 1ʳᵉ part (enfant + case T) bénéficie d'un plafond spécifique
    return p.plafondParentIsole + Math.max(0, demiParts - 2) * p.plafondDemiPart;
  }
  return demiParts * p.plafondDemiPart;
}

function cehr(revenu: number, situation: Situation): number {
  // Contribution exceptionnelle sur les hauts revenus (base approximée par le revenu imposable)
  const s1 = situation === "couple" ? 500000 : 250000;
  const s2 = situation === "couple" ? 1000000 : 500000;
  return Math.max(0, Math.min(revenu, s2) - s1) * 0.03 + Math.max(0, revenu - s2) * 0.04;
}

export function revenuImposableFoyer(f: FoyerFiscal, p: ParametresIR = PARAMETRES_IR_2026) {
  const bnc = bncImposable(f.regimeBnc, f.montantBnc, p);
  const s1 = f.salaires1 - abattementSalaires(f.salaires1, p);
  const s2 = f.situation === "couple" ? f.salaires2 - abattementSalaires(f.salaires2, p) : 0;
  const salairesNets = Math.max(0, s1) + Math.max(0, s2);
  const revenu = Math.max(0, bnc + salairesNets + f.autresRevenus - f.chargesDeductibles);
  return { bnc, salairesNets, revenu };
}

export function simulerIR(f: FoyerFiscal, p: ParametresIR = PARAMETRES_IR_2026): ResultatIR {
  const { bnc, salairesNets, revenu } = revenuImposableFoyer(f, p);
  const { parts, partsBase } = nombreDeParts(f);

  const impotAvantPlafond = impotBareme(revenu, parts, p);
  const impotSansEnfants = impotBareme(revenu, partsBase, p);
  const plafond = plafondAvantageQF(f, parts, partsBase, p);
  const impotPlafonne = Math.max(impotAvantPlafond, impotSansEnfants - plafond);
  const plafonnementQF = impotPlafonne - impotAvantPlafond;

  const seuilDecote = f.situation === "couple" ? p.decote.couple : p.decote.seul;
  const decoteBrute = seuilDecote - p.decote.taux * impotPlafonne;
  const decote = impotPlafonne > 0 && decoteBrute > 0 ? Math.min(impotPlafonne, decoteBrute) : 0;

  const contribution = cehr(revenu, f.situation);
  let impotNet = impotPlafonne - decote + contribution;
  if (impotNet < p.seuilRecouvrement) impotNet = 0;

  const quotient = parts > 0 ? revenu / parts : 0;
  const tmi = [...p.tranches].reverse().find((t, i, arr) => quotient > (arr[i + 1]?.max ?? 0))?.taux ?? 0;

  return {
    bncImposable: round(bnc),
    salairesNets: round(salairesNets),
    revenuImposable: round(revenu),
    parts,
    partsBase,
    quotient: round(quotient),
    impotAvantPlafond: round(impotAvantPlafond),
    plafonnementQF: round(plafonnementQF),
    impotBrut: round(impotPlafonne),
    decote: round(decote),
    cehr: round(contribution),
    impotNet: round(impotNet),
    tauxMoyen: revenu > 0 ? impotNet / revenu : 0,
    tmi,
    detailTranches: detailParTranche(revenu, parts, p),
    depassementPlafondMicro: f.regimeBnc === "micro" && f.montantBnc > p.microBnc.plafond,
  };
}

/** Part de l'impôt du foyer imputable à l'activité BNC (impôt avec − impôt sans) */
export function impotImputableBnc(f: FoyerFiscal, p: ParametresIR = PARAMETRES_IR_2026): number {
  const avec = simulerIR(f, p).impotNet;
  const sans = simulerIR({ ...f, montantBnc: 0 }, p).impotNet;
  return Math.max(0, avec - sans);
}

/**
 * Impôt si chaque partenaire déclarait seul (enfants rattachés au déclarant 1).
 * Utile pour mesurer l'intérêt de l'imposition commune (mariage / PACS).
 */
export function impotDeclarationsSeparees(f: FoyerFiscal, p: ParametresIR = PARAMETRES_IR_2026): number {
  const d1 = simulerIR({ ...f, situation: "seul", salaires2: 0 }, p).impotNet;
  const d2 = simulerIR({
    ...f,
    situation: "seul",
    enfants: 0,
    parentIsole: false,
    montantBnc: 0,
    salaires1: f.salaires2,
    salaires2: 0,
    autresRevenus: 0,
    chargesDeductibles: 0,
  }, p).impotNet;
  return d1 + d2;
}
