import { NextResponse } from "next/server";

const AFRIMSG_BASE_URL = process.env.AFRIMSG_BASE_URL;
const AFRIMSG_API_KEY = process.env.AFRIMSG_API_KEY;

// Messages d'erreur correspondant aux codes de réponse AfriMsg
const ERROR_MESSAGES = {
  401: "Clé API manquante ou invalide",
  402: "Crédits insuffisants sur AfriMsg",
  403: "Plan sans accès API ou compte suspendu",
  422: "Paramètres invalides",
  424: "Échec de l'envoi côté WhatsApp",
};

export async function POST(request) {
  try {
    if (!AFRIMSG_API_KEY || !AFRIMSG_BASE_URL) {
      return NextResponse.json(
        { error: "Configuration AfriMsg manquante côté serveur" },
        { status: 500 }
      );
    }

    const { to, message, mediaUrl, mediaType, deviceId } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: "Le numéro (to) et le message sont requis" },
        { status: 422 }
      );
    }

    // Format international, chiffres uniquement
    const cleanPhone = to.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 8) {
      return NextResponse.json(
        { error: "Numéro de téléphone invalide" },
        { status: 422 }
      );
    }

    const payload = { to: cleanPhone, message };
    if (mediaUrl) payload.media_url = mediaUrl;
    if (mediaType) payload.media_type = mediaType;
    if (deviceId) payload.device_id = deviceId;

    const response = await fetch(`${AFRIMSG_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFRIMSG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: ERROR_MESSAGES[response.status] || data.message || "Erreur d'envoi" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data.message_id,
      credits: data.credits,
    });
  } catch (error) {
    console.error("Erreur /api/whatsapp/send :", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'envoi WhatsApp" },
      { status: 500 }
    );
  }
}