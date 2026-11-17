"use client";

import { IconeLogo, Segmented } from "@/components/ui";

export type Onglet = "apercu" | "factures" | "impots" | "echeances";
export type Vue = "encaisse" | "projection";

const ONGLETS: { value: Onglet; label: string }[] = [
  { value: "apercu", label: "Vue d'ensemble" },
  { value: "factures", label: "Factures" },
  { value: "impots", label: "Impôts" },
  { value: "echeances", label: "Échéances" },
];

export default function AppHeader({
  onglet, onOnglet, vue, onVue, annee, annees, onAnnee, initiales,
}: {
  onglet: Onglet;
  onOnglet: (o: Onglet) => void;
  vue: Vue;
  onVue: (v: Vue) => void;
  annee: number;
  annees: number[];
  onAnnee: (a: number) => void;
  initiales: string | null;
}) {
  return (
    <header className="border-b border-line-soft bg-bar">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-4 px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-ca">
            <IconeLogo />
          </div>
          <span className="font-display text-[17px] font-bold tracking-[-0.01em]">Shine</span>
          <span className="text-xs text-faint">Micro-BNC · TVA 20 %</span>
        </div>

        <nav aria-label="Sections" className="flex flex-auto flex-wrap gap-1">
          {ONGLETS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-current={onglet === o.value ? "page" : undefined}
              onClick={() => onOnglet(o.value)}
              className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
                onglet === o.value ? "bg-chip font-semibold text-txt" : "text-muted hover:text-txt"
              }`}
            >
              {o.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          {onglet === "apercu" && (
            <Segmented
              label="Période"
              value={vue}
              onChange={onVue}
              options={[
                { value: "encaisse", label: "Encaissé à date" },
                { value: "projection", label: "Projection annuelle" },
              ]}
            />
          )}
          <label className="sr-only" htmlFor="annee">Année</label>
          <select
            id="annee"
            value={annee}
            onChange={(e) => onAnnee(Number(e.target.value))}
            className="rounded-[10px] border border-line bg-[#151821] px-3 py-2 text-xs font-semibold text-txt outline-none focus:border-ca"
          >
            {annees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {initiales && (
            <div
              role="img"
              aria-label="Compte Google connecté"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#1f2a22] text-xs font-bold text-net"
            >
              {initiales}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
