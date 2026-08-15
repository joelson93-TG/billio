"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../../firebase";

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

const STATUS = {
  PENDING: "EN_ATTENTE",
  PAID: "PAYEE",
  PARTIAL: "PARTIELLE",
  CANCELLED: "ANNULEE",
};
function normalizeStatus(status) {
  const s = (status || "").toUpperCase();
  return s === "PAYÉ" ? STATUS.PAID : s === "ANNULÉ" ? STATUS.CANCELLED : s;
}
function isPaidOrPartial(status) {
  const s = normalizeStatus(status);
  return s === STATUS.PAID || s === STATUS.PARTIAL;
}
function getStatusBadge(status) {
  switch (normalizeStatus(status)) {
    case STATUS.PAID: return { label: "🟢 Payée", style: "bg-green-100 text-green-700" };
    case STATUS.PARTIAL: return { label: "🟠 Partielle", style: "bg-orange-100 text-orange-700" };
    case STATUS.CANCELLED: return { label: "🔴 Annulée", style: "bg-red-100 text-red-700" };
    default: return { label: "🟡 En attente", style: "bg-yellow-100 text-yellow-700" };
  }
}
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
          <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Numéro du destinataire</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228 90 00 00 00" className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white" />
            {waNumber && <p className="text-[11px] text-gray-400 mt-1">Sera envoyé au : +{waNumber}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email du destinataire</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.com" className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white" />
            </div>
            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Objet</label>
              <input type="text" value={subject} readOnly className="w-full p-3 border rounded-xl bg-gray-100 text-sm text-gray-500" />
            </div>
          </div>
        )}
        <div className="mt-3">
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:bg-white resize-none" />
        </div>
        <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-800 text-[11px] leading-snug rounded-xl p-3">
          📎 Sur mobile, le PDF sera <b>directement joint</b> via le menu de partage. Sur ordinateur, il sera <b>téléchargé automatiquement</b>.
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
// COMPOSANT SIGNATURE — réutilisable dans les deux sections
// ============================================================
function SignatureBlock({ stampSignatureUrl, paymentInfo }) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 print:gap-4">
      {/* Bloc paiement à gauche */}
      <div className="text-[9px] print:text-[8px] text-gray-500">
        {paymentInfo}
      </div>

      {/* Bloc responsable à droite */}
      <div className="text-center">
        <p className="font-bold text-[11px] print:text-[10px] underline mb-2">LE RESPONSABLE</p>
        {stampSignatureUrl ? (
          // 🆕 Image cachet+signature importée
          <div style={{ width: "160px", height: "80px" }} className="flex items-center justify-center">
            <img
              src={stampSignatureUrl}
              alt="Cachet & Signature"
              crossOrigin="anonymous"
              style={{
                maxWidth: "160px",
                maxHeight: "80px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        ) : (
          // Placeholder si pas d'image
          <div
            className="border border-dashed border-gray-300 bg-white rounded flex items-center justify-center text-[9px] print:text-[8px] text-gray-400 italic"
            style={{ width: "160px", height: "70px" }}
          >
            Cachet &amp; Signature
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvoiceDetailOrEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState({});
  const [customers, setCustomers] = useState([]);
  const [invoiceType, setInvoiceType] = useState("FACTURE");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState(STATUS.PENDING);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [items, setItems] = useState([]);
  const [mainOeuvre, setMainOeuvre] = useState(0);
  const [remise, setRemise] = useState(0);
  const [applyTva, setApplyTva] = useState(false);
  const [tvaRate, setTvaRate] = useState(18);
  const [applyRsps, setApplyRsps] = useState(false);
  const [rspsRate, setRspsRate] = useState(1);
  const [printOption, setPrintOption] = useState("1");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const showToast = useCallback((message, type = "success", title) => { setToast({ message, type, title }); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUser(user);
      try {
        const custSnap = await getDocs(collection(db, "users", user.uid, "customers"));
        setCustomers(custSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        const docRef = doc(db, "users", user.uid, "invoices", id);
        const docSnap = await getDoc(docRef);
        const compSnap = await getDoc(doc(db, "users", user.uid, "settings", "company"));
        const compData = compSnap.exists() ? compSnap.data() : {};
        setCompany(compData);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setInvoice({ id: docSnap.id, ...data });
          setInvoiceType(data.type || "FACTURE");
          setInvoiceNumber(data.number || "");
          setInvoiceDate(data.date || "");
          setInvoiceStatus(normalizeStatus(data.status) || STATUS.PENDING);
          setPaymentDate(data.paymentDate || new Date().toISOString().split("T")[0]);
          setPaymentMethod(data.paymentMethod || "Espèces");
          setSelectedClientId(data.clientId || "");
          setItems((data.items || []).map((item) => ({ ...item, id: item.id ?? generateItemId() })));
          setMainOeuvre(data.mainOeuvre || 0);
          setRemise(data.remise || 0);
          setApplyTva(data.hasTva ?? false);
          setTvaRate(data.tvaRate ?? 18);
          setApplyRsps(data.applyRsps ?? false);
          setRspsRate(data.rspsRate || 1);
          setPrintOption(data.printOption || compData.printOption || "1");
        } else { router.push("/factures"); }
      } catch (error) {
        console.error("Erreur :", error);
        showToast("Impossible de charger le document.", "error");
      } finally { setIsLoading(false); }
    });
    return () => unsubscribe();
  }, [id, router, showToast]);

  const totalAchat = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unitPrice) || 0), 0);
  const montantRemise = Number(remise) || 0;
  const totalHorsTaxe = Math.max(0, totalAchat + Number(mainOeuvre) - montantRemise);
  const tvaAmount = applyTva ? Math.round(totalHorsTaxe * (Number(tvaRate) / 100)) : 0;
  const totalTtc = totalHorsTaxe + tvaAmount;
  const rspsAmount = applyRsps ? Math.round(totalHorsTaxe * (Number(rspsRate) / 100)) : 0;
  const netAPayer = totalTtc - rspsAmount;

  const handleAddItem = () => setItems([...items, { id: generateItemId(), description: "", quantity: 1, unitPrice: 0 }]);
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
      const normalizedStatus = normalizeStatus(invoiceStatus);
      const paidOrPartial = isPaidOrPartial(normalizedStatus);
      const updatedData = {
        type: invoiceType, number: invoiceNumber, status: normalizedStatus,
        paymentDate: paidOrPartial ? paymentDate : "", paymentMethod: paidOrPartial ? paymentMethod : "",
        clientId: selectedClientId,
        clientName: selectedCustomer?.name || selectedCustomer?.businessName || invoice.clientName,
        clientNif: selectedCustomer?.taxId || selectedCustomer?.nif || "",
        taxId: selectedCustomer?.taxId || "",
        clientAddress: selectedCustomer?.address || "", clientPhone: selectedCustomer?.phone || "",
        clientEmail: selectedCustomer?.email || "",
        date: invoiceDate, items, mainOeuvre: Number(mainOeuvre), remise: montantRemise,
        totalAchat, totalHorsTaxe, tvaAmount, tvaRate: Number(tvaRate), totalTtc,
        hasTva: applyTva, applyRsps, rspsRate: Number(rspsRate), rspsAmount, netAPayer, printOption,
      };
      await updateDoc(docRef, updatedData);
      setInvoice({ id, ...updatedData });
      setIsEditing(false);
      showToast("Le document a été mis à jour.", "success");
    } catch (error) {
      console.error(error);
      showToast("La mise à jour a échoué. Réessayez.", "error");
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "invoices", id));
      router.push("/factures");
    } catch (error) {
      console.error(error);
      showToast("La suppression a échoué. Réessayez.", "error");
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const docLabel = invoice?.type === "PROFORMA" ? "Proforma" : "Facture";
  const pdfFilename = `${docLabel}_${invoice?.number || ""}.pdf`;

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
    document.title = `${docLabel}_${invoice.number}_${invoice.clientName || "Client"}`;
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

  const handleOpenShare = () => {
    if (isEditing) { showToast("Enregistrez vos modifications avant de partager.", "error"); return; }
    setShowShare(true);
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-12 w-12 border-t-2 border-blue-600 rounded-full"></div>
    </div>
  );
  if (!invoice) return null;

  const brandColor = company.primaryColor || "#2563eb";
  // 🆕 Récupération de l'image cachet+signature
  const stampSignatureUrl = company.stampSignatureUrl || "";
  const montantArrete = applyRsps ? netAPayer : totalTtc;
  const currentStatusBadge = getStatusBadge(invoice.status);
  const isProforma = invoice.type === "PROFORMA";
  const invoicePaidOrPartial = isPaidOrPartial(invoice.status);
  const activePrintOption = printOption || invoice.printOption || "1";

  const shareSubject = `${docLabel} N° ${invoice.number} - ${company.companyName || ""}`.trim();
  const shareMessage =
    `Bonjour ${invoice.clientName || "cher client"},\n\n` +
    `Veuillez trouver ci-joint la ${docLabel.toLowerCase()} N° ${invoice.number} ` +
    `d'un montant de ${montantArrete.toLocaleString("fr-FR")} F CFA, datée du ${invoice.date ? new Date(invoice.date).toLocaleDateString("fr-FR") : ""}.\n\n` +
    `Cordialement,\n${company.companyName || ""}${company.phone ? `\n${company.phone}` : ""}`;

  const watermarkStyle = {
    position: "absolute", inset: 0, display: "flex",
    alignItems: "center", justifyContent: "center",
    pointerEvents: "none", opacity: 0.08, userSelect: "none", zIndex: 0,
  };
  const watermarkImgStyle = { width: "60%", maxWidth: "320px", objectFit: "contain", filter: "grayscale(100%)" };

  // Infos paiement pour le bloc signature
  const paymentInfoNode = invoicePaidOrPartial && normalizeStatus(invoice.status) === STATUS.PAID ? (
    <p className="border border-green-500 text-green-700 px-2 py-1 rounded inline-block font-bold text-[9px] print:text-[8px]">
      ✓ Réglé par {invoice.paymentMethod || "Espèces"} le{" "}
      {invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR")}
    </p>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-16">
      <style>{`
        :root { color-scheme: light; }
        * { color-adjust: exact; }
        @keyframes toastIn { from { transform: translateY(12px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-toast-in { animation: toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
        .animate-toast-progress { animation: toastProgress ${TOAST_DURATION}ms linear forwards; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4 portrait; margin: 0 !important; }
          html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; overflow: hidden !important; }
          .print-hidden { display: none !important; }
          #invoice-printable-container {
            width: 210mm !important; height: 297mm !important; max-height: 297mm !important;
            overflow: hidden !important; box-sizing: border-box !important;
            padding: 2mm 12mm 4mm 12mm !important; margin: 0 !important;
            border-radius: 0 !important; border: none !important; box-shadow: none !important;
          }
          .invoice-content { position: relative !important; }
          .header-grid-option1 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 14px !important; border-bottom: 1px solid #1f2937 !important; padding-bottom: 1mm !important; margin-bottom: 0 !important; position: relative !important; z-index: 10 !important; align-items: center !important; }
          .header-option2 { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; border-bottom: 2px solid ${brandColor} !important; padding-bottom: 1mm !important; margin-bottom: 0 !important; position: relative !important; z-index: 10 !important; gap: 12px !important; flex-wrap: wrap !important; }
          .invoice-signature-wrapper { min-height: 94mm !important; display: flex !important; flex-direction: column !important; justify-content: flex-end !important; }
          .invoice-signature { margin-bottom: 3mm !important; }
          .invoice-footer { margin-top: 0 !important; padding-bottom: 1mm !important; }
          .logo-container-option1 { display: flex !important; align-items: center !important; justify-content: center !important; height: 210px !important; width: 100% !important; overflow: hidden !important; flex-shrink: 0 !important; }
          .logo-img-option1 { height: 210px !important; width: auto !important; max-width: 420px !important; object-fit: contain !important; display: block !important; flex-shrink: 0 !important; }
          .logo-img-option2 { height: 110px !important; width: auto !important; max-width: 220px !important; object-fit: contain !important; display: block !important; flex-shrink: 0 !important; }
          
          /* 🆕 Impression cachet+signature */
          .stamp-signature-img { max-width: 160px !important; max-height: 80px !important; object-fit: contain !important; display: block !important; }
        }
      `}</style>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="print-hidden min-h-[5rem] bg-white border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between p-4 md:px-8 sticky top-0 z-10 shadow-sm gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <Link href="/factures" className="px-3 py-2 md:py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">&larr; <span className="hidden sm:inline">Retour</span></Link>
          <h1 className="text-lg md:text-xl font-bold truncate max-w-[200px] sm:max-w-xs">{isProforma ? "Proforma" : "Facture"} {invoice.number}</h1>
          <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap ${currentStatusBadge.style}`}>{currentStatusBadge.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none px-3 md:px-4 py-2 text-white rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700">Modifier</button>
              <button onClick={handlePrint} disabled={isGeneratingPdf} className="flex-1 md:flex-none px-3 md:px-4 py-2 text-white rounded-xl text-sm font-medium shadow-md flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: brandColor }}>
                {isGeneratingPdf && <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isGeneratingPdf ? "Génération..." : "PDF / Imprimer"}
              </button>
              <button onClick={handleOpenShare} className="flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl text-sm font-medium bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 flex items-center justify-center gap-1.5">
                📤 <span>Partager</span>
              </button>
              {!confirmingDelete ? (
                <button onClick={() => setConfirmingDelete(true)} className="flex-1 md:flex-none px-3 py-2 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50">Supprimer</button>
              ) : (
                <div className="flex items-center gap-2 w-full md:w-auto bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                  <span className="text-xs text-red-700 font-medium hidden sm:inline">Confirmer ?</span>
                  <button onClick={handleDelete} disabled={isDeleting} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">{isDeleting ? "..." : "Oui, supprimer"}</button>
                  <button onClick={() => setConfirmingDelete(false)} disabled={isDeleting} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 hover:bg-gray-300">Annuler</button>
                </div>
              )}
            </>
          ) : (
            <button onClick={() => setIsEditing(false)} className="w-full md:w-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-sm font-medium transition-colors">Annuler</button>
          )}
        </div>
      </header>

      {!isEditing && invoicePaidOrPartial && (
        <div className="print-hidden max-w-3xl mx-4 md:mx-auto mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div>
            <span className="font-bold">Facture réglée</span> le{" "}
            {invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR")}{" "}
            via <span className="font-semibold">{invoice.paymentMethod || "Espèces"}</span>.
          </div>
        </div>
      )}

      <main
        id="invoice-printable-container"
        className="max-w-3xl mx-4 md:mx-auto mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 px-4 pt-2 pb-4 md:px-6 md:pt-2 md:pb-6 print:m-0 print:rounded-none print:border-none print:shadow-none"
      >
        {!isEditing ? (
          <>
            <div className="invoice-content relative bg-white">
              {company.logoUrl && (
                <div style={watermarkStyle}>
                  <img src={company.logoUrl} alt="" crossOrigin="anonymous" style={watermarkImgStyle} />
                </div>
              )}

              {activePrintOption === "2" ? (
                <div className="header-option2" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${brandColor}`, paddingBottom: "8px", marginBottom: "8px", position: "relative", zIndex: 10, gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {company.logoUrl && (
                      <img src={company.logoUrl} alt="Logo" crossOrigin="anonymous" className="logo-img-option2" style={{ height: "110px", width: "auto", maxWidth: "220px", objectFit: "contain", display: "block", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: "900", color: "#111827", textTransform: "uppercase", margin: 0 }}>{company.companyName || "SOCIÉTÉ"}</p>
                      <p style={{ fontSize: "11px", color: "#4b5563", margin: "2px 0 0 0" }}>{company.address}</p>
                      <p style={{ fontSize: "11px", color: "#4b5563", margin: "1px 0 0 0" }}>{company.phone}{company.email ? ` | ${company.email}` : ""}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "11px", fontWeight: "600", color: "#111827", margin: 0 }}>NIF : {company.nif || "---"} | RCCM : {company.rccm || "---"}</p>
                    {company.services && <p style={{ fontSize: "10px", color: "#6b7280", fontStyle: "italic", marginTop: "3px", maxWidth: "200px" }}>{company.services}</p>}
                  </div>
                </div>
              ) : (
                <div className="header-grid-option1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", borderBottom: "1px solid #1f2937", paddingBottom: "8px", marginBottom: "0", position: "relative", zIndex: 10, alignItems: "center" }}>
                  <div className="logo-container-option1" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "210px", width: "100%", overflow: "hidden", flexShrink: 0 }}>
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt="Logo" crossOrigin="anonymous" className="logo-img-option1" style={{ height: "210px", width: "auto", maxWidth: "420px", objectFit: "contain", display: "block", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <span style={{ fontSize: "22px", fontWeight: "900", color: "#1f2937", letterSpacing: "0.05em" }}>{company.companyName || "LOGO"}</span>
                    )}
                  </div>
                  <div style={{ borderLeft: `4px solid ${brandColor}`, paddingLeft: "12px", display: "flex", flexDirection: "column", justifyContent: "center", alignSelf: "center" }}>
                    <p style={{ fontWeight: "700", textTransform: "uppercase", fontSize: "11px", color: brandColor, margin: "0 0 4px 0" }}>Nos Services</p>
                    <p style={{ fontSize: "11px", color: "#4b5563", whiteSpace: "pre-line", lineHeight: "1.5", margin: 0 }}>{company.services}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-1.5 print:mt-1 relative z-10 gap-2">
                <div className="text-white px-3 py-1.5 print:py-1 rounded font-bold text-xs shadow-sm w-full sm:w-auto text-center sm:text-left" style={{ backgroundColor: brandColor }}>
                  {isProforma ? "PROFORMA" : "FACTURE"} N° {invoice.number} / {company.companyName || "Société"} / {new Date(invoice.date).getFullYear() || new Date().getFullYear()}
                </div>
                <div className="w-full sm:w-auto text-right italic text-xs font-medium">
                  {company.city ? `${company.city}, le ` : "Fait le "}{new Date(invoice.date).toLocaleDateString("fr-FR")}
                </div>
              </div>

              <div className="flex justify-end relative z-10 mt-1.5 print:mt-1">
                <div className="w-[300px] max-w-full border border-gray-300 bg-gray-100 p-2 text-[11px] print:text-[10px] space-y-0.5 rounded-lg shadow-sm">
                  <p className="font-bold text-gray-900">DOIT : {invoice.clientName}</p>
                  <p className="text-gray-700">NIF : {clientNifDisplay}</p>
                  <p className="text-gray-700">Adresse : {invoice.clientAddress || currentCustomer?.address || "N/A"}</p>
                  <p className="text-gray-700">Tel : {invoice.clientPhone || currentCustomer?.phone || "---"}</p>
                </div>
              </div>

              <div className="relative z-10 mt-2 print:mt-1.5 overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-[10px] print:text-[9px] border-collapse border border-gray-400 bg-white">
                  <thead>
                    <tr className="bg-gray-200 border border-gray-400 text-gray-800 font-bold">
                      <th className="p-1.5 print:p-1 border border-gray-400">Descriptions</th>
                      <th className="p-1.5 print:p-1 border border-gray-400 text-center w-12 print:w-8">Qté</th>
                      <th className="p-1.5 print:p-1 border border-gray-400 text-right w-24 print:w-20">Pu</th>
                      <th className="p-1.5 print:p-1 border border-gray-400 text-right w-28 print:w-24">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item, idx) => (
                      <tr key={item.id ?? idx} className="border border-gray-300">
                        <td className="p-1.5 print:p-1 border border-gray-300 break-words">{item.description}</td>
                        <td className="p-1.5 print:p-1 border border-gray-300 text-center">{item.quantity}</td>
                        <td className="p-1.5 print:p-1 border border-gray-300 text-right whitespace-nowrap">{Number(item.unitPrice).toLocaleString("fr-FR")}</td>
                        <td className="p-1.5 print:p-1 border border-gray-300 text-right font-medium whitespace-nowrap">{(Number(item.quantity) * Number(item.unitPrice)).toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                    <tr className="border border-gray-400 font-bold bg-gray-50">
                      <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right">TOTAL GENERAL</td>
                      <td className="p-1.5 print:p-1 border border-gray-400 text-right whitespace-nowrap">{totalAchat.toLocaleString("fr-FR")}</td>
                    </tr>
                    {mainOeuvre > 0 && (
                      <tr className="border border-gray-400 font-bold bg-gray-50">
                        <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right">MAIN D'OEUVRE</td>
                        <td className="p-1.5 print:p-1 border border-gray-400 text-right whitespace-nowrap">{Number(mainOeuvre).toLocaleString("fr-FR")}</td>
                      </tr>
                    )}
                    {montantRemise > 0 && (
                      <tr className="border border-gray-400 font-bold bg-gray-50">
                        <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right text-red-600">REMISE</td>
                        <td className="p-1.5 print:p-1 border border-gray-400 text-right text-red-600 whitespace-nowrap">- {montantRemise.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}
                    <tr className="border border-gray-400 font-bold bg-gray-100">
                      <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right">TOTAL HORS TAXE</td>
                      <td className="p-1.5 print:p-1 border border-gray-400 text-right whitespace-nowrap">{totalHorsTaxe.toLocaleString("fr-FR")}</td>
                    </tr>
                    {applyTva && (
                      <tr className="border border-gray-400 font-bold bg-gray-50">
                        <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right">TVA ({tvaRate}%)</td>
                        <td className="p-1.5 print:p-1 border border-gray-400 text-right whitespace-nowrap">{tvaAmount.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}
                    <tr className="border border-gray-400 font-extrabold bg-gray-200">
                      <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right">MONTANT TTC</td>
                      <td className="p-1.5 print:p-1 border border-gray-400 text-right whitespace-nowrap">{totalTtc.toLocaleString("fr-FR")}</td>
                    </tr>
                    {applyRsps && (
                      <tr className="border border-gray-400 font-bold bg-gray-50">
                        <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right text-red-600">RSPS ({rspsRate}%)</td>
                        <td className="p-1.5 print:p-1 border border-gray-400 text-right text-red-600 whitespace-nowrap">- {rspsAmount.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}
                    {applyRsps && (
                      <tr className="border border-gray-400 font-extrabold bg-gray-300">
                        <td colSpan="3" className="p-1.5 print:p-1 border border-gray-400 text-right">NET À PAYER</td>
                        <td className="p-1.5 print:p-1 border border-gray-400 text-right whitespace-nowrap">{netAPayer.toLocaleString("fr-FR")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-[10px] print:text-[9px] italic font-medium relative z-10 pt-1">
                Arrêté à la somme de : <br className="block md:hidden" />
                <span className="font-bold underline">{numberToWords(montantArrete)}</span>
              </div>
            </div>

            {/* WRAPPER SIGNATURE + FOOTER */}
            <div className="invoice-signature-wrapper">
              <div className="invoice-signature mt-4 print:mt-0">
                {/* 🆕 Utilisation du composant SignatureBlock */}
                <SignatureBlock
                  stampSignatureUrl={stampSignatureUrl}
                  paymentInfo={paymentInfoNode}
                />
              </div>

              <div className="invoice-footer mt-4 print:mt-0">
                <div className="w-full border-t-2 pt-1.5 print:pt-1 text-[9px] print:text-[8px] text-center text-gray-600 bg-white" style={{ borderColor: brandColor }}>
                  <p className="font-bold text-gray-900 text-[10px] print:text-[9px] mb-0.5">{company.companyName}</p>
                  <div className="flex justify-center gap-x-2 gap-y-0 flex-wrap font-medium">
                    {company.address && <span>📍 {company.address}</span>}
                    {company.phone && <span>📞 {company.phone}</span>}
                    {company.email && <span>✉️ {company.email}</span>}
                    {company.website && <span>🌐 {company.website}</span>}
                  </div>
                  <p className="tracking-tight mt-0.5">NIF : {company.nif || "---"} | RCCM : {company.rccm || "---"} | N° CNSS : {company.cnss || "---"}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-6 pt-4">
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
                  <option value={STATUS.PENDING}>En attente de règlement</option>
                  <option value={STATUS.PAID}>Payée</option>
                  <option value={STATUS.PARTIAL}>Partiellement payée</option>
                  <option value={STATUS.CANCELLED}>Annulée</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Option d'impression / En-tête</label>
                <select value={printOption} onChange={(e) => setPrintOption(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="1">Option 1 (Classique - Logo & Services)</option>
                  <option value="2">Option 2 (Alternative - Bloc Entreprise Complet)</option>
                </select>
              </div>
            </div>
            {isPaidOrPartial(invoiceStatus) && (
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="tva" checked={applyTva} onChange={(e) => setApplyTva(e.target.checked)} className="w-6 h-6 sm:w-5 sm:h-5 accent-blue-600 rounded" />
                  <label htmlFor="tva" className="text-sm font-semibold cursor-pointer">Appliquer TVA</label>
                </div>
                {applyTva && (
                  <div className="flex items-center ml-2">
                    <input type="number" step="0.1" min="0" max="100" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} className="w-20 p-2 border rounded-lg text-center" />
                    <span className="ml-2 text-sm font-bold">%</span>
                  </div>
                )}
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
              <button type="submit" disabled={isSaving} className="w-full md:w-auto px-6 py-3.5 md:py-2.5 font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {isSaving && <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
            </div>
          </form>
        )}
      </main>

      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        defaultPhone={invoice.clientPhone || currentCustomer?.phone || ""}
        defaultEmail={invoice.clientEmail || currentCustomer?.email || ""}
        defaultMessage={shareMessage}
        subject={shareSubject}
        filename={pdfFilename}
        getPdfBlob={getPdfBlob}
        showToast={showToast}
      />
    </div>
  );
}