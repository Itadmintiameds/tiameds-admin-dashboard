"use client";

/**
 * SellerCorrection / [requestId] / page.tsx
 *
 * Seller-facing page — lets the seller re-submit their details
 * after an admin has sent back a "Corrections Needed" decision.
 *
 * Route: /SellerCorrection/[requestId]?sellerId=123
 *
 * What it does:
 *  1. Fetches the existing temp-seller record via GET /temp-sellers/:id
 *  2. Pre-fills every field with the current data
 *  3. Lets the seller edit anything and re-upload files
 *  4. On submit → PATCH /temp-sellers/:id  with FormData
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────
const BASE_URL = "https://api-test-aggreator.tiameds.ai/api/v1";
const API_KEY  = "YOUR_API_KEY";

// ─── Types ────────────────────────────────────────────────────
interface AddressForm {
  buildingNo: string;
  street: string;
  city: string;
  landmark: string;
  pinCode: string;
  stateName: string;
  districtName: string;
  talukaName: string;
}

interface CoordinatorForm {
  name: string;
  designation: string;
  email: string;
  mobile: string;
}

interface BankForm {
  bankName: string;
  branch: string;
  ifscCode: string;
  accountNumber: string;
  accountHolderName: string;
  bankDocumentFile: File | null;
  bankDocumentFileUrl: string;
}

interface DocumentForm {
  productTypeName: string;
  productTypeId: number;
  documentNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  licenseIssuingAuthority: string;
  documentFile: File | null;
  documentFileUrl: string;
  pendingSellerDocumentId?: number | null;
}

interface CorrectionForm {
  sellerName: string;
  phone: string;
  email: string;
  website: string;
  gstNumber: string;
  gstFile: File | null;
  gstFileUrl: string;
  address: AddressForm;
  coordinator: CoordinatorForm;
  bank: BankForm;
  documents: DocumentForm[];
}

interface ReviewHistory {
  id: number;
  comments: string;
  reviewedAt: string;
  reviewedBy: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────
const formatDateForInput = (s: string): string => {
  if (!s || s === "—") return "";
  return s.includes("T") ? s.split("T")[0] : s;
};

// ─── Icons ────────────────────────────────────────────────────
const IconUpload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IconFile = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const IconWarning = () => (
  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const IconSpinner = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

// ─── Field & Section Components ───────────────────────────────
function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-purple-100 shadow-[0_2px_12px_rgba(75,0,130,0.06)] overflow-hidden">
      <div className="px-6 py-4 bg-[#faf7ff] border-b border-purple-100">
        <h2 className="text-base font-bold text-[#2D0066]">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
  fullWidth,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
  error?: string;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-[#4B0082] focus:border-transparent bg-gray-50 focus:bg-white transition-all";

const inputErrorClass =
  "w-full border border-red-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-red-50 focus:bg-white transition-all";

// ─── File Upload Widget ───────────────────────────────────────
function FileUploadField({
  label,
  required,
  existingUrl,
  file,
  onChange,
  accept = "image/*,.pdf",
}: {
  label: string;
  required?: boolean;
  existingUrl?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {existingUrl && !file && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs">
          <IconFile />
          <a
            href={existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4B0082] font-semibold hover:underline truncate max-w-[200px]"
          >
            Current file
          </a>
          <span className="text-gray-400">(will keep unless you upload a new one)</span>
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs">
          <IconCheck />
          <span className="text-green-700 font-semibold truncate max-w-[220px]">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#4B0082]/40 rounded-xl text-xs font-semibold text-[#4B0082] hover:bg-violet-50 hover:border-[#4B0082] transition-all"
      >
        <IconUpload />
        {file ? "Replace file" : existingUrl ? "Upload new file" : "Choose file"}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999 }}
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium
        ${type === "success" ? "bg-green-600" : "bg-red-600"}`}
    >
      {type === "success" ? <IconCheck /> : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  );
}

// ─── Success Screen (full-page, not modal) ────────────────────
function SuccessScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-[#F7F2FB] min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 flex flex-col items-center gap-6 text-center">
        {/* Animated checkmark */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute w-24 h-24 rounded-full bg-green-300 opacity-0"
            style={{ animation: "pulseOut 0.85s ease-out forwards" }}
          />
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 52 52" className="w-12 h-12">
              <circle
                cx="26" cy="26" r="24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                className="text-green-300"
                style={{ strokeDasharray: 150, strokeDashoffset: 0, transition: "stroke-dashoffset 0.55s ease" }}
              />
              <path
                fill="none" stroke="currentColor" strokeWidth="3.5"
                strokeLinecap="round" strokeLinejoin="round"
                d="M14 27l8 8 16-16"
                className="text-green-600"
                style={{ strokeDasharray: 38, strokeDashoffset: 0, transition: "stroke-dashoffset 0.4s ease 0.5s" }}
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Request Submitted!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your updated details have been sent for admin review.
            You'll be notified once the admin verifies your submission.
          </p>
        </div>

        {/* Status pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700">Pending Admin Review</span>
        </div>

        <div className="w-full border-t border-gray-100 pt-6 space-y-3">
          <p className="text-xs text-gray-400">What happens next?</p>
          <div className="text-left space-y-2">
            {[
              "Admin receives your resubmission",
              "Documents & details are verified",
              "You get notified with the final decision",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onBack}
          className="w-full px-6 py-3 bg-[#4B0082] text-white rounded-xl font-semibold text-sm hover:bg-[#3a0066] transition-colors shadow-md"
        >
          Back to dashboard
        </button>
      </div>

      <style>{`
        @keyframes pulseOut {
          0%   { transform: scale(0.8); opacity: 0.3; }
          70%  { transform: scale(1.9); opacity: 0;   }
          100% { transform: scale(1.9); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}

// ─── Page Skeleton ────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-purple-100 p-6">
          <div className="h-4 w-40 bg-gray-200 rounded mb-5" />
          <div className="grid grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((j) => (
              <div key={j}>
                <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-10 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function SellerCorrectionPage({ requestId }: { requestId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sellerId = Number(searchParams.get("sellerId") ?? 0);

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);  // ← drives the success screen
  const [toast, setToast]           = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Admin comment that triggered the correction
  const [adminComment,    setAdminComment]    = useState("");
  const [adminReviewedBy, setAdminReviewedBy] = useState("");
  const [adminReviewedAt, setAdminReviewedAt] = useState("");

  // Validation errors map
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<CorrectionForm>({
    sellerName: "",
    phone: "",
    email: "",
    website: "",
    gstNumber: "",
    gstFile: null,
    gstFileUrl: "",
    address: {
      buildingNo: "", street: "", city: "", landmark: "",
      pinCode: "", stateName: "", districtName: "", talukaName: "",
    },
    coordinator: { name: "", designation: "", email: "", mobile: "" },
    bank: {
      bankName: "", branch: "", ifscCode: "", accountNumber: "",
      accountHolderName: "", bankDocumentFile: null, bankDocumentFileUrl: "",
    },
    documents: [],
  });

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Fetch existing seller data ─────────────────────────────
  useEffect(() => {
    if (!sellerId) { setLoading(false); return; }
    let cancelled = false;

    fetch(`${BASE_URL}/temp-sellers/${sellerId}`, {
      headers: { "X-API-Key": API_KEY },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        const d = json.data ?? json;

        // Find the latest CORRECTION review comment
        const histories: ReviewHistory[] = d.reviewHistories ?? [];
        const correctionHistory = [...histories]
          .reverse()
          .find((h) => h.status?.toUpperCase().includes("CORRECTION"));
        if (correctionHistory) {
          setAdminComment(correctionHistory.comments ?? "");
          setAdminReviewedBy(correctionHistory.reviewedBy ?? "");
          setAdminReviewedAt(correctionHistory.reviewedAt ?? "");
        }

        // Normalise documents
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const docs: DocumentForm[] = (d.documents ?? []).map((doc: any) => {
          const pt = doc.productTypes ?? doc.productType ?? null;
          return {
            productTypeName: doc.productTypeName ?? pt?.productTypeName ?? "",
            productTypeId:   doc.productTypeId   ?? pt?.productTypeId   ?? 0,
            documentNumber:          doc.documentNumber          ?? "",
            licenseIssueDate:        formatDateForInput(doc.licenseIssueDate  ?? ""),
            licenseExpiryDate:       formatDateForInput(doc.licenseExpiryDate ?? ""),
            licenseIssuingAuthority: doc.licenseIssuingAuthority ?? "",
            documentFile: null,
            documentFileUrl: doc.documentFileUrl ?? "",
            pendingSellerDocumentId:
              doc.DocumentsId              ??
              doc.documentsId              ??
              doc.documentId               ??
              doc.pendingSellerDocumentId  ??
              null,
          };
        });

        setForm({
          sellerName: d.sellerName ?? "",
          phone:      d.phone      ?? "",
          email:      d.email      ?? "",
          website:    d.website    ?? "",
          gstNumber:  d.gstNumber  ?? "",
          gstFile:    null,
          gstFileUrl: d.gstFileUrl ?? "",
          address: {
            buildingNo:   d.address?.buildingNo   ?? "",
            street:       d.address?.street       ?? "",
            city:         d.address?.city         ?? "",
            landmark:     d.address?.landmark     ?? "",
            pinCode:      d.address?.pinCode      ?? "",
            stateName:    d.address?.stateName    ?? d.address?.state?.stateName    ?? "",
            districtName: d.address?.districtName ?? d.address?.district?.districtName ?? "",
            talukaName:   d.address?.talukaName   ?? d.address?.taluka?.talukaName   ?? "",
          },
          coordinator: {
            name:        d.coordinator?.name        ?? "",
            designation: d.coordinator?.designation ?? "",
            email:       d.coordinator?.email       ?? "",
            mobile:      d.coordinator?.mobile      ?? "",
          },
          bank: {
            bankName:            d.bankDetails?.bankName            ?? "",
            branch:              d.bankDetails?.branch              ?? "",
            ifscCode:            d.bankDetails?.ifscCode            ?? "",
            accountNumber:       d.bankDetails?.accountNumber       ?? "",
            accountHolderName:   d.bankDetails?.accountHolderName   ?? "",
            bankDocumentFile:    null,
            bankDocumentFileUrl: d.bankDetails?.bankDocumentFileUrl ?? "",
          },
          documents: docs,
        });
      })
      .catch((err) => {
        if (!cancelled) showToast(`Failed to load: ${err.message}`, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sellerId, showToast]);

  // ── Field helpers ──────────────────────────────────────────
  const setField = <K extends keyof CorrectionForm>(key: K, value: CorrectionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
  };

  const setAddress = (key: keyof AddressForm, value: string) => {
    setForm((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }));
    setErrors((prev) => { const n = { ...prev }; delete n[`address.${key}`]; return n; });
  };

  const setCoordinator = (key: keyof CoordinatorForm, value: string) => {
    setForm((prev) => ({ ...prev, coordinator: { ...prev.coordinator, [key]: value } }));
  };

  const setBank = (key: keyof BankForm, value: string | File | null) => {
    setForm((prev) => ({ ...prev, bank: { ...prev.bank, [key]: value } }));
    setErrors((prev) => { const n = { ...prev }; delete n[`bank.${key}`]; return n; });
  };

  const setDoc = (idx: number, key: keyof DocumentForm, value: string | File | null | number) => {
    setForm((prev) => {
      const docs = [...prev.documents];
      docs[idx] = { ...docs[idx], [key]: value };
      return { ...prev, documents: docs };
    });
  };

  // ── Validate ───────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.sellerName.trim())          errs.sellerName          = "Required";
    if (!form.phone.trim())               errs.phone               = "Required";
    if (!form.email.trim())               errs.email               = "Required";
    if (!form.gstNumber.trim())           errs.gstNumber           = "Required";
    if (!form.address.city.trim())        errs["address.city"]     = "Required";
    if (!form.address.pinCode.trim())     errs["address.pinCode"]  = "Required";
    if (!form.bank.bankName.trim())       errs["bank.bankName"]    = "Required";
    if (!form.bank.ifscCode.trim())       errs["bank.ifscCode"]    = "Required";
    if (!form.bank.accountNumber.trim())  errs["bank.accountNumber"] = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit → PATCH /temp-sellers/:id ──────────────────────
  const handleSubmit = async () => {
    if (!validate()) {
      showToast("Please fix the errors before submitting.", "error");
      return;
    }
    if (!sellerId) {
      showToast("Seller ID is missing. Cannot submit.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();

      // ── Basic info ──
      fd.append("sellerName", form.sellerName);
      fd.append("phone",      form.phone);
      fd.append("email",      form.email);
      fd.append("website",    form.website);
      fd.append("gstNumber",  form.gstNumber);
      if (form.gstFile) fd.append("gstFile", form.gstFile);

      // ── Address ──
      Object.entries(form.address).forEach(([k, v]) =>
        fd.append(`address[${k}]`, v)
      );

      // ── Coordinator ──
      Object.entries(form.coordinator).forEach(([k, v]) =>
        fd.append(`coordinator[${k}]`, v)
      );

      // ── Bank ──
      fd.append("bankDetails[bankName]",          form.bank.bankName);
      fd.append("bankDetails[branch]",            form.bank.branch);
      fd.append("bankDetails[ifscCode]",          form.bank.ifscCode);
      fd.append("bankDetails[accountNumber]",     form.bank.accountNumber);
      fd.append("bankDetails[accountHolderName]", form.bank.accountHolderName);
      if (form.bank.bankDocumentFile)
        fd.append("bankDocumentFile", form.bank.bankDocumentFile);

      // ── Documents ──
      form.documents.forEach((doc, i) => {
        fd.append(`documents[${i}][productTypeId]`,            String(doc.productTypeId));
        fd.append(`documents[${i}][documentNumber]`,           doc.documentNumber);
        fd.append(`documents[${i}][licenseIssueDate]`,         doc.licenseIssueDate);
        fd.append(`documents[${i}][licenseExpiryDate]`,        doc.licenseExpiryDate);
        fd.append(`documents[${i}][licenseIssuingAuthority]`,  doc.licenseIssuingAuthority);
        if (doc.pendingSellerDocumentId != null)
          fd.append(`documents[${i}][pendingSellerDocumentId]`, String(doc.pendingSellerDocumentId));
        if (doc.documentFile)
          fd.append(`documentFile_${i}`, doc.documentFile);
      });

      // ── PATCH /temp-sellers/:tempSellerId ──
      const res = await fetch(`${BASE_URL}/temp-sellers/${sellerId}`, {
        method: "PATCH",
        headers: { "X-API-Key": API_KEY },
        // Note: Do NOT set Content-Type — browser sets it with the boundary automatically
        body: fd,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { message?: string }).message ??
          `${res.status} ${res.statusText}`
        );
      }

      // ── Show full-page success screen ──
      setSubmitted(true);
    } catch (err) {
      showToast(
        `Submission failed: ${err instanceof Error ? err.message : "unknown error"}`,
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Format admin timestamp (IST) ──────────────────────────
  const formatIST = (s: string) => {
    if (!s) return "";
    const d = new Date(s.includes("T") && !s.endsWith("Z") ? s + "Z" : s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // ── If submitted, show the success screen instead ─────────
  if (submitted) {
    return <SuccessScreen onBack={() => router.back()} />;
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <main className="bg-[#F7F2FB] min-h-screen pt-10 px-4 sm:px-6 pb-16">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* ── Header ─────────────────────────────────────── */}
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] px-7 py-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Corrections Needed
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-[#2D0066] mt-1">Resubmit Your Details</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Update the sections flagged below and resubmit for review.
                </p>
              </div>
              <div className="bg-[#faf7ff] border border-purple-100 rounded-xl px-4 py-2 text-right">
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Request ID</p>
                <p className="text-sm font-bold text-[#2D0066]">{requestId}</p>
              </div>
            </div>
          </div>

          {/* ── Admin feedback banner ───────────────────────── */}
          {adminComment && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <IconWarning />
                <span className="text-sm font-bold text-amber-800">Admin feedback — what to fix</span>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{adminComment}</p>
                {(adminReviewedBy || adminReviewedAt) && (
                  <p className="text-xs text-gray-400 mt-3">
                    — {adminReviewedBy}{adminReviewedAt ? ` · ${formatIST(adminReviewedAt)}` : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Form ───────────────────────────────────────── */}
          {loading ? (
            <PageSkeleton />
          ) : (
            <>
              {/* 1. Company Info */}
              <SectionCard title="Company Information" subtitle="Update your business details">
                <Field label="Company / Seller name" required error={errors.sellerName}>
                  <input type="text" value={form.sellerName}
                    onChange={(e) => setField("sellerName", e.target.value)}
                    placeholder="e.g. Acme Pharma Pvt. Ltd."
                    className={errors.sellerName ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Phone" required error={errors.phone}>
                  <input type="tel" value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    className={errors.phone ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Email" required error={errors.email}>
                  <input type="email" value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="you@company.com"
                    className={errors.email ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Website">
                  <input type="url" value={form.website}
                    onChange={(e) => setField("website", e.target.value)}
                    placeholder="https://yourcompany.com"
                    className={inputClass} />
                </Field>

                <Field label="Building / Door no.">
                  <input type="text" value={form.address.buildingNo}
                    onChange={(e) => setAddress("buildingNo", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="Street">
                  <input type="text" value={form.address.street}
                    onChange={(e) => setAddress("street", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="City" required error={errors["address.city"]}>
                  <input type="text" value={form.address.city}
                    onChange={(e) => setAddress("city", e.target.value)}
                    className={errors["address.city"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Pin code" required error={errors["address.pinCode"]}>
                  <input type="text" value={form.address.pinCode}
                    onChange={(e) => setAddress("pinCode", e.target.value)}
                    maxLength={6}
                    className={errors["address.pinCode"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="State">
                  <input type="text" value={form.address.stateName}
                    onChange={(e) => setAddress("stateName", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="District">
                  <input type="text" value={form.address.districtName}
                    onChange={(e) => setAddress("districtName", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="Taluka">
                  <input type="text" value={form.address.talukaName}
                    onChange={(e) => setAddress("talukaName", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="Landmark">
                  <input type="text" value={form.address.landmark}
                    onChange={(e) => setAddress("landmark", e.target.value)}
                    className={inputClass} />
                </Field>
              </SectionCard>

              {/* 2. GST & License Docs */}
              <SectionCard title="GST & Compliance" subtitle="Ensure your GST certificate is clear and valid">
                <Field label="GST number" required error={errors.gstNumber}>
                  <input type="text" value={form.gstNumber}
                    onChange={(e) => setField("gstNumber", e.target.value.toUpperCase())}
                    maxLength={15} placeholder="22AAAAA0000A1Z5"
                    className={errors.gstNumber ? inputErrorClass : inputClass} />
                </Field>

                <FileUploadField
                  label="GST certificate"
                  existingUrl={form.gstFileUrl}
                  file={form.gstFile}
                  onChange={(f) => setField("gstFile", f)}
                />

                {form.documents.map((doc, idx) => (
                  <div key={idx} className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-5 mt-1 border-t border-purple-50">
                    <div className="md:col-span-2">
                      <p className="text-xs font-bold text-[#4B0082] uppercase tracking-wide">
                        License — {doc.productTypeName || `Document ${idx + 1}`}
                      </p>
                    </div>

                    <Field label="Document number">
                      <input type="text" value={doc.documentNumber}
                        onChange={(e) => setDoc(idx, "documentNumber", e.target.value)}
                        className={inputClass} />
                    </Field>

                    <Field label="Issuing authority">
                      <input type="text" value={doc.licenseIssuingAuthority}
                        onChange={(e) => setDoc(idx, "licenseIssuingAuthority", e.target.value)}
                        className={inputClass} />
                    </Field>

                    <Field label="Issue date">
                      <input type="date" value={doc.licenseIssueDate}
                        onChange={(e) => setDoc(idx, "licenseIssueDate", e.target.value)}
                        className={inputClass} />
                    </Field>

                    <Field label="Expiry date">
                      <input type="date" value={doc.licenseExpiryDate}
                        onChange={(e) => setDoc(idx, "licenseExpiryDate", e.target.value)}
                        className={inputClass} />
                    </Field>

                    <FileUploadField
                      label="License file"
                      existingUrl={doc.documentFileUrl}
                      file={doc.documentFile}
                      onChange={(f) => setDoc(idx, "documentFile", f)}
                    />
                  </div>
                ))}
              </SectionCard>

              {/* 3. Coordinator */}
              <SectionCard title="Coordinator Details" subtitle="Primary contact for communication">
                <Field label="Full name">
                  <input type="text" value={form.coordinator.name}
                    onChange={(e) => setCoordinator("name", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="Designation">
                  <input type="text" value={form.coordinator.designation}
                    onChange={(e) => setCoordinator("designation", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="Email">
                  <input type="email" value={form.coordinator.email}
                    onChange={(e) => setCoordinator("email", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="Mobile">
                  <input type="tel" value={form.coordinator.mobile}
                    onChange={(e) => setCoordinator("mobile", e.target.value)}
                    className={inputClass} />
                </Field>
              </SectionCard>

              {/* 4. Bank */}
              <SectionCard title="Bank Account Details" subtitle="Upload a clear cancelled cheque or bank statement">
                <Field label="Bank name" required error={errors["bank.bankName"]}>
                  <input type="text" value={form.bank.bankName}
                    onChange={(e) => setBank("bankName", e.target.value)}
                    className={errors["bank.bankName"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Branch">
                  <input type="text" value={form.bank.branch}
                    onChange={(e) => setBank("branch", e.target.value)}
                    className={inputClass} />
                </Field>

                <Field label="IFSC code" required error={errors["bank.ifscCode"]}>
                  <input type="text" value={form.bank.ifscCode}
                    onChange={(e) => setBank("ifscCode", e.target.value.toUpperCase())}
                    maxLength={11} placeholder="SBIN0001234"
                    className={errors["bank.ifscCode"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Account number" required error={errors["bank.accountNumber"]}>
                  <input type="text" value={form.bank.accountNumber}
                    onChange={(e) => setBank("accountNumber", e.target.value)}
                    className={errors["bank.accountNumber"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Account holder name">
                  <input type="text" value={form.bank.accountHolderName}
                    onChange={(e) => setBank("accountHolderName", e.target.value)}
                    className={inputClass} />
                </Field>

                <FileUploadField
                  label="Bank document (cancelled cheque / passbook)"
                  existingUrl={form.bank.bankDocumentFileUrl}
                  file={form.bank.bankDocumentFile}
                  onChange={(f) => setBank("bankDocumentFile", f)}
                />
              </SectionCard>

              {/* ── Submit bar ─────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  <span className="text-red-500 font-semibold">*</span> Required fields must be filled before submitting.
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={submitting}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-7 py-2.5 bg-[#4B0082] hover:bg-[#3a0066] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center gap-2 shadow-md hover:shadow-lg"
                  >
                    {submitting ? (
                      <>
                        <IconSpinner className="w-4 h-4" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <IconCheck />
                        Resubmit for review
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Floating back button */}
      <button
        onClick={() => router.back()}
        className="fixed left-5 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 group"
        aria-label="Go back"
      >
        <div className="w-10 h-10 rounded-full bg-white border border-purple-200 shadow-lg flex items-center justify-center text-[#4B0082] group-hover:bg-[#4B0082] group-hover:text-white group-hover:border-[#4B0082] group-hover:shadow-xl transition-all duration-200 active:scale-90">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <span className="text-[10px] font-semibold text-[#4B0082] group-hover:text-[#2D0066] transition-colors opacity-0 group-hover:opacity-100 bg-white px-1.5 py-0.5 rounded shadow-sm border border-purple-100 whitespace-nowrap">
          Back
        </span>
      </button>
    </>
  );
}