"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Création du contexte enrichi avec les tarifs dynamiques
const SubscriptionContext = createContext({ 
  isExpired: false, 
  isLoading: true, 
  pricing: { monthly: 0, sixMonths: 0, yearly: 0 } 
});

// --- Calcule les jours restants depuis la date de fin (identique à la Cloud Function) ---
function computeDaysLeft(userData: any): number | null {
  const sub = userData.subscription || {};
  const endDateStr = userData.trialEndDate || userData.endDate;
  if (endDateStr) {
    return Math.ceil((new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  if (sub.expiresAt) {
    const d = sub.expiresAt.toDate ? sub.expiresAt.toDate() : new Date(sub.expiresAt);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  return typeof sub.daysLeft === "number" ? sub.daysLeft : null;
}

export default function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // 🆕 Ajout de sixMonths pour cohérence avec la grille tarifaire réelle (admin + settings client)
  const [pricing, setPricing] = useState({ monthly: 0, sixMonths: 0, yearly: 0 });
  const pathname = usePathname();

  useEffect(() => {
    // 1. Récupération des tarifs dynamiques depuis Firestore
    const fetchPricing = async () => {
      try {
        // 🆕 CORRECTION : la grille tarifaire est enregistrée par le dashboard admin
        // dans "config/pricing" (voir AdminDashboardPage.handleSavePricing), pas
        // dans "settings/pricing". Cet ancien chemin ne contenait jamais de données,
        // donc pricing.monthly / pricing.yearly retournaient toujours 0 via useSubscription().
        const pricingSnap = await getDoc(doc(db, "config", "pricing"));
        if (pricingSnap.exists()) {
          const data = pricingSnap.data();
          setPricing({
            monthly: Number(data.monthly) || 0,
            sixMonths: Number(data.sixMonths) || 0,
            yearly: Number(data.yearly) || 0,
          });
        }
      } catch (error) {
        console.error("Erreur lors du chargement des tarifs :", error);
      }
    };

    fetchPricing();

    // 2. Gestion de l'authentification et de l'abonnement utilisateur
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();

          // Statut : peut être à la racine (subscriptionStatus) ou imbriqué (subscription.status)
          const status = data.subscriptionStatus || data.subscription?.status;

          // Calcul dynamique des jours restants basé sur la date réelle
          const daysLeft = computeDaysLeft(data);

          // Logique de blocage : statut explicitement expiré OU essai/actif à 0 jour ou moins
          const expired =
            status === "expired" ||
            (["trial", "active"].includes(status) && daysLeft !== null && daysLeft <= 0);

          setIsExpired(expired);
        }
      } else {
        // Sécurité : si l'utilisateur se déconnecte, on réinitialise l'état
        setIsExpired(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // On n'affiche pas la bannière sur la page des paramètres elle-même
  const showBanner = isExpired && pathname !== "/settings";

  return (
    <SubscriptionContext.Provider value={{ isExpired, isLoading, pricing }}>
      {showBanner && (
        <div className="bg-red-600 text-white px-4 py-3 text-center text-sm font-bold flex items-center justify-center gap-4 shrink-0 shadow-md z-50">
          <span>⚠️ Votre période d'essai est arrivée à échéance. Les actions sont bloquées.</span>
          <Link href="/settings" className="bg-white text-red-600 px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors shadow-sm">
            Régler mon abonnement →
          </Link>
        </div>
      )}
      {children}
    </SubscriptionContext.Provider>
  );
}

// Hook personnalisé pour accéder à l'état d'abonnement, l'état de chargement et aux tarifs dynamiques
export const useSubscription = () => useContext(SubscriptionContext);