import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SidebarWrapper from "@/components/SidebarWrapper";
import PageShell from "@/components/PageShell";

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
        <Script
          src="https://checkout.fedapay.com/js/fedapay.js"
          strategy="afterInteractive"
        />

        <SidebarWrapper />

        <PageShell>{children}</PageShell>
      </body>
    </html>
  );
}