import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const session = await getServerSession();

  if (!session || !(session as { accessToken?: string }).accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const accessToken = (session as { accessToken: string }).accessToken;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  // Cherche les emails avec "facture" ou "invoice" dans le sujet
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "subject:(facture OR invoice OR reçu OR receipt) newer_than:90d",
    maxResults: 20,
  });

  const messages = listRes.data.messages || [];

  const factures = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const headers = detail.data.payload?.headers || [];
      const get = (name: string) =>
        headers.find((h) => h.name === name)?.value || "";

      const snippet = detail.data.snippet || "";
      // Extraction simple d'un montant dans le snippet
      const montantMatch = snippet.match(/(\d+[\s,.]?\d*)\s*€/);
      const montant = montantMatch ? parseFloat(montantMatch[1].replace(/\s/g, "").replace(",", ".")) : null;

      return {
        id: msg.id,
        sujet: get("Subject"),
        expediteur: get("From"),
        date: get("Date"),
        montant,
        snippet,
      };
    })
  );

  return NextResponse.json({ factures });
}
