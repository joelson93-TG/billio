import { NextResponse } from "next/server";

const AFRIMSG_BASE_URL = process.env.AFRIMSG_BASE_URL;
const AFRIMSG_API_KEY = process.env.AFRIMSG_API_KEY;

const ERROR_MESSAGES = {
  401: "Clé API manquante ou invalide",
  402: "Crédits insuffisants sur AfriMsg",
  403: "Plan sans accès API ou compte suspendu",
  422: "Paramètres invalides",
  424: "Échec de l'envoi côté WhatsApp",
};

/**
 * Route de test : vérifie que la connexion à l'API AfriMsg fonctionne
 * en envoyant un vrai message WhatsApp de test à un numéro fourni par l'admin.
 */
export async function POST(request) {
  try {
    if (!AFRIMSG_API_KEY || !AFRIMSG_BASE_URL) {
      return NextResponse.json(
        { error: "Configuration AfriMsg manquante côté serveur" },
        { status: 500 }
      );
    }

    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: "Veuillez renseigner un numéro de téléphone pour le test" },
        { status: 422 }
      );
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 8) {
      return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 422 });
    }

    const testMessage =
      `✅ Test de connexion *Billio* ↔ AfriMsg réussi !\n\n` +
      `Date : ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Lome" })}\n\n` +
      `Si vous recevez ce message, l'envoi automatique des rappels de réabonnement fonctionne correctement. 🎉`;

    const response = await fetch(`${AFRIMSG_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFRIMSG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: cleanPhone, message: testMessage }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: ERROR_MESSAGES[response.status] || data.message || "Erreur d'envoi" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Message de test envoyé avec succès à +${cleanPhone}`,
      messageId: data.message_id,
      credits: data.credits,
    });
  } catch (error) {
    console.error("Erreur /api/whatsapp/test :", error);
    return NextResponse.json({ error: "Erreur serveur lors du test AfriMsg" }, { status: 500 });
  }
}