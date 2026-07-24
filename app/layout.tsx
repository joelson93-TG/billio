import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script"; // <-- Import du composant Script de Next.js
import "./globals.css";
import SidebarWrapper from "@/components/SidebarWrapper"; // <-- Import modifié

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billio - Gestion & Facturation",
  description: "Application de gestion d'entreprise",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
        
        {/* Chargement global et optimisé du script FedaPay */}
        <Script 
          src="https://checkout.fedapay.com/js/fedapay.js" 
          strategy="afterInteractive" 
        />

        {/* Barre latérale / Header mobile (gérée conditionnellement) */}
        <SidebarWrapper />

        {/* Contenu principal de la page active 
            - pt-16 : décale le contenu sous le header fixe sur mobile
            - md:pt-0 : réinitialise l'alignement sur PC
            - pb-8 : marge d'aisance en bas de page sur mobile */}
        <main className="flex-1 flex flex-col h-dvh md:h-screen overflow-y-auto bg-[#F8FAFC] pt-16 md:pt-0 pb-8 md:pb-0">
          {children}
        </main>

      </body>
    </html>
  );
}