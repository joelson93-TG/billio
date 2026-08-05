"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { auth, db } from "../firebase";

import { useSubscription } from "@/components/SubscriptionProvider";

export default function DashboardPage() {
  const [user, setUser] = useState<any | null>(null);
  const [businessData, setBusinessData] = useState<any | null>(null);
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [proformas, setProformas] = useState<any[]>([]);
  const [activeRecentTab, setActiveRecentTab] = useState<"invoices" | "proformas">("invoices");

  const [customersCount, setCustomersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { isExpired } = useSubscription();
  const isSubscribed = !isExpired;

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportStart, setReportStart] = useState<string>(todayStr);
  const [reportEnd, setReportEnd] = useState<string>(todayStr);

  // NOUVEAU : horloge en temps réel (date + heure du jour)
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedTime = currentDateTime.toLocaleTimeString('fr-FR');

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser: any) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      
      setUser(currentUser);

      const userRef = doc(db, "users", currentUser.uid);
      const unsubUser = onSnapshot(userRef, (docSnap: any) => {
        if (docSnap.exists()) setBusinessData(docSnap.data());
      });

      const invoicesRef = collection(db, "users", currentUser.uid, "invoices");
      const qInvoices = query(invoicesRef, orderBy("createdAt", "desc"));
      const unsubInvoices = onSnapshot(qInvoices, (querySnapshot: any) => {
        const allFetchedDocs = querySnapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }));

        setInvoices(allFetchedDocs.filter((doc: any) => doc.type !== "proforma"));
        setProformas(allFetchedDocs.filter((doc: any) => doc.type === "proforma"));
      });

      const customersRef = collection(db, "users", currentUser.uid, "customers");
      const unsubCustomers = onSnapshot(customersRef, (querySnapshot: any) => {
        setCustomersCount(querySnapshot.size);
      });

      setIsLoading(false);

      return () => {
        unsubUser();
        unsubInvoices();
        unsubCustomers();
      };
    });

    return () => unsubscribeAuth();
  }, [router]);

  const getAmount = (inv: any): number => Number(inv.netAPayer || inv.totalTtc || inv.montant) || 0;
  const getStatus = (inv: any): string => (inv.status || inv.statut || "").toUpperCase().trim();
  
  const isPending = (status: string): boolean => status === "EN_ATTENTE" || status === "EN ATTENTE" || status.includes("PARTIEL");
  const isPaid = (status: string): boolean => status === "PAYÉ" || status === "PAYE" || status === "RÉGLÉ" || status === "REGLE";
  const isPartialPayment = (status: string): boolean => status.includes("PARTIEL") || status.includes("PARTIAL");

  const getCollectedAmount = (inv: any): number => {
    if (Array.isArray(inv.payments) && inv.payments.length > 0) {
      return inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    }
    const status = getStatus(inv);
    if (isPaid(status)) return getAmount(inv);
    if (isPartialPayment(status)) {
      return Number(
        inv.montantPaye || inv.montantPayé || inv.montantRegle || inv.montantRéglé || inv.paidAmount || 
        inv.amountPaid || inv.avance || inv.montantVerse || inv.montantVersé || inv.partialAmount || 
        inv.versement || inv.montantPartiel || inv.solde || 0
      );
    }
    return 0;
  };

  const getRemainingAmount = (inv: any): number => {
    return Math.max(0, getAmount(inv) - getCollectedAmount(inv));
  };

  const isOverdue30Days = (inv: any): boolean => {
    const status = getStatus(inv);
    if (!isPending(status)) return false;

    const invDateStr = inv.date || inv.createdAt || Date.now();
    const diffDays = (new Date().getTime() - new Date(invDateStr).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  };

  const overdueInvoices = invoices.filter((inv: any) => isOverdue30Days(inv));
  const pendingInvoices = invoices.filter((inv: any) => isPending(getStatus(inv)));
  
  const totalPending = pendingInvoices.reduce((sum: number, inv: any) => sum + getRemainingAmount(inv), 0);
  
  const totalRevenue = invoices.reduce((sum: number, inv: any) => {
    const status = getStatus(inv);
    if (isPaid(status) || isPartialPayment(status)) {
      return sum + getCollectedAmount(inv);
    }
    return sum;
  }, 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let caCurrentMonth = 0; let caLastMonth = 0;
  let pendingCurrentMonth = 0; let pendingLastMonth = 0;

  invoices.forEach((inv: any) => {
    const d = new Date(inv.date || inv.createdAt || Date.now());
    const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    const isLastMonth = (currentMonth === 0 ? d.getMonth() === 11 && d.getFullYear() === currentYear - 1 : d.getMonth() === currentMonth - 1 && d.getFullYear() === currentYear);
    
    const status = getStatus(inv);
    if (isPaid(status) || isPartialPayment(status)) {
      const collected = getCollectedAmount(inv);
      if (isCurrentMonth) caCurrentMonth += collected;
      if (isLastMonth) caLastMonth += collected;
    }
    if (isPending(status)) {
      const remaining = getRemainingAmount(inv);
      if (isCurrentMonth) pendingCurrentMonth += remaining;
      if (isLastMonth) pendingLastMonth += remaining;
    }
  });

  const calcVariation = (current: number, previous: number): number => previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const caVariation = calcVariation(caCurrentMonth, caLastMonth);

  const getChartData = () => {
    const data: Record<string, { mois: string, revenus: number, attente: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = d.toLocaleString('fr-FR', { month: 'short' });
      data[monthKey] = { mois: monthKey, revenus: 0, attente: 0 };
    }

    invoices.forEach((inv: any) => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const monthKey = d.toLocaleString('fr-FR', { month: 'short' });
      if (data[monthKey]) {
        const status = getStatus(inv);
        if (isPaid(status) || isPartialPayment(status)) {
          data[monthKey].revenus += getCollectedAmount(inv);
        }
        if (isPending(status)) data[monthKey].attente += getRemainingAmount(inv);
      }
    });
    return Object.values(data);
  };
  
  const chartData = getChartData();
  const maxChartValue = Math.max(100000, ...chartData.map((d: any) => Math.max(d.revenus, d.attente)));

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount).replace('XOF', 'F CFA');
  };

  const handleGenerateReport = () => {
    const startDateObj = new Date(reportStart); startDateObj.setHours(0, 0, 0, 0);
    const endDateObj = new Date(reportEnd); endDateObj.setHours(23, 59, 59, 999);

    const filteredInvoices = invoices.filter((inv: any) => {
      const invDate = new Date(inv.date || inv.createdAt || Date.now());
      const status = getStatus(inv);
      const isValidStatus = isPaid(status) || isPartialPayment(status);
      return isValidStatus && invDate >= startDateObj && invDate <= endDateObj;
    });

    const totalAmount = filteredInvoices.reduce((sum: number, inv: any) => sum + getCollectedAmount(inv), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Journal d'Encaissement - ${businessData?.businessName || 'Entreprise'}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 40px; margin: 0; background-color: #f9fafb; }
          .page-container { background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 900px; margin: 0 auto; }
          .action-bar { background: #111827; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; margin: -40px -40px 30px -40px; border-radius: 12px 12px 0 0; }
          .btn { padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 13px; border: none; color: white; }
          .btn-back { background: #2563eb; } .btn-print { background: #10b981; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
          th { background-color: #f9fafb; font-weight: bold; font-size: 11px; text-transform: uppercase;}
          .text-right { text-align: right; }
          .badge-partial { display: inline-block; background-color: #fef3c7; color: #d97706; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-top: 4px; text-transform: uppercase; }
          .total-box { margin-top: 30px; background: #f9fafb; padding: 15px 20px; border-radius: 8px; display: flex; justify-content: space-between; font-weight: bold; }
          @media print { body { padding: 0; background: white; } .page-container { padding: 0; box-shadow: none; } .action-bar { display: none; } }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="action-bar">
            <button class="btn btn-back" onclick="window.close()">&larr; Retour</button>
            <button class="btn btn-print" onclick="window.print()">Imprimer</button>
          </div>
          <div class="header">
            <div>
              <h1 style="margin:0; font-size:22px; text-transform:uppercase;">${businessData?.businessName || 'Entreprise'}</h1>
              <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Journal des encaissements (Incluant paiements partiels)</p>
            </div>
            <div style="text-align:right; font-size:12px; color:#6b7280;">
              <p><strong>Période :</strong> ${reportStart} au ${reportEnd}</p>
              <p><strong>Édité le :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div style="font-size:18px; font-weight:bold; text-transform:uppercase; margin-bottom:20px;">Situation des encaissements</div>
          <table>
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Date règlement</th>
                <th class="text-right">Montant Encaissé</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInvoices.length > 0 ? filteredInvoices.map((inv: any) => {
                const status = getStatus(inv);
                const isPartial = isPartialPayment(status);
                const collected = getCollectedAmount(inv);
                return `
                  <tr>
                    <td>
                      ${inv.number || 'N/A'}
                      ${isPartial ? '<br><span class="badge-partial">Paiement partiel</span>' : ''}
                    </td>
                    <td><strong>${inv.clientName}</strong></td>
                    <td>${new Date(inv.date || inv.createdAt || Date.now()).toLocaleDateString('fr-FR')}</td>
                    <td class="text-right"><strong>${new Intl.NumberFormat('fr-FR').format(collected)} F CFA</strong></td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding:40px;">Aucun encaissement sur cette période.</td></tr>`}
            </tbody>
          </table>
          <div class="total-box"><span>TOTAL ENCAISSÉ :</span><span>${new Intl.NumberFormat('fr-FR').format(totalAmount)} F CFA</span></div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50/50">
        <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  const recentDocuments = activeRecentTab === "invoices" ? invoices : proformas;

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-32 md:pb-12 relative">
      
      {!isSubscribed && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3 text-center text-sm font-medium sticky top-0 z-40 shadow-sm">
          ⚠️ Votre abonnement est inactif. Certaines fonctionnalités peuvent être limitées.
        </div>
      )}

      {/* HEADER HAUT SANS LOGO (GÉRÉ PAR LA SIDEBAR) */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-sm md:text-base font-extrabold text-gray-900 hidden md:block uppercase tracking-tight whitespace-nowrap">Vue d'ensemble</h1>
          
          {/* NOUVEAU : Horloge en temps réel (date + heure) */}
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-gray-200">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-gray-700 capitalize whitespace-nowrap">{formattedDate}</span>
              <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap">{formattedTime}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto flex-shrink-0">
          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-full transition-colors relative focus:outline-none cursor-pointer"
            >
              {overdueInvoices.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {overdueInvoices.length}
                </span>
              )}
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 max-w-[90vw] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">Factures en retard</h4>
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{overdueInvoices.length} critique(s)</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {overdueInvoices.length > 0 ? (
                    overdueInvoices.map((inv: any) => (
                      <div key={inv.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-gray-800 truncate">{inv.clientName || 'Client'}</span>
                          <span className="text-xs font-black text-red-600 whitespace-nowrap">{formatCurrency(getRemainingAmount(inv))}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                          <span>Facture {inv.number || 'N/A'}</span>
                          <span className="text-red-500 font-semibold whitespace-nowrap">&gt; 30 jours de retard</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-xs font-medium">🎉 Aucune facture de plus de 30 jours en attente !</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-800 to-gray-900 text-white flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
            {businessData?.businessName ? businessData.businessName.charAt(0).toUpperCase() : "J"}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-10 space-y-8 md:space-y-10">
        
        {/* EN-TÊTE DASHBOARD */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm font-medium text-gray-500">Bonjour,</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight break-words">
              {businessData?.businessName || "JBLESS CONSULTING"}
            </h2>
            {/* Horloge visible aussi sur mobile/tablette, sous le nom de l'entreprise */}
            <p className="lg:hidden text-xs font-medium text-gray-400 mt-2 capitalize">
              {formattedDate} — <span className="font-mono">{formattedTime}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="w-full sm:w-auto text-center px-5 py-4 sm:py-3.5 bg-white text-gray-700 border border-gray-200 text-base sm:text-sm font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Éditer un journal
            </button>
            <Link 
              href="/factures/nouvelle" 
              className="w-full sm:w-auto text-center px-6 py-4 sm:py-3.5 bg-blue-600 text-white text-base sm:text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Créer une facture
            </Link>
          </div>
        </div>

        {/* CARTES KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="group bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between min-w-0">
            <div className="flex justify-between items-start mb-4 gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chiffre d'affaires (Total)</span>
              <div className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap flex-shrink-0 ${caVariation >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                {caVariation >= 0 ? '↑' : '↓'} {Math.abs(caVariation).toFixed(1)}%
              </div>
            </div>
            <p 
              className="font-extrabold text-gray-900 whitespace-nowrap overflow-hidden"
              style={{ fontSize: "clamp(1.25rem, 3.2vw, 2.25rem)" }}
              title={formatCurrency(totalRevenue)}
            >
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-gray-500 mt-3 font-medium">Factures payées et paiements partiels</p>
          </div>

          <div className="group bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between relative overflow-hidden min-w-0">
            <div className="absolute top-0 right-0 w-2 h-full bg-red-500 group-hover:w-3 transition-all duration-300"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">En attente de paiement</span>
            </div>
            <p 
              className="font-extrabold text-gray-900 whitespace-nowrap overflow-hidden"
              style={{ fontSize: "clamp(1.25rem, 3.2vw, 2.25rem)" }}
              title={formatCurrency(totalPending)}
            >
              {formatCurrency(totalPending)}
            </p>
            <div className="mt-3">
              {pendingInvoices.length > 0 ? (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg inline-block whitespace-nowrap">{pendingInvoices.length} facture(s) en attente</span>
              ) : (
                <span className="text-xs text-gray-500 font-medium">Aucune dette à recouvrer</span>
              )}
            </div>
          </div>

          <div className="group bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between min-w-0">
            <div className="mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Base clients</span>
            </div>
            <p 
              className="font-extrabold text-gray-900 whitespace-nowrap overflow-hidden"
              style={{ fontSize: "clamp(1.25rem, 3.2vw, 2.25rem)" }}
            >
              {customersCount}
            </p>
            <p className="text-xs text-gray-500 mt-3 font-medium">Clients enregistrés</p>
          </div>
        </div>

        {/* LISTES DE FACTURES ET PROFORMAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[400px]">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">À recouvrer</h3>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full min-w-[500px] text-left border-collapse">
                <thead className="bg-gray-50/80 rounded-xl">
                  <tr className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 rounded-l-xl whitespace-nowrap">Client</th>
                    <th className="px-4 py-3 whitespace-nowrap">N° Facture</th>
                    <th className="px-4 py-3 rounded-r-xl text-right whitespace-nowrap">Montant</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {pendingInvoices.length > 0 ? pendingInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-gray-50 border-b border-gray-50 group cursor-pointer transition-colors">
                      <td className="px-4 py-4 font-bold text-gray-800 whitespace-nowrap">{inv.clientName}</td>
                      <td className="px-4 py-4 font-medium text-gray-500 whitespace-nowrap">{inv.number}</td>
                      <td className="px-4 py-4 font-black text-red-600 text-right group-hover:text-red-700 whitespace-nowrap">{formatCurrency(getRemainingAmount(inv))}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-16 text-center text-gray-400 font-medium"><div className="flex flex-col items-center justify-center gap-3"><span className="text-3xl">🎉</span>Toutes vos factures sont réglées !</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[400px]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex gap-5">
                <button 
                  onClick={() => setActiveRecentTab("invoices")} 
                  className={`text-sm font-extrabold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${activeRecentTab === "invoices" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                >
                  Factures
                </button>
                <button 
                  onClick={() => setActiveRecentTab("proformas")} 
                  className={`text-sm font-extrabold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${activeRecentTab === "proformas" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                >
                  Proformas
                </button>
              </div>
              <Link href="/factures" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap">Tout voir &rarr;</Link>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full min-w-[400px] text-left border-collapse">
                <thead className="bg-gray-50/80 rounded-xl">
                  <tr className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 rounded-l-xl whitespace-nowrap">N°</th>
                    <th className="px-4 py-3 whitespace-nowrap">Client</th>
                    <th className="px-4 py-3 rounded-r-xl whitespace-nowrap">Statut</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {recentDocuments.length > 0 ? recentDocuments.slice(0, 5).map((inv: any) => {
                    const status = getStatus(inv);
                    const pending = isPending(status);
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 border-b border-gray-50 cursor-pointer transition-colors">
                        <td className="px-4 py-4 font-medium text-gray-500 whitespace-nowrap">{inv.number}</td>
                        <td className="px-4 py-4 font-bold text-gray-800 whitespace-nowrap">{inv.clientName}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase whitespace-nowrap ${
                            activeRecentTab === "proformas" ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            (pending ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')
                          }`}>
                            {activeRecentTab === "proformas" ? "EN COURS" : status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={3} className="px-4 py-16 text-center text-gray-400 font-medium">Aucun document trouvé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* GRAPHIQUE ÉVOLUTION */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Évolution de l'activité</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">Factures payées vs impayés sur 6 mois (Hors proforma)</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold whitespace-nowrap">
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-400 rounded-sm"></span> Encaissé</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-red-400 rounded-sm"></span> En attente</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-2">
            <div className="min-w-[400px] h-56 md:h-64 w-full flex items-end justify-between gap-4 md:gap-8 relative pt-6 border-b border-gray-100">
              <div className="absolute inset-x-0 top-0 border-t border-gray-100 border-dashed"></div>
              <div className="absolute inset-x-0 top-1/2 border-t border-gray-100 border-dashed"></div>
              
              {chartData.map((item, index) => {
                const revHeight = (item.revenus / maxChartValue) * 100;
                const attHeight = (item.attente / maxChartValue) * 100;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex flex-col md:flex-row items-center md:items-end justify-center gap-1 md:gap-2 h-full pb-3">
                      <div style={{ height: `${Math.max(revHeight, 2)}%` }} className="w-full max-w-[18px] md:max-w-[32px] bg-emerald-400 rounded-t-md transition-all relative">
                         <div className="hidden md:block opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap z-10 transition-opacity">{formatCurrency(item.revenus)}</div>
                      </div>
                      <div style={{ height: `${Math.max(attHeight, 2)}%` }} className="w-full max-w-[18px] md:max-w-[32px] bg-red-400 rounded-t-md transition-all relative"></div>
                    </div>
                    <span className="text-xs font-bold text-gray-400 capitalize mt-2 truncate w-full text-center">{item.mois}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL ACTIF : Édition de journal d'encaissement */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 md:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-tight">Éditer un journal</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold text-2xl cursor-pointer transition-colors">&times;</button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Date de début</label>
                <input 
                  type="date" 
                  value={reportStart} 
                  onChange={(e) => setReportStart(e.target.value)} 
                  className="w-full py-4 sm:py-3.5 px-4 border border-gray-200 rounded-xl bg-gray-50/50 text-gray-900 text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Date de fin</label>
                <input 
                  type="date" 
                  value={reportEnd} 
                  onChange={(e) => setReportEnd(e.target.value)} 
                  className="w-full py-4 sm:py-3.5 px-4 border border-gray-200 rounded-xl bg-gray-50/50 text-gray-900 text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" 
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-4 sm:py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-base sm:text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
              >
                Annuler
              </button>
              <button 
                onClick={handleGenerateReport} 
                className="px-6 py-4 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-base sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]"
              >
                Générer le rapport
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}