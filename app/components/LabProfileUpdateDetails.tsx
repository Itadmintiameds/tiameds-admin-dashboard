"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import TopHeader from "@/app/components/TopHeader";
import Sidebar from "@/app/components/Sidebar";
import { labClient } from "@/app/lib/axios";

export type LabCertificateRequest = {
  id: number;
  labId: number;
  labName?: string;
  documentType: string;
  requestedBy?: string;
  newFileUrl?: string;
  previousFileUrl?: string;
  issuingDate?: string;
  expiryDate?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  requestedAt?: string;
  reviewedAt?: string;
};

export const LAB_UPDATE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  organizationGstinCertificate:            "Organization GSTIN Certificate",
  gstinCertificate:                        "Lab GSTIN Certificate",
  establishmentRegistrationCertificate:    "Establishment Registration Certificate",
  biomedicalWasteAuthorizationCertificate: "Biomedical Waste Authorization Certificate",
  nablAccreditationCertificate:            "NABL Accreditation Certificate",
};

const MAX_REASON = 1000;

const STATUS_STYLE: Record<string, { label: string; badge: string; dot: string }> = {
  PENDING:  { label: "Pending Review", badge: "bg-yellow-50 text-yellow-700 ring-yellow-200", dot: "bg-yellow-500" },
  APPROVED: { label: "Approved",       badge: "bg-green-50 text-green-700 ring-green-200",   dot: "bg-green-500"  },
  REJECTED: { label: "Rejected",       badge: "bg-red-50 text-red-700 ring-red-200",         dot: "bg-red-500"    },
};

const formatDateTimeIST = (s?: string): string => {
  if (!s) return "—";
  const d = new Date(s.includes("T") && !s.endsWith("Z") ? s + "Z" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className="font-medium text-sm text-gray-800 break-words">{value || "—"}</p>
    </div>
  );
}

export default function LabProfileUpdateDetails({ requestId }: { requestId: string | number | null }) {
  const router = useRouter();
  const [req, setReq] = useState<LabCertificateRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [showReasonError, setShowReasonError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // There is no single-request endpoint, so look the request up across the three status lists
  useEffect(() => {
    let cancelled = false;
    Promise.all(LAB_UPDATE_STATUSES.map(s =>
      labClient.get("/platform-admin/certificate-requests", { params: { status: s } }).then(r => (r.data?.data ?? []) as LabCertificateRequest[])
    ))
      .then(results => {
        if (cancelled) return;
        const found = results.flat().find(r => String(r.id) === String(requestId));
        if (found) { setReq(found); setError(null); }
        else setError("Lab profile update not found.");
      })
      .catch(err => { if (!cancelled) setError(err?.response?.data?.message ?? err.message ?? "Failed to load update"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId, fetchTick]);

  const review = useCallback(async (action: "approve" | "reject") => {
    if (!req) return;
    setSubmitting(true);
    try {
      await labClient.post(
        `/platform-admin/certificate-requests/${req.id}/${action}`,
        action === "reject" ? { reason: reason.trim() } : undefined
      );
      showToast(action === "approve" ? "Update approved. The lab certificate has been replaced." : "Update rejected.", "success");
      setReason("");
      setFetchTick(t => t + 1);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      showToast(e.response?.data?.message ?? e.message ?? "Action failed", "error");
    } finally {
      setSubmitting(false);
    }
  }, [req, reason]);

  const handleReject = () => {
    if (!reason.trim()) { setShowReasonError(true); return; }
    setShowReasonError(false);
    review("reject");
  };

  const status = req ? STATUS_STYLE[req.status] : null;
  const docLabel = req ? (DOCUMENT_TYPE_LABEL[req.documentType] ?? req.documentType) : "";

  const FileRow = ({ title, url }: { title: string; url?: string }) => (
    <li className="flex items-center justify-between py-3 gap-4">
      <span className="text-sm font-medium text-gray-700">{title}</span>
      {url ? (
        <button
          onClick={() => setPreview({ url, label: `${title} — ${docLabel}` })}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#4B0082] border border-purple-200 bg-purple-50 hover:bg-[#4B0082] hover:text-white transition-all"
        >
          View
        </button>
      ) : (
        <span className="text-xs text-gray-400">Not available</span>
      )}
    </li>
  );

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans">
      <Sidebar
        activeCategory="updates"
        activeType="lab"
        onSelect={(cat, type) => router.push(`/components/AdminDashboard?category=${cat}&tab=${type}`)}
      />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopHeader onLogout={() => router.push("/")} />

        {toast && (
          <div
            className={`fixed top-5 right-5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border
              ${toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}
            style={{ zIndex: 99999 }}
          >
            {toast.message}
          </div>
        )}

        <main className="flex-1 bg-[#F7F2FB] px-5 pb-10 pt-10">
          <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-8 space-y-6">
            <button
              onClick={() => router.push("/components/AdminDashboard?category=updates&tab=lab")}
              className="text-sm text-gray-500 hover:text-[#4B0082] transition-colors"
            >
              ← Back to Lab Profile Updates
            </button>

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">Loading update…</div>
            ) : error || !req || !status ? (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <strong>Failed to load:</strong> {error}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2D0066]">{req.labName || "Lab"}</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                      LAB-{req.labId} · Update #{req.id} · Submitted {formatDateTimeIST(req.requestedAt)} IST
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${status.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {req.status === "REJECTED" && req.rejectionReason && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <strong>Rejection reason:</strong> {req.rejectionReason}
                  </div>
                )}

                <div className="border border-purple-200 rounded-xl p-5">
                  <div className="mb-4 pb-2 border-b border-purple-100">
                    <h2 className="text-lg font-bold text-[#2D0066]">What changed</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                    <Field label="Document" value={docLabel} />
                    <Field label="Requested By" value={req.requestedBy} />
                    {req.issuingDate && <Field label="New Issuing Date" value={req.issuingDate} />}
                    {req.expiryDate && <Field label="New Expiry Date" value={req.expiryDate} />}
                  </div>
                  <ul className="divide-y divide-gray-100 mt-4">
                    <FileRow title="New file (proposed)" url={req.newFileUrl} />
                    <FileRow title="Current / replaced file" url={req.previousFileUrl} />
                  </ul>
                  {req.status === "PENDING" && (
                    <p className="text-xs text-gray-400 mt-2">
                      The live certificate stays unchanged until this update is approved.
                    </p>
                  )}
                </div>

                {req.status === "PENDING" ? (
                  <div className="border border-purple-200 rounded-xl p-5">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Reason (required to reject)
                    </label>
                    <textarea
                      value={reason}
                      rows={4}
                      maxLength={MAX_REASON}
                      onChange={e => { setReason(e.target.value); setShowReasonError(false); }}
                      placeholder="Enter the rejection reason here..."
                      className={`w-full border rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all resize-none bg-white ${showReasonError ? "border-red-400 focus:ring-red-400" : "border-gray-200 focus:ring-[#4B0082]"}`}
                    />
                    {showReasonError && (
                      <p className="text-xs text-red-500 mt-1.5">Please add a reason before rejecting</p>
                    )}
                    <div className="flex gap-3 justify-end pt-4">
                      <button
                        onClick={handleReject}
                        disabled={submitting}
                        className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md disabled:opacity-50 transition-all"
                      >
                        {submitting ? "Please wait…" : "Reject"}
                      </button>
                      <button
                        onClick={() => review("approve")}
                        disabled={submitting}
                        className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md disabled:opacity-50 transition-all"
                      >
                        {submitting ? "Please wait…" : "Approve"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-right">
                    Reviewed {formatDateTimeIST(req.reviewedAt)} IST — no further action available.
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Document preview */}
      {preview && (
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-[#2D0066] text-sm">{preview.label}</h3>
              <div className="flex items-center gap-4">
                <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4B0082] hover:underline">
                  Open in new tab
                </a>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
              {isImageUrl(preview.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.label} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.label} className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
