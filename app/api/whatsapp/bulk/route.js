import { NextResponse } from "next/server";

const AFRIMSG_BASE_URL = process.env.AFRIMSG_BASE_URL;
const AFRIMSG_API_KEY = process.env.AFRIMSG_API_KEY;

export async function POST(request) {
  try {
    const { messages, delayMin = 3, delayMax = 8 } = await request.json();

    if (!Array.isArray(messages) || messages.length < 2 || messages.length > 500) {
      return NextResponse.json(
        { error: "Le tableau 'messages' doit contenir entre 2 et 500 éléments" },
        { status: 422 }
      );
    }

    const formatted = messages.map((m) => ({
      to: m.to.replace(/[^0-9]/g, ""),
      message: m.message,
    }));

    const response = await fetch(`${AFRIMSG_BASE_URL}/messages/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFRIMSG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: formatted,
        delay_min: delayMin,
        delay_max: delayMax,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erreur envoi en masse" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Erreur /api/whatsapp/bulk :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}