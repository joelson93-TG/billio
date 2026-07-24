"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase"; 
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err) {
      setError("Identifiants incorrects. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  return (
    /* Parent container : flex-col sur mobile, flex-row sur desktop */
    <div className="min-h-screen flex flex-col lg:flex-row w-full bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 font-sans overflow-hidden">
      
      {/* Panneau de Gauche : Formulaire de Connexion */}
      <div className="w-full lg:w-1/2 min-h-screen lg:min-h-0 flex items-center justify-center bg-white px-6 py-12 sm:p-12 lg:p-20 xl:p-24 relative z-10 lg:rounded-r-[3.5rem] shadow-[25px_0_50px_-12px_rgba(0,0,0,0.3)] transition-all duration-300">
        <div className="w-full max-w-md space-y-8">
          
          {/* En-tête du formulaire */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              {/* Logo Billio */}
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/30">
                B
              </div>
              <span className="text-3xl font-bold text-gray-900 tracking-tight">Billio.</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Bon retour 👋
            </h2>
            <p className="mt-3 text-base text-gray-500">
              Connectez-vous pour gérer votre facturation en toute simplicité.
            </p>
          </div>

          {/* Affichage des erreurs */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleLogin} className="space-y-5 mt-8">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email professionnel
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="nom@entreprise.com"
                  className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Mot de passe
                </label>
                <a href="/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                  Mot de passe Oublié ?
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 mt-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-blue-500/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connexion en cours...</span>
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          {/* Lien vers l'inscription */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Vous n'avez pas de compte ?{" "}
            <a href="/signup" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Créer une entreprise
            </a>
          </p>
        </div>
      </div>

      {/* Panneau de Droite : Décoration (Caché sur mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center flex-1">
        
        {/* Cercles décoratifs avec flou */}
        <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-blue-400 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40"></div>
        
        {/* Contenu visuel */}
        <div className="relative z-10 text-center text-white px-12">
          <div className="inline-flex p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-2xl transform transition-transform hover:scale-105 duration-500">
            {/* Illustration stylisée */}
            <div className="w-72 h-44 bg-white/5 rounded-2xl border border-white/10 p-5 flex flex-col gap-4">
              <div className="w-1/2 h-4 bg-white/20 rounded-full"></div>
              <div className="w-3/4 h-4 bg-white/20 rounded-full"></div>
              <div className="flex-1 mt-2 bg-gradient-to-t from-blue-400/50 to-transparent rounded-xl border-b-2 border-blue-300/50"></div>
            </div>
          </div>
          <h3 className="text-4xl font-bold mb-4 tracking-tight">Gérez votre facturation.</h3>
          <p className="text-lg text-blue-100 max-w-md mx-auto leading-relaxed">
            Un outil pensé pour les PME. Simplifiez vos devis, factures et suivez votre trésorerie en temps réel avec Billio.
          </p>
        </div>
        
        {/* Grille de fond subtile */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      </div>
      
    </div>
  );
}