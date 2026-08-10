// firebase.js (ou firebase.ts)
import { initializeApp, getApps } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 🆕 AJOUT
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCWNwXQAKUPLBEn27Uz0DQDzdO88vvGklU",
  authDomain: "billio-1b85c.firebaseapp.com",
  projectId: "billio-1b85c",
  storageBucket: "billio-1b85c.firebasestorage.app",
  messagingSenderId: "723004609540",
  appId: "1:723004609540:web:576a828a2a60ce56125151",
  measurementId: "G-5E913KEBVL"
};

// Initialisation sécurisée de l'application Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Utilisation d'une fonction pour initialiser l'Auth.
// Cela résout l'erreur de type "any" car le compilateur comprend
// exactement ce que la fonction retourne.
const initializeFirebaseAuth = () => {
  try {
    // Tentative avec la persistance locale standard
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } catch (e) {
    try {
      // Si déjà initialisé par un autre module, on récupère l'instance
      return getAuth(app);
    } catch (err) {
      // Fallback de secours en mémoire si le stockage de l'iPad bloque tout
      return initializeAuth(app, {
        persistence: inMemoryPersistence,
      });
    }
  }
};

// auth possède maintenant un type strict et Next.js validera le build
const auth = initializeFirebaseAuth();
const db = getFirestore(app);
const storage = getStorage(app); // 🆕 AJOUT — Service Firebase Storage pour l'upload d'images

let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Ignore les erreurs d'analytics sur les navigateurs stricts
  });
}

export { app, auth, db, storage, analytics }; // 🆕 storage exporté