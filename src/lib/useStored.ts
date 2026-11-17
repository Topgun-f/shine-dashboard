"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * État persisté dans le localStorage. La valeur stockée est lue après
 * l'hydratation (le rendu serveur utilise toujours `initial`).
 */
export function useStoredValue<T>(key: string, initial: T, initialSiAbsent?: T) {
  const [val, setVal] = useState<T>(initial);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- lecture du localStorage après hydratation */
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setVal(JSON.parse(raw));
      else if (initialSiAbsent !== undefined) {
        setVal(initialSiAbsent);
        localStorage.setItem(key, JSON.stringify(initialSiAbsent));
      }
    } catch {
      // silence
    }
    setPret(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // initialSiAbsent n'est lu qu'au premier chargement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const maj = useCallback(
    (v: T | ((prev: T) => T)) => {
      setVal((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // silence
        }
        return next;
      });
    },
    [key],
  );

  return [val, maj, pret] as const;
}

/** Ensemble de clés persisté (cases cochées) */
export function useStoredSet(key: string, defautSiAbsent: string[] = []) {
  const [liste, setListe] = useStoredValue<string[]>(key, [], defautSiAbsent);
  const set = useMemo(() => new Set(liste), [liste]);
  const basculer = useCallback(
    (cle: string, valeur?: boolean) => {
      setListe((prev) => {
        const s = new Set(prev);
        const activer = valeur ?? !s.has(cle);
        if (activer) s.add(cle);
        else s.delete(cle);
        return [...s];
      });
    },
    [setListe],
  );
  return [set, basculer] as const;
}
