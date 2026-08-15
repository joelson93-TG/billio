"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { useSubscription } from "@/components/SubscriptionProvider";

const TOAST_DURATION = 4500;

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.type === "error";
  const isWarning = toast.type === "warning";
  const accentColor = isError ? "#dc2626" : isWarning ? "#d97706" : "#16a34a";
  const title = toast.title || (isError ? "Erreur" : isWarning ? "Action refusée" : "Succès");

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" style={{ animation: "toastIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}>
      <div
        className="relative flex items-start gap-3 bg-white pl-4 pr-4 py-3.5 rounded-xl shadow-2xl border border-gray-100 w-[340px] max-w-[calc(100vw-3rem)] overflow-hidden"
        style={{ borderLeft: `4px solid ${accentColor}` }}
        role="status"
      >
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white mt-0.5"
          style={{ backgroundColor: accentColor }}
        >
          {isError || isWarning ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v3a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{toast.message}</p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="flex-shrink-0 text-gray-300 hover:text-gray-500 -mt-0.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.4 5L5 6.4 8.6 10 5 13.6 6.4 15 10 11.4 13.6 15 15 13.6 11.4 10 15 6.4 13.6 5 10 8.6z" />
          </svg>
        </button>
        <div className="absolute bottom-0 left-0 h-[3px] w-full" style={{ backgroundColor: `${accentColor}20` }}>
          <div
            className="h-full"
            style={{
              backgroundColor: accentColor,
              animation: `toastProgress ${TOAST_DURATION}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ open, invoice, onConfirm, onCancel, isDeleting }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !invoice) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-red-600" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>

        <h3 className="text-base font-bold text-gray-900 text-center mb-1">
          Supprimer ce document ?
        </h3>
        <p className="text-sm text-gray-500 text-center mb-1">
          <span className="font-semibold text-gray-700">{invoice.number}</span>
          {invoice.clientName && (
            <> — <span className="text-gray-600">{invoice.clientName}</span></>
          )}
        </p>
        <p className="text-xs text-red-600 text-center font-medium mb-5">
          ⚠️ Cette action est irréversible.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isDeleting && (
              <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {isDeleting ? "Suppression..." : "Oui, supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isInvoicePaid(status) {
  const s = (status || "").toUpperCase().trim();
  return s === "PAYÉ" || s === "PAYEE" || s === "PAID";
}

export default function InvoicesListPage() {
  const router = useRouter();
  const { isExpired } = useSubscription();
  const [currentUser, setCurrentUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [toast, setToast] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentMethodInput, setPaymentMethodInput] = useState("Espèces");
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNoteInput, setPaymentNoteInput] = useState("");

  const showToast = (message, type = "success", title) => {
    setToast({ message, type, title });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUser(user);
      fetchInvoices(user.uid);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes toastIn { from { transform: translateY(12px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const fetchInvoices = async (userId) => {
    try {
      const q = query(collection(db, "users", userId, "invoices"), orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      setInvoices(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Erreur lors de la récupération des factures :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (invoice) => {
    if (isExpired) {
      showToast("Votre période d'essai a expiré. Cette action est bloquée.", "error");
      router.push("/settings");
      return;
    }

    if (isInvoicePaid(invoice.status)) {
      showToast(
        `La facture ${invoice.number} est déjà réglée et ne peut pas être supprimée. Contactez l'administrateur si nécessaire.`,
        "warning",
        "Suppression refusée"
      );
      return;
    }

    setDeleteTarget(invoice);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "invoices", deleteTarget.id));
      setInvoices((prev) => prev.filter((inv) => inv.id !== deleteTarget.id));
      showToast(`Le document ${deleteTarget.number} a été supprimé.`, "success");
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
      showToast("Une erreur est survenue lors de la suppression.", "error");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) setDeleteTarget(null);
  };

  const handleConvertToInvoice = async (invoice) => {
    if (isExpired) {
      showToast("Votre période d'essai a expiré. Cette action est bloquée.", "error");
      router.push("/settings");
      return;
    }

    if (confirm("Voulez-vous transformer ce proforma en facture définitive ?")) {
      try {
        const existingNumbers = new Set(invoices.map((inv) => inv.number));
        let baseNum = invoice.number ? invoice.number.replace(/^PRO/i, "FAC") : `FAC-001`;
        let newNumber = baseNum;
        let counter = 1;

        while (existingNumbers.has(newNumber)) {
          const match = baseNum.match(/^(.*?)(\d+)$/);
          if (match) {
            const [, prefixPart, numPart] = match;
            const incremented = (parseInt(numPart, 10) + counter).toString().padStart(numPart.length, "0");
            newNumber = `${prefixPart}${incremented}`;
          } else {
            newNumber = `${baseNum}-${counter}`;
          }
          counter++;
        }

        const docRef = doc(db, "users", currentUser.uid, "invoices", invoice.id);
        const updatedData = { type: "FACTURE", number: newNumber, status: "EN_ATTENTE" };
        await updateDoc(docRef, updatedData);
        setInvoices(invoices.map((inv) => inv.id === invoice.id ? { ...inv, ...updatedData } : inv));
        showToast("Le proforma a été converti en facture avec succès !", "success");
      } catch (error) {
        console.error("Erreur lors de la conversion :", error);
        showToast("Une erreur est survenue lors de la conversion.", "error");
      }
    }
  };

  const openPaymentModal = (invoice) => {
    if (isExpired) {
      showToast("Votre période d'essai a expiré. L'encaissement est bloqué.", "error");
      router.push("/settings");
      return;
    }
    const totalDu = Number(invoice.netAPayer || invoice.totalTtc || 0);
    const paymentsList = invoice.payments || [];
    const totalDejaPaye = paymentsList.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const resteAPayer = Math.max(0, totalDu - totalDejaPaye);
    setSelectedInvoice(invoice);
    setPaymentAmountInput(resteAPayer);
    setPaymentMethodInput("Espèces");
    setPaymentDateInput(new Date().toISOString().split("T")[0]);
    setPaymentNoteInput("");
    setShowPaymentModal(true);
  };

  const handleAddPaymentSubmit = async (e) => {
    e.preventDefault();
    if (isExpired || !selectedInvoice) return;

    const amountPaid = Number(paymentAmountInput);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      showToast("Veuillez entrer un montant valide.", "error");
      return;
    }

    const totalDu = Number(selectedInvoice.netAPayer || selectedInvoice.totalTtc || 0);
    const paymentsList = selectedInvoice.payments || [];
    const totalDejaPaye = paymentsList.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const newTotalPaid = totalDejaPaye + amountPaid;

    const newPayment = {
      id: Date.now(),
      amount: amountPaid,
      method: paymentMethodInput,
      date: paymentDateInput,
      note: paymentNoteInput,
    };

    const updatedPayments = [...paymentsList, newPayment];
    const newStatus = newTotalPaid >= totalDu ? "PAYÉ" : "PARTIEL";

    try {
      const docRef = doc(db, "users", currentUser.uid, "invoices", selectedInvoice.id);
      await updateDoc(docRef, { payments: updatedPayments, status: newStatus });
      setInvoices(invoices.map((inv) =>
        inv.id === selectedInvoice.id ? { ...inv, payments: updatedPayments, status: newStatus } : inv
      ));
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      showToast("Encaissement enregistré avec succès !", "success");
    } catch (error) {
      console.error("Erreur enregistrement paiement :", error);
      showToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  const getStatusBadge = (status) => {
    switch ((status || "").toUpperCase().trim()) {
      case "PAYÉ":
      case "PAYEE":
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold whitespace-nowrap">Payé</span>;
      case "PARTIEL":
      case "PARTIELLE":
        return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold whitespace-nowrap">Partiel</span>;
      case "EN_ATTENTE":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold whitespace-nowrap">En attente</span>;
      case "RETARD":
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold whitespace-nowrap">En retard</span>;
      case "ANNULÉ":
      case "ANNULEE":
        return <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-bold whitespace-nowrap">Annulé</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold whitespace-nowrap">{status || "En attente"}</span>;
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (startDate || endDate) {
      const invoiceDate = invoice.date ? invoice.date.split("T")[0] : "";
      if (!invoiceDate) return false;
      if (startDate && invoiceDate < startDate) return false;
      if (endDate && invoiceDate > endDate) return false;
    }
    return true;
  });

  const activeTotalDu = selectedInvoice ? Number(selectedInvoice.netAPayer || selectedInvoice.totalTtc || 0) : 0;
  const activeTotalDejaPaye = selectedInvoice?.payments
    ? selectedInvoice.payments.reduce((acc, p) => acc + Number(p.amount || 0), 0) : 0;
  const activeResteAPayer = Math.max(0, activeTotalDu - activeTotalDejaPaye);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <style>{`
        @keyframes toastIn { from { transform: translateY(12px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
      `}</style>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        invoice={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
      />

      <div className="max-w-7xl mx-auto">

        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour au Dashboard
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Factures & Proformas</h1>
            <p className="text-gray-500 mt-1">Gérez vos documents et suivez vos paiements.</p>
          </div>
          <Link
            href="/factures/nouvelle"
            onClick={(e) => {
              if (isExpired) {
                e.preventDefault();
                showToast("Votre période d'essai a expiré. Veuillez renouveler votre abonnement.", "error");
                router.push("/settings");
              }
            }}
            className={`px-6 py-3 rounded-xl font-semibold shadow-sm transition-colors text-center ${
              isExpired ? "bg-gray-400 text-white cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            + Créer une facture
          </Link>
        </div>

        <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center flex-1 w-full bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par numéro ou client..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>Du :</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-xl bg-gray-50 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>Au :</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-xl bg-gray-50 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-xs font-semibold text-red-600 hover:text-red-800 underline px-1"
                title="Effacer les filtres de date"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold whitespace-nowrap">N° Document</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Date</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Client</th>
                  <th className="p-4 font-semibold text-right whitespace-nowrap">Montant (FCFA)</th>
                  <th className="p-4 font-semibold text-center whitespace-nowrap">Statut</th>
                  <th className="p-4 font-semibold text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => {
                    const isProforma = invoice.type === "PROFORMA" || (invoice.number && invoice.number.toUpperCase().startsWith("PRO"));
                    const isPaid = isInvoicePaid(invoice.status);

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {invoice.number}
                            {isProforma && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] uppercase font-extrabold tracking-wider whitespace-nowrap">
                                Proforma
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(invoice.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-800 whitespace-nowrap">
                          {invoice.clientName}
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                          {Number(invoice.netAPayer || invoice.totalTtc || 0).toLocaleString("fr-FR")}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-3 flex-nowrap">

                            {isProforma ? (
                              <button
                                onClick={() => handleConvertToInvoice(invoice)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap ${
                                  isExpired ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white"
                                }`}
                                title="Transformer ce proforma en facture définitive"
                              >
                                Convertir
                              </button>
                            ) : !isPaid ? (
                              <button
                                onClick={() => openPaymentModal(invoice)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap ${
                                  isExpired ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"
                                }`}
                              >
                                Encaisser
                              </button>
                            ) : (
                              <div className="px-3 py-1.5 opacity-0 pointer-events-none text-xs select-none whitespace-nowrap">
                                Encaisser
                              </div>
                            )}

                            <Link
                              href={`/factures/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-semibold whitespace-nowrap"
                            >
                              Voir / Éditer
                            </Link>

                            {isPaid ? (
                              <span
                                className="text-sm font-semibold whitespace-nowrap text-gray-300 cursor-not-allowed select-none"
                                title="Impossible de supprimer une facture réglée"
                              >
                                🔒 Supprimer
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDeleteClick(invoice)}
                                className={`text-sm font-semibold whitespace-nowrap ${
                                  isExpired ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:text-red-700"
                                }`}
                                title="Supprimer ce document"
                              >
                                Supprimer
                              </button>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      Aucun document trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Encaisser : {selectedInvoice.number}</h3>
                <p className="text-xs text-gray-500">{selectedInvoice.clientName}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl text-sm space-y-1">
              <p className="flex justify-between">
                <span className="font-semibold text-gray-600">Total Dû :</span>
                <span>{activeTotalDu.toLocaleString("fr-FR")} FCFA</span>
              </p>
              <p className="flex justify-between">
                <span className="font-semibold text-gray-600">Déjà payé :</span>
                <span>{activeTotalDejaPaye.toLocaleString("fr-FR")} FCFA</span>
              </p>
              <div className="border-t my-1 pt-1"></div>
              <p className="flex justify-between text-blue-700 font-bold">
                <span>Reste à payer :</span>
                <span>{activeResteAPayer.toLocaleString("fr-FR")} FCFA</span>
              </p>
            </div>

            <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Montant payé (FCFA)</label>
                <input
                  type="number"
                  max={activeResteAPayer}
                  min="1"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Mode de règlement</label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Virement">Virement bancaire</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Date</label>
                  <input
                    type="date"
                    value={paymentDateInput}
                    onChange={(e) => setPaymentDateInput(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Note / Référence (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Réf virement ou reçu..."
                  value={paymentNoteInput}
                  onChange={(e) => setPaymentNoteInput(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                  Valider l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}