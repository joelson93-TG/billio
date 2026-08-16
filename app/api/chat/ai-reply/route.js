import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🔁 Modèles essayés dans l'ordre : si l'un renvoie 404, on passe au suivant
const MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash-001",
];

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

// Essaie chaque modèle jusqu'à ce que l'un réponde
async function generateWithFallback({ systemPrompt, history, message }) {
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const chat = model.startChat({
        history,
        generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
      });

      const result = await chat.sendMessage(message);
      const text = result.response.text().trim();

      console.log(`[AI] ✅ Modèle utilisé : ${modelName}`);
      return { text, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || "");
      // 404 / modèle non supporté → on tente le suivant
      if (msg.includes("404") || msg.includes("not found") || msg.includes("not supported")) {
        console.warn(`[AI] ⏭️ Modèle indisponible (${modelName}), essai suivant...`);
        continue;
      }
      // Autre erreur (quota, clé invalide, historique malformé) → inutile d'insister
      throw err;
    }
  }

  throw lastError || new Error("Aucun modèle Gemini disponible");
}

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("[AI] GEMINI_API_KEY manquante");
      return NextResponse.json({
        escalate: false,
        reply: "⚠️ Configuration manquante : GEMINI_API_KEY absente de .env.local",
      });
    }

    const { message, history } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    const config = await getAiConfig();

    if (!config.enabled) {
      return NextResponse.json({ escalate: true, reply: null });
    }

    // Filtre par mots-clés (évite un appel API inutile)
    const lowerMsg = message.toLowerCase();
    const hasEscalationKeyword = config.escalationKeywords.some((k) =>
      lowerMsg.includes(String(k).toLowerCase())
    );
    if (hasEscalationKeyword) {
      return NextResponse.json({ escalate: true, reply: null });
    }

    // 🛡️ Historique nettoyé : alternance stricte user ⇄ model, commence par user, finit par model
    const rawHistory = (history || [])
      .slice(-6)
      .filter((m) => m.text && m.text.trim())
      .map((m) => ({
        role: m.isAdmin || m.isAI ? "model" : "user",
        parts: [{ text: m.text }],
      }));

    const cleanHistory = [];
    for (const item of rawHistory) {
      if (cleanHistory.length === 0 && item.role !== "user") continue;
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === item.role) continue;
      cleanHistory.push(item);
    }
    if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === "user") {
      cleanHistory.pop();
    }

    const { text: reply } = await generateWithFallback({
      systemPrompt: config.systemPrompt,
      history: cleanHistory,
      message,
    });

    if (!reply || reply.includes("[ESCALATE]")) {
      return NextResponse.json({ escalate: true, reply: null });
    }

    return NextResponse.json({ escalate: false, reply });
  } catch (error) {
    console.error("[AI] Erreur Gemini :", error);
    // ⚙️ Mode debug : affiche l'erreur dans le chat.
    // Une fois que tout fonctionne, remplace ce bloc par :
    // return NextResponse.json({ escalate: true, reply: null });
    return NextResponse.json({
      escalate: false,
      reply: `⚠️ Erreur Gemini : ${error?.message || error}`,
    });
  }
}