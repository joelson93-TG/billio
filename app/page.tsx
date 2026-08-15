// app/page.tsx
import type { Metadata } from "next";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/firebase";
import LandingPageClient from "@/components/LandingPageClient";

// Revalidation ISR : régénère la page toutes les heures (évite de taper
// Firestore à chaque requête tout en gardant un contenu à jour).
export const revalidate = 3600;

const SITE_URL = "https://billio.jblessconsulting.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Billio — Logiciel de facturation en ligne pour entrepreneurs africains",
    template: "%s | Billio",
  },
  description:
    "Créez des factures professionnelles conformes OHADA en 2 minutes. TVA 18% et RSPS calculées automatiquement, suivi des paiements en temps réel. Pensé pour le Togo, la Côte d'Ivoire et le Sénégal.",
  keywords: [
    "facturation en ligne",
    "logiciel de facturation Togo",
    "facture TVA OHADA",
    "gestion facture Afrique",
    "facture professionnelle Lomé",
    "Billio",
  ],
  authors: [{ name: "JBLESS CONSULTING" }],
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "e19hUntJEDAMM2icULKOFXgxWN5uMVqVXX_dgTnozIU",
  },
  openGraph: {
    title: "Billio — Facturation moderne pour entrepreneurs africains",
    description:
      "Dites adieu à Word et Excel. Créez vos factures conformes OHADA en quelques secondes et suivez vos paiements en temps réel.",
    url: SITE_URL,
    siteName: "Billio",
    images: [
      {
        url: "/og-image.jpg", // à placer dans /public, 1200x630px
        width: 1200,
        height: 630,
        alt: "Aperçu du tableau de bord Billio",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Billio — Facturation moderne pour entrepreneurs africains",
    description: "Créez vos factures professionnelles en 2 minutes.",
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
};

interface PricingData {
  monthly: number;
  sixMonths: number;
  yearly: number;
}

interface TutorialData {
  embedUrl: string;
  title: string;
}

const DEFAULT_PRICING: PricingData = {
  monthly: 5000,
  sixMonths: 25000,
  yearly: 45000,
};

const DEFAULT_DASHBOARD_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDQjEYxYXGxCrnL5wSnV81SofvfkfpfBBW_FcW4-8qsxtTNCXxRt33u7iG8xPZ7yW6S19Z6o_1zDu03NP3emAQlaCvHswLvyMCxS3xlzcTKlqxJMIaufarHCGbJhPh4eYp0ZrgijBjBk-8IiJQKpDwcY9IM1RCcxJat6Fk-38_cMC1ZSDraMIswGbRBgJ9PAdkWspKbRx_CUhcCLZwmidsexf9pxOKhNlKMsChjRlb4gpE5riRW91rvSsquo8NgkQ06Sgw";

// Liste blanche de domaines autorisés pour l'iframe vidéo (sécurité)
const ALLOWED_EMBED_HOSTS = ["youtube.com", "youtube-nocookie.com", "player.vimeo.com"];

function isSafeEmbedUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === "https:" && ALLOWED_EMBED_HOSTS.some((h) => hostname.endsWith(h));
  } catch {
    return false;
  }
}

/**
 * Récupère les données publiques (pricing, tutoriel, captures) côté serveur.
 * Toute erreur retombe silencieusement sur des valeurs par défaut :
 * la page ne doit jamais planter à cause d'un souci Firestore.
 */
async function getInitialData() {
  let pricing: PricingData = DEFAULT_PRICING;
  let tutorial: TutorialData | null = null;
  let screenshots: string[] = [DEFAULT_DASHBOARD_IMAGE];

  try {
    const pricingSnap = await getDoc(doc(db, "config", "pricing"));
    if (pricingSnap.exists()) {
      const data = pricingSnap.data();
      pricing = {
        monthly: data.monthly ?? DEFAULT_PRICING.monthly,
        sixMonths: data.sixMonths ?? DEFAULT_PRICING.sixMonths,
        yearly: data.yearly ?? DEFAULT_PRICING.yearly,
      };
    }
  } catch (err) {
    console.error("[SSR] Erreur pricing:", err);
  }

  try {
    const tutorialsSnap = await getDocs(
      query(collection(db, "tutorials"), limit(1))
    );
    if (!tutorialsSnap.empty) {
      const data = tutorialsSnap.docs[0].data();
      const embedUrl = data.embedUrl ?? "";
      tutorial = {
        embedUrl: isSafeEmbedUrl(embedUrl) ? embedUrl : "",
        title: data.title ?? "Guide pratique Billio",
      };
    }
  } catch (err) {
    console.error("[SSR] Erreur tutorial:", err);
  }

  try {
    const screenshotsSnap = await getDocs(
      query(collection(db, "screenshots"), orderBy("order"), limit(10))
    );
    if (!screenshotsSnap.empty) {
      const imgs = screenshotsSnap.docs
        .map((d) => d.data().url as string)
        .filter((url) => typeof url === "string" && url.length > 0);
      if (imgs.length > 0) screenshots = imgs;
    }
  } catch (err) {
    console.error("[SSR] Erreur screenshots:", err);
  }

  return { pricing, tutorial, screenshots };
}

function JsonLd({ pricing }: { pricing: PricingData }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Billio",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "Solution de facturation en ligne pour entrepreneurs africains : factures professionnelles, TVA et RSPS automatiques, suivi des paiements.",
    offers: [
      {
        "@type": "Offer",
        name: "Gratuit",
        price: "0",
        priceCurrency: "XOF",
      },
      {
        "@type": "Offer",
        name: "Standard",
        price: String(pricing.monthly),
        priceCurrency: "XOF",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "4",
    },
    provider: {
      "@type": "Organization",
      name: "JBLESS CONSULTING",
      url: "https://jblessconsulting.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lomé",
        addressCountry: "TG",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function Page() {
  const { pricing, tutorial, screenshots } = await getInitialData();

  return (
    <>
      <JsonLd pricing={pricing} />
      <LandingPageClient
        initialPricing={pricing}
        initialTutorial={tutorial}
        initialScreenshots={screenshots}
      />
    </>
  );
}