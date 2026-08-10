"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/firebase";
import { doc, onSnapshot, collection } from "firebase/firestore";

interface PricingData {
  monthly: number;
  sixMonths: number;
  yearly: number;
}

interface TutorialData {
  embedUrl: string;
  title: string;
}

interface ScreenshotDoc {
  url: string;
  order?: number;
}

function formatPrice(price: number): string {
  return price.toLocaleString("fr-FR");
}

/**
 * Calcule un nombre "d'entrepreneurs ayant rejoint ce mois-ci"
 * qui varie automatiquement chaque mois (base 1350, cycle sur 12 mois).
 */
function getMonthlyEntrepreneurCount(): number {
  const now = new Date();
  const monthIndex = now.getFullYear() * 12 + now.getMonth();
  const variation = (monthIndex % 12) * 45; // étale la variation sur 12 mois
  return 1350 + variation;
}

// Image de secours utilisée si aucune capture n'est présente sur Firestore
const DEFAULT_DASHBOARD_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDQjEYxYXGxCrnL5wSnV81SofvfkfpfBBW_FcW4-8qsxtTNCXxRt33u7iG8xPZ7yW6S19Z6o_1zDu03NP3emAQlaCvHswLvyMCxS3xlzcTKlqxJMIaufarHCGbJhPh4eYp0ZrgijBjBk-8IiJQKpDwcY9IM1RCcxJat6Fk-38_cMC1ZSDraMIswGbRBgJ9PAdkWspKbRx_CUhcCLZwmidsexf9pxOKhNlKMsChjRlb4gpE5riRW91rvSsquo8NgkQ06Sgw";

/* =========================================================
   ICÔNES SVG (remplacent material-symbols-outlined)
   ========================================================= */
function IconMenu({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconPaperclip({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconCoins({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6" />
      <circle cx="15" cy="15" r="6" />
    </svg>
  );
}

function IconWallet({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function IconMapPin({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconImage({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconCalculator({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8.01" y2="10" />
      <line x1="12" y1="10" x2="12.01" y2="10" />
      <line x1="16" y1="10" x2="16.01" y2="10" />
      <line x1="8" y1="14" x2="8.01" y2="14" />
      <line x1="12" y1="14" x2="12.01" y2="14" />
      <line x1="16" y1="14" x2="16.01" y2="14" />
      <line x1="8" y1="18" x2="8.01" y2="18" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconTrendingDown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function IconZap({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconShare({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconChart({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconBank({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="5" y1="21" x2="5" y2="10" />
      <line x1="9" y1="21" x2="9" y2="10" />
      <line x1="15" y1="21" x2="15" y2="10" />
      <line x1="19" y1="21" x2="19" y2="10" />
      <polygon points="12 2 21 8 3 8" />
    </svg>
  );
}

function IconUpload({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconShieldCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconSmartphone({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconPhone({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function IconMail({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  );
}

function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function IconWhatsApp({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.52 3.48A11.9 11.9 0 0012.03 0C5.46 0 .12 5.34.12 11.9c0 2.1.55 4.14 1.6 5.94L0 24l6.34-1.66a11.86 11.86 0 005.69 1.45h.005c6.57 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.49-8.41zM12.04 21.4h-.004a9.5 9.5 0 01-4.84-1.33l-.347-.207-3.6.94.96-3.5-.226-.36a9.48 9.48 0 01-1.46-5.07c0-5.24 4.27-9.5 9.53-9.5a9.47 9.47 0 016.73 2.79 9.44 9.44 0 012.79 6.72c0 5.25-4.27 9.5-9.52 9.5zm5.2-7.12c-.28-.14-1.67-.82-1.93-.92-.26-.1-.45-.14-.64.14-.19.28-.74.92-.9 1.1-.17.19-.33.21-.61.07-.28-.14-1.18-.43-2.25-1.38-.83-.74-1.4-1.65-1.56-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.1-.19.05-.35-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.35-.26.28-1 1-1 2.43 0 1.43 1.03 2.82 1.17 3.01.14.19 2.03 3.1 4.93 4.35.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.11.56-.08 1.67-.68 1.9-1.34.24-.66.24-1.22.17-1.34-.07-.12-.26-.19-.54-.33z" />
    </svg>
  );
}

function IconStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* =========================================================
   CARROUSEL DASHBOARD — diaporama auto-défilant
   ========================================================= */
function DashboardCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  // Remet l'index à 0 si la liste d'images change (ex: mise à jour Firestore)
  useEffect(() => {
    setIndex(0);
  }, [images.length]);

  // Défilement automatique toutes les 4.5 secondes
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="relative w-full aspect-[16/10] bg-[#f7f9fb] overflow-hidden">
      {images.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt={`Aperçu du tableau de bord Billio ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Indicateurs (points) — cliquables, visibles uniquement s'il y a plusieurs images */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Voir l'image ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-6 bg-white shadow-md"
                  : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MODALE réutilisable
   ========================================================= */
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-10 relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#47464f] hover:text-[#070235] transition-colors"
          aria-label="Fermer"
        >
          <IconClose className="w-6 h-6" />
        </button>
        <h3 className="text-2xl md:text-3xl font-bold text-[#070235] mb-6 pr-8">
          {title}
        </h3>
        <div className="text-[#47464f] leading-relaxed space-y-4 text-sm md:text-base">
          {children}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DONNÉES TÉMOIGNAGES
   ========================================================= */
const testimonials = [
  {
    name: "HONMINOU Komlan Messah Parfait",
    role: "Fondateur de \"OBube Ink\" (entreprise sérigraphique)",
    location: "Lomé, Togo",
    phone: "+228 93 59 17 96",
    initials: "HP",
    text: "Avec Billio, je crée mes factures en moins de 2 minutes. Fini les erreurs de calcul de TVA, mes clients trouvent enfin mes documents professionnels.",
  },
  {
    name: "Aïcha Koné",
    role: "Fondatrice d'agence de communication",
    location: "Abidjan, Côte d'Ivoire",
    phone: null,
    initials: "AK",
    text: "Le suivi des paiements en temps réel m'a changé la vie. Je sais enfin qui m'a payé et qui est en retard, sans avoir à courir après mes clients.",
  },
  {
    name: "Fatou Diop",
    role: "Gérante de boutique en ligne",
    location: "Dakar, Sénégal",
    phone: null,
    initials: "FD",
    text: "Simple, rapide et vraiment adapté à nos réalités africaines. J'ai pu personnaliser mes factures avec mon logo et ça donne un rendu très pro.",
  },
  {
    name: "Yawa Adjovi",
    role: "Comptable freelance",
    location: "Lomé, Togo",
    phone: null,
    initials: "YA",
    text: "La gestion automatique de la TVA et de la RSPS me fait gagner un temps fou avec mes clients. Je recommande Billio à tous les entrepreneurs.",
  },
];

export default function LandingPage() {
  const [pricing, setPricing] = useState<PricingData>({
    monthly: 5000,
    sixMonths: 25000,
    yearly: 45000,
  });

  const [tutorial, setTutorial] = useState<TutorialData | null>(null);
  const [dashboardImages, setDashboardImages] = useState<string[]>([
    DEFAULT_DASHBOARD_IMAGE,
  ]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<
    null | "mentions" | "securite" | "contact"
  >(null);
  const [monthlyCount, setMonthlyCount] = useState<number>(1350);

  // Nombre d'entrepreneurs affiché dans le badge, recalculé côté client
  useEffect(() => {
    setMonthlyCount(getMonthlyEntrepreneurCount());
  }, []);

  // Firestore : écoute en temps réel du pricing
  useEffect(() => {
    const ref = doc(db, "config", "pricing");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPricing({
            monthly: data.monthly ?? 5000,
            sixMonths: data.sixMonths ?? 25000,
            yearly: data.yearly ?? 45000,
          });
        }
      },
      (error) => {
        console.error("Erreur Firestore pricing:", error);
      }
    );
    return () => unsub();
  }, []);

  // Firestore : écoute en temps réel du tutoriel (guide pratique)
  useEffect(() => {
    const ref = collection(db, "tutorials");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setTutorial({
            embedUrl: data.embedUrl ?? "",
            title: data.title ?? "Guide pratique Billio",
          });
        }
      },
      (error) => {
        console.error("Erreur Firestore tutorials:", error);
      }
    );
    return () => unsub();
  }, []);

  // Firestore : écoute en temps réel des captures d'écran du dashboard
  // (diaporama). Si la collection est vide ou inaccessible, on garde
  // l'image par défaut (DEFAULT_DASHBOARD_IMAGE).
  useEffect(() => {
    const ref = collection(db, "screenshots");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.empty) {
          const imgs = snap.docs
            .map((d) => {
              const data = d.data() as ScreenshotDoc;
              return { url: data.url, order: data.order ?? 0 };
            })
            .filter((item) => !!item.url)
            .sort((a, b) => a.order - b.order)
            .map((item) => item.url);

          setDashboardImages(imgs.length > 0 ? imgs : [DEFAULT_DASHBOARD_IMAGE]);
        } else {
          setDashboardImages([DEFAULT_DASHBOARD_IMAGE]);
        }
      },
      (error) => {
        console.error("Erreur Firestore screenshots:", error);
        setDashboardImages([DEFAULT_DASHBOARD_IMAGE]);
      }
    );
    return () => unsub();
  }, []);

  // Bloque le scroll quand le menu mobile ou une modale est ouvert
  useEffect(() => {
    document.body.style.overflow =
      mobileMenuOpen || activeModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen, activeModal]);

  // Animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );

    const fadeEls = document.querySelectorAll(".landing-page .fade-up");
    fadeEls.forEach((el) => observer.observe(el));

    const magneticEls = document.querySelectorAll<HTMLElement>(
      ".landing-page .magnetic"
    );
    const cleanups: (() => void)[] = [];

    magneticEls.forEach((elem) => {
      const move = (e: MouseEvent) => {
        const rect = elem.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        elem.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px) scale(1.02)`;
      };
      const leave = () => {
        elem.style.transform = "translate(0px, 0px) scale(1)";
      };
      elem.addEventListener("mousemove", move);
      elem.addEventListener("mouseleave", leave);
      cleanups.push(() => {
        elem.removeEventListener("mousemove", move);
        elem.removeEventListener("mouseleave", leave);
      });
    });

    return () => {
      fadeEls.forEach((el) => observer.unobserve(el));
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div
      className="landing-page bg-white text-[#191c1e] overflow-x-hidden selection:bg-[#e3dfff] selection:text-[#100069]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", zoom: 0.8 } as React.CSSProperties}
    >
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 bg-transparent py-6">
        <div className="max-w-7xl mx-auto px-6 md:px-20 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#1e1b4b] flex items-center justify-center text-white font-bold">
              B
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#070235]">
              Billio
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 bg-white/50 backdrop-blur-md px-8 py-3 rounded-full border border-[#e0e3e5]">
            <a
              className="text-[#191c1e] font-medium hover:text-[#4e45d5] transition-colors duration-300 text-sm"
              href="#features"
            >
              Fonctionnalités
            </a>
            <a
              className="text-[#191c1e] font-medium hover:text-[#4e45d5] transition-colors duration-300 text-sm"
              href="#pricing"
            >
              Tarifs
            </a>
            <a
              className="text-[#191c1e] font-medium hover:text-[#4e45d5] transition-colors duration-300 text-sm"
              href="#notre-histoire"
            >
              À propos
            </a>
            <a
              className="text-[#191c1e] font-medium hover:text-[#4e45d5] transition-colors duration-300 text-sm"
              href="#temoignages"
            >
              Témoignages
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              className="text-[#191c1e] font-medium text-sm hover:text-[#4e45d5] transition-colors"
              href="/login"
            >
              Se connecter
            </Link>
            <Link
              className="bg-[#1e1b4b] text-white px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all duration-300 font-medium text-sm hover:-translate-y-0.5"
              href="/signup"
            >
              Générer une facture
            </Link>
          </div>

          <button
            className="md:hidden text-[#070235] p-2"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <IconMenu className="w-7 h-7" />
          </button>
        </div>
      </nav>

      {/* Menu mobile plein écran */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col md:hidden">
          <div className="flex justify-between items-center px-6 py-6 border-b border-[#e0e3e5]">
            <Link
              href="/"
              className="flex items-center gap-3"
              onClick={closeMobileMenu}
            >
              <div className="h-10 w-10 rounded-lg bg-[#1e1b4b] flex items-center justify-center text-white font-bold">
                B
              </div>
              <span className="text-2xl font-bold tracking-tight text-[#070235]">
                Billio
              </span>
            </Link>
            <button
              onClick={closeMobileMenu}
              className="p-2 text-[#070235]"
              aria-label="Fermer le menu"
            >
              <IconClose className="w-7 h-7" />
            </button>
          </div>
          <div className="flex flex-col gap-1 px-6 py-8 flex-1 overflow-y-auto">
            <a
              href="#features"
              onClick={closeMobileMenu}
              className="text-lg font-medium text-[#191c1e] py-4 border-b border-[#f0f0f0]"
            >
              Fonctionnalités
            </a>
            <a
              href="#pricing"
              onClick={closeMobileMenu}
              className="text-lg font-medium text-[#191c1e] py-4 border-b border-[#f0f0f0]"
            >
              Tarifs
            </a>
            <a
              href="#notre-histoire"
              onClick={closeMobileMenu}
              className="text-lg font-medium text-[#191c1e] py-4 border-b border-[#f0f0f0]"
            >
              À propos
            </a>
            <a
              href="#temoignages"
              onClick={closeMobileMenu}
              className="text-lg font-medium text-[#191c1e] py-4 border-b border-[#f0f0f0]"
            >
              Témoignages
            </a>
            <a
              href="#guides"
              onClick={closeMobileMenu}
              className="text-lg font-medium text-[#191c1e] py-4 border-b border-[#f0f0f0]"
            >
              Guides pratiques
            </a>
          </div>
          <div className="flex flex-col gap-4 px-6 py-6 border-t border-[#e0e3e5]">
            <Link
              href="/login"
              onClick={closeMobileMenu}
              className="text-center py-3 rounded-full border border-[#e0e3e5] font-medium text-[#070235]"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              onClick={closeMobileMenu}
              className="text-center py-3 rounded-full bg-[#1e1b4b] text-white font-medium"
            >
              Générer une facture
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 md:px-20 relative overflow-hidden flex flex-col items-center text-center bg-white min-h-screen">
        {/* Floating icons */}
        <div className="absolute top-20 left-[5%] float-anim opacity-80 hidden md:block z-20">
          <div className="bg-white p-4 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform -rotate-12 border border-[#e0e3e5] w-32">
            <IconPaperclip className="w-9 h-9 text-[#070235]" />
            <div className="text-xs font-bold mt-2">Pièces jointes</div>
          </div>
        </div>
        <div className="absolute bottom-1/4 left-[8%] float-anim-delayed opacity-80 hidden md:block z-20">
          <div className="bg-white p-4 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform rotate-12 border border-[#e0e3e5] w-40">
            <div className="flex items-center gap-2">
              <IconCoins className="w-5 h-5 text-green-600" />
              <span className="font-bold text-[#070235]">FCFA</span>
            </div>
            <div className="text-[10px] text-[#47464f]">
              Transfert instantané
            </div>
          </div>
        </div>
        <div className="absolute top-1/4 right-[5%] float-anim opacity-80 hidden md:block z-20">
          <div className="bg-white p-2 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform rotate-6 border border-[#e0e3e5] w-48 overflow-hidden">
            <img
              alt="Invoice Preview"
              className="w-full h-auto rounded shadow-sm"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHtY0uN4Y9kshJnugtGfhCWATLC1X_tJLTc9mGA4ke841RRyIcf3kCCLAYQYMSRBxFdeC3gYrdaCNozALOmS7uT8vTtJ7Vv-Sg6nIzvaq58DCUKscDZMJ05oqmh_m2SSJqpw-mPHRC5ljbDqi9_zaHtudsqDqmU0jb65Wu6RG7MB2ozoPC79u_M00sR80o-OvHF3-Mk_ijAIansICAhladPT9n-5rJmNYH8QHINrhGl6t-KV3eQsBzwneXBn2dyqf7OMo"
            />
            <div className="text-[10px] font-bold mt-2 text-center text-[#070235]">
              Modèle de facture Pro
            </div>
          </div>
        </div>
        <div className="absolute bottom-1/3 right-[8%] float-anim-delayed opacity-80 hidden md:block z-20">
          <div className="bg-white p-4 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform -rotate-6 border border-[#e0e3e5] w-32">
            <IconWallet className="w-9 h-9 text-amber-500" />
            <div className="text-xs font-bold mt-2">Trésorerie</div>
          </div>
        </div>
        <div className="absolute top-1/4 left-10 md:left-32 float-anim opacity-80 hidden md:block z-20">
          <div className="bg-white p-4 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform -rotate-6 border border-[#e0e3e5] w-48">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">
                ✓
              </div>
              <div>
                <div className="h-2 w-20 bg-[#e0e3e5] rounded mb-1"></div>
                <div className="h-2 w-12 bg-[#e0e3e5] rounded"></div>
              </div>
            </div>
            <div className="text-left text-xs font-medium text-green-600">
              Facture payée !
            </div>
          </div>
        </div>
        <div className="absolute top-1/3 right-10 md:right-32 float-anim-delayed opacity-80 hidden md:block z-20">
          <div className="bg-white p-3 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform rotate-6 border border-[#e0e3e5] flex items-center gap-3">
            <div className="w-10 h-10 bg-[#4e45d5]/10 rounded-full flex items-center justify-center text-[#4e45d5] font-bold">
              €
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-[#070235]">
                Paiement reçu
              </div>
              <div className="text-xs text-[#47464f]">Il y a à l'instant</div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto z-10 fade-up relative mt-10">
          {/* Badge social proof */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 mb-8 rounded-full bg-white border border-[#e0e3e5] shadow-md hover:shadow-lg transition-all duration-300">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                JD
              </div>
              <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                FG
              </div>
            </div>
            <span className="text-sm font-medium text-[#191c1e]">
              Rejoint par{" "}
              <strong className="text-[#070235] font-bold">
                +{formatPrice(monthlyCount)}
              </strong>{" "}
              entrepreneurs ce mois-ci
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1] md:leading-[1.05] text-[#070235] mb-6">
            <span className="text-[#070235]">
              Dites adieu aux factures sur
            </span>
            <br />
            <span className="text-[#4e45d5]">Word et Excel.</span>
          </h1>
          <p className="text-lg md:text-xl leading-[30px] text-[#47464f] mb-10 max-w-2xl mx-auto">
            La solution de facturation moderne pensée pour les entrepreneurs
            africains. Simple, rapide et professionnelle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              href="/signup"
              className="magnetic w-full sm:w-auto bg-[#1e1b4b] text-white px-8 py-4 rounded-full shadow-[0_10px_15px_-3px_rgba(30,27,75,0.2),0_4px_6px_-2px_rgba(30,27,75,0.1)] hover:bg-[#070235] transition-colors font-medium text-base text-center hover:-translate-y-1"
            >
              Créer une facture en quelques secondes
            </Link>
          </div>
        </div>

        {/* Aperçu du dashboard — désormais un diaporama Firestore */}
        <div className="w-full max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-[#F1F5F9] fade-up z-10 relative transform md:-rotate-1 hover:rotate-0 transition-transform duration-700 bg-white">
          <div className="bg-[#f7f9fb] border-b border-[#F1F5F9] px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <div className="ml-4 text-xs font-medium text-[#47464f]">
              billio.jblessconsulting.com
            </div>
          </div>
          <DashboardCarousel images={dashboardImages} />
        </div>
      </section>

      {/* Logos Section */}
      <section className="py-10 border-b border-[#e0e3e5] bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-20 text-center fade-up">
          <p className="text-sm font-medium text-[#47464f] mb-6 uppercase tracking-wider">
            Adopté par plus de 5,000 entreprises et freelances
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <span className="text-xl font-bold">freshworks</span>
            <span className="text-xl font-bold">Outreach</span>
            <span className="text-xl font-bold">pipedrive</span>
            <span className="text-xl font-bold">Marketo</span>
            <span className="text-xl font-bold">LinkedIn</span>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-32 px-6 md:px-20 bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold md:text-[40px] text-[#070235] mb-4">
              Pourquoi Billio ?
            </h2>
            <p className="text-lg md:text-xl text-[#47464f] max-w-2xl mx-auto">
              Les fichiers Excel étaient bien à vos débuts. Mais vos
              ambitions ont grandi, et vos outils doivent suivre.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-[#F1F5F9] fade-up hover:-translate-y-2 transition-transform duration-300">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                <IconImage className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-[#070235] mb-4">
                Factures peu professionnelles
              </h3>
              <p className="text-[#47464f] leading-relaxed">
                L'image de votre marque en souffre. Vos clients perdent
                confiance devant des documents bricolés sur Excel ou Word.
              </p>
            </div>
            <div
              className="bg-white p-10 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-[#F1F5F9] fade-up hover:-translate-y-2 transition-transform duration-300"
              style={{ transitionDelay: "100ms" }}
            >
              <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mb-6">
                <IconCalculator className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-[#070235] mb-4">
                Calculs de TVA manuels
              </h3>
              <p className="text-[#47464f] leading-relaxed">
                Les erreurs de calcul sont fréquentes. Le suivi de la TVA à
                18% vous prend un temps fou et génère du stress inutile.
              </p>
            </div>
            <div
              className="bg-white p-10 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-[#F1F5F9] fade-up hover:-translate-y-2 transition-transform duration-300"
              style={{ transitionDelay: "200ms" }}
            >
              <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-6">
                <IconTrendingDown className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-[#070235] mb-4">
                Suivi impossible
              </h3>
              <p className="text-[#47464f] leading-relaxed">
                Ne sachant pas ce qui a été payé, vous laissez traîner des
                impayés et votre trésorerie en pâtit gravement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 md:px-20 bg-white" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="fade-up">
              <h2 className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold md:text-[48px] md:leading-tight text-[#070235] mb-12">
                Tout ce dont vous avez besoin pour dominer votre marché.
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <IconZap className="w-6 h-6 text-[#4e45d5] mb-2" />
                  <h4 className="font-bold text-[#070235] text-base mb-1">
                    Factures Pro en 2 clics
                  </h4>
                  <p className="text-sm text-[#47464f]">
                    Modèles designs et personnalisés, prêts pour votre
                    entreprise.
                  </p>
                </div>
                <div>
                  <IconShare className="w-6 h-6 text-[#4e45d5] mb-2" />
                  <h4 className="font-bold text-[#070235] text-base mb-1">
                    TVA 18% automatique
                  </h4>
                  <p className="text-sm text-[#47464f]">
                    Plus de calculs à la main, générez vos factures en un
                    rien de temps.
                  </p>
                </div>
                <div>
                  <IconChart className="w-6 h-6 text-[#4e45d5] mb-2" />
                  <h4 className="font-bold text-[#070235] text-base mb-1">
                    Suivi en temps réel
                  </h4>
                  <p className="text-sm text-[#47464f]">
                    Sachez exactement ce qui est payé, quand, et par qui.
                  </p>
                </div>
                <div>
                  <IconUsers className="w-6 h-6 text-[#4e45d5] mb-2" />
                  <h4 className="font-bold text-[#070235] text-base mb-1">
                    Gestion Clients
                  </h4>
                  <p className="text-sm text-[#47464f]">
                    Une base de données claire pour retrouver vos infos
                    clients.
                  </p>
                </div>
                <div>
                  <IconBank className="w-6 h-6 text-[#4e45d5] mb-2" />
                  <h4 className="font-bold text-[#070235] text-base mb-1">
                    RSPS &amp; TVA Flexibles
                  </h4>
                  <p className="text-sm text-[#47464f]">
                    Appliquez la TVA et la RSPS avec des taux modifiables
                    selon vos besoins.
                  </p>
                </div>
                <div>
                  <IconUpload className="w-6 h-6 text-[#4e45d5] mb-2" />
                  <h4 className="font-bold text-[#070235] text-base mb-1">
                    Personnalisation complète
                  </h4>
                  <p className="text-sm text-[#47464f]">
                    Importez votre logo, votre signature et cachet scannés
                    pour un rendu authentique.
                  </p>
                </div>
              </div>
            </div>

            <div className="fade-up grid grid-cols-2 gap-4 auto-rows-[160px] lg:auto-rows-[180px]">
              <div className="bg-[#1e1e24] rounded-3xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="text-white/80 font-medium text-sm text-center z-10">
                  Design captivant
                </span>
              </div>
              <div className="bg-[#2563eb] rounded-3xl p-6 flex flex-col justify-between shadow-lg row-span-2">
                <IconShieldCheck className="w-8 h-8 text-white" />
                <h3 className="text-white font-bold text-xl leading-tight">
                  Sécurité bancaire
                  <br />
                  pour vos données.
                </h3>
              </div>
              <div className="bg-[#1e1b4b] rounded-3xl p-6 flex flex-col justify-end shadow-lg row-span-2 relative">
                <div className="absolute inset-0 z-0">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmo2j2aRosP697-hz7CMX41qb4VdCkkdimNVke3TiawqAG5FVfuLztL_9J24UHgcOPebN3YasOL6WQDYrWfdpacHu5mHYVhXbyd772PL8FVwxIuQis9S1Pl-CfXjDHoOfE-L_bcIaHrHGWRdhmkNmszsKRobftSDRcFpewXURDjVrfQHocT28CT4GX9WtLW821gUtlXzDHnOWAiXZ_SzN6k_i730M6dsrClEkNeXwoSF1hGz6PMizak6L1pTM8KG9_12U"
                    alt="Modèle de facture OHADA"
                    className="w-full h-full object-cover opacity-40"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b] to-transparent z-10"></div>
                <h3 className="text-white font-bold text-xl leading-tight relative z-20">
                  Conforme aux
                  <br />
                  standards
                  <br />
                  OHADA.
                </h3>
              </div>
              <div className="bg-[#1e1e24] rounded-3xl p-6 flex flex-col items-center justify-center shadow-lg">
                <IconSmartphone className="w-9 h-9 text-[#7dd3fc] mb-3" />
                <span className="text-white/60 text-[11px] font-bold tracking-widest uppercase">
                  Responsive
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-32 px-6 md:px-20 bg-[#1e1b4b] text-white rounded-[3rem] mx-4 md:mx-10 my-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-5xl mx-auto text-center fade-up relative z-10">
          <h2 className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold md:text-[40px] mb-16">
            Comment ça marche ?
          </h2>
          <div className="flex flex-col md:flex-row justify-between items-center gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-white/20"></div>
            <div className="flex-1 flex flex-col items-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-white text-[#1e1b4b] flex items-center justify-center text-3xl font-bold mb-6 shadow-xl">
                1
              </div>
              <h4 className="font-bold text-xl mb-3">Inscrivez-vous</h4>
              <p className="text-white/80">
                Créez votre compte en moins d'une minute.
              </p>
            </div>
            <div className="flex-1 flex flex-col items-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-white text-[#1e1b4b] flex items-center justify-center text-3xl font-bold mb-6 shadow-xl">
                2
              </div>
              <h4 className="font-bold text-xl mb-3">Créez votre facture</h4>
              <p className="text-white/80">
                Remplissez les détails et laissez Billio calculer la TVA
                18%.
              </p>
            </div>
            <div className="flex-1 flex flex-col items-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-white text-[#1e1b4b] flex items-center justify-center text-3xl font-bold mb-6 shadow-xl">
                3
              </div>
              <h4 className="font-bold text-xl mb-3">Envoyez et suivez</h4>
              <p className="text-white/80">
                Expédiez au client et suivez l'état du paiement en temps
                réel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 px-6 md:px-20 bg-white" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold md:text-[40px] text-[#070235] mb-4">
              Des tarifs simples et transparents
            </h2>
            <p className="text-lg md:text-xl text-[#47464f]">
              Choisissez le plan qui correspond à votre volume d'activité.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Gratuit */}
            <div className="bg-[#f7f9fb] border border-[#e0e3e5] p-8 rounded-3xl flex flex-col fade-up hover:border-[#070235]/20 transition-colors">
              <h3 className="font-bold text-[#47464f] text-xl mb-2">
                Gratuit
              </h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#070235]">
                  0 FCFA
                </span>
                <span className="text-sm text-[#47464f]"> / 30 jours</span>
              </div>
              <p className="text-sm text-[#47464f] mb-8 flex-grow">
                Idéal pour tester la plateforme sans engagement.
              </p>
              <Link
                className="w-full text-center py-3 rounded-full border border-[#e0e3e5] font-bold text-[#070235] hover:bg-[#f2f4f6] transition-colors"
                href="/signup"
              >
                Essayer
              </Link>
            </div>

            {/* Standard */}
            <div
              className="bg-[#f7f9fb] border border-[#e0e3e5] p-8 rounded-3xl flex flex-col fade-up hover:border-[#070235]/20 transition-colors"
              style={{ transitionDelay: "100ms" }}
            >
              <h3 className="font-bold text-[#47464f] text-xl mb-2">
                Standard
              </h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#070235]">
                  {formatPrice(pricing.monthly)} FCFA
                </span>
                <span className="text-sm text-[#47464f]"> / mois</span>
              </div>
              <p className="text-sm text-[#47464f] mb-8 flex-grow">
                Pour les freelances avec un volume régulier.
              </p>
              <Link
                className="w-full text-center py-3 rounded-full border border-[#e0e3e5] font-bold text-[#070235] hover:bg-[#f2f4f6] transition-colors"
                href="/signup"
              >
                Choisir
              </Link>
            </div>

            {/* Populaire */}
            <div className="bg-[#1e1b4b] p-8 rounded-3xl flex flex-col relative shadow-xl fade-up transform md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-[#1e1b4b] text-xs font-bold px-4 py-1.5 rounded-full shadow-sm whitespace-nowrap">
                POPULAIRE
              </div>
              <h3 className="font-bold text-white/80 text-xl mb-2">
                Populaire
              </h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">
                  {formatPrice(pricing.sixMonths)} FCFA
                </span>
                <span className="text-sm text-white/60"> / 6 mois</span>
              </div>
              <p className="text-sm text-white/80 mb-8 flex-grow">
                Accès illimité pour les agences et PME en croissance.
              </p>
              <Link
                className="w-full text-center py-3 rounded-full bg-white text-[#1e1b4b] font-bold hover:bg-[#f7f9fb] transition-colors"
                href="/signup"
              >
                Choisir
              </Link>
            </div>

            {/* Économique */}
            <div
              className="bg-[#f7f9fb] border border-[#e0e3e5] p-8 rounded-3xl flex flex-col fade-up hover:border-[#070235]/20 transition-colors"
              style={{ transitionDelay: "300ms" }}
            >
              <h3 className="font-bold text-[#47464f] text-xl mb-2">
                Économique
              </h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#070235]">
                  {formatPrice(pricing.yearly)} FCFA
                </span>
                <span className="text-sm text-[#47464f]"> / 12 mois</span>
              </div>
              <p className="text-sm text-[#47464f] mb-8 flex-grow">
                La meilleure valeur pour un engagement annuel.
              </p>
              <Link
                className="w-full text-center py-3 rounded-full border border-[#e0e3e5] font-bold text-[#070235] hover:bg-[#f2f4f6] transition-colors"
                href="/signup"
              >
                Choisir
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 md:px-20 bg-white text-center">
        <div className="max-w-4xl mx-auto fade-up">
          <h2 className="text-5xl md:text-[56px] font-bold tracking-tight leading-tight text-[#070235] mb-8">
            Rejoignez les entrepreneurs qui facturent comme des pros
          </h2>
          <Link
            href="/signup"
            className="magnetic inline-block bg-[#1e1b4b] text-white px-10 py-5 rounded-full shadow-xl hover:bg-[#070235] transition-all font-bold text-lg hover:-translate-y-1"
          >
            Commencer gratuitement dès aujourd'hui
          </Link>
        </div>
      </section>

      {/* Notre Histoire */}
      <section id="notre-histoire" className="py-24 bg-[#f7f9fb] px-6 md:px-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 items-center">
          <div className="md:col-span-2 space-y-6">
            <span className="bg-indigo-50 text-indigo-500 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">
              Notre Histoire
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-[#070235] leading-tight">
              Un constat simple, une conviction claire
            </h2>
            <div className="space-y-4 text-[#47464f] text-lg leading-relaxed">
              <p>
                Tout est parti d&apos;un constat partagé par{" "}
                <strong>Joel GLOBO</strong>, Gestionnaire comptable et
                fondateur du cabinet <strong>JBLESS CONSULTING</strong> : au
                quotidien, les TPE et indépendants perdent un temps
                considérable sur leur facturation et subissent trop souvent
                des impayés, faute d&apos;outils à la fois simples et
                réellement efficaces.
              </p>
              <p>
                C&apos;est dans ce contexte que <strong>Billio</strong> est
                née, avec une conviction simple :{" "}
                <span className="text-[#4e45d5] font-semibold">
                  la conformité ne doit jamais obliger à tout changer.
                </span>
              </p>
              <p>
                Excel, Word, ou votre outil habituel : vous gardez vos
                habitudes. Billio s&apos;occupe du reste — conversion,
                transmission, conformité — sans rien vous imposer.
              </p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-[#e0e3e5] flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-[#1e1b4b] flex items-center justify-center rounded-full mb-6">
              <span className="text-4xl font-bold text-white italic">B</span>
            </div>
            <h3 className="text-xl font-bold text-[#070235] mb-1">
              Joel GLOBO
            </h3>
            <p className="text-[#47464f] text-sm mb-4 italic">
              Responsable du cabinet JBLESS CONSULTING
            </p>
            <div className="flex items-center gap-2 text-[#47464f] font-medium text-sm">
              <IconMapPin className="w-4 h-4" />
              Lomé • Togo
            </div>
          </div>
        </div>
      </section>

      {/* Témoignages */}
      <section id="temoignages" className="py-32 px-6 md:px-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <span className="bg-indigo-50 text-indigo-500 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">
              Témoignages
            </span>
            <h2 className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold md:text-[40px] text-[#070235] mt-4 mb-4">
              Ils facturent déjà avec Billio
            </h2>
            <p className="text-lg md:text-xl text-[#47464f] max-w-2xl mx-auto">
              Des entrepreneurs togolais, ivoiriens et sénégalais nous font
              confiance au quotidien.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className="bg-[#f7f9fb] border border-[#e0e3e5] p-8 rounded-3xl fade-up hover:-translate-y-1 transition-transform duration-300"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-1 mb-4 text-amber-400">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <IconStar key={idx} className="w-4 h-4" />
                  ))}
                </div>
                <p className="text-[#47464f] leading-relaxed mb-6">
                  &laquo; {t.text} &raquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1e1b4b] flex items-center justify-center text-white font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-[#070235] text-sm">
                      {t.name}
                    </div>
                    <div className="text-xs text-[#47464f]">
                      {t.role} • {t.location}
                    </div>
                    {t.phone && (
                      <a
                        href={`tel:${t.phone.replace(/\s/g, "")}`}
                        className="flex items-center gap-1.5 mt-1 text-xs text-[#4e45d5] font-medium hover:underline"
                      >
                        <IconPhone className="w-3 h-3" />
                        {t.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guide pratique */}
      <section id="guides" className="py-32 px-6 md:px-20 bg-[#f7f9fb]">
        <div className="max-w-4xl mx-auto text-center fade-up">
          <span className="bg-indigo-50 text-indigo-500 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">
            Guide pratique
          </span>
          <h2 className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold md:text-[40px] text-[#070235] mt-4 mb-4">
            Apprenez à utiliser Billio en vidéo
          </h2>
          <p className="text-lg text-[#47464f] mb-12">
            Un tutoriel complet pour maîtriser toutes les fonctionnalités de
            l'application.
          </p>
          <div className="bg-white rounded-3xl shadow-[0px_20px_40px_rgba(0,0,0,0.06)] border border-[#e0e3e5] overflow-hidden max-w-3xl mx-auto text-left">
            <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
              {tutorial?.embedUrl ? (
                <iframe
                  key={tutorial.embedUrl}
                  src={tutorial.embedUrl}
                  title={tutorial.title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                  Chargement de la vidéo...
                </div>
              )}
            </div>
            <div className="p-6">
              <h3 className="font-bold text-[#070235] text-lg">
                {tutorial?.title ?? "Tutoriel complet Billio | Guide d'utilisation"}
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1e1b4b] text-white border-t border-white/10 w-full py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-20 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                B
              </div>
              <span className="text-xl font-bold text-white">Billio</span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed">
              © 2026 Billio. La solution de facturation moderne pour les
              entrepreneurs. Fait avec fierté en Afrique.
            </p>
          </div>
          <div className="col-span-1 flex flex-col gap-4">
            <h4 className="font-bold text-white mb-2">Produit</h4>
            <a
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              href="#features"
            >
              Fonctionnalités
            </a>
            <a
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              href="#pricing"
            >
              Tarifs
            </a>
            <button
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              onClick={() => setActiveModal("securite")}
            >
              Sécurité
            </button>
          </div>
          <div className="col-span-1 flex flex-col gap-4">
            <h4 className="font-bold text-white mb-2">Ressources</h4>
            <a
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              href="#temoignages"
            >
              Témoignages
            </a>
            <a
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              href="#guides"
            >
              Guides pratiques
            </a>
          </div>
          <div className="col-span-1 flex flex-col gap-4">
            <h4 className="font-bold text-white mb-2">Support</h4>
            <button
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              onClick={() => setActiveModal("contact")}
            >
              Contactez-nous
            </button>
            <button
              className="text-white/60 hover:text-white transition-colors text-sm text-left"
              onClick={() => setActiveModal("mentions")}
            >
              Mentions légales
            </button>
          </div>
        </div>
      </footer>

      {/* Bulle WhatsApp flottante */}
      <a
        href="https://wa.me/22897428298"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[150] bg-[#25D366] hover:bg-[#1ebe57] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-110"
        aria-label="Contactez-nous sur WhatsApp"
      >
        <IconWhatsApp className="w-7 h-7" />
      </a>

      {/* Modale Mentions légales */}
      <Modal
        isOpen={activeModal === "mentions"}
        onClose={() => setActiveModal(null)}
        title="Mentions légales"
      >
        <p>
          <strong>Éditeur du site :</strong> Billio est édité par le cabinet{" "}
          <strong>JBLESS CONSULTING</strong>, dirigé par Monsieur Joel GLOBO,
          Gestionnaire comptable, basé à Lomé, Togo.
        </p>
        <p>
          <strong>Directeur de la publication :</strong> Joel GLOBO.
        </p>
        <p>
          <strong>Hébergement :</strong> L'application et les données sont
          hébergées sur des infrastructures cloud sécurisées (Google
          Firebase / Vercel Inc.), garantissant disponibilité et protection
          des données.
        </p>
        <p>
          <strong>Propriété intellectuelle :</strong> L'ensemble des
          contenus présents sur Billio (textes, logo, interface, code
          source) est la propriété exclusive de JBLESS CONSULTING. Toute
          reproduction, même partielle, est interdite sans autorisation
          préalable.
        </p>
        <p>
          <strong>Données personnelles :</strong> Conformément à la
          législation togolaise relative à la protection des données à
          caractère personnel, Billio s'engage à protéger les informations
          de ses utilisateurs et clients. Aucune donnée n'est cédée à des
          tiers sans consentement.
        </p>
        <p>
          <strong>Responsabilité :</strong> Billio met tout en œuvre pour
          assurer l'exactitude des informations diffusées, mais ne saurait
          être tenu responsable des erreurs ou omissions.
        </p>
        <p>
          <strong>Droit applicable :</strong> Les présentes mentions légales
          sont soumises au droit togolais. Tout litige relève de la
          compétence des juridictions de Lomé.
        </p>
        <p>
          <strong>Contact :</strong> contact@jblessconsulting.com — +228 97
          42 82 98.
        </p>
      </Modal>

      {/* Modale Sécurité */}
      <Modal
        isOpen={activeModal === "securite"}
        onClose={() => setActiveModal(null)}
        title="Sécurité de vos données"
      >
        <div className="flex items-start gap-3">
          <IconShieldCheck className="w-6 h-6 text-[#4e45d5] shrink-0 mt-1" />
          <p>
            <strong>Chiffrement des données :</strong> Toutes les
            communications entre votre navigateur et nos serveurs sont
            chiffrées via le protocole SSL/TLS.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <IconBank className="w-6 h-6 text-[#4e45d5] shrink-0 mt-1" />
          <p>
            <strong>Hébergement sécurisé :</strong> Vos données sont
            hébergées sur l'infrastructure cloud de Google Firebase, conforme
            aux standards de sécurité internationaux les plus stricts.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <IconUpload className="w-6 h-6 text-[#4e45d5] shrink-0 mt-1" />
          <p>
            <strong>Sauvegardes automatiques :</strong> Vos factures et
            données clients sont sauvegardées automatiquement pour éviter
            toute perte.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <IconUsers className="w-6 h-6 text-[#4e45d5] shrink-0 mt-1" />
          <p>
            <strong>Accès contrôlé :</strong> Seul vous avez accès à votre
            espace via une authentification sécurisée par email et mot de
            passe.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <IconZap className="w-6 h-6 text-[#4e45d5] shrink-0 mt-1" />
          <p>
            <strong>Mises à jour continues :</strong> Notre équipe surveille
            et met à jour régulièrement l'application pour corriger toute
            vulnérabilité potentielle.
          </p>
        </div>
      </Modal>

      {/* Modale Contact */}
      <Modal
        isOpen={activeModal === "contact"}
        onClose={() => setActiveModal(null)}
        title="Contactez-nous"
      >
        <p className="mb-2">
          Notre équipe est disponible pour répondre à toutes vos questions
          concernant Billio.
        </p>
        <div className="space-y-4 mt-6">
          <a
            href="tel:+22897428298"
            className="flex items-center gap-4 p-4 rounded-2xl bg-[#f7f9fb] border border-[#e0e3e5] hover:border-[#4e45d5]/40 transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-[#4e45d5]/10 text-[#4e45d5] flex items-center justify-center shrink-0">
              <IconPhone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#47464f]">Téléphone</div>
              <div className="font-bold text-[#070235]">
                +228 97 42 82 98
              </div>
            </div>
          </a>

          <a
            href="https://wa.me/22897428298"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl bg-[#f7f9fb] border border-[#e0e3e5] hover:border-[#25D366]/40 transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
              <IconWhatsApp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#47464f]">WhatsApp</div>
              <div className="font-bold text-[#070235]">
                +228 97 42 82 98
              </div>
            </div>
          </a>

          <a
            href="https://jblessconsulting.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl bg-[#f7f9fb] border border-[#e0e3e5] hover:border-[#4e45d5]/40 transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-[#4e45d5]/10 text-[#4e45d5] flex items-center justify-center shrink-0">
              <IconGlobe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#47464f]">Site web</div>
              <div className="font-bold text-[#070235]">
                jblessconsulting.com
              </div>
            </div>
          </a>

          <a
            href="mailto:contact@jblessconsulting.com"
            className="flex items-center gap-4 p-4 rounded-2xl bg-[#f7f9fb] border border-[#e0e3e5] hover:border-[#4e45d5]/40 transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-[#4e45d5]/10 text-[#4e45d5] flex items-center justify-center shrink-0">
              <IconMail className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#47464f]">Email</div>
              <div className="font-bold text-[#070235]">
                contact@jblessconsulting.com
              </div>
            </div>
          </a>
        </div>
      </Modal>
    </div>
  );
}