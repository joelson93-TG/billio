// app/contact/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez l'équipe Billio par téléphone, WhatsApp ou email. Basé à Lomé, Togo.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fb] py-16 px-6">
      <section className="max-w-3xl mx-auto bg-white rounded-3xl border border-[#e0e3e5] shadow-sm p-7 md:p-12">
        <Link
          href="/"
          className="inline-flex mb-8 text-sm font-semibold text-[#4e45d5] hover:underline"
        >
          ← Retour à l&apos;accueil
        </Link>

        <span className="inline-flex mb-4 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
          Support Billio
        </span>

        <h1 className="text-3xl md:text-4xl font-bold text-[#070235] mb-4">
          Contactez-nous
        </h1>

        <p className="text-[#47464f] leading-relaxed mb-10">
          Une question sur Billio, votre facturation ou votre abonnement ?
          Notre équipe est disponible pour vous accompagner.
        </p>

        <div className="grid gap-4">
          <a
            href="tel:+22897428298"
            className="group flex items-center gap-5 rounded-2xl border border-[#e0e3e5] bg-[#f7f9fb] p-5 transition hover:border-[#4e45d5] hover:bg-indigo-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4e45d5]/10 text-xl">
              ☎
            </span>
            <span>
              <span className="block text-sm text-[#47464f]">Téléphone</span>
              <span className="block font-bold text-[#070235]">
                +228 97 42 82 98
              </span>
            </span>
          </a>

          <a
            href="https://wa.me/22897428298"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-5 rounded-2xl border border-[#e0e3e5] bg-[#f7f9fb] p-5 transition hover:border-[#25D366] hover:bg-green-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366]/10 text-xl">
              ◉
            </span>
            <span>
              <span className="block text-sm text-[#47464f]">WhatsApp</span>
              <span className="block font-bold text-[#070235]">
                Écrivez-nous sur WhatsApp
              </span>
            </span>
          </a>

          <a
            href="mailto:contact@jblessconsulting.com"
            className="group flex items-center gap-5 rounded-2xl border border-[#e0e3e5] bg-[#f7f9fb] p-5 transition hover:border-[#4e45d5] hover:bg-indigo-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4e45d5]/10 text-xl">
              ✉
            </span>
            <span>
              <span className="block text-sm text-[#47464f]">Email</span>
              <span className="block font-bold text-[#070235]">
                contact@jblessconsulting.com
              </span>
            </span>
          </a>

          <a
            href="https://jblessconsulting.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-5 rounded-2xl border border-[#e0e3e5] bg-[#f7f9fb] p-5 transition hover:border-[#4e45d5] hover:bg-indigo-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4e45d5]/10 text-xl">
              ◌
            </span>
            <span>
              <span className="block text-sm text-[#47464f]">Site web</span>
              <span className="block font-bold text-[#070235]">
                jblessconsulting.com
              </span>
            </span>
          </a>
        </div>

        <p className="mt-10 text-sm text-[#47464f]">
          JBLESS CONSULTING — Lomé, Togo.
        </p>
      </section>
    </main>
  );
}