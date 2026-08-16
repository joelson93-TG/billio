import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DEFAULT_SYSTEM_PROMPT = `Tu es l'assistant virtuel de Billio, une plateforme de facturation en ligne pour entrepreneurs en Afrique de l'Ouest (Togo, Côte d'Ivoire, Sénégal).

CONTEXTE PRODUIT :
- Billio permet de créer des factures et proformas conformes aux normes OHADA
- TVA 18% et RSPS calculées automatiquement
- Suivi des paiements en temps réel
- Personnalisation avec logo, cachet et signature
- Essai gratuit de 30 jours, puis abonnement mensuel, semestriel ou annuel

RÈGLES DE COMPORTEMENT :
- Réponds toujours en français, de façon chaleureuse, concise et professionnelle (3-4 phrases maximum)
- Si tu ne sais pas répondre avec certitude, ou si la question concerne un remboursement, un bug technique précis, une réclamation, ou une négociation commerciale, réponds UNIQUEMENT par le texte : [ESCALATE]
- Ne donne jamais de prix exacts que tu n'es pas sûr à 100% — invite plutôt à consulter la page Tarifs
- Encourage l'utilisateur à consulter le Centre d'Aide pour les tutoriels vidéo si pertinent`;

const DEFAULT_ESCALATION_KEYWORDS = [
  "remboursement", "rembourser", "bug", "erreur système", "plainte",
  "urgent", "parler à un humain", "conseiller", "réclamation", "arnaque",
];

async function getAiConfig() {
  try {
    const snap = await getDoc(doc(db, "settings", "ai_assistant"));
    if (snap.exists()) {
      const data = snap.data();
      return {
        enabled: data.enabled ?? true,
        systemPrompt: data.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        escalationKeywords: data.escalationKeywords?.length
          ? data.escalationKeywords
          : DEFAULT_ESCALATION_KEYWORDS,
      };
    }
  } catch (err) {
    console.error("[AI] Erreur lecture config :", err);
  }
  return {
    enabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    escalationKeywords: DEFAULT_ESCALATION_KEYWORDS,
  };
}

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("[AI] GEMINI_API_KEY manquante");
      return NextResponse.json({ escalate: true, reply: null });
    }

    const { message, history } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    const config = await getAiConfig();

    if (!config.enabled) {
      return NextResponse.json({ escalate: true, reply: null });
    }

    // Détection rapide par mots-clés (économise des appels API inutiles)
    const lowerMsg = message.toLowerCase();
    const hasEscalationKeyword = config.escalationKeywords.some((k) =>
      lowerMsg.includes(String(k).toLowerCase())
    );
    if (hasEscalationKeyword) {
      return NextResponse.json({ escalate: true, reply: null });
    }

    // Historique limité aux 6 derniers messages, format Gemini (user/model)
    const recentHistory = (history || [])
      .slice(-6)
      .filter((m) => m.text && m.text.trim())
      .map((m) => ({
        role: m.isAdmin || m.isAI ? "model" : "user",
        parts: [{ text: m.text }],
      }));

    // Gemini exige que le premier message de l'historique soit "user"
    while (recentHistory.length > 0 && recentHistory[0].role !== "user") {
      recentHistory.shift();
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: config.systemPrompt,
    });

    const chat = model.startChat({
      history: recentHistory,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.4,
      },
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text().trim();

    if (!reply || reply.includes("[ESCALATE]")) {
      return NextResponse.json({ escalate: true, reply: null });
    }

    return NextResponse.json({ escalate: false, reply });
  } catch (error) {
    console.error("[AI] Erreur réponse IA :", error);
    // En cas d'erreur technique, on escalade vers un humain plutôt que de planter
    return NextResponse.json({ escalate: true, reply: null });
  }
}