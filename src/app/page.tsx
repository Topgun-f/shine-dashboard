"use client";

import { useMemo, useState } from "react";
import AFaire from "@/components/dashboard/AFaire";
import AppHeader, { type Onglet, type Vue } from "@/components/dashboard/AppHeader";
import Echeances from "@/components/dashboard/Echeances";
import GraphiqueCA from "@/components/dashboard/GraphiqueCA";
import Indicateurs from "@/components/dashboard/Indicateurs";
import { NetCascade, Reserve } from "@/components/dashboard/Synthese";
import TableFactures, { ConnexionGmail } from "@/components/dashboard/TableFactures";
import SimulationIR from "@/components/SimulationIR";
import { agreger } from "@/lib/agregats";
import { TAUX_IR_FIXE, analyserFactures, computeCalc, idxMois } from "@/lib/finance";
import { REGLAGES_IR_DEFAUT, REGLAGES_IR_KEY, type ReglagesIR, simulerDepuisDashboard } from "@/lib/reglagesIR";
import { useFacturesShine } from "@/lib/useFacturesShine";
import { useStoredSet, useStoredValue } from "@/lib/useStored";

// Clé historique : les cases déjà cochées restent valables (clés par mois de facture)
const DECLARATIONS_KEY = "shine-urssaf-declarations-faites";
// CA d'avril 2026 déjà déclaré sur l'URSSAF avant la mise en place de ce suivi
const DECLARATIONS_DEFAUT = ["urssaf-2026-04"];

export default function Home() {
  const anneeCourante = new Date().getFullYear();
  const [onglet, setOnglet] = useState<Onglet>("apercu");
  const [annee, setAnnee] = useState(anneeCourante);
  const [vue, setVue] = useStoredValue<Vue>("shine-vue", "encaisse");
  const [periode, setPeriode] = useStoredValue("shine-periode-gmail", "548d");
  const [caProjection, setCaProjection] = useStoredValue("shine-ca-projection", 154000);
  const [modeTaux, setModeTaux] = useStoredValue<"fixe" | "simule">("shine-mode-taux-ir", "simule");
  const [reglagesStockes, setReglages] = useStoredValue<ReglagesIR>(REGLAGES_IR_KEY, REGLAGES_IR_DEFAUT);
  const [faits, basculer] = useStoredSet(DECLARATIONS_KEY, DECLARATIONS_DEFAUT);

  const g = useFacturesShine(periode);
  const reglages = useMemo(() => ({ ...REGLAGES_IR_DEFAUT, ...reglagesStockes }), [reglagesStockes]);

  // Simulation IR sur le CA annuel prévu → taux appliqué partout dans le dashboard
  const calcProjectionBrut = useMemo(() => computeCalc(caProjection), [caProjection]);
  const sim = useMemo(
    () => simulerDepuisDashboard(reglages, calcProjectionBrut.caHT, calcProjectionBrut.baseIR),
    [reglages, calcProjectionBrut],
  );
  const tauxSimuleActif = modeTaux === "simule" && sim.tauxEquivalent !== null;
  const tauxIR = tauxSimuleActif ? (sim.tauxEquivalent as number) : TAUX_IR_FIXE;

  const infos = useMemo(() => analyserFactures(g.factures, g.montantsPdf, faits), [g.factures, g.montantsPdf, faits]);
  const ag = useMemo(() => agreger(infos, annee, tauxIR), [infos, annee, tauxIR]);
  const calc = useMemo(
    () => computeCalc(vue === "encaisse" ? ag.caADate : caProjection, tauxIR),
    [vue, ag.caADate, caProjection, tauxIR],
  );

  // Estimation du CA annuel : encaissé + attendu + mois restants sans facture × moyenne
  const estimation = useMemo(() => {
    if (annee !== anneeCourante || ag.caADate + ag.caPrevu <= 0) return null;
    const moisVides = ag.mensuel.filter((v, i) => i > ag.maintenant.mois && v === 0 && ag.prevu[i] === 0).length;
    return ag.caADate + ag.caPrevu + moisVides * ag.moyenne;
  }, [ag, annee, anneeCourante]);

  const annees = useMemo(() => {
    const s = new Set<number>([anneeCourante]);
    for (const f of infos) s.add(f.encaissement.annee);
    return [...s].sort((a, b) => b - a);
  }, [infos, anneeCourante]);

  const toutesAnnee = useMemo(() => infos.filter((f) => f.encaissement.annee === annee), [infos, annee]);
  const nom = g.session?.user?.name ?? "";
  const initiales = nom ? nom.split(/\s+/).map((m) => m[0]).slice(0, 2).join("").toUpperCase() : null;
  const afficherConnexion = !g.connecte && g.status !== "loading";

  return (
    <main className="min-h-screen bg-ink text-sm text-txt">
      <AppHeader
        onglet={onglet}
        onOnglet={setOnglet}
        vue={vue}
        onVue={setVue}
        annee={annee}
        annees={annees}
        onAnnee={setAnnee}
        initiales={initiales}
      />

      <div className="mx-auto box-border flex max-w-[1280px] flex-col gap-6 px-5 pb-12 pt-7 sm:px-8">
        {onglet === "apercu" && (
          <>
            {afficherConnexion && <ConnexionGmail />}
            <AFaire ag={ag} tauxIR={tauxIR} faits={faits} basculer={basculer} onVoirEcheances={() => setOnglet("echeances")} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <NetCascade
                calc={calc}
                vue={vue}
                tauxIR={tauxIR}
                libelleTaux={tauxSimuleActif ? "Taux IR simulé" : "Taux IR fixe"}
                caProjection={caProjection}
                onCaProjection={setCaProjection}
                estimation={estimation}
                annee={annee}
              />
              <Reserve ag={ag} tauxIR={tauxIR} annee={annee} />
            </div>
            <Indicateurs
              ag={ag}
              annee={annee}
              calc={calc}
              tauxIR={tauxIR}
              tauxSimuleActif={tauxSimuleActif}
              onOuvrirImpots={() => setOnglet("impots")}
            />
            <GraphiqueCA ag={ag} annee={annee} />
            {g.connecte && (
              <TableFactures
                infos={infos}
                limite={5}
                loading={g.loading}
                error={g.error}
                pdfEnCours={g.pdfEnCours}
                onRafraichir={g.rafraichir}
                basculer={basculer}
                onVoirTout={() => setOnglet("factures")}
              />
            )}
          </>
        )}

        {onglet === "factures" && (
          afficherConnexion ? <ConnexionGmail /> : (
            <TableFactures
              infos={infos}
              loading={g.loading}
              error={g.error}
              email={g.session?.user?.email}
              pdfEnCours={g.pdfEnCours}
              periode={periode}
              onPeriode={setPeriode}
              onRafraichir={g.rafraichir}
              basculer={basculer}
            />
          )
        )}

        {onglet === "impots" && (
          <SimulationIR
            r={reglages}
            setR={(fn) => setReglages((prev) => fn({ ...REGLAGES_IR_DEFAUT, ...prev }))}
            sim={sim}
            caTTC={caProjection}
            caHT={calcProjectionBrut.caHT}
            baseDashboard={calcProjectionBrut.baseIR}
            annee={annee}
            modeTaux={modeTaux}
            onModeTaux={setModeTaux}
            encaisseesAnnee={ag.encaisseesAnnee}
            toutesAnnee={toutesAnnee}
            faits={faits}
            basculer={basculer}
          />
        )}

        {onglet === "echeances" && (
          <Echeances infos={infos.filter((f) => idxMois(f.declaration) >= idxMois({ mois: 0, annee: annee - 1 }))} faits={faits} basculer={basculer} annee={annee} />
        )}

        <p className="m-0 text-[11px] text-faint">
          Taux 2026 : URSSAF micro-BNC 25,6 %, CFP 0,2 %, TVA 20 %, barème IR LF 2026 · Non contractuel
        </p>
      </div>
    </main>
  );
}
