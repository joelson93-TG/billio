// app/api/whatsapp/send/route.js
import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/afrimsg";

const ERROR_MESSAGES = {
  401: "Clé API manquante ou invalide",
  402: "Crédits insuffisants sur AfriMsg",
  403: "Plan sans accès API ou compte suspendu",
  422: "Paramètres invalides",
  424: "Échec de l'envoi côté WhatsApp",
};

export async function POST(request) {
  try {
    const { to, message, mediaUrl, mediaType, deviceId } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: "Le numéro (to) et le message sont requis" },
        { status: 422 }
      );
    }

    const result = await sendWhatsAppMessage(to, message, { mediaUrl, mediaType, deviceId });

    if (!result.success) {
      const status = result.status || 500;
      return NextResponse.json(
        { error: ERROR_MESSAGES[status] || result.error || "Erreur d'envoi" },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      credits: result.credits,
    });
  } catch (error) {
    console.error("Erreur /api/whatsapp/send :", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'envoi WhatsApp" },
      { status: 500 }
    );
  }
}