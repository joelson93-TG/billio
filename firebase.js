// firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

// Initialisation sécurisée de Firebase (évite les erreurs au rechargement sous Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const auth = getAuth(app);
const db = getFirestore(app);

let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, analytics };