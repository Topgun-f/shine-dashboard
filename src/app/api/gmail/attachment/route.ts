import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authOptions } from "@/lib/authOptions";
import { extractText } from "unpdf";

function parseMontant(raw: string): number | null {
  const val = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return !isNaN(val) && val >= 1 && val <= 99999 ? val : null;
}

function extractMontantTotal(text: string): number | null {
  // Cherche la DERNIÈRE occurrence de "Total" suivie d'un montant
  const regex = /total[^0-9\n]{0,30}(\d{1,3}(?:[\s ]\d{3})*[.,]\d{2})\s*€?/gi;
  let dernier: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const val = parseMontant(m[1]);
    if (val !== null) dernier = val;
  }
  if (dernier !== null) return dernier;

  // Fallback : patterns spécifiques TTC
  const fallbacks = [
    /montant\s+ttc\s*[:\s]*(\d{1,3}(?:[\s ]\d{3})*[.,]\d{2})\s*€/i,
    /net\s+à\s+payer\s*[:\s]*(\d{1,3}(?:[\s ]\d{3})*[.,]\d{2})\s*€/i,
    /(\d{1,3}(?:[\s ]\d{3})*[.,]\d{2})\s*€\s*ttc/i,
  ];
  for (const p of fallbacks) {
    const fm = text.match(p);
    if (fm) {
      const val = parseMontant(fm[1]);
      if (val !== null) return val;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as { accessToken?: string }).accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const accessToken = (session as { accessToken: string }).accessToken;
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");

  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const attachRes = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const base64Data = attachRes.data.data;
  if (!base64Data) return NextResponse.json({ error: "Pièce jointe vide" }, { status: 404 });

  const buffer = Buffer.from(base64Data.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  try {
    const uint8 = new Uint8Array(buffer);
    const { text: lines } = await extractText(uint8, { mergePages: true });
    const texte = Array.isArray(lines) ? lines.join(" ") : String(lines);
    const montant = extractMontantTotal(texte);
    return NextResponse.json({ montant, tous: montant ? [montant] : [], texte: texte.slice(0, 500) });
  } catch {
    return NextResponse.json({ error: "Impossible de lire le PDF" }, { status: 422 });
  }
}
