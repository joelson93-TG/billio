import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SidebarWrapper from "@/components/SidebarWrapper";

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
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col md:flex-row antialiased">
        
        {/* Chargement global et optimisé du script FedaPay */}
        <Script 
          src="https://checkout.fedapay.com/js/fedapay.js" 
          strategy="afterInteractive" 
        />

        {/* Barre latérale / Header mobile */}
        <SidebarWrapper />

        {/* Contenu principal de la page active 
            - Suppression de h-dvh / h-screen et overflow-hidden bloquants
            - Utilisation d'un flux naturel fluide (min-h-screen) pour Safari / iPad */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] pt-16 md:pt-0 min-h-screen">
          {children}
        </main>

      </body>
    </html>
  );
}