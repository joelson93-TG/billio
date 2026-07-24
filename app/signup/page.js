"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase"; // Vérifie que ce chemin est le bon dans ton projet
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      // 1. Création du compte dans Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Création du profil de l'entreprise dans Firestore (Base de données)
      // On initialise la période d'essai de 30 jours
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        businessName: businessName,
        email: email,
        subscriptionStatus: "trial",
        trialEndDate: trialEnd.toISOString(),
        createdAt: new Date().toISOString()
      });

      // 3. Redirection vers le tableau de bord
      router.push("/");
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Cet email est déjà utilisé par un autre compte.");
      } else if (err.code === 'auth/weak-password') {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else {
        setError("Une erreur est survenue lors de l'inscription.");
      }
      setIsLoading(false);
    }
  };

  return (
    // Utilisation de 100dvh pour gérer correctement la barre d'adresse mobile
    // Le dégradé n'est actif qu'à partir de l'écran lg (desktop), sur mobile on reste sur du blanc pur
    <div className="min-h-[100dvh] flex w-full bg-white lg:bg-gradient-to-br lg:from-blue-600 lg:via-indigo-700 lg:to-indigo-900 font-sans overflow-hidden">
      
      {/* Panneau de Gauche : Formulaire d'inscription */}
      {/* Sur mobile : prend toute la hauteur. Sur Desktop : arrondi et ombré */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center bg-white px-6 py-8 sm:px-12 md:px-24 relative z-10 lg:rounded-r-[3.5rem] lg:shadow-[25px_0_50px_-12px_rgba(0,0,0,0.3)] min-h-[100dvh]">
        <div className="w-full max-w-md mx-auto space-y-8">
          
          {/* En-tête du formulaire */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
                B
              </div>
              <span className="text-2xl font-bold text-gray-900 tracking-tight">Billio.</span>
            </div>
            {/* Typographie ajustée pour mobile (text-2xl) et desktop (sm:text-3xl) */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Lancez votre PME
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Démarrez votre essai gratuit de 30 jours, sans carte bancaire.
            </p>
          </div>

          {/* Affichage des erreurs */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md animate-pulse">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSignup} className="space-y-5 mt-8">
            
            {/* Nom de l'entreprise */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Nom de l'entreprise
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  placeholder="Ma Super PME"
                  // Ajout de text-base sm:text-sm pour éviter le zoom automatique sur iPhone
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all duration-300 text-base sm:text-sm"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Email professionnel
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nom@entreprise.com"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all duration-300 text-base sm:text-sm"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Mot de passe <span className="text-xs text-gray-500 font-normal">(min. 6 car.)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all duration-300 text-base sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-blue-500/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-2"
            >
              {isLoading ? (
                // Correction du xmlns qui comportait des crochets de markdown
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : "Créer mon compte"}
            </button>
          </form>

          {/* Lien vers la connexion */}
          <p className="mt-8 text-center text-sm text-gray-600 pb-8 lg:pb-0">
            Vous avez déjà un compte ?{" "}
            <Link className="font-semibold text-blue-600 hover:text-blue-500 transition-colors" href="/login">
              Se connecter
            </Link>
          </p>
        </div>
      </div>

      {/* Panneau de Droite : Décoration (Uniquement sur grand écran) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center">
        <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-blue-400 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40"></div>
        
        <div className="relative z-10 text-center text-white px-12">
          <div className="inline-flex p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-2xl transform transition-transform hover:scale-105 duration-500">
            <div className="w-72 h-44 bg-white/5 rounded-2xl border border-white/10 p-5 flex flex-col gap-4">
              <div className="w-1/2 h-4 bg-white/20 rounded-full"></div>
              <div className="w-3/4 h-4 bg-white/20 rounded-full"></div>
              <div className="flex-1 mt-2 bg-gradient-to-t from-blue-400/50 to-transparent rounded-xl border-b-2 border-blue-300/50 flex items-end justify-center pb-2">
                 <span className="text-blue-200 font-semibold">+30 jours gratuits</span>
              </div>
            </div>
          </div>
          <h3 className="text-3xl font-bold mb-4">Rejoignez Billio.</h3>
          <p className="text-lg text-blue-100 max-w-md mx-auto leading-relaxed">
            Créez vos premières factures en moins de 2 minutes. La gestion d'entreprise n'a jamais été aussi fluide.
          </p>
        </div>
        
        {/* Correction de l'URL du background qui comportait du markdown */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      </div>
      
    </div>
  );
}