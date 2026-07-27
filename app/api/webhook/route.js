import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: "billio-18b5c",
        clientEmail: "firebase-adminsdk-fbsvc@billio-18b5c.iam.gserviceaccount.com",
        privateKey: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC/zutrPW6UyBXw\nJP/zxBWkY18d0ZDX388lm5fg4e63I8YuGWM8T05zjz/BypEYAj+Vntrds6f7GuZ\nwvN75t3aiH55WOJeIY/z0L672RPPf/hweal9fCMZKL8Gq8V6DzzaHeQ719N81G1\nK/D2WirGjQmHeICN3hS6oJFboQqebwLGUsUusBix0mY420DpF34E2xECjHZKDa\nPIB9X1ZIGCKVMUNgTHNSVOpx+PqcJ6bL4vaFWE+p8hz5rIQWSOh5qHvfh8TGCr8\nY2aqE7xnW9tXXXTSiV5wA9W+7MnodR/69hQZwvJbGRwWLHYF9jdw67sQjnkxRP\n4WTPes2VAgMBAAECCgEAGYr9N9119iBFJ6NNWJeqzqb61fL+Fe/Xnqr+a7f6uchW\nWpPB3zcjL8JYpY6KMnvTVBqKf/62Tpxz+hU03m1rq8FjYpkLuPqTxpFVL+8sovj\nS/Wt9wOfKv7nKYSybRMGFR/s13vKI8DdPpWzhiGqjV8g8t+v1WjKCGMS8bhFn\nnz8fNgT1lNtAGu/7UbYsg6IViW02wAK5haJ83eLymcEn6QKnNNDTiC2lKA5cihLHh\nuQNZ2CEg1EXE1Q9PoZaxHbZiE+fUA2sGQt1jqseghqQMv6r9+DsdtWYhFsIZU3\nrvDXNiteq+QIPR6cYFZZMRQlfQMFT119HQazP099kQKBgQDY+Eye6FXxxV88rNa\nxa6ZxHc1INMEVP7WZRQ786L7/8/cuMQJT1XpB8tDSX9g/xXC4RwyVjhHDjo+IoS\nb/0p/Z5/jdL5hElyxWv6k9JDYC/r/tG+BVgqCblGn3fFMHHwzSYOFL985WqbuJE\nhamE13B8hGkkWRDiRQn6N6QaQKBgQDKGDqrH5Q6jjvqTXWAzgUBN7p/Vtkuwth6\ngvvn0X7QL3uUm1RXyUDPfKPS6qCffhebGWTUiYnmatqIQXQJ4WspP3Anl+kcAbqyS\nNcVJsa6CA1OlShHeBuVUMWknrVuvWIZDFTY+Y2NYee87Y2036EI260GeKGP5xI2se\nrN44cJF+TQKBgGmGzkB2SyTmVsJOWDa+HDD5cximdCAlpoQuDAzZIRJGOYFFL0+b2\n5Z2a+DEHV0I22nJhCbSyvpe62nDVTlArr3i1XPgn12nnur7OYAeFDzBMJoQp0l+s\ngMWYZH5/BRXwmS7iCxUyjbIBK7XwfTI2Mdoih9CY7v7/m3pgs8AdCuBAoGBAMR3\niZGSwaerXlQJP+QIZRUP+ESTSdAL3Cg97mZ9MxdXeO2t+Kio+Je4tJCB4Fly1St\nv9ONqAYJJWcNkSK/uNlTQ027eV4FT9lG9ORhifHFsFK1imex3WLTG7SVQAHu\n5STSQfY5y1IJiZUSXR5L5X6r+Hyh9DQfZ6GlYIKBAOGAGBUEOAfCH5eGuMAYJt\n78m8AqaxTeq3FfzfMDCLQJEhFjbu1VpKnM0xhcr6CeBD82kn8OPC6ND7QyPpt\nrr8F9UxdrqhYBJGGihQVBwqXkj17QOLC/gKWJwlLTZNJCodH70+44TPMIScpS\nxkMrOMFSOLUXhA1K7qeo1zA=\n-----END PRIVATE KEY-----`,
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
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur.' }, { status: 500 });
  }
}