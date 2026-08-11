"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp, increment
} from "firebase/firestore";
import { 
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject 
} from "firebase/storage";
import { auth, db, storage } from "@/firebase";
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
const IconRefresh = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const IconImage = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconArrowUp = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const IconArrowDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const IconUploadCloud = () => <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const IconWhatsApp = ({ className = "w-4 h-4" }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>;
const IconMail = ({ className = "w-4 h-4" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;

const formatChatTime = (timestamp) => {
  if (!timestamp?.toDate) return "...";
  return timestamp.toDate().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatLastRun = (timestamp) => {
  if (!timestamp?.toDate) return "Aucune exécution enregistrée";
  return timestamp.toDate().toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

const isValidEmail = (email) => typeof email === "string" && email.includes("@");

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
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const [sendingReminderTo, setSendingReminderTo] = useState(null);
  const [isSendingBulkReminder, setIsSendingBulkReminder] = useState(false);
  const [reminderStats, setReminderStats] = useState(null);

  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isTestingAfrimsg, setIsTestingAfrimsg] = useState(false);
  const [afrimsgTestResult, setAfrimsgTestResult] = useState(null);

  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState(null);

  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, trialUsers: 0, expiredUsers: 0, totalRevenue: 0,
  });

  const [usersList, setUsersList] = useState([]);
  const [pricing, setPricing] = useState({ monthly: 12000, sixMonths: 60000, yearly: 100000 });

  const pricingRef = useRef(pricing);
  useEffect(() => {
    pricingRef.current = pricing;
  }, [pricing]);

  const [helpLinks, setHelpLinks] = useState({ whatsapp: "", facebook: "", tiktok: "", website: "" });
  const [tutorials, setTutorials] = useState([]);
  const [newTutorial, setNewTutorial] = useState({ title: "", embedUrl: "" });
  const [editingTutorial, setEditingTutorial] = useState(null);

  const [screenshots, setScreenshots] = useState([]);
  const [editingScreenshotId, setEditingScreenshotId] = useState(null);
  const [editingScreenshotUrl, setEditingScreenshotUrl] = useState("");
  const [isSavingScreenshotOrder, setIsSavingScreenshotOrder] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const chatScrollRef = useRef(null);

  // ── Authentification admin ──
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      if (user.email !== "admin@jblessconsulting.com") { router.push("/"); return; }
      setIsAdminVerified(true);
    });
    return () => unsubscribeAuth();
  }, [router]);

  // ── Grille tarifaire en TEMPS RÉEL ──
  useEffect(() => {
    if (!isAdminVerified) return;
    const pricingDocRef = doc(db, "config", "pricing");
    const unsub = onSnapshot(pricingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPricing({
          monthly: Number(data.monthly) || 12000,
          sixMonths: Number(data.sixMonths) || 60000,
          yearly: Number(data.yearly) || 100000,
        });
      }
    });
    return () => unsub();
  }, [isAdminVerified]);

  // ── Statistiques du dernier passage automatique de rappel (temps réel) ──
  useEffect(() => {
    if (!isAdminVerified) return;
    const statsRef = doc(db, "stats", "reminderRun");
    const unsub = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) setReminderStats(snap.data());
    }, (error) => {
      console.error("Erreur écoute stats rappels :", error);
    });
    return () => unsub();
  }, [isAdminVerified]);

  // ── Diaporama Landing Page en TEMPS RÉEL ──
  useEffect(() => {
    if (!isAdminVerified) return;
    const q = query(collection(db, "screenshots"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setScreenshots(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("Erreur écoute screenshots :", error);
      }
    );
    return () => unsub();
  }, [isAdminVerified]);

  // ── Utilisateurs & statistiques en TEMPS RÉEL ──
  useEffect(() => {
    if (!isAdminVerified) return;

    const usersCollRef = collection(db, "users");
    const unsub = onSnapshot(
      usersCollRef,
      async (snapshot) => {
        try {
          let total = 0, active = 0, trial = 0, expired = 0, revenue = 0;
          const currentPricing = pricingRef.current;

          const loadedUsers = await Promise.all(
            snapshot.docs.map(async (userDoc) => {
              const userData = userDoc.data();
              const sub = userData.subscription || {};

              let companyData = {};
              try {
                const companySnap = await getDoc(doc(db, "users", userDoc.id, "settings", "company"));
                companyData = companySnap.exists() ? companySnap.data() : {};
              } catch (e) {
                companyData = {};
              }

              const daysLeft = computeDaysLeft(userData);
              let computedStatus = userData.subscriptionStatus || sub.status || "trial";
              if (computedStatus !== "expired" && daysLeft <= 0) {
                computedStatus = "expired";
              }

              const resolvedPlan = resolvePlan(userData, sub, computedStatus);

              return {
                uid: userDoc.id,
                email: userData.email || companyData.email || "Non renseigné",
                // 🆕 FIX : ajout de userData.whatsappNumber dans la chaîne de fallback
                // pour que les nouveaux comptes (inscrits via le formulaire signup)
                // soient bien détectés comme joignables par WhatsApp.
                // Ordre de priorité conservé : company.phone > whatsappNumber > ancien champ phone
                phone: companyData.phone || userData.whatsappNumber || userData.phone || "",
                companyName: companyData.companyName || userData.businessName || "Entreprise non configurée",
                status: computedStatus,
                plan: resolvedPlan,
                daysLeft,
                totalPaid: userData.totalPaid || userData.lastPaymentAmount || 0,
                lastReminderChannel: userData.lastReminderChannel || null,
              };
            })
          );

          loadedUsers.forEach((u) => {
            total++;
            if (u.status === "active") active++;
            else if (u.status === "trial") trial++;
            else expired++;

            if (u.totalPaid > 0) {
              revenue += u.totalPaid;
            } else if (u.status === "active") {
              if (u.plan === "1year") revenue += Number(currentPricing.yearly);
              else if (u.plan === "6months") revenue += Number(currentPricing.sixMonths);
              else revenue += Number(currentPricing.monthly);
            }
          });

          setStats({ totalUsers: total, activeUsers: active, trialUsers: trial, expiredUsers: expired, totalRevenue: revenue });
          setUsersList(loadedUsers);
          setLastSyncAt(new Date());
        } catch (error) {
          console.error("Erreur traitement snapshot utilisateurs :", error);
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Erreur écoute utilisateurs :", error);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [isAdminVerified]);

  useEffect(() => {
    if (!isAdminVerified) return;
    loadHelpCenterData();
  }, [isAdminVerified]);

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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
      const pricingDocRef = doc(db, "config", "pricing");
      await setDoc(pricingDocRef, {
        monthly: Number(pricing.monthly),
        sixMonths: Number(pricing.sixMonths),
        yearly: Number(pricing.yearly),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      alert("Grille tarifaire mise à jour avec succès !");
    } catch (error) {
      console.error("Erreur tarifs :", error);
    } finally {
      setIsSavingPricing(false);
    }
  };

  // ── Upload de captures d'écran (Firebase Storage) ──
  const validateAndSetFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner un fichier image (PNG, JPG, WEBP...)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 5 Mo");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleCancelSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadScreenshot = async () => {
    if (!selectedFile) {
      alert("Veuillez sélectionner une image");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uniqueFileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const fileStorageRef = storageRef(storage, `screenshots/${uniqueFileName}`);
      const uploadTask = uploadBytesResumable(fileStorageRef, selectedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("Erreur upload :", error);
          alert("Erreur lors de l'upload de l'image");
          setIsUploading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const maxOrder = screenshots.reduce((max, s) => Math.max(max, s.order ?? 0), -1);

          await addDoc(collection(db, "screenshots"), {
            url: downloadUrl,
            storagePath: `screenshots/${uniqueFileName}`,
            order: maxOrder + 1,
            createdAt: serverTimestamp(),
          });

          handleCancelSelection();
          setIsUploading(false);
          alert("Image ajoutée au diaporama !");
        }
      );
    } catch (error) {
      console.error("Erreur ajout capture d'écran :", error);
      alert("Erreur lors de l'ajout de l'image");
      setIsUploading(false);
    }
  };

  const handleUpdateScreenshotUrl = async (e) => {
    e.preventDefault();
    if (!editingScreenshotId || !editingScreenshotUrl.trim()) return;
    try {
      await updateDoc(doc(db, "screenshots", editingScreenshotId), {
        url: editingScreenshotUrl.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingScreenshotId(null);
      setEditingScreenshotUrl("");
      alert("Image modifiée !");
    } catch (error) {
      console.error("Erreur modification capture d'écran :", error);
      alert("Erreur lors de la modification");
    }
  };

  const handleDeleteScreenshot = async (screenshotId) => {
    if (!confirm("Supprimer cette image du diaporama ?")) return;
    try {
      const shot = screenshots.find((s) => s.id === screenshotId);

      if (shot?.storagePath) {
        try {
          await deleteObject(storageRef(storage, shot.storagePath));
        } catch (storageError) {
          console.warn("Fichier Storage introuvable ou déjà supprimé :", storageError);
        }
      }

      await deleteDoc(doc(db, "screenshots", screenshotId));
      alert("Image supprimée !");
    } catch (error) {
      console.error("Erreur suppression capture d'écran :", error);
      alert("Erreur lors de la suppression");
    }
  };

  const handleMoveScreenshot = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= screenshots.length) return;

    const current = screenshots[index];
    const target = screenshots[targetIndex];

    setIsSavingScreenshotOrder(true);
    try {
      const currentOrder = current.order ?? index;
      const targetOrder = target.order ?? targetIndex;

      await Promise.all([
        updateDoc(doc(db, "screenshots", current.id), { order: targetOrder }),
        updateDoc(doc(db, "screenshots", target.id), { order: currentOrder }),
      ]);
    } catch (error) {
      console.error("Erreur réorganisation diaporama :", error);
      alert("Erreur lors de la réorganisation");
    } finally {
      setIsSavingScreenshotOrder(false);
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

  // ==========================================================
  // 🔄 Rappels multi-canal (WhatsApp via AfriMsg / Email via Resend)
  // ==========================================================

  const buildReminderMessage = (user) => {
    const greeting = `Bonjour ${user.companyName} 👋,`;
    const instructions =
      `\n\nPour continuer à profiter de toutes les fonctionnalités de *Billio*, ` +
      `rendez-vous dans votre espace :\n\n` +
      `👉 *Paramètres société* > choisissez le forfait qui vous convient > ` +
      `payez en toute sécurité via *FedaPay*.\n\n💙 L'équipe Billio`;

    if (user.status === "expired" || user.daysLeft <= 0) {
      return `${greeting}\n\nVotre abonnement *Billio* a expiré. Votre accès complet est actuellement suspendu.${instructions}`;
    }
    return `${greeting}\n\nVotre abonnement *Billio* expire dans *${user.daysLeft} jour(s)*. Pensez à renouveler dès maintenant pour éviter toute interruption de service.${instructions}`;
  };

  const isReminderTarget = (u) =>
    (!!u.phone || isValidEmail(u.email)) && (u.status === "expired" || u.daysLeft <= 3);

  const handleSendReminder = async (user) => {
    const channel = user.phone ? "whatsapp" : (isValidEmail(user.email) ? "email" : null);
    if (!channel) {
      alert("Ce client n'a ni numéro de téléphone ni email valide");
      return;
    }

    setSendingReminderTo(user.uid);
    try {
      let res;
      if (channel === "whatsapp") {
        res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: user.phone, message: buildReminderMessage(user) }),
        });
      } else {
        res = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user.email,
            companyName: user.companyName,
            status: user.status,
            daysLeft: user.daysLeft,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await updateDoc(doc(db, "users", user.uid), {
        lastReminderSentAt: serverTimestamp(),
        lastReminderChannel: channel,
      });

      alert(`✅ Rappel envoyé à ${user.companyName} par ${channel === "whatsapp" ? "WhatsApp" : "Email"}`);
    } catch (error) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setSendingReminderTo(null);
    }
  };

  const handleBulkReminder = async () => {
    const targets = usersList.filter(isReminderTarget);

    if (targets.length === 0) {
      alert("Aucun client à rappeler (expiré ou ≤ 3 jours) parmi les clients joignables.");
      return;
    }
    if (targets.length === 1) {
      await handleSendReminder(targets[0]);
      return;
    }

    const whatsappTargets = targets.filter((u) => u.phone);
    const emailTargets = targets.filter((u) => !u.phone && isValidEmail(u.email));

    if (!confirm(
      `Envoyer un rappel à ${targets.length} client(s) ?\n\n` +
      `📱 WhatsApp : ${whatsappTargets.length}\n` +
      `✉️ Email : ${emailTargets.length}`
    )) return;

    setIsSendingBulkReminder(true);
    try {
      if (whatsappTargets.length >= 2) {
        const messages = whatsappTargets.map((u) => ({ to: u.phone, message: buildReminderMessage(u) }));
        const res = await fetch("/api/whatsapp/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, delayMin: 3, delayMax: 8 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        await Promise.all(
          whatsappTargets.map((u) =>
            updateDoc(doc(db, "users", u.uid), {
              lastReminderSentAt: serverTimestamp(),
              lastReminderChannel: "whatsapp",
            }).catch(() => {})
          )
        );
      } else if (whatsappTargets.length === 1) {
        await handleSendReminder(whatsappTargets[0]);
      }

      for (const u of emailTargets) {
        try {
          const res = await fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: u.email,
              companyName: u.companyName,
              status: u.status,
              daysLeft: u.daysLeft,
            }),
          });
          if (res.ok) {
            await updateDoc(doc(db, "users", u.uid), {
              lastReminderSentAt: serverTimestamp(),
              lastReminderChannel: "email",
            });
          }
        } catch (e) {
          console.error(`Erreur email pour ${u.uid} :`, e);
        }
      }

      alert(`✅ Envoi groupé terminé : ${whatsappTargets.length} WhatsApp, ${emailTargets.length} Email`);
    } catch (error) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setIsSendingBulkReminder(false);
    }
  };

  const handleTestAfrimsg = async (e) => {
    e.preventDefault();
    setIsTestingAfrimsg(true);
    setAfrimsgTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhoneNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur inconnue");
      }
      setAfrimsgTestResult({ success: true, message: data.message });
    } catch (error) {
      setAfrimsgTestResult({ success: false, message: error.message });
    } finally {
      setIsTestingAfrimsg(false);
    }
  };

  const handleTestEmail = async (e) => {
    e.preventDefault();
    setIsTestingEmail(true);
    setEmailTestResult(null);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmailAddress }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur inconnue");
      }
      setEmailTestResult({ success: true, message: data.message });
    } catch (error) {
      setEmailTestResult({ success: false, message: error.message });
    } finally {
      setIsTestingEmail(false);
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
    { key: "screenshots", label: "Diaporama Landing Page", icon: <IconImage /> },
    { key: "help", label: "Centre d'aide", icon: <IconHelp /> },
    { key: "messages", label: "Messagerie", icon: <IconChat />, badge: totalUnreadMessages },
  ];

  const totalReminderSent = reminderStats
    ? (reminderStats.sentWhatsappCount || 0) + (reminderStats.sentEmailCount || 0)
    : 0;

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
              {activeTab === "screenshots" && <><span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] shrink-0"></span> <span className="truncate">Diaporama Landing Page</span></>}
              {activeTab === "help" && <><span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] shrink-0"></span> <span className="truncate">Centre d'aide</span></>}
              {activeTab === "messages" && <><span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)] shrink-0"></span> <span className="truncate">Messagerie</span></>}
            </h1>
          </div>

          {lastSyncAt && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Synchronisé en temps réel
            </div>
          )}
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
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-extrabold text-base text-white uppercase tracking-wider flex items-center gap-2">
                      <IconUsers /> Base de données Clients
                  </h3>
                  <button
                    onClick={handleBulkReminder}
                    disabled={isSendingBulkReminder}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl transition-all border border-emerald-500/20 disabled:opacity-50"
                    title="Envoyer un rappel (WhatsApp ou Email) à tous les clients expirés ou à ≤ 3 jours"
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

              {/* MINI-STATS : Dernier passage automatique de rappel */}
              {reminderStats && (
                <div className="mb-8 bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <IconRefresh /> Dernier Passage Automatique
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {formatLastRun(reminderStats.lastRunAt)} · déclenché par{" "}
                      <span className={reminderStats.triggeredBy === "auto" ? "text-emerald-400" : "text-amber-400"}>
                        {reminderStats.triggeredBy === "auto" ? "Cloud Scheduler (8h00)" : "Test manuel"}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-[#0F172A] border border-emerald-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-emerald-400">{reminderStats.sentWhatsappCount ?? 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center justify-center gap-1">
                        <IconWhatsApp className="w-3.5 h-3.5" /> WhatsApp
                      </p>
                    </div>
                    <div className="bg-[#0F172A] border border-blue-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-blue-400">{reminderStats.sentEmailCount ?? 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center justify-center gap-1">
                        <IconMail className="w-3.5 h-3.5" /> Email
                      </p>
                    </div>
                    <div className="bg-[#0F172A] border border-slate-700 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-slate-300">{reminderStats.skippedCount ?? 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ignorés</p>
                    </div>
                    <div className="bg-[#0F172A] border border-red-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-red-400">{reminderStats.errorCount ?? 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Erreurs</p>
                    </div>
                    <div className="bg-[#0F172A] border border-amber-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-amber-400">{reminderStats.unreachableCount ?? 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Injoignables</p>
                    </div>
                  </div>

                  {totalReminderSent > 0 && (
                    <div className="mt-4">
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                        <div
                          className="bg-emerald-500 transition-all duration-500"
                          style={{ width: `${(reminderStats.sentWhatsappCount / totalReminderSent) * 100}%` }}
                        ></div>
                        <div
                          className="bg-blue-500 transition-all duration-500"
                          style={{ width: `${(reminderStats.sentEmailCount / totalReminderSent) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 font-semibold">
                        <span>📱 WhatsApp {Math.round((reminderStats.sentWhatsappCount / totalReminderSent) * 100)}%</span>
                        <span>✉️ Email {Math.round((reminderStats.sentEmailCount / totalReminderSent) * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
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
                                {u.lastReminderChannel && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                    {u.lastReminderChannel.includes("email") ? <IconMail className="w-3 h-3" /> : <IconWhatsApp className="w-3 h-3" />}
                                    Dernier rappel : {u.lastReminderChannel === "whatsapp" ? "WhatsApp" : u.lastReminderChannel === "email_fallback" ? "Email (secours)" : "Email"}
                                  </div>
                                )}
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
                                className={`inline-flex items-center gap-2 px-3 py-2 font-bold text-xs rounded-xl transition-all border disabled:opacity-50 ${
                                  u.phone
                                    ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20"
                                    : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20"
                                }`}
                                title={u.phone ? "Envoyer un rappel par WhatsApp" : "Envoyer un rappel par Email (aucun numéro renseigné)"}
                              >
                                {sendingReminderTo === u.uid ? (
                                  <div className={`w-3 h-3 border-2 rounded-full animate-spin ${u.phone ? "border-blue-400/30 border-t-blue-400" : "border-purple-400/30 border-t-purple-400"}`}></div>
                                ) : u.phone ? (
                                  <IconChat />
                                ) : (
                                  <IconMail />
                                )}
                                {u.phone ? "Rappel" : "Rappel (Email)"}
                              </button>
                            )}

                            {u.phone ? (
                              <a href={`https://wa.me/${u.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-xs rounded-xl transition-all border border-[#25D366]/20 hover:scale-105">
                                <IconWhatsApp />
                                Contacter
                              </a>
                            ) : isValidEmail(u.email) ? (
                              <a href={`mailto:${u.email}`} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-600/30">
                                <IconMail /> Email
                              </a>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Aucun contact</span>
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

          {/* TAB : DIAPORAMA LANDING PAGE */}
          {activeTab === "screenshots" && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6">
                <h3 className="font-extrabold text-lg text-white uppercase tracking-wider flex items-center gap-2">
                  <IconImage /> Diaporama du Tableau de Bord (Page d'Accueil)
                </h3>
                <p className="text-slate-400 text-sm mt-2">
                  Importez directement vos captures d'écran depuis votre ordinateur. L'image est automatiquement
                  hébergée sur Firebase Storage et ajoutée au diaporama de la landing page.
                  Si aucune image n'est ajoutée ici, une image par défaut est utilisée automatiquement.
                </p>
              </div>

              <div className="space-y-4 mb-8 p-4 md:p-6 bg-slate-900/30 rounded-2xl border border-slate-700">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Ajouter une image (upload direct)
                </label>

                {!previewUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors bg-slate-900/50 ${
                      isDraggingOver ? "border-cyan-500 bg-cyan-500/5" : "border-slate-600 hover:border-cyan-500"
                    }`}
                  >
                    <div className="mx-auto text-slate-500 mb-3 flex justify-center">
                      <IconUploadCloud />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Cliquez ou glissez-déposez une image ici
                    </p>
                    <p className="text-slate-600 text-xs mt-1">PNG, JPG, WEBP — Max 5 Mo</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-700">
                      <img src={previewUrl} alt="Aperçu" className="w-full h-full object-cover" />
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={handleCancelSelection}
                          className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
                        >
                          <IconClose />
                        </button>
                      )}
                    </div>

                    {isUploading && (
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-cyan-400 font-bold text-right">{uploadProgress}%</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleUploadScreenshot}
                      disabled={isUploading}
                      className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-cyan-600/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Confirmer et ajouter au diaporama
                        </>
                      )}
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">L'image sera automatiquement placée à la fin du diaporama. Utilisez les flèches ci-dessous pour réorganiser l'ordre.</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>Images du diaporama ({screenshots.length})</span>
                  {isSavingScreenshotOrder && (
                    <span className="text-[10px] text-cyan-400 flex items-center gap-1.5 normal-case font-medium">
                      <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
                      Réorganisation...
                    </span>
                  )}
                </h4>

                {screenshots.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 italic">
                    Aucune image ajoutée. L'image par défaut du dashboard sera affichée sur la landing page.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {screenshots.map((shot, index) => (
                      <div key={shot.id} className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 space-y-3 group hover:border-slate-600 transition-all">
                        {editingScreenshotId === shot.id ? (
                          <form onSubmit={handleUpdateScreenshotUrl} className="space-y-3">
                            <input
                              type="text"
                              value={editingScreenshotUrl}
                              onChange={(e) => setEditingScreenshotUrl(e.target.value)}
                              className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs outline-none focus:border-cyan-500"
                              required
                            />
                            <div className="flex gap-2">
                              <button type="submit" className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg">Enregistrer</button>
                              <button type="button" onClick={() => { setEditingScreenshotId(null); setEditingScreenshotUrl(""); }} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg">Annuler</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                              <img
                                src={shot.url}
                                alt={`Capture ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.opacity = "0.2"; }}
                              />
                              <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-black px-2 py-1 rounded-lg">
                                #{index + 1}
                              </span>
                              {shot.storagePath && (
                                <span className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  Storage
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleMoveScreenshot(index, "up")}
                                disabled={index === 0 || isSavingScreenshotOrder}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Déplacer vers le haut (avant)"
                              >
                                <IconArrowUp />
                              </button>
                              <button
                                onClick={() => handleMoveScreenshot(index, "down")}
                                disabled={index === screenshots.length - 1 || isSavingScreenshotOrder}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Déplacer vers le bas (après)"
                              >
                                <IconArrowDown />
                              </button>
                              <button
                                onClick={() => { setEditingScreenshotId(shot.id); setEditingScreenshotUrl(shot.url); }}
                                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteScreenshot(shot.id)}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                                title="Supprimer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB : CENTRE D'AIDE */}
          {activeTab === "help" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Test de connexion AfriMsg + Test Resend (Email) */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 shadow-2xl">
                <div className="mb-6">
                  <h3 className="font-extrabold text-lg text-white uppercase tracking-wider flex items-center gap-2">
                    <IconWhatsApp className="w-6 h-6 text-emerald-400" />
                    Test des Canaux de Rappel (WhatsApp & Email)
                  </h3>
                  <p className="text-slate-400 text-sm mt-2">
                    Vérifiez que les intégrations WhatsApp (AfriMsg) et Email (Resend) fonctionnent
                    en envoyant un message de test réel. Utile après une mise à jour de clé API ou
                    en cas de doute sur le bon fonctionnement des rappels automatiques.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Test WhatsApp */}
                  <div className="space-y-3 p-4 bg-slate-900/30 rounded-2xl border border-slate-700">
                    <label className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <IconWhatsApp className="w-4 h-4" /> Canal WhatsApp (AfriMsg)
                    </label>
                    <form onSubmit={handleTestAfrimsg} className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                          placeholder="Ex: 22890000000"
                          className="flex-1 p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isTestingAfrimsg}
                          className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50 shrink-0"
                        >
                          {isTestingAfrimsg ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                          Tester
                        </button>
                      </div>

                      {afrimsgTestResult && (
                        <div
                          className={`p-3 rounded-xl border text-xs font-medium ${
                            afrimsgTestResult.success
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {afrimsgTestResult.success ? (
                              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span>{afrimsgTestResult.message}</span>
                          </div>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Test Email (Resend) */}
                  <div className="space-y-3 p-4 bg-slate-900/30 rounded-2xl border border-slate-700">
                    <label className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <IconMail className="w-4 h-4" /> Canal Email (Resend) — Fallback
                    </label>
                    <form onSubmit={handleTestEmail} className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                          placeholder="Ex: test@exemple.com"
                          className="flex-1 p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isTestingEmail}
                          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-600/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50 shrink-0"
                        >
                          {isTestingEmail ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                          Tester
                        </button>
                      </div>

                      {emailTestResult && (
                        <div
                          className={`p-3 rounded-xl border text-xs font-medium ${
                            emailTestResult.success
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {emailTestResult.success ? (
                              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span>{emailTestResult.message}</span>
                          </div>
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              </div>

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
                        <IconWhatsApp className="w-4 h-4 text-green-500" />
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