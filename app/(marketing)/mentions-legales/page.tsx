// app/mentions-legales/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de Billio, solution de facturation en ligne éditée par JBLESS CONSULTING à Lomé, Togo.",
  alternates: {
    canonical: "/mentions-legales",
  },
};

export default function MentionsLegalesPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fb] py-16 px-6">
      <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-[#e0e3e5] shadow-sm p-7 md:p-12">
        <Link
          href="/"
          className="inline-flex mb-8 text-sm font-semibold text-[#4e45d5] hover:underline"
        >
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold text-[#070235] mb-10">
          Mentions légales
        </h1>

        <div className="space-y-7 text-[#47464f] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Éditeur du site
            </h2>
            <p>
              Billio est édité par le cabinet{" "}
              <strong>JBLESS CONSULTING</strong>, dirigé par Monsieur{" "}
              <strong>Joel GLOBO</strong>, Gestionnaire comptable, basé à
              Lomé, Togo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Directeur de la publication
            </h2>
            <p>Joel GLOBO.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Hébergement
            </h2>
            <p>
              L&apos;application et ses données sont hébergées sur des
              infrastructures cloud sécurisées, notamment Google Firebase et
              Vercel Inc.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Propriété intellectuelle
            </h2>
            <p>
              L&apos;ensemble des contenus présents sur Billio, notamment les
              textes, logos, interfaces, illustrations et code source, est la
              propriété de JBLESS CONSULTING, sauf indication contraire.
              Toute reproduction, même partielle, est interdite sans
              autorisation préalable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Données personnelles
            </h2>
            <p>
              Billio s&apos;engage à protéger les données personnelles de ses
              utilisateurs et de leurs clients. Les données ne sont ni vendues
              ni cédées à des tiers sans consentement ou obligation légale.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Responsabilité
            </h2>
            <p>
              Billio met tout en œuvre pour assurer l&apos;exactitude des
              informations diffusées sur son site. Toutefois, JBLESS
              CONSULTING ne saurait être tenu responsable des erreurs,
              omissions ou indisponibilités temporaires du service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Droit applicable
            </h2>
            <p>
              Les présentes mentions légales sont soumises au droit togolais.
              Tout litige relève de la compétence des juridictions de Lomé,
              Togo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#070235] mb-2">
              Contact
            </h2>
            <p>
              Email :{" "}
              <a
                className="text-[#4e45d5] hover:underline"
                href="mailto:contact@jblessconsulting.com"
              >
                contact@jblessconsulting.com
              </a>
              <br />
              Téléphone :{" "}
              <a className="text-[#4e45d5] hover:underline" href="tel:+22897428298">
                +228 97 42 82 98
              </a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}