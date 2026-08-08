"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import TopHeader from "@/app/components/TopHeader";
import Sidebar from "@/app/components/Sidebar";
import { adminClient } from "@/app/lib/axios";

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: "Open",
  COMPLIANCE_REQUIRED: "Open",
  COMPLIANCE_PENDING: "Open",
  APPROVED: "Closed",
  CLOSED: "Closed",
  ACCEPT: "Closed",
  REJECTED: "Rejected",
  REJECT: "Rejected",
  CORRECTION_NEEDED: "Corrections Needed",
  CORRECTION: "Corrections Needed",
  RESUBMITTED: "Resubmitted",
};

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

const historyStatusStyle = (s: string) => {
  const u = s?.toUpperCase();
  if (u === "APPROVED" || u === "ACCEPT" || u === "CLOSED")  return { badge: "bg-green-50 text-green-700 ring-green-200",   dot: "bg-green-500",  line: "border-green-200"  };
  if (u === "REJECTED"  || u === "REJECT") return { badge: "bg-red-50 text-red-700 ring-red-200",          dot: "bg-red-500",    line: "border-red-200"    };
  if (u?.includes("CORRECTION"))           return { badge: "bg-amber-50 text-amber-700 ring-amber-200",    dot: "bg-amber-500",  line: "border-amber-200"  };
  if (u === "RESUBMITTED")                 return { badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500", line: "border-indigo-200" };
  return { badge: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-400", line: "border-blue-200" };
};

const isPdfUrl = (url: string) =>
  /\.pdf(\?|$)/i.test(url) || url.toLowerCase().includes("pdf");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-purple-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
        <h2 className="text-lg font-bold text-[#2D0066]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className="font-medium text-sm text-gray-800">{value || "—"}</p>
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

const LOCK_ICON = <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />;

export default function PharmaDetails({ requestId, sellerId }: { requestId: string; sellerId: string | number }) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<{ url: string; label: string; documentId?: number } | null>(null);
  const [toast, setToast] = useState<{message: string, type: "success" | "error"} | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [showCommentError, setShowCommentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await adminClient.get(`/pharmacy-registration/${requestId}`);
        const json = res.data;
        if (!cancelled) setData(json.data ?? json);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [requestId]);

  const handleViewFile = (url: string, label: string, documentId?: number) => {
    setCurrentFile({ url, label, documentId });
    setModalOpen(true);
  };

  const handleVerifyDocument = async (verified: boolean) => {
    if (!currentFile?.documentId) return;
    setVerifying(true);
    try {
      const res = await adminClient.patch(`/pharmacy-registration/verify-document`, {
        pharmacyRegistrationId: data.pharmacyRegistrationId,
        registrationDocumentId: currentFile.documentId,
        verified: verified
      });
      const result = res.data;
      
      setToast({ message: `Document ${verified ? "verified" : "rejected"} successfully`, type: "success" });
      
      setData((prev: any) => ({
        ...prev,
        pharmacyRegistrationDocuments: prev.pharmacyRegistrationDocuments.map((doc: any) => 
          doc.registrationDocumentId === currentFile.documentId 
            ? { ...doc, verified: verified } 
            : doc
        )
      }));
      setModalOpen(false);
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setVerifying(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex bg-gray-50 min-h-screen font-sans">
        <Sidebar activeCategory="requests" activeType="pharma" onSelect={(cat, type) => router.push(`/components/AdminDashboard?category=${cat}&tab=${type}`)} />
        <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
          <TopHeader onLogout={() => router.push("/")} />
          <main className="flex-1 pt-12 bg-[#F7F2FB] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4B0082]"></div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex bg-gray-50 min-h-screen font-sans">
        <Sidebar activeCategory="requests" activeType="pharma" onSelect={(cat, type) => router.push(`/components/AdminDashboard?category=${cat}&tab=${type}`)} />
        <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
          <TopHeader onLogout={() => router.push("/")} />
          <main className="flex-1 pt-12 bg-[#F7F2FB] flex flex-col items-center justify-center">
            <p className="text-red-500 font-semibold mb-4">{error || "Failed to load details."}</p>
            <button onClick={() => router.back()} className="px-4 py-2 bg-[#4B0082] text-white rounded-lg">Go Back</button>
          </main>
        </div>
      </div>
    );
  }

  const sortedReviews = data.pharmacyStatusReviews ? [...data.pharmacyStatusReviews].sort((a: any, b: any) => new Date(b.statusDate).getTime() - new Date(a.statusDate).getTime()) : [];
  const currentStatus = sortedReviews[0]?.status || "SUBMITTED";
  const displayStatus = normalizeStatus(currentStatus);
  const isLocked = ["APPROVED", "CLOSED", "REJECTED", "ACCEPT", "REJECT"].includes(currentStatus);
  const hasUnverifiedDocs = data.pharmacyRegistrationDocuments?.some((doc: any) => doc.verified !== true);

  const handleAction = async (action: string) => {
    if (!adminComment.trim()) {
      setShowCommentError(true);
      return;
    }
    setShowCommentError(false);
    setSubmitting(true);
    
    let backendStatus = "";
    if (action === "Accept") backendStatus = "ACCEPT";
    else if (action === "Reject") backendStatus = "REJECT";
    else if (action === "Correction") backendStatus = "CORRECTION";

    try {
      await adminClient.post('/admin/pharmacy/review', {
        registrationId: data.pharmacyRegistrationId || requestId,
        status: backendStatus,
        remark: adminComment
      });
      setToast({ message: `Successfully actioned: ${action}`, type: "success" });
      setTimeout(() => setToast(null), 3000);
      setAdminComment("");
      
      // refresh data
      const res = await adminClient.get(`/pharmacy-registration/${requestId}`);
      setData(res.data.data ?? res.data);
    } catch (err: any) {
      console.error("Action error:", err);
      setToast({ message: err?.response?.data?.message || "Failed to submit decision", type: "error" });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const badgeClass = "bg-purple-50 text-purple-700 ring-purple-200";
  const dotClass = "bg-purple-500";

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans">
      <Sidebar activeCategory="requests" activeType="pharma" onSelect={(cat, type) => router.push(`/components/AdminDashboard?category=${cat}&tab=${type}`)} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
        <TopHeader onLogout={() => router.push("/")} />
      
      <main className="flex-1 pt-6 bg-[#F7F2FB] px-4 sm:px-6 pb-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-5 sm:p-8 space-y-5">
            
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex-1 flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#2D0066]">Pharma Registration Details</h1>
                  <p className="text-gray-500 mt-1 text-sm">Review the pharmacy information and compliance details</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />{displayStatus}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Request ID</span>
              <span className="text-sm font-bold text-[#2D0066]">{data.pharmacyRegistrationId || requestId}</span>
            </div>

            {/* Organization Details */}
            <Section title="Organization Details">
              <Field label="Organization Name" value={data.organizationName} />
              <Field label="Organization Type" value={data.organizationType} />
              <Field label="Ownership Type" value={data.ownershipType} />
              <Field label="PAN Number" value={data.organizationPanNumber} />
              <Field label="GST Number" value={data.organizationGstNumber} />
            </Section>

            {/* Warehouse Details */}
            <Section title="Warehouse Details">
              <div className="md:col-span-2">
                {data.pharmacyRegistrationWareHouses && data.pharmacyRegistrationWareHouses.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {data.pharmacyRegistrationWareHouses.map((wh: any, idx: number) => (
                      <div key={wh.pharmacyRegistrationWarehouseId ?? idx} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                        <div className="flex items-start justify-between gap-3 mb-3 pb-2 border-b border-gray-100">
                          <p className="text-sm font-bold text-[#2D0066]">{wh.warehouseName || `Warehouse ${idx + 1}`}</p>
                          <span className={`shrink-0 text-xs font-semibold ${wh.active ? "text-green-600" : "text-gray-400"}`}>
                            {wh.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                          <Field label="Warehouse Code" value={wh.warehouseCode} />
                          <Field label="Contact Person" value={wh.contactPersonName} />
                          <Field label="Mobile Number" value={wh.mobileNumber} />
                          <div className="sm:col-span-2">
                            <Field label="Address" value={wh.warehouseAddress} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No warehouses added.</p>
                )}
              </div>
            </Section>

            {/* Pharmacy Details */}
            <Section title="Pharmacy Details">
              <Field label="Pharmacy Name" value={data.pharmacyName} />
              <Field label="Pharmacy Type" value={data.pharmacyType} />
              {/* <Field label="Email Address" value={data.pharmacyEmail} /> */}
              <Field label="Phone Number" value={data.pharmacyPhone} />
              <Field label="Pharmacy PAN" value={data.panNumber} />
              <Field label="Pharmacy GST" value={data.gstNumber} />
            </Section>

            {/* Address Details */}
            <Section title="Address Details">
              <Field label="Branch" value={data.pharmacyBranch} />
              <Field label="Building No." value={data.pharmacyBuildingNo} />
              <Field label="Street" value={data.pharmacyStreet} />
              <Field label="Landmark" value={data.pharmacyLandmark} />
              <Field label="City" value={data.pharmacyCity} />
              <Field label="Taluka" value={data.pharmacyTaluka} />
              <Field label="District" value={data.pharmacyDistricts} />
              <Field label="State" value={data.pharmacyState} />
              <Field label="Pincode" value={data.pharmacyPincode} />
            </Section>

            {/* Documents */}
            <Section title="Documents">
              <div className="md:col-span-2 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.pharmacyRegistrationDocuments && data.pharmacyRegistrationDocuments.length > 0 ? (
                    data.pharmacyRegistrationDocuments.map((doc: any, idx: number) => (
                      <div key={idx} className="border border-gray-100 rounded-lg p-4 flex flex-col gap-2 bg-gray-50/50">
                        <p className="text-xs font-semibold text-gray-500 uppercase">{doc.documentType.replace(/_/g, " ")}</p>
                        <div className="flex items-center justify-between mt-1">
                          <button onClick={() => handleViewFile(doc.documentUrl, doc.documentType.replace(/_/g, " "), doc.registrationDocumentId)} className="inline-flex items-center gap-1.5 text-[#4B0082] font-semibold hover:underline text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Document
                          </button>
                          <span className={`text-xs font-semibold ${doc.verified ? "text-green-600" : "text-amber-500"}`}>
                            {doc.verified ? "✔ Verified" : "Pending"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic">No documents uploaded.</p>
                  )}
                </div>
              </div>
            </Section>

            {/* Admin Decision Panel */}
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

              <div className="space-y-6">
                {sortedReviews.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Review History</p>
                    <div className="relative">
                      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200" />
                      <div className="space-y-4">
                        {sortedReviews.map((h: any, idx: number) => {
                          const st = historyStatusStyle(h.status);
                          return (
                            <div key={h.statusId} className="relative flex gap-4">
                              <div className={`relative z-10 flex-shrink-0 w-[22px] h-[22px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${st.dot}`}>
                                {idx === 0 && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div className={`flex-1 rounded-xl border p-4 space-y-1.5 ${idx === 0 ? "bg-white shadow-sm " + st.line : "bg-gray-50 border-gray-200"}`}>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${st.badge}`}>
                                      {normalizeStatus(h.status)}
                                    </span>
                                    {idx === 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D0066] text-white">Latest</span>}
                                  </div>
                                  <span className="text-xs text-gray-400 tabular-nums">{formatDateTimeIST(h.statusDate)}</span>
                                </div>
                                {h.remark && <p className="text-sm text-gray-700 leading-relaxed">{h.remark}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                    <ActionButton action="Accept" label="Accept Request" disabled={isLocked || submitting || hasUnverifiedDocs} onClick={() => handleAction("Accept")}
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
                    <ActionButton action="Reject" label="Reject Request" disabled={isLocked || submitting} onClick={() => handleAction("Reject")}
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>} />
                    <ActionButton action="Correction" label="Request Correction" disabled={isLocked || submitting} onClick={() => handleAction("Correction")}
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} />
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </main>

      {/* Floating Back Button */}
      <button
        onClick={() => router.back()}
        className="fixed left-[270px] top-24 z-40 flex flex-col items-center gap-1.5 group"
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

      {/* File Viewer Modal */}
      {modalOpen && currentFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-0.5">Document Preview</p>
                <h3 className="text-base font-bold text-[#2D0066] truncate">{currentFile.label}</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50 flex items-center justify-center min-h-[300px]">
              {isPdfUrl(currentFile.url) ? (
                <iframe src={currentFile.url} title={currentFile.label} className="w-full h-[60vh] rounded-lg border border-gray-200 shadow" />
              ) : (
                <img src={currentFile.url} alt={currentFile.label} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow" />
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm">
                Close
              </button>
              {currentFile?.documentId && !isLocked && (
                <div className="flex items-center gap-3">
                  <button onClick={() => handleVerifyDocument(true)} disabled={verifying} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Verify
                  </button>
                  <button onClick={() => handleVerifyDocument(false)} disabled={verifying} className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 transition-all duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"} text-white`}>
            {toast.type === "success" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            <p className="text-sm font-semibold">{toast.message}</p>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
