"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); 
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err) {
      setError("Identifiants incorrects. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setMessage("");
    if (!email) {
      setError("Veuillez saisir votre adresse e-mail ci-dessus, puis cliquez à nouveau sur 'Mot de passe oublié ?'");
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Un e-mail de réinitialisation a été envoyé ! Vérifiez votre boîte de réception.");
    } catch (err) {
      setError("Erreur lors de l'envoi. Vérifiez que l'adresse e-mail est correcte.");
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] flex items-center justify-center lg:items-stretch lg:justify-start lg:flex-row bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 font-sans overflow-x-hidden overflow-y-auto p-4 sm:p-8 lg:p-0">
      
      <div className="w-full max-w-md lg:max-w-none lg:w-1/2 flex items-center justify-center bg-white px-6 py-10 sm:p-10 lg:p-20 xl:p-24 relative z-10 rounded-[2rem] lg:rounded-none lg:rounded-r-[3.5rem] shadow-2xl lg:shadow-[25px_0_50px_-12px_rgba(0,0,0,0.3)] transition-all duration-300 lg:min-h-screen">
        
        <div className="w-full max-w-sm lg:max-w-md space-y-8">
          
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/30">
                B
              </div>
              <span className="text-3xl font-bold text-gray-900 tracking-tight">Billio.</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Bon retour 👋
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500">
              Connectez-vous pour gérer votre facturation en toute simplicité.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {message && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <svg className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-green-700">{message}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 mt-8">
            
            {/* Champ Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email professionnel
              </label>
              <div className="group flex items-center w-full border border-gray-200 rounded-xl bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all duration-200 ease-in-out">
                <div className="pl-4 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  className="flex-1 w-full py-4 sm:py-3.5 bg-transparent appearance-none focus:outline-none text-gray-900 placeholder-gray-400 text-base sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Champ Mot de Passe */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Mot de passe
                </label>
                <button 
                  type="button" 
                  onClick={handleResetPassword}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="group flex items-center w-full border border-gray-200 rounded-xl bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all duration-200 ease-in-out">
                <div className="pl-4 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="flex-1 w-full py-4 sm:py-3.5 bg-transparent appearance-none focus:outline-none text-gray-900 placeholder-gray-400 text-base sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-4 flex items-center text-gray-400 hover:text-blue-600 focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 mt-4 py-4 sm:py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/30 text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-all duration-200 ease-in-out active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-blue-600/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connexion...</span>
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Vous n'avez pas de compte ?{" "}
            <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Créer une entreprise
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center flex-1">
        <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-blue-400 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40"></div>
        
        <div className="relative z-10 text-center text-white px-12">
          <div className="inline-flex p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-2xl transform transition-transform hover:scale-105 duration-500">
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
        
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      </div>
      
    </div>
  );
}