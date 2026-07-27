import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    // Clé privée sur UNE SEULE LIGNE : 100% insensible au formatage des éditeurs de code
    const privateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/zutrPW6UyBXw\nJP/zxBWkY10dOZDx388lm5Fg4e63I8YuGWW8TO5zjzN/BypEyaJ+vNtrds6f7gUz\nwvN75t3aIh55WOJeIY/zOl672RPpFD/hweaW9fCMZkL8Gq0V6DzzmHeQ7l9N81G1\nK/D2WirGjqMheIcNQ3hS6ojFboQqebwLGvUsUusBix0mY42DDpf34E2xECjHZKDa\nPIVB9X1ZiGCKVMUNGtHNSVOpx+PqcJ6bL4vaFWE+p8hz5rIQWSOh5qhVfh8TGCr8\nY2aqE7xnWd9tXXXTSiV5wA9W+7MnodR/69yhQZwvJbGRwWlHYF9jdw67sQjnkxRP\n4WTPes2VAgMBAAECggEAGYr9N91I9iBFJ6NNwJEqzqb61fL+Fe/Xnqr+a7f6ucHW\nWPpB3ZcjJBl8Ypy6KMnvTVBqKf/62Tpxz+hU03m1rqBfjYpkLuPqTxpFVl+8sovj\nS/Wt9wmOfKv7nKYSybmRMGFr/s13vKI8DdPptWzhiGqjV8g8t+v1wJkCGMS0bhFn\nz8fNgT1lntAGu/7UbYsg6IViW02wAK5haJ83elYmcEn6QXkNNdTiC2lKA5cihlHh\nuQNZ2CEg1EXEiQ9TPoZAxHbZiE+fUA2sGQt1jqseghyQMUv6r9+DsdtWYhFsiZU3\nrVDXnIteq+QiPR6cYFZZMRqiFMQFt119HqazP099kQKBgQDy+Eye6FxXXHv88rNa\nxa6ZxHc1INMEVP7WZRQ786L7/0/cuWQuJT1XpB0tDSX9g/xXc4RwyVjhHDjo+ioS\nb/Op/Z5/jdL5hElyxWv6k9jDYC/r/tG+bVgQcblGnY3fFMhHWzSYOFL985WqbuJE\nhamEi3B08hGKkwRDIRqN6nGAaQKBgQDKGDqrH5Q6jjvqTXwAzgUBN7p/Vtkuwth6\ngvvnOx7QL3xUm1rXYdPFkPS6qCffhebGwTUiYmnmtqIQXQJ4WspP3aNl+kcAbqyS\ncVJsa6CAlOlShHeBuVUMWknrVuvWiZDfTY+Y2NYee07Y2036EI260GeKGP5xi2se\nrN44cJf+TQKBgGmGzkB2SyTmVjOWda+HDD5cximdCAlpoQUdAZzIRJGOYfFL0+b2\n5Z2a+dEHVOi22nJhCbSyvpeG2nDVtlArr3i1XpGn12nnur7OYAeFDzBMJoQpOI+s\njgMWYZH5/BRXwmS7iCxUyjbiBK7xWfTI2MdoiH9CY7v7/m3pgs8AdCuBAoGBAMR3\niZGSwaerXtQJP+QIZRUp+ESTSdAL3Cg97mZ9MxdxEo2t+kIo+Je4tDJCB4Fly1St\nv9oNkqaYJjWCNkSK/uNltNQO27ev4FT9lgORHhfirHFsFkImymeX3wTLG7sVQaHU\n5STSqFY5yg1IJiZUsXRL5lx6r+Hyh9DqfZ6g1yKBAoGAG0UBEOgAfCH5eGumAYJt\n78m0AqarTeq3fFzfmDQCLqJEihFjbu1VpKnM0xhcr6CeBD82kNs8oPC6ND7QyPpt\nrr8F9UxdrqhYBJGGihkQVBwqsXkji7QOLC/gKWJjwllTZNJCodH7o+44TPMIScpS\nxkMrOMFsOLUxhA1K7qeo1zA=\n-----END PRIVATE KEY-----\n';

    // Remplacement sécurité au cas où un retour chariot Windows se glisse
    const cleanPrivateKey = privateKey.replace(/\\n/g, '\n').replace(/\r/g, '');

    initializeApp({
      credential: cert({
        projectId: "billio-1b85c",
        clientEmail: "firebase-adminsdk-fbsvc@billio-1b85c.iam.gserviceaccount.com",
        privateKey: cleanPrivateKey,
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

    return NextResponse.json({ success: true, message: 'Webhook reçu, aucune action nécessaire.' });
  } catch (error) {
    console.error('Erreur webhook :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}