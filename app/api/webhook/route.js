import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    // ✅ Clé privée chargée depuis les variables d'environnement (JAMAIS en dur dans le code)
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Variables d\'environnement Firebase Admin manquantes.');
    }

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  return getFirestore();
}

// --- Calcule la nouvelle date de fin en cumulant sur l'ancienne si encore active ---
function computeNewEndDate(currentEndDateStr, months) {
  const now = new Date();
  const currentEndDate = currentEndDateStr ? new Date(currentEndDateStr) : now;
  const baseDate = currentEndDate > now ? currentEndDate : now;
  const newEndDate = new Date(baseDate);
  newEndDate.setMonth(newEndDate.getMonth() + Number(months || 1));
  return newEndDate;
}

// Déduit le nombre de mois à partir du planId si les metadata ne le fournissent pas.
function resolveMonths(months, planId) {
  if (months) return Number(months);
  if (planId === '1year') return 12;
  if (planId === '6months') return 6;
  if (planId === '1month') return 1;
  return 1;
}

export async function POST(request) {
  try {
    // --- ✅ Vérification d'origine via un secret partagé dans l'URL du webhook ---
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (!process.env.FEDAPAY_WEBHOOK_SECRET || secret !== process.env.FEDAPAY_WEBHOOK_SECRET) {
      console.warn('Webhook: tentative d\'accès non autorisée.');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const db = getAdminDb();
    const body = await request.json();

    // 🆕 FedaPay envoie l'événement sous la clé "name" (ex: "transaction.approved"),
    // pas "event" ni "status" comme le code le supposait auparavant. On garde tous
    // les fallbacks possibles pour couvrir les différentes versions de leur API.
    const eventStatus = body.name || body.event || body.status;
    const transactionData = body.entity || body.data;

    const isApproved =
      eventStatus === 'transaction.approved' || transactionData?.status === 'approved';

    if (!isApproved) {
      return NextResponse.json({ success: true, message: 'Webhook reçu, aucune action nécessaire.' });
    }

    const transactionId = transactionData?.id || transactionData?.transaction_id;
    const amountPaid = Number(transactionData?.amount) || 0;

    // 🔧 CORRECTION CRITIQUE : FedaPay renvoie DEUX objets metadata distincts :
    //   - "metadata"        → infos internes FedaPay (expire_schedule_jobid, paid_customer...)
    //   - "custom_metadata" → NOS données envoyées depuis le frontend (userId, planId, months)
    // Le code lisait "metadata.userId" au lieu de "custom_metadata.userId", donc userId
    // était toujours undefined → l'utilisateur n'était jamais trouvé.
    const customMetadata = transactionData?.custom_metadata || {};
    const fedapayMetadata = transactionData?.metadata || {};

    const userId = customMetadata.userId;
    const planId = customMetadata.planId;
    const months = resolveMonths(customMetadata.months, planId);

    // Email de secours : priorité à l'email du compte client FedaPay, puis à celui
    // éventuellement présent dans les metadata internes FedaPay (paid_customer).
    const customerEmail =
      transactionData?.customer?.email || fedapayMetadata?.paid_customer?.email;

    // --- ✅ Anti-doublon : on ignore si cette transaction a déjà été traitée ---
    if (transactionId) {
      const processedRef = db.collection('processedPayments').doc(String(transactionId));
      const processedSnap = await processedRef.get();
      if (processedSnap.exists) {
        return NextResponse.json({ success: true, message: 'Transaction déjà traitée.' });
      }
    }

    // --- Recherche de l'utilisateur ---
    let userRef = null;

    if (userId) {
      userRef = db.collection('users').doc(userId);
      // On vérifie que le document existe réellement avant de continuer
      const check = await userRef.get();
      if (!check.exists) {
        userRef = null;
      }
    }

    if (!userRef && customerEmail) {
      const usersSnapshot = await db.collection('users').where('email', '==', customerEmail).get();
      if (!usersSnapshot.empty) {
        userRef = usersSnapshot.docs[0].ref;
      }
    }

    if (!userRef) {
      console.warn('Webhook: Aucun utilisateur trouvé.', { userId, customerEmail, transactionId });
      return NextResponse.json(
        { success: false, message: 'Utilisateur introuvable via ID ou Email.' },
        { status: 404 }
      );
    }

    // --- ✅ Calcul correct de la nouvelle date d'expiration ---
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const currentEndDate = userData.trialEndDate || userData.endDate || null;
    const newEndDate = computeNewEndDate(currentEndDate, months);

    await userRef.set(
      {
        subscriptionStatus: 'active',
        trialEndDate: newEndDate.toISOString(),

        // Champ "plan" au niveau racine : lu en priorité par le dashboard admin
        // (resolvePlan) et par la page settings client pour afficher le badge
        // "Abonné · Mensuel/Semestriel/Annuel".
        plan: planId || userData.plan || null,

        subscription: {
          plan: planId || userData?.subscription?.plan || null,
          status: 'active',
          expiresAt: newEndDate.toISOString(),
        },

        lastPaymentAmount: amountPaid,
        lastPaymentPlan: planId || null,

        // totalPaid cumulé via increment() : champ prioritaire utilisé par le
        // dashboard admin pour calculer le Chiffre d'Affaires Généré.
        totalPaid: FieldValue.increment(amountPaid),

        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // --- Marquage anti-doublon pour les futurs webhooks ---
    if (transactionId) {
      await db.collection('processedPayments').doc(String(transactionId)).set({
        userId: userRef.id,
        amount: amountPaid,
        plan: planId || null,
        processedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: 'Compte activé avec succès par webhook.' });
  } catch (error) {
    console.error('Erreur webhook :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}