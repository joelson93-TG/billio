"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp, increment
} from "firebase/firestore";
import { auth, db } from "@/firebase";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from "recharts";

// --- Icônes SVG ---
const IconOverview = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const IconUsers = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const IconPricing = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const IconHelp = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconChat = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
const IconSend = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const IconClose = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

const formatChatTime = (timestamp) => {
  if (!timestamp?.toDate) return "...";
  return timestamp.toDate().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

// Calcule les jours restants depuis la date de fin (trialEndDate / endDate)
const computeDaysLeft = (userData) => {
  const sub = userData.subscription || {};
  const endDateStr = userData.trialEndDate || userData.endDate;
  if (endDateStr) {
    return Math.ceil((new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  if (sub.expiresAt) {
    const d = sub.expiresAt.toDate ? sub.expiresAt.toDate() : new Date(sub.expiresAt);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
  return typeof sub.daysLeft === "number" ? sub.daysLeft : 30;
};

// 🆕 Résout le plan de l'utilisateur en cherchant dans plusieurs emplacements possibles.
// Si aucun plan explicite n'est trouvé mais que l'abonnement est actif,
// on retombe sur "1month" par défaut au lieu de "Essai" (sinon le graphique
// "Popularité des Formules" ne comptabilise jamais ces abonnés actifs).
const resolvePlan = (userData, sub, computedStatus) => {
  const plan =
    sub.plan ||
    userData.plan ||
    userData.subscriptionPlan ||
    (sub.type ?? null);

  if (plan) return plan;

  return computedStatus === "active" ? "1month" : "Essai";
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [isSavingHelp, setIsSavingHelp] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Rappels WhatsApp (AfriMsg)
  const [sendingReminderTo, setSendingReminderTo] = useState(null);
  const [isSendingBulkReminder, setIsSendingBulkReminder] = useState(false);

  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, trialUsers: 0, expiredUsers: 0, totalRevenue: 0,
  });

  const [usersList, setUsersList] = useState([]);
  const [pricing, setPricing] = useState({ monthly: 12000, sixMonths: 60000, yearly: 100000 });

  const [helpLinks, setHelpLinks] = useState({ whatsapp: "", facebook: "", tiktok: "", website: "" });
  const [tutorials, setTutorials] = useState([]);
  const [newTutorial, setNewTutorial] = useState({ title: "", embedUrl: "" });
  const [editingTutorial, setEditingTutorial] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      if (user.email !== "admin@jblessconsulting.com") { router.push("/"); return; }
      setIsAdminVerified(true);
      await loadAdminData();
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!isAdminVerified) return;
    const q = query(collection(db, "chats"), orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setConversations(convs);
      const total = convs.reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0);
      setTotalUnreadMessages(total);
    });
    return () => unsub();
  }, [isAdminVerified]);

  useEffect(() => {
    if (!selectedChatId) { setChatMessages([]); return; }
    const q = query(collection(db, "chats", selectedChatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    updateDoc(doc(db, "chats", selectedChatId), { unreadByAdmin: 0 }).catch(() => {});
    return () => unsub();
  }, [selectedChatId]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChatId) return;
    setIsSendingReply(true);
    try {
      await addDoc(collection(db, "chats", selectedChatId, "messages"), {
        text: replyText,
        senderId: "admin",
        isAdmin: true,
        timestamp: serverTimestamp(),
      });
      await setDoc(doc(db, "chats", selectedChatId), {
        lastMessage: replyText,
        lastMessageAt: serverTimestamp(),
        lastSenderIsAdmin: true,
        unreadByUser: increment(1),
      }, { merge: true });
      setReplyText("");
    } catch (error) {
      console.error("Erreur envoi réponse :", error);
    } finally {
      setIsSendingReply(false);
    }
  };

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      
      const pricingRef = doc(db, "config", "pricing");
      const pricingSnap = await getDoc(pricingRef);
      let currentPricing = { ...pricing };
      
      if (pricingSnap.exists()) {
        currentPricing = { ...pricing, ...pricingSnap.data() };
        setPricing(currentPricing);
      }

      const usersSnap = await getDocs(collection(db, "users"));
      let total = 0, active = 0, trial = 0, expired = 0, revenue = 0;
      const loadedUsers = [];

      for (const userDoc of usersSnap.docs) {
        total++;
        const userData = userDoc.data();
        const sub = userData.subscription || {};
        const companySnap = await getDoc(doc(db, "users", userDoc.id, "settings", "company"));
        const companyData = companySnap.exists() ? companySnap.data() : {};

        const daysLeft = computeDaysLeft(userData);
        let computedStatus = userData.subscriptionStatus || sub.status || "trial";
        if (computedStatus !== "expired" && daysLeft <= 0) {
          computedStatus = "expired";
        }

        if (computedStatus === "active") active++;
        else if (computedStatus === "trial") trial++;
        else expired++;

        // 🆕 CA : priorité au montant réellement payé (cumulé via increment)
        if (typeof userData.totalPaid === "number" && userData.totalPaid > 0) {
          revenue += userData.totalPaid;
        } else if (typeof userData.lastPaymentAmount === "number" && userData.lastPaymentAmount > 0) {
          // Compatibilité avec anciens paiements enregistrés avant le correctif
          revenue += userData.lastPaymentAmount;
        } else if (computedStatus === "active") {
          // Dernier recours : estimation si aucun montant n'a été enregistré
          if (sub.plan === "1year") revenue += Number(currentPricing.yearly);
          else if (sub.plan === "6months") revenue += Number(currentPricing.sixMonths);
          else revenue += Number(currentPricing.monthly);
        }

        // 🆕 Détection robuste du plan (fixe le bug du graphique "Popularité des Formules")
        const resolvedPlan = resolvePlan(userData, sub, computedStatus);

        loadedUsers.push({
          uid: userDoc.id,
          email: userData.email || companyData.email || "Non renseigné",
          phone: companyData.phone || userData.phone || "",
          companyName: companyData.companyName || userData.businessName || "Entreprise non configurée",
          status: computedStatus,
          plan: resolvedPlan,
          daysLeft: daysLeft,
          totalPaid: userData.totalPaid || userData.lastPaymentAmount || 0,
        });
      }

      setStats({ totalUsers: total, activeUsers: active, trialUsers: trial, expiredUsers: expired, totalRevenue: revenue });
      setUsersList(loadedUsers);

      await loadHelpCenterData();

    } catch (error) {
      console.error("Erreur chargement admin :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHelpCenterData = async () => {
    try {
      const linksDoc = await getDoc(doc(db, "settings", "help_center_links"));
      if (linksDoc.exists()) setHelpLinks(linksDoc.data());

      const tutorialsSnap = await getDocs(collection(db, "tutorials"));
      setTutorials(tutorialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Erreur chargement centre d'aide :", error);
    }
  };

  const formatUrl = (url) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://${trimmed}`;
  };

  const handleSaveHelpLinks = async (e) => {
    e.preventDefault();
    setIsSavingHelp(true);
    try {
      await setDoc(doc(db, "settings", "help_center_links"), {
        whatsapp: helpLinks.whatsapp,
        facebook: formatUrl(helpLinks.facebook),
        tiktok: formatUrl(helpLinks.tiktok),
        website: formatUrl(helpLinks.website),
        updatedAt: new Date().toISOString(),
      });
      alert("Liens du centre d'aide mis à jour !");
      await loadHelpCenterData();
    } catch (error) {
      console.error("Erreur sauvegarde liens :", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setIsSavingHelp(false);
    }
  };

  const handleAddTutorial = async (e) => {
    e.preventDefault();
    if (!newTutorial.title || !newTutorial.embedUrl) {
      alert("Veuillez remplir tous les champs");
      return;
    }
    try {
      await addDoc(collection(db, "tutorials"), {
        title: newTutorial.title,
        embedUrl: newTutorial.embedUrl,
        createdAt: new Date().toISOString(),
      });
      setNewTutorial({ title: "", embedUrl: "" });
      await loadHelpCenterData();
      alert("Tutoriel ajouté avec succès !");
    } catch (error) {
      console.error("Erreur ajout tutoriel :", error);
      alert("Erreur lors de l'ajout");
    }
  };

  const handleDeleteTutorial = async (tutorialId) => {
    if (!confirm("Supprimer ce tutoriel ?")) return;
    try {
      await deleteDoc(doc(db, "tutorials", tutorialId));
      await loadHelpCenterData();
      alert("Tutoriel supprimé !");
    } catch (error) {
      console.error("Erreur suppression tutoriel :", error);
      alert("Erreur lors de la suppression");
    }
  };

  const handleUpdateTutorial = async (e) => {
    e.preventDefault();
    if (!editingTutorial) return;
    try {
      await updateDoc(doc(db, "tutorials", editingTutorial.id), {
        title: editingTutorial.title,
        embedUrl: editingTutorial.embedUrl,
        updatedAt: new Date().toISOString(),
      });
      setEditingTutorial(null);
      await loadHelpCenterData();
      alert("Tutoriel modifié !");
    } catch (error) {
      console.error("Erreur modification tutoriel :", error);
      alert("Erreur lors de la modification");
    }
  };

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setIsSavingPricing(true);
    try {
      const pricingRef = doc(db, "config", "pricing");
      await setDoc(pricingRef, {
        monthly: Number(pricing.monthly),
        sixMonths: Number(pricing.sixMonths),
        yearly: Number(pricing.yearly),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      alert("Grille tarifaire mise à jour avec succès !");
      await loadAdminData();
    } catch (error) {
      console.error("Erreur tarifs :", error);
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // ── Rappels WhatsApp via AfriMsg ──
  const buildReminderMessage = (user) => {
    if (user.status === "expired" || user.daysLeft <= 0) {
      return `Bonjour ${user.companyName} 👋,\n\nVotre abonnement JBLESS a expiré. Renouvelez dès maintenant pour retrouver l'accès complet à votre logiciel de facturation.\n\n💳 Contactez-nous pour renouveler votre licence.`;
    }
    return `Bonjour ${user.companyName} 👋,\n\nVotre abonnement JBLESS expire dans ${user.daysLeft} jour(s). Pensez à renouveler pour éviter toute interruption de service.\n\n💳 Contactez-nous dès maintenant.`;
  };

  const isReminderTarget = (u) => !!u.phone && (u.status === "expired" || u.daysLeft <= 3);

  const handleSendReminder = async (user) => {
    if (!user.phone) {
      alert("Aucun numéro de téléphone pour ce client");
      return;
    }
    setSendingReminderTo(user.uid);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: user.phone, message: buildReminderMessage(user) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`✅ Rappel envoyé à ${user.companyName}`);
    } catch (error) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setSendingReminderTo(null);
    }
  };

  const handleBulkReminder = async () => {
    const targets = usersList.filter(isReminderTarget);

    if (targets.length === 0) {
      alert("Aucun client à rappeler (expiré ou ≤ 3 jours) avec un numéro renseigné.");
      return;
    }
    if (targets.length === 1) {
      await handleSendReminder(targets[0]);
      return;
    }
    if (!confirm(`Envoyer un rappel WhatsApp à ${targets.length} client(s) ?`)) return;

    setIsSendingBulkReminder(true);
    try {
      const messages = targets.map((u) => ({ to: u.phone, message: buildReminderMessage(u) }));
      const res = await fetch("/api/whatsapp/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, delayMin: 3, delayMax: 8 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`✅ Envoi groupé lancé pour ${targets.length} client(s).`);
    } catch (error) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setIsSendingBulkReminder(false);
    }
  };

  const filteredUsers = usersList.filter((user) => {
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    const matchesSearch = user.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusChartData = [
    { name: "Actifs", value: stats.activeUsers, color: "#10B981" },
    { name: "En Essai", value: stats.trialUsers, color: "#F59E0B" },
    { name: "Expirés", value: stats.expiredUsers, color: "#EF4444" },
  ];

  const planChartData = [
    { name: "Mensuel", count: usersList.filter(u => u.plan === "1month").length },
    { name: "Semestriel", count: usersList.filter(u => u.plan === "6months").length },
    { name: "Annuel", count: usersList.filter(u => u.plan === "1year").length },
    { name: "Essai", count: usersList.filter(u => u.plan === "Essai" || !u.plan).length },
  ];

  const getClientInfo = (chatId) => usersList.find(u => u.uid === chatId) || null;

  const selectedConversation = conversations.find(c => c.id === selectedChatId);
  const selectedClientInfo = selectedChatId ? getClientInfo(selectedChatId) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1120] text-white">
        <div className="relative flex justify-center items-center">
            <div className="absolute animate-ping w-12 h-12 rounded-full bg-blue-500/50"></div>
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  const navItems = [
    { key: "overview", label: "Vue d'ensemble", icon: <IconOverview /> },
    { key: "users", label: "Répertoire Clients", icon: <IconUsers /> },
    { key: "pricing", label: "Grille Tarifaire", icon: <IconPricing /> },
    { key: "help", label: "Centre d'aide", icon: <IconHelp /> },
    { key: "messages", label: "Messagerie", icon: <IconChat />, badge: totalUnreadMessages },
  ];

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex font-sans selection:bg-blue-500/30">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="w-72 bg-[#0F172A] border-r border-slate-800 flex-col justify-between hidden md:flex shadow-2xl z-20">
        <div>
          <div className="h-20 px-8 flex items-center gap-4 border-b border-slate-800 bg-slate-900/50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/30 ring-2 ring-slate-900">JB</div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">JBLESS ADMIN</h2>
              <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Console SaaS</span>
            </div>
          </div>

          <nav className="p-5 space-y-2 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === item.key ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}
              >
                {item.icon}
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-900/30">
          <div className="px-4 py-3 bg-slate-950/50 rounded-xl border border-slate-800 shadow-inner">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Session Active</p>
            <p className="text-xs font-bold text-slate-200 truncate mt-1">admin@jblessconsulting.com</p>
          </div>
          <div className="flex gap-3">
            {/* 🆕 Correction : redirige vers le dashboard client, pas la landing page */}
            <button onClick={() => router.push("/dashboard")} className="flex-1 py-2.5 text-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 border border-slate-700 hover:border-slate-600">App Client</button>
            <button onClick={handleLogout} className="py-2.5 px-4 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/10">Sortir</button>
          </div>
        </div>
      </aside>

      {/* DRAWER MOBILE */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="absolute left-0 top-0 h-full w-[80%] max-w-xs bg-[#0F172A] border-r border-slate-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-300">
            <div>
              <div className="h-20 px-6 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/30 ring-2 ring-slate-900">JB</div>
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight text-white">JBLESS ADMIN</h2>
                    <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Console SaaS</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg transition-colors"><IconClose /></button>
              </div>

              <nav className="p-5 space-y-2 text-sm font-medium">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleSelectTab(item.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === item.key ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}
                  >
                    {item.icon}
                    {item.label}
                    {item.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">{item.badge}</span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-900/30">
              <div className="px-4 py-3 bg-slate-950/50 rounded-xl border border-slate-800 shadow-inner">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Session Active</p>
                <p className="text-xs font-bold text-slate-200 truncate mt-1">admin@jblessconsulting.com</p>
              </div>
              <div className="flex gap-3">
                {/* 🆕 Correction : redirige vers le dashboard client, pas la landing page */}
                <button onClick={() => router.push("/dashboard")} className="flex-1 py-2.5 text-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 border border-slate-700 hover:border-slate-600">App Client</button>
                <button onClick={handleLogout} className="py-2.5 px-4 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/10">Sortir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto relative w-full min-w-0">
        
        <header className="h-20 border-b border-slate-800 px-4 md:px-10 flex items-center justify-between bg-[#0B1120]/80 backdrop-blur-md sticky top-0 z-10 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white bg-slate-800/50 rounded-lg transition-colors relative shrink-0">
              <IconMenu />
              {totalUnreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{totalUnreadMessages}</span>
              )}
            </button>

            <h1 className="text-sm md:text-lg font-extrabold text-white uppercase tracking-wider flex items-center gap-2 md:gap-3 truncate">
              {activeTab === "overview" && <><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] shrink-0"></span> <span className="truncate">Tableau de bord</span></>}
              {activeTab === "users" && <><span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] shrink-0"></span> <span className="truncate">Répertoire Clients</span></>}
              {activeTab === "pricing" && <><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] shrink-0"></span> <span className="truncate">Grille Tarifaire</span></>}
              {activeTab === "help" && <><span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] shrink-0"></span> <span className="truncate">Centre d'aide</span></>}
              {activeTab === "messages" && <><span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)] shrink-0"></span> <span className="truncate">Messagerie</span></>}
            </h1>
          </div>
        </header>

        <div className="p-4 md:p-10 space-y-8 md:space-y-10 max-w-7xl w-full mx-auto pb-20">
          
          {/* TAB : OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-br from-blue-900 to-[#0F172A] border border-blue-800/50 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-500"></div>
                  <div className="relative z-10 min-w-0">
                    <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">Chiffre d'Affaires Généré</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{stats.totalRevenue.toLocaleString()}</h3>
                        <span className="text-lg sm:text-xl font-bold text-blue-400 shrink-0">FCFA</span>
                    </div>
                  </div>
                </div>
                <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between group hover:border-emerald-500/30 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between gap-2">
                        <span className="truncate">Abonnés Actifs</span>
                        <span className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0"><IconUsers /></span>
                    </p>
                    <h3 className="text-4xl font-black text-white mt-2">{stats.activeUsers}</h3>
                  </div>
                  <div className="mt-4 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Souscriptions valides
                  </div>
                </div>
                <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between gap-2">
                        <span className="truncate">En Période d'Essai</span>
                        <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 shrink-0"><IconOverview /></span>
                    </p>
                    <h3 className="text-4xl font-black text-white mt-2">{stats.trialUsers}</h3>
                  </div>
                  <div className="mt-4 text-xs font-semibold text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Conversions potentielles
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Répartition par Statut</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Vue globale des comptes actifs, en essai et expirés</p>
                  </div>
                  <div className="h-72 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#090D16", borderColor: "#1E293B", borderRadius: "12px", color: "#fff", fontSize: "12px", fontWeight: "bold" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs font-bold text-slate-300 mt-2">
                    <div className="flex items-center gap-2 whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Actifs ({stats.activeUsers})</div>
                    <div className="flex items-center gap-2 whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Essais ({stats.trialUsers})</div>
                    <div className="flex items-center gap-2 whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-red-500"></span> Expirés ({stats.expiredUsers})</div>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Popularité des Formules</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Nombre d'utilisateurs par type d'abonnement</p>
                  </div>
                  <div className="h-72 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#090D16", borderColor: "#1E293B", borderRadius: "12px", color: "#fff", fontSize: "12px", fontWeight: "bold" }} cursor={{ fill: "rgba(59, 130, 246, 0.05)" }} />
                        <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB : USERS */}
          {activeTab === "users" && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-4 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-extrabold text-base text-white uppercase tracking-wider flex items-center gap-2">
                      <IconUsers /> Base de données Clients
                  </h3>
                  <button
                    onClick={handleBulkReminder}
                    disabled={isSendingBulkReminder}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl transition-all border border-emerald-500/20 disabled:opacity-50"
                    title="Envoyer un rappel WhatsApp à tous les clients expirés ou à ≤ 3 jours"
                  >
                    {isSendingBulkReminder ? (
                      <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
                    ) : (
                      <IconChat />
                    )}
                    Rappeler les clients expirants
                  </button>
                </div>
                <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                    type="text"
                    placeholder="Chercher une entreprise..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl outline-none text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full sm:w-64 shadow-inner"
                    />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-widest bg-slate-900/50">
                      <th className="py-4 px-4 rounded-tl-xl whitespace-nowrap">Entreprise & Contact</th>
                      <th className="py-4 px-4 whitespace-nowrap">Plan Actuel</th>
                      <th className="py-4 px-4 whitespace-nowrap">Statut</th>
                      <th className="py-4 px-4 text-right rounded-tr-xl whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white font-bold text-sm border border-slate-600 shadow-sm shrink-0">
                                {u.companyName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors whitespace-nowrap">{u.companyName}</div>
                                <div className="text-slate-400 text-xs mt-0.5 whitespace-nowrap">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-300 text-xs capitalize whitespace-nowrap">
                            {u.plan === "1year" ? "Annuel" : u.plan === "6months" ? "Semestriel" : u.plan === "1month" ? "Mensuel" : "Essai (Gratuit)"}
                            {u.totalPaid > 0 && (
                              <span className="block text-[10px] text-emerald-400 font-bold mt-0.5">
                                {u.totalPaid.toLocaleString()} FCFA payés
                              </span>
                            )}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center w-max gap-1.5
                            ${u.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                              u.status === "trial" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : 
                              "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : u.status === 'trial' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                            {u.status === "active" ? `Actif (${u.daysLeft}j)` : u.status === "trial" ? `Essai (${u.daysLeft}j)` : "Expiré"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center gap-2 justify-end">
                            {isReminderTarget(u) && (
                              <button
                                onClick={() => handleSendReminder(u)}
                                disabled={sendingReminderTo === u.uid}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-xs rounded-xl transition-all border border-blue-500/20 disabled:opacity-50"
                                title="Envoyer un rappel de renouvellement par WhatsApp"
                              >
                                {sendingReminderTo === u.uid ? (
                                  <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                                ) : (
                                  <IconChat />
                                )}
                                Rappel
                              </button>
                            )}
                            {u.phone ? (
                              <a href={`https://wa.me/${u.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-xs rounded-xl transition-all border border-[#25D366]/20 hover:scale-105">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                                Contacter
                              </a>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Aucun numéro</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                        <tr>
                            <td colSpan="4" className="py-12 text-center text-slate-500 text-sm">
                                Aucune entreprise trouvée avec cette recherche.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB : PRICING */}
          {activeTab === "pricing" && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 max-w-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h3 className="font-extrabold text-lg text-white uppercase tracking-wider flex items-center gap-2">
                    <IconPricing /> Grille Tarifaire Officielle
                </h3>
                <p className="text-slate-400 text-sm mt-2">Mettez à jour les prix qui seront affichés aux clients lors du renouvellement de leur licence logicielle.</p>
              </div>
              <form onSubmit={handleSavePricing} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">Tarif 1 Mois (FCFA)</label>
                    <div className="relative">
                        <input type="number" value={pricing.monthly} onChange={(e) => setPricing({ ...pricing, monthly: e.target.value })} className="w-full p-4 pl-6 pr-16 text-lg bg-slate-900/50 border border-slate-700 rounded-2xl text-white font-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" required />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">XOF</span>
                    </div>
                    </div>
                    <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">Tarif 6 Mois (FCFA)</label>
                    <div className="relative">
                        <input type="number" value={pricing.sixMonths} onChange={(e) => setPricing({ ...pricing, sixMonths: e.target.value })} className="w-full p-4 pl-6 pr-16 text-lg bg-slate-900/50 border border-slate-700 rounded-2xl text-white font-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" required />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">XOF</span>
                    </div>
                    </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">Tarif 1 An (FCFA) <span className="text-emerald-400 ml-2">Recommandé</span></label>
                  <div className="relative">
                    <input type="number" value={pricing.yearly} onChange={(e) => setPricing({ ...pricing, yearly: e.target.value })} className="w-full p-4 pl-6 pr-16 text-2xl bg-slate-900 border-2 border-blue-500/30 rounded-2xl text-white font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg" required />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 font-black text-sm">XOF / AN</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                    <button type="submit" disabled={isSavingPricing} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSavingPricing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sauvegarde...</>
                    ) : (
                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Enregistrer les nouveaux tarifs</>
                    )}
                    </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB : CENTRE D'AIDE */}
          {activeTab === "help" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 shadow-2xl">
                <div className="mb-6">
                  <h3 className="font-extrabold text-lg text-white uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Liens Réseaux Sociaux & Contact
                  </h3>
                  <p className="text-slate-400 text-sm mt-2">Ces liens seront affichés dans le centre d'aide accessible par les utilisateurs. Le protocole https:// sera ajouté automatiquement si nécessaire.</p>
                </div>
                <form onSubmit={handleSaveHelpLinks} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                        WhatsApp <span className="text-slate-500 font-normal text-[10px]">(optionnel)</span>
                      </label>
                      <input type="text" value={helpLinks.whatsapp} onChange={(e) => setHelpLinks({...helpLinks, whatsapp: e.target.value})} placeholder="+33612345678 ou https://wa.me/33612345678" className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                        Facebook <span className="text-slate-500 font-normal text-[10px]">(optionnel)</span>
                      </label>
                      <input type="text" value={helpLinks.facebook} onChange={(e) => setHelpLinks({...helpLinks, facebook: e.target.value})} placeholder="facebook.com/billio ou https://facebook.com/billio" className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.61-5.46-.04-.54-.04-1.07.01-1.61.27-2.14 1.6-4.07 3.51-5.14 1.47-.84 3.23-1.12 4.91-.84.02.01.02.02.02.02v4.06c-1.08-.22-2.22-.16-3.23.28-1.12.48-1.99 1.45-2.24 2.65-.25 1.19.16 2.45 1.05 3.32 1.17 1.11 3.03 1.25 4.35.34.8-.57 1.29-1.47 1.34-2.43.07-3.92.03-7.85.03-11.78l-.01-6.31z"/></svg>
                        TikTok <span className="text-slate-500 font-normal text-[10px]">(optionnel)</span>
                      </label>
                      <input type="text" value={helpLinks.tiktok} onChange={(e) => setHelpLinks({...helpLinks, tiktok: e.target.value})} placeholder="tiktok.com/@billio ou https://tiktok.com/@billio" className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                        Site Web <span className="text-slate-500 font-normal text-[10px]">(optionnel)</span>
                      </label>
                      <input type="text" value={helpLinks.website} onChange={(e) => setHelpLinks({...helpLinks, website: e.target.value})} placeholder="www.billio.com ou https://billio.com" className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800">
                    <button type="submit" disabled={isSavingHelp} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSavingHelp ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sauvegarde...</>
                      ) : (
                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Enregistrer les liens</>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 shadow-2xl">
                <div className="mb-6">
                  <h3 className="font-extrabold text-lg text-white uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                    Tutoriels Vidéo YouTube
                  </h3>
                  <p className="text-slate-400 text-sm mt-2">Ajoutez des vidéos YouTube en utilisant le format d'intégration (embed).</p>
                </div>
                <form onSubmit={handleAddTutorial} className="space-y-4 mb-8 p-4 md:p-6 bg-slate-900/30 rounded-2xl border border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Titre du tutoriel</label>
                      <input type="text" value={newTutorial.title} onChange={(e) => setNewTutorial({...newTutorial, title: e.target.value})} placeholder="Ex: Comment créer une facture" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" required />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">URL d'intégration (embed)</label>
                      <input type="text" value={newTutorial.embedUrl} onChange={(e) => setNewTutorial({...newTutorial, embedUrl: e.target.value})} placeholder="https://www.youtube.com/embed/VIDEO_ID" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-600/30 transition-all flex justify-center items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Ajouter le tutoriel
                  </button>
                </form>
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">Tutoriels existants ({tutorials.length})</h4>
                  {tutorials.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 italic">Aucun tutoriel ajouté pour le moment</div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {tutorials.map((tutorial) => (
                        <div key={tutorial.id} className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5 space-y-4 group hover:border-slate-600 transition-all">
                          {editingTutorial?.id === tutorial.id ? (
                            <form onSubmit={handleUpdateTutorial} className="space-y-3">
                              <input type="text" value={editingTutorial.title} onChange={(e) => setEditingTutorial({...editingTutorial, title: e.target.value})} className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-blue-500" required />
                              <input type="text" value={editingTutorial.embedUrl} onChange={(e) => setEditingTutorial({...editingTutorial, embedUrl: e.target.value})} className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-blue-500" required />
                              <div className="flex gap-2">
                                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">Enregistrer</button>
                                <button type="button" onClick={() => setEditingTutorial(null)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg">Annuler</button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden">
                                <iframe src={tutorial.embedUrl} title={tutorial.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                              </div>
                              <div className="space-y-3">
                                <h5 className="font-bold text-white text-sm">{tutorial.title}</h5>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingTutorial(tutorial)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Modifier
                                  </button>
                                  <button onClick={() => handleDeleteTutorial(tutorial.id)} className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 border border-red-500/20">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB : MESSAGERIE */}
          {activeTab === "messages" && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-220px)] min-h-[500px]">
                
                <div className={`border-r border-slate-800 flex-col bg-slate-950/30 ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                  <div className="p-5 border-b border-slate-800">
                    <h3 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <IconChat /> Conversations ({conversations.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                      <div className="text-center py-12 px-4 text-slate-500 text-sm italic">
                        Aucun message reçu pour le moment.
                      </div>
                    ) : (
                      conversations.map((conv) => {
                        const clientInfo = getClientInfo(conv.id);
                        const displayName = clientInfo?.companyName || conv.userEmail || "Client inconnu";
                        const isSelected = selectedChatId === conv.id;
                        return (
                          <button
                            key={conv.id}
                            onClick={() => setSelectedChatId(conv.id)}
                            className={`w-full text-left p-4 border-b border-slate-800/50 transition-colors flex items-start gap-3 ${isSelected ? "bg-blue-600/10 border-l-4 border-l-blue-500" : "hover:bg-slate-800/40 border-l-4 border-l-transparent"}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-white text-sm truncate">{displayName}</p>
                                <span className="text-[10px] text-slate-500 shrink-0">{formatChatTime(conv.lastMessageAt)}</span>
                              </div>
                              <p className="text-xs text-slate-400 truncate mt-0.5">
                                {conv.lastSenderIsAdmin && <span className="text-blue-400">Vous : </span>}
                                {conv.lastMessage}
                              </p>
                            </div>
                            {conv.unreadByAdmin > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0">
                                {conv.unreadByAdmin}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={`flex-col bg-slate-900/20 ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
                  {selectedChatId ? (
                    <>
                      <div className="p-4 md:p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50">
                        <button onClick={() => setSelectedChatId(null)} className="md:hidden p-1 text-slate-400 hover:text-white shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(selectedClientInfo?.companyName || selectedConversation?.userEmail || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm truncate">{selectedClientInfo?.companyName || selectedConversation?.userEmail || selectedChatId}</h4>
                          <p className="text-xs text-slate-400 truncate">{selectedClientInfo?.email || selectedConversation?.userEmail}</p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        {chatMessages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] md:max-w-[70%] p-3 rounded-2xl text-sm shadow-sm ${
                              msg.isAdmin 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        <div ref={chatScrollRef} />
                      </div>

                      <form onSubmit={handleSendReply} className="p-3 md:p-4 border-t border-slate-800 flex gap-2 bg-slate-900/50">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Écrire une réponse..."
                          className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all min-w-0"
                        />
                        <button
                          type="submit"
                          disabled={isSendingReply}
                          className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl transition-all disabled:opacity-50 shrink-0"
                        >
                          {isSendingReply ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <IconSend />
                          )}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                      <IconChat />
                      <p className="text-sm font-medium">Sélectionnez une conversation pour répondre</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}