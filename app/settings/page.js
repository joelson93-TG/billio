"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase";

// Fonction pour calculer dynamiquement les jours restants
const getDaysRemaining = (endDateString) => {
  if (!endDateString) return 0;
  
  const endDate = new Date(endDateString);
  const today = new Date();
  
  // Calcul de la différence en millisecondes
  const diffTime = endDate.getTime() - today.getTime();
  
  // Conversion en jours (arrondi au supérieur)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
};

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // État pour les tarifs dynamiques chargés depuis Firestore
  const [pricing, setPricing] = useState({
    monthly: 5000,
    sixMonths: 25000,
    yearly: 50000,
  });

  // Champs de configuration de la société
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [services, setServices] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nif, setNif] = useState("");
  const [rccm, setRccm] = useState("");
  const [cnss, setCnss] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");

  // Infos abonnement avec gestion de la date d'expiration
  const [subscription, setSubscription] = useState({
    status: "trial",
    endDate: null,
  });

  // Construction des plans dynamiques basés sur les données de l'admin
  const plans = [
    {
      id: "1month",
      duration: "1 MOIS",
      months: 1,
      price: pricing.monthly,
      badge: null,
    },
    {
      id: "6months",
      duration: "6 MOIS",
      months: 6,
      price: pricing.sixMonths,
      badge: { text: "POPULAIRE", color: "bg-blue-600 text-white" },
    },
    {
      id: "1year",
      duration: "1 AN",
      months: 12,
      price: pricing.yearly,
      badge: { text: "ÉCONOMIQUE", color: "bg-emerald-600 text-white" },
    },
  ];

  useEffect(() => {
    // 1. Écoute en temps réel des tarifs configurés dans l'admin (Firestore: config/pricing)
    const pricingRef = doc(db, "config", "pricing");
    const unsubscribePricing = onSnapshot(pricingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPricing({
          monthly: Number(data.monthly) || 5000,
          sixMonths: Number(data.sixMonths) || 25000,
          yearly: Number(data.yearly) || 50000,
        });
      }
    });

    // 2. Injection du script FedaPay
    if (!document.getElementById("fedapay-checkout-script")) {
      const script = document.createElement("script");
      script.id = "fedapay-checkout-script";
      script.src = "https://checkout.fedapay.com/js/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    let unsubscribeUser = () => {};

    // 3. Gestion de l'authentification et récupération des données utilisateur
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

      try {
        const docRef = doc(db, "users", user.uid, "settings", "company");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompanyName(data.companyName || "");
          setLogoUrl(data.logoUrl || "");
          setWebsite(data.website || "");
          setServices(data.services || "");
          setAddress(data.address || "");
          setPhone(data.phone || "");
          setEmail(data.email || "");
          setNif(data.nif || "");
          setRccm(data.rccm || "");
          setCnss(data.cnss || "");
          setPrimaryColor(data.primaryColor || "#2563eb");
        }

        // 4. Écoute en temps réel du statut d'abonnement de l'utilisateur avec Logs
        const userDocRef = doc(db, "users", user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
          console.log("--- DEBUG FIREBASE ---");
          console.log("UID connecté dans le navigateur :", user.uid);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("Données trouvées dans Firestore :", userData);
            
            // Récupération de la date de fin (essai ou abonnement actif)
            const endDate = userData.trialEndDate || userData.endDate || null;
            
            if (userData.subscription) {
              setSubscription({ ...userData.subscription, endDate });
            } else if (userData.subscriptionStatus) {
              // Si le webhook a mis à jour `subscriptionStatus` directement
              setSubscription(prev => ({
                ...prev, 
                status: userData.subscriptionStatus, 
                endDate
              }));
            } else if (endDate) {
              // Si on a au moins une date de fin (ex: essai gratuit de base)
              setSubscription(prev => ({ ...prev, endDate }));
            }
          } else {
            console.log("⚠️ Aucun document trouvé dans Firestore pour cet UID !");
          }
        });
      } catch (error) {
        console.error("Erreur chargement :", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribePricing();
      unsubscribeAuth();
      unsubscribeUser();
    };
  }, [router]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];
        const tolerance = 40;

        for (let i = 0; i < data.length; i += 4) {
          if (
            Math.abs(data[i] - bgR) <= tolerance &&
            Math.abs(data[i + 1] - bgG) <= tolerance &&
            Math.abs(data[i + 2] - bgB) <= tolerance
          ) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        setLogoUrl(canvas.toDataURL("image/png"));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, "users", currentUser.uid, "settings", "company");
      await setDoc(docRef, {
        companyName, logoUrl, website, services, address, phone, email, nif, rccm, cnss, primaryColor
      }, { merge: true });
      alert("Paramètres enregistrés avec succès !");
    } catch (error) {
      console.error("Erreur enregistrement :", error);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentClick = (plan) => {
    if (typeof window === "undefined" || !window.FedaPay) {
      alert("Le module de paiement est en cours de chargement. Veuillez patienter quelques secondes et réessayer.");
      return;
    }

    try {
      const handler = window.FedaPay.init({
        public_key: "pk_live_Mw6qp4n5H1AhgzOOYp1XZFWh",
        transaction: {
          amount: plan.price,
          description: `Abonnement Billio - ${plan.duration}`,
          // Passage des données clés pour que le Webhook les récupère !
          custom_metadata: {
            userId: currentUser.uid,
            planId: plan.id,
            months: plan.months
          }
        },
        customer: {
          email: email || currentUser?.email || "client@jblessconsulting.com",
          firstname: companyName || "Client",
        },
      });

      handler.open().then((response) => {
        console.log("FedaPay transaction validée côté client.", response);
        // La modification en base de données se fera de manière sécurisée par le Webhook (serveur).
        // Le onSnapshot mettra la page à jour automatiquement.
        alert("Paiement validé avec succès ! Votre compte sera activé dans quelques secondes.");
      }).catch((error) => {
        console.log("Paiement annulé ou fenêtre fermée :", error);
      });

    } catch (error) {
      console.error("Erreur d'initialisation FedaPay :", error);
      alert("Une erreur est survenue lors du lancement du paiement.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-full font-sans text-gray-900 bg-gray-50/50">
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white flex items-center justify-between px-8 border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-bold tracking-tight">Paramètres & Abonnement</h1>
        </header>

        <div className="p-6 max-w-4xl mx-auto w-full pb-12 space-y-6">
          
          {/* SECTION ABONNEMENT COMPACTE ET CLIQUABLE */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${subscription.status === "active" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}>
                  {subscription.status === "active" ? "Abonné" : "Essai gratuit"}
                </span>
                <h2 className="text-base font-bold">Mon Espace Billio</h2>
              </div>
              <p className="text-xs text-slate-400">
                {/* Affichage dynamique des jours restants calculés */}
                {subscription.endDate 
                  ? `${getDaysRemaining(subscription.endDate)} jours restants` 
                  : "30 jours restants"}
              </p>
            </div>

            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Cliquez sur la formule de votre choix pour régler instantanément :
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => handlePaymentClick(plan)}
                  className="relative bg-slate-800/90 hover:bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
                >
                  {plan.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[9px] font-bold rounded-full tracking-wider shadow-sm ${plan.badge.color}`}>
                      {plan.badge.text}
                    </span>
                  )}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 tracking-wider mb-1 mt-0.5">{plan.duration}</h4>
                    <div className="text-xl font-black text-white mb-0.5 group-hover:text-blue-400 transition-colors">
                      {plan.price.toLocaleString()} <span className="text-xs font-bold text-blue-400">F</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {Math.round(plan.price / plan.months).toLocaleString()} F / mois
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-400 group-hover:underline">Payer maintenant →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION PARAMÈTRES DE LA SOCIÉTÉ */}
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-bold tracking-tight text-slate-900 pb-2 border-b border-gray-100">Informations de l'entreprise</h2>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Logo (Fond transparent automatique)</label>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <div 
                  className="w-20 h-20 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 relative"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
                    backgroundSize: `12px 12px`,
                    backgroundPosition: `0 0, 0 6px, 6px -6px, -6px 0px`
                  }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px] text-gray-400 text-center">Aucun logo</span>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 text-xs">
                      Importer un logo
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} className="hidden" />
                    </label>
                    {logoUrl && (
                      <button type="button" onClick={() => setLogoUrl("")} className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de l'entreprise</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Site Web</label>
                <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Téléphone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Couleur</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 p-1 border rounded-xl cursor-pointer" />
                  <span className="text-xs font-medium text-gray-600">{primaryColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">NIF</label>
                <input type="text" value={nif} onChange={(e) => setNif(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">RCCM</label>
                <input type="text" value={rccm} onChange={(e) => setRccm(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">CNSS</label>
                <input type="text" value={cnss} onChange={(e) => setCnss(e.target.value)} className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Services</label>
              <textarea value={services} onChange={(e) => setServices(e.target.value)} rows="2" className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none"></textarea>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-xs shadow-sm disabled:opacity-50">
                {isSaving ? "Enregistrement..." : "Enregistrer les paramètres"}
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
}