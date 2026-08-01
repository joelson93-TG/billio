"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../firebase";

export default function ClientsPage() {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const router = useRouter();

  // État du formulaire
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: ""
  });

  // Écouteurs en temps réel pour les clients et les factures
  useEffect(() => {
    let unsubscribeClients = () => {};
    let unsubscribeInvoices = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);

        // 1. Écoute en temps réel de la collection "customers"
        const clientsRef = collection(db, "users", currentUser.uid, "customers");
        unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
          const clientsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setClients(clientsList);
          setIsLoading(false);
        }, (error) => {
          console.error("Erreur écoute clients:", error);
          setIsLoading(false);
        });

        // 2. Écoute en temps réel de la collection "invoices"
        const invoicesRef = collection(db, "users", currentUser.uid, "invoices");
        unsubscribeInvoices = onSnapshot(invoicesRef, (snapshot) => {
          const invoicesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setInvoices(invoicesList);
        }, (error) => {
          console.error("Erreur écoute factures:", error);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeClients();
      unsubscribeInvoices();
    };
  }, [router]);

  // Fonction pour calculer le solde dû d'un client spécifique en temps réel
  const getClientBalance = (client) => {
    return invoices
      .filter(inv => {
        const clientMatches = inv.clientId === client.id || inv.clientName?.toLowerCase().trim() === client.name?.toLowerCase().trim();
        if (!clientMatches) return false;

        const status = (inv.status || inv.statut || "").toUpperCase().trim();
        return status === "EN_ATTENTE" || status === "EN ATTENTE" || status.includes("PARTIEL");
      })
      .reduce((sum, inv) => {
        const amount = Number(inv.totalTtc || inv.netAPayer || inv.total || inv.amount || inv.montant || 0);
        return sum + amount;
      }, 0);
  };

  // Ouverture du modal pour ajouter un client
  const handleOpenAddModal = () => {
    setEditingClient(null);
    setNewClient({ name: "", email: "", phone: "", address: "", taxId: "" });
    setIsModalOpen(true);
  };

  // Ouverture du modal pour modifier un client
  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setNewClient({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      taxId: client.taxId || ""
    });
    setIsModalOpen(true);
  };

  // Fonction pour enregistrer (Ajouter ou Modifier) un client
  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (editingClient) {
        // Modification
        const clientRef = doc(db, "users", user.uid, "customers", editingClient.id);
        await updateDoc(clientRef, {
          ...newClient,
          updatedAt: serverTimestamp()
        });
      } else {
        // Ajout
        const clientsRef = collection(db, "users", user.uid, "customers");
        await addDoc(clientsRef, {
          ...newClient,
          createdAt: serverTimestamp()
        });
      }
      
      setNewClient({ name: "", email: "", phone: "", address: "", taxId: "" });
      setEditingClient(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du client:", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    }
    setIsSubmitting(false);
  };

  // Fonction pour supprimer un client avec vérification stricte des impayés
  const handleDeleteClient = async (client) => {
    const balanceDue = getClientBalance(client);

    if (balanceDue > 0) {
      alert(`Suppression impossible : ${client.name} vous doit encore ${balanceDue.toLocaleString()} FCFA. Veuillez d'abord solder ses factures.`);
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${client.name} de la base ?`)) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "customers", client.id));
    } catch (error) {
      console.error("Erreur lors de la suppression du client:", error);
      alert("Une erreur est survenue lors de la suppression.");
    }
  };

  // Fonction pour imprimer la liste des clients et leurs soldes en PDF
  const handlePrintClientsPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Liste des Clients et Soldes</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; background-color: #f8fafc; }
          .page-container { background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 900px; margin: 0 auto; }
          .action-bar { background: #1e293b; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; margin: -40px -40px 30px -40px; border-top-left-radius: 12px; border-top-right-radius: 12px; }
          .btn-back { background: #3b82f6; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 13px; }
          .btn-print { background: #10b981; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 13px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .company h1 { font-size: 22px; margin: 0; color: #0f172a; text-transform: uppercase; }
          .company p { font-size: 12px; color: #64748b; margin: 4px 0 0; }
          .meta { text-align: right; font-size: 12px; color: #64748b; }
          .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 20px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          th { background-color: #f8fafc; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 11px; }
          @media print { 
            body { padding: 0; background: white; } 
            .page-container { padding: 0; box-shadow: none; }
            .action-bar { display: none; } 
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="action-bar">
            <button class="btn-back" onclick="window.close()">Fermer</button>
            <button class="btn-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
          </div>
          <div class="header">
            <div class="company">
              <h1>Répertoire des clients & Soldes dus</h1>
              <p>État financier en temps réel</p>
            </div>
            <div class="meta">
              <p><strong>Édité le :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
              <p><strong>Total clients :</strong> ${clients.length}</p>
            </div>
          </div>
          <div class="title">Annuaire & Impayés</div>
          <table>
            <thead>
              <tr>
                <th>Nom / Entreprise</th>
                <th>Contact</th>
                <th>NIF / RCCM</th>
                <th style="text-align: right; white-space: nowrap;">Solde Restant Dû</th>
              </tr>
            </thead>
            <tbody>
              ${clients.length > 0 ? clients.map(c => {
                const balance = getClientBalance(c);
                return `
                  <tr>
                    <td><strong>${c.name || 'N/A'}</strong><br><span style="color:#64748b; font-size:11px;">${c.address || ''}</span></td>
                    <td>${c.email || '—'}<br><span style="color:#64748b; font-size:11px;">${c.phone || ''}</span></td>
                    <td>${c.taxId || '—'}</td>
                    <td style="text-align: right; font-weight: bold; color: ${balance > 0 ? '#e11d48' : '#059669'}; white-space: nowrap;">
                      ${balance.toLocaleString()} FCFA
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="4" style="text-align: center; color: #94a3b8; padding: 40px;">Aucun client enregistré.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans text-gray-900">
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* En-tête adaptatif */}
        <header className="h-16 md:h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate mr-2">Vos Clients</h1>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button 
              onClick={handlePrintClientsPdf}
              className="px-3 md:px-4 py-2 md:py-2.5 bg-white text-slate-700 border border-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2"
              title="Imprimer la liste"
            >
              <svg className="w-5 h-5 md:w-4 md:h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              <span className="hidden sm:inline">Imprimer</span>
            </button>
            <button 
              onClick={handleOpenAddModal}
              className="px-3 md:px-5 py-2 md:py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30 flex items-center gap-1"
            >
              <span className="text-lg leading-none">+</span>
              <span className="hidden md:inline ml-1">Nouveau Client</span>
            </button>
          </div>
        </header>

        {/* Contenu défilable */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full">
          {clients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Aucun client trouvé</h3>
              <p className="text-gray-500 mt-2 text-sm md:text-base">Commencez par ajouter votre premier client pour pouvoir lui facturer vos services.</p>
            </div>
          ) : (
            <>
              {/* VUE MOBILE : Liste de cartes */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {clients.map((client) => {
                  const balanceDue = getClientBalance(client);
                  return (
                    <div key={client.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-gray-900 truncate">{client.name}</h4>
                          <p className="text-sm text-gray-500 truncate">{client.email || client.phone || "Aucun contact"}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                          balanceDue > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {balanceDue.toLocaleString()} FCFA
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {client.address ? client.address : "Pas d'adresse renseignée"}
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-1">
                        <span className="text-xs text-gray-400">NIF: {client.taxId || "—"}</span>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => handleOpenEditModal(client)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Modifier
                          </button>
                          <button 
                            onClick={() => handleDeleteClient(client)}
                            className="text-rose-600 hover:text-rose-800 text-sm font-medium"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VUE PC : Tableau classique */}
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      <th className="px-6 py-4">Nom / Entreprise</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">NIF / RCCM</th>
                      <th className="px-6 py-4 whitespace-nowrap">Solde Restant Dû</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clients.map((client) => {
                      const balanceDue = getClientBalance(client);
                      return (
                        <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{client.name}</div>
                            <div className="text-sm text-gray-500">{client.address}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{client.email}</div>
                            <div className="text-sm text-gray-500">{client.phone}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {client.taxId || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              balanceDue > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {balanceDue.toLocaleString()} FCFA
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 text-sm font-medium">
                              <button 
                                onClick={() => handleOpenEditModal(client)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                Modifier
                              </button>
                              <button 
                                onClick={() => handleDeleteClient(client)}
                                className="text-rose-600 hover:text-rose-800 transition-colors"
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Fenêtre Modale : Ajouter / Modifier un client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                {editingClient ? "Modifier le client" : "Ajouter un client"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveClient} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise ou du client *</label>
                <input type="text" required value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" placeholder="Ex: Entreprise ABC" />
              </div>
              
              {/* Disposition adaptative du grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={newClient.email} onChange={(e) => setNewClient({...newClient, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" placeholder="contact@abc.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" placeholder="+228 XX XX XX XX" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse postale</label>
                <input type="text" value={newClient.address} onChange={(e) => setNewClient({...newClient, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" placeholder="Quartier, Ville, Pays" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIF / RCCM (Optionnel)</label>
                <input type="text" value={newClient.taxId} onChange={(e) => setNewClient({...newClient, taxId: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" placeholder="Numéro d'Identité Fiscale" />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors w-full sm:w-auto text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 w-full sm:w-auto text-sm">
                  {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}