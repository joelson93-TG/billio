/**
 * Cloud Functions - Billio
 * ============================================================
 * 1) Configuration globale (maxInstances)
 * 2) Fonction PLANIFIÉE quotidienne (dailyReminderCheck) — envoie
 *    automatiquement des rappels de réabonnement :
 *    - WhatsApp (AfriMsg) en priorité si téléphone renseigné
 *    - 🆕 Email (Resend) en fallback automatique si pas de téléphone,
 *      ou en secours si l'envoi WhatsApp échoue techniquement
 * 3) Fonction HTTP de test (triggerReminderCheckNow)
 * 4) 🆕 Écriture des statistiques du dernier passage dans
 *    Firestore (stats/reminderRun) pour affichage temps réel
 *    dans le dashboard admin.
 *
 * Variables d'environnement (functions/.env) :
 *   AFRIMSG_API_KEY, AFRIMSG_BASE_URL, AFRIMSG_SENDER_ID
 *   RESEND_API_KEY, EMAIL_FROM
 *   MANUAL_TRIGGER_SECRET
 * ============================================================
 */

const { setGlobalOptions } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/scheduler");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { Resend } = require("resend"); // 🆕 npm install resend (dans /functions)

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

const AFRIMSG_API_KEY = process.env.AFRIMSG_API_KEY;
const AFRIMSG_BASE_URL = process.env.AFRIMSG_BASE_URL;
const AFRIMSG_SENDER_ID = process.env.AFRIMSG_SENDER_ID || "Billio";

const RESEND_API_KEY = process.env.RESEND_API_KEY; // 🆕
const EMAIL_FROM = process.env.EMAIL_FROM || "Billio <notifications@billio.com>"; // 🆕
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null; // 🆕

// ==========================================================
// 🔧 HELPERS - TÉLÉPHONE / WHATSAPP
// ==========================================================

function normalizePhone(phone) {
  return String(phone || "").replace(/[^0-9]/g, "");
}

async function sendWhatsAppMessage(to, message) {
  if (!AFRIMSG_API_KEY || !AFRIMSG_BASE_URL) {
    return { success: false, error: "Configuration AfriMsg manquante (functions/.env)" };
  }

  const cleanPhone = normalizePhone(to);
  if (cleanPhone.length < 8) {
    return { success: false, error: "Numéro de téléphone invalide" };
  }

  try {
    const response = await fetch(`${AFRIMSG_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AFRIMSG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sender: AFRIMSG_SENDER_ID, to: cleanPhone, message, type: "text" }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: data.message || `Erreur HTTP ${response.status}` };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function buildBillioReminderMessage(companyName, status, daysLeft) {
  const name = companyName || "cher client";
  const greeting = `Bonjour ${name} 👋,`;
  const instructions =
    `\n\nPour continuer à profiter de toutes les fonctionnalités de *Billio*, ` +
    `rendez-vous dans votre espace :\n\n` +
    `👉 *Paramètres société* > choisissez le forfait qui vous convient > ` +
    `payez en toute sécurité via *FedaPay*.\n\n💙 L'équipe Billio`;

  if (status === "expired" || daysLeft <= 0) {
    return `${greeting}\n\nVotre abonnement *Billio* a expiré. Votre accès complet est actuellement suspendu.${instructions}`;
  }

  return `${greeting}\n\nVotre abonnement *Billio* expire dans *${daysLeft} jour(s)*. Pensez à renouveler dès maintenant pour éviter toute interruption de service.${instructions}`;
}

// ==========================================================
// 🆕 HELPERS - EMAIL (Resend) — Fallback si pas de téléphone
// ==========================================================

function buildReminderEmailHtml(companyName, status, daysLeft) {
  const name = companyName || "cher client";
  const isExpired = status === "expired" || daysLeft <= 0;
  const title = isExpired
    ? "Votre abonnement Billio a expiré"
    : `Votre abonnement Billio expire dans ${daysLeft} jour(s)`;
  const message = isExpired
    ? "Votre accès complet est actuellement suspendu."
    : "Pensez à renouveler dès maintenant pour éviter toute interruption de service.";

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <body style="margin:0;padding:0;background-color:#0B1120;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#0F172A;border-radius:16px;overflow:hidden;border:1px solid #1E293B;">
          <tr><td style="background:linear-gradient(135deg,#3B82F6,#4F46E5);padding:24px;text-align:center;">
            <h1 style="color:#fff;font-size:20px;margin:0;">Billio</h1>
          </td></tr>
          <tr><td style="padding:32px;color:#E2E8F0;">
            <p style="font-size:15px;">Bonjour ${name} 👋,</p>
            <h2 style="color:${isExpired ? "#F87171" : "#FBBF24"};font-size:18px;margin:16px 0;">${title}</h2>
            <p style="font-size:14px;line-height:1.6;color:#94A3B8;">${message}</p>
            <p style="font-size:14px;line-height:1.6;color:#94A3B8;margin-top:20px;">
              Rendez-vous dans <strong>Paramètres société</strong> &gt; choisissez un forfait &gt; payez via <strong>FedaPay</strong>.
            </p>
            <div style="text-align:center;margin-top:28px;">
              <a href="https://app.billio.com/dashboard/settings"
                 style="background:linear-gradient(135deg,#3B82F6,#4F46E5);color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">
                Renouveler mon abonnement
              </a>
            </div>
          </td></tr>
          <tr><td style="padding:20px;text-align:center;border-top:1px solid #1E293B;">
            <p style="font-size:11px;color:#64748B;margin:0;">💙 L'équipe Billio</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

async function sendReminderEmail(to, companyName, status, daysLeft) {
  if (!resend) return { success: false, error: "RESEND_API_KEY manquant" };
  if (!to || !to.includes("@")) return { success: false, error: "Email invalide ou manquant" };

  const isExpired = status === "expired" || daysLeft <= 0;
  const subject = isExpired
    ? "⚠️ Votre abonnement Billio a expiré"
    : `⏳ Votre abonnement Billio expire dans ${daysLeft} jour(s)`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: buildReminderEmailHtml(companyName, status, daysLeft),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==========================================================
// 🔧 HELPERS - LOGIQUE ABONNEMENT
// ==========================================================

function computeDaysLeft(userData) {
  const sub = userData.subscription || {};
  const endDateStr = userData.trialEndDate || userData.endDate;
  if (endDateStr) {
    return Math.ceil((new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  if (sub.expiresAt) {
    const d = sub.expiresAt.toDate ? sub.expiresAt.toDate() : new Date(sub.expiresAt);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  return typeof sub.daysLeft === "number" ? sub.daysLeft : 30;
}

function alreadyRemindedToday(userData) {
  const last = userData.lastReminderSentAt;
  if (!last) return false;
  const lastDate = last.toDate ? last.toDate() : new Date(last);
  const now = new Date();
  return (
    lastDate.getFullYear() === now.getFullYear() &&
    lastDate.getMonth() === now.getMonth() &&
    lastDate.getDate() === now.getDate()
  );
}

async function resolveContact(userDoc, userData) {
  let phone = userData.phone || "";
  let companyName = userData.businessName || "";
  let email = userData.email || ""; // 🆕 email du compte Firebase Auth (quasi toujours présent)

  try {
    const companySnap = await db
      .collection("users")
      .doc(userDoc.id)
      .collection("settings")
      .doc("company")
      .get();
    if (companySnap.exists) {
      const companyData = companySnap.data();
      phone = companyData.phone || phone;
      companyName = companyData.companyName || companyName;
      email = companyData.email || email; // 🆕 priorité à l'email pro si renseigné
    }
  } catch (e) {
    logger.warn(`Impossible de lire settings/company pour ${userDoc.id}`);
  }

  return { phone, companyName, email };
}

// ==========================================================
// 🔁 CŒUR DE LA LOGIQUE — avec fallback Email + stats Firestore
// ==========================================================

async function runReminderCheck(triggeredBy = "auto") {
  const usersSnapshot = await db.collection("users").get();

  let sentWhatsappCount = 0; // 🆕
  let sentEmailCount = 0;    // 🆕
  let skippedCount = 0;
  let errorCount = 0;
  let unreachableCount = 0;  // 🆕 ni phone ni email (cas normalement impossible)

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const { phone, companyName, email } = await resolveContact(userDoc, userData);

    if (!phone && !email) {
      unreachableCount++;
      logger.warn(`⚠️ Client ${userDoc.id} totalement injoignable (ni phone ni email)`);
      continue;
    }

    const daysLeft = computeDaysLeft(userData);
    const sub = userData.subscription || {};
    let status = userData.subscriptionStatus || sub.status || "trial";
    if (status !== "expired" && daysLeft <= 0) status = "expired";

    const isTarget = status === "expired" || daysLeft <= 3;
    if (!isTarget) {
      skippedCount++;
      continue;
    }

    if (alreadyRemindedToday(userData)) {
      skippedCount++;
      continue;
    }

    let result;
    let channelUsed;

    if (phone) {
      const message = buildBillioReminderMessage(companyName, status, daysLeft);
      result = await sendWhatsAppMessage(phone, message);
      channelUsed = "whatsapp";
    } else {
      // 🆕 Pas de téléphone → fallback automatique par email
      result = await sendReminderEmail(email, companyName, status, daysLeft);
      channelUsed = "email";
    }

    if (result.success) {
      if (channelUsed === "whatsapp") sentWhatsappCount++;
      else sentEmailCount++;

      await userDoc.ref.update({
        lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastReminderChannel: channelUsed, // 🆕
      });

      // Pause anti-spam (utile surtout pour WhatsApp)
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else {
      errorCount++;
      logger.error(`Échec envoi rappel (${channelUsed}) pour ${userDoc.id} :`, result.error);

      // 🆕 Si WhatsApp échoue techniquement ET qu'un email existe → secours email
      if (channelUsed === "whatsapp" && email) {
        const emailFallback = await sendReminderEmail(email, companyName, status, daysLeft);
        if (emailFallback.success) {
          sentEmailCount++;
          errorCount--; // le secours a fonctionné, on annule le comptage d'erreur
          await userDoc.ref.update({
            lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReminderChannel: "email_fallback", // 🆕 traçable distinctement
          });
        }
      }
    }
  }

  const stats = {
    sentWhatsappCount,
    sentEmailCount,
    skippedCount,
    errorCount,
    unreachableCount,
    totalUsers: usersSnapshot.size,
    triggeredBy, // "auto" | "manual-test"
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // 🆕 Écriture des stats pour affichage temps réel dans le dashboard admin
  await db.collection("stats").doc("reminderRun").set(stats, { merge: true });

  return stats;
}

// ==========================================================
// ⏰ FONCTION PLANIFIÉE : chaque jour à 08h00 (heure de Lomé)
// ==========================================================
exports.dailyReminderCheck = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Africa/Lome",
    timeoutSeconds: 540, // 🆕 évite les coupures sur gros volumes
    memory: "256MiB",    // 🆕
  },
  async () => {
    logger.info("🔔 Démarrage de la vérification quotidienne des échéances Billio...");
    const result = await runReminderCheck("auto");
    logger.info(
      `✅ Terminé — WhatsApp: ${result.sentWhatsappCount}, Email: ${result.sentEmailCount}, ` +
      `Ignorés: ${result.skippedCount}, Erreurs: ${result.errorCount}, Injoignables: ${result.unreachableCount}`
    );
  }
);

// ==========================================================
// 🧪 DÉCLENCHEMENT MANUEL (test) — sans attendre 8h00
// ==========================================================
// Appel : POST https://<region>-<project>.cloudfunctions.net/triggerReminderCheckNow
// Header : Authorization: Bearer TON_SECRET
// 🔄 SÉCURISÉ : secret désormais transmis via header (plus via ?key= en query string)
exports.triggerReminderCheckNow = onRequest(
  { timeoutSeconds: 540, memory: "256MiB" },
  async (req, res) => {
    const authHeader = req.get("Authorization") || "";
    const providedKey = authHeader.replace("Bearer ", "").trim();

    if (!process.env.MANUAL_TRIGGER_SECRET || providedKey !== process.env.MANUAL_TRIGGER_SECRET) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }

    try {
      const result = await runReminderCheck("manual-test");
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error("Erreur triggerReminderCheckNow :", error);
      res.status(500).json({ error: error.message });
    }
  }
);