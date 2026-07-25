import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialisation sécurisée de Firebase Admin (évite les doublons d'initialisation sur Vercel)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Adaptez selon la structure de votre passerelle de paiement (ex: FedaPay)
    const eventStatus = body.event || body.status;
    const transactionData = body.entity || body.data;

    if (eventStatus === 'transaction.approved' || transactionData?.status === 'approved') {
      const userId = transactionData.metadata?.userId;
      const amountPaid = transactionData.amount;

      if (userId) {
        // Mise à jour de Firestore avec les privilèges admin
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