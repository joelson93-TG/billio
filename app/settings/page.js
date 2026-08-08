"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase";

// 🆕 Gère aussi bien une string ISO qu'un Timestamp Firestore (robustesse,
// alignée avec computeDaysLeft() utilisé côté dashboard admin).
const getDaysRemaining = (endDateValue) => {
  if (!endDateValue) return 0;
  const endDate = endDateValue?.toDate ? endDateValue.toDate() : new Date(endDateValue);
  const today = new Date();
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// 🆕 Traduit l'identifiant technique du plan (écrit par le webhook) en libellé lisible
const planLabel = (planId) => {
  switch (planId) {
    case "1year":
      return "Annuel";
    case "6months":
      return "Semestriel";
    case "1month":
      return "Mensuel";
    default:
      return null;
  }
};

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const [isPaymentPending, setIsPaymentPending] = useState(false); // ✅ Nouvel état

  const [pricing, setPricing] = useState({
    monthly: 5000,
    sixMonths: 25000,
    yearly: 50000,
  });

  // Champs de configuration
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

  // 🆕 UNE SEULE IMAGE : Cachet + Signature combinés
  const [stampSignatureUrl, setStampSignatureUrl] = useState("");

  const [subscription, setSubscription] = useState({
    status: "trial",
    endDate: null,
    plan: null, // 🆕 Plan actif renvoyé par le webhook ("1month" | "6months" | "1year" | null)
  });

  // ✅ Ref pour détecter le changement de date via le webhook (anti-doublon d'alerte)
  const previousEndDateRef = useRef(null);
  const previousPlanRef = useRef(null);

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

    if (!document.getElementById("fedapay-checkout-script")) {
      const script = document.createElement("script");
      script.id = "fedapay-checkout-script";
      script.src = "https://checkout.fedapay.com/js/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    let unsubscribeUser = () => {};

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
          setStampSignatureUrl(data.stampSignatureUrl || "");
        }

        const userDocRef = doc(db, "users", user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const endDate = userData.trialEndDate || userData.endDate || null;
            const status =
              userData.subscriptionStatus ||
              userData.subscription?.status ||
              "trial";

            // 🆕 Lecture du plan actif écrit par le webhook (champ racine
            // prioritaire, avec fallback sur subscription.plan)
            const activePlan = userData.plan || userData.subscription?.plan || null;

            // ✅ Détection automatique de l'activation par le webhook
            // 🆕 On détecte aussi bien un changement de date qu'un changement de plan
            // (cas d'un renouvellement le même jour où la date ne bouge pas visuellement)
            const hasChanged =
              previousEndDateRef.current !== endDate ||
              previousPlanRef.current !== activePlan;

            if (isPaymentPending && hasChanged && status === "active") {
              setIsPaymentPending(false);
              alert(
                `✅ Paiement confirmé ! Votre abonnement (${planLabel(activePlan) || "Actif"}) est valide jusqu'au ${new Date(endDate).toLocaleDateString("fr-FR")}.`
              );
            }

            previousEndDateRef.current = endDate;
            previousPlanRef.current = activePlan;
            setSubscription({ status, endDate, plan: activePlan });
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
  }, [router, isPaymentPending]);

  // Fonction générique de traitement d'image avec suppression de fond
  const processImage = (file, callback, maxWidth = 400, maxHeight = 400, setUploading = null) => {
    if (!file) return;

    if (setUploading) setUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
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
        callback(canvas.toDataURL("image/png"));
        if (setUploading) setUploading(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    processImage(file, setLogoUrl, 400, 400);
  };

  const handleStampSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    processImage(file, setStampSignatureUrl, 500, 300, setIsUploadingStamp);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, "users", currentUser.uid, "settings", "company");
      await setDoc(
        docRef,
        {
          companyName,
          logoUrl,
          website,
          services,
          address,
          phone,
          email,
          nif,
          rccm,
          cnss,
          primaryColor,
          stampSignatureUrl,
        },
        { merge: true }
      );
      alert("Paramètres enregistrés avec succès !");
    } catch (error) {
      console.error("Erreur enregistrement :", error);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ FONCTION SÉCURISÉE : plus AUCUNE écriture Firestore côté client
  const handlePaymentClick = (plan) => {
    if (typeof window === "undefined" || !window.FedaPay) {
      alert(
        "Le module de paiement est en cours de chargement. Veuillez patienter quelques secondes et réessayer."
      );
      return;
    }

    if (isPaymentPending) {
      alert("Un paiement est déjà en cours de traitement. Veuillez patienter.");
      return;
    }

    try {
      const handler = window.FedaPay.init({
        public_key: "pk_live_Mw6qp4n5H1AhgzOOYp1XZFWh",
        transaction: {
          amount: plan.price,
          description: `Abonnement Billio - ${plan.duration}`,
          // 🆕 Ces clés doivent impérativement correspondre à ce que lit le webhook
          // (metadata.userId, metadata.planId, metadata.months) — ne pas renommer
          // sans adapter également /api/webhook/route.js
          custom_metadata: {
            userId: currentUser.uid,
            planId: plan.id,
            months: plan.months,
          },
        },
        customer: {
          email: email || currentUser?.email || "client@jblessconsulting.com",
          firstname: companyName || "Client",
        },
        onComplete: (response) => {
          if (response.reason !== "checkout_completed") return;

          if (
            response.transaction &&
            response.transaction.status !== "approved"
          ) {
            alert("Le paiement a échoué ou a été refusé par la banque.");
            return;
          }

          // ✅ On NE MET PLUS À JOUR Firestore ici (sécurité).
          // C'est le webhook serveur (/api/webhook) qui valide et active l'abonnement.
          setIsPaymentPending(true);
          alert(
            "✅ Paiement reçu ! Votre abonnement sera activé automatiquement dans quelques instants..."
          );
        },
        onClose: () => console.log("Fenêtre de paiement fermée."),
      });

      handler.open();
    } catch (error) {
      console.error("Erreur FedaPay :", error);
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

  const checkerboardStyle = {
    backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
                      linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
                      linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
                      linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
    backgroundSize: `12px 12px`,
    backgroundPosition: `0 0, 0 6px, 6px -6px, -6px 0px`,
  };

  // 🆕 Libellé du plan actif pour l'affichage dans la bannière
  const activePlanLabel = planLabel(subscription.plan);

  return (
    <div className="flex-1 flex flex-col min-h-full font-sans text-gray-900 bg-gray-50/50">
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white flex items-center justify-between px-8 border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-bold tracking-tight">
            Paramètres & Abonnement
          </h1>
        </header>

        <div className="p-6 max-w-4xl mx-auto w-full pb-12 space-y-6">

          {/* ── SECTION ABONNEMENT ── */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    subscription.status === "active"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {subscription.status === "active"
                    ? `Abonné${activePlanLabel ? ` · ${activePlanLabel}` : ""}`
                    : "Essai gratuit"}
                </span>
                <h2 className="text-base font-bold">Mon Espace Billio</h2>
              </div>
              <p className="text-xs text-slate-400">
                {subscription.endDate
                  ? `${getDaysRemaining(subscription.endDate)} jours restants`
                  : "30 jours restants"}
              </p>
            </div>

            {/* ✅ Bannière de paiement en cours */}
            {isPaymentPending && (
              <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400"></div>
                <p className="text-xs text-blue-300 font-medium">
                  Confirmation du paiement en cours...
                </p>
              </div>
            )}

            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Cliquez sur la formule de votre choix pour régler
              instantanément :
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const isCurrentPlan =
                  subscription.status === "active" && subscription.plan === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => handlePaymentClick(plan)}
                    className={`relative bg-slate-800/90 hover:bg-slate-800 rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md ${
                      isCurrentPlan
                        ? "border-emerald-500 ring-1 ring-emerald-500/40"
                        : "border-slate-700 hover:border-blue-500"
                    } ${isPaymentPending ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {isCurrentPlan ? (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[9px] font-bold rounded-full tracking-wider shadow-sm bg-emerald-500 text-white">
                        FORMULE ACTIVE
                      </span>
                    ) : (
                      plan.badge && (
                        <span
                          className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[9px] font-bold rounded-full tracking-wider shadow-sm ${plan.badge.color}`}
                        >
                          {plan.badge.text}
                        </span>
                      )
                    )}
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 tracking-wider mb-1 mt-0.5">
                        {plan.duration}
                      </h4>
                      <div className="text-xl font-black text-white mb-0.5 group-hover:text-blue-400 transition-colors">
                        {plan.price.toLocaleString()}{" "}
                        <span className="text-xs font-bold text-blue-400">F</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {Math.round(plan.price / plan.months).toLocaleString()} F
                        / mois
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-400 group-hover:underline">
                        {isCurrentPlan ? "Renouveler / Prolonger →" : "Payer maintenant →"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SECTION PARAMÈTRES ── */}
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
          >
            <h2 className="text-base font-bold tracking-tight text-slate-900 pb-2 border-b border-gray-100">
              Informations de l'entreprise
            </h2>

            {/* ── LOGO ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Logo{" "}
                <span className="font-normal text-gray-500">
                  (Fond transparent automatique)
                </span>
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <div
                  className="w-20 h-20 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0"
                  style={checkerboardStyle}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[10px] text-gray-400 text-center">
                      Aucun logo
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 text-xs">
                      Importer un logo
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl("")}
                        className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    PNG, JPG ou WEBP — Le fond blanc sera automatiquement supprimé
                  </p>
                </div>
              </div>
            </div>

            {/* ── CACHET & SIGNATURE (image unique) ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Cachet & Signature{" "}
                <span className="font-normal text-gray-500">
                  (image unique scannée — apparaîtra sous "LE RESPONSABLE" sur
                  vos factures)
                </span>
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-indigo-200 rounded-xl bg-indigo-50/30">
                <div
                  className="w-full sm:w-64 h-28 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 relative"
                  style={checkerboardStyle}
                >
                  {isUploadingStamp ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                      <span className="text-[10px] text-gray-400">
                        Traitement...
                      </span>
                    </div>
                  ) : stampSignatureUrl ? (
                    <img
                      src={stampSignatureUrl}
                      alt="Cachet & Signature"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 px-4 text-center">
                      <span className="text-2xl">🖊️</span>
                      <span className="text-[10px] text-gray-400 leading-tight">
                        Aucune image importée
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Scannez ou photographiez votre cachet avec votre signature
                    dessus (comme sur un document officiel), puis importez
                    l'image ici. Le fond sera automatiquement rendu transparent.
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-100 text-xs border border-indigo-200">
                      🖊️ Importer Cachet & Signature
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleStampSignatureUpload}
                        className="hidden"
                        disabled={isUploadingStamp}
                      />
                    </label>
                    {stampSignatureUrl && (
                      <button
                        type="button"
                        onClick={() => setStampSignatureUrl("")}
                        className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-gray-400">
                    PNG, JPG ou WEBP — Le fond sera automatiquement supprimé
                  </p>
                </div>
              </div>

              {stampSignatureUrl && (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Aperçu sur facture
                  </p>
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-xs font-bold underline text-gray-700 mb-2">
                        LE RESPONSABLE
                      </p>
                      <div className="w-36 h-20 relative">
                        <img
                          src={stampSignatureUrl}
                          alt="Aperçu"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 italic mt-1">
                        Cachet & Signature
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── NOM + SITE WEB ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nom de l'entreprise{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="Ex : CABINET JBLESS CONSULTING"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Site Web
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="www.exemple.com"
                />
              </div>
            </div>

            {/* ── TÉLÉPHONE + EMAIL + COULEUR ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="+228 90 00 00 00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="contact@exemple.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Couleur principale
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 p-1 border rounded-xl cursor-pointer"
                  />
                  <span className="text-xs font-medium text-gray-600">
                    {primaryColor}
                  </span>
                </div>
              </div>
            </div>

            {/* ── ADRESSE ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                placeholder="Quartier, Ville, Pays"
              />
            </div>

            {/* ── NIF + RCCM + CNSS ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  NIF
                </label>
                <input
                  type="text"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="Numéro NIF"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  RCCM
                </label>
                <input
                  type="text"
                  value={rccm}
                  onChange={(e) => setRccm(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="Numéro RCCM"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  CNSS
                </label>
                <input
                  type="text"
                  value={cnss}
                  onChange={(e) => setCnss(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="Numéro CNSS"
                />
              </div>
            </div>

            {/* ── SERVICES ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Services <span className="text-red-500">*</span>
              </label>
              <textarea
                value={services}
                onChange={(e) => setServices(e.target.value)}
                rows="3"
                className="w-full p-2.5 text-sm border rounded-xl bg-gray-50 outline-none focus:border-blue-400 focus:bg-white transition-colors resize-none"
                placeholder="Ex : Comptabilité, Conseil fiscal, Formation en gestion..."
                required
              ></textarea>
            </div>

            <p className="text-[10px] text-gray-400">
              <span className="text-red-500 font-bold">*</span> Champs
              obligatoires
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-xs shadow-sm disabled:opacity-50 transition-colors"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></span>
                    Enregistrement...
                  </span>
                ) : (
                  "Enregistrer les paramètres"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}