import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authOptions } from "@/lib/authOptions";
import { extractText } from "unpdf";

function extractMontants(text: string): number[] {
  const matches = text.matchAll(/(\d[\d\s]*[.,]\d{2})\s*€|€\s*(\d[\d\s]*[.,]\d{2})/g);
  const result: number[] = [];
  for (const m of matches) {
    const raw = (m[1] || m[2]).replace(/\s/g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0 && val < 1_000_000) result.push(val);
  }
  return [...new Set(result)];
}

function extractMontantPrincipal(text: string): number | null {
  const patterns = [
    /total\s+ttc\s*[:\s]*(\d[\d\s]*[.,]\d{2})\s*€/i,
    /montant\s+ttc\s*[:\s]*(\d[\d\s]*[.,]\d{2})\s*€/i,
    /net\s+à\s+payer\s*[:\s]*(\d[\d\s]*[.,]\d{2})\s*€/i,
    /total\s*[:\s]*(\d[\d\s]*[.,]\d{2})\s*€/i,
    /(\d[\d\s]*[.,]\d{2})\s*€\s*ttc/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  const tous = extractMontants(text);
  return tous.length > 0 ? Math.max(...tous) : null;
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
    const montant = extractMontantPrincipal(texte);
    const tous = extractMontants(texte);
    return NextResponse.json({ montant, tous, texte: texte.slice(0, 500) });
  } catch {
    return NextResponse.json({ error: "Impossible de lire le PDF" }, { status: 422 });
  }
}
