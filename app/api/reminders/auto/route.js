import { NextResponse } from "next/server";
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  sendWhatsAppMessage,
  sendBulkViaApi,
  buildBillioReminderMessage,
} from "@/lib/afrimsg";
import { sendReminderEmail } from "@/lib/email";

// ✅ Clé secrète pour sécuriser le cron
const CRON_SECRET = process.env.CRON_SECRET;

// ─── Helpers ────────────────────────────────────────────

function computeDaysLeft(userData) {
  const sub = userData.subscription || {};
  const endDateStr = userData.trialEndDate || userData.endDate;

  if (endDateStr) {
    return Math.ceil(
      (new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }
  if (sub.expiresAt) {
    const d = sub.expiresAt.toDate
      ? sub.expiresAt.toDate()
      : new Date(sub.expiresAt);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  return typeof sub.daysLeft === "number" ? sub.daysLeft : 30;
}

function isValidEmail(email) {
  return typeof email === "string" && email.includes("@");
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^0-9]/g, "");
}

// ─── Route GET (appelée par Vercel Cron) ────────────────

export async function GET(req) {
  // ✅ Vérification sécurité
  const authHeader = req.headers.get("authorization");
  if (
    CRON_SECRET &&
    authHeader !== `Bearer ${CRON_SECRET}`
  ) {
    return NextResponse.json(
      { error: "Non autorisé" },
      { status: 401 }
    );
  }

  // Compteurs
  let sentWhatsapp = 0;
  let sentEmail = 0;
  let skipped = 0;
  let errors = 0;
  let unreachable = 0;

  const whatsappTargets = []; // Pour l'envoi bulk

  try {
    // ── 1. Récupérer tous les utilisateurs ──────────────
    const usersSnap = await getDocs(collection(db, "users"));

    const emailTargets = []; // Traitement séquentiel email

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;

      // ── 2. Calculer le statut ────────────────────────
      const sub = userData.subscription || {};
      const daysLeft = computeDaysLeft(userData);

      let status =
        userData.subscriptionStatus || sub.status || "trial";

      if (userData.forceDisabled) {
        status = "disabled";
      } else if (status !== "expired" && daysLeft <= 0) {
        status = "expired";
      }

      // ── 3. Récupérer téléphone et email ──────────────
      let phone =
        userData.whatsappNumber || userData.phone || "";
      let email = userData.email || "";
      let companyName = userData.businessName || "cher client";

      // Chercher dans settings/company si manquant
      if (!phone || !email || !companyName) {
        try {
          const companySnap = await getDoc(
            doc(db, "users", uid, "settings", "company")
          );
          if (companySnap.exists()) {
            const c = companySnap.data();
            phone = phone || c.phone || "";
            email = email || c.email || "";
            companyName = companyName || c.companyName || "cher client";
          }
        } catch (_) {}
      }

      // ── 4. Vérifier si éligible au rappel ────────────
      const isEligible =
        (status === "expired" || daysLeft <= 3) &&
        status !== "disabled";

      if (!isEligible) {
        skipped++;
        continue;
      }

      // ── 5. Vérifier si joignable ─────────────────────
      const hasPhone = normalizePhone(phone).length >= 8;
      const hasEmail = isValidEmail(email);

      if (!hasPhone && !hasEmail) {
        unreachable++;
        continue;
      }

      // ── 6. Routing : WhatsApp prioritaire ────────────
      if (hasPhone) {
        whatsappTargets.push({
          uid,
          to: phone,
          message: buildBillioReminderMessage(
            companyName,
            status,
            daysLeft
          ),
          companyName,
        });
      } else if (hasEmail) {
        emailTargets.push({
          uid,
          email,
          companyName,
          status,
          daysLeft,
        });
      }
    }

    // ── 7. Envoi WhatsApp BULK ──────────────────────────
    if (whatsappTargets.length >= 2) {
      const messages = whatsappTargets.map((t) => ({
        to: t.to,
        message: t.message,
      }));

      const bulkResult = await sendBulkViaApi(
        messages,
        3,  // délai min secondes
        8   // délai max secondes
      );

      if (bulkResult.success) {
        sentWhatsapp += whatsappTargets.length;

        // Mise à jour Firestore pour chaque user WhatsApp
        await Promise.all(
          whatsappTargets.map((t) =>
            updateDoc(doc(db, "users", t.uid), {
              lastReminderSentAt: serverTimestamp(),
              lastReminderChannel: "whatsapp",
            }).catch(() => {})
          )
        );
      } else {
        errors += whatsappTargets.length;
        console.error("Erreur bulk WhatsApp :", bulkResult.error);
      }

    } else if (whatsappTargets.length === 1) {
      // Envoi unitaire si 1 seul destinataire
      const t = whatsappTargets[0];
      const result = await sendWhatsAppMessage(t.to, t.message);

      if (result.success) {
        sentWhatsapp++;
        await updateDoc(doc(db, "users", t.uid), {
          lastReminderSentAt: serverTimestamp(),
          lastReminderChannel: "whatsapp",
        }).catch(() => {});
      } else {
        errors++;
      }
    }

    // ── 8. Envoi Emails séquentiel ──────────────────────
    for (const target of emailTargets) {
      try {
        const result = await sendReminderEmail(
          target.email,
          target.companyName,
          target.status,
          target.daysLeft
        );

        if (result.success) {
          sentEmail++;
          await updateDoc(doc(db, "users", target.uid), {
            lastReminderSentAt: serverTimestamp(),
            lastReminderChannel: "email",
          }).catch(() => {});
        } else {
          errors++;
          console.error(
            `Erreur email ${target.uid}:`,
            result.error
          );
        }
      } catch (e) {
        errors++;
        console.error(`Exception email ${target.uid}:`, e);
      }
    }

    // ── 9. Sauvegarder les stats dans Firestore ─────────
    await setDoc(doc(db, "stats", "reminderRun"), {
      lastRunAt: serverTimestamp(),
      triggeredBy: "auto",           // ← Scheduler automatique
      sentWhatsappCount: sentWhatsapp,
      sentEmailCount: sentEmail,
      skippedCount: skipped,
      errorCount: errors,
      unreachableCount: unreachable,
    });

    // ── 10. Réponse finale ───────────────────────────────
    const summary = {
      success: true,
      triggeredBy: "auto",
      sentWhatsapp,
      sentEmail,
      skipped,
      errors,
      unreachable,
      total: sentWhatsapp + sentEmail,
    };

    console.log("✅ Cron reminders:", summary);
    return NextResponse.json(summary);

  } catch (error) {
    console.error("❌ Erreur cron reminders:", error);

    // Sauvegarder l'erreur dans Firestore
    await setDoc(doc(db, "stats", "reminderRun"), {
      lastRunAt: serverTimestamp(),
      triggeredBy: "auto",
      errorCount: 1,
      errorMessage: error.message,
    }).catch(() => {});

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}