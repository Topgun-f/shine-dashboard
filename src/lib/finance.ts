// Paramètres et calculs de la micro-entreprise (BNC, TVA 20 %).
// Taux 2026 : cotisations sociales micro-BNC (SSI) 25,6 %, CFP 0,2 %, TVA 20 %.

import { PARAMETRES_IR_2026 } from "./impot";

export const TVA_RATE = 0.2;
export const URSSAF_RATE = 0.256;
export const CFP_RATE = 0.002;
export const TAUX_IR_FIXE = 0.24;
export const PLAFOND_MICRO_BNC = PARAMETRES_IR_2026.microBnc.plafond;

export function computeCalc(caTTC: number, tauxIR: number = TAUX_IR_FIXE) {
  const tva = caTTC * (TVA_RATE / (1 + TVA_RATE));
  const caHT = caTTC / (1 + TVA_RATE);
  const urssaf = caHT * URSSAF_RATE;
  const cfp = caHT * CFP_RATE;
  // Base sur laquelle le dashboard applique son taux d'IR (CA HT après cotisations)
  const baseIR = caHT - urssaf - cfp;
  const ir = baseIR * tauxIR;
  const net = baseIR - ir;
  return { caTTC, tva, caHT, urssaf, cfp, baseIR, ir, net };
}

export type Calc = ReturnType<typeof computeCalc>;

export function formatEur(val: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatPct(val: number, digits = 1) {
  return (val * 100).toFixed(digits).replace(".", ",") + " %";
}

export const MOIS_NOMS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const MOIS_NOMS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const MOIS_FR_IDX: Record<string, number> = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11,
};

export interface Mois {
  mois: number;
  annee: number;
}

/** Index absolu d'un mois, pour comparer facilement */
export const idxMois = (m: Mois) => m.annee * 12 + m.mois;
export const decaler = (m: Mois, n: number): Mois => {
  const d = new Date(m.annee, m.mois + n, 1);
  return { mois: d.getMonth(), annee: d.getFullYear() };
};
export const moisCourant = (ref: Date = new Date()): Mois => ({ mois: ref.getMonth(), annee: ref.getFullYear() });
export const libelleMois = (m: Mois, court = false) =>
  `${(court ? MOIS_NOMS_COURT : MOIS_NOMS_LONG)[m.mois]} ${m.annee}`;

// Règlement à 45 jours fin de mois : une facture du mois M est encaissée en M+2.
export const DELAI_ENCAISSEMENT = 2;

// URSSAF (mensuel) et TVA (CA3 mensuelle) : on déclare en M ce qui a été
// encaissé en M-1. La facture concernée est donc celle de M-1-2 = M-3.
export function moisFactureADeclarer(ref: Date = new Date()): Mois {
  return decaler(moisCourant(ref), -(DELAI_ENCAISSEMENT + 1));
}

/** Échéance URSSAF : dernier jour du mois de déclaration */
export function echeanceMois(m: Mois): Date {
  return new Date(m.annee, m.mois + 1, 0);
}

export function extractMoisFacture(sujet: string): Mois | null {
  const m = sujet.match(/Facture\s+(\p{L}+)\s+(\d{4})/iu);
  if (!m) return null;
  const mois = MOIS_FR_IDX[m[1].toLowerCase()];
  if (mois === undefined) return null;
  return { mois, annee: parseInt(m[2]) };
}

export function cleDeclaration(m: Mois, type: "urssaf" | "tva" | "ir"): string {
  return `${type}-${m.annee}-${String(m.mois + 1).padStart(2, "0")}`;
}

export function joursAvant(date: Date, ref: Date = new Date()): number {
  const a = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatDateCourte(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ───── Factures ─────

export interface Facture {
  id: string;
  sujet: string;
  expediteur: string;
  date: string;
  montant: number | null;
  snippet: string;
  isShine: boolean;
  attachments: { nom: string; attachmentId: string; messageId: string }[];
  dateEncaissement?: string;
}

export type StatutFacture = "attente" | "encaissee" | "a-declarer" | "a-verifier" | "declaree";

export interface FactureInfo {
  id: string;
  sujet: string;
  montantTTC: number | null;
  facture: Mois;
  encaissement: Mois;
  declaration: Mois;
  dateEncaissement?: string;
  urssafFaite: boolean;
  tvaFaite: boolean;
  provisionFaite: boolean;
  statut: StatutFacture;
}

export function analyserFactures(
  factures: Facture[],
  montantsPdf: Record<string, number | null>,
  faits: Set<string>,
  ref: Date = new Date(),
): FactureInfo[] {
  const maintenant = idxMois(moisCourant(ref));
  const parMois = new Map<string, FactureInfo>();
  for (const f of factures) {
    if (!f.isShine) continue;
    const mf = extractMoisFacture(f.sujet);
    if (!mf) continue;
    const encaissement = decaler(mf, DELAI_ENCAISSEMENT);
    const declaration = decaler(encaissement, 1);
    const urssafFaite = faits.has(cleDeclaration(mf, "urssaf"));
    const tvaFaite = faits.has(cleDeclaration(mf, "tva"));
    const iDecl = idxMois(declaration);
    let statut: StatutFacture;
    if (urssafFaite && tvaFaite) statut = "declaree";
    else if (iDecl === maintenant) statut = "a-declarer";
    else if (iDecl < maintenant) statut = "a-verifier";
    else statut = idxMois(encaissement) <= maintenant ? "encaissee" : "attente";
    const info: FactureInfo = {
      id: f.id,
      sujet: f.sujet,
      montantTTC: montantsPdf[f.id] ?? f.montant ?? null,
      facture: mf,
      encaissement,
      declaration,
      dateEncaissement: f.dateEncaissement,
      urssafFaite,
      tvaFaite,
      provisionFaite: faits.has(cleDeclaration(mf, "ir")),
      statut,
    };
    // Une facture par mois (la plus récente reçue l'emporte)
    const cle = `${mf.annee}-${mf.mois}`;
    if (!parMois.has(cle)) parMois.set(cle, info);
  }
  return [...parMois.values()].sort((a, b) => idxMois(b.facture) - idxMois(a.facture));
}

export const STATUTS: Record<StatutFacture, { label: string; cls: string }> = {
  attente: { label: "En attente", cls: "bg-line-soft text-muted" },
  encaissee: { label: "Encaissée", cls: "bg-[#1b2240] text-[#b7bcff]" },
  "a-declarer": { label: "À déclarer", cls: "bg-[#3a2e14] text-[#ffd98a]" },
  "a-verifier": { label: "Non cochée", cls: "bg-[#3a1e1c] text-[#ffb4aa]" },
  declaree: { label: "Déclarée", cls: "bg-[#13291e] text-[#8be6b5]" },
};
