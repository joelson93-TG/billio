import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    // Clé privée brute intégrée en dur
    const rawPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/zutrPW6UyBXw
JP/zxBWkY10dOZDx388lm5Fg4e63I8YuGWW8TO5zjzN/BypEyaJ+vNtrds6f7gUz
wvN75t3aIh55WOJeIY/zOl672RPpFD/hweaW9fCMZkL8Gq0V6DzzmHeQ7l9N81G1
K/D2WirGjqMheIcNQ3hS6ojFboQqebwLGvUsUusBix0mY42DDpf34E2xECjHZKDa
PIVB9X1ZiGCKVMUNGtHNSVOpx+PqcJ6bL4vaFWE+p8hz5rIQWSOh5qhVfh8TGCr8
Y2aqE7xnWd9tXXXTSiV5wA9W+7MnodR/69yhQZwvJbGRwWlHYF9jdw67sQjnkxRP
4WTPes2VAgMBAAECggEAGYr9N91I9iBFJ6NNwJEqzqb61fL+Fe/Xnqr+a7f6ucHW
WPpB3ZcjJBl8Ypy6KMnvTVBqKf/62Tpxz+hU03m1rqBfjYpkLuPqTxpFVl+8sovj
S/Wt9wmOfKv7nKYSybmRMGFr/s13vKI8DdPptWzhiGqjV8g8t+v1wJkCGMS0bhFn
nz8fNgT1lntAGu/7UbYsg6IViW02wAK5haJ83elYmcEn6QXkNNdTiC2lKA5cihlHh
nuQNZ2CEg1EXEiQ9TPoZAxHbZiE+fUA2sGQt1jqseghyQMUv6r9+DsdtWYhFsiZU3
rVDXnIteq+QiPR6cYFZZMRqiFMQFt119HqazP099kQKBgQDy+Eye6FxXXHv88rNa
xa6ZxHc1INMEVP7WZRQ786L7/0/cuWQuJT1XpB0tDSX9g/xXc4RwyVjhHDjo+ioS
b/Op/Z5/jdL5hElyxWv6k9jDYC/r/tG+bVgQcblGnY3fFMhHWzSYOFL985WqbuJE
hamEi3B08hGKkwRDIRqN6nGAaQKBgQDKGDqrH5Q6jjvqTXwAzgUBN7p/Vtkuwth6
gvvnOx7QL3xUm1rXYdPFkPS6qCffhebGwTUiYmnmtqIQXQJ4WspP3aNl+kcAbqyS
cVJsa6CAlOlShHeBuVUMWknrVuvWiZDfTY+Y2NYee07Y2036EI260GeKGP5xi2se
rN44cJf+TQKBgGmGzkB2SyTmVjOWda+HDD5cximdCAlpoQUdAZzIRJGOYfFL0+b2
5Z2a+dEHVOi22nJhCbSyvpeG2nDVtlArr3i1XpGn12nnur7OYAeFDzBMJoQpOI+s
jgMWYZH5/BRXwmS7iCxUyjbiBK7xWfTI2MdoiH9CY7v7/m3pgs8AdCuBAoGBAMR3
iZGSwaerXtQJP+QIZRUp+ESTSdAL3Cg97mZ9MxdxEo2t+kIo+Je4tDJCB4Fly1St
nv9oNkqaYJjWCNkSK/uNltNQO27ev4FT9lgORHhfirHFsFkImymeX3wTLG7sVQaHU
5STSqFY5yg1IJiZUsXRL5lx6r+Hyh9DqfZ6g1yKBAoGAG0UBEOgAfCH5eGumAYJt
78m0AqarTeq3fFzfmDQCLqJEihFjbu1VpKnM0xhcr6CeBD82kNs8oPC6ND7QyPpt
rr8F9UxdrqhYBJGGihkQVBwqsXkji7QOLC/gKWJjwllTZNJCodH7o+44TPMIScpS
nxkMrOMFsOLUxhA1K7qeo1zA=
-----END PRIVATE KEY-----`;

    // Suppression automatique des caractères \r (Windows)
    const privateKey = rawPrivateKey.replace(/\r/g, '');

    initializeApp({
      credential: cert({
        projectId: "billio-1b85c",
        clientEmail: "firebase-adminsdk-fbsvc@billio-1b85c.iam.gserviceaccount.com",
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