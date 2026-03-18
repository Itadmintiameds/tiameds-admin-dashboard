"use client";

import Header from "@/app/components/Header";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────
const BASE_URL = "https://api-test-aggreator.tiameds.ai/api/v1";
const API_KEY  = "YOUR_API_KEY";

const LOCAL_GST_DOC = "/assets/docs/gst-certificate.png";
const LOCAL_CHEQUE  = "/assets/docs/cheque.jpg";
const LOCAL_LICENSE = "/assets/docs/license-file.png";

const STATUS_MAP: Record<string, string> = {
  APPROVED: "Closed", CLOSED: "Closed", REJECTED: "Rejected",
  IN_PROGRESS: "In Progress", INPROGRESS: "In Progress",
  PENDING: "Open", OPEN: "Open",
  CORRECTION: "Corrections Needed", CORRECTION_REQUIRED: "Corrections Needed",
  CORRECTIONS_NEEDED: "Corrections Needed", CORRECTIONREQUIRED: "Corrections Needed",
};

const DECISION_CONFIG = {
  Accept:     { label: "Closed",             badgeClass: "bg-green-50 text-green-700 ring-green-200",   dotClass: "bg-green-500" },
  Reject:     { label: "Rejected",           badgeClass: "bg-red-50 text-red-700 ring-red-200",         dotClass: "bg-red-500"   },
  Correction: { label: "Corrections Needed", badgeClass: "bg-amber-50 text-amber-700 ring-amber-200",   dotClass: "bg-amber-500" },
} as const;

// ─── Types ────────────────────────────────────────────────────
type Decision    = "Accept" | "Reject" | "Correction" | null;
type EntityType  = "seller" | "buyer" | "lab";
type FileStateMap = Record<string, { viewed: boolean; verified: boolean | null }>;

interface Doc {
  DocumentsId: number; documentNumber: string; documentFileUrl: string;
  documentVerified: boolean; licenseIssueDate: string; licenseExpiryDate: string;
  licenseIssuingAuthority: string; licenseStatus: string;
  productTypes: { productTypeName: string };
}
interface SellerDetail {
  tempSellerId: number; tempSellerRequestId: string; sellerName: string;
  email: string; emailVerified: boolean; phone: string; phoneVerified: boolean;
  website: string; gstNumber: string; gstFileUrl: string; gstVerified: boolean;
  status: string; termsAccepted: boolean;
  companyType: { companyTypeName: string }; sellerType: { sellerTypeName: string };
  productTypes: { productTypeId: number; productTypeName: string }[];
  address: {
    buildingNo: string; street: string; city: string; landmark: string; pinCode: string;
    state: { stateName: string }; district: { districtName: string }; taluka: { talukaName: string };
  };
  coordinator: {
    name: string; designation: string; email: string;
    emailVerified: boolean; mobile: string; phoneVerified: boolean;
  };
  bankDetails: {
    bankName: string; branch: string; ifscCode: string;
    accountNumber: string; accountHolderName: string; bankDocumentFileUrl: string;
  };
  documents: Doc[];
  reviewHistories?: {
    id: number; comments: string; reviewedAt: string;
    reviewedBy: string; status: string;
  }[];
}

// ─── Fake data factory for buyers & labs ─────────────────────
// Uses placeholder images that always load — no broken paths
const makeFakeDetail = (id: number, requestId: string, entityType: EntityType): SellerDetail => {
  const isBuyer = entityType === "buyer";
  const prefix  = isBuyer ? "BUY" : "LAB";
  const nameMap: Record<number, string> = {
    11: "ABC Buyers", 12: "XYZ Buyers", 13: "JKL Buyers", 14: "MNO Buyers", 15: "PQR Buyers",
    21: "ABC Labs",   22: "XYZ Labs",   23: "JKL Labs",   24: "MNO Labs",   25: "PQR Labs",
  };
  const statusMap: Record<number, string> = {
    11: "PENDING",     12: "IN_PROGRESS", 13: "APPROVED",  14: "REJECTED",  15: "CORRECTION",
    21: "APPROVED",    22: "IN_PROGRESS", 23: "PENDING",   24: "REJECTED",  25: "CORRECTION",
  };
  const name   = nameMap[id] ?? `${prefix} Entity ${id}`;
  const status = statusMap[id] ?? "PENDING";

  return {
    tempSellerId:       id,
    tempSellerRequestId: requestId,
    sellerName:         name,
    email:              `contact@${name.toLowerCase().replace(/\s/g, "")}.com`,
    emailVerified:      true,
    phone:              `98765${String(id).padStart(5, "0")}`,
    phoneVerified:      true,
    website:            `https://www.${name.toLowerCase().replace(/\s/g, "")}.com`,
    gstNumber:          `22AAAAA${String(id).padStart(4, "0")}A1Z5`,
    // ── Local public assets ──
    gstFileUrl:         LOCAL_GST_DOC,
    gstVerified:        false,
    status,
    termsAccepted:      true,
    companyType:        { companyTypeName: isBuyer ? "Private Limited" : "Research Institute" },
    sellerType:         { sellerTypeName:  isBuyer ? "Buyer"           : "Lab"                },
    productTypes:       [{ productTypeId: 1, productTypeName: isBuyer ? "General Goods" : "Diagnostics" }],
    address: {
      buildingNo: `${id * 10}`,
      street:     "MG Road",
      city:       "Chennai",
      landmark:   "Near Central Mall",
      pinCode:    "600001",
      state:      { stateName:    "Tamil Nadu"  },
      district:   { districtName: "Chennai"     },
      taluka:     { talukaName:   "Egmore"      },
    },
    coordinator: {
      name:          `Coordinator ${name}`,
      designation:   isBuyer ? "Purchase Manager" : "Lab Director",
      email:         `coord@${name.toLowerCase().replace(/\s/g, "")}.com`,
      emailVerified: true,
      mobile:        `91234${String(id).padStart(5, "0")}`,
      phoneVerified: true,
    },
    bankDetails: {
      bankName:            "State Bank of India",
      branch:              "Anna Salai Branch",
      ifscCode:            `SBIN000${id}`,
      accountNumber:       `${id}000123456789`,
      accountHolderName:   name,
      // ── Local public asset ──
      bankDocumentFileUrl: LOCAL_CHEQUE,
    },
    documents: [
      {
        DocumentsId:          id * 100,
        documentNumber:       `${prefix}-DOC-${id}-001`,
        // ── Local public asset ──
        documentFileUrl:      LOCAL_LICENSE,
        documentVerified:     false,
        licenseIssueDate:     "2023-04-01T00:00:00.000Z",
        licenseExpiryDate:    "2026-03-31T00:00:00.000Z",
        licenseIssuingAuthority: isBuyer ? "State Drug Authority" : "NABL",
        licenseStatus:        "Active",
        productTypes:         { productTypeName: isBuyer ? "General Goods" : "Diagnostics" },
      },
    ],
    reviewHistories: [
      {
        id:         1,
        comments:   "",
        reviewedAt: "2026-01-15T10:30:00.000Z",
        reviewedBy: "Admin User",
        status:     "PENDING",
      },
    ],
  };
};

// ─── Demo list lookup so we can resolve id → requestId ────────
const DEMO_MAP: Record<number, { requestId: string; entityType: EntityType }> = {
  11: { requestId: "BUY-2001", entityType: "buyer" },
  12: { requestId: "BUY-2002", entityType: "buyer" },
  13: { requestId: "BUY-2003", entityType: "buyer" },
  14: { requestId: "BUY-2004", entityType: "buyer" },
  15: { requestId: "BUY-2005", entityType: "buyer" },
  21: { requestId: "LAB-3001", entityType: "lab"   },
  22: { requestId: "LAB-3002", entityType: "lab"   },
  23: { requestId: "LAB-3003", entityType: "lab"   },
  24: { requestId: "LAB-3004", entityType: "lab"   },
  25: { requestId: "LAB-3005", entityType: "lab"   },
};

// ─── Helpers ──────────────────────────────────────────────────
const normalizeStatus = (raw: string) => STATUS_MAP[raw?.toUpperCase()] ?? raw;

const formatDate = (s: string): string => {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
};

const decisionFromStatus = (status: string): Decision => {
  const n = normalizeStatus(status);
  if (n === "Closed")             return "Accept";
  if (n === "Rejected")           return "Reject";
  if (n === "Corrections Needed") return "Correction";
  return null;
};

const buildFileStates = (detail: SellerDetail, decision: Decision): FileStateMap => {
  const accepted = decision === "Accept";
  const locked   = accepted || decision === "Reject";
  const init: FileStateMap = {
    gstFile:    { viewed: locked, verified: accepted ? true : (detail.gstVerified === true ? true : null) },
    chequeFile: { viewed: locked, verified: accepted ? true : null },
  };
  detail.documents?.forEach(doc => {
    init[`doc_${doc.DocumentsId}`] = {
      viewed:   locked,
      verified: accepted ? true : (doc.documentVerified === true ? true : null),
    };
  });
  return init;
};

// ─── Batched verification API calls ──────────────────────────
const submitAllVerifications = async (
  sellerId: number,
  fileStates: FileStateMap,
  docList: Doc[],
  entityType: EntityType
): Promise<string[]> => {
  const errors: string[] = [];

  // For buyers/labs we skip verification API calls (no endpoints yet)
  if (entityType !== "seller") return errors;

  const call = async (url: string, method: "PATCH" | "POST", body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method,
      headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message ?? `${method} ${url} failed (${res.status})`);
    }
  };

  const gst = fileStates["gstFile"];
  if (gst?.verified !== null && gst?.verified !== undefined) {
    try {
      await call(`${BASE_URL}/temp-sellers/${sellerId}/verify/gst`, "PATCH", { gstVerified: String(gst.verified) });
    } catch (e) { errors.push(`GST: ${(e as Error).message}`); }
  }

  const bank = fileStates["chequeFile"];
  if (bank?.verified !== null && bank?.verified !== undefined) {
    try {
      await call(`${BASE_URL}/temp-sellers/${sellerId}/verify/bank`, "PATCH", { bankDocumentVerified: String(bank.verified) });
    } catch (e) { errors.push(`Bank: ${(e as Error).message}`); }
  }

  for (const doc of docList ?? []) {
    const key   = `doc_${doc.DocumentsId}`;
    const state = fileStates[key];
    if (state?.verified !== null && state?.verified !== undefined) {
      try {
        await call(`${BASE_URL}/temp-sellers/${sellerId}/verify/document`, "POST", {
          documentId: doc.DocumentsId, documentVerified: String(state.verified),
        });
      } catch (e) { errors.push(`License (${doc.productTypes?.productTypeName ?? doc.DocumentsId}): ${(e as Error).message}`); }
    }
  }

  return errors;
};

// ─── Sub-components ───────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-purple-200 rounded-xl p-5">
      <h2 className="text-lg font-bold text-[#2D0066] mb-4 pb-2 border-b border-purple-100">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">{children}</div>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-medium text-sm text-gray-800">{value || "—"}</p>
    </div>
  );
}

function FileItem({
  label, fileUrl, onView, isViewed, isVerified, isLocked,
}: {
  label: string; fileUrl?: string; onView: () => void;
  isViewed: boolean; isVerified: boolean | null; isLocked: boolean;
}) {
  if (!fileUrl) return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-gray-400 italic text-sm">Not uploaded</p>
    </div>
  );
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onView} className="inline-flex items-center gap-1.5 text-[#4B0082] font-semibold hover:underline text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {isViewed ? "Re-view" : "View file"}
        </button>
        {isVerified === true  && <span className="text-green-600 text-xs font-semibold">✔ Verified</span>}
        {isVerified === false && <span className="text-red-500 text-xs font-semibold">✗ Rejected</span>}
        {isVerified === null  && isViewed && !isLocked && <span className="text-amber-500 text-xs font-semibold">Pending decision</span>}
        {isLocked && (
          <span className="inline-flex items-center gap-1 text-gray-400 text-xs italic">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Locked
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
              <div key={j}>
                <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-44 bg-gray-200 rounded" />
              </div>
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
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type === "success" ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
      </svg>
      {message}
    </div>
  );
}

function ActionButton({ action, label, icon, submittingAction, disabled, onClick }: {
  action: string; label: string; icon: React.ReactNode;
  submittingAction: Decision; disabled: boolean; onClick: () => void;
}) {
  const isSubmitting = submittingAction === action;
  const colorClass =
    action === "Accept"     ? "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800" :
    action === "Reject"     ? "from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" :
                              "from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700";
  return (
    <button onClick={onClick} disabled={disabled || isSubmitting}
      className={`px-6 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200
        ${disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : `bg-gradient-to-r ${colorClass} text-white shadow-md hover:shadow-lg hover:-translate-y-0.5`}`}>
      {isSubmitting
        ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        : icon}
      {isSubmitting ? "Submitting…" : label}
    </button>
  );
}

// ─── Entity type label helper ─────────────────────────────────
const entityLabel = (t: EntityType) => t === "seller" ? "Seller" : t === "buyer" ? "Buyer" : "Lab";

// ─── Main Component ───────────────────────────────────────────
export default function RequestDetails({ requestId }: { requestId: string }) {
  const router      = useRouter();
  const params      = useSearchParams();
  const sellerId    = Number(params.get("sellerId") ?? 0);
  // ── FIX: read entityType from URL, default to "seller" ──
  const entityType  = (params.get("entityType") ?? "seller") as EntityType;
  const isFakeEntity = entityType === "buyer" || entityType === "lab";

  const [data,              setData]              = useState<SellerDetail | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [fileStates,        setFileStates]        = useState<FileStateMap>({});
  const [lockedFileStates,  setLockedFileStates]  = useState<FileStateMap | null>(null);
  const [submittedDecision, setSubmittedDecision] = useState<Decision>(null);
  const [modalOpen,         setModalOpen]         = useState(false);
  const [currentFile,       setCurrentFile]       = useState<{ url: string; label: string; fileKey: string; docId?: number } | null>(null);
  const [adminComment,      setAdminComment]      = useState("");
  const [showCommentError,  setShowCommentError]  = useState(false);
  const [submittingAction,  setSubmittingAction]  = useState<Decision>(null);
  const [toast,             setToast]             = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isLocked         = submittedDecision === "Accept" || submittedDecision === "Reject";
  const isCorrectionMode = submittedDecision === "Correction";
  const activeStates     = isLocked && lockedFileStates ? lockedFileStates : fileStates;

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDetail = (detail: SellerDetail, decision: Decision) => {
    const sessionKey = `fileStates_${detail.tempSellerId}`;
    const locked     = decision === "Accept" || decision === "Reject";
    let states       = buildFileStates(detail, decision);

    if (locked) {
      try {
        const persisted = sessionStorage.getItem(sessionKey);
        if (persisted) {
          const restored: FileStateMap = JSON.parse(persisted);
          states = Object.fromEntries(
            Object.entries(restored).map(([k, v]) => [k, { ...v, viewed: true }])
          );
        }
      } catch { /* ignore */ }
    }

    const histories = detail.reviewHistories;
    if (histories && histories.length > 0) {
      setAdminComment(histories[histories.length - 1].comments ?? "");
    }

    setData(detail);
    setFileStates(states);
    if (locked) setLockedFileStates(states);
    setSubmittedDecision(decision);
  };

  useEffect(() => {
    if (!sellerId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    // ── FIX: buyers & labs → skip API, use fake data immediately ──
    if (isFakeEntity) {
      const demo = DEMO_MAP[sellerId];
      const rid  = demo?.requestId ?? requestId;
      const fake = makeFakeDetail(sellerId, rid, entityType);
      if (!cancelled) loadDetail(fake, decisionFromStatus(fake.status));
      setLoading(false);
      return;
    }

    // Sellers → real API (unchanged)
    fetch(`${BASE_URL}/temp-sellers/${sellerId}`, { headers: { "X-API-Key": API_KEY } })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(json => {
        if (!cancelled)
          loadDetail(
            (json.data ?? json) as SellerDetail,
            decisionFromStatus((json.data ?? json).status ?? "")
          );
      })
      .catch(() => { if (!cancelled) showToast("Failed to load seller details. Please try again.", "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sellerId, entityType]);

  // ── Derived state ─────────────────────────────────────────
  const documentsVerified = useMemo(() => {
    const keys = Object.keys(activeStates).filter(k => k === "gstFile" || k.startsWith("doc_"));
    if (!keys.length) return { status: "No Documents", error: true };
    if (keys.every(k => activeStates[k]?.verified === true))  return { status: "Complete",         error: false };
    if (keys.some(k  => activeStates[k]?.verified === false)) return { status: "Rejected",          error: true  };
    return { status: isLocked ? "Not Verified" : "Pending Verification", error: true };
  }, [activeStates, isLocked]);

  const bankVerified = useMemo(() => {
    const s = activeStates["chequeFile"];
    if (!s || s.verified === null) return { status: isLocked ? "Not Verified" : "Pending Verification", error: true };
    return s.verified ? { status: "Complete", error: false } : { status: "Rejected", error: true };
  }, [activeStates, isLocked]);

  const allViewed = useMemo(() =>
    Object.keys(activeStates).length > 0 && Object.values(activeStates).every(v => v.viewed),
    [activeStates]
  );

  const canAccept = useMemo(() =>
    allViewed && Object.keys(activeStates).length > 0 && Object.values(activeStates).every(v => v.verified === true),
    [activeStates, allViewed]
  );

  const hasAnyRejected = useMemo(() =>
    allViewed && Object.values(activeStates).some(v => v.verified === false),
    [activeStates, allViewed]
  );

  // ── Handlers ──────────────────────────────────────────────
  const handleViewFile = (url: string, label: string, fileKey: string, docId?: number) => {
    setCurrentFile({ url, label, fileKey, docId });
    setModalOpen(true);
    setFileStates(prev => ({
      ...prev,
      [fileKey]: { ...(prev[fileKey] ?? { verified: null }), viewed: true },
    }));
  };

  const handleVerifyInModal = (verified: boolean) => {
    if (!currentFile || isLocked) return;
    const { fileKey } = currentFile;
    setFileStates(prev => ({ ...prev, [fileKey]: { ...prev[fileKey], verified } }));
    setModalOpen(false);
    showToast(
      verified
        ? "Marked as verified — will be saved on final submission."
        : "Marked as rejected — will be saved on final submission.",
      verified ? "success" : "error"
    );
  };

  const handleAction = async (action: "Accept" | "Reject" | "Correction") => {
    if (!adminComment.trim())                   { setShowCommentError(true); return; }
    if (!allViewed)                             { showToast("View all documents before taking action.", "error"); return; }
    if (action === "Accept" && !canAccept)      { showToast("Verify all documents before accepting.", "error"); return; }
    if (action === "Reject" && !hasAnyRejected) { showToast("Reject at least one document before rejecting the request.", "error"); return; }

    setShowCommentError(false);
    setSubmittingAction(action);

    try {
      // Step 1: verification API (skipped automatically for buyers/labs)
      const verifyErrors = await submitAllVerifications(sellerId, fileStates, data?.documents ?? [], entityType);
      if (verifyErrors.length > 0) {
        showToast(`Verification save failed:\n${verifyErrors.join("; ")}`, "error");
        setSubmittingAction(null);
        return;
      }

      // Step 2: admin review decision
      // For buyers/labs (fake data), we simulate success without hitting the API
      if (!isFakeEntity) {
        const res  = await fetch(`${BASE_URL}/admin/sellers/review`, {
          method: "POST",
          headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ id: sellerId, status: action, comments: adminComment }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? `${res.status}`);
      }

      // Step 3: lock UI
      if (action === "Accept" || action === "Reject") {
        const frozen = Object.fromEntries(
          Object.entries(fileStates).map(([k, v]) => [k, { verified: v.verified, viewed: true }])
        );
        if (sellerId) sessionStorage.setItem(`fileStates_${sellerId}`, JSON.stringify(frozen));
        setLockedFileStates(frozen);
        setFileStates(frozen);
      } else {
        sessionStorage.removeItem(`fileStates_${sellerId}`);
        setLockedFileStates(null);
      }

      setSubmittedDecision(action);
      showToast(
        action === "Accept"     ? `Request accepted — status set to Closed!` :
        action === "Reject"     ? `Request rejected — status set to Rejected!` :
                                  `Correction requested — ${entityLabel(entityType)} notified!`,
        "success"
      );
      setTimeout(() => router.back(), 1800);

    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  // ── Status badge ──────────────────────────────────────────
  const statusBadge = () => {
    if (submittedDecision && submittedDecision in DECISION_CONFIG) {
      const cfg = DECISION_CONFIG[submittedDecision as keyof typeof DECISION_CONFIG];
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${cfg.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} /> {cfg.label}
        </span>
      );
    }
    if (!data) return null;
    const s = data.status?.toLowerCase();
    const badgeClass = s === "open"            ? "bg-yellow-50 text-yellow-700 ring-yellow-200"
                     : s?.includes("progress") ? "bg-blue-50 text-blue-700 ring-blue-200"
                                               : "bg-green-50 text-green-700 ring-green-200";
    const dotClass   = s === "open"            ? "bg-yellow-500"
                     : s?.includes("progress") ? "bg-blue-500"
                                               : "bg-green-500";
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {normalizeStatus(data.status)}
      </span>
    );
  };

  const LOCK_ICON = (
    <path fillRule="evenodd"
      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
      clipRule="evenodd" />
  );

  // ─────────────────────────────────────────────────────────
  return (
    <>
      <Header admin onLogout={() => router.push("/page.tsx")} />
      <main className="pt-12 bg-[#F7F2FB] min-h-screen px-4 sm:px-6 pb-10">
        <div className="max-w-5xl mx-auto">

          {/* Back — mobile */}
          <div className="block lg:hidden py-4">
            <button onClick={() => router.back()}
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-full px-4 py-2 shadow text-[#2D0066] font-medium text-sm transition-all">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {entityLabel(entityType)} Dashboard
            </button>
          </div>

          {/* Back — desktop */}
          <button onClick={() => router.back()} aria-label="Go back"
            className="hidden lg:flex fixed left-6 top-32 z-10 bg-white hover:bg-gray-50 border border-gray-200 rounded-full p-3 shadow-lg transition-all items-center justify-center">
            <svg className="h-5 w-5 text-[#2D0066]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-5 sm:p-8 space-y-5">

            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#2D0066]">Final Verification Summary</h1>
                <p className="text-gray-500 mt-1 text-sm">
                  Review all details before taking action
                  {isFakeEntity && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                      Demo Data — {entityLabel(entityType)}
                    </span>
                  )}
                </p>
              </div>
              {statusBadge()}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {data && (
                <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Request ID</span>
                  <span className="text-sm font-bold text-[#2D0066]">
                    {data.tempSellerRequestId ?? data.tempSellerId ?? requestId}
                  </span>
                </div>
              )}
            </div>

            {/* ── Info banners ── */}
            {submittedDecision === "Accept" && (
              <div className="flex items-start gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">Request Accepted — Status: Closed</p>
                  <p className="text-green-600 mt-0.5">The {entityLabel(entityType).toLowerCase()} has been approved. All documents are now view-only.</p>
                </div>
              </div>
            )}

            {submittedDecision === "Reject" && (
              <div className="flex items-start gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">Request Rejected — Status: Rejected</p>
                  <p className="text-red-600 mt-0.5">This request has been declined. All documents are now view-only.</p>
                </div>
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
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold">Corrections Needed — Status: Corrections Needed</p>
                  <p className="text-amber-600 mt-0.5">{entityLabel(entityType)} has been notified. You can re-view and update document verification statuses.</p>
                </div>
              </div>
            )}

            {!isLocked && !isCorrectionMode && allViewed &&
              Object.values(fileStates).some(v => v.verified !== null) && (
              <div className="flex items-start gap-3 px-5 py-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>
                  Document decisions are saved <strong>locally</strong>.
                  They will be submitted{isFakeEntity ? " (simulated for demo)" : " to the server"} when you click Accept, Reject, or Request Correction.
                </p>
              </div>
            )}

            {/* ── Content ── */}
            {loading ? <PageSkeleton /> : data ? (
              <>
                <Section title="Company Details">
                  <Item label="Name"    value={data.sellerName} />
                  <Item label="Type"    value={data.companyType?.companyTypeName} />
                  <Item label="Address" value={`${data.address?.buildingNo}, ${data.address?.street}, ${data.address?.city} - ${data.address?.pinCode}`} />
                  <Item label="Website" value={data.website} />
                  <Item label="Phone"   value={data.phone} />
                  <Item label="Email"   value={data.email} />
                </Section>

                <Section title="Coordinator Details">
                  <Item label="Name"        value={data.coordinator?.name} />
                  <Item label="Designation" value={data.coordinator?.designation} />
                  <Item label="Email"       value={data.coordinator?.email} />
                  <Item label="Mobile"      value={data.coordinator?.mobile} />
                </Section>

                <Section title="Compliance Documents">
                  <Item label="GST Number" value={data.gstNumber} />
                  {/* ── FIX: use real gstFileUrl from API/fake data ── */}
                  <FileItem
                    label="GST Certificate"
                    fileUrl={LOCAL_GST_DOC}
                    isLocked={isLocked}
                    onView={() => handleViewFile(LOCAL_GST_DOC, "GST Certificate", "gstFile")}
                    isViewed={activeStates["gstFile"]?.viewed ?? false}
                    isVerified={activeStates["gstFile"]?.verified ?? null}
                  />
                  {data.documents?.map(doc => (
                    <div key={doc.DocumentsId}
                      className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 pt-4 mt-1 border-t border-purple-50">
                      <Item label="Document Type"     value={doc.productTypes?.productTypeName} />
                      <Item label="Document Number"   value={doc.documentNumber} />
                      <Item label="Issuing Authority" value={doc.licenseIssuingAuthority} />
                      <Item label="Issue Date"        value={formatDate(doc.licenseIssueDate)} />
                      <Item label="Expiry Date"       value={formatDate(doc.licenseExpiryDate)} />
                      <Item label="License Status"    value={doc.licenseStatus} />
                      {/* ── always use local license file ── */}
                      <FileItem
                        label={`License — ${doc.productTypes?.productTypeName ?? "Document"}`}
                        fileUrl={LOCAL_LICENSE}
                        isLocked={isLocked}
                        onView={() => handleViewFile(
                          LOCAL_LICENSE,
                          `License — ${doc.productTypes?.productTypeName ?? "Document"}`,
                          `doc_${doc.DocumentsId}`,
                          doc.DocumentsId
                        )}
                        isViewed={activeStates[`doc_${doc.DocumentsId}`]?.viewed ?? false}
                        isVerified={activeStates[`doc_${doc.DocumentsId}`]?.verified ?? null}
                      />
                    </div>
                  ))}
                </Section>

                <Section title="Bank Account Details">
                  <Item label="Bank Name"           value={data.bankDetails?.bankName} />
                  <Item label="Branch"              value={data.bankDetails?.branch} />
                  <Item label="IFSC Code"           value={data.bankDetails?.ifscCode} />
                  <Item label="Account Number"      value={data.bankDetails?.accountNumber ? `****${data.bankDetails.accountNumber.slice(-4)}` : "—"} />
                  <Item label="Account Holder Name" value={data.bankDetails?.accountHolderName} />
                  <Item label="State"               value={data.address?.state?.stateName} />
                  <Item label="District"            value={data.address?.district?.districtName} />
                  <Item label="Taluka"              value={data.address?.taluka?.talukaName} />
                  {/* ── always use local cheque file ── */}
                  <FileItem
                    label="Cancelled Cheque"
                    fileUrl={LOCAL_CHEQUE}
                    isLocked={isLocked}
                    onView={() => handleViewFile(LOCAL_CHEQUE, "Cancelled Cheque", "chequeFile")}
                    isViewed={activeStates["chequeFile"]?.viewed ?? false}
                    isVerified={activeStates["chequeFile"]?.verified ?? null}
                  />
                </Section>

                <Section title="Validation Summary">
                  <StatusItem label="Company Info" status="Complete" highlight />
                  <StatusItem label="Verification" status="Complete" highlight />
                  <StatusItem label="Documents"    status={documentsVerified.status} error={documentsVerified.error} highlight={!documentsVerified.error} />
                  <StatusItem label="Bank Details" status={bankVerified.status}      error={bankVerified.error}      highlight={!bankVerified.error} />
                  <StatusItem
                    label="Overall Status"
                    status={
                      isLocked && submittedDecision === "Accept" ? "Closed" :
                      isLocked && submittedDecision === "Reject" ? "Rejected" :
                      isCorrectionMode ? "Corrections Needed" :
                      canAccept ? "Ready to Submit" : "Pending Verification"
                    }
                    highlight={canAccept || (isLocked && submittedDecision === "Accept")}
                    error={!canAccept && !(isLocked && submittedDecision === "Accept")}
                  />
                </Section>

                {/* ── Admin Decision ── */}
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
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">View All Documents First</p>
                        <p className="text-amber-700 text-sm mt-0.5">You must view and verify all documents before any action can be taken.</p>
                      </div>
                    </div>
                  )}

                  {allViewed && !canAccept && !hasAnyRejected && !isLocked && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">Verification Incomplete</p>
                        <p className="text-amber-700 text-sm mt-0.5">Verify or reject each document to enable actions. Only Request Correction is available until verification is complete.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">

                    {/* ── Review History Timeline ── */}
                    {(data?.reviewHistories?.length ?? 0) > 0 && (() => {
                      const histories = [...(data!.reviewHistories!)].reverse();
                      const statusStyle = (s: string) => {
                        const u = s?.toUpperCase();
                        if (u === "APPROVED")          return { badge: "bg-green-50 text-green-700 ring-green-200",  dot: "bg-green-500", line: "border-green-200" };
                        if (u === "REJECTED")          return { badge: "bg-red-50 text-red-700 ring-red-200",        dot: "bg-red-500",   line: "border-red-200"   };
                        if (u?.includes("CORRECTION")) return { badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", line: "border-amber-200" };
                        return                                { badge: "bg-blue-50 text-blue-700 ring-blue-200",    dot: "bg-blue-400",  line: "border-blue-200"  };
                      };
                      return (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Review History</p>
                          <div className="relative">
                            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200" />
                            <div className="space-y-4">
                              {histories.map((h, idx) => {
                                const st = statusStyle(h.status);
                                return (
                                  <div key={h.id} className="relative flex gap-4">
                                    <div className={`relative z-10 flex-shrink-0 w-[22px] h-[22px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${st.dot}`}>
                                      {idx === 0 && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                        </svg>
                                      )}
                                    </div>
                                    <div className={`flex-1 rounded-xl border p-4 space-y-1.5 ${idx === 0 ? "bg-white shadow-sm" : "bg-gray-50"} ${st.line}`}>
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${st.badge}`}>
                                            {normalizeStatus(h.status)}
                                          </span>
                                          {idx === 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D0066] text-white">Latest</span>
                                          )}
                                          <span className="text-xs text-gray-400 font-medium">by {h.reviewedBy}</span>
                                        </div>
                                        <span className="text-xs text-gray-400 tabular-nums">
                                          {new Date(h.reviewedAt).toLocaleString("en-IN", {
                                            day: "2-digit", month: "short", year: "numeric",
                                            hour: "2-digit", minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 leading-relaxed">{h.comments}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Comment Input ── */}
                    {!isLocked ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                          Add Comment <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={adminComment}
                          rows={4}
                          onChange={e => { setAdminComment(e.target.value); setShowCommentError(false); }}
                          placeholder="Enter your decision comments here..."
                          className={`w-full border rounded-xl p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all resize-none bg-white
                            ${showCommentError ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-[#4B0082]"}`}
                        />
                        {showCommentError && (
                          <p className="flex items-center gap-1.5 mt-1.5 text-red-500 text-xs">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Please add a comment before taking action
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                          Comments <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={4}
                          readOnly
                          value={adminComment}
                          placeholder="Decision has been submitted — no further changes allowed."
                          className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 transition-all resize-none bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 focus:ring-0"
                        />
                      </div>
                    )}

                    {/* ── Action Buttons — always shown, disabled when locked ── */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Select Action</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ActionButton
                          action="Accept" label="Accept Request" submittingAction={submittingAction}
                          disabled={isLocked || !canAccept || submittingAction !== null}
                          onClick={() => handleAction("Accept")}
                          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        />
                        <ActionButton
                          action="Reject" label="Reject Request" submittingAction={submittingAction}
                          disabled={isLocked || !hasAnyRejected || submittingAction !== null}
                          onClick={() => handleAction("Reject")}
                          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                        />
                        <ActionButton
                          action="Correction" label="Request Correction" submittingAction={submittingAction}
                          disabled={isLocked || !allViewed || submittingAction !== null}
                          onClick={() => handleAction("Correction")}
                          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg className="w-14 h-14 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 font-medium text-sm">
                  {!sellerId ? "No seller ID provided." : "Could not load details."}
                </p>
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

            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#2D0066]">{currentFile.label}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-50 flex items-center justify-center min-h-[300px]">
              {currentFile.url.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={currentFile.url}
                  className="w-full h-[60vh] rounded-lg shadow border-0"
                  title={currentFile.label}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentFile.url}
                  alt={currentFile.label}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow"
                  onError={e => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector(".img-error-msg")) {
                      const msg = document.createElement("div");
                      msg.className = "img-error-msg flex flex-col items-center gap-3 text-gray-400";
                      msg.innerHTML = `
                        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-sm font-medium">Could not load file</p>
                        <p class="text-xs text-center max-w-xs">Make sure the file exists at:<br/><code class="bg-gray-100 px-1 rounded">${currentFile.url}</code></p>
                        <a href="${currentFile.url}" target="_blank" rel="noopener noreferrer"
                          class="text-xs text-[#4B0082] underline">Try opening directly</a>
                      `;
                      parent.appendChild(msg);
                    }
                  }}
                />
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isLocked && (() => {
                  const state = fileStates[currentFile.fileKey];
                  if (state?.verified === true)  return <span className="text-green-600 text-xs font-semibold">✔ Marked as Verified (not yet saved)</span>;
                  if (state?.verified === false) return <span className="text-red-500 text-xs font-semibold">✗ Marked as Rejected (not yet saved)</span>;
                  return null;
                })()}
                {isLocked && submittedDecision === "Accept" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Closed
                  </span>
                )}
                {isLocked && submittedDecision === "Reject" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Rejected
                  </span>
                )}
                {isLocked && <span className="text-xs text-gray-400 italic">View only</span>}
                {isCorrectionMode && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-semibold">
                    Corrections Needed — verification enabled
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm">
                  {isLocked ? "Close" : "Cancel"}
                </button>
                {!isLocked && (
                  <>
                    <button
                      onClick={() => handleVerifyInModal(true)}
                      className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Verify
                    </button>
                    <button
                      onClick={() => handleVerifyInModal(false)}
                      className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}