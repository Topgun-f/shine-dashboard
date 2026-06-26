import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authOptions } from "@/lib/authOptions";

function extractMontant(text: string): number | null {
  // Cherche tous les montants au format "1 234,56 €" ou "€ 1 234,56"
  // On limite à 3 groupes de chiffres max (évite de capturer "2026 12 720")
  const regex = /(\d{1,3}(?:[\s]\d{3}){0,2}[.,]\d{2})\s*€|€\s*(\d{1,3}(?:[\s]\d{3}){0,2}[.,]\d{2})/g;
  const candidates: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const raw = (m[1] || m[2]).replace(/\s/g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 1 && val <= 99999) candidates.push(val);
  }
  if (candidates.length === 0) return null;
  // Retourne le montant le plus élevé (généralement le total TTC)
  return Math.max(...candidates);
}

function decodeBase64(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractTextFromParts(parts: {mimeType?: string | null; body?: {data?: string | null}; parts?: unknown[]}[]): string {
  let text = "";
  for (const part of parts) {
    if ((part.mimeType === "text/plain" || part.mimeType === "text/html") && part.body?.data) {
      text += decodeBase64(part.body.data);
    }
    if (part.parts) {
      text += extractTextFromParts(part.parts as {mimeType?: string | null; body?: {data?: string | null}; parts?: unknown[]}[]);
    }
  }
  return text;
}

function toGmailDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !(session as { accessToken?: string }).accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const accessToken = (session as { accessToken: string }).accessToken;
  const { searchParams } = new URL(req.url);
  const periode = searchParams.get("periode") || "365d";
  const dateDebut = searchParams.get("dateDebut");
  const dateFin = searchParams.get("dateFin");
  const pattern = searchParams.get("pattern") || "";

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  // Construction de la query Gmail
  let timeFilter = "";
  if (dateDebut && dateFin) {
    timeFilter = `after:${toGmailDate(dateDebut)} before:${toGmailDate(dateFin)}`;
  } else {
    timeFilter = `newer_than:${periode}`;
  }

  const patternFilter = pattern
    ? `(subject:${pattern} OR from:${pattern} OR ${pattern})`
    : "from:facture@shine.fr OR subject:(facture OR invoice OR reçu OR receipt)";

  const q = `(${patternFilter}) ${timeFilter}`;

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];

  const factures = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const headers = detail.data.payload?.headers || [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

      const sujet = get("Subject");
      const expediteur = get("From");
      const date = get("Date");
      const snippet = detail.data.snippet || "";

      const parts = detail.data.payload?.parts || [];
      const bodyText = extractTextFromParts(parts);
      const fullText = snippet + " " + bodyText;

      const attachments: { nom: string; attachmentId: string; messageId: string }[] = [];
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith(".pdf") && part.body?.attachmentId) {
          attachments.push({
            nom: part.filename,
            attachmentId: part.body.attachmentId,
            messageId: msg.id!,
          });
        }
      }

      const montant = extractMontant(fullText);
      const isShine = expediteur.includes("shine.fr");

      return { id: msg.id, sujet, expediteur, date, montant, snippet, isShine, attachments };
    })
  );

  factures.sort((a, b) => {
    if (a.isShine && !b.isShine) return -1;
    if (!a.isShine && b.isShine) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return NextResponse.json({ factures });
}
