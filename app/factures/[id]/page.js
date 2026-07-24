"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../../firebase";

// Fonction utilitaire pour convertir un nombre en toutes lettres en français
function numberToWords(num) {
  if (num === null || num === undefined || isNaN(num)) return "0 (0) Franc CFA";
  if (num === 0) return "Zéro (0) Franc CFA";

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

  function convertLessThanThousand(n) {
    let str = "";
    if (n >= 100) {
      const hundred = Math.floor(n / 100);
      if (hundred === 1) str += "cent ";
      else str += units[hundred] + " cent" + (n % 100 === 0 && hundred > 1 ? "s " : " ");
      n %= 100;
    }
    if (n >= 20) {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      if (ten === 7 || ten === 9) {
        str += tens[ten - 1] + (unit === 1 ? (ten === 7 ? " et onze" : "-onze") : "-" + teens[unit]);
      } else if (ten === 8) {
        str += "quatre-vingt" + (unit === 0 ? "s" : "-" + units[unit]);
      } else {
        str += tens[ten] + (unit === 1 ? " et un" : unit > 0 ? "-" + units[unit] : "");
      }
    } else if (n >= 10) {
      str += teens[n - 10];
    } else if (n > 0) {
      str += units[n];
    }
    return str.trim();
  }

  function convert(n) {
    if (n === 0) return "zéro";
    let result = "";

    if (Math.floor(n / 1000000000) > 0) {
      const billions = Math.floor(n / 1000000000);
      result += (billions === 1 ? "un milliard" : convertLessThanThousand(billions) + " milliards") + " ";
      n %= 1000000000;
    }

    if (Math.floor(n / 1000000) > 0) {
      const millions = Math.floor(n / 1000000);
      result += (millions === 1 ? "un million" : convertLessThanThousand(millions) + " millions") + " ";
      n %= 1000000;
    }

    if (Math.floor(n / 1000) > 0) {
      const thousands = Math.floor(n / 1000);
      result += (thousands === 1 ? "mille" : convertLessThanThousand(thousands) + " mille") + " ";
      n %= 1000;
    }

    if (n > 0) {
      result += convertLessThanThousand(n);
    }

    return result.trim();
  }

  const words = convert(num);
  const capitalizedWords = words.charAt(0).toUpperCase() + words.slice(1);
  const formattedNumber = num.toLocaleString("fr-FR");

  return `${capitalizedWords} (${formattedNumber}) Francs CFA`;
}

function getStatusBadge(status) {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "PAYEE":
    case "PAYÉ":
      return { label: "🟢 Payée", style: "bg-green-100 text-green-700" };
    case "PARTIELLE":
      return { label: "🟠 Partielle", style: "bg-orange-100 text-orange-700" };
    case "ANNULEE":
    case "ANNULÉ":
      return { label: "🔴 Annulée", style: "bg-red-100 text-red-700" };
    case "EN_ATTENTE":
    default:
      return { label: "🟡 En attente", style: "bg-yellow-100 text-yellow-700" };
  }
}

export default function InvoiceDetailOrEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isSubscribed = true; 

  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState({});
  const [customers, setCustomers] = useState([]);

  // NOUVEAU: État pour gérer le type de document
  const [invoiceType, setInvoiceType] = useState("FACTURE"); 
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("EN_ATTENTE");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [items, setItems] = useState([]);
  const [mainOeuvre, setMainOeuvre] = useState(0);
  const [remise, setRemise] = useState(0);
  const [applyTva, setApplyTva] = useState(false);
  const [applyRsps, setApplyRsps] = useState(false);
  const [rspsRate, setRspsRate] = useState(1);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

      try {
        const custSnap = await getDocs(collection(db, "users", user.uid, "customers"));
        const fetchedCustomers = custSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCustomers(fetchedCustomers);

        const docRef = doc(db, "users", user.uid, "invoices", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setInvoice({ id: docSnap.id, ...data });
          
          setInvoiceType(data.type || "FACTURE"); // Récupère le type ou met "FACTURE" par défaut
          setInvoiceNumber(data.number || "");
          setInvoiceDate(data.date || "");
          setInvoiceStatus(data.status || "EN_ATTENTE");
          setPaymentDate(data.paymentDate || new Date().toISOString().split("T")[0]);
          setPaymentMethod(data.paymentMethod || "Espèces");
          setSelectedClientId(data.clientId || "");
          setItems(data.items || []);
          setMainOeuvre(data.mainOeuvre || 0);
          setRemise(data.remise || 0);
          setApplyTva(data.hasTva ?? false);
          setApplyRsps(data.applyRsps ?? false);
          setRspsRate(data.rspsRate || 1);
        } else {
          router.push("/factures");
        }

        const compSnap = await getDoc(doc(db, "users", user.uid, "settings", "company"));
        if (compSnap.exists()) {
          setCompany(compSnap.data());
        }

      } catch (error) {
        console.error("Erreur :", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, router]);

  const totalAchat = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unitPrice) || 0), 0);
  const montantRemise = Number(remise) || 0;
  const totalHorsTaxe = Math.max(0, totalAchat + Number(mainOeuvre) - montantRemise);
  const tvaAmount = applyTva ? Math.round(totalHorsTaxe * 0.18) : 0;
  const totalTtc = totalHorsTaxe + tvaAmount;
  const rspsAmount = applyRsps ? Math.round(totalHorsTaxe * (Number(rspsRate) / 100)) : 0;
  const netAPayer = totalTtc - rspsAmount;

  const handleAddItem = () => setItems([...items, { id: Date.now(), description: "", quantity: 1, unitPrice: 0 }]);
  const handleRemoveItem = (itemId) => items.length > 1 && setItems(items.filter((i) => i.id !== itemId));
  const handleItemChange = (itemId, field, value) => setItems(items.map((i) => i.id === itemId ? { ...i, [field]: value } : i));

  const currentCustomer = customers.find((c) => c.id === (selectedClientId || invoice?.clientId));
  const clientNifDisplay = currentCustomer?.taxId || currentCustomer?.nif || invoice?.clientNif || invoice?.taxId || "N/A";

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const selectedCustomer = customers.find((c) => c.id === selectedClientId);

    try {
      const docRef = doc(db, "users", currentUser.uid, "invoices", id);
      const isPaidOrPartial = invoiceStatus === "PAYEE" || invoiceStatus === "PAYÉ" || invoiceStatus === "PARTIELLE";

      const updatedData = {
        type: invoiceType, // Enregistrement du type
        number: invoiceNumber,
        status: invoiceStatus,
        paymentDate: isPaidOrPartial ? paymentDate : "",
        paymentMethod: isPaidOrPartial ? paymentMethod : "",
        clientId: selectedClientId,
        clientName: selectedCustomer?.name || selectedCustomer?.businessName || invoice.clientName,
        clientNif: selectedCustomer?.taxId || selectedCustomer?.nif || "", 
        taxId: selectedCustomer?.taxId || "",
        clientAddress: selectedCustomer?.address || "",
        clientPhone: selectedCustomer?.phone || "",
        date: invoiceDate,
        items,
        mainOeuvre: Number(mainOeuvre),
        remise: montantRemise,
        totalAchat,
        totalHorsTaxe,
        tvaAmount,
        totalTtc,
        hasTva: applyTva,
        applyRsps,
        rspsRate: Number(rspsRate),
        rspsAmount,
        netAPayer,
      };

      await updateDoc(docRef, updatedData);
      setInvoice({ id, ...updatedData });
      setIsEditing(false);
      alert("Document mis à jour avec succès !");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Voulez-vous vraiment supprimer ce document ?")) {
      await deleteDoc(doc(db, "users", currentUser.uid, "invoices", id));
      router.push("/factures");
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const docName = invoice.type === "PROFORMA" ? "Proforma" : "Facture";
    document.title = `${docName}_${invoice.number}_${invoice.clientName || "Client"}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-12 w-12 border-t-2 border-blue-600 rounded-full"></div></div>;
  if (!invoice) return null;

  const brandColor = company.primaryColor || "#2563eb";
  const montantArrete = applyRsps ? netAPayer : totalTtc;
  const currentStatusBadge = getStatusBadge(invoice.status);
  
  // Constante pour l'affichage conditionnel
  const isProforma = invoice.type === "PROFORMA";

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-16">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 4mm; size: A4 portrait; }
          body { font-size: 10.5px; background: white !important; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <header className="print-hidden min-h-[5rem] bg-white border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between p-4 md:px-8 sticky top-0 z-10 shadow-sm gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <Link href="/factures" className="px-3 py-2 md:py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
            &larr; <span className="hidden sm:inline">Retour</span>
          </Link>
          <h1 className="text-lg md:text-xl font-bold truncate max-w-[200px] sm:max-w-xs">
            {isProforma ? "Proforma" : "Facture"} {invoice.number}
          </h1>
          <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap ${currentStatusBadge.style}`}>
            {currentStatusBadge.label}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none px-3 md:px-4 py-2 text-white rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700">
                Modifier
              </button>
              <button onClick={handlePrint} className="flex-1 md:flex-none px-3 md:px-4 py-2 text-white rounded-xl text-sm font-medium shadow-md" style={{ backgroundColor: brandColor }}>
                PDF / Imprimer
              </button>
              <button onClick={handleDelete} className="flex-1 md:flex-none px-3 py-2 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50">
                Supprimer
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(false)} className="w-full md:w-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-sm font-medium transition-colors">
              Annuler
            </button>
          )}
        </div>
      </header>

      {!isEditing && (invoice.status === "PAYEE" || invoice.status === "PAYÉ" || invoice.status === "PARTIELLE") && (
        <div className="print-hidden max-w-3xl mx-4 md:mx-auto mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div>
            <span className="font-bold">Facture réglée</span> le {invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR")} via <span className="font-semibold">{invoice.paymentMethod || "Espèces"}</span>.
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-4 md:mx-auto mt-6 print:mt-0 bg-white p-4 md:p-6 print:p-1.5 rounded-2xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:w-full">
        {!isEditing ? (
          <div className="relative flex flex-col justify-between md:h-[285mm] print:h-[285mm] min-h-[600px]">
            <div className="space-y-3 md:space-y-2 print:space-y-1.5">
              {company.logoUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 select-none z-0">
                  <img src={company.logoUrl} alt="Filigrane" className="w-full md:w-2/3 max-w-md object-contain grayscale" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 border-b pb-3 md:pb-2 items-center relative z-10">
                <div className="bg-gray-100 border border-gray-200 p-2 rounded-lg flex items-center justify-center min-h-[80px] print:min-h-[55px] w-full">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt="Logo" className="w-full h-full max-h-16 print:max-h-10 object-contain" />
                  ) : (
                    <span className="text-xl font-black tracking-wider text-gray-800 text-center">{company.companyName || "LOGO"}</span>
                  )}
                </div>
                <div className="border-l-4 pl-4" style={{ borderColor: brandColor }}>
                  <h3 className="font-bold uppercase text-xs mb-1" style={{ color: brandColor }}>Nos Services</h3>
                  <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{company.services}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 relative z-10 gap-2">
                <div className="text-white px-3 py-1.5 md:px-4 md:py-1 rounded font-bold text-xs shadow-sm w-full sm:w-auto text-center sm:text-left" style={{ backgroundColor: brandColor }}>
                  {isProforma ? "PROFORMA" : "FACTURE"} N° {invoice.number} / {company.companyName || "Société"} / {new Date(invoice.date).getFullYear() || new Date().getFullYear()}
                </div>
                <div className="w-full sm:w-auto text-right italic text-xs font-medium">
                  {company.city ? `${company.city}, le ` : "Fait le "} {new Date(invoice.date).toLocaleDateString("fr-FR")}
                </div>
              </div>

              <div className="flex justify-start sm:justify-end print:justify-end relative z-10 mt-2 md:mt-1">
                <div className="w-full sm:w-60 print:w-60 border border-gray-300 bg-gray-100/90 p-3 md:p-2 text-sm md:text-xs space-y-1 md:space-y-0.5 rounded-lg shadow-sm">
                  <p className="font-bold text-gray-900">DOIT : {invoice.clientName}</p>
                  <p className="text-gray-700">NIF : {clientNifDisplay}</p>
                  <p className="text-gray-700">Adresse : {invoice.clientAddress || currentCustomer?.address || "Zone franche"}</p>
                  <p className="text-gray-700">Tel : {invoice.clientPhone || currentCustomer?.phone || "---"}</p>
                </div>
              </div>

              <div className="relative z-10 mt-3 md:mt-1 overflow-x-auto pb-2">
                <table className="w-full text-left text-xs border-collapse border border-gray-400 bg-white/60 min-w-[500px] print:min-w-0">
                  <thead>
                    <tr className="bg-gray-200 border border-gray-400 text-gray-800 font-bold">
                      <th className="p-2 md:p-1 border border-gray-400">Descriptions</th>
                      <th className="p-2 md:p-1 border border-gray-400 text-center w-12">Qté</th>
                      <th className="p-2 md:p-1 border border-gray-400 text-right w-24">Pu</th>
                      <th className="p-2 md:p-1 border border-gray-400 text-right w-28">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item, idx) => (
                      <tr key={idx} className="border border-gray-300">
                        <td className="p-2 md:p-1 border border-gray-300">{item.description}</td>
                        <td className="p-2 md:p-1 border border-gray-300 text-center">{item.quantity}</td>
                        <td className="p-2 md:p-1 border border-gray-300 text-right">{Number(item.unitPrice).toLocaleString("fr-FR")}</td>
                        <td className="p-2 md:p-1 border border-gray-300 text-right font-medium">
                          {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                    
                    <tr className="border border-gray-400 font-bold bg-gray-50/80">
                      <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right">TOTAL GENERAL</td>
                      <td className="p-2 md:p-1 border border-gray-400 text-right">{totalAchat.toLocaleString("fr-FR")}</td>
                    </tr>
                    
                    {mainOeuvre > 0 && (
                      <tr className="border border-gray-400 font-bold bg-gray-50/80">
                        <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right">MAIN D'OEUVRE</td>
                        <td className="p-2 md:p-1 border border-gray-400 text-right">{Number(mainOeuvre).toLocaleString("fr-FR")}</td>
                      </tr>
                    )}

                    {montantRemise > 0 && (
                      <tr className="border border-gray-400 font-bold bg-gray-50/80">
                        <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right text-red-600">REMISE</td>
                        <td className="p-2 md:p-1 border border-gray-400 text-right text-red-600">- {montantRemise.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}

                    <tr className="border border-gray-400 font-bold bg-gray-100/80">
                      <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right">TOTAL HORS TAXE</td>
                      <td className="p-2 md:p-1 border border-gray-400 text-right">{totalHorsTaxe.toLocaleString("fr-FR")}</td>
                    </tr>
                    
                    {applyTva && (
                      <tr className="border border-gray-400 font-bold bg-gray-50/80">
                        <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right">TVA (18%)</td>
                        <td className="p-2 md:p-1 border border-gray-400 text-right">{tvaAmount.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}

                    <tr className="border border-gray-400 font-extrabold text-xs md:text-[13px] bg-gray-200/90">
                      <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right">MONTANT TTC</td>
                      <td className="p-2 md:p-1 border border-gray-400 text-right">{totalTtc.toLocaleString("fr-FR")}</td>
                    </tr>

                    {applyRsps && (
                      <tr className="border border-gray-400 font-bold bg-gray-50/80">
                        <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right text-red-600">RSPS ({rspsRate}%)</td>
                        <td className="p-2 md:p-1 border border-gray-400 text-right text-red-600">- {rspsAmount.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}

                    {applyRsps && (
                      <tr className="border border-gray-400 font-extrabold text-xs md:text-[13px] bg-gray-300">
                        <td colSpan="3" className="p-2 md:p-1 border border-gray-400 text-right">NET À PAYER</td>
                        <td className="p-2 md:p-1 border border-gray-400 text-right">{netAPayer.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-sm md:text-xs italic font-medium relative z-10 pt-2 md:pt-1">
                Arrêté à la somme de : <br className="block md:hidden"/> 
                <span className="font-bold underline">{numberToWords(montantArrete)}</span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end relative z-10 pt-4 md:pt-1 gap-4">
                <div className="text-xs md:text-[10px] text-gray-500">
                  {(invoice.status === "PAYEE" || invoice.status === "PAYÉ") && (
                    <p className="border border-green-500 text-green-700 px-3 py-1.5 md:px-2 md:py-1 rounded inline-block font-bold">
                      ✓ Réglé par {invoice.paymentMethod || "Espèces"} le {invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <div className="text-center w-full sm:w-auto mt-4 sm:mt-0">
                  <p className="font-bold text-xs md:text-[11px] underline mb-1 md:mb-0.5">LE RESPONSABLE</p>
                  <div className="w-full sm:w-24 h-16 md:h-12 border border-dashed border-gray-300 bg-white/50 rounded-lg flex items-center justify-center text-[10px] md:text-[9px] text-gray-400 italic">
                    Cachet & Signature
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t-2 pt-3 md:pt-1.5 mt-8 md:mt-auto space-y-1 md:space-y-0.5 text-[10px] md:text-[9px] text-center text-gray-600 relative z-10 bg-white" style={{ borderColor: brandColor }}>
              <p className="font-bold text-gray-900 text-sm md:text-xs">{company.companyName}</p>
              <div className="flex justify-center gap-x-4 gap-y-1 flex-wrap font-medium">
                {company.address && <span>📍 {company.address}</span>}
                {company.phone && <span>📞 {company.phone}</span>}
                {company.email && <span>✉️ {company.email}</span>}
                {company.website && <span>🌐 {company.website}</span>}
              </div>
              <p className="tracking-tight mt-1 md:mt-0">
                NIF : {company.nif || "---"} | RCCM : {company.rccm || "---"} | N° CNSS : {company.cnss || "---"}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-6 md:space-y-6">
            <h2 className="text-lg md:text-xl font-bold border-b pb-4">Modifier le document</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Type de Document</label>
                <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="FACTURE">Facture</option>
                  <option value="PROFORMA">Proforma</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Client</label>
                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" required>
                  <option value="" disabled>Sélectionner un client</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name || c.businessName}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">N° Document</label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Statut</label>
                <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="EN_ATTENTE">En attente de règlement</option>
                  <option value="PAYEE">Payée</option>
                  <option value="PARTIELLE">Partiellement payée</option>
                  <option value="ANNULEE">Annulée</option>
                </select>
              </div>
            </div>

            {(invoiceStatus === "PAYEE" || invoiceStatus === "PAYÉ" || invoiceStatus === "PARTIELLE") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50 rounded-xl border border-green-200">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-green-800">Date de paiement</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-3 border rounded-lg bg-white" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-green-800">Moyen de paiement</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-3 border rounded-lg bg-white">
                    <option value="Espèces">Espèces</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-2">Lignes de prestations</label>
              {items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-2 items-start sm:items-center bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-none">
                  <input type="text" value={item.description} onChange={(e) => handleItemChange(item.id, "description", e.target.value)} className="w-full sm:flex-1 p-3 sm:p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Description" required />
                  <div className="flex w-full sm:w-auto gap-2 items-center">
                    <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)} className="flex-1 sm:w-20 p-3 sm:p-2 border rounded-lg text-center" placeholder="Qté" required />
                    <input type="number" min="0" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)} className="flex-1 sm:w-32 p-3 sm:p-2 border rounded-lg text-right" placeholder="P.U" required />
                    {items.length > 1 && <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 bg-red-100 px-4 py-3 rounded-lg font-bold">&times;</button>}
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddItem} className="text-blue-600 bg-blue-50 w-full sm:w-auto p-3 rounded-lg text-sm font-bold mt-2">+ Ajouter une ligne</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Main d'œuvre (FCFA)</label>
                <input type="number" min="0" value={mainOeuvre} onChange={(e) => setMainOeuvre(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Remise (FCFA)</label>
                <input type="number" min="0" value={remise} onChange={(e) => setRemise(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-gray-50 rounded-xl border">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="tva" checked={applyTva} onChange={(e) => setApplyTva(e.target.checked)} className="w-6 h-6 sm:w-5 sm:h-5 accent-blue-600 rounded" />
                <label htmlFor="tva" className="text-sm font-semibold cursor-pointer">Appliquer TVA (18%)</label>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="rsps" checked={applyRsps} onChange={(e) => setApplyRsps(e.target.checked)} className="w-6 h-6 sm:w-5 sm:h-5 accent-blue-600 rounded" />
                  <label htmlFor="rsps" className="text-sm font-semibold cursor-pointer">Appliquer RSPS</label>
                </div>
                {applyRsps && (
                  <div className="flex items-center ml-2">
                    <input type="number" step="0.1" min="0" max="100" value={rspsRate} onChange={(e) => setRspsRate(e.target.value)} className="w-20 p-2 border rounded-lg text-center" />
                    <span className="ml-2 text-sm font-bold">%</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button type="submit" disabled={isSaving} className="w-full md:w-auto px-6 py-3.5 md:py-2.5 font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}