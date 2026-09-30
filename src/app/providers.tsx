"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Re-vérifie la session toutes les 5 min et au retour sur l'onglet :
  // le callback jwt renouvelle alors le token Google avant qu'il n'expire.
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
