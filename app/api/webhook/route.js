import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// Parsing robuste de la clé privée : gère les \n littéraux ET les vrais
// retours à la ligne, retire d'éventuels guillemets parasites, et valide
// que le format PEM est correct avant d'initialiser Firebase Admin.
function parsePrivateKey(rawKey) {
  if (!rawKey) return null;

  let key = rawKey.trim();

  // Retire des guillemets englobants accidentels (copier/coller depuis un .env ou JSON)
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Convertit les \n littéraux (échappés) en vrais retours à la ligne
  key = key.replace(/\\n/g, '\n');

  // Validation basique du format PEM
  if (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    return null;
  }

  return key;
}

function getAdminDb() {
  if (!getApps().length) {
    const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Variables Firebase Admin manquantes ou clé privée invalide.');
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

// Calcule la nouvelle date de fin en cumulant sur l'ancienne si encore active
function computeNewEndDate(currentEndDateStr, months) {
  const now = new Date();
  const currentEndDate = currentEndDateStr ? new Date(currentEndDateStr) : now;
  const baseDate = currentEndDate > now ? currentEndDate : now;
  const newEndDate = new Date(baseDate);
  newEndDate.setMonth(newEndDate.getMonth() + Number(months || 1));
  return newEndDate;
}

// Déduit le nombre de mois à partir du planId si les metadata ne le fournissent pas
function resolveMonths(months, planId) {
  if (months) return Number(months);
  if (planId === '1year') return 12;
  if (planId === '6months') return 6;
  if (planId === '1month') return 1;
  return 1;
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');

    if (process.env.FEDAPAY_WEBHOOK_SECRET && secret !== process.env.FEDAPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const db = getAdminDb();
    const body = await request.json();

    const eventName = body.name || body.event;
    const transactionData = body.entity || body.data || body;

    // On ne traite QUE les paiements réellement approuvés
    if (eventName !== 'transaction.approved' && transactionData.status !== 'approved') {
      return NextResponse.json({ success: true, message: 'Événement ignoré (en attente).' });
    }

    const transactionId = transactionData.id || transactionData.transaction_id;
    const amountPaid = Number(transactionData.amount) || 0;

    // FedaPay renvoie DEUX objets metadata distincts :
    //   - "metadata"        → infos internes FedaPay
    //   - "custom_metadata" → nos données envoyées depuis le frontend (userId, planId, months)
    const customMetadata = transactionData.custom_metadata || {};

    const userId = customMetadata.userId;
    const planId = customMetadata.planId;
    const months = resolveMonths(customMetadata.months, planId);

    if (!userId) {
      return NextResponse.json({ error: 'userId manquant' }, { status: 400 });
    }

    // Anti-doublon : on ignore si cette transaction a déjà été traitée
    if (transactionId) {
      const processedRef = db.collection('processedPayments').doc(String(transactionId));
      const processedSnap = await processedRef.get();
      if (processedSnap.exists) {
        return NextResponse.json({ success: true, message: 'Transaction déjà traitée.' });
      }
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userData = userSnap.data();
    const currentEndDate = userData.trialEndDate || userData.endDate || null;
    const newEndDate = computeNewEndDate(currentEndDate, months);

    await userRef.set(
      {
        subscriptionStatus: 'active',
        trialEndDate: newEndDate.toISOString(),

        // Champ "plan" au niveau racine : lu en priorité par le dashboard admin
        // et par la page settings client pour afficher le badge d'abonnement.
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

    // Marquage anti-doublon pour les futurs webhooks
    if (transactionId) {
      await db.collection('processedPayments').doc(String(transactionId)).set({
        userId: userRef.id,
        amount: amountPaid,
        plan: planId || null,
        processedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Abonnement activé avec succès.',
      newEndDate: newEndDate.toISOString(),
    });
  } catch (error) {
    console.error('Erreur webhook :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}