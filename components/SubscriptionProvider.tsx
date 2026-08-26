// components/SubscriptionProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SubscriptionContextType {
  isExpired: boolean;
  isLoading: boolean;
  daysLeft: number | null;
  pricing: { monthly: number; sixMonths: number; yearly: number };
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isExpired: false,
  isLoading: true,
  daysLeft: null,
  pricing: { monthly: 0, sixMonths: 0, yearly: 0 },
});

function computeDaysLeft(userData: any): number | null {
  const sub = userData.subscription || {};
  const endDateStr = userData.trialEndDate || userData.endDate;

  if (endDateStr) {
    const d = new Date(endDateStr);
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  }
  if (sub.expiresAt) {
    const d = sub.expiresAt.toDate ? sub.expiresAt.toDate() : new Date(sub.expiresAt);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  return typeof sub.daysLeft === "number" ? sub.daysLeft : null;
}

// ✅ Détermine la bannière selon les jours restants
function getBannerConfig(daysLeft: number | null, isExpired: boolean) {
  if (isExpired) {
    return {
      show: true,
      bg: "bg-red-600",
      text: "text-white",
      icon: "🔒",
      message: "Votre abonnement est expiré. Toutes les actions sont bloquées.",
      urgent: true,
    };
  }
  if (daysLeft !== null && daysLeft <= 3 && daysLeft > 0) {
    return {
      show: true,
      bg: "bg-red-500",
      text: "text-white",
      icon: "⚠️",
      message: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""} ! Renouvelez maintenant.`,
      urgent: true,
    };
  }
  if (daysLeft !== null && daysLeft <= 7 && daysLeft > 3) {
    return {
      show: true,
      bg: "bg-amber-500",
      text: "text-white",
      icon: "⏳",
      message: `Votre abonnement expire dans ${daysLeft} jours. Pensez à le renouveler.`,
      urgent: false,
    };
  }
  return { show: false, bg: "", text: "", icon: "", message: "", urgent: false };
}

export default function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [pricing, setPricing] = useState({ monthly: 0, sixMonths: 0, yearly: 0 });
  const pathname = usePathname();

  useEffect(() => {
    // Tarifs en temps réel
    const pricingUnsub = onSnapshot(doc(db, "config", "pricing"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPricing({
          monthly: Number(d.monthly) || 0,
          sixMonths: Number(d.sixMonths) || 0,
          yearly: Number(d.yearly) || 0,
        });
      }
    });

    let userUnsub = () => {};

    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsExpired(false);
        setDaysLeft(null);
        setIsLoading(false);
        return;
      }

      // ✅ Écoute temps réel
      userUnsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const status = data.subscriptionStatus || data.subscription?.status;
          const days = computeDaysLeft(data);

          setDaysLeft(days);

          const expired =
            status === "expired" ||
            (["trial", "active"].includes(status) &&
              days !== null &&
              days <= 0);

          setIsExpired(expired);
        } else {
          setIsExpired(true);
          setDaysLeft(0);
        }
        setIsLoading(false);
      });
    });

    return () => {
      pricingUnsub();
      authUnsub();
      userUnsub();
    };
  }, []);

  const isSettingsPage = pathname === "/settings";
  const banner = getBannerConfig(daysLeft, isExpired);
  const showBanner = banner.show && !isSettingsPage;

  return (
    <SubscriptionContext.Provider value={{ isExpired, isLoading, daysLeft, pricing }}>
      {/* ✅ Bannière progressive */}
      {showBanner && (
        <div className={`${banner.bg} ${banner.text} px-4 py-3 text-center text-sm font-bold flex items-center justify-center gap-4 shrink-0 shadow-md z-50`}>
          <span>
            {banner.icon} {banner.message}
          </span>
          <Link
            href="/settings"
            className={`px-4 py-1.5 rounded-lg transition-colors shadow-sm text-xs font-bold whitespace-nowrap
              ${banner.urgent
                ? "bg-white text-red-600 hover:bg-red-50"
                : "bg-white text-amber-700 hover:bg-amber-50"
              }`}
          >
            Renouveler →
          </Link>
        </div>
      )}
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);