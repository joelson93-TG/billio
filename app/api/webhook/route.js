import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    // Récupération sécurisée depuis les variables d'environnement de Vercel.
    // Le .replace est crucial ici pour que Vercel lise correctement les sauts de ligne (\n).
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
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
      const amountPaid = transactionData.amount;
      
      // Récupération de l'ID ou de l'email depuis les données de FedaPay
      let userId = transactionData.metadata?.userId;
      const customerEmail = transactionData.customer?.email || transactionData.metadata?.paid_customer?.email;

      let userRef = null;

      if (userId) {
        userRef = db.collection('users').doc(userId);
      } else if (customerEmail) {
        // Recherche du compte par e-mail
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

    return NextResponse.json({ success: true, message: 'Webhook reçu, aucune action nécessaire.' });
  } catch (error) {
    console.error('Erreur webhook :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}