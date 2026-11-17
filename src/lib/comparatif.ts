// Comparaison des statuts pour une activité de conseil (BNC) : micro-entreprise,
// entreprise individuelle au réel, EURL (IR ou IS), SASU et portage salarial.
//
// Paramètres 2026. Les cotisations TNS suivent la nouvelle assiette unique
// (revenu − abattement de 26 %) ; les charges des assimilés salariés sont des
// taux moyens. Ordres de grandeur pour comparer, pas un calcul de paie.

import { CFP_RATE, URSSAF_RATE } from "./finance";
import { type FoyerFiscal, simulerIR } from "./impot";
import type { ReglagesIR } from "./reglagesIR";

export const PASS = 48060;
const PFU_IR = 0.128;
const PS = 0.186;
const IS_SEUIL = 42500;

/** Interpolation linéaire d'un taux selon le revenu exprimé en PASS */
function tauxProgressif(xPass: number, points: [number, number][]): number {
  if (xPass <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (xPass <= x1) return y0 + ((xPass - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

/**
 * Cotisations et contributions d'un travailleur indépendant (SSI, profession
 * libérale non réglementée) pour un revenu professionnel brut, c'est-à-dire
 * avant déduction des cotisations.
 */
export function cotisationsTNS(revenu: number) {
  const r = Math.max(0, revenu);
  const abattement = Math.min(r, Math.max(0.0176 * PASS, Math.min(0.26 * r, 1.3 * PASS)));
  const a = r - abattement;
  const x = a / PASS;
  const sousPass = Math.min(a, PASS);

  const maladie = a * (tauxProgressif(x, [[0.2, 0], [0.4, 0.015], [0.6, 0.04], [1.1, 0.065], [3, 0.085]]));
  const ij = Math.min(a, 5 * PASS) * 0.005;
  const retraiteBase = sousPass * 0.1787 + a * 0.0072;
  const retraiteCompl = sousPass * 0.081 + Math.max(0, Math.min(a, 4 * PASS) - PASS) * 0.091;
  const invalidite = sousPass * 0.013;
  const allocFam = a * tauxProgressif(x, [[1.1, 0], [1.4, 0.031]]);
  const csgCrds = a * 0.097;
  const cfp = 0.0025 * PASS;
  const total = maladie + ij + retraiteBase + retraiteCompl + invalidite + allocFam + csgCrds + cfp;
  return {
    assiette: a,
    total,
    /** CSG non déductible (2,4 %) + CRDS (0,5 %) : réintégrées dans le revenu imposable */
    csgNonDeductible: a * 0.029,
    retraite: retraiteBase + retraiteCompl,
  };
}

/** Impôt sur les sociétés (taux réduit PME de 15 % jusqu'à 42 500 €) */
export function impotSocietes(benefice: number): number {
  if (benefice <= 0) return 0;
  return Math.min(benefice, IS_SEUIL) * 0.15 + Math.max(0, benefice - IS_SEUIL) * 0.25;
}

export interface ParamsComparatif {
  caHT: number;
  fraisPro: number;
  /** Coût total annuel de la rémunération du dirigeant pour la société (EURL IS / SASU) */
  remuneration: number;
  /** Part du bénéfice après IS versée en dividendes (0 à 1) */
  partDividendes: number;
  capitalEURL: number;
  fraisPortage: number;
  comptaEI: number;
  comptaEURL: number;
  comptaSASU: number;
}

export const PARAMS_COMPARATIF_DEFAUT: ParamsComparatif = {
  caHT: 110000,
  fraisPro: 3000,
  remuneration: 60000,
  partDividendes: 0,
  capitalEURL: 1000,
  fraisPortage: 0.07,
  comptaEI: 1200,
  comptaEURL: 2500,
  comptaSASU: 2800,
};

// Assimilé salarié (président de SASU, sans assurance chômage) et salarié porté
const SASU = { patronales: 0.41, salariales: 0.21 };
const PORTAGE = { patronales: 0.45, salariales: 0.225 };

export type IdStatut = "micro" | "ei" | "eurl-ir" | "eurl-is" | "sasu" | "portage";

export interface ResultatStatut {
  id: IdStatut;
  nom: string;
  sousTitre: string;
  fraisGestion: number;
  cotisations: number;
  is: number;
  ir: number;
  prelevementsDividendes: number;
  /** Ce qui arrive sur ton compte perso, après tout */
  netEnPoche: number;
  /** Ce qui reste dans la société après IS */
  tresorerie: number;
  dividendes: number;
  remunerationNette: number;
  protection: string;
  gestion: string;
  alerte?: string;
}

function foyerBase(r: ReglagesIR): FoyerFiscal {
  return {
    situation: r.situation,
    enfants: r.enfants,
    parentIsole: r.parentIsole,
    regimeBnc: "micro",
    montantBnc: 0,
    salaires1: r.salaires1,
    salaires2: r.situation === "couple" ? r.salaires2 : 0,
    autresRevenus: r.autresRevenus,
    chargesDeductibles: r.chargesDeductibles,
  };
}

/** Impôt sur le revenu du foyer imputable à l'activité (avec − sans) */
function irImputable(r: ReglagesIR, ajout: Partial<FoyerFiscal>): number {
  const base = foyerBase(r);
  const sans = simulerIR(base).impotNet;
  const avec = simulerIR({ ...base, ...ajout }).impotNet;
  return Math.max(0, avec - sans);
}

export function comparerStatuts(p: ParamsComparatif, foyer: ReglagesIR): ResultatStatut[] {
  const ca = Math.max(0, p.caHT);
  const res: ResultatStatut[] = [];

  // ── Micro-entreprise ──
  {
    const cotisations = ca * (URSSAF_RATE + CFP_RATE);
    const ir = irImputable(foyer, { regimeBnc: "micro", montantBnc: ca });
    res.push({
      id: "micro",
      nom: "Micro-entreprise",
      sousTitre: "BNC · abattement 34 %",
      fraisGestion: p.fraisPro,
      cotisations,
      is: 0,
      ir,
      prelevementsDividendes: 0,
      netEnPoche: ca - p.fraisPro - cotisations - ir,
      tresorerie: 0,
      dividendes: 0,
      remunerationNette: ca - p.fraisPro - cotisations,
      protection: "Indépendant · retraite sur le CA, pas de chômage",
      gestion: "Très simple · pas de comptable",
      alerte: ca > 83600 ? "Au-delà de 83 600 € HT deux années de suite, sortie obligatoire du micro" : undefined,
    });
  }

  // ── Entreprise individuelle au réel et EURL à l'IR (même régime fiscal et social) ──
  for (const [id, nom, compta, gestion] of [
    ["ei", "EI au réel", p.comptaEI, "Comptabilité recettes-dépenses, déclaration 2035"],
    ["eurl-ir", "EURL à l'IR", p.comptaEURL, "Société : statuts, bilan, approbation des comptes"],
  ] as const) {
    const b = Math.max(0, ca - p.fraisPro - compta);
    const c = cotisationsTNS(b);
    const bncFiscal = b - c.total + c.csgNonDeductible;
    const ir = irImputable(foyer, { regimeBnc: "reel", montantBnc: bncFiscal });
    res.push({
      id,
      nom,
      sousTitre: "Impôt sur le revenu · TNS",
      fraisGestion: p.fraisPro + compta,
      cotisations: c.total,
      is: 0,
      ir,
      prelevementsDividendes: 0,
      netEnPoche: b - c.total - ir,
      tresorerie: 0,
      dividendes: 0,
      remunerationNette: b - c.total,
      protection: "Indépendant · retraite sur le bénéfice, pas de chômage",
      gestion,
    });
  }

  // ── EURL à l'IS (gérant associé unique, TNS) ──
  {
    const dispo = Math.max(0, ca - p.fraisPro - p.comptaEURL);
    const t = Math.min(Math.max(0, p.remuneration), dispo);
    const c = cotisationsTNS(t);
    const remNette = t - c.total;
    const benefice = dispo - t;
    const is = impotSocietes(benefice);
    const apresIS = benefice - is;
    const d = apresIS * Math.min(1, Math.max(0, p.partDividendes));
    const seuil = 0.1 * Math.max(0, p.capitalEURL);
    const excedent = Math.max(0, d - seuil);
    const cotisDiv = cotisationsTNS(t + excedent).total - c.total;
    const prelevDiv = Math.min(d, seuil) * PS + d * PFU_IR + cotisDiv;
    const ir = irImputable(foyer, { salaires1: foyer.salaires1 + remNette + c.csgNonDeductible });
    res.push({
      id: "eurl-is",
      nom: "EURL à l'IS",
      sousTitre: "Gérant majoritaire · TNS",
      fraisGestion: p.fraisPro + p.comptaEURL,
      cotisations: c.total + cotisDiv,
      is,
      ir,
      prelevementsDividendes: prelevDiv - cotisDiv,
      netEnPoche: remNette - ir + d - prelevDiv,
      tresorerie: apresIS - d,
      dividendes: d,
      remunerationNette: remNette,
      protection: "Indépendant · retraite sur la rémunération, pas de chômage",
      gestion: "Société : bilan, liasse IS, approbation des comptes",
      alerte: excedent > 0 ? `Dividendes au-delà de ${Math.round(seuil)} € (10 % du capital) soumis aux cotisations TNS` : undefined,
    });
  }

  // ── SASU (président assimilé salarié) ──
  {
    const dispo = Math.max(0, ca - p.fraisPro - p.comptaSASU);
    const cout = Math.min(Math.max(0, p.remuneration), dispo);
    const brut = cout / (1 + SASU.patronales);
    const net = brut * (1 - SASU.salariales);
    const imposable = net + brut * 0.9825 * 0.029;
    const benefice = dispo - cout;
    const is = impotSocietes(benefice);
    const apresIS = benefice - is;
    const d = apresIS * Math.min(1, Math.max(0, p.partDividendes));
    const prelevDiv = d * (PFU_IR + PS);
    const ir = irImputable(foyer, { salaires1: foyer.salaires1 + imposable });
    res.push({
      id: "sasu",
      nom: "SASU",
      sousTitre: "Président · assimilé salarié",
      fraisGestion: p.fraisPro + p.comptaSASU,
      cotisations: cout - net,
      is,
      ir,
      prelevementsDividendes: prelevDiv,
      netEnPoche: net - ir + d - prelevDiv,
      tresorerie: apresIS - d,
      dividendes: d,
      remunerationNette: net,
      protection: "Régime général (retraite cadre), pas de chômage",
      gestion: "Société : bilans, paie, approbation des comptes",
    });
  }

  // ── Portage salarial ──
  {
    const frais = ca * Math.min(0.3, Math.max(0, p.fraisPortage));
    const cout = Math.max(0, ca - frais - p.fraisPro);
    const brut = cout / (1 + PORTAGE.patronales);
    const net = brut * (1 - PORTAGE.salariales);
    const imposable = net + brut * 0.9825 * 0.029;
    const ir = irImputable(foyer, { salaires1: foyer.salaires1 + imposable });
    res.push({
      id: "portage",
      nom: "Portage salarial",
      sousTitre: `Salarié porté · frais ${Math.round(p.fraisPortage * 100)} %`,
      fraisGestion: frais + p.fraisPro,
      cotisations: cout - net,
      is: 0,
      ir,
      prelevementsDividendes: 0,
      netEnPoche: net - ir,
      tresorerie: 0,
      dividendes: 0,
      remunerationNette: net,
      protection: "Salarié · chômage, mutuelle et prévoyance inclus",
      gestion: "Aucune gestion : la société de portage s'occupe de tout",
    });
  }

  return res;
}
