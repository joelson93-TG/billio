// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://billio.jblessconsulting.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Billio - Gestion & Facturation",
    template: "%s | Billio",
  },
  description:
    "Application de gestion d'entreprise et de facturation en ligne pour les entrepreneurs africains : factures conformes OHADA, TVA et RSPS automatiques, suivi des paiements en temps réel.",
  applicationName: "Billio",
  creator: "JBLESS CONSULTING",
  publisher: "JBLESS CONSULTING",
  keywords: [
    "facturation en ligne",
    "logiciel de facturation Togo",
    "gestion d'entreprise Afrique",
    "facture TVA OHADA",
    "Billio",
  ],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Billio",
    url: SITE_URL,
    title: "Billio - Gestion & Facturation",
    description:
      "La solution de facturation moderne pensée pour les entrepreneurs africains.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Billio - Gestion & Facturation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Billio - Gestion & Facturation",
    description:
      "La solution de facturation moderne pensée pour les entrepreneurs africains.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  // verification: {
  //   google: "VOTRE_CODE_DE_VERIFICATION",
  // },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e1b4b",
};

function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Billio",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
    parentOrganization: {
      "@type": "Organization",
      name: "JBLESS CONSULTING",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Lomé",
      addressCountry: "TG",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+228-97-42-82-98",
      contactType: "customer support",
      areaServed: ["TG", "CI", "SN"],
      availableLanguage: ["French"],
    },
    sameAs: ["https://jblessconsulting.com"],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <OrganizationJsonLd />
        {children}
      </body>
    </html>
  );
}