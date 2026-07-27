import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Nettoyage robuste : enlève les guillemets et convertit proprement les \n en sauts de ligne réels
      privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    }
  }
  return getFirestore();
}

export async function POST(request) {
  try {
    const db = getAdminDb();
    const body = await request.json();
    
    const eventStatus = body.event || body.status;
    const transactionData = body.entity || body.data;

    if (eventStatus === 'transaction.approved' || transactionData?.status === 'approved') {
      const userId = transactionData.metadata?.userId;
      const amountPaid = transactionData.amount;

      if (userId) {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
          subscriptionStatus: 'active',
          amountPaid: amountPaid,
          updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true, message: 'Compte activé avec succès.' });
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook reçu, aucune action nécessaire.' });
  } catch (error) {
    console.error('Erreur webhook :', error);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}