"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import type { Facture } from "./finance";
import { useStoredValue } from "./useStored";

/**
 * Récupère les factures Shine depuis Gmail, puis lit le montant TTC de chaque
 * PDF joint (mis en cache dans le navigateur pour ne pas relire les PDF).
 */
export function useFacturesShine(periode: string) {
  const { data: session, status } = useSession();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [montantsPdf, setMontantsPdf, montantsPrets] = useStoredValue<Record<string, number | null>>("shine-montants-pdf", {});
  const montantsRef = useRef(montantsPdf);
  useEffect(() => {
    montantsRef.current = montantsPdf;
  }, [montantsPdf]);
  const [pdfEnCours, setPdfEnCours] = useState<string | null>(null);
  const pdfDemandes = useRef(new Set<string>());

  const rafraichir = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ periode, pattern: "facture@shine.fr" });
      const res = await fetch(`/api/gmail?${params.toString()}`);
      if (res.status === 401) {
        signIn("google");
        return;
      }
      if (!res.ok) throw new Error("Erreur lors de la récupération");
      const data = await res.json();
      setFactures(data.factures || []);
    } catch {
      setError("Impossible de charger les factures.");
    } finally {
      setLoading(false);
    }
  }, [periode]);

  // Refresh token Google révoqué/expiré : on relance la connexion Google
  // automatiquement (une seule fois par onglet pour éviter une boucle).
  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError" && !sessionStorage.getItem("gmail-reauth")) {
      sessionStorage.setItem("gmail-reauth", "1");
      signIn("google");
    } else if (session && !session.error) {
      sessionStorage.removeItem("gmail-reauth");
    }
  }, [session]);

  const connecte = !!session?.accessToken && !session?.error;
  useEffect(() => {
    // On ne recharge pas les factures à chaque refetch de session (toutes les
    // 5 min), seulement quand on (re)devient connecté ou que la période change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (connecte) rafraichir();
  }, [connecte, rafraichir]);

  // Lecture des montants dans les PDF, une facture à la fois
  useEffect(() => {
    if (!montantsPrets) return;
    const aLire = factures.filter(
      (f) => f.isShine && (f.attachments?.length ?? 0) > 0 && !(f.id in montantsRef.current) && !pdfDemandes.current.has(f.id),
    );
    if (aLire.length === 0) return;
    let annule = false;
    (async () => {
      for (const f of aLire) {
        if (annule) break;
        pdfDemandes.current.add(f.id);
        setPdfEnCours(f.id);
        try {
          const att = f.attachments[0];
          const res = await fetch(`/api/gmail/attachment?messageId=${att.messageId}&attachmentId=${att.attachmentId}`);
          if (res.ok) {
            const data = await res.json();
            setMontantsPdf((prev) => ({ ...prev, [f.id]: typeof data.montant === "number" ? data.montant : null }));
          }
        } catch {
          // on garde le montant lu dans le mail
        }
      }
      setPdfEnCours(null);
    })();
    return () => {
      annule = true;
    };
  }, [factures, montantsPrets, setMontantsPdf]);

  return { session, status, connecte, factures, loading, error, rafraichir, montantsPdf, pdfEnCours };
}
