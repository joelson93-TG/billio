"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";

// --- Composants d'icônes SVG professionnels ---
const IconOverview = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const IconUsers = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const IconPricing = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const IconClose = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    trialUsers: 0,
    expiredUsers: 0,
    totalRevenue: 0,
  });

  const [usersList, setUsersList] = useState([]);
  const [pricing, setPricing] = useState({
    monthly: 12000,
    sixMonths: 60000,
    yearly: 100000,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      if (user.email !== "admin@jblessconsulting.com") {
        router.push("/");
        return;
      }
      await loadAdminData();
    });
    return () => unsubscribe();
  }, [router]);

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
        const sub = userData.subscription || { status: "trial", daysLeft: 30 };
        const companySnap = await getDoc(doc(db, "users", userDoc.id, "settings", "company"));
        const companyData = companySnap.exists() ? companySnap.data() : {};

        let computedStatus = sub.status || "trial";
        if (computedStatus === "trial" && (sub.daysLeft <= 0 || sub.expired)) {
          computedStatus = "expired";
        }

        if (computedStatus === "active") active++;
        else if (computedStatus === "trial") trial++;
        else expired++;

        if (userData.totalPaid) {
          revenue += Number(userData.totalPaid);
        } else if (computedStatus === "active") {
          if (sub.plan === "1year") {
            revenue += Number(currentPricing.yearly);
          } else if (sub.plan === "6months") {
            revenue += Number(currentPricing.sixMonths);
          } else {
            revenue += Number(currentPricing.monthly);
          }
        }

        loadedUsers.push({
          uid: userDoc.id,
          email: userData.email || companyData.email || "Non renseigné",
          phone: companyData.phone || userData.phone || "",
          companyName: companyData.companyName || "Entreprise non configurée",
          status: computedStatus,
          plan: sub.plan || "Essai",
          daysLeft: sub.daysLeft ?? 0,
        });
      }

      setStats({ totalUsers: total, activeUsers: active, trialUsers: trial, expiredUsers: expired, totalRevenue: revenue });
      setUsersList(loadedUsers);
    } catch (error) {
      console.error("Erreur chargement admin :", error);
    } finally {
      setIsLoading(false);
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

  const changeTab = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Ferme le menu sur mobile lors du clic
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

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex font-sans selection:bg-blue-500/30">
      
      {/* OVERLAY MOBILE (Fermer le menu au clic) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* SIDEBAR ADMIN (Responsive) */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#0F172A] border-r border-slate-800 flex flex-col justify-between shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div>
          <div className="h-20 px-6 md:px-8 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/30 ring-2 ring-slate-900">
                JB
              </div>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-white">JBLESS ADMIN</h2>
                <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Console SaaS</span>
              </div>
            </div>
            {/* Bouton fermer sur mobile */}
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
              <IconClose />
            </button>
          </div>

          <nav className="p-5 space-y-2 text-sm font-medium">
            <button
              onClick={() => changeTab("overview")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === "overview" ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}
            >
              <IconOverview />
              Vue d'ensemble
            </button>
            <button
              onClick={() => changeTab("users")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === "users" ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}
            >
              <IconUsers />
              Répertoire Clients
            </button>
            <button
              onClick={() => changeTab("pricing")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === "pricing" ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}
            >
              <IconPricing />
              Grille Tarifaire
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-900/30">
          <div className="px-4 py-3 bg-slate-950/50 rounded-xl border border-slate-800 shadow-inner">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Session Active</p>
            <p className="text-xs font-bold text-slate-200 truncate mt-1">admin@jblessconsulting.com</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push("/")} className="flex-1 py-2.5 text-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 border border-slate-700 hover:border-slate-600">
              App Client
            </button>
            <button onClick={handleLogout} className="py-2.5 px-4 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/10">
              Sortir
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto relative w-full overflow-x-hidden">
        
        {/* Header supérieur responsive */}
        <header className="h-20 border-b border-slate-800 px-4 md:px-10 flex items-center justify-between bg-[#0B1120]/80 backdrop-blur-md sticky top-0 z-10 w-full">
          <div className="flex items-center gap-3">
            {/* Bouton Hamburger pour mobile */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none rounded-lg hover:bg-slate-800 transition-colors">
              <IconMenu />
            </button>
            
            <h1 className="text-sm md:text-lg font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              {activeTab === "overview" && <><span className="hidden md:inline-block w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></span> Tableau de bord</>}
              {activeTab === "users" && <><span className="hidden md:inline-block w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span> Entreprises</>}
              {activeTab === "pricing" && <><span className="hidden md:inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span> Tarifs</>}
            </h1>
          </div>
        </header>

        <div className="p-4 md:p-10 space-y-6 md:space-y-10 max-w-7xl w-full mx-auto pb-20">
          
          {/* TAB : OVERVIEW AVEC GRAPHIQUES RECHARTS */}
          {activeTab === "overview" && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Cartes de KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                
                <div className="sm:col-span-2 bg-gradient-to-br from-blue-900 to-[#0F172A] border border-blue-800/50 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-500"></div>
                  <div className="relative z-10">
                    <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">Chiffre d'Affaires Généré</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white">{stats.totalRevenue.toLocaleString()}</h3>
                        <span className="text-lg md:text-xl font-bold text-blue-400">FCFA</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-slate-800 p-5 md:p-6 rounded-3xl shadow-xl flex flex-col justify-between group hover:border-emerald-500/30 transition-colors">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        Abonnés Actifs
                        <span className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400"><IconUsers /></span>
                    </p>
                    <h3 className="text-3xl md:text-4xl font-black text-white mt-2">{stats.activeUsers}</h3>
                  </div>
                  <div className="mt-4 text-[10px] md:text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Souscriptions valides
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-slate-800 p-5 md:p-6 rounded-3xl shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-colors">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        En Période d'Essai
                        <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400"><IconOverview /></span>
                    </p>
                    <h3 className="text-3xl md:text-4xl font-black text-white mt-2">{stats.trialUsers}</h3>
                  </div>
                  <div className="mt-4 text-[10px] md:text-xs font-semibold text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Conversions potentielles
                  </div>
                </div>
              </div>

              {/* SECTION GRAPHIQUES RECHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 shadow-xl flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Répartition par Statut</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Vue globale des comptes actifs, en essai et expirés</p>
                  </div>
                  
                  <div className="h-64 md:h-72 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#090D16", borderColor: "#1E293B", borderRadius: "12px", color: "#fff", fontSize: "12px", fontWeight: "bold" }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs font-bold text-slate-300 mt-2">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Actifs ({stats.activeUsers})</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Essais ({stats.trialUsers})</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Expirés ({stats.expiredUsers})</div>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 shadow-xl flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Popularité des Formules</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Nombre d'utilisateurs par type d'abonnement</p>
                  </div>

                  <div className="h-64 md:h-72 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#090D16", borderColor: "#1E293B", borderRadius: "12px", color: "#fff", fontSize: "12px", fontWeight: "bold" }} 
                          cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                        />
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
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 md:mb-8">
                <h3 className="font-extrabold text-sm md:text-base text-white uppercase tracking-wider flex items-center gap-2">
                    <IconUsers /> Base de données
                </h3>
                <div className="relative w-full sm:w-auto">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                    type="text"
                    placeholder="Chercher une entreprise..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 pl-10 pr-4 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl outline-none text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                    />
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-xl">
                <table className="w-full text-left border-collapse text-sm whitespace-nowrap min-w-[700px]">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-widest bg-slate-900/50">
                      <th className="py-4 px-4 rounded-tl-xl">Entreprise & Contact</th>
                      <th className="py-4 px-4">Plan Actuel</th>
                      <th className="py-4 px-4">Statut</th>
                      <th className="py-4 px-4 text-right rounded-tr-xl">Action</th>
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
                                <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors truncate">{u.companyName}</div>
                                <div className="text-slate-400 text-xs mt-0.5 truncate">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-300 text-xs capitalize">
                            {u.plan === "1year" ? "Annuel" : u.plan === "6months" ? "Semestriel" : u.plan === "1month" ? "Mensuel" : "Essai (Gratuit)"}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center w-max gap-1.5
                            ${u.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                              u.status === "trial" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : 
                              "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : u.status === 'trial' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                            {u.status === "active" ? "Actif" : u.status === "trial" ? "En Essai" : "Expiré"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {u.phone ? (
                            <a href={`https://wa.me/${u.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-xs rounded-xl transition-all border border-[#25D366]/20 hover:scale-105">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                              Contacter
                            </a>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Aucun numéro</span>
                          )}
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
            <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 md:p-8 max-w-2xl mx-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6 md:mb-8">
                <h3 className="font-extrabold text-base md:text-lg text-white uppercase tracking-wider flex items-center gap-2">
                    <IconPricing /> Grille Tarifaire Officielle
                </h3>
                <p className="text-slate-400 text-xs md:text-sm mt-2">Mettez à jour les prix qui seront affichés aux clients lors du renouvellement de leur licence logicielle.</p>
              </div>

              <form onSubmit={handleSavePricing} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">Tarif 1 Mois (FCFA)</label>
                    <div className="relative">
                        <input type="number" value={pricing.monthly} onChange={(e) => setPricing({ ...pricing, monthly: e.target.value })} className="w-full p-4 pl-5 pr-16 text-lg bg-slate-900/50 border border-slate-700 rounded-2xl text-white font-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" required />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">XOF</span>
                    </div>
                    </div>
                    <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">Tarif 6 Mois (FCFA)</label>
                    <div className="relative">
                        <input type="number" value={pricing.sixMonths} onChange={(e) => setPricing({ ...pricing, sixMonths: e.target.value })} className="w-full p-4 pl-5 pr-16 text-lg bg-slate-900/50 border border-slate-700 rounded-2xl text-white font-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" required />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">XOF</span>
                    </div>
                    </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-300 uppercase tracking-widest flex items-center flex-wrap gap-2">
                    Tarif 1 An (FCFA) <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">Recommandé</span>
                  </label>
                  <div className="relative">
                    <input type="number" value={pricing.yearly} onChange={(e) => setPricing({ ...pricing, yearly: e.target.value })} className="w-full p-4 pl-5 pr-20 md:pr-24 text-xl md:text-2xl bg-slate-900 border-2 border-blue-500/30 rounded-2xl text-white font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg" required />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 font-black text-[10px] md:text-sm">XOF / AN</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <button type="submit" disabled={isSavingPricing} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2">
                    {isSavingPricing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sauvegarde...</>
                    ) : (
                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Enregistrer les tarifs</>
                    )}
                    </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}