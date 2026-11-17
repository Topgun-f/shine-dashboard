"use client";

import { signIn, signOut } from "next-auth/react";
import { BoutonSecondaire, Card, IconeRefresh, Titre } from "@/components/ui";
import {
  type FactureInfo,
  MOIS_NOMS_COURT,
  MOIS_NOMS_LONG,
  STATUTS,
  cleDeclaration,
  formatEur,
  libelleMois,
} from "@/lib/finance";

export function ConnexionGmail() {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 border-[#2a3060] bg-[#11142a] p-6">
      <div>
        <div className="font-display text-[15px] font-semibold">Importer tes factures Shine</div>
        <div className="mt-0.5 text-[13px] text-muted">
          Connecte ton compte Google pour lire les factures envoyées par facture@shine.fr et remplir le dashboard.
        </div>
      </div>
      <button
        type="button"
        onClick={() => signIn("google")}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Connecter Gmail
      </button>
    </Card>
  );
}

const PERIODES = [
  { label: "12 mois", value: "365d" },
  { label: "18 mois", value: "548d" },
  { label: "2 ans", value: "730d" },
];

function CaseDeclaration({ fait, onChange, label }: { fait: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
      <input type="checkbox" checked={fait} onChange={onChange} className="h-4 w-4 cursor-pointer accent-[#3dd68c]" />
      <span className={fait ? "text-faint" : "text-muted"}>{label}</span>
    </label>
  );
}

export default function TableFactures({
  infos, limite, loading, error, email, pdfEnCours, periode, onPeriode, onRafraichir, basculer, onVoirTout,
}: {
  infos: FactureInfo[];
  limite?: number;
  loading: boolean;
  error: string | null;
  email?: string | null;
  pdfEnCours: string | null;
  periode?: string;
  onPeriode?: (p: string) => void;
  onRafraichir: () => void;
  basculer: (cle: string) => void;
  onVoirTout?: () => void;
}) {
  const lignes = limite ? infos.slice(0, limite) : infos;

  return (
    <Card aria-labelledby="titre-factures" className="flex flex-col gap-3.5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Titre id="titre-factures" sub={`Importées depuis Gmail · facture@shine.fr${email ? ` · ${email}` : ""}`}>
          Factures Shine
        </Titre>
        <div className="flex flex-wrap items-center gap-2">
          {onPeriode && periode && (
            <div role="group" aria-label="Période de recherche" className="flex rounded-[10px] border border-line bg-bar p-[3px]">
              {PERIODES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={periode === p.value}
                  onClick={() => onPeriode(p.value)}
                  className={`rounded-[7px] px-3 py-[7px] text-xs ${periode === p.value ? "bg-[#262b38] font-semibold text-txt" : "text-muted hover:text-txt"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <BoutonSecondaire onClick={onRafraichir} disabled={loading}>
            <IconeRefresh className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Chargement…" : "Actualiser"}
          </BoutonSecondaire>
          {onPeriode && (
            <button type="button" onClick={() => signOut()} className="px-2 text-xs text-faint hover:text-muted">
              Déconnecter
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-[#3a1e1c] px-3 py-2 text-xs text-[#ffb4aa]">{error}</div>}

      {lignes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-faint">
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Facture</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Montant TTC</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Encaissement</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">URSSAF</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">TVA</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((f) => {
                const st = STATUTS[f.statut];
                const decl = `${MOIS_NOMS_COURT[f.declaration.mois].toLowerCase()}. ${f.declaration.annee}`;
                return (
                  <tr key={f.id} className="hover:bg-white/[0.02]">
                    <td className="border-b border-[#1b1f28] p-3 font-semibold">Facture {libelleMois(f.facture).toLowerCase()}</td>
                    <td className="border-b border-[#1b1f28] p-3 text-right font-semibold">
                      {pdfEnCours === f.id ? <span className="text-faint">lecture…</span> : f.montantTTC !== null ? formatEur(f.montantTTC) : "—"}
                    </td>
                    <td className="border-b border-[#1b1f28] p-3 text-muted">
                      {MOIS_NOMS_LONG[f.encaissement.mois]} {f.encaissement.annee}
                    </td>
                    <td className="border-b border-[#1b1f28] p-3">
                      <CaseDeclaration fait={f.urssafFaite} onChange={() => basculer(cleDeclaration(f.facture, "urssaf"))} label={`décl. ${decl}`} />
                    </td>
                    <td className="border-b border-[#1b1f28] p-3">
                      <CaseDeclaration fait={f.tvaFaite} onChange={() => basculer(cleDeclaration(f.facture, "tva"))} label={`décl. ${decl}`} />
                    </td>
                    <td className="border-b border-[#1b1f28] p-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-faint">
          {loading ? "Lecture des factures Shine…" : "Aucune facture Shine trouvée sur cette période"}
        </div>
      )}

      {limite && infos.length > limite && onVoirTout && (
        <button type="button" onClick={onVoirTout} className="self-start text-xs text-ca hover:text-ca-light">
          Voir les {infos.length} factures →
        </button>
      )}
    </Card>
  );
}
