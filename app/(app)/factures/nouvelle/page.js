"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { useSubscription } from "@/components/SubscriptionProvider";

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
    if (n > 0) result += convertLessThanThousand(n);
    return result.trim();
  }
  const words = convert(num);
  const capitalizedWords = words.charAt(0).toUpperCase() + words.slice(1);
  const formattedNumber = num.toLocaleString("fr-FR");
  return `${capitalizedWords} (${formattedNumber}) Francs CFA`;
}

const STATUS = { PENDING: "EN_ATTENTE", PAID: "PAYEE", PARTIAL: "PARTIELLE", CANCELLED: "ANNULEE" };

function generateItemId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePhone(raw, defaultCode = "228") {
  if (!raw) return "";
  const first = String(raw).split(/[\/,;]/)[0];
  let digits = first.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.length > 0 && digits.length <= 9) digits = defaultCode + digits;
  return digits;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function shareFileNatively(blob, filename, text) {
  try {
    if (typeof navigator === "undefined" || !navigator.share || typeof File === "undefined") return false;
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: filename, text });
    return true;
  } catch (err) {
    if (err && err.name === "AbortError") return true;
    return false;
  }
}

const TOAST_DURATION = 4000;

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast, onClose]);
  if (!toast) return null;
  const isError = toast.type === "error";
  const accentColor = isError ? "#dc2626" : "#16a34a";
  const title = toast.title || (isError ? "Erreur" : "Succès");
  return (
    <div className="print-hidden fixed bottom-6 right-6 z-[9999] animate-toast-in">
      <div className="relative flex items-start gap-3 bg-white pl-4 pr-4 py-3.5 rounded-xl shadow-2xl border border-gray-100 w-[320px] max-w-[calc(100vw-3rem)] overflow-hidden" style={{ borderLeft: `4px solid ${accentColor}` }} role="status">
        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white mt-0.5" style={{ backgroundColor: accentColor }}>
          {isError
            ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v3a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
            : <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{toast.message}</p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="flex-shrink-0 text-gray-300 hover:text-gray-500 -mt-0.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.4 5L5 6.4 8.6 10 5 13.6 6.4 15 10 11.4 13.6 15 15 13.6 11.4 10 15 6.4 13.6 5 10 8.6z" /></svg>
        </button>
        <div className="absolute bottom-0 left-0 h-[3px] w-full" style={{ backgroundColor: `${accentColor}20` }}>
          <div className="h-full animate-toast-progress" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    </div>
  );
}

function ShareModal({ open, onClose, defaultPhone, defaultEmail, defaultMessage, subject, filename, getPdfBlob, showToast }) {
  const [tab, setTab] = useState("whatsapp");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setPhone(defaultPhone || ""); setEmail(defaultEmail || ""); setMessage(defaultMessage || ""); setTab("whatsapp"); }
  }, [open, defaultPhone, defaultEmail, defaultMessage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const waNumber = normalizePhone(phone);
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  const mailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  const handleSend = async (channel) => {
    if (channel === "whatsapp" && !waNumber) { showToast("Veuillez renseigner un numéro WhatsApp valide.", "error"); return; }
    if (channel === "email" && !email) { showToast("Veuillez renseigner une adresse email.", "error"); return; }
    setBusy(true);
    try {
      const blob = await getPdfBlob();
      if (blob) {
        const shared = await shareFileNatively(blob, filename, message);
        if (shared) { setBusy(false); onClose(); return; }
        downloadBlob(blob, filename);
        showToast("PDF téléchargé. Joignez-le à votre message.", "success", "PDF prêt");
      }
      if (channel === "whatsapp") window.open(waUrl, "_blank", "noopener,noreferrer");
      else window.location.href = mailUrl;
    } catch (error) {
      console.error("Erreur partage :", error);
      showToast("Impossible de préparer le partage.", "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="print-hidden fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 p-5 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">📤 Envoyer le document</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center">✕</button>
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          <button type="button" onClick={() => setTab("whatsapp")} className={`flex-1 px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${tab === "whatsapp" ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>WhatsApp</button>
          <button type="button" onClick={() => setTab("email")} className={`flex-1 px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${tab === "email" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Email</button>
        </div>
        {tab === "whatsapp" ? (
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Numéro du destinataire</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228 90 00 00 00" className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white" />
            {waNumber && <p className="text-[11px] text-gray-400 mt-1">Sera envoyé au : +{waNumber}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email du destinataire</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.com" className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Objet</label>
              <input type="text" value={subject} readOnly className="w-full p-3 border rounded-xl bg-gray-100 text-sm text-gray-500" />
            </div>
          </div>
        )}
        <div className="mt-3">
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white resize-none" />
        </div>
        <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-800 text-[11px] leading-snug rounded-xl p-3">
          📎 Sur mobile, le PDF sera <b>directement joint</b>. Sur ordinateur, il sera <b>téléchargé automatiquement</b>.
        </div>
        <button type="button" disabled={busy} onClick={() => handleSend(tab)} className={`w-full mt-4 px-5 py-3 text-white font-semibold rounded-xl text-sm shadow-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${tab === "whatsapp" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}>
          {busy && <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {busy ? "Préparation du PDF..." : tab === "whatsapp" ? "Envoyer via WhatsApp" : "Envoyer par Email"}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-3">
          Rien ne s'ouvre ?{" "}
          <a href={tab === "whatsapp" ? waUrl : mailUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium text-gray-600">Cliquez ici</a>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANT SIGNATURE
// ============================================================
function SignatureBlock({ stampSignatureUrl }) {
  return (
    <div className="text-center">
      <p className="font-bold text-[11px] print:text-[10px] underline mb-2">LE RESPONSABLE</p>
      {stampSignatureUrl ? (
        <div style={{ width: "160px", height: "80px" }} className="flex items-center justify-center">
          <img
            src={stampSignatureUrl}
            alt="Cachet & Signature"
            crossOrigin="anonymous"
            className="stamp-signature-img"
            style={{ maxWidth: "160px", maxHeight: "80px", objectFit: "contain", display: "block" }}
          />
        </div>
      ) : (
        <div
          className="border border-dashed border-gray-300 bg-white rounded flex items-center justify-center text-[9px] print:text-[8px] text-gray-400 italic"
          style={{ width: "160px", height: "70px" }}
        >
          Cachet &amp; Signature
        </div>
      )}
    </div>
  );
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { isExpired } = useSubscription();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [companyData, setCompanyData] = useState(null);
  const [documentType, setDocumentType] = useState("FACTURE");
  const [allInvoicesData, setAllInvoicesData] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [numberManuallyEdited, setNumberManuallyEdited] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [items, setItems] = useState([{ id: generateItemId(), description: "", quantity: 1, unitPrice: 0 }]);
  const [status] = useState(STATUS.PENDING);
  const [remise, setRemise] = useState(0);
  const [hasTva, setHasTva] = useState(false);
  const [tvaRate, setTvaRate] = useState(18);
  const [hasRsps, setHasRsps] = useState(false);
  const [rspsRate, setRspsRate] = useState(5);
  const [printOption, setPrintOption] = useState("1");

  const showToast = useCallback((message, type = "success", title) => {
    setToast({ message, type, title });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUser(user);
      try {
        const companyDocRef = doc(db, "users", user.uid, "settings", "company");
        const companyDocSnap = await getDoc(companyDocRef);
        if (companyDocSnap.exists()) {
          const compData = companyDocSnap.data();
          setCompanyData(compData);
          if (compData.printOption) setPrintOption(compData.printOption);
        }
        const custSnap = await getDocs(collection(db, "users", user.uid, "customers"));
        const customersList = custSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCustomers(customersList);
        if (customersList.length > 0) setSelectedClientId(customersList[0].id);
        const invSnap = await getDocs(collection(db, "users", user.uid, "invoices"));
        setAllInvoicesData(invSnap.docs.map((d) => d.data()));
      } catch (error) {
        console.error("Erreur lors du chargement :", error);
        showToast("Impossible de charger les données initiales.", "error");
      } finally { setIsLoading(false); }
    });
    return () => unsubscribe();
  }, [router, showToast]);

  useEffect(() => {
    if (!showPreview || showShare) return;
    const onKey = (e) => { if (e.key === "Escape") setShowPreview(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPreview, showShare]);

  useEffect(() => {
    if (!currentUser || isLoading || numberManuallyEdited) return;
    const yearRef = invoiceDate ? new Date(invoiceDate).getFullYear() : new Date().getFullYear();
    const prefix = documentType === "PROFORMA" ? "PRO" : "FAC";
    const existingNumbers = new Set(allInvoicesData.map((inv) => inv.number));
    const sameTypeAndYearCount = allInvoicesData.filter((inv) => {
      const type = inv.type || "FACTURE";
      return type === documentType && typeof inv.number === "string" && inv.number.includes(`-${yearRef}-`);
    }).length;
    let counter = sameTypeAndYearCount + 1;
    let newNumber = "";
    let isUnique = false;
    while (!isUnique) {
      const sequentialNum = String(counter).padStart(3, "0");
      newNumber = `${prefix}-${yearRef}-${sequentialNum}`;
      if (!existingNumbers.has(newNumber)) isUnique = true;
      else counter++;
    }
    setInvoiceNumber(newNumber);
  }, [documentType, invoiceDate, allInvoicesData, currentUser, isLoading, numberManuallyEdited]);

  const isNumberDuplicate = useMemo(() =>
    allInvoicesData.some((inv) => inv.number === invoiceNumber),
    [allInvoicesData, invoiceNumber]
  );

  const { totalBrut, montantRemise, totalHt, calculatedTvaAmount, calculatedRspsAmount, totalTtc } = useMemo(() => {
    const brut = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unitPrice) || 0), 0);
    const remiseMontant = Math.max(0, Number(remise) || 0);
    const ht = Math.max(0, brut - remiseMontant);
    const tva = hasTva ? Math.round(ht * (Number(tvaRate) / 100)) : 0;
    const rsps = hasRsps ? Math.round(ht * (Number(rspsRate) / 100)) : 0;
    const ttc = ht + tva - rsps;
    return { totalBrut: brut, montantRemise: remiseMontant, totalHt: ht, calculatedTvaAmount: tva, calculatedRspsAmount: rsps, totalTtc: ttc };
  }, [items, remise, hasTva, tvaRate, hasRsps, rspsRate]);

  const remiseTropElevee = Number(remise) > totalBrut;

  const handleAddItem = () => setItems([...items, { id: generateItemId(), description: "", quantity: 1, unitPrice: 0 }]);
  const handleRemoveItem = (itemId) => { if (items.length > 1) setItems(items.filter((i) => i.id !== itemId)); };
  const handleItemChange = (itemId, field, value) => setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)));
  const handleNumberChange = (e) => { setNumberManuallyEdited(true); setInvoiceNumber(e.target.value); };
  const handleTypeChange = (type) => { setDocumentType(type); setNumberManuallyEdited(false); };

  const handleOpenPreview = (e) => {
    e.preventDefault();
    if (isExpired) { showToast("Votre abonnement a expiré. Veuillez le renouveler pour créer de nouveaux documents.", "error"); return; }
    if (customers.length === 0) { showToast("Veuillez créer au moins un client avant de générer un document.", "error"); return; }
    if (isNumberDuplicate) { showToast("Ce numéro de document existe déjà. Merci d'en choisir un autre.", "error"); return; }
    setShowPreview(true);
  };

  const selectedCustomerObj = customers.find((c) => c.id === selectedClientId);
  const docLabel = documentType === "PROFORMA" ? "Proforma" : "Facture";
  const pdfFilename = `${docLabel}_${invoiceNumber}.pdf`;

  const pdfOptions = useMemo(() => ({
    margin: 0, filename: pdfFilename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  }), [pdfFilename]);

  const getPdfBlob = useCallback(async () => {
    const element = document.getElementById("invoice-printable-container");
    if (typeof window === "undefined" || !window.html2pdf || !element) return null;
    return await window.html2pdf().set(pdfOptions).from(element).outputPdf("blob");
  }, [pdfOptions]);

  const handlePrint = async () => {
    const originalTitle = document.title;
    document.title = `${docLabel}_${invoiceNumber}_${selectedCustomerObj?.name || selectedCustomerObj?.businessName || "Client"}`;
    try {
      const element = document.getElementById("invoice-printable-container");
      if (typeof window !== "undefined" && window.html2pdf && element) {
        setIsGeneratingPdf(true);
        await window.html2pdf().from(element).set(pdfOptions).save();
        setIsGeneratingPdf(false);
      } else { window.print(); }
    } catch (error) {
      console.error("Erreur PDF:", error);
      showToast("Erreur PDF. Impression standard utilisée.", "error");
      setIsGeneratingPdf(false);
      window.print();
    } finally { setTimeout(() => { document.title = originalTitle; }, 1000); }
  };

  const handleSubmit = async () => {
    if (isExpired) return;
    setIsSaving(true);
    const selectedCustomer = customers.find((c) => c.id === selectedClientId);
    try {
      const newInvoiceData = {
        type: documentType, number: invoiceNumber,
        clientId: selectedClientId,
        clientName: selectedCustomer?.name || selectedCustomer?.businessName || "Client Comptoir",
        clientNif: selectedCustomer?.taxId || selectedCustomer?.nif || "",
        taxId: selectedCustomer?.taxId || "",
        clientAddress: selectedCustomer?.address || "",
        clientPhone: selectedCustomer?.phone || "",
        clientEmail: selectedCustomer?.email || "",
        date: invoiceDate, items, remise: montantRemise, status, printOption,
        paymentDate: "", paymentMethod: "",
        createdAt: new Date().toISOString(),
        totalBrut, totalAchat: totalBrut, totalHt, totalHorsTaxe: totalHt,
        hasTva, tvaRate: Number(tvaRate), tvaAmount: calculatedTvaAmount,
        hasRsps, applyRsps: hasRsps, rspsRate: Number(rspsRate), rspsAmount: calculatedRspsAmount,
        totalTtc, netAPayer: totalTtc,
      };
      await addDoc(collection(db, "users", currentUser.uid, "invoices"), newInvoiceData);
      router.push("/factures");
    } catch (error) {
      console.error("Erreur lors de la création :", error);
      showToast("Une erreur est survenue lors de l'enregistrement.", "error");
    } finally { setIsSaving(false); setShowPreview(false); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const mainColor = companyData?.primaryColor || "#2563eb";
  const stampSignatureUrl = companyData?.stampSignatureUrl || "";
  const clientNifDisplay = selectedCustomerObj?.taxId || selectedCustomerObj?.nif || "N/A";
  const isProforma = documentType === "PROFORMA";
  const activePrintOption = printOption || "1";
  const clientDisplayName = selectedCustomerObj?.name || selectedCustomerObj?.businessName || "Client";

  const shareSubject = `${docLabel} N° ${invoiceNumber} - ${companyData?.companyName || ""}`.trim();
  const shareMessage =
    `Bonjour ${clientDisplayName},\n\n` +
    `Veuillez trouver ci-joint la ${docLabel.toLowerCase()} N° ${invoiceNumber} ` +
    `d'un montant de ${totalTtc.toLocaleString("fr-FR")} F CFA, datée du ${invoiceDate ? new Date(invoiceDate).toLocaleDateString("fr-FR") : ""}.\n\n` +
    `Cordialement,\n${companyData?.companyName || ""}${companyData?.phone ? `\n${companyData.phone}` : ""}`;

  const watermarkStyle = {
    position: "absolute", inset: 0, display: "flex",
    alignItems: "center", justifyContent: "center",
    pointerEvents: "none", opacity: 0.08, userSelect: "none", zIndex: 0,
  };
  const watermarkImgStyle = { width: "60%", maxWidth: "320px", objectFit: "contain", filter: "grayscale(100%)" };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-16">
      <style>{`
        @keyframes toastIn { from { transform: translateY(12px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-toast-in { animation: toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
        .animate-toast-progress { animation: toastProgress ${TOAST_DURATION}ms linear forwards; }
      `}</style>

      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* ── HEADER avec bouton Annuler ── */}
      <header className="print-hidden h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shadow-sm">
        {/* Gauche : Retour + Titre */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/factures")}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            &larr; <span className="hidden sm:inline">Retour</span>
          </button>
          <h1 className="text-lg sm:text-xl font-bold">Nouveau Document</h1>
        </div>

        {/* Droite : Annuler + Enregistrer */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* ✅ BOUTON ANNULER */}
          <button
            type="button"
            onClick={() => router.push("/factures")}
            className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 font-medium rounded-xl text-sm border border-gray-200 hover:border-gray-300 transition-all cursor-pointer hidden sm:inline-flex items-center gap-1.5"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
              <path d="M6.4 5L5 6.4 8.6 10 5 13.6 6.4 15 10 11.4 13.6 15 15 13.6 11.4 10 15 6.4 13.6 5 10 8.6z" />
            </svg>
            Annuler
          </button>

          {/* Bouton Enregistrer */}
          <button
            onClick={handleOpenPreview}
            disabled={isExpired}
            className={`px-5 py-2.5 font-medium rounded-xl text-sm transition-all shadow-sm cursor-pointer ${
              isExpired
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isExpired ? "Abonnement requis" : "Enregistrer"}
          </button>
        </div>
      </header>

      {customers.length === 0 && (
        <div className="print-hidden max-w-4xl mx-auto mt-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm shadow-sm">
          <span>⚠️ Vous n'avez encore aucun client enregistré. Créez-en un pour pouvoir générer un document.</span>
          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0"
          >
            + Créer un client
          </button>
        </div>
      )}

      {/* ── FORMULAIRE ── */}
      <main className="print-hidden max-w-4xl mx-auto mt-8 bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <form onSubmit={handleOpenPreview} className="space-y-6">

          {/* Sélecteur type document */}
          <div className="flex gap-4 p-1 bg-gray-100 rounded-xl w-max">
            <button
              type="button"
              onClick={() => handleTypeChange("FACTURE")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${documentType === "FACTURE" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Facture Définitive
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("PROFORMA")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${documentType === "PROFORMA" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Facture Proforma
            </button>
          </div>

          {/* Client / Numéro / Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Client *</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white transition-colors cursor-pointer"
                required
                disabled={customers.length === 0}
              >
                {customers.length === 0 && <option value="">Aucun client disponible</option>}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.businessName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Numéro</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={handleNumberChange}
                className={`w-full p-3 border rounded-xl bg-gray-50 text-sm font-mono font-semibold ${isNumberDuplicate ? "border-red-500 bg-red-50 text-red-900" : ""}`}
                required
              />
              {isNumberDuplicate && <p className="text-xs text-red-600 font-medium mt-1">⚠️ Ce numéro existe déjà.</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Date d'émission</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full p-3 border rounded-xl bg-gray-50 text-sm"
                required
              />
            </div>
          </div>

          {/* Lignes de prestations */}
          <div className="pt-4 border-t">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
              Désignation des prestations / produits
            </h2>
            {items.map((item) => (
              <div key={item.id} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                  className="flex-1 p-2.5 border rounded-xl text-sm bg-gray-50 focus:bg-white"
                  placeholder="Description"
                  required
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                  className="w-20 p-2.5 border rounded-xl text-center text-sm bg-gray-50 focus:bg-white"
                  min="1"
                  required
                />
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)}
                  className="w-32 p-2.5 border rounded-xl text-right text-sm bg-gray-50 focus:bg-white"
                  min="0"
                  placeholder="0"
                  required
                />
                <span className="w-10 text-sm font-medium text-gray-500">F</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-500 font-bold px-2 text-lg hover:text-red-700 cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddItem}
              className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-medium mt-2 transition-colors cursor-pointer"
            >
              + Ajouter une ligne
            </button>
          </div>

          {/* Remise / TVA / RSPS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t bg-gray-50 p-4 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remise (Montant F CFA)</label>
              <input
                type="number"
                min="0"
                value={remise}
                onChange={(e) => setRemise(e.target.value)}
                className="w-full p-2.5 border rounded-lg bg-white text-sm"
                placeholder="0"
              />
              {remiseTropElevee && <p className="text-xs text-red-600 font-medium mt-1">⚠️ La remise dépasse le total.</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 uppercase">TVA (%)</label>
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={hasTva} onChange={(e) => setHasTva(e.target.checked)} className="rounded text-blue-600 cursor-pointer" />
                  Activer
                </label>
              </div>
              <input
                type="number"
                value={tvaRate}
                onChange={(e) => setTvaRate(e.target.value)}
                disabled={!hasTva}
                min="0" max="100"
                className="w-full p-2.5 border rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 uppercase">RSPS (%)</label>
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={hasRsps} onChange={(e) => setHasRsps(e.target.checked)} className="rounded text-blue-600 cursor-pointer" />
                  Activer
                </label>
              </div>
              <input
                type="number"
                value={rspsRate}
                onChange={(e) => setRspsRate(e.target.value)}
                disabled={!hasRsps}
                min="0" max="100"
                className="w-full p-2.5 border rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* Récapitulatif financier */}
          <div className="flex justify-end pt-4">
            <div className="w-full sm:w-80 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total Brut :</span><span>{totalBrut.toLocaleString("fr-FR")} F CFA</span>
              </div>
              {montantRemise > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Remise :</span><span>- {montantRemise.toLocaleString("fr-FR")} F CFA</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 pt-1 border-t">
                <span>Total HT :</span><span>{totalHt.toLocaleString("fr-FR")} F CFA</span>
              </div>
              {hasTva && (
                <div className="flex justify-between text-gray-600">
                  <span>TVA ({tvaRate}%) :</span><span>{calculatedTvaAmount.toLocaleString("fr-FR")} F CFA</span>
                </div>
              )}
              {hasRsps && (
                <div className="flex justify-between text-amber-700">
                  <span>RSPS ({rspsRate}%) :</span><span>- {calculatedRspsAmount.toLocaleString("fr-FR")} F CFA</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold pt-3 border-t border-gray-200" style={{ color: mainColor }}>
                <span>Net à Payer (TTC) :</span><span>{totalTtc.toLocaleString("fr-FR")} F CFA</span>
              </div>
            </div>
          </div>

          {/* ✅ BOUTON ANNULER visible sur mobile (bas du formulaire) */}
          <div className="flex justify-start pt-2 sm:hidden">
            <button
              type="button"
              onClick={() => router.push("/factures")}
              className="px-4 py-2.5 bg-white text-gray-600 font-medium rounded-xl text-sm border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                <path d="M6.4 5L5 6.4 8.6 10 5 13.6 6.4 15 10 11.4 13.6 15 15 13.6 11.4 10 15 6.4 13.6 5 10 8.6z" />
              </svg>
              Annuler et revenir
            </button>
          </div>

        </form>
      </main>

      {/* ================================================================== */}
      {/* MODALE DE PRÉVISUALISATION                                          */}
      {/* ================================================================== */}
      {showPreview && !isExpired && (
        <div
          className="invoice-modal-backdrop fixed inset-0 bg-black/60 z-50 overflow-y-auto print:bg-white"
          onClick={() => !showShare && setShowPreview(false)}
        >
          <style>{`
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { size: A4 portrait; margin: 0 !important; }
              html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; overflow: hidden !important; }
              .print-hidden { display: none !important; }
              .invoice-modal-backdrop { display: contents !important; }
              .invoice-scroll-wrapper { display: contents !important; }
              #invoice-printable-container {
                width: 210mm !important; height: 297mm !important; max-height: 297mm !important;
                overflow: hidden !important; box-sizing: border-box !important;
                padding: 2mm 12mm 4mm 12mm !important; margin: 0 !important;
                border-radius: 0 !important; border: none !important; box-shadow: none !important;
              }
              .invoice-content { position: relative !important; }
              .header-grid-option1 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 14px !important; border-bottom: 1px solid #1f2937 !important; padding-bottom: 1mm !important; margin-bottom: 0 !important; position: relative !important; z-index: 10 !important; align-items: center !important; }
              .header-option2 { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; border-bottom: 2px solid ${mainColor} !important; padding-bottom: 1mm !important; margin-bottom: 0 !important; position: relative !important; z-index: 10 !important; gap: 12px !important; flex-wrap: wrap !important; }
              .invoice-signature-wrapper { min-height: 94mm !important; display: flex !important; flex-direction: column !important; justify-content: flex-end !important; }
              .invoice-signature { margin-bottom: 3mm !important; }
              .invoice-footer { margin-top: 0 !important; padding-bottom: 1mm !important; }
              .logo-container-option1 { display: flex !important; align-items: center !important; justify-content: center !important; height: 210px !important; width: 100% !important; overflow: hidden !important; flex-shrink: 0 !important; }
              .logo-img-option1 { height: 210px !important; width: auto !important; max-width: 420px !important; object-fit: contain !important; display: block !important; flex-shrink: 0 !important; }
              .logo-img-option2 { height: 110px !important; width: auto !important; max-width: 220px !important; object-fit: contain !important; display: block !important; flex-shrink: 0 !important; }
              .stamp-signature-img { max-width: 160px !important; max-height: 80px !important; object-fit: contain !important; display: block !important; }
            }
          `}</style>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
            aria-label="Fermer l'aperçu"
            title="Fermer (Échap)"
            className="print-hidden fixed top-4 right-4 z-[65] w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-600 hover:text-gray-900 shadow-lg border border-gray-200 flex items-center justify-center text-lg font-bold transition-all hover:scale-105"
          >
            ✕
          </button>

          <div className="invoice-scroll-wrapper min-h-full flex items-start justify-center p-2 sm:p-4 pb-32 print:p-0 print:pb-0">
            <div
              id="invoice-printable-container"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-3xl w-full my-4 md:my-8 shadow-2xl relative border border-gray-100 px-6 py-8 md:p-10 print:shadow-none print:border-none print:p-0 print:m-0"
            >
              <div className="invoice-content relative bg-white">
                {companyData?.logoUrl && (
                  <div style={watermarkStyle}>
                    <img src={companyData.logoUrl} alt="" crossOrigin="anonymous" style={watermarkImgStyle} />
                  </div>
                )}

                {activePrintOption === "2" ? (
                  <div className="header-option2" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${mainColor}`, paddingBottom: "8px", marginBottom: "8px", position: "relative", zIndex: 10, gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {companyData?.logoUrl && (
                        <img src={companyData.logoUrl} alt="Logo" crossOrigin="anonymous" className="logo-img-option2" style={{ height: "110px", width: "auto", maxWidth: "220px", objectFit: "contain", display: "block", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      )}
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: "900", color: "#111827", textTransform: "uppercase", margin: 0 }}>{companyData?.companyName || "SOCIÉTÉ"}</p>
                        <p style={{ fontSize: "11px", color: "#4b5563", margin: "2px 0 0 0" }}>{companyData?.address}</p>
                        <p style={{ fontSize: "11px", color: "#4b5563", margin: "1px 0 0 0" }}>{companyData?.phone}{companyData?.email ? ` | ${companyData.email}` : ""}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "11px", fontWeight: "600", color: "#111827", margin: 0 }}>NIF : {companyData?.nif || "---"} | RCCM : {companyData?.rccm || "---"}</p>
                      {companyData?.services && <p style={{ fontSize: "10px", color: "#6b7280", fontStyle: "italic", marginTop: "3px", maxWidth: "200px" }}>{companyData.services}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="header-grid-option1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", borderBottom: "1px solid #1f2937", paddingBottom: "8px", marginBottom: "0", position: "relative", zIndex: 10, alignItems: "center" }}>
                    <div className="logo-container-option1" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "210px", width: "100%", overflow: "hidden", flexShrink: 0 }}>
                      {companyData?.logoUrl ? (
                        <img src={companyData.logoUrl} alt="Logo" crossOrigin="anonymous" className="logo-img-option1" style={{ height: "210px", width: "auto", maxWidth: "420px", objectFit: "contain", display: "block", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <span style={{ fontSize: "22px", fontWeight: "900", color: "#1f2937", letterSpacing: "0.05em" }}>{companyData?.companyName || "LOGO"}</span>
                      )}
                    </div>
                    <div style={{ borderLeft: `4px solid ${mainColor}`, paddingLeft: "12px", display: "flex", flexDirection: "column", justifyContent: "center", alignSelf: "center" }}>
                      <p style={{ fontWeight: "700", textTransform: "uppercase", fontSize: "11px", color: mainColor, margin: "0 0 4px 0" }}>Nos Services</p>
                      <p style={{ fontSize: "11px", color: "#4b5563", whiteSpace: "pre-line", lineHeight: "1.5", margin: 0 }}>{companyData?.services}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-1.5 relative z-10 gap-2">
                  <div className="text-white px-3 py-1.5 rounded font-bold text-xs shadow-sm w-full sm:w-auto text-center sm:text-left" style={{ backgroundColor: mainColor }}>
                    {isProforma ? "PROFORMA" : "FACTURE"} N° {invoiceNumber} / {companyData?.companyName || "Société"} / {invoiceDate ? new Date(invoiceDate).getFullYear() : new Date().getFullYear()}
                  </div>
                  <div className="w-full sm:w-auto text-right italic text-xs font-medium">
                    {companyData?.city ? `${companyData.city}, le ` : "Fait le "}{invoiceDate ? new Date(invoiceDate).toLocaleDateString("fr-FR") : ""}
                  </div>
                </div>

                <div className="flex justify-end relative z-10 mt-1.5">
                  <div className="w-[300px] max-w-full border border-gray-300 bg-gray-100 p-2 text-[11px] space-y-0.5 rounded-lg shadow-sm">
                    <p className="font-bold text-gray-900">DOIT : {clientDisplayName}</p>
                    <p className="text-gray-700">NIF : {clientNifDisplay}</p>
                    <p className="text-gray-700">Adresse : {selectedCustomerObj?.address || "N/A"}</p>
                    <p className="text-gray-700">Tel : {selectedCustomerObj?.phone || "---"}</p>
                  </div>
                </div>

                <div className="relative z-10 mt-2 overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-[10px] border-collapse border border-gray-400 bg-white">
                    <thead>
                      <tr className="bg-gray-200 border border-gray-400 text-gray-800 font-bold">
                        <th className="p-1.5 border border-gray-400">Descriptions</th>
                        <th className="p-1.5 border border-gray-400 text-center w-12">Qté</th>
                        <th className="p-1.5 border border-gray-400 text-right w-24">Pu</th>
                        <th className="p-1.5 border border-gray-400 text-right w-28">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id ?? idx} className="border border-gray-300">
                          <td className="p-1.5 border border-gray-300 break-words">{item.description || "-"}</td>
                          <td className="p-1.5 border border-gray-300 text-center">{item.quantity}</td>
                          <td className="p-1.5 border border-gray-300 text-right whitespace-nowrap">{Number(item.unitPrice).toLocaleString("fr-FR")}</td>
                          <td className="p-1.5 border border-gray-300 text-right font-medium whitespace-nowrap">{(Number(item.quantity) * Number(item.unitPrice)).toLocaleString("fr-FR")}</td>
                        </tr>
                      ))}
                      <tr className="border border-gray-400 font-bold bg-gray-50">
                        <td colSpan="3" className="p-1.5 border border-gray-400 text-right">TOTAL GENERAL</td>
                        <td className="p-1.5 border border-gray-400 text-right whitespace-nowrap">{totalBrut.toLocaleString("fr-FR")}</td>
                      </tr>
                      {montantRemise > 0 && (
                        <tr className="border border-gray-400 font-bold bg-gray-50">
                          <td colSpan="3" className="p-1.5 border border-gray-400 text-right text-red-600">REMISE</td>
                          <td className="p-1.5 border border-gray-400 text-right text-red-600 whitespace-nowrap">- {montantRemise.toLocaleString("fr-FR")}</td>
                        </tr>
                      )}
                      <tr className="border border-gray-400 font-bold bg-gray-100">
                        <td colSpan="3" className="p-1.5 border border-gray-400 text-right">TOTAL HORS TAXE</td>
                        <td className="p-1.5 border border-gray-400 text-right whitespace-nowrap">{totalHt.toLocaleString("fr-FR")}</td>
                      </tr>
                      {hasTva && (
                        <tr className="border border-gray-400 font-bold bg-gray-50">
                          <td colSpan="3" className="p-1.5 border border-gray-400 text-right">TVA ({tvaRate}%)</td>
                          <td className="p-1.5 border border-gray-400 text-right whitespace-nowrap">{calculatedTvaAmount.toLocaleString("fr-FR")}</td>
                        </tr>
                      )}
                      <tr className="border border-gray-400 font-extrabold bg-gray-200">
                        <td colSpan="3" className="p-1.5 border border-gray-400 text-right">MONTANT TTC</td>
                        <td className="p-1.5 border border-gray-400 text-right whitespace-nowrap">{(totalHt + calculatedTvaAmount).toLocaleString("fr-FR")}</td>
                      </tr>
                      {hasRsps && (
                        <tr className="border border-gray-400 font-bold bg-gray-50">
                          <td colSpan="3" className="p-1.5 border border-gray-400 text-right text-amber-700">RSPS ({rspsRate}%)</td>
                          <td className="p-1.5 border border-gray-400 text-right text-amber-700 whitespace-nowrap">- {calculatedRspsAmount.toLocaleString("fr-FR")}</td>
                        </tr>
                      )}
                      {hasRsps && (
                        <tr className="border border-gray-400 font-extrabold bg-gray-300">
                          <td colSpan="3" className="p-1.5 border border-gray-400 text-right">NET À PAYER</td>
                          <td className="p-1.5 border border-gray-400 text-right whitespace-nowrap">{totalTtc.toLocaleString("fr-FR")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] italic font-medium relative z-10 pt-1">
                  Arrêté à la somme de : <br className="block md:hidden" />
                  <span className="font-bold underline">{numberToWords(totalTtc)}</span>
                </div>

                {isProforma && (
                  <div className="mt-4 pt-3 border-t text-[9px] text-gray-500 text-center font-medium relative z-10">
                    * Ce document est une facture proforma établie à titre indicatif et ne constitue pas une demande de paiement définitif.
                  </div>
                )}
              </div>

              {/* WRAPPER SIGNATURE + FOOTER */}
              <div className="invoice-signature-wrapper">
                <div className="invoice-signature mt-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                    <div />
                    <SignatureBlock stampSignatureUrl={stampSignatureUrl} />
                  </div>
                </div>

                <div className="invoice-footer mt-4">
                  <div className="w-full border-t-2 pt-1.5 text-[9px] text-center text-gray-600 bg-white" style={{ borderColor: mainColor }}>
                    <p className="font-bold text-gray-900 text-[10px] mb-0.5">{companyData?.companyName}</p>
                    <div className="flex justify-center gap-x-2 gap-y-0 flex-wrap font-medium">
                      {companyData?.address && <span>📍 {companyData.address}</span>}
                      {companyData?.phone && <span>📞 {companyData.phone}</span>}
                      {companyData?.email && <span>✉️ {companyData.email}</span>}
                      {companyData?.website && <span>🌐 {companyData.website}</span>}
                    </div>
                    <p className="tracking-tight mt-0.5">
                      NIF : {companyData?.nif || "---"} | RCCM : {companyData?.rccm || "---"} | N° CNSS : {companyData?.cnss || "---"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BARRE D'ACTIONS FLOTTANTE */}
          <div className="print-hidden fixed bottom-0 inset-x-0 z-[60] flex justify-center px-3 pb-4 sm:pb-6 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-lg sm:max-w-2xl bg-white/95 backdrop-blur-md border border-gray-200 shadow-2xl rounded-2xl px-3 py-2.5 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex-1 px-2 sm:px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                ✏️<span className="hidden sm:inline ml-1">Modifier</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={isGeneratingPdf}
                className="flex-1 px-2 sm:px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {isGeneratingPdf ? <span className="inline-block h-4 w-4 border-2 border-gray-400/40 border-t-gray-700 rounded-full animate-spin" /> : "🖨️"}
                <span className="hidden sm:inline">{isGeneratingPdf ? "..." : "PDF"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="flex-1 px-2 sm:px-3 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                📤<span className="hidden sm:inline ml-1">Partager</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSubmit}
                className="flex-[1.4] px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-colors disabled:bg-blue-300 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {isSaving ? <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : "💾"}
                {isSaving ? "..." : "Confirmer"}
              </button>
            </div>
          </div>

          <ShareModal
            open={showShare}
            onClose={() => setShowShare(false)}
            defaultPhone={selectedCustomerObj?.phone || ""}
            defaultEmail={selectedCustomerObj?.email || ""}
            defaultMessage={shareMessage}
            subject={shareSubject}
            filename={pdfFilename}
            getPdfBlob={getPdfBlob}
            showToast={showToast}
          />
        </div>
      )}
    </div>
  );
}