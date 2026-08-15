// app/securite/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sécurité des données",
  description:
    "Découvrez les mesures de sécurité mises en place par Billio pour protéger vos factures, clients et données professionnelles.",
  alternates: {
    canonical: "/securite",
  },
};

const securityPoints = [
  {
    title: "Chiffrement des communications",
    text: "Les communications entre votre navigateur et nos services utilisent le protocole HTTPS avec chiffrement SSL/TLS.",
  },
  {
    title: "Hébergement sécurisé",
    text: "Les données sont hébergées sur des infrastructures cloud reconnues, notamment Google Firebase, avec des mécanismes de sécurité et de disponibilité robustes.",
  },
  {
    title: "Contrôle des accès",
    text: "L'accès à votre espace dépend de votre authentification. Vous devez protéger votre mot de passe et ne pas le partager.",
  },
  {
    title: "Sauvegarde et disponibilité",
    text: "Des mécanismes de sauvegarde et de résilience sont mis en place afin de limiter les risques de perte de données.",
  },
  {
    title: "Amélioration continue",
    text: "Nous surveillons et mettons à jour régulièrement l'application afin de corriger les vulnérabilités et d'améliorer la sécurité du service.",
  },
];

export default function SecuritePage() {
  return (
    <main className="min-h-screen bg-[#f7f9fb] py-16 px-6">
      <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-[#e0e3e5] shadow-sm p-7 md:p-12">
        <Link
          href="/"
          className="inline-flex mb-8 text-sm font-semibold text-[#4e45d5] hover:underline"
        >
          ← Retour à l&apos;accueil
        </Link>

        <span className="inline-flex mb-4 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
          Sécurité
        </span>

        <h1 className="text-3xl md:text-4xl font-bold text-[#070235] mb-5">
          Sécurité de vos données
        </h1>

        <p className="text-[#47464f] leading-relaxed mb-10">
          Vos factures, informations clients et données professionnelles sont
          importantes. Billio met en œuvre des mesures techniques et
          organisationnelles pour les protéger.
        </p>

        <div className="space-y-5">
          {securityPoints.map((point, index) => (
            <section
              key={point.title}
              className="rounded-2xl border border-[#e0e3e5] bg-[#f7f9fb] p-6"
            >
              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e1b4b] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-bold text-[#070235] mb-2">
                    {point.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-[#47464f]">
                    {point.text}
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-[#1e1b4b] p-6 text-white">
          <h2 className="font-bold text-lg mb-2">Une question sur la sécurité ?</h2>
          <p className="text-white/80 text-sm">
            Écrivez-nous à{" "}
            <a
              className="font-semibold text-white underline"
              href="mailto:contact@jblessconsulting.com"
            >
              contact@jblessconsulting.com
            </a>
            .
          </p>
        </div>
      </article>
    </main>
  );
}