// lib/email.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Domaine vérifié dans Resend
const EMAIL_FROM = process.env.EMAIL_FROM || "Billio <rappels@rappel.billio.jblessconsulting.com>";

/**
 * Génère le HTML de l'email de rappel selon le statut de l'abonnement
 */
function buildReminderEmailHtml(companyName, status, daysLeft) {
  const isExpired = status === "expired" || daysLeft <= 0;

  const title = isExpired
    ? "Votre abonnement Billio a expiré"
    : `Votre abonnement Billio expire dans ${daysLeft} jour(s)`;

  const message = isExpired
    ? "Votre accès complet est actuellement suspendu. Renouvelez dès maintenant pour continuer à utiliser Billio sans interruption."
    : "Pensez à renouveler votre abonnement avant l'échéance pour éviter toute coupure de service.";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0B1120; color: #fff; border-radius: 16px;">
      <h2 style="color: #3B82F6; margin-bottom: 4px;">Billio</h2>
      <p style="color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Notification d'abonnement</p>

      <h3 style="color: #fff; margin-top: 24px;">${title}</h3>
      <p style="color: #CBD5E1; line-height: 1.6;">
        Bonjour <strong>${companyName || "cher client"}</strong>,<br/><br/>
        ${message}
      </p>

      <div style="margin: 24px 0; padding: 16px; background: #1E293B; border-radius: 12px; border: 1px solid #334155;">
        <p style="margin: 0; color: #94A3B8; font-size: 13px;">
          👉 Rendez-vous dans <strong>Paramètres société</strong> &gt; choisissez votre forfait &gt; payez en toute sécurité via <strong>FedaPay</strong>.
        </p>
      </div>

      <p style="color: #64748B; font-size: 12px; margin-top: 32px;">💙 L'équipe Billio</p>
    </div>
  `;
}

/**
 * Envoie un email de rappel (utilisé par /api/email/send et /api/email/test)
 * @param {string} to
 * @param {string} companyName
 * @param {string} status
 * @param {number} daysLeft
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function sendReminderEmail(to, companyName, status, daysLeft) {
  try {
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return { success: false, error: "Adresse email destinataire invalide" };
    }

    const isExpired = status === "expired" || daysLeft <= 0;
    const subject = isExpired
      ? "⚠️ Votre abonnement Billio a expiré"
      : `⏳ Votre abonnement Billio expire dans ${daysLeft} jour(s)`;

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: buildReminderEmailHtml(companyName, status, daysLeft),
    });

    if (error) {
      return { success: false, error: error.message || "Erreur Resend inconnue" };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}