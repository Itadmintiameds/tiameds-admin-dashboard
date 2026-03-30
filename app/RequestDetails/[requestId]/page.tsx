"use client";

import Header from "@/app/components/Header";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────
const BASE_URL    = "https://api-test-aggreator.tiameds.ai/api/v1";
const API_KEY     = "YOUR_API_KEY";
const APPROVED_BY = "admin@example.com";

const STATUS_MAP: Record<string, string> = {
  APPROVED: "Closed", CLOSED: "Closed", REJECTED: "Rejected",
  IN_PROGRESS: "In Progress", INPROGRESS: "In Progress",
  PENDING: "Open", OPEN: "Open",
  CORRECTION: "Corrections Needed", CORRECTION_REQUIRED: "Corrections Needed",
  CORRECTIONS_NEEDED: "Corrections Needed", CORRECTIONREQUIRED: "Corrections Needed",
};

const DECISION_CONFIG = {
  Accept:     { label: "Closed",             badgeClass: "bg-green-50 text-green-700 ring-green-200", dotClass: "bg-green-500" },
  Reject:     { label: "Rejected",           badgeClass: "bg-red-50 text-red-700 ring-red-200",       dotClass: "bg-red-500"   },
  Correction: { label: "Corrections Needed", badgeClass: "bg-amber-50 text-amber-700 ring-amber-200", dotClass: "bg-amber-500" },
} as const;

// ─── Types ────────────────────────────────────────────────────
type Decision     = "Accept" | "Reject" | "Correction" | null;
type ModalPhase   = "loading" | "success" | "error";
type FileStateMap = Record<string, { viewed: boolean; verified: boolean | null }>;

// Flat API shape (both endpoints return flat structure)
interface FlatAddress {
  buildingNo: string; street: string; city: string; landmark: string; pinCode: string;
  stateName: string; districtName: string; talukaName: string;
  stateId?: number; districtId?: number; talukaId?: number;
}

interface FlatDoc {
  documentFileUrl: string; documentNumber: string;
  licenseIssueDate: string; licenseExpiryDate: string;
  licenseIssuingAuthority: string; productTypeName: string; productTypeId: number;
  pendingSellerDocumentId?: number | null;
}

interface FlatCoordinator {
  name: string; designation: string; email: string; mobile: string;
}

interface FlatBankDetails {
  bankName: string; branch: string; ifscCode: string;
  accountNumber: string; accountHolderName: string; bankDocumentFileUrl: string;
}

// Unified shape we work with internally
interface SellerData {
  // IDs
  pendingSellerId?: number | null;
  sellerId?: string | null;
  // Core
  sellerName: string; email: string; phone: string; website: string;
  gstNumber: string; gstFileUrl: string;
  companyTypeName: string; sellerTypeName: string;
  status?: string;
  // Nested
  address: FlatAddress;
  coordinator: FlatCoordinator;
  bankDetails: FlatBankDetails;
  documents: FlatDoc[];
  productTypes: { productTypeId: number; productTypeName: string }[];
  reviewHistories?: {
    id: number; comments: string; reviewedAt: string; reviewedBy: string; status: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────
const normalizeStatus = (raw: string) => STATUS_MAP[raw?.toUpperCase()] ?? raw;

const formatDate = (s: string): string => {
  if (!s || s === "—") return "—";
  const clean = s.includes("T") ? s.split("T")[0] : s;
  const parts  = clean.split("-");
  if (parts.length !== 3) return s;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
};

const formatDateTimeIST = (s: string): string => {
  if (!s || s === "—") return "—";
  const d = new Date(s.includes("T") && !s.endsWith("Z") ? s + "Z" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const decisionFromStatus = (status: string): Decision => {
  const n = normalizeStatus(status);
  if (n === "Closed")             return "Accept";
  if (n === "Rejected")           return "Reject";
  if (n === "Corrections Needed") return "Correction";
  return null;
};

const isPdfUrl = (url: string) =>
  /\.pdf(\?|$)/i.test(url) || url.toLowerCase().includes("pdf");

// Normalize raw API response → SellerData
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeApiResponse = (raw: any): SellerData => ({
  pendingSellerId: raw.pendingSellerId ?? null,
  sellerId: raw.sellerId ?? null,
  sellerName: raw.sellerName ?? "",
  email: raw.email ?? "",
  phone: raw.phone ?? "",
  website: raw.website ?? "",
  gstNumber: raw.gstNumber ?? "",
  gstFileUrl: raw.gstFileUrl ?? "",
  companyTypeName: raw.companyTypeName ?? raw.companyType?.companyTypeName ?? "",
  sellerTypeName: raw.sellerTypeName ?? raw.sellerType?.sellerTypeName ?? "",
  status: raw.status ?? "PENDING",
  address: {
    buildingNo:   raw.address?.buildingNo   ?? "",
    street:       raw.address?.street       ?? "",
    city:         raw.address?.city         ?? "",
    landmark:     raw.address?.landmark     ?? "",
    pinCode:      raw.address?.pinCode      ?? "",
    stateName:    raw.address?.stateName    ?? raw.address?.state?.stateName    ?? "",
    districtName: raw.address?.districtName ?? raw.address?.district?.districtName ?? "",
    talukaName:   raw.address?.talukaName   ?? raw.address?.taluka?.talukaName   ?? "",
  },
  coordinator: {
    name:        raw.coordinator?.name        ?? "",
    designation: raw.coordinator?.designation ?? "",
    email:       raw.coordinator?.email       ?? "",
    mobile:      raw.coordinator?.mobile      ?? "",
  },
  bankDetails: {
    bankName:            raw.bankDetails?.bankName            ?? "",
    branch:              raw.bankDetails?.branch              ?? "",
    ifscCode:            raw.bankDetails?.ifscCode            ?? "",
    accountNumber:       raw.bankDetails?.accountNumber       ?? "",
    accountHolderName:   raw.bankDetails?.accountHolderName   ?? "",
    bankDocumentFileUrl: raw.bankDetails?.bankDocumentFileUrl ?? "",
  },
  documents: (raw.documents ?? []).map((d: FlatDoc) => ({
    documentFileUrl:       d.documentFileUrl       ?? "",
    documentNumber:        d.documentNumber        ?? "",
    licenseIssueDate:      d.licenseIssueDate      ?? "",
    licenseExpiryDate:     d.licenseExpiryDate     ?? "",
    licenseIssuingAuthority: d.licenseIssuingAuthority ?? "",
    productTypeName:       d.productTypeName       ?? "",
    productTypeId:         d.productTypeId         ?? 0,
  })),
  productTypes: raw.productTypes ?? [],
  reviewHistories: raw.reviewHistories ?? [],
});

const buildFileStates = (data: SellerData, decision: Decision): FileStateMap => {
  const accepted = decision === "Accept";
  const locked   = accepted || decision === "Reject";
  const resolveVerified = (forceTrue: boolean): boolean | null => forceTrue ? true : null;
  const resolveViewed   = (verified: boolean | null): boolean  => locked || verified !== null;
  const gstV  = resolveVerified(accepted);
  const bankV = resolveVerified(accepted);
  const init: FileStateMap = {
    gstFile:    { viewed: resolveViewed(gstV),  verified: gstV  },
    chequeFile: { viewed: resolveViewed(bankV), verified: bankV },
  };
  data.documents?.forEach((doc, idx) => {
    const v = resolveVerified(accepted);
    init[`doc_${doc.productTypeId}_${idx}`] = { viewed: resolveViewed(v), verified: v };
  });
  return init;
};

// ─── Decision Action Modal ─────────────────────────────────────
function DecisionActionModal({
  action, phase, errorMessage, onDone,
}: {
  action: Decision; phase: ModalPhase; errorMessage?: string; onDone: () => void;
}) {
  // iconIn drives the animated entrance of the success/error icon.
  // Both setState calls are deferred via setTimeout so the effect body
  // never calls setState synchronously — satisfying react-hooks/set-state-in-effect.
  const [iconIn, setIconIn] = useState(false);

  // Reset to false whenever phase becomes "loading"
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setIconIn(false), 0);
    return () => clearTimeout(t);
  }, [phase]);

  // Animate in once success/error phase is reached
  useEffect(() => {
    if (phase !== "success" && phase !== "error") return;
    const t = setTimeout(() => setIconIn(true), 120);
    return () => clearTimeout(t);
  }, [phase]);

  if (!action) return null;

  const cfgMap = {
    Accept: {
      bg: "from-green-50 to-emerald-50", ring: "ring-green-200", iconBg: "bg-green-100",
      pulse: "bg-green-400", title: "Request Accepted!", subtitle: "Status set to Closed",
      desc: "The seller has been approved successfully.", badge: "bg-green-100 text-green-700",
      icon: (done: boolean) => (
        <svg viewBox="0 0 52 52" className="w-11 h-11">
          <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-300"
            style={{ strokeDasharray: 150, strokeDashoffset: done ? 0 : 150, transition: "stroke-dashoffset 0.55s ease" }} />
          <path fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            d="M14 27l8 8 16-16" className="text-green-600"
            style={{ strokeDasharray: 38, strokeDashoffset: done ? 0 : 38, transition: "stroke-dashoffset 0.4s ease 0.5s" }} />
        </svg>
      ),
    },
    Reject: {
      bg: "from-red-50 to-rose-50", ring: "ring-red-200", iconBg: "bg-red-100",
      pulse: "bg-red-400", title: "Request Rejected", subtitle: "Status set to Rejected",
      desc: "The seller request has been declined.", badge: "bg-red-100 text-red-700",
      icon: (done: boolean) => (
        <svg viewBox="0 0 52 52" className="w-11 h-11">
          <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-300"
            style={{ strokeDasharray: 150, strokeDashoffset: done ? 0 : 150, transition: "stroke-dashoffset 0.55s ease" }} />
          <path fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
            d="M17 17l18 18M35 17L17 35" className="text-red-600"
            style={{ strokeDasharray: 33, strokeDashoffset: done ? 0 : 33, transition: "stroke-dashoffset 0.4s ease 0.5s" }} />
        </svg>
      ),
    },
    Correction: {
      bg: "from-amber-50 to-yellow-50", ring: "ring-amber-200", iconBg: "bg-amber-100",
      pulse: "bg-amber-400", title: "Correction Requested", subtitle: "Seller has been notified",
      desc: "The seller will be asked to submit corrections.", badge: "bg-amber-100 text-amber-700",
      icon: (done: boolean) => (
        <svg viewBox="0 0 52 52" className="w-11 h-11">
          <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-300"
            style={{ strokeDasharray: 150, strokeDashoffset: done ? 0 : 150, transition: "stroke-dashoffset 0.55s ease" }} />
          <path fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
            d="M26 15v13M26 34v2.5" className="text-amber-600"
            style={{ strokeDasharray: 22, strokeDashoffset: done ? 0 : 22, transition: "stroke-dashoffset 0.4s ease 0.5s" }} />
        </svg>
      ),
    },
  };

  const successCfg = cfgMap[action as keyof typeof cfgMap];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <div style={{ animation: "modalIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both", width: "100%", maxWidth: "420px", minWidth: "320px" }}
        className={`bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 text-center ring-1 ${phase === "error" ? "ring-red-200 bg-gradient-to-b from-red-50 to-rose-50" : `${successCfg.ring} bg-gradient-to-b ${successCfg.bg}`}`}>
        {phase === "loading" && (
          <>
            <div className={`w-16 h-16 rounded-full ${successCfg.iconBg} flex items-center justify-center`}>
              <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-700">Submitting decision…</p>
              <p className="text-sm text-gray-400 mt-1">Please wait</p>
            </div>
          </>
        )}
        {phase === "success" && (
          <>
            <div className="relative flex items-center justify-center">
              <span className={`absolute w-20 h-20 rounded-full ${successCfg.pulse} opacity-0`} style={{ animation: "pulseOut 0.85s ease-out forwards" }} />
              <div className={`w-16 h-16 rounded-full ${successCfg.iconBg} flex items-center justify-center`}>{successCfg.icon(iconIn)}</div>
            </div>
            <div style={{ opacity: iconIn ? 1 : 0, transform: iconIn ? "translateY(0)" : "translateY(6px)", transition: "all 0.3s ease 0.3s" }}>
              <p className="text-xl font-bold text-gray-900">{successCfg.title}</p>
              <span className={`mt-2 inline-block text-xs font-semibold px-3 py-1 rounded-full ${successCfg.badge}`}>{successCfg.subtitle}</span>
            </div>
            <p className="text-sm text-gray-500" style={{ opacity: iconIn ? 1 : 0, transition: "opacity 0.3s ease 0.5s" }}>{successCfg.desc}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400" style={{ opacity: iconIn ? 1 : 0, transition: "opacity 0.3s ease 0.65s" }}>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              Redirecting you back…
            </div>
            <button onClick={onDone} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors">Go back now</button>
          </>
        )}
        {phase === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Submission Failed</p>
              {errorMessage && <p className="text-sm text-red-500 mt-1">{errorMessage}</p>}
            </div>
            <button onClick={onDone} className="px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">Close &amp; Try Again</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reject Reason Modal ───────────────────────────────────────
function ProfileRejectModal({ open, onConfirm, onCancel, isLoading }: {
  open: boolean; onConfirm: (reason: string) => void; onCancel: () => void; isLoading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError]   = useState(false);
  if (!open) return null;
  const handleConfirm = () => { if (!reason.trim()) { setError(true); return; } onConfirm(reason.trim()); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!isLoading ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-center w-11 h-11 bg-red-100 rounded-full mx-auto mb-4">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-base font-bold text-gray-800 text-center mb-1">Reject Profile Update</h2>
        <p className="text-sm text-gray-500 text-center mb-4">Provide a reason — the seller will be notified.</p>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
        <textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setError(false); }}
          placeholder="e.g. Documents are not clear. Please upload higher resolution images."
          className={`w-full border rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none transition-all ${error ? "border-red-400 focus:ring-red-400" : "border-gray-200 focus:ring-[#4B0082]"}`} />
        {error && <p className="text-red-500 text-xs mt-1">Please provide a rejection reason.</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={isLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50">Cancel</button>
          <button onClick={handleConfirm} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {isLoading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Rejecting…</>) : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="border border-purple-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
        <h2 className="text-lg font-bold text-[#2D0066]">{title}</h2>
        {badge}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">{children}</div>
    </div>
  );
}

/**
 * CompareItem — shows old value (amber, strikethrough) and new value (green) when values differ.
 * If both old & new are provided but equal, or only value is provided, renders a plain field.
 */
function CompareItem({ label, value, oldValue, newValue }: {
  label: string;
  value?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  const hasChange = oldValue !== undefined && newValue !== undefined && oldValue !== newValue;

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      {hasChange ? (
        <div className="space-y-1.5">
          {/* Old value — amber pill */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">Old</span>
            <span className="text-sm text-amber-700 line-through decoration-amber-400">{oldValue || "—"}</span>
          </div>
          {/* New value — green pill */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded shrink-0">New</span>
            <span className="text-sm text-green-700 font-semibold">{newValue || "—"}</span>
          </div>
        </div>
      ) : (
        <p className="font-medium text-sm text-gray-800">{value ?? "—"}</p>
      )}
    </div>
  );
}

/**
 * CompareFileItem — shows file view button. If file URL changed, labels old/new.
 */
function CompareFileItem({ label, fileUrl, onView, isViewed, isVerified, isLocked, fileChanged }: {
  label: string;
  fileUrl?: string | null;
  onView: () => void;
  isViewed: boolean;
  isVerified: boolean | null;
  isLocked: boolean;
  fileChanged?: boolean;
}) {
  if (!fileUrl) return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-gray-400 italic text-sm">Not uploaded</p>
    </div>
  );
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      {fileChanged && (
        <p className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block mb-2">File updated</p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onView} className="inline-flex items-center gap-1.5 text-[#4B0082] font-semibold hover:underline text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {isViewed ? "Re-view" : "View file"}
        </button>
        {isVerified === true  && <span className="text-green-600 text-xs font-semibold">✔ Verified</span>}
        {isVerified === false && !isLocked && <span className="text-red-500 text-xs font-semibold">✗ Rejected</span>}
        {isVerified === null  && isViewed && !isLocked && <span className="text-amber-500 text-xs font-semibold">Pending decision</span>}
        {isLocked && isVerified === true && (
          <span className="inline-flex items-center gap-1 text-gray-400 text-xs italic">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>Locked
          </span>
        )}
      </div>
    </div>
  );
}

function StatusItem({ label, status, highlight = false, error = false }: {
  label: string; status: string; highlight?: boolean; error?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-semibold text-sm ${error ? "text-red-600" : highlight ? "text-green-700" : "text-gray-700"}`}>{status}</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="border border-purple-100 rounded-xl p-5">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-2 gap-x-10 gap-y-4">
            {Array.from({ length: 6 }, (_, j) => (
              <div key={j}><div className="h-3 w-24 bg-gray-200 rounded mb-2" /><div className="h-4 w-44 bg-gray-200 rounded" /></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type === "success" ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} /></svg>
      {message}
    </div>
  );
}

function ActionButton({ action, label, icon, disabled, onClick }: {
  action: string; label: string; icon: React.ReactNode; disabled: boolean; onClick: () => void;
}) {
  const colorClass =
    action === "Accept"     ? "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800" :
    action === "Reject"     ? "from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" :
                              "from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-6 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : `bg-gradient-to-r ${colorClass} text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95`}`}>
      {icon}{label}
    </button>
  );
}

// ─── Changes Summary Banner ───────────────────────────────────
function ChangeCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
      {count} change{count !== 1 ? "s" : ""}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function RequestDetails({ requestId }: { requestId: string }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const sellerId        = Number(searchParams.get("sellerId") ?? 0);
  const entityType      = searchParams.get("entityType");
  const sellerEmail     = searchParams.get("sellerEmail") ?? "";
  const isProfileUpdate = entityType === "seller" && !!sellerId && !!sellerEmail;

  const [newData, setNewData]   = useState<SellerData | null>(null);
  const [oldData, setOldData]   = useState<SellerData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadingOld, setLoadingOld] = useState(false);

  const [fileStates, setFileStates]             = useState<FileStateMap>({});
  const [lockedFileStates, setLockedFileStates] = useState<FileStateMap | null>(null);
  const [submittedDecision, setSubmittedDecision] = useState<Decision>(null);

  const [modalOpen, setModalOpen]   = useState(false);
  const [currentFile, setCurrentFile] = useState<{ url: string; label: string; fileKey: string } | null>(null);

  const [adminComment, setAdminComment]       = useState("");
  const [showCommentError, setShowCommentError] = useState(false);
  const [toast, setToast]   = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [actionModal, setActionModal] = useState<{ action: Decision; phase: ModalPhase; errorMessage?: string } | null>(null);

  const [isPendingUpdate, setIsPendingUpdate]           = useState(false);
  const [pendingSellerId, setPendingSellerId]           = useState<number | null>(null);
  const [profileRejectModalOpen, setProfileRejectModalOpen] = useState(false);
  const [profileActionLoading, setProfileActionLoading] = useState(false);

  const isLocked       = submittedDecision === "Accept" || submittedDecision === "Reject";
  const isCorrectionMode = submittedDecision === "Correction";
  const activeStates   = isLocked && lockedFileStates ? lockedFileStates : fileStates;

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Data Loading ──
  useEffect(() => {
    if (!sellerId) { setLoading(false); return; }
    let cancelled = false;

    const fetchAll = async () => {
      if (isProfileUpdate) {
        // 1. Fetch pending (new) data
        const pendingRes = await fetch(`${BASE_URL}/admin/seller-requests/pending/${sellerId}`, {
          headers: { "X-API-Key": API_KEY },
        });
        if (!pendingRes.ok) throw new Error(`Pending fetch failed: ${pendingRes.status}`);
        const pendingJson = await pendingRes.json();
        const rawNew      = pendingJson.data ?? pendingJson;
        const normalized  = normalizeApiResponse(rawNew);

        if (cancelled) return;
        setNewData(normalized);
        setIsPendingUpdate(true);
        setPendingSellerId(rawNew.pendingSellerId ?? sellerId);
        const decision = decisionFromStatus(rawNew.status ?? "");
        setSubmittedDecision(decision);
        setFileStates(buildFileStates(normalized, decision));

        // 2. Fetch current (old) data using sellerId from pending response
        const currentSellerId = rawNew.sellerId; // e.g. "DEMFG0022"
        if (currentSellerId) {
          if (!cancelled) setLoadingOld(true);
          try {
            const oldRes = await fetch(`${BASE_URL}/admin/seller-requests/${currentSellerId}`, {
              headers: { "X-API-Key": API_KEY },
            });
            if (oldRes.ok) {
              const oldJson = await oldRes.json();
              const rawOld  = oldJson.data ?? oldJson;
              if (!cancelled) setOldData(normalizeApiResponse(rawOld));
            }
          } catch (e) {
            console.error("Failed to fetch old seller data:", e);
          } finally {
            if (!cancelled) setLoadingOld(false);
          }
        }
      } else {
        // Regular new-seller flow
        const res = await fetch(`${BASE_URL}/temp-sellers/${sellerId}`, {
          headers: { "X-API-Key": API_KEY },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json   = await res.json();
        const detail = normalizeApiResponse(json.data ?? json);
        if (cancelled) return;
        const decision = decisionFromStatus(detail.status ?? "");
        setNewData(detail);
        setSubmittedDecision(decision);
        setFileStates(buildFileStates(detail, decision));
      }
    };

    fetchAll()
      .catch(err => { if (!cancelled) showToast(`Failed to load: ${err.message}`, "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sellerId, isProfileUpdate, showToast]);

  // ── Memos ──
  const documentsVerified = useMemo(() => {
    const keys = Object.keys(activeStates).filter(k => k === "gstFile" || k.startsWith("doc_"));
    if (!keys.length) return { status: "No Documents", error: true };
    if (keys.every(k => activeStates[k]?.verified === true))  return { status: "Complete", error: false };
    if (keys.some(k => activeStates[k]?.verified === false))  return { status: "Rejected", error: true };
    return { status: isLocked ? "Not Verified" : "Pending Verification", error: true };
  }, [activeStates, isLocked]);

  const bankVerified = useMemo(() => {
    const s = activeStates["chequeFile"];
    if (!s || s.verified === null) return { status: isLocked ? "Not Verified" : "Pending Verification", error: true };
    return s.verified ? { status: "Complete", error: false } : { status: "Rejected", error: true };
  }, [activeStates, isLocked]);

  const allViewed  = useMemo(() => Object.keys(activeStates).length > 0 && Object.values(activeStates).every(v => v.viewed), [activeStates]);
  const canAccept  = useMemo(() => allViewed && Object.values(activeStates).every(v => v.verified === true), [activeStates, allViewed]);
  const hasAnyRejected = useMemo(() => allViewed && Object.values(activeStates).some(v => v.verified === false), [activeStates, allViewed]);

  // ── Helpers for diff ──
  const diff = useCallback((oldVal: string | null | undefined, newVal: string | null | undefined) => {
    const o = (oldVal ?? "").trim();
    const n = (newVal ?? "").trim();
    return o !== n ? { oldValue: o || "—", newValue: n || "—" } : {};
  }, []);

  // ── Handlers ──
  const handleViewFile = useCallback((url: string, label: string, fileKey: string) => {
    setCurrentFile({ url, label, fileKey });
    setModalOpen(true);
    const update = (prev: FileStateMap) => ({ ...prev, [fileKey]: { ...(prev[fileKey] ?? { verified: null }), viewed: true } });
    setFileStates(update);
    if (isLocked) setLockedFileStates(prev => prev ? update(prev) : prev);
  }, [isLocked]);

  const handleVerifyInModal = useCallback(async (verified: boolean) => {
    if (!currentFile || isLocked) return;
    setFileStates(prev => ({ ...prev, [currentFile.fileKey]: { ...prev[currentFile.fileKey], verified } }));
    setModalOpen(false);
    const { fileKey } = currentFile;
    try {
      let res: Response;
      if (fileKey === "gstFile") {
        res = await fetch(`${BASE_URL}/temp-sellers/${sellerId}/verify/gst`, {
          method: "PATCH", headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ gstVerified: String(verified) }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `${res.status}`);
        if (verified) showToast("GST verified ✔", "success");
      } else if (fileKey === "chequeFile") {
        res = await fetch(`${BASE_URL}/temp-sellers/${sellerId}/verify/bank`, {
          method: "PATCH", headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ bankDocumentVerified: String(verified) }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `${res.status}`);
        if (verified) showToast("Bank doc verified ✔", "success");
      } else if (fileKey.startsWith("doc_")) {
        const parts = fileKey.split("_");
        const productTypeId = Number(parts[1]);
        res = await fetch(`${BASE_URL}/temp-sellers/${sellerId}/verify/document`, {
          method: "PATCH", headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ productTypeId, documentVerified: String(verified) }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `${res.status}`);
        if (verified) showToast("Document verified ✔", "success");
      }
    } catch (e) {
      if (verified) showToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  }, [currentFile, isLocked, sellerId, showToast]);

  const handleAction = useCallback(async (action: "Accept" | "Reject" | "Correction") => {
    if (!adminComment.trim()) { setShowCommentError(true); return; }
    if (action === "Accept" && !canAccept)      { showToast("Verify all documents before accepting.", "error"); return; }
    if (action === "Reject" && !hasAnyRejected) { showToast("Reject at least one document before rejecting.", "error"); return; }
    if (!allViewed) { showToast("View all documents before taking action.", "error"); return; }
    setShowCommentError(false);
    setActionModal({ action, phase: "loading" });
    try {
      const res = await fetch(`${BASE_URL}/admin/sellers/review`, {
        method: "POST", headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ id: sellerId, status: action, comments: adminComment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? `${res.status}`);
      if (action === "Accept" || action === "Reject") {
        const frozen = Object.fromEntries(Object.entries(fileStates).map(([k, v]) => [k, { verified: v.verified, viewed: true }]));
        if (sellerId) sessionStorage.setItem(`fileStates_${sellerId}`, JSON.stringify(frozen));
        setLockedFileStates(frozen);
        setFileStates(frozen);
      } else {
        sessionStorage.removeItem(`fileStates_${sellerId}`);
        setLockedFileStates(null);
      }
      setSubmittedDecision(action);
      setActionModal({ action, phase: "success" });
      setTimeout(() => { setActionModal(null); router.back(); }, 3000);
    } catch (err) {
      setActionModal({ action, phase: "error", errorMessage: err instanceof Error ? err.message : "Action failed." });
    }
  }, [adminComment, canAccept, hasAnyRejected, allViewed, sellerId, fileStates, router, showToast]);

  const handleProfileApprove = useCallback(async () => {
    if (!pendingSellerId) return;
    setProfileActionLoading(true);
    setActionModal({ action: "Accept", phase: "loading" });
    try {
      const res = await fetch(
        `${BASE_URL}/admin/seller-requests/${pendingSellerId}/approve?approvedBy=${encodeURIComponent(APPROVED_BY)}`,
        { method: "POST", headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" } }
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `${res.status}`);
      setIsPendingUpdate(false);
      setActionModal({ action: "Accept", phase: "success" });
      setTimeout(() => { setActionModal(null); router.back(); }, 3000);
    } catch (err) {
      setActionModal({ action: "Accept", phase: "error", errorMessage: err instanceof Error ? err.message : "Approval failed." });
    } finally {
      setProfileActionLoading(false);
    }
  }, [pendingSellerId, router]);

  const handleProfileReject = useCallback(async (reason: string) => {
    if (!pendingSellerId) return;
    setProfileActionLoading(true);
    setProfileRejectModalOpen(false);
    setActionModal({ action: "Reject", phase: "loading" });
    try {
      const res = await fetch(
        `${BASE_URL}/admin/seller-requests/${pendingSellerId}/reject?approvedBy=${encodeURIComponent(APPROVED_BY)}`,
        {
          method: "POST", headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ pendingSellerId, action: "REJECT", rejectionReason: reason, approvedBy: APPROVED_BY }),
        }
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `${res.status}`);
      setIsPendingUpdate(false);
      setActionModal({ action: "Reject", phase: "success" });
      setTimeout(() => { setActionModal(null); router.back(); }, 3000);
    } catch (err) {
      setActionModal({ action: "Reject", phase: "error", errorMessage: err instanceof Error ? err.message : "Rejection failed." });
    } finally {
      setProfileActionLoading(false);
    }
  }, [pendingSellerId, router]);

  // ── Status badge ──
  const statusBadge = () => {
    if (submittedDecision && submittedDecision in DECISION_CONFIG) {
      const cfg = DECISION_CONFIG[submittedDecision as keyof typeof DECISION_CONFIG];
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${cfg.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />{cfg.label}
        </span>
      );
    }
    if (!newData) return null;
    const s = newData.status?.toLowerCase();
    const badgeClass = s === "open" ? "bg-yellow-50 text-yellow-700 ring-yellow-200" : s?.includes("progress") ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-green-50 text-green-700 ring-green-200";
    const dotClass   = s === "open" ? "bg-yellow-500" : s?.includes("progress") ? "bg-blue-500" : "bg-green-500";
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />{normalizeStatus(newData.status ?? "")}
      </span>
    );
  };

  const LOCK_ICON = <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />;

  const historyStatusStyle = (s: string) => {
    const u = s?.toUpperCase();
    if (u === "APPROVED" || u === "ACCEPT")  return { badge: "bg-green-50 text-green-700 ring-green-200",  dot: "bg-green-500", line: "border-green-200" };
    if (u === "REJECTED"  || u === "REJECT") return { badge: "bg-red-50 text-red-700 ring-red-200",         dot: "bg-red-500",   line: "border-red-200"   };
    if (u?.includes("CORRECTION"))           return { badge: "bg-amber-50 text-amber-700 ring-amber-200",   dot: "bg-amber-500", line: "border-amber-200" };
    return { badge: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-400", line: "border-blue-200" };
  };

  const fileModalVerdict = () => {
    if (!currentFile) return null;
    const v = fileStates[currentFile.fileKey]?.verified;
    if (isLocked && submittedDecision === "Accept")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs font-semibold"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Closed</span>;
    if (v === true)
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs font-semibold">✔ Verified</span>;
    if (isCorrectionMode)
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-semibold">Corrections Needed</span>;
    return null;
  };

  const ReviewHistoryTimeline = ({ histories }: { histories: NonNullable<SellerData["reviewHistories"]> }) => (
    <div className="relative">
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200" />
      <div className="space-y-4">
        {histories.map((h, idx) => {
          const st = historyStatusStyle(h.status);
          return (
            <div key={h.id} className="relative flex gap-4">
              <div className={`relative z-10 flex-shrink-0 w-[22px] h-[22px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${st.dot}`}>
                {idx === 0 && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
              </div>
              <div className={`flex-1 rounded-xl border p-4 space-y-1.5 ${idx === 0 ? "bg-white shadow-sm" : "bg-gray-50"} ${st.line}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${st.badge}`}>{normalizeStatus(h.status)}</span>
                    {idx === 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D0066] text-white">Latest</span>}
                    <span className="text-xs text-gray-400 font-medium">by {h.reviewedBy}</span>
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums">{formatDateTimeIST(h.reviewedAt)}</span>
                </div>
                {h.comments && <p className="text-sm text-gray-700 leading-relaxed">{h.comments}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Count changes per section
  const companyChanges = useMemo(() => {
    if (!oldData || !newData) return 0;
    return [
      diff(oldData.sellerName, newData.sellerName),
      diff(oldData.companyTypeName, newData.companyTypeName),
      diff(oldData.phone, newData.phone),
      diff(oldData.email, newData.email),
      diff(oldData.website, newData.website),
      diff(
        `${oldData.address.buildingNo} ${oldData.address.street} ${oldData.address.city} ${oldData.address.pinCode}`,
        `${newData.address.buildingNo} ${newData.address.street} ${newData.address.city} ${newData.address.pinCode}`
      ),
      diff(oldData.address.stateName, newData.address.stateName),
      diff(oldData.address.districtName, newData.address.districtName),
      diff(oldData.address.talukaName, newData.address.talukaName),
    ].filter(d => "oldValue" in d).length;
  }, [oldData, newData, diff]);

  const coordinatorChanges = useMemo(() => {
    if (!oldData || !newData) return 0;
    return [
      diff(oldData.coordinator.name, newData.coordinator.name),
      diff(oldData.coordinator.designation, newData.coordinator.designation),
      diff(oldData.coordinator.email, newData.coordinator.email),
      diff(oldData.coordinator.mobile, newData.coordinator.mobile),
    ].filter(d => "oldValue" in d).length;
  }, [oldData, newData, diff]);

  const bankChanges = useMemo(() => {
    if (!oldData || !newData) return 0;
    return [
      diff(oldData.bankDetails.bankName, newData.bankDetails.bankName),
      diff(oldData.bankDetails.branch, newData.bankDetails.branch),
      diff(oldData.bankDetails.ifscCode, newData.bankDetails.ifscCode),
      diff(oldData.bankDetails.accountNumber, newData.bankDetails.accountNumber),
      diff(oldData.bankDetails.accountHolderName, newData.bankDetails.accountHolderName),
      diff(oldData.bankDetails.bankDocumentFileUrl, newData.bankDetails.bankDocumentFileUrl),
    ].filter(d => "oldValue" in d).length;
  }, [oldData, newData, diff]);

  const totalChanges = companyChanges + coordinatorChanges + bankChanges;

  // ── Render ──
  return (
    <>
      <style>{`
        @keyframes modalIn { from { transform: scale(0.82) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes pulseOut { 0% { transform: scale(0.8); opacity: 0.3; } 70% { transform: scale(1.9); opacity: 0; } 100% { transform: scale(1.9); opacity: 0; } }
      `}</style>

      <Header admin onLogout={() => router.push("/admin_f6c29e3d/login")} />

      <ProfileRejectModal open={profileRejectModalOpen} onConfirm={handleProfileReject} onCancel={() => setProfileRejectModalOpen(false)} isLoading={profileActionLoading} />

      <main className="pt-12 bg-[#F7F2FB] min-h-screen px-4 sm:px-6 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="h-5" />
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-5 sm:p-8 space-y-5">

            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex-1 flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#2D0066]">Final Verification Summary</h1>
                    {isPendingUpdate && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                        Profile Update
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 mt-1 text-sm">Review all details before taking action</p>
                </div>
                {statusBadge()}
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Request ID</span>
              <span className="text-sm font-bold text-[#2D0066]">{newData?.sellerId ?? requestId}</span>
            </div>

            {/* Profile Update Banner */}
            {isPendingUpdate && (
              <div className="flex items-start justify-between gap-4 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl flex-wrap">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">Profile Update — Pending Your Review</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      This seller has submitted changes to their profile.
                      {totalChanges > 0 && !loadingOld && (
                        <span className="ml-1 font-semibold">{totalChanges} field{totalChanges !== 1 ? "s" : ""} changed.</span>
                      )}
                      {loadingOld && <span className="ml-1 italic">Loading comparison…</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button disabled={profileActionLoading} onClick={handleProfileApprove}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 transition-all disabled:opacity-50 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Accept Update
                  </button>
                  <button disabled={profileActionLoading} onClick={() => setProfileRejectModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-700 transition-all disabled:opacity-50 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Reject Update
                  </button>
                </div>
              </div>
            )}

            {/* Decision banners */}
            {submittedDecision === "Accept" && (
              <div className="flex items-start gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div><p className="font-semibold">Request Accepted — Status: Closed</p><p className="text-green-600 mt-0.5">The seller has been approved. All documents are now view-only.</p></div>
              </div>
            )}
            {submittedDecision === "Reject" && (
              <div className="flex items-start gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div><p className="font-semibold">Request Rejected — Status: Rejected</p><p className="text-red-600 mt-0.5">This request has been declined. All documents are now view-only.</p></div>
              </div>
            )}
            {isLocked && (
              <div className="flex items-start gap-3 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">{LOCK_ICON}</svg>
                <p className="font-semibold">Verification locked — documents are view-only</p>
              </div>
            )}
            {isCorrectionMode && (
              <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                <div><p className="font-semibold">Corrections Needed</p><p className="text-amber-600 mt-0.5">Seller has been notified. You can re-view and update document verification statuses.</p></div>
              </div>
            )}

            {loading ? <PageSkeleton /> : newData ? (
              <>
                {/* ── Company Details ── */}
                <Section title="Company Details" badge={<ChangeCount count={companyChanges} />}>
                  <CompareItem label="Seller Name" value={newData.sellerName} {...diff(oldData?.sellerName, newData.sellerName)} />
                  <CompareItem label="Company Type" value={newData.companyTypeName} {...diff(oldData?.companyTypeName, newData.companyTypeName)} />
                  <CompareItem label="Seller Type" value={newData.sellerTypeName} {...diff(oldData?.sellerTypeName, newData.sellerTypeName)} />
                  <CompareItem label="Phone" value={newData.phone} {...diff(oldData?.phone, newData.phone)} />
                  <CompareItem label="Email" value={newData.email} {...diff(oldData?.email, newData.email)} />
                  <CompareItem label="Website" value={newData.website || "—"} {...diff(oldData?.website, newData.website)} />
                  <CompareItem label="GST Number" value={newData.gstNumber} {...diff(oldData?.gstNumber, newData.gstNumber)} />
                  <div className="md:col-span-2">
                    <CompareItem
                      label="Address"
                      value={[newData.address.buildingNo, newData.address.street, newData.address.city, newData.address.pinCode].filter(Boolean).join(", ")}
                      {...diff(
                        [oldData?.address.buildingNo, oldData?.address.street, oldData?.address.city, oldData?.address.pinCode].filter(Boolean).join(", "),
                        [newData.address.buildingNo, newData.address.street, newData.address.city, newData.address.pinCode].filter(Boolean).join(", ")
                      )}
                    />
                  </div>
                  <CompareItem label="State" value={newData.address.stateName} {...diff(oldData?.address.stateName, newData.address.stateName)} />
                  <CompareItem label="District" value={newData.address.districtName} {...diff(oldData?.address.districtName, newData.address.districtName)} />
                  <CompareItem label="Taluka" value={newData.address.talukaName} {...diff(oldData?.address.talukaName, newData.address.talukaName)} />
                  <CompareItem label="Landmark" value={newData.address.landmark || "—"} {...diff(oldData?.address.landmark, newData.address.landmark)} />
                  <CompareItem label="Pin Code" value={newData.address.pinCode} {...diff(oldData?.address.pinCode, newData.address.pinCode)} />
                </Section>

                {/* ── Coordinator Details ── */}
                <Section title="Coordinator Details" badge={<ChangeCount count={coordinatorChanges} />}>
                  <CompareItem label="Name" value={newData.coordinator.name} {...diff(oldData?.coordinator.name, newData.coordinator.name)} />
                  <CompareItem label="Designation" value={newData.coordinator.designation} {...diff(oldData?.coordinator.designation, newData.coordinator.designation)} />
                  <CompareItem label="Email" value={newData.coordinator.email} {...diff(oldData?.coordinator.email, newData.coordinator.email)} />
                  <CompareItem label="Mobile" value={newData.coordinator.mobile} {...diff(oldData?.coordinator.mobile, newData.coordinator.mobile)} />
                </Section>

                {/* ── Compliance Documents ── */}
                <Section title="Compliance Documents">
                  <CompareFileItem
                    label="GST Certificate"
                    fileUrl={newData.gstFileUrl}
                    isLocked={isLocked}
                    onView={() => handleViewFile(newData.gstFileUrl, "GST Certificate", "gstFile")}
                    isViewed={activeStates["gstFile"]?.viewed ?? false}
                    isVerified={activeStates["gstFile"]?.verified ?? null}
                    fileChanged={!!oldData && oldData.gstFileUrl !== newData.gstFileUrl}
                  />

                  {newData.documents?.map((doc, idx) => {
                    const fileKey = `doc_${doc.productTypeId}_${idx}`;
                    const oldDoc  = oldData?.documents?.find(d => d.productTypeId === doc.productTypeId);
                    return (
                      <div key={fileKey} className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 pt-4 mt-1 border-t border-purple-50">
                        <CompareItem label="Document Type" value={doc.productTypeName} />
                        <CompareItem label="Document Number" value={doc.documentNumber} {...diff(oldDoc?.documentNumber, doc.documentNumber)} />
                        <CompareItem label="Issuing Authority" value={doc.licenseIssuingAuthority} {...diff(oldDoc?.licenseIssuingAuthority, doc.licenseIssuingAuthority)} />
                        <CompareItem label="Issue Date" value={formatDate(doc.licenseIssueDate)}
                          {...(oldDoc ? diff(formatDate(oldDoc.licenseIssueDate), formatDate(doc.licenseIssueDate)) : {})} />
                        <CompareItem label="Expiry Date" value={formatDate(doc.licenseExpiryDate)}
                          {...(oldDoc ? diff(formatDate(oldDoc.licenseExpiryDate), formatDate(doc.licenseExpiryDate)) : {})} />
                        <CompareFileItem
                          label={`License File — ${doc.productTypeName}`}
                          fileUrl={doc.documentFileUrl}
                          isLocked={isLocked}
                          onView={() => handleViewFile(doc.documentFileUrl, `License File — ${doc.productTypeName}`, fileKey)}
                          isViewed={activeStates[fileKey]?.viewed ?? false}
                          isVerified={activeStates[fileKey]?.verified ?? null}
                          fileChanged={!!oldDoc && oldDoc.documentFileUrl !== doc.documentFileUrl}
                        />
                      </div>
                    );
                  })}
                </Section>

                {/* ── Bank Account Details ── */}
                <Section title="Bank Account Details" badge={<ChangeCount count={bankChanges} />}>
                  <CompareItem label="Bank Name" value={newData.bankDetails.bankName} {...diff(oldData?.bankDetails.bankName, newData.bankDetails.bankName)} />
                  <CompareItem label="Branch" value={newData.bankDetails.branch} {...diff(oldData?.bankDetails.branch, newData.bankDetails.branch)} />
                  <CompareItem label="IFSC Code" value={newData.bankDetails.ifscCode} {...diff(oldData?.bankDetails.ifscCode, newData.bankDetails.ifscCode)} />
                  <CompareItem
                    label="Account Number"
                    value={newData.bankDetails.accountNumber ? `****${newData.bankDetails.accountNumber.slice(-4)}` : "—"}
                    {...(oldData ? diff(
                      oldData.bankDetails.accountNumber ? `****${oldData.bankDetails.accountNumber.slice(-4)}` : "—",
                      newData.bankDetails.accountNumber ? `****${newData.bankDetails.accountNumber.slice(-4)}` : "—"
                    ) : {})}
                  />
                  <CompareItem label="Account Holder Name" value={newData.bankDetails.accountHolderName} {...diff(oldData?.bankDetails.accountHolderName, newData.bankDetails.accountHolderName)} />
                  <CompareFileItem
                    label="Bank Document"
                    fileUrl={newData.bankDetails.bankDocumentFileUrl}
                    isLocked={isLocked}
                    onView={() => handleViewFile(newData.bankDetails.bankDocumentFileUrl, "Bank Document", "chequeFile")}
                    isViewed={activeStates["chequeFile"]?.viewed ?? false}
                    isVerified={activeStates["chequeFile"]?.verified ?? null}
                    fileChanged={!!oldData && oldData.bankDetails.bankDocumentFileUrl !== newData.bankDetails.bankDocumentFileUrl}
                  />
                </Section>

                {/* ── Validation Summary ── */}
                <Section title="Validation Summary">
                  <StatusItem label="Company Info" status="Complete" highlight />
                  <StatusItem label="Verification" status="Complete" highlight />
                  <StatusItem label="Documents" status={documentsVerified.status} error={documentsVerified.error} highlight={!documentsVerified.error} />
                  <StatusItem label="Bank Details" status={bankVerified.status} error={bankVerified.error} highlight={!bankVerified.error} />
                  <StatusItem label="Overall Status"
                    status={isLocked && submittedDecision === "Accept" ? "Closed" : isLocked && submittedDecision === "Reject" ? "Rejected" : isCorrectionMode ? "Corrections Needed" : canAccept ? "Ready to Submit" : "Pending Verification"}
                    highlight={canAccept || (isLocked && submittedDecision === "Accept")}
                    error={!canAccept && !(isLocked && submittedDecision === "Accept")} />
                </Section>

                {/* ── Admin Decision (non-update flow only) ── */}
                {!isPendingUpdate && (
                  <div className="border border-purple-200 rounded-xl p-5">
                    <h2 className="text-lg font-bold text-[#2D0066] mb-4 pb-2 border-b border-purple-100">Admin Decision</h2>
                    {isLocked && (
                      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3">
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">{LOCK_ICON}</svg>
                        <div>
                          <p className="font-semibold text-gray-600 text-sm">Decision submitted — no further changes allowed</p>
                          <p className="text-gray-500 text-sm mt-0.5">All actions and document verification are locked. You may only view files.</p>
                        </div>
                      </div>
                    )}
                    {!allViewed && !isLocked && (
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        <div><p className="font-semibold text-amber-800 text-sm">View All Documents First</p><p className="text-amber-700 text-sm mt-0.5">You must view and verify all documents before any action can be taken.</p></div>
                      </div>
                    )}
                    {allViewed && !canAccept && !hasAnyRejected && !isLocked && (
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        <div><p className="font-semibold text-amber-800 text-sm">Verification Incomplete</p><p className="text-amber-700 text-sm mt-0.5">Verify or reject each document to enable actions.</p></div>
                      </div>
                    )}
                    <div className="space-y-6">
                      {(newData?.reviewHistories?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Review History</p>
                          <ReviewHistoryTimeline histories={[...(newData!.reviewHistories!)].reverse()} />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Comments <span className="text-red-500">*</span></label>
                        <textarea value={adminComment} rows={4} readOnly={isLocked}
                          onChange={e => { if (isLocked) return; setAdminComment(e.target.value); setShowCommentError(false); }}
                          placeholder={isLocked ? "Decision has been submitted — no further changes allowed." : "Enter your comments here..."}
                          className={`w-full border rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all resize-none ${isLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 focus:ring-0" : showCommentError ? "border-red-400 focus:ring-red-400 bg-white" : "border-gray-200 focus:ring-[#4B0082] bg-white"}`} />
                        {showCommentError && (
                          <p className="flex items-center gap-1.5 mt-1.5 text-red-500 text-xs">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            Please add a comment before taking action
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Select Action</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <ActionButton action="Accept" label="Accept Request" disabled={!canAccept || !!actionModal || isLocked} onClick={() => handleAction("Accept")}
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
                          <ActionButton action="Reject" label="Reject Request" disabled={!hasAnyRejected || !!actionModal || isLocked} onClick={() => handleAction("Reject")}
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>} />
                          <ActionButton action="Correction" label="Request Correction" disabled={!allViewed || !!actionModal || isLocked} onClick={() => handleAction("Correction")}
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review History for profile update flow */}
                {isPendingUpdate && (newData?.reviewHistories?.length ?? 0) > 0 && (
                  <div className="border border-purple-200 rounded-xl p-5">
                    <h2 className="text-lg font-bold text-[#2D0066] mb-4 pb-2 border-b border-purple-100">Review History</h2>
                    <ReviewHistoryTimeline histories={[...(newData!.reviewHistories!)].reverse()} />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg className="w-14 h-14 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-gray-500 font-medium text-sm">{!sellerId ? "No seller ID provided." : "Could not load seller details."}</p>
                <p className="text-gray-400 text-xs mt-1">Please go back and try again.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── File Viewer Modal ── */}
      {modalOpen && currentFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-0.5">Document Preview</p>
                  <h3 className="text-base font-bold text-[#2D0066] truncate">{currentFile.label}</h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                  {fileModalVerdict()}
                  <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 ml-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50 flex items-center justify-center min-h-[300px]">
              {isPdfUrl(currentFile.url) ? (
                <iframe src={currentFile.url} title={currentFile.label} className="w-full h-[60vh] rounded-lg border border-gray-200 shadow" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentFile.url} alt={currentFile.label} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow" />
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm">
                {isLocked ? "Close" : "Cancel"}
              </button>
              {!isLocked && (
                <div className="flex items-center gap-3">
                  <button onClick={() => handleVerifyInModal(true)} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Verify
                  </button>
                  <button onClick={() => handleVerifyInModal(false)} className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Decision Action Modal ── */}
      {actionModal && (
        <DecisionActionModal
          action={actionModal.action}
          phase={actionModal.phase}
          errorMessage={actionModal.errorMessage}
          onDone={() => { if (actionModal.phase === "error") setActionModal(null); else { setActionModal(null); router.back(); } }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}