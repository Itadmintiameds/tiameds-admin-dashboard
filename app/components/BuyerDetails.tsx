"use client";

/**
 * Buyer request review page.
 * The admin opens every document, verifies or rejects it one by one, and only then
 * approves or rejects the whole request.
 *
 * Backend (buyer-service, via gateway):
 *   GET   /admin/buyer-requests/pending/{tempBuyerId}                    -> detail incl. documents + reviewHistories
 *   PATCH /admin/buyer-requests/{id}/verify/document/{documentId}?verified=true|false
 *   POST  /admin/buyer-requests/{id}/approve | reject   { comments, reviewedBy }
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import TopHeader from "@/app/components/TopHeader";
import { sellerClient } from "@/app/lib/axios";
import { API_BASE_URL, REVIEWER } from "@/app/lib/config";

type BuyerDoc = {
  documentId?: number;
  tempBuyerDocumentId?: number;
  documentTypeName?: string;
  documentNumber?: string;
  documentFileUrl?: string;
  documentFileName?: string;
  documentVerified?: boolean;
  isDocumentVerified?: boolean;
  licenseIssueDate?: string;
  licenseExpiryDate?: string;
  licenseIssuingAuthority?: string;
};

type BuyerDetail = {
  tempBuyerId: number;
  tempBuyerRequestId: string;
  buyerName: string;
  status: string;
  email: string;
  phone: string;
  address?: {
    buildingNo?: string; street?: string; city?: string; landmark?: string; pinCode?: string;
    stateName?: string; districtName?: string; talukaName?: string;
  };
  contacts?: { contactId: number; name: string; designation: string; email: string; mobile: string }[];
  documents?: BuyerDoc[];
  reviewHistories?: { id: number; status: string; comments: string; reviewedBy: string; reviewedAt: string }[];
};

// null = not decided yet, true = verified, false = rejected
type DocState = { viewed: boolean; verified: boolean | null };

const docId = (d: BuyerDoc) => d.documentId ?? d.tempBuyerDocumentId;
const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);
// Documents are streamed by the API itself, so the (environment-specific) storage URL saved in the DB is never used by the browser.
const fileSrc = (buyerId: string | number, d: BuyerDoc) => `${API_BASE_URL}/admin/buyer-requests/${buyerId}/documents/${docId(d)}/file`;
const fmt = (s?: string) => (s ? s.split("T")[0] : "—");
const val = (s?: string | null) => (s && String(s).trim() ? s : "—");
const reviewable = (status: string) => ["OPEN", "RESUBMITTED"].includes(status?.toUpperCase());

const statusLabel = (s: string) => {
  switch (s?.toUpperCase()) {
    case "APPROVED": return "Closed";
    case "REJECTED": return "Rejected";
    case "OPEN": return "Open";
    case "RESUBMITTED": return "Resubmitted";
    case "CORRECTION_REQUIRED": return "Corrections Needed";
    default: return s || "—";
  }
};

const statusClass = (s: string) => {
  switch (s?.toUpperCase()) {
    case "APPROVED": return "bg-green-50 text-green-700 ring-green-200";
    case "REJECTED": return "bg-red-50 text-red-700 ring-red-200";
    case "RESUBMITTED": return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "CORRECTION_REQUIRED": return "bg-amber-50 text-amber-700 ring-amber-200";
    default: return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  }
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800 break-words">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-purple-100 rounded-xl p-5">
      <h2 className="text-lg font-bold text-[#2D0066] mb-4 pb-2 border-b border-purple-100">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">{children}</div>
    </div>
  );
}

export default function BuyerDetails({ requestId, buyerId }: { requestId: string; buyerId: string | number }) {
  const router = useRouter();
  const [data, setData] = useState<BuyerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [docStates, setDocStates] = useState<Record<number, DocState>>({});
  const [current, setCurrent] = useState<BuyerDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sellerClient.get(`/admin/buyer-requests/pending/${buyerId}`)
      .then(r => {
        if (cancelled) return;
        const d: BuyerDetail = r.data?.data ?? r.data;
        setData(d);
        // Already-decided requests are read-only, so every document counts as viewed.
        const decided = !reviewable(d.status);
        const states: Record<number, DocState> = {};
        (d.documents ?? []).forEach(doc => {
          const id = docId(doc);
          if (id == null) return;
          const v = doc.documentVerified ?? doc.isDocumentVerified;
          // The API only returns true/false; "false" is indistinguishable from "not reviewed yet",
          // so an open request starts unreviewed and a decided one shows the stored value.
          states[id] = { viewed: decided, verified: decided ? !!v : v ? true : null };
        });
        setDocStates(states);
      })
      .catch(e => { if (!cancelled) showToast(`Failed to load: ${e?.response?.data?.message ?? e.message}`, "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buyerId, showToast]);

  const locked = !!data && !reviewable(data.status);
  const docs = useMemo(() => data?.documents ?? [], [data]);
  const states = Object.values(docStates);
  const allViewed = docs.length > 0 && docs.every(d => docStates[docId(d) as number]?.viewed);
  const allVerified = docs.length > 0 && docs.every(d => docStates[docId(d) as number]?.verified === true);
  const anyRejected = docs.some(d => docStates[docId(d) as number]?.verified === false);

  const openDoc = (doc: BuyerDoc) => {
    const id = docId(doc);
    if (id != null) setDocStates(p => ({ ...p, [id]: { verified: p[id]?.verified ?? null, viewed: true } }));
    setCurrent(doc);
  };

  const verifyCurrent = async (verified: boolean) => {
    if (!current || locked) return;
    const id = docId(current);
    if (id == null) { showToast("Document id missing — refresh and retry.", "error"); return; }
    setSaving(true);
    try {
      await sellerClient.patch(`/admin/buyer-requests/${buyerId}/verify/document/${id}`, null, { params: { verified } });
      setDocStates(p => ({ ...p, [id]: { viewed: true, verified } }));
      showToast(verified ? "Document verified ✔" : "Document rejected", verified ? "success" : "error");
      setCurrent(null);
    } catch (e: any) {
      showToast(`Save failed: ${e?.response?.data?.message ?? e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (action: "approve" | "reject") => {
    if (!comment.trim()) { setCommentError(true); return; }
    setCommentError(false);
    setSubmitting(action);
    try {
      await sellerClient.post(`/admin/buyer-requests/${buyerId}/${action}`, { comments: comment.trim(), reviewedBy: REVIEWER });
      showToast(action === "approve" ? "Buyer approved." : "Buyer rejected.", "success");
      setTimeout(() => router.push("/components/AdminDashboard?category=requests&tab=buyer"), 1500);
    } catch (e: any) {
      showToast(`Failed to ${action}: ${e?.response?.data?.message ?? e.message}`, "error");
      setSubmitting(null);
    }
  };

  const a = data?.address;
  const address = a ? [a.buildingNo, a.street, a.landmark, a.city, a.pinCode].filter(Boolean).join(", ") : "";
  const curId = current ? docId(current) : undefined;
  const curState = curId != null ? docStates[curId] : undefined;

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans">
      <Sidebar activeCategory="requests" activeType="buyer"
        onSelect={(cat, type) => router.push(`/components/AdminDashboard?category=${cat}&tab=${type}`)} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
        <TopHeader onLogout={() => router.push("/")} />
        <main className="flex-1 pt-6 bg-[#F7F2FB] px-4 sm:px-6 pb-10 overflow-y-auto">
          <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-5 sm:p-8 space-y-5">

            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#2D0066]">Buyer Verification Summary</h1>
                <p className="text-gray-500 mt-1 text-sm">Verify each document, then approve or reject the request</p>
              </div>
              {data && (
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${statusClass(data.status)}`}>
                  {statusLabel(data.status)}
                </span>
              )}
            </div>

            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Request ID</span>
              <span className="text-sm font-bold text-[#2D0066]">{data?.tempBuyerRequestId ?? requestId}</span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-sm text-gray-400">Loading buyer details…</div>
            ) : !data ? (
              <div className="py-20 text-center">
                <p className="text-gray-500 font-medium text-sm">Could not load buyer details.</p>
                <p className="text-gray-400 text-xs mt-1">Please go back and try again.</p>
              </div>
            ) : (
              <>
                {locked && (
                  <div className="px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm font-semibold">
                    This request is {statusLabel(data.status)} — documents are view-only.
                  </div>
                )}

                <Section title="Buyer Details">
                  <Field label="Buyer Name" value={val(data.buyerName)} />
                  <Field label="Email" value={val(data.email)} />
                  <Field label="Phone" value={val(data.phone)} />
                  <Field label="Address" value={val(address)} />
                  <Field label="State" value={val(a?.stateName)} />
                  <Field label="District" value={val(a?.districtName)} />
                  <Field label="Taluka" value={val(a?.talukaName)} />
                </Section>

                {(data.contacts?.length ?? 0) > 0 && (
                  <Section title="Contacts">
                    {data.contacts!.map(c => (
                      <div key={c.contactId} className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 pb-3 border-b border-purple-50 last:border-0">
                        <Field label="Name" value={val(c.name)} />
                        <Field label="Designation" value={val(c.designation)} />
                        <Field label="Email" value={val(c.email)} />
                        <Field label="Mobile" value={val(c.mobile)} />
                      </div>
                    ))}
                  </Section>
                )}

                {/* ── Documents: reviewed one by one ── */}
                <div className="border border-purple-100 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
                    <h2 className="text-lg font-bold text-[#2D0066]">Documents</h2>
                    <span className="text-xs text-gray-500">
                      {states.filter(s => s.verified === true).length} / {docs.length} verified
                    </span>
                  </div>
                  {docs.length === 0 ? (
                    <p className="text-sm text-gray-400">No documents uploaded.</p>
                  ) : (
                    <div className="space-y-3">
                      {docs.map((doc, i) => {
                        const id = docId(doc);
                        const st = id != null ? docStates[id] : undefined;
                        return (
                          <div key={id ?? i} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center p-4 rounded-xl border border-gray-100 bg-[#faf7ff]">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <Field label="Document Type" value={val(doc.documentTypeName)} />
                              <Field label="Number" value={val(doc.documentNumber)} />
                              <Field label="Issued By" value={val(doc.licenseIssuingAuthority)} />
                              <Field label="Valid" value={`${fmt(doc.licenseIssueDate)} → ${fmt(doc.licenseExpiryDate)}`} />
                            </div>
                            <div className="flex items-center gap-2">
                              {st?.verified === true && <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200">✔ Verified</span>}
                              {st?.verified === false && <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200">✖ Rejected</span>}
                              {st?.verified == null && !locked && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                                  {st?.viewed ? "Viewed — decide" : "Not viewed"}
                                </span>
                              )}
                              <button onClick={() => openDoc(doc)} disabled={!doc.documentFileUrl}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#4B0082] border border-purple-200 bg-purple-50 hover:bg-[#4B0082] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                {locked ? "View" : "View & Verify"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Admin decision ── */}
                <div className="border border-purple-200 rounded-xl p-5">
                  <h2 className="text-lg font-bold text-[#2D0066] mb-4 pb-2 border-b border-purple-100">Admin Decision</h2>

                  {(data.reviewHistories?.length ?? 0) > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Review History</p>
                      <div className="space-y-2">
                        {[...data.reviewHistories!].reverse().map(h => (
                          <div key={h.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${statusClass(h.status)}`}>{statusLabel(h.status)}</span>
                              <span className="text-xs text-gray-400">{h.reviewedBy} · {fmt(h.reviewedAt)}</span>
                            </div>
                            {h.comments && <p className="mt-1.5 text-gray-700">{h.comments}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!locked && !allViewed && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <p className="font-semibold">View all documents first</p>
                      <p className="text-amber-700 mt-0.5">Open and verify or reject every document before deciding.</p>
                    </div>
                  )}
                  {!locked && allViewed && !allVerified && !anyRejected && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <p className="font-semibold">Verification incomplete</p>
                      <p className="text-amber-700 mt-0.5">Verify or reject each document to enable the decision buttons.</p>
                    </div>
                  )}

                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Comments <span className="text-red-500">*</span>
                  </label>
                  <textarea value={comment} rows={4} readOnly={locked}
                    onChange={e => { setComment(e.target.value); setCommentError(false); }}
                    placeholder={locked ? "Decision has been submitted." : "Enter your comments here..."}
                    className={`w-full border rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none ${locked ? "bg-gray-100 cursor-not-allowed border-gray-200" : commentError ? "border-red-400 focus:ring-red-400" : "border-gray-200 focus:ring-[#4B0082]"}`} />
                  {commentError && <p className="mt-1.5 text-xs text-red-500">Please add a comment before taking action</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                    <button onClick={() => decide("approve")} disabled={locked || !allVerified || !!submitting}
                      className="px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md disabled:bg-none disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all">
                      {submitting === "approve" ? "Approving…" : "Approve Request"}
                    </button>
                    <button onClick={() => decide("reject")} disabled={locked || !allViewed || !anyRejected || !!submitting}
                      className="px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md disabled:bg-none disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all">
                      {submitting === "reject" ? "Rejecting…" : "Reject Request"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* ── Document viewer ── */}
        {current && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-0.5">Document Preview</p>
                  <h3 className="text-base font-bold text-[#2D0066] truncate">{current.documentTypeName || "Document"}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {curState?.verified === true && <span className="text-xs font-semibold text-green-700">✔ Verified</span>}
                  {curState?.verified === false && <span className="text-xs font-semibold text-red-700">✖ Rejected</span>}
                  {current.documentFileUrl && (
                    <a href={fileSrc(buyerId, current)} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4B0082] hover:underline">Open in new tab</a>
                  )}
                  <button onClick={() => setCurrent(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-gray-50 flex items-center justify-center min-h-[300px]">
                {isPdf(current.documentFileUrl ?? "") ? (
                  <iframe src={fileSrc(buyerId, current)} title="Document" className="w-full h-[60vh] rounded-lg border border-gray-200 shadow" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileSrc(buyerId, current)} alt="Document" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow" />
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <button onClick={() => setCurrent(null)} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm">
                  {locked ? "Close" : "Cancel"}
                </button>
                {!locked && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => verifyCurrent(true)} disabled={saving}
                      className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50">Verify</button>
                    <button onClick={() => verifyCurrent(false)} disabled={saving}
                      className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50">Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            {toast.message}
          </div>
        )}

        <button onClick={() => router.back()} aria-label="Go back"
          className="fixed left-[270px] top-24 z-40 w-10 h-10 rounded-full bg-white border border-purple-200 shadow-lg flex items-center justify-center text-[#4B0082] hover:bg-[#4B0082] hover:text-white transition-all">
          ‹
        </button>
      </div>
    </div>
  );
}
