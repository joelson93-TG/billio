import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// LIGNE CRUCIALE : Empêche Next.js d'exécuter ce code pendant le build (évite l'erreur OpenSSL)
export const dynamic = 'force-dynamic';

// Initialisation sécurisée de Firebase Admin
if (!getApps().length) {
  // On vérifie que la variable existe pour ne pas faire crasher le build
  if (process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

export async function POST(request) {
  try {
    // On récupère Firestore uniquement au moment où le webhook est réellement appelé
    const db = getFirestore();
    const body = await request.json();
    
    // Structure FedaPay
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