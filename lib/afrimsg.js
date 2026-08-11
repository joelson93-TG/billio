// lib/afrimsg.js
/**
 * Wrapper centralisé pour l'API AfriMsg (WhatsApp Business).
 * Toutes les routes (send, bulk, Cloud Function) utilisent cette logique
 * pour garantir un comportement cohérent et facilement modifiable.
 */

const AFRIMSG_API_KEY = process.env.AFRIMSG_API_KEY;
const AFRIMSG_SENDER_ID = process.env.AFRIMSG_SENDER_ID || "Billio";
const AFRIMSG_BASE_URL = process.env.AFRIMSG_BASE_URL;

/**
 * Normalise un numéro de téléphone (retire tout sauf les chiffres).
 */
function normalizePhone(phone) {
  return String(phone || "").replace(/[^0-9]/g, "");
}

/**
 * Envoie un message WhatsApp unique via AfriMsg.
 * @param {string} to
 * @param {string} message
 * @param {{mediaUrl?: string, mediaType?: string, deviceId?: string}} options
 * @returns {Promise<{success: boolean, data?: any, error?: string, status?: number, messageId?: string, credits?: number}>}
 */
export async function sendWhatsAppMessage(to, message, options = {}) {
  if (!AFRIMSG_API_KEY || !AFRIMSG_BASE_URL) {
    return {
      success: false,
      error: "Configuration AfriMsg manquante (API_KEY ou BASE_URL non définis)",
    };
  }

  const normalizedPhone = normalizePhone(to);
  if (normalizedPhone.length < 8) {
    return { success: false, error: "Numéro de téléphone invalide", status: 422 };
  }

  const payload = {
    sender: AFRIMSG_SENDER_ID,
    to: normalizedPhone,
    message,
    type: "text",
  };
  if (options.mediaUrl) payload.media_url = options.mediaUrl;
  if (options.mediaType) payload.media_type = options.mediaType;
  if (options.deviceId) payload.device_id = options.deviceId;

  try {
    // 🔄 CORRIGÉ : ajout du chemin /messages/send (bug précédent : fetch sur BASE_URL nu)
    const response = await fetch(`${AFRIMSG_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AFRIMSG_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || `Erreur HTTP ${response.status}`,
        status: response.status,
        data,
      };
    }

    return { success: true, data, messageId: data.message_id, credits: data.credits };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 🆕 Appelle directement l'endpoint bulk natif d'AfriMsg
 * (plus efficace qu'une boucle manuelle côté application).
 */
export async function sendBulkViaApi(messages, delayMin = 3, delayMax = 8) {
  if (!AFRIMSG_API_KEY || !AFRIMSG_BASE_URL) {
    return { success: false, error: "Configuration AfriMsg manquante" };
  }

  const formatted = messages.map((m) => ({
    to: normalizePhone(m.to),
    message: m.message,
  }));

  try {
    const response = await fetch(`${AFRIMSG_BASE_URL}/messages/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFRIMSG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: formatted, delay_min: delayMin, delay_max: delayMax }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: data.message || "Erreur envoi en masse", status: response.status };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Envoie plusieurs messages séquentiellement avec délai aléatoire.
 * Conservé pour compatibilité / usage hors endpoint natif bulk.
 */
export async function sendBulkWhatsAppMessages(messages, delayMinSec = 3, delayMaxSec = 8) {
  const results = [];
  for (const { to, message } of messages) {
    const result = await sendWhatsAppMessage(to, message);
    results.push({ to, success: result.success, error: result.error });
    const delayMs = (Math.random() * (delayMaxSec - delayMinSec) + delayMinSec) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return results;
}

/**
 * Construit le message de rappel de réabonnement Billio (WhatsApp).
 */
export function buildBillioReminderMessage(companyName, status, daysLeft) {
  const name = companyName || "cher client";
  const greeting = `Bonjour ${name} 👋,`;
  const instructions = `\n\nPour continuer à profiter de toutes les fonctionnalités de Billio, rendez-vous dans votre espace :\n\n👉 *Paramètres société* > choisissez le forfait qui vous convient > payez en toute sécurité via *FedaPay*.\n\n💙 L'équipe Billio`;

  if (status === "expired" || daysLeft <= 0) {
    return `${greeting}\n\nVotre abonnement *Billio* a expiré. Votre accès complet est actuellement suspendu.${instructions}`;
  }

  return `${greeting}\n\nVotre abonnement *Billio* expire dans *${daysLeft} jour(s)*. Pensez à renouveler dès maintenant pour éviter toute interruption de service.${instructions}`;
}

export { normalizePhone };