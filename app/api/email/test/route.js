// app/api/email/test/route.js
/**
 * Route de TEST manuel de la connexion Resend (Email).
 * Complète le test AfriMsg : permet de vérifier que le canal
 * de secours (fallback email) fonctionne bien lui aussi.
 */
import { NextResponse } from "next/server";
import { sendReminderEmail } from "@/lib/email";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Adresse email valide requise" },
        { status: 422 }
      );
    }

    const result = await sendReminderEmail(email, "Client Test", "active", 3);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Échec de l'envoi de l'email de test" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Email de test envoyé à ${email} ! Vérifiez votre boîte de réception (et vos spams).`,
    });
  } catch (error) {
    console.error("Erreur /api/email/test :", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors du test email" },
      { status: 500 }
    );
  }
}