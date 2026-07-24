"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useSubscription } from "@/components/SubscriptionProvider"; 

export default function InvoicesListPage() {
  const router = useRouter();
  const { isExpired } = useSubscription(); 
  const [currentUser, setCurrentUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentMethodInput, setPaymentMethodInput] = useState("Espèces");
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNoteInput, setPaymentNoteInput] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);
      fetchInvoices(user.uid);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchInvoices = async (userId) => {
    try {
      const q = query(
        collection(db, "users", userId, "invoices"),
        orderBy("date", "desc")
      );
      const querySnapshot = await getDocs(q);
      
      const invoicesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setInvoices(invoicesData);
    } catch (error) {
      console.error("Erreur lors de la récupération des factures :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (invoiceId) => {
    if (isExpired) {
      alert("Votre période d'essai a expiré. Cette action est bloquée.");
      router.push("/settings");
      return;
    }

    if (confirm("Êtes-vous sûr de vouloir supprimer ce document définitivement ?")) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "invoices", invoiceId));
        setInvoices(invoices.filter((inv) => inv.id !== invoiceId));
      } catch (error) {
        console.error("Erreur lors de la suppression :", error);
        alert("Une erreur est survenue lors de la suppression.");
      }
    }
  };

  const handleConvertToInvoice = async (invoice) => {
    if (isExpired) {
      alert("Votre période d'essai a expiré. Cette action est bloquée.");
      router.push("/settings");
      return;
    }

    if (confirm("Voulez-vous transformer ce proforma en facture définitive ?")) {
      try {
        // Génération d'un numéro de facture séquentiel et unique
        const existingNumbers = new Set(invoices.map((inv) => inv.number));
        let baseNum = invoice.number ? invoice.number.replace(/^PRO/i, "FAC") : `FAC-001`;
        let newNumber = baseNum;
        let counter = 1;

        while (existingNumbers.has(newNumber)) {
          const match = baseNum.match(/^(.*?)(\d+)$/);
          if (match) {
            const [, prefixPart, numPart] = match;
            const incremented = (parseInt(numPart, 10) + counter).toString().padStart(numPart.length, '0');
            newNumber = `${prefixPart}${incremented}`;
          } else {
            newNumber = `${baseNum}-${counter}`;
          }
          counter++;
        }
        
        const docRef = doc(db, "users", currentUser.uid, "invoices", invoice.id);
        const updatedData = {
          type: "FACTURE",
          number: newNumber,
          status: "EN_ATTENTE",
        };

        await updateDoc(docRef, updatedData);

        setInvoices(invoices.map((inv) => {
          if (inv.id === invoice.id) {
            return { ...inv, ...updatedData };
          }
          return inv;
        }));

        alert("Le proforma a été converti en facture avec succès !");
      } catch (error) {
        console.error("Erreur lors de la conversion :", error);
        alert("Une erreur est survenue lors de la conversion du document.");
      }
    }
  };

  const openPaymentModal = (invoice) => {
    if (isExpired) {
      alert("Votre période d'essai a expiré. L'encaissement est bloqué.");
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
    if (isExpired) return;
    if (!selectedInvoice) return;

    const amountPaid = Number(paymentAmountInput);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      alert("Veuillez entrer un montant valide.");
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
    
    let newStatus = "PARTIEL";
    if (newTotalPaid >= totalDu) {
      newStatus = "PAYÉ";
    }

    try {
      const docRef = doc(db, "users", currentUser.uid, "invoices", selectedInvoice.id);
      await updateDoc(docRef, {
        payments: updatedPayments,
        status: newStatus,
      });

      setInvoices(invoices.map((inv) => {
        if (inv.id === selectedInvoice.id) {
          return { ...inv, payments: updatedPayments, status: newStatus };
        }
        return inv;
      }));

      setShowPaymentModal(false);
      setSelectedInvoice(null);
      alert("Encaissement enregistré avec succès !");
    } catch (error) {
      console.error("Erreur enregistrement paiement :", error);
      alert("Erreur lors de l'enregistrement.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PAYÉ":
      case "PAYEE":
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Payé</span>;
      case "PARTIEL":
      case "PARTIELLE":
        return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">Partiel</span>;
      case "EN_ATTENTE":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">En attente</span>;
      case "RETARD":
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">En retard</span>;
      case "ANNULÉ":
        return <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-bold">Annulé</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">{status || "En attente"}</span>;
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
  const activeTotalDejaPaye = selectedInvoice?.payments ? selectedInvoice.payments.reduce((acc, p) => acc + Number(p.amount || 0), 0) : 0;
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
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors"
          >
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
                alert("Votre période d'essai a expiré. Veuillez renouveler votre abonnement.");
                router.push("/settings");
              }
            }}
            className={`px-6 py-3 rounded-xl font-semibold shadow-sm transition-colors text-center ${
              isExpired ? "bg-gray-400 text-white cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            + Nouveau Document
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
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="p-2 border rounded-xl bg-gray-50 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>Au :</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="p-2 border rounded-xl bg-gray-50 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">N° Document</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Client</th>
                  <th className="p-4 font-semibold text-right">Montant (FCFA)</th>
                  <th className="p-4 font-semibold text-center">Statut</th>
                  <th className="p-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => {
                    const isProforma = invoice.type === "PROFORMA" || (invoice.number && invoice.number.toUpperCase().startsWith("PRO"));

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm font-bold text-gray-900 flex items-center gap-2">
                          {invoice.number}
                          {isProforma && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] uppercase font-extrabold tracking-wider">
                              Proforma
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(invoice.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-800">
                          {invoice.clientName}
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-900 text-right">
                          {Number(invoice.netAPayer || invoice.totalTtc || 0).toLocaleString("fr-FR")}
                        </td>
                        <td className="p-4 text-center">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            {isProforma ? (
                              <button
                                onClick={() => handleConvertToInvoice(invoice)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                                  isExpired ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white"
                                }`}
                                title="Transformer ce proforma en facture définitive"
                              >
                                Convertir
                              </button>
                            ) : invoice.status !== "PAYÉ" && invoice.status !== "PAYEE" ? (
                              <button
                                onClick={() => openPaymentModal(invoice)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                                  isExpired ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"
                                }`}
                              >
                                Encaisser
                              </button>
                            ) : (
                              <div className="px-3 py-1.5 opacity-0 pointer-events-none text-xs font-semibold select-none">
                                Encaisser
                              </div>
                            )}
                            
                            <Link 
                              href={`/factures/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                            >
                              Voir / Éditer
                            </Link>
                            
                            <button 
                              onClick={() => handleDelete(invoice.id)}
                              className={`text-sm font-semibold ${isExpired ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:text-red-700"}`}
                            >
                              Supprimer
                            </button>
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
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl text-sm space-y-1">
              <p className="flex justify-between"><span className="font-semibold text-gray-600">Total Dû :</span> <span>{activeTotalDu.toLocaleString("fr-FR")} FCFA</span></p>
              <p className="flex justify-between"><span className="font-semibold text-gray-600">Déjà payé :</span> <span>{activeTotalDejaPaye.toLocaleString("fr-FR")} FCFA</span></p>
              <div className="border-t my-1 pt-1"></div>
              <p className="flex justify-between text-blue-700 font-bold"><span className="font-semibold">Reste à payer :</span> <span>{activeResteAPayer.toLocaleString("fr-FR")} FCFA</span></p>
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