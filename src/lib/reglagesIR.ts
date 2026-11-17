import {
  type FoyerFiscal,
  type RegimeBnc,
  type Situation,
  impotDeclarationsSeparees,
  impotImputableBnc,
  simulerIR,
} from "./impot";

export const REGLAGES_IR_KEY = "shine-simulation-ir";

export interface ReglagesIR {
  situation: Situation;
  enfants: number;
  parentIsole: boolean;
  regimeBnc: RegimeBnc;
  lieAuDashboard: boolean;
  montantBncManuel: number;
  salaires1: number;
  salaires2: number;
  autresRevenus: number;
  chargesDeductibles: number;
}

export const REGLAGES_IR_DEFAUT: ReglagesIR = {
  situation: "seul",
  enfants: 0,
  parentIsole: false,
  regimeBnc: "micro",
  lieAuDashboard: true,
  montantBncManuel: 0,
  salaires1: 0,
  salaires2: 0,
  autresRevenus: 0,
  chargesDeductibles: 0,
};

/**
 * Simule l'impôt du foyer à partir des réglages et du CA annuel prévu.
 * `caHT` : recettes HT de l'année ; `baseDashboard` : CA HT − URSSAF − CFP,
 * la base sur laquelle le dashboard applique son taux.
 */
export function simulerDepuisDashboard(r: ReglagesIR, caHT: number, baseDashboard: number) {
  const montantBncLie = r.regimeBnc === "micro" ? caHT : baseDashboard;
  const montantBnc = r.lieAuDashboard ? montantBncLie : r.montantBncManuel;
  const foyer: FoyerFiscal = {
    situation: r.situation,
    enfants: r.enfants,
    parentIsole: r.parentIsole,
    regimeBnc: r.regimeBnc,
    montantBnc,
    salaires1: r.salaires1,
    salaires2: r.situation === "couple" ? r.salaires2 : 0,
    autresRevenus: r.autresRevenus,
    chargesDeductibles: r.chargesDeductibles,
  };
  const res = simulerIR(foyer);
  const impotBnc = impotImputableBnc(foyer);
  const impotSepare = r.situation === "couple" ? impotDeclarationsSeparees(foyer) : null;
  // Taux qui, appliqué à la base du dashboard, redonne l'impôt imputable à l'activité
  const tauxEquivalent = r.lieAuDashboard && baseDashboard > 0 ? impotBnc / baseDashboard : null;
  return { foyer, montantBnc, montantBncLie, res, impotBnc, impotSepare, tauxEquivalent };
}

export type SimulationDashboard = ReturnType<typeof simulerDepuisDashboard>;
