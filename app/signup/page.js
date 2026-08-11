"use client";

import { useState, useEffect, useRef } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

function FormInput({ icon, label, hint, type = "text", value, onChange, placeholder, disabled, rightElement, inputMode, autoComplete }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">
        {label} {hint && <span className="text-xs text-gray-500 font-normal">{hint}</span>}
      </label>
      <div className="group flex items-center w-full border border-gray-200 rounded-xl bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all duration-200 ease-in-out">
        <div className="pl-4 pr-3 flex items-center pointer-events-none">
          {icon}
        </div>
        <input
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 w-full py-4 sm:py-3.5 bg-transparent appearance-none focus:outline-none text-gray-900 placeholder-gray-400 text-base sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        />
        {rightElement}
      </div>
    </div>
  );
}

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const router = useRouter();
  const redirectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const validateWhatsapp = (number) => {
    return PHONE_REGEX.test(number.trim());
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!validateWhatsapp(whatsappNumber)) {
      setError("Merci d'entrer un numéro WhatsApp valide, avec l'indicatif pays (ex: +33612345678).");
      return;
    }

    setIsLoading(true);

    let createdUser = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCredential.user;

      try {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        await setDoc(doc(db, "users", createdUser.uid), {
          uid: createdUser.uid,
          businessName: businessName.trim(),
          email: email.trim(),
          whatsappNumber: whatsappNumber.trim(),
          subscriptionStatus: "trial",
          trialEndDate: trialEnd.toISOString(),
          createdAt: new Date().toISOString(),
        });
      } catch (firestoreErr) {
        console.error("Erreur Firestore, rollback du compte Auth:", firestoreErr);
        await createdUser.delete();
        throw new Error("firestore-failed");
      }

      try {
        await sendEmailVerification(createdUser);
      } catch (emailErr) {
        console.warn("L'email de vérification n'a pas pu être envoyé:", emailErr);
      }

      setMessage("Compte créé ! Un e-mail de vérification vous a été envoyé.");
      setSignupComplete(true);

      // Délai allongé pour laisser le temps de lire le message
      // même si la popup "Enregistrer le mot de passe ?" de Chrome apparaît
      redirectTimeoutRef.current = setTimeout(() => {
        router.push("/dashboard");
      }, 4000);

    } catch (err) {
      console.error(err);

      if (err.message === "firestore-failed") {
        setError("Une erreur technique est survenue. Veuillez réessayer.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Cet email est déjà utilisé par un autre compte.");
      } else if (err.code === "auth/weak-password") {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else if (err.code === "auth/invalid-email") {
        setError("L'adresse email saisie n'est pas valide.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Problème de connexion réseau. Vérifiez votre connexion internet.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Trop de tentatives. Veuillez réessayer plus tard.");
      } else {
        setError("Une erreur est survenue lors de l'inscription.");
      }
      setIsLoading(false);
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
              Lancez votre PME
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500">
              Démarrez votre essai gratuit de 30 jours, sans carte bancaire.
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <svg aria-hidden="true" className="h-5 w-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {message && (
            <div role="status" aria-live="polite" className="bg-green-50 border-l-4 border-green-500 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <svg aria-hidden="true" className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-green-700">{message}</p>
              </div>
              {signupComplete && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="mt-3 w-full text-sm font-semibold text-green-700 hover:text-green-800 underline underline-offset-2 text-left"
                >
                  Accéder à mon tableau de bord maintenant →
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5 mt-8">

            <FormInput
              label="Nom de l'entreprise"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ma Super PME"
              disabled={isLoading}
              autoComplete="organization"
              icon={
                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />

            <FormInput
              label="Email professionnel"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@entreprise.com"
              disabled={isLoading}
              autoComplete="username"
              icon={
                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              }
            />

            <FormInput
              label="Numéro WhatsApp"
              hint="(obligatoire, avec indicatif pays)"
              type="tel"
              inputMode="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              disabled={isLoading}
              autoComplete="tel"
              icon={
                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.087.274.072.374-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.13.332.202.043.072.043.419-.101.824zM12.05 2C6.507 2 2 6.507 2 12.05c0 1.798.475 3.489 1.303 4.951L2 22l5.126-1.279C8.542 21.552 10.25 22 12.05 22h.004c5.542 0 10.048-4.508 10.048-10.05 0-2.686-1.045-5.211-2.943-7.106C17.259 3.045 14.735 2 12.05 2z"/>
                </svg>
              }
            />

            <FormInput
              label="Mot de passe"
              hint="(min. 6 car.)"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="new-password"
              icon={
                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="px-4 flex items-center text-gray-400 hover:text-blue-600 focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              }
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 mt-4 py-4 sm:py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/30 text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-all duration-200 ease-in-out active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-blue-600/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <svg aria-hidden="true" className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{signupComplete ? "Redirection..." : "Création en cours..."}</span>
                </>
              ) : (
                "Créer mon compte"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Vous avez déjà un compte ?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Se connecter
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
              <div className="flex-1 mt-2 bg-gradient-to-t from-blue-400/50 to-transparent rounded-xl border-b-2 border-blue-300/50 flex items-end justify-center pb-2">
                 <span className="text-blue-200 font-semibold tracking-wide">+30 jours gratuits</span>
              </div>
            </div>
          </div>

          <h3 className="text-4xl font-bold mb-4 tracking-tight">Rejoignez Billio.</h3>
          <p className="text-lg text-blue-100 max-w-md mx-auto leading-relaxed">
            Créez vos premières factures en moins de 2 minutes. La gestion d'entreprise n'a jamais été aussi fluide.
          </p>
        </div>

        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      </div>

    </div>
  );
}