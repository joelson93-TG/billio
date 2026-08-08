import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Variables Firebase Admin manquantes.');
    }

    console.log('🔥 [WEBHOOK] Project ID utilisé :', process.env.FIREBASE_PROJECT_ID);

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

function computeNewEndDate(currentEndDateStr, months) {
  const now = new Date();
  const currentEndDate = currentEndDateStr ? new Date(currentEndDateStr) : now;
  const baseDate = currentEndDate > now ? currentEndDate : now;
  const newEndDate = new Date(baseDate);
  newEndDate.setMonth(newEndDate.getMonth() + Number(months || 1));
  return newEndDate;
}

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

    // 🔐 Vérification du secret uniquement si la variable est définie
    if (process.env.FEDAPAY_WEBHOOK_SECRET && secret !== process.env.FEDAPAY_WEBHOOK_SECRET) {
      console.warn('⚠️ [WEBHOOK] Secret invalide ou absent');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const db = getAdminDb();
    const body = await request.json();

    console.log('📩 [WEBHOOK] Événement reçu :', body.name || body.event);

    const eventName = body.name || body.event;
    const transactionData = body.entity || body.data || body;

    // On ne traite QUE les paiements approuvés
    if (eventName !== 'transaction.approved' && transactionData.status !== 'approved') {
      console.log('ℹ️ [WEBHOOK] Événement ignoré (pending/created) :', eventName);
      return NextResponse.json({ success: true, message: 'Événement ignoré (en attente).' });
    }

    const transactionId = transactionData.id || transactionData.transaction_id;
    const amountPaid = Number(transactionData.amount) || 0;
    const customMetadata = transactionData.custom_metadata || {};

    const userId = customMetadata.userId;
    const planId = customMetadata.planId;
    const months = resolveMonths(customMetadata.months, planId);

    const customerEmail = transactionData.customer?.email;

    console.log('🔑 [WEBHOOK] Données extraites :', { 
      userId, 
      planId, 
      months, 
      customerEmail, 
      transactionId,
      amountPaid 
    });

    if (!userId) {
      console.error('❌ [WEBHOOK] userId manquant dans custom_metadata');
      return NextResponse.json({ error: 'userId manquant' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists()) {
      console.error('❌ [WEBHOOK] Document utilisateur non trouvé :', userId);
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userData = userSnap.data();
    const currentEndDate = userData.trialEndDate || userData.endDate || null;
    const newEndDate = computeNewEndDate(currentEndDate, months);

    await userRef.set({
      subscriptionStatus: 'active',
      trialEndDate: newEndDate.toISOString(),
      plan: planId,
      subscription: {
        plan: planId,
        status: 'active',
        expiresAt: newEndDate.toISOString(),
      },
      lastPaymentAmount: amountPaid,
      lastPaymentPlan: planId,
      totalPaid: FieldValue.increment(amountPaid),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('✅ [WEBHOOK] Abonnement activé avec succès pour :', userId, '→', newEndDate.toISOString());

    return NextResponse.json({ 
      success: true, 
      message: 'Abonnement activé avec succès.',
      newEndDate: newEndDate.toISOString()
    });

  } catch (error) {
    console.error('💥 [WEBHOOK] Erreur critique :', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}