// app/api/whatsapp/bulk/route.js
import { NextResponse } from "next/server";
import { sendBulkViaApi } from "@/lib/afrimsg";

export async function POST(request) {
  try {
    const { messages, delayMin = 3, delayMax = 8 } = await request.json();

    if (!Array.isArray(messages) || messages.length < 2 || messages.length > 500) {
      return NextResponse.json(
        { error: "Le tableau 'messages' doit contenir entre 2 et 500 éléments" },
        { status: 422 }
      );
    }

    const result = await sendBulkViaApi(messages, delayMin, delayMax);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erreur envoi en masse" },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    console.error("Erreur /api/whatsapp/bulk :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}