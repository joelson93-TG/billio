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
  pricing: { monthly: 0, yearly: 0 } 
});

export default function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pricing, setPricing] = useState({ monthly: 0, yearly: 0 });
  const pathname = usePathname();

  useEffect(() => {
    // 1. Récupération des tarifs dynamiques depuis Firestore
    const fetchPricing = async () => {
      try {
        const pricingSnap = await getDoc(doc(db, "settings", "pricing"));
        if (pricingSnap.exists()) {
          const data = pricingSnap.data();
          setPricing({
            monthly: data.monthly || 0,
            yearly: data.yearly || 0,
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
          const sub = data.subscription || {};
          
          // Logique de blocage : expiré OU essai avec 0 jour restant
          if (sub.status === "expired" || (sub.status === "trial" && sub.daysLeft <= 0)) {
            setIsExpired(true);
          } else {
            setIsExpired(false);
          }
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
          <span>⚠️ Votre période d'essai est arrivée à échéance (0 jour restant). Les actions sont bloquées.</span>
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