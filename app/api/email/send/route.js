// app/api/email/send/route.js
import { NextResponse } from "next/server";
import { sendReminderEmail } from "@/lib/email";

export async function POST(request) {
  try {
    const { to, companyName, status, daysLeft } = await request.json();

    if (!to) {
      return NextResponse.json({ error: "Email requis" }, { status: 422 });
    }

    const result = await sendReminderEmail(to, companyName, status, daysLeft);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur /api/email/send :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}