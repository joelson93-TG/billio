"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  collection, getDocs, doc, getDoc, addDoc, setDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp, increment
} from "firebase/firestore";
import { db, auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FaWhatsapp, FaFacebookF, FaTiktok, FaGlobe, FaComments, FaTimes, FaPaperPlane, FaRobot } from "react-icons/fa";

// --- Helpers ---
const cleanYouTubeEmbedUrl = (url) => {
  if (!url) return "#";
  try {
    const baseUrl = url.split('?')[0];
    if (!baseUrl.includes("youtube.com/embed/")) return "#";
    return baseUrl;
  } catch { return "#"; }
};

// --- Composant Bulle de Chat séparé (rendu via Portal) ---
function ChatBubble() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const scrollRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMounted(true);

    // ⭐ Références mutables pour pouvoir couper les listeners à tout moment
    let unsubChat = () => {};
    let unsubDocListener = () => {};

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      // ⭐ On coupe TOUJOURS les anciens listeners avant d'en recréer / de partir
      unsubChat();
      unsubDocListener();

      setUser(currentUser);

      if (currentUser) {
        // Écoute des messages de la conversation
        const q = query(
          collection(db, "chats", currentUser.uid, "messages"),
          orderBy("timestamp", "asc")
        );
        unsubChat = onSnapshot(
          q,
          (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          },
          (error) => {
            console.warn("Listener messages arrêté :", error.message);
          }
        );

        // Écoute du document parent pour le compteur de messages non lus (réponses admin)
        unsubDocListener = onSnapshot(
          doc(db, "chats", currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setUnreadCount(docSnap.data().unreadByUser || 0);
            }
          },
          (error) => {
            console.warn("Listener chat doc arrêté :", error.message);
          }
        );
      } else {
        // Utilisateur déconnecté : on réinitialise l'état local
        setMessages([]);
        setUnreadCount(0);
      }
    });

    return () => {
      unsubAuth();
      unsubChat();
      unsubDocListener();
    };
  }, []);

  // Remet à zéro le compteur non-lu quand l'utilisateur ouvre le chat
  useEffect(() => {
    if (isChatOpen && user) {
      updateDoc(doc(db, "chats", user.uid), { unreadByUser: 0 }).catch(() => {});
    }
  }, [isChatOpen, user]);

  // 🤖 Déclenche la réponse de l'IA après un message utilisateur
  const triggerAiResponse = useCallback(async (userMessage) => {
    if (!user) return;
    setIsAiTyping(true);
    try {
      const chatDocSnap = await getDoc(doc(db, "chats", user.uid));
      const aiEnabled = chatDocSnap.exists() ? chatDocSnap.data().aiEnabled !== false : true;

      // Si un admin a repris la main manuellement sur cette conversation, l'IA reste silencieuse
      if (!aiEnabled) {
        setIsAiTyping(false);
        return;
      }

      const res = await fetch("/api/chat/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: messagesRef.current }),
      });
      const data = await res.json();

      if (data.escalate) {
        // Notifie l'admin en priorité + informe l'utilisateur poliment
        await setDoc(doc(db, "chats", user.uid), {
          needsHuman: true,
          unreadByAdmin: increment(1),
        }, { merge: true });

        await addDoc(collection(db, "chats", user.uid, "messages"), {
          text: "Je transmets votre question à un conseiller de notre équipe qui vous répondra sous peu. Merci de votre patience 🙏",
          senderId: "ai",
          isAdmin: false,
          isAI: true,
          timestamp: serverTimestamp(),
        });
      } else if (data.reply) {
        await addDoc(collection(db, "chats", user.uid, "messages"), {
          text: data.reply,
          senderId: "ai",
          isAdmin: false,
          isAI: true,
          timestamp: serverTimestamp(),
        });
        await setDoc(doc(db, "chats", user.uid), {
          lastMessage: data.reply,
          lastMessageAt: serverTimestamp(),
          lastSenderIsAdmin: false,
        }, { merge: true });
      }
    } catch (error) {
      console.error("Erreur réponse IA :", error);
    } finally {
      setIsAiTyping(false);
    }
  }, [user]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    const messageText = newMessage;
    setNewMessage("");
    try {
      // 1. Ajoute le message dans la sous-collection
      await addDoc(collection(db, "chats", user.uid, "messages"), {
        text: messageText,
        senderId: user.uid,
        isAdmin: false,
        isAI: false,
        timestamp: serverTimestamp(),
      });
      // 2. Crée/Met à jour le document parent pour que l'admin voie la conversation
      await setDoc(doc(db, "chats", user.uid), {
        userEmail: user.email,
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        lastSenderIsAdmin: false,
        unreadByUser: 0,
      }, { merge: true });

      // 3. 🤖 Déclenche la réponse automatique de l'IA
      triggerAiResponse(messageText);
    } catch (error) { console.error("Erreur envoi message :", error); }
  };

  if (!mounted) return null;

  // Injection directe dans le <body> pour éviter tout conflit de style avec le Layout
  return createPortal(
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999999 }} className="flex flex-col items-end">
      
      {isChatOpen && (
        <div className="mb-4 w-[calc(100vw-2rem)] sm:w-[380px] h-[500px] max-h-[75vh] bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
          <div className="bg-blue-600 p-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold">B</div>
              <div>
                <h3 className="font-bold text-sm">Support Billio</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <p className="text-[10px] text-blue-100">Assistant IA + Équipe en ligne</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setIsChatOpen(false)} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center py-10 px-6">
                <FaRobot className="w-8 h-8 text-blue-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">
                  Posez-nous vos questions ici ! Notre assistant IA vous répond instantanément, un conseiller humain prend le relais si nécessaire.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isAdmin || msg.isAI ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[85%]">
                  {msg.isAI && (
                    <div className="flex items-center gap-1 mb-1 ml-1">
                      <FaRobot className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Assistant IA</span>
                    </div>
                  )}
                  <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                    msg.isAdmin
                      ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      : msg.isAI
                      ? 'bg-indigo-50 text-slate-800 border border-indigo-100 rounded-bl-none'
                      : 'bg-blue-600 text-white rounded-br-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {isAiTyping && (
              <div className="flex justify-start">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
          <form onSubmit={sendMessage} className="p-3 bg-white border-t flex gap-2 shrink-0">
            <input 
              type="text" 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              placeholder="Votre message..." 
              className="flex-1 p-3 bg-slate-100 rounded-xl text-sm outline-none text-slate-900 border-none focus:ring-2 focus:ring-blue-500" 
            />
            <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all shrink-0">
              <FaPaperPlane className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="relative w-16 h-16 rounded-full shadow-[0_10px_30px_rgba(59,130,246,0.6)] flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 bg-blue-600 text-white cursor-pointer"
      >
        {isChatOpen ? <FaTimes className="w-6 h-6" /> : <FaComments className="w-7 h-7" />}
        
        {/* Badge de notification (nouvelle réponse admin) */}
        {!isChatOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-black rounded-full min-w-[22px] h-[22px] px-1 flex items-center justify-center border-2 border-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>,
    document.body
  );
}

// --- Composant Principal ---
export default function HelpCenterPage() {
  const [links, setLinks] = useState({ whatsapp: "", facebook: "", tiktok: "", website: "" });
  const [tutorials, setTutorials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedVideos, setLoadedVideos] = useState({});

  useEffect(() => {
    const fetchHelpData = async () => {
      try {
        const linksDoc = await getDoc(doc(db, "settings", "help_center_links"));
        if (linksDoc.exists()) setLinks(linksDoc.data());

        const tutorialsSnap = await getDocs(collection(db, "tutorials"));
        setTutorials(tutorialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.error(error); } 
      finally { setIsLoading(false); }
    };
    fetchHelpData();
  }, []);

  const formatWhatsAppLink = (num) => num?.startsWith("http") ? num : `https://wa.me/${num?.replace(/[^0-9]/g, "")}`;
  const formatLink = (l) => (l?.startsWith("http") ? l : `https://${l}`) || "#";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-10 pb-20">
        
        {/* 1. En-tête */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Centre d'aide & Tutoriels</h1>
          <p className="mt-2 text-base text-slate-600 max-w-2xl">
            Retrouvez ici toutes les ressources pour maîtriser Billio ou contactez notre support.
          </p>
        </div>

        {/* 2. Réseaux Sociaux avec VRAIES ICÔNES (react-icons) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {links.whatsapp && (
            <a href={formatWhatsAppLink(links.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-green-400 hover:shadow-md transition-all group shadow-sm">
              <div className="w-12 h-12 bg-[#25D366] text-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FaWhatsapp className="w-7 h-7" />
              </div>
              <div><h3 className="font-bold text-slate-900">WhatsApp</h3><p className="text-xs text-slate-500">Assistance directe</p></div>
            </a>
          )}
          {links.facebook && (
            <a href={formatLink(links.facebook)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group shadow-sm">
              <div className="w-12 h-12 bg-[#1877F2] text-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FaFacebookF className="w-6 h-6" />
              </div>
              <div><h3 className="font-bold text-slate-900">Facebook</h3><p className="text-xs text-slate-500">Actualités</p></div>
            </a>
          )}
          {links.tiktok && (
            <a href={formatLink(links.tiktok)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-500 hover:shadow-md transition-all group shadow-sm">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FaTiktok className="w-6 h-6" />
              </div>
              <div><h3 className="font-bold text-slate-900">TikTok</h3><p className="text-xs text-slate-500">Vidéos & Astuces</p></div>
            </a>
          )}
          {links.website && (
            <a href={formatLink(links.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group shadow-sm">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FaGlobe className="w-6 h-6" />
              </div>
              <div><h3 className="font-bold text-slate-900">Site Web</h3><p className="text-xs text-slate-500">Visitez-nous</p></div>
            </a>
          )}
        </div>

        {/* 3. Tutoriels */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <svg className="w-8 h-8 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
            <h2 className="text-2xl font-bold text-slate-900">Tutoriels Vidéos</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {tutorials.map((video) => (
              <div key={video.id} className="space-y-3">
                <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 relative">
                  {!loadedVideos[video.id] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>
                  )}
                  <iframe
                    src={cleanYouTubeEmbedUrl(video.embedUrl)}
                    title={video.title}
                    className={`w-full h-full transition-opacity duration-500 ${loadedVideos[video.id] ? 'opacity-100' : 'opacity-0'}`}
                    allowFullScreen loading="lazy"
                    onLoad={() => setLoadedVideos(p => ({ ...p, [video.id]: true }))}
                  ></iframe>
                </div>
                <h3 className="font-semibold text-slate-800 text-lg">{video.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* La bulle est appelée ici mais rendue en dehors via Portal */}
      <ChatBubble />
    </div>
  );
}