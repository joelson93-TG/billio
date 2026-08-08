"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface PricingData {
  monthly: number;
  sixMonths: number;
  yearly: number;
}

function formatPrice(price: number): string {
  return price.toLocaleString("fr-FR");
}

export default function LandingPage() {
  const [pricing, setPricing] = useState<PricingData>({
    monthly: 5000,
    sixMonths: 25000,
    yearly: 45000,
  });

  // Firestore : écoute en temps réel
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

  return (
    <div
      style={{
        transform: "scale(0.8)",
        transformOrigin: "top left",
        width: "125%",
        minHeight: "125vh",
      }}
    >
      <div
        className="landing-page bg-white text-[#191c1e] overflow-x-hidden selection:bg-[#e3dfff] selection:text-[#100069]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
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

            <button className="md:hidden text-[#070235] p-2">
              <span className="material-symbols-outlined text-[28px]">
                menu
              </span>
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6 md:px-20 relative overflow-hidden flex flex-col items-center text-center bg-white min-h-screen">
          {/* Floating icons */}
          <div className="absolute top-20 left-[5%] float-anim opacity-80 hidden md:block z-20">
            <div className="bg-white p-4 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform -rotate-12 border border-[#e0e3e5] w-32">
              <span className="material-symbols-outlined text-4xl text-[#070235]">
                attach_file
              </span>
              <div className="text-xs font-bold mt-2">Pièces jointes</div>
            </div>
          </div>
          <div className="absolute bottom-1/4 left-[8%] float-anim-delayed opacity-80 hidden md:block z-20">
            <div className="bg-white p-4 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transform rotate-12 border border-[#e0e3e5] w-40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">
                  payments
                </span>
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
              <span className="material-symbols-outlined text-4xl text-amber-500">
                account_balance_wallet
              </span>
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
                <div className="text-xs text-[#47464f]">
                  Il y a à l'instant
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto z-10 fade-up relative mt-10">
            <div className="inline-flex items-center gap-3 px-6 py-3 mb-8 rounded-full bg-[#f2f4f6]/50 border border-[#c8c5d0]/20 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgPXMU2tAVTMiiN6lv-Eqjs5mbJLv7w_YFf3PBodoGInIJf8Ww5VxR2oVKR_pJfpF0TgdWukNJfYd2yJ6waK2Mwo6zy7JPo1zilLvM32gItOihVIBIf3S64bZHzQqjFd8rc2XPHBy4yMYTIoF3ugxMK0XQWUk04pVkki33CDiS4HSWGp2ZGhXJWgZv221tQx_ees8x9CWjAj034Le_JCgKI0GIdBxu7-o4ocMltV2ZzuvsD9O6v64rfMbtCBi75D5vf50"
                alt="Social Proof"
                className="h-10 w-auto object-contain"
              />
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1] md:leading-[1.05] text-[#070235] mb-6">
              <span className="text-[#070235]">
                Dites adieu aux factures sur
              </span>
              <br className="hidden md:block" />
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

          <div className="w-full max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-[#F1F5F9] fade-up z-10 relative transform md:-rotate-1 hover:rotate-0 transition-transform duration-700 bg-white">
            <div className="bg-[#f7f9fb] border-b border-[#F1F5F9] px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <div className="ml-4 text-xs font-medium text-[#47464f]">
                billio.jblessconsulting.com
              </div>
            </div>
            <img
              alt="Billio Dashboard"
              className="w-full h-auto object-cover block"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQjEYxYXGxCrnL5wSnV81SofvfkfpfBBW_FcW4-8qsxtTNCXxRt33u7iG8xPZ7yW6S19Z6o_1zDu03NP3emAQlaCvHswLvyMCxS3xlzcTKlqxJMIaufarHCGbJhPh4eYp0ZrgijBjBk-8IiJQKpDwcY9IM1RCcxJat6Fk-38_cMC1ZSDraMIswGbRBgJ9PAdkWspKbRx_CUhcCLZwmidsexf9pxOKhNlKMsChjRlb4gpE5riRW91rvSsquo8NgkQ06Sgw"
            />
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
                Les fichiers Excel étaient bien à vos débuts. Mais vos ambitions
                ont grandi, et vos outils doivent suivre.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-[#F1F5F9] fade-up hover:-translate-y-2 transition-transform duration-300">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    image
                  </span>
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
                  <span className="material-symbols-outlined text-3xl">
                    calculate
                  </span>
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
                  <span className="material-symbols-outlined text-3xl">
                    trending_down
                  </span>
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
                    <span className="material-symbols-outlined text-[#4e45d5] mb-2">
                      bolt
                    </span>
                    <h4 className="font-bold text-[#070235] text-base mb-1">
                      Factures Pro en 2 clics
                    </h4>
                    <p className="text-sm text-[#47464f]">
                      Modèles designs et personnalisés, prêts pour votre
                      entreprise.
                    </p>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-[#4e45d5] mb-2">
                      share
                    </span>
                    <h4 className="font-bold text-[#070235] text-base mb-1">
                      TVA 18% automatique
                    </h4>
                    <p className="text-sm text-[#47464f]">
                      Plus de calculs à la main, générez vos factures en un
                      rien de temps.
                    </p>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-[#4e45d5] mb-2">
                      monitoring
                    </span>
                    <h4 className="font-bold text-[#070235] text-base mb-1">
                      Suivi en temps réel
                    </h4>
                    <p className="text-sm text-[#47464f]">
                      Sachez exactement ce qui est payé, quand, et par qui.
                    </p>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-[#4e45d5] mb-2">
                      group
                    </span>
                    <h4 className="font-bold text-[#070235] text-base mb-1">
                      Gestion Clients
                    </h4>
                    <p className="text-sm text-[#47464f]">
                      Une base de données claire pour retrouver vos infos
                      clients.
                    </p>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-[#4e45d5] mb-2">
                      account_balance
                    </span>
                    <h4 className="font-bold text-[#070235] text-base mb-1">
                      RSPS &amp; TVA Flexibles
                    </h4>
                    <p className="text-sm text-[#47464f]">
                      Appliquez la TVA et la RSPS avec des taux modifiables
                      selon vos besoins.
                    </p>
                  </div>
                  <div>
                    <span className="material-symbols-outlined text-[#4e45d5] mb-2">
                      upload_file
                    </span>
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
                  <span className="material-symbols-outlined text-white text-3xl">
                    verified_user
                  </span>
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
                  <span className="material-symbols-outlined text-[#7dd3fc] text-4xl mb-3">
                    smartphone
                  </span>
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
                <h4 className="font-bold text-xl mb-3">
                  Créez votre facture
                </h4>
                <p className="text-white/80">
                  Remplissez les détails et laissez Billio calculer la TVA 18%.
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

              {/* Standard — monthly depuis Firestore */}
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

              {/* Populaire — sixMonths depuis Firestore */}
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

              {/* Économique — yearly depuis Firestore */}
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
        <section
          id="notre-histoire"
          className="py-24 bg-[#f7f9fb] px-6 md:px-20"
        >
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
                <span className="material-symbols-outlined text-sm">
                  location_on
                </span>
                Lomé • Togo
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
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#features"
              >
                Fonctionnalités
              </a>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#pricing"
              >
                Tarifs
              </a>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#"
              >
                Sécurité
              </a>
            </div>
            <div className="col-span-1 flex flex-col gap-4">
              <h4 className="font-bold text-white mb-2">Ressources</h4>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#"
              >
                Témoignages
              </a>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#"
              >
                Blog
              </a>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#"
              >
                Guides pratiques
              </a>
            </div>
            <div className="col-span-1 flex flex-col gap-4">
              <h4 className="font-bold text-white mb-2">Aide</h4>
              <Link
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="/centre-d-aide"
              >
                Centre d&apos;aide
              </Link>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#"
              >
                Contactez-nous
              </a>
              <a
                className="text-white/60 hover:text-white transition-colors text-sm"
                href="#"
              >
                Mentions légales
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}