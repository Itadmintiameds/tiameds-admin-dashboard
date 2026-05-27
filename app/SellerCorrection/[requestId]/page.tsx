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
import { useState, useEffect, useCallback, useRef } from "react";

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

interface RefIds {
  stateId: number;
  districtId: number;
  talukaId: number;
  companyTypeId: number;
  sellerTypeId: number;
  productTypeIds: number[];
  companyRegistrationCertificateUrl: string;
  termsAccepted: boolean;
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
  bankDocumentFileUrl: string;
}

interface DocumentForm {
  productTypeName: string;
  productTypeId: number;
  documentNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  licenseIssuingAuthority: string;
  documentFileUrl: string;
  pendingSellerDocumentId?: number | null;
}

interface FileUploads {
  gstFile: File | null;
  bankFile: File | null;
  sellerImage: File | null;
  companyRegistrationCertificate: File | null;
  licenseFiles: (File | null)[];
}

type DupStatus = "idle" | "checking" | "taken" | "ok";

interface CorrectionForm {
  sellerName: string;
  phone: string;
  email: string;
  website: string;
  gstNumber: string;
  gstFileUrl: string;
  sellerImageUrl: string;
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
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
      <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-[#faf7ff] to-white border-b border-purple-100 flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-[#4B0082]/10 flex items-center justify-center text-[#4B0082] flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-base font-bold text-[#2D0066]">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 sm:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
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
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-[#4B0082] focus:border-transparent bg-gray-50 focus:bg-white transition-all";

const inputErrorClass =
  "w-full border border-red-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-red-50 focus:bg-white transition-all";

// ─── File Upload Field ────────────────────────────────────────
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const showExisting = !!existingUrl && !file;
  const isImg = existingUrl ? isImageUrl(existingUrl) : false;
  const fileName = existingUrl
    ? decodeURIComponent(existingUrl.split("/").pop()?.split("?")[0] ?? "Current file")
    : "";

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Existing file preview */}
      {showExisting && (
        <a
          href={existingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-2 rounded-xl overflow-hidden border border-violet-200 hover:border-[#4B0082] transition-colors group"
        >
          {isImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existingUrl}
              alt={label}
              className="w-full max-h-40 object-contain bg-gray-50 p-1"
            />
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 text-xs">
            <IconFile />
            <span className="text-[#4B0082] font-semibold truncate max-w-[200px] group-hover:underline">
              {fileName}
            </span>
            <span className="ml-auto text-gray-400 shrink-0">View ↗</span>
          </div>
        </a>
      )}

      {/* New file selected preview */}
      {file && (
        <div className="mb-2 rounded-xl overflow-hidden border border-green-200">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="w-full max-h-40 object-contain bg-gray-50 p-1" />
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-xs">
            <IconCheck />
            <span className="text-green-700 font-semibold truncate max-w-[200px]">{file.name}</span>
            <button type="button" onClick={() => onChange(null)}
              className="ml-auto text-gray-400 hover:text-red-500 transition-colors shrink-0">✕</button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => ref.current?.click()}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#4B0082]/40 rounded-xl text-xs font-semibold text-[#4B0082] hover:bg-violet-50 hover:border-[#4B0082] transition-all">
        <IconUpload />
        {file ? "Replace file" : existingUrl ? "Upload new file" : "Choose file"}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}

// ─── Duplicate-check inline hint ─────────────────────────────
function DupHint({ status }: { status: DupStatus }) {
  if (status === "checking")
    return <p className="mt-1 text-xs text-gray-400 flex items-center gap-1"><IconSpinner className="w-3 h-3" /> Checking availability…</p>;
  if (status === "taken")
    return <p className="mt-1 text-xs text-red-500 font-semibold">Already registered by another seller</p>;
  if (status === "ok")
    return <p className="mt-1 text-xs text-green-600 font-semibold">✓ Available</p>;
  return null;
}

// ─── Access Denied Screen ─────────────────────────────────────
function AccessDeniedScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F2FB] via-white to-purple-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-red-400 via-red-500 to-rose-500" />
        <div className="p-8 sm:p-10 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onBack}
            className="w-full py-3.5 bg-[#4B0082] text-white rounded-xl font-semibold text-sm hover:bg-[#3a0066] transition-all shadow-md hover:shadow-lg"
          >
            Go Back
          </button>
        </div>
      </div>
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

// ─── Success Screen ───────────────────────────────────────────
function SuccessScreen({ onBack }: { onBack: () => void }) {
  const steps = [
    { icon: "📨", title: "Submitted", desc: "Admin has received your corrected details" },
    { icon: "🔍", title: "Under Review", desc: "Documents and info are being verified" },
    { icon: "🔔", title: "Decision", desc: "You'll be notified with the final outcome" },
  ];

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#F7F2FB] via-white to-purple-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Gradient top bar */}
          <div className="h-1.5 bg-gradient-to-r from-[#4B0082] via-purple-500 to-indigo-400" />

          <div className="px-6 sm:px-10 py-7 sm:py-8 flex flex-col items-center text-center gap-5">
            {/* Checkmark */}
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-20 h-20 rounded-full bg-green-300 opacity-0"
                style={{ animation: "pulseOut 0.9s ease-out forwards" }}
              />
              <div className="relative w-16 h-16 bg-green-100 rounded-full flex items-center justify-center shadow-md">
                <svg viewBox="0 0 52 52" className="w-10 h-10">
                  <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-200" />
                  <path fill="none" stroke="currentColor" strokeWidth="4"
                    strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16"
                    className="text-green-600"
                    style={{ strokeDasharray: 40, strokeDashoffset: 0, animation: "drawCheck 0.5s ease 0.3s both" }} />
                </svg>
              </div>
            </div>

            {/* Title & description */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Corrections Submitted!</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Your updated details have been sent to the admin for review.
              </p>
            </div>

            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700">Pending Admin Review</span>
            </div>

            {/* Steps */}
            <div className="w-full grid grid-cols-3 gap-3">
              {steps.map((step, i) => (
                <div key={i} className="relative flex flex-col items-center gap-2 p-3 sm:p-4 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                  {i < steps.length - 1 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                      <div className="w-4 h-4 rounded-full bg-white border-2 border-purple-200 flex items-center justify-center">
                        <svg className="w-2 h-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-white border border-purple-200 shadow-sm flex items-center justify-center text-lg">
                    {step.icon}
                  </div>
                  <p className="text-xs font-bold text-[#2D0066] leading-tight">{step.title}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={onBack}
              className="w-full py-3.5 bg-[#4B0082] hover:bg-[#3a0066] text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Thank You
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulseOut {
          0%   { transform: scale(0.8); opacity: 0.4; }
          60%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 40; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Page Skeleton ────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
          <div className="px-8 py-5 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-xl" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((j) => (
              <div key={j}>
                <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-12 bg-gray-100 rounded-xl" />
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
  const [submitted, setSubmitted]   = useState(false);
  const [toast, setToast]           = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [sellerStatus, setSellerStatus] = useState("");

  // Reference IDs preserved from the original API response (not editable via form fields)
  const [refIds, setRefIds] = useState<RefIds>({
    stateId: 0, districtId: 0, talukaId: 0,
    companyTypeId: 1, sellerTypeId: 1, productTypeIds: [],
    companyRegistrationCertificateUrl: "", termsAccepted: true,
  });

  const [adminComment,    setAdminComment]    = useState("");
  const [adminReviewedBy, setAdminReviewedBy] = useState("");
  const [adminReviewedAt, setAdminReviewedAt] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fileUploads, setFileUploads] = useState<FileUploads>({
    gstFile: null, bankFile: null, sellerImage: null,
    companyRegistrationCertificate: null, licenseFiles: [],
  });

  const [dupChecks, setDupChecks] = useState<{
    gstNumber: DupStatus; email: DupStatus; phone: DupStatus;
    docNumbers: Record<number, DupStatus>;
  }>({ gstNumber: "idle", email: "idle", phone: "idle", docNumbers: {} });

  const [originalValues, setOriginalValues] = useState({
    gstNumber: "", email: "", phone: "", docNumbers: {} as Record<number, string>,
  });

  const dupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [form, setForm] = useState<CorrectionForm>({
    sellerName: "",
    phone: "",
    email: "",
    website: "",
    gstNumber: "",
    gstFileUrl: "",
    sellerImageUrl: "",
    address: {
      buildingNo: "", street: "", city: "", landmark: "",
      pinCode: "", stateName: "", districtName: "", talukaName: "",
    },
    coordinator: { name: "", designation: "", email: "", mobile: "" },
    bank: {
      bankName: "", branch: "", ifscCode: "", accountNumber: "",
      accountHolderName: "", bankDocumentFileUrl: "",
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

        // Capture status for access control
        setSellerStatus((d.status ?? "").toUpperCase());

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

        // Store reference IDs that can't be edited via text fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawPts: any[] = Array.isArray(d.productTypes) ? d.productTypes : [];
        const productTypeIds: number[] = rawPts.length > 0
          ? rawPts.map((pt: { productTypeId?: number; id?: number }) => pt.productTypeId ?? pt.id ?? 0).filter(Boolean)
          : (d.documents ?? []).map((doc: { productTypeId?: number }) => doc.productTypeId ?? 0).filter(Boolean);

        setRefIds({
          stateId:    d.address?.stateId    ?? d.address?.state?.stateId    ?? 0,
          districtId: d.address?.districtId ?? d.address?.district?.districtId ?? 0,
          talukaId:   d.address?.talukaId   ?? d.address?.taluka?.talukaId   ?? 0,
          companyTypeId: d.companyTypeId ?? d.companyType?.companyTypeId ?? 1,
          sellerTypeId:  d.sellerTypeId  ?? d.sellerType?.sellerTypeId  ?? 1,
          productTypeIds,
          companyRegistrationCertificateUrl: d.companyRegistrationCertificateUrl ?? "",
          termsAccepted: d.termsAccepted ?? true,
        });

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
            documentFileUrl: doc.documentFileUrl ?? doc.fileUrl ?? doc.licenseFileUrl ?? doc.documentUrl ?? "",
            pendingSellerDocumentId:
              doc.DocumentsId              ??
              doc.documentsId              ??
              doc.documentId               ??
              doc.pendingSellerDocumentId  ??
              null,
          };
        });

        // Init per-document file slots and record originals for dup-check skipping
        setFileUploads(prev => ({ ...prev, licenseFiles: new Array(docs.length).fill(null) }));
        setOriginalValues({
          gstNumber: d.gstNumber ?? "",
          email:     d.email     ?? "",
          phone:     d.phone     ?? "",
          docNumbers: Object.fromEntries(docs.map((doc, i) => [i, doc.documentNumber])),
        });

        setForm({
          sellerName:     d.sellerName     ?? "",
          phone:          d.phone          ?? "",
          email:          d.email          ?? "",
          website:        d.website        ?? "",
          gstNumber:      d.gstNumber      ?? "",
          gstFileUrl:     d.gstFileUrl     ?? d.gstCertificateUrl ?? d.gstDocumentUrl ?? "",
          sellerImageUrl: d.sellerImageUrl ?? d.imageUrl          ?? d.profileImageUrl ?? d.sellerImage ?? "",
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
            bankDocumentFileUrl: d.bankDetails?.bankDocumentFileUrl ?? d.bankDetails?.bankDocumentUrl ?? d.bankDetails?.documentUrl ?? "",
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

  const setBank = (key: keyof BankForm, value: string) => {
    setForm((prev) => ({ ...prev, bank: { ...prev.bank, [key]: value } }));
    setErrors((prev) => { const n = { ...prev }; delete n[`bank.${key}`]; return n; });
  };

  const setDoc = (idx: number, key: keyof DocumentForm, value: string | number) => {
    setForm((prev) => {
      const docs = [...prev.documents];
      docs[idx] = { ...docs[idx], [key]: value };
      return { ...prev, documents: docs };
    });
  };

  const setLicenseFile = (idx: number, file: File | null) => {
    setFileUploads(prev => {
      const files = [...prev.licenseFiles];
      files[idx] = file;
      return { ...prev, licenseFiles: files };
    });
  };

  // ── Duplicate checks (debounced, skipped if value unchanged) ──
  const checkDuplicate = useCallback((
    field: string,
    value: string,
    original: string,
    endpoint: string,
    onResult: (s: DupStatus) => void,
  ) => {
    if (!value.trim() || value.trim().toLowerCase() === original.trim().toLowerCase()) {
      onResult("idle"); return;
    }
    if (dupTimers.current[field]) clearTimeout(dupTimers.current[field]);
    onResult("checking");
    dupTimers.current[field] = setTimeout(async () => {
      try {
        const res  = await fetch(`${BASE_URL}${endpoint}`, { headers: { "X-API-Key": API_KEY } });
        const json = await res.json();
        const taken =
          json.exists === true || json.available === false ||
          json.isDuplicate === true || json.isExists === true ||
          (typeof json.data === "boolean" && json.data) ||
          res.status === 409;
        onResult(taken ? "taken" : "ok");
      } catch { onResult("idle"); }
    }, 600);
  }, []);

  // ── Validate ───────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.sellerName.trim())          errs.sellerName            = "Required";
    if (!form.phone.trim())               errs.phone                 = "Required";
    if (!form.email.trim())               errs.email                 = "Required";
    if (!form.gstNumber.trim())           errs.gstNumber             = "Required";
    if (!form.address.city.trim())        errs["address.city"]       = "Required";
    if (!form.address.pinCode.trim())     errs["address.pinCode"]    = "Required";
    if (!form.bank.bankName.trim())       errs["bank.bankName"]      = "Required";
    if (!form.bank.ifscCode.trim())       errs["bank.ifscCode"]      = "Required";
    if (!form.bank.accountNumber.trim())  errs["bank.accountNumber"] = "Required";
    // Block if duplicate-check flagged a conflict
    if (dupChecks.gstNumber === "taken")  errs.gstNumber = "Already registered by another seller";
    if (dupChecks.email     === "taken")  errs.email     = "Already registered by another seller";
    if (dupChecks.phone     === "taken")  errs.phone     = "Already registered by another seller";
    Object.entries(dupChecks.docNumbers).forEach(([idx, status]) => {
      if (status === "taken") errs[`doc_${idx}_number`] = "Already registered";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit → PUT /temp-sellers/:id ────────────────────────
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
      const body = {
        sellerName: form.sellerName,
        productTypeId: refIds.productTypeIds,
        companyTypeId: refIds.companyTypeId,
        sellerTypeId:  refIds.sellerTypeId,
        phone:    form.phone,
        email:    form.email,
        website:  form.website,
        gstNumber: form.gstNumber,
        gstFileUrl: form.gstFileUrl,
        termsAccepted: refIds.termsAccepted,
        companyRegistrationCertificateUrl: refIds.companyRegistrationCertificateUrl,
        address: {
          stateId:    refIds.stateId,
          districtId: refIds.districtId,
          talukaId:   refIds.talukaId,
          city:       form.address.city,
          street:     form.address.street,
          buildingNo: form.address.buildingNo,
          landmark:   form.address.landmark,
          pinCode:    form.address.pinCode,
        },
        coordinator: {
          name:        form.coordinator.name,
          designation: form.coordinator.designation,
          email:       form.coordinator.email,
          mobile:      form.coordinator.mobile,
        },
        bankDetails: {
          bankName:           form.bank.bankName,
          branch:             form.bank.branch,
          ifscCode:           form.bank.ifscCode,
          accountNumber:      form.bank.accountNumber,
          accountHolderName:  form.bank.accountHolderName,
          bankDocumentFileUrl: form.bank.bankDocumentFileUrl,
        },
        documents: form.documents.map((doc) => ({
          productTypeId:           doc.productTypeId,
          documentNumber:          doc.documentNumber,
          documentFileUrl:         doc.documentFileUrl,
          licenseIssueDate:        doc.licenseIssueDate,
          licenseExpiryDate:       doc.licenseExpiryDate,
          licenseIssuingAuthority: doc.licenseIssuingAuthority,
        })),
      };

      const res = await fetch(`${BASE_URL}/temp-sellers/${sellerId}`, {
        method: "PUT",
        headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { message?: string }).message ??
          `${res.status} ${res.statusText}`
        );
      }

      // ── Upload files if any were selected ─────────────────
      const { gstFile, bankFile, sellerImage, companyRegistrationCertificate, licenseFiles } = fileUploads;
      const hasFiles = gstFile || bankFile || sellerImage ||
        companyRegistrationCertificate || licenseFiles.some(Boolean);

      if (hasFiles) {
        const fd = new FormData();
        if (gstFile)                        fd.append("gstFile", gstFile);
        if (bankFile)                       fd.append("bankFile", bankFile);
        if (sellerImage)                    fd.append("sellerImage", sellerImage);
        if (companyRegistrationCertificate) fd.append("companyRegistrationCertificate", companyRegistrationCertificate);

        const licenseNames: string[] = [];
        const documentIds: string[]  = [];
        licenseFiles.forEach((file, idx) => {
          if (!file || !form.documents[idx]) return;
          fd.append("licenseFiles", file);
          licenseNames.push(form.documents[idx].productTypeName || `Document ${idx + 1}`);
          if (form.documents[idx].pendingSellerDocumentId != null)
            documentIds.push(String(form.documents[idx].pendingSellerDocumentId));
        });
        if (licenseNames.length) fd.append("licenseNames", licenseNames.join(","));
        if (documentIds.length)  fd.append("documentIds",  documentIds.join(","));

        const uploadRes = await fetch(`${BASE_URL}/temp-sellers/${sellerId}/documents/upload`, {
          method: "POST",
          headers: { "X-API-Key": API_KEY },
          body: fd,
        });
        if (!uploadRes.ok) {
          const j = await uploadRes.json().catch(() => ({}));
          throw new Error((j as { message?: string }).message ?? `File upload failed: ${uploadRes.status}`);
        }
      }

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

  // ── Status-gate: block access unless CORRECTION_REQUIRED ──
  if (!loading && sellerStatus) {
    if (sellerStatus === "REJECTED") {
      return <AccessDeniedScreen
        message="You are not allowed to update this application because it is already rejected."
        onBack={() => router.back()}
      />;
    }
    if (sellerStatus === "APPROVED") {
      return <AccessDeniedScreen
        message="You are not allowed to update this application because it is already approved."
        onBack={() => router.back()}
      />;
    }
    if (sellerStatus === "RESUBMITTED" || sellerStatus === "OPEN") {
      return <AccessDeniedScreen
        message="You are not allowed to update this application because it is currently under admin review."
        onBack={() => router.back()}
      />;
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <main className="min-h-screen bg-gradient-to-br from-[#F7F2FB] via-white to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Header ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 px-6 sm:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="w-10 h-10 rounded-xl border border-purple-200 flex items-center justify-center text-[#4B0082] hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082] transition-all flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Corrections Needed
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#2D0066]">Resubmit Your Details</h1>
                  <p className="text-gray-500 text-sm mt-0.5">Review the feedback below and update the relevant sections.</p>
                </div>
              </div>
              <div className="flex-shrink-0 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 sm:text-right">
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Request ID</p>
                <p className="text-base font-bold text-[#2D0066] mt-0.5">{requestId}</p>
              </div>
            </div>
          </div>

          {/* ── Admin feedback banner ───────────────────────── */}
          {adminComment && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-6 sm:px-8 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <IconWarning />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800">Admin Feedback</p>
                  <p className="text-xs text-amber-600">Please address the points below before resubmitting.</p>
                </div>
              </div>
              <div className="px-6 sm:px-8 py-5">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{adminComment}</p>
                {(adminReviewedBy || adminReviewedAt) && (
                  <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
                    Reviewed by {adminReviewedBy}{adminReviewedAt ? ` · ${formatIST(adminReviewedAt)}` : ""}
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
              {/* 1. Company Information */}
              <SectionCard
                title="Company Information"
                subtitle="Update your business and contact details"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              >
                <Field label="Company / Seller name" required error={errors.sellerName}>
                  <input type="text" value={form.sellerName}
                    onChange={(e) => setField("sellerName", e.target.value)}
                    placeholder="e.g. Acme Pharma Pvt. Ltd."
                    className={errors.sellerName ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Phone" required error={errors.phone}>
                  <input type="tel" value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    onBlur={(e) => checkDuplicate("phone", e.target.value, originalValues.phone,
                      `/temp-sellers/coordinator/check-phone?mobile=${encodeURIComponent(e.target.value)}`,
                      (s) => setDupChecks(p => ({ ...p, phone: s })))}
                    placeholder="+91 98765 43210"
                    className={errors.phone ? inputErrorClass : inputClass} />
                  <DupHint status={dupChecks.phone} />
                </Field>

                <Field label="Email" required error={errors.email}>
                  <input type="email" value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    onBlur={(e) => checkDuplicate("email", e.target.value, originalValues.email,
                      `/temp-sellers/coordinator/check-email?email=${encodeURIComponent(e.target.value)}`,
                      (s) => setDupChecks(p => ({ ...p, email: s })))}
                    placeholder="you@company.com"
                    className={errors.email ? inputErrorClass : inputClass} />
                  <DupHint status={dupChecks.email} />
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
                    placeholder="Flat / Building no."
                    className={inputClass} />
                </Field>

                <Field label="Street">
                  <input type="text" value={form.address.street}
                    onChange={(e) => setAddress("street", e.target.value)}
                    placeholder="Street / Road name"
                    className={inputClass} />
                </Field>

                <Field label="City" required error={errors["address.city"]}>
                  <input type="text" value={form.address.city}
                    onChange={(e) => setAddress("city", e.target.value)}
                    placeholder="City"
                    className={errors["address.city"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Pin code" required error={errors["address.pinCode"]}>
                  <input type="text" value={form.address.pinCode}
                    onChange={(e) => setAddress("pinCode", e.target.value)}
                    maxLength={6} placeholder="6-digit PIN"
                    className={errors["address.pinCode"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="State">
                  <input type="text" value={form.address.stateName}
                    onChange={(e) => setAddress("stateName", e.target.value)}
                    placeholder="State"
                    className={inputClass} />
                </Field>

                <Field label="District">
                  <input type="text" value={form.address.districtName}
                    onChange={(e) => setAddress("districtName", e.target.value)}
                    placeholder="District"
                    className={inputClass} />
                </Field>

                <Field label="Taluka">
                  <input type="text" value={form.address.talukaName}
                    onChange={(e) => setAddress("talukaName", e.target.value)}
                    placeholder="Taluka"
                    className={inputClass} />
                </Field>

                <Field label="Landmark">
                  <input type="text" value={form.address.landmark}
                    onChange={(e) => setAddress("landmark", e.target.value)}
                    placeholder="Near landmark"
                    className={inputClass} />
                </Field>

                <FileUploadField
                  label="Seller / company image"
                  existingUrl={form.sellerImageUrl}
                  file={fileUploads.sellerImage}
                  onChange={(f) => setFileUploads(prev => ({ ...prev, sellerImage: f }))}
                  accept="image/*"
                />
              </SectionCard>

              {/* 2. GST & Compliance */}
              <SectionCard
                title="GST & Compliance"
                subtitle="Ensure GST certificate and licenses are clear and valid"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
              >
                <Field label="GST number" required error={errors.gstNumber}>
                  <input type="text" value={form.gstNumber}
                    onChange={(e) => setField("gstNumber", e.target.value.toUpperCase())}
                    onBlur={(e) => checkDuplicate("gstNumber", e.target.value, originalValues.gstNumber,
                      `/temp-sellers/coordinator/check-gstnumber?gstnumber=${encodeURIComponent(e.target.value)}`,
                      (s) => setDupChecks(p => ({ ...p, gstNumber: s })))}
                    maxLength={15} placeholder="22AAAAA0000A1Z5"
                    className={errors.gstNumber ? inputErrorClass : inputClass} />
                  <DupHint status={dupChecks.gstNumber} />
                </Field>

                <FileUploadField
                  label="GST certificate"
                  existingUrl={form.gstFileUrl}
                  file={fileUploads.gstFile}
                  onChange={(f) => setFileUploads(prev => ({ ...prev, gstFile: f }))}
                />

                <FileUploadField
                  label="Company registration certificate"
                  existingUrl={refIds.companyRegistrationCertificateUrl}
                  file={fileUploads.companyRegistrationCertificate}
                  onChange={(f) => setFileUploads(prev => ({ ...prev, companyRegistrationCertificate: f }))}
                />

                {form.documents.map((doc, idx) => (
                  <div key={idx} className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 pt-5 mt-2 border-t border-purple-100">
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#4B0082]" />
                      <p className="text-xs font-bold text-[#4B0082] uppercase tracking-wider">
                        License — {doc.productTypeName || `Document ${idx + 1}`}
                      </p>
                    </div>

                    <Field label="Document number" error={errors[`doc_${idx}_number`]}>
                      <input type="text" value={doc.documentNumber}
                        onChange={(e) => setDoc(idx, "documentNumber", e.target.value)}
                        onBlur={(e) => checkDuplicate(`doc_${idx}`, e.target.value,
                          originalValues.docNumbers[idx] ?? "",
                          `/temp-sellers/coordinator/check-document?documentnumber=${encodeURIComponent(e.target.value)}`,
                          (s) => setDupChecks(p => ({ ...p, docNumbers: { ...p.docNumbers, [idx]: s } })))}
                        placeholder="Document number"
                        className={errors[`doc_${idx}_number`] ? inputErrorClass : inputClass} />
                      <DupHint status={dupChecks.docNumbers[idx] ?? "idle"} />
                    </Field>

                    <Field label="Issuing authority">
                      <input type="text" value={doc.licenseIssuingAuthority}
                        onChange={(e) => setDoc(idx, "licenseIssuingAuthority", e.target.value)}
                        placeholder="Issuing authority"
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
                      file={fileUploads.licenseFiles[idx] ?? null}
                      onChange={(f) => setLicenseFile(idx, f)}
                    />
                  </div>
                ))}
              </SectionCard>

              {/* 3. Coordinator Details */}
              <SectionCard
                title="Coordinator Details"
                subtitle="Primary contact person for this application"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              >
                <Field label="Full name">
                  <input type="text" value={form.coordinator.name}
                    onChange={(e) => setCoordinator("name", e.target.value)}
                    placeholder="Full name"
                    className={inputClass} />
                </Field>

                <Field label="Designation">
                  <input type="text" value={form.coordinator.designation}
                    onChange={(e) => setCoordinator("designation", e.target.value)}
                    placeholder="e.g. Manager"
                    className={inputClass} />
                </Field>

                <Field label="Email">
                  <input type="email" value={form.coordinator.email}
                    onChange={(e) => setCoordinator("email", e.target.value)}
                    placeholder="coordinator@company.com"
                    className={inputClass} />
                </Field>

                <Field label="Mobile">
                  <input type="tel" value={form.coordinator.mobile}
                    onChange={(e) => setCoordinator("mobile", e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputClass} />
                </Field>
              </SectionCard>

              {/* 4. Bank Account Details */}
              <SectionCard
                title="Bank Account Details"
                subtitle="Provide a cancelled cheque or bank passbook for verification"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                }
              >
                <Field label="Bank name" required error={errors["bank.bankName"]}>
                  <input type="text" value={form.bank.bankName}
                    onChange={(e) => setBank("bankName", e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className={errors["bank.bankName"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Branch">
                  <input type="text" value={form.bank.branch}
                    onChange={(e) => setBank("branch", e.target.value)}
                    placeholder="Branch name"
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
                    placeholder="Account number"
                    className={errors["bank.accountNumber"] ? inputErrorClass : inputClass} />
                </Field>

                <Field label="Account holder name">
                  <input type="text" value={form.bank.accountHolderName}
                    onChange={(e) => setBank("accountHolderName", e.target.value)}
                    placeholder="Name on account"
                    className={inputClass} />
                </Field>

                <FileUploadField
                  label="Bank document (cancelled cheque / passbook)"
                  existingUrl={form.bank.bankDocumentFileUrl}
                  file={fileUploads.bankFile}
                  onChange={(f) => setFileUploads(prev => ({ ...prev, bankFile: f }))}
                />
              </SectionCard>

              {/* ── Submit bar ─────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm px-6 sm:px-8 py-5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <p className="text-sm text-gray-500">
                    <span className="text-red-500 font-bold">*</span> Required fields must be completed before submitting.
                  </p>
                  <div className="flex items-center gap-3 sm:flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      disabled={submitting}
                      className="flex-1 sm:flex-none px-6 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 sm:flex-none px-8 py-3 bg-[#4B0082] hover:bg-[#3a0066] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                    >
                      {submitting ? (
                        <>
                          <IconSpinner className="w-4 h-4" />
                          Submitting…
                        </>
                      ) : (
                        <>
                          <IconCheck />
                          Resubmit for Review
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}