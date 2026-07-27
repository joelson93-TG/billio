import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
    const formattedKey = rawKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: "billio-18b5c",
        clientEmail: "firebase-adminsdk-fbsvc@billio-18b5c.iam.gserviceaccount.com",
        privateKey: formattedKey,
      }),
    });
  }
  return getFirestore();
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const eventStatus = body.event || body.name || body.status;
    const transactionData = body.entity || body.data;
    const txStatus = transactionData?.status;

    if (eventStatus === 'transaction.approved' || txStatus === 'approved') {
      const db = getAdminDb();
      const amountPaid = transactionData.amount;
      
      let userId = transactionData.metadata?.userId;
      const customerEmail = transactionData.customer?.email || transactionData.metadata?.paid_customer?.email;

      let userRef = null;

      if (userId) {
        userRef = db.collection('users').doc(userId);
      } else if (customerEmail) {
        const usersSnapshot = await db.collection('users').where('email', '==', customerEmail).get();
        if (!usersSnapshot.empty) {
          userRef = usersSnapshot.docs[0].ref;
        }
      }

      if (userRef) {
        await userRef.update({
          subscriptionStatus: 'active',
          amountPaid: amountPaid,
          updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true, message: 'Compte activé avec succès par webhook.' });
      } else {
        console.warn('Webhook: Aucun utilisateur trouvé pour cet événement.');
        return NextResponse.json({ success: false, message: 'Utilisateur introuvable via ID ou Email.' }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook reçu et ignoré (statut non approuvé).' });
  } catch (error) {
    console.error('Erreur webhook :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}