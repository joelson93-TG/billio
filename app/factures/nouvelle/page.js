"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { useSubscription } from "@/components/SubscriptionProvider";

export default function NewInvoicePage() {
  const router = useRouter();
  const { isExpired } = useSubscription();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [customers, setCustomers] = useState([]);
  
  // State pour le type de document
  const [documentType, setDocumentType] = useState("invoice"); // "invoice" | "proforma"
  const [allInvoicesData, setAllInvoicesData] = useState([]);

  // Champs du formulaire
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [items, setItems] = useState([
    { id: Date.now(), description: "", quantity: 1, unitPrice: 0 }
  ]);
  const [status, setStatus] = useState("EN_ATTENTE");

  // Remise, TVA et RSPS
  const [remise, setRemise] = useState(0);
  const [hasTva, setHasTva] = useState(false);
  const [tvaRate, setTvaRate] = useState(18);
  const [hasRsps, setHasRsps] = useState(false);
  const [rspsRate, setRspsRate] = useState(5);

  // Chargement initial
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

      try {
        const custSnap = await getDocs(collection(db, "users", user.uid, "customers"));
        const customersList = custSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCustomers(customersList);
        if (customersList.length > 0) {
          setSelectedClientId(customersList[0].id);
        }

        const invSnap = await getDocs(collection(db, "users", user.uid, "invoices"));
        const docs = invSnap.docs.map(d => d.data());
        setAllInvoicesData(docs);

      } catch (error) {
        console.error("Erreur lors du chargement :", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Génération dynamique et sécurisée du numéro séquentiel anti-doublon
  useEffect(() => {
    if (!currentUser || isLoading) return;
    
    const currentYear = new Date().getFullYear();
    const prefix = documentType === "proforma" ? "PRO" : "FAC";
    
    // Récupérer l'ensemble des numéros existants pour éviter les collisions
    const existingNumbers = new Set(allInvoicesData.map(inv => inv.number));

    let counter = allInvoicesData.filter(inv => {
      const type = inv.type || "invoice";
      return type === documentType;
    }).length + 1;

    let newNumber = "";
    let isUnique = false;

    // Boucle de sécurité pour s'assurer que le numéro généré n'existe pas déjà
    while (!isUnique) {
      const sequentialNum = String(counter).padStart(3, '0');
      newNumber = `${prefix}-${currentYear}-${sequentialNum}`;

      if (!existingNumbers.has(newNumber)) {
        isUnique = true;
      } else {
        counter++;
      }
    }
    
    setInvoiceNumber(newNumber);
  }, [documentType, allInvoicesData, currentUser, isLoading]);

  const { totalBrut, montantRemise, totalHt, calculatedTvaAmount, calculatedRspsAmount, totalTtc } = useMemo(() => {
    const brut = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unitPrice) || 0), 0);
    const remiseMontant = Number(remise) || 0;
    const ht = Math.max(0, brut - remiseMontant);
    const tva = hasTva ? Math.round(ht * (Number(tvaRate) / 100)) : 0;
    const rsps = hasRsps ? Math.round(ht * (Number(rspsRate) / 100)) : 0;
    const ttc = ht + tva - rsps;

    return { totalBrut: brut, montantRemise: remiseMontant, totalHt: ht, calculatedTvaAmount: tva, calculatedRspsAmount: rsps, totalTtc: ttc };
  }, [items, remise, hasTva, tvaRate, hasRsps, rspsRate]);

  const handleAddItem = () => setItems([...items, { id: Date.now(), description: "", quantity: 1, unitPrice: 0 }]);
  const handleRemoveItem = (itemId) => { if (items.length > 1) setItems(items.filter((i) => i.id !== itemId)); };
  const handleItemChange = (itemId, field, value) => setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)));

  const handleOpenPreview = (e) => {
    e.preventDefault();
    if (isExpired) {
      alert("Votre abonnement SaaS a expiré. Veuillez le renouveler pour créer de nouveaux documents.");
      return;
    }
    setShowPreview(true);
  };

  const handlePrint = () => window.print();

  const handleSubmit = async () => {
    if (isExpired) return;
    setIsSaving(true);
    const selectedCustomer = customers.find((c) => c.id === selectedClientId);

    try {
      const newInvoiceData = {
        type: documentType,
        number: invoiceNumber,
        clientId: selectedClientId,
        clientName: selectedCustomer?.name || selectedCustomer?.businessName || "Client Comptoir",
        clientNif: selectedCustomer?.nif || "",
        clientAddress: selectedCustomer?.address || "",
        clientPhone: selectedCustomer?.phone || "",
        date: invoiceDate,
        items,
        totalBrut,
        remise: montantRemise,
        totalHt,
        hasTva,
        tvaRate: Number(tvaRate),
        tvaAmount: calculatedTvaAmount,
        hasRsps,
        rspsRate: Number(rspsRate),
        rspsAmount: calculatedRspsAmount,
        totalTtc,
        status,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "users", currentUser.uid, "invoices"), newInvoiceData);
      router.push("/factures");
    } catch (error) {
      console.error("Erreur lors de la création :", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
      setShowPreview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedCustomerObj = customers.find((c) => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-16">
      <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push("/factures")} className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors cursor-pointer">
            &larr; Retour
          </button>
          <h1 className="text-xl font-bold">Nouveau Document</h1>
        </div>
        <button onClick={handleOpenPreview} disabled={isExpired} className={`px-5 py-2.5 font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer ${isExpired ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
          {isExpired ? "Abonnement requis" : "Enregistrer"}
        </button>
      </header>

      <main className="max-w-4xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-200 print:m-0 print:border-none print:shadow-none print:p-0">
        
        <form onSubmit={handleOpenPreview} className="space-y-6">
          
          {/* Sélecteur de type de document */}
          <div className="flex gap-4 p-1 bg-gray-100 rounded-xl w-max">
            <button
              type="button"
              onClick={() => setDocumentType("invoice")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${documentType === "invoice" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Facture Définitive
            </button>
            <button
              type="button"
              onClick={() => setDocumentType("proforma")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${documentType === "proforma" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Facture Proforma
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Client *</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white transition-colors cursor-pointer" required>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.businessName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Numéro</label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 text-sm font-mono font-semibold" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Date d'émission</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 text-sm" required />
            </div>
          </div>

          {/* Table des prestations */}
          <div className="pt-4 border-t">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Désignation des prestations / produits</h2>
            {items.map((item) => (
              <div key={item.id} className="flex gap-2 mb-2 items-center">
                <input type="text" value={item.description} onChange={(e) => handleItemChange(item.id, "description", e.target.value)} className="flex-1 p-2.5 border rounded-xl text-sm bg-gray-50 focus:bg-white" placeholder="Description" required />
                <input type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)} className="w-20 p-2.5 border rounded-xl text-center text-sm bg-gray-50 focus:bg-white" min="1" required />
                <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)} className="w-32 p-2.5 border rounded-xl text-right text-sm bg-gray-50 focus:bg-white" placeholder="0" required />
                <span className="w-10 text-sm font-medium text-gray-500">F</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 font-bold px-2 text-lg hover:text-red-700 cursor-pointer">&times;</button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddItem} className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-medium mt-2 transition-colors cursor-pointer">
              + Ajouter une ligne
            </button>
          </div>

          {/* Section fiscale */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t bg-gray-50 p-4 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remise (Montant F CFA)</label>
              <input type="number" min="0" value={remise} onChange={(e) => setRemise(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm" placeholder="0" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 uppercase">TVA (%)</label>
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={hasTva} onChange={(e) => setHasTva(e.target.checked)} className="rounded text-blue-600 cursor-pointer" />
                  Activer
                </label>
              </div>
              <input type="number" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} disabled={!hasTva} className="w-full p-2.5 border rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 uppercase">RSPS (%)</label>
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={hasRsps} onChange={(e) => setHasRsps(e.target.checked)} className="rounded text-blue-600 cursor-pointer" />
                  Activer
                </label>
              </div>
              <input type="number" value={rspsRate} onChange={(e) => setRspsRate(e.target.value)} disabled={!hasRsps} className="w-full p-2.5 border rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400" />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Total Brut :</span> <span>{totalBrut.toLocaleString("fr-FR")} F CFA</span></div>
              {montantRemise > 0 && <div className="flex justify-between text-red-600"><span>Remise :</span> <span>- {montantRemise.toLocaleString("fr-FR")} F CFA</span></div>}
              <div className="flex justify-between font-bold text-gray-800 pt-1 border-t"><span>Total HT :</span> <span>{totalHt.toLocaleString("fr-FR")} F CFA</span></div>
              {hasTva && <div className="flex justify-between text-gray-600"><span>TVA ({tvaRate}%) :</span> <span>{calculatedTvaAmount.toLocaleString("fr-FR")} F CFA</span></div>}
              {hasRsps && <div className="flex justify-between text-amber-700"><span>RSPS ({rspsRate}%) :</span> <span>- {calculatedRspsAmount.toLocaleString("fr-FR")} F CFA</span></div>}
              <div className="flex justify-between text-base font-extrabold pt-3 border-t border-gray-200 text-blue-600"><span>Net à Payer (TTC) :</span> <span>{totalTtc.toLocaleString("fr-FR")} F CFA</span></div>
            </div>
          </div>
        </form>
      </main>

      {/* Modal de Prévisualisation */}
      {showPreview && !isExpired && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-10 space-y-8 shadow-2xl relative my-8 border border-gray-100 print:shadow-none print:border-none print:m-0 print:w-full">
            <div className="flex justify-between items-start border-b pb-6">
              <div>
                <span className="text-2xl font-black text-blue-600 tracking-tight">
                  {documentType === "proforma" ? "FACTURE PROFORMA" : "FACTURE"}
                </span>
                <p className="text-sm font-semibold text-gray-700 mt-1">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">Date d'émission</p>
                <p className="text-sm text-gray-500">{new Date(invoiceDate).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Émetteur</p>
                <p className="font-bold text-gray-900">JBLESS CONSULTING</p>
                <p className="text-gray-500 text-xs mt-0.5">Akato non loin du catholique</p>
                <p className="text-gray-500 text-xs">Lomé, Togo</p>
                <p className="text-gray-500 text-xs mt-1">Tél : 97428298</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Facturé à :</p>
                <p className="font-bold text-gray-900">{selectedCustomerObj?.name || selectedCustomerObj?.businessName || "Client"}</p>
                {selectedCustomerObj?.address && <p className="text-xs text-gray-600 mt-0.5">{selectedCustomerObj.address}</p>}
                {selectedCustomerObj?.nif && <p className="text-xs text-gray-500 mt-0.5">NIF : {selectedCustomerObj.nif}</p>}
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-600 font-bold uppercase tracking-wider border-b">
                  <tr>
                    <th className="p-3.5">Désignation</th>
                    <th className="p-3.5 text-center">Qté</th>
                    <th className="p-3.5 text-right">Prix Unitaire</th>
                    <th className="p-3.5 text-right">Montant Brut</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-3.5 font-medium text-gray-900">{item.description || "-"}</td>
                      <td className="p-3.5 text-center">{item.quantity}</td>
                      <td className="p-3.5 text-right">{Number(item.unitPrice).toLocaleString('fr-FR')} F</td>
                      <td className="p-3.5 text-right font-bold">{(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('fr-FR')} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-80 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600"><span>Total Brut :</span><span>{totalBrut.toLocaleString('fr-FR')} F CFA</span></div>
                {montantRemise > 0 && <div className="flex justify-between text-red-600 font-medium"><span>Remise :</span><span>- {montantRemise.toLocaleString('fr-FR')} F CFA</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t"><span>Total HT :</span><span>{totalHt.toLocaleString('fr-FR')} F CFA</span></div>
                {hasTva && <div className="flex justify-between text-gray-600"><span>TVA ({tvaRate}%) :</span><span>{calculatedTvaAmount.toLocaleString('fr-FR')} F CFA</span></div>}
                {hasRsps && <div className="flex justify-between text-amber-700"><span>RSPS ({rspsRate}%) :</span><span>- {calculatedRspsAmount.toLocaleString('fr-FR')} F CFA</span></div>}
                <div className="flex justify-between text-sm font-extrabold pt-3 border-t-2 border-gray-200 text-blue-600"><span>Net à Payer (TTC) :</span><span>{totalTtc.toLocaleString('fr-FR')} F CFA</span></div>
              </div>
            </div>

            {/* Mention légale SYSCOHADA / B2B pour Proforma */}
            {documentType === "proforma" && (
              <div className="mt-8 pt-6 border-t text-[10px] text-gray-500 text-center font-medium">
                * Ce document est une facture proforma établie à titre indicatif et ne constitue pas une demande de paiement définitif. Il n'a aucune valeur comptable.
              </div>
            )}

            <div className="flex justify-between items-center pt-6 border-t print:hidden">
              <button type="button" onClick={handlePrint} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-colors cursor-pointer flex items-center gap-2">
                🖨️ Imprimer / PDF
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPreview(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-colors cursor-pointer">
                  Modifier
                </button>
                <button type="button" disabled={isSaving} onClick={handleSubmit} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm disabled:bg-blue-300 cursor-pointer">
                  {isSaving ? "Enregistrement..." : "Confirmer et Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}