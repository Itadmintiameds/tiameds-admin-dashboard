"use client";

import Header from "@/app/components/Header";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────
type RequestType = "seller" | "buyer" | "lab";
type SortField   = "requestId" | "name" | "email" | "date" | "status";
type SortOrder   = "asc" | "desc";
type Request     = { id: number; requestId: string; name: string; email: string; date: string; status: string };

// ─── Constants ────────────────────────────────────────────────
const API_URL   = "https://api-test-aggreator.tiameds.ai/api/v1/temp-sellers";
const API_KEY   = "YOUR_API_KEY";
const PAGE_SIZE = 10;

const DELETE_API: Record<RequestType, (id: number) => string> = {
  seller: (id) => `https://api-test-aggreator.tiameds.ai/api/v1/temp-sellers/both/${id}`,
  buyer:  (id) => `https://api-test-aggreator.tiameds.ai/api/v1/temp-buyers/${id}`,
  lab:    (id) => `https://api-test-aggreator.tiameds.ai/api/v1/temp-labs/${id}`,
};

const STATUS_MAP: Record<string, string> = {
  APPROVED: "Closed", CLOSED: "Closed",
  PENDING: "Open",    OPEN: "Open",
  REJECTED: "Rejected",
  CORRECTION: "Corrections Needed", CORRECTION_REQUIRED: "Corrections Needed",
  CORRECTIONS_NEEDED: "Corrections Needed", CORRECTIONREQUIRED: "Corrections Needed",
};

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  "Open":               { badge: "bg-yellow-50 text-yellow-700 ring-yellow-200",    dot: "bg-yellow-500"  },
  "Closed":             { badge: "bg-green-50 text-green-700 ring-green-200",       dot: "bg-green-500"   },
  "Rejected":           { badge: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500"     },
  "Corrections Needed": { badge: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500"   },
  "In Progress":        { badge: "bg-blue-50 text-blue-700 ring-blue-200",          dot: "bg-blue-500"    },
};
const DEFAULT_STYLE = { badge: "bg-gray-50 text-gray-600 ring-gray-200", dot: "bg-gray-400" };

const TABS: { key: RequestType; label: string }[] = [
  { key: "seller", label: "Seller" },
  { key: "buyer",  label: "Buyer"  },
  { key: "lab",    label: "Lab"    },
];

const COLUMNS: { field: SortField; label: string }[] = [
  { field: "requestId", label: "Request ID"      },
  { field: "name",      label: "Requestor Name"  },
  { field: "email",     label: "Requestor Email" },
  { field: "date",      label: "Date"            },
  { field: "status",    label: "Status"          },
];

const DEMO_BUYERS: Request[] = [
  { id: 11, requestId: "BUY-2001", name: "ABC Buyers",  email: "abc@buyers.com", date: "2026-01-21", status: "Open"               },
  { id: 12, requestId: "BUY-2002", name: "XYZ Buyers",  email: "xyz@buyers.com", date: "2025-11-08", status: "In Progress"        },
  { id: 13, requestId: "BUY-2003", name: "JKL Buyers",  email: "jkl@buyers.com", date: "2025-12-12", status: "Closed"             },
  { id: 14, requestId: "BUY-2004", name: "MNO Buyers",  email: "mno@buyers.com", date: "2025-10-05", status: "Rejected"           },
  { id: 15, requestId: "BUY-2005", name: "PQR Buyers",  email: "pqr@buyers.com", date: "2026-02-01", status: "Corrections Needed" },
];
const DEMO_LABS: Request[] = [
  { id: 21, requestId: "LAB-3001", name: "ABC Labs", email: "abc@lab.com", date: "2026-01-22", status: "Closed"             },
  { id: 22, requestId: "LAB-3002", name: "XYZ Labs", email: "xyz@lab.com", date: "2025-12-12", status: "In Progress"        },
  { id: 23, requestId: "LAB-3003", name: "JKL Labs", email: "jkl@lab.com", date: "2025-11-08", status: "Open"               },
  { id: 24, requestId: "LAB-3004", name: "MNO Labs", email: "mno@lab.com", date: "2025-09-14", status: "Rejected"           },
  { id: 25, requestId: "LAB-3005", name: "PQR Labs", email: "pqr@lab.com", date: "2026-02-10", status: "Corrections Needed" },
];

// ─── Helpers ──────────────────────────────────────────────────
const normalizeStatus = (raw: string) => STATUS_MAP[raw?.toUpperCase()] ?? raw;

const formatDate = (s: string): string => {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
};

const getPageNumbers = (current: number, total: number): (number | "...")[] => {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
    .filter(p => p === 1 || p === total || Math.abs(p - current) <= 1);
  return pages.reduce<(number | "...")[]>((acc, p, i, arr) => {
    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
    acc.push(p);
    return acc;
  }, []);
};

// ─── Reusable SVG Icons ───────────────────────────────────────
const IconSearch = () => (
  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconClose = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconChevronDown = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const IconTrash = ({ className = "w-3.5 h-3.5 flex-shrink-0" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

const IconWarning = () => (
  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const IconEmpty = () => (
  <svg className="w-9 h-9 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// ─── Sort Icon ────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: SortOrder }) => {
  const isActive = sortField === field;
  return (
    <svg
      className={`w-3.5 h-3.5 ml-1 flex-shrink-0 ${isActive ? "text-[#4B0082]" : "text-gray-300"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {isActive ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortOrder === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      )}
    </svg>
  );
};

// ─── Table Skeleton ───────────────────────────────────────────
const TableSkeleton = () => (
  <>
    {Array.from({ length: 6 }, (_, i) => (
      <tr key={i} className="border-b border-gray-50">
        {Array.from({ length: 7 }, (_, j) => (
          <td key={j} className="px-5 py-3.5">
            <div className="h-3.5 bg-gray-100 rounded-full animate-pulse" style={{ width: `${45 + j * 8}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ─── Delete Modal ─────────────────────────────────────────────
type DeleteModalProps = {
  item: Request | null;
  tabLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
};

const DeleteModal = ({ item, tabLabel, onConfirm, onCancel, isDeleting }: DeleteModalProps) => {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!isDeleting ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-center w-11 h-11 bg-red-100 rounded-full mx-auto mb-4">
          <IconTrash className="w-5 h-5 text-red-600" />
        </div>
        <h2 className="text-base font-bold text-gray-800 text-center mb-1">Delete {tabLabel} Request</h2>
        <p className="text-sm text-gray-500 text-center mb-1">Are you sure you want to delete</p>
        <p className="text-sm font-semibold text-[#4B0082] text-center mb-4">{item.requestId} — {item.name}?</p>
        <p className="text-xs text-red-500 text-center mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isDeleting ? <><IconSpinner />Deleting…</> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Shared Classes ───────────────────────────────────────────
const NAV_BTN = "px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-[#f0ebff] hover:border-[#4B0082] hover:text-[#4B0082] disabled:opacity-40 disabled:cursor-not-allowed transition-all";

// ─── Main ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();

  const [activeTab,    setActiveTab]    = useState<RequestType>("seller");
  const [sortField,    setSortField]    = useState<SortField>("requestId");
  const [sortOrder,    setSortOrder]    = useState<SortOrder>("desc");
  const [searchTerm,   setSearchTerm]   = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage,  setCurrentPage]  = useState(1);

  const [sellers,        setSellers]        = useState<Request[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [sellerError,    setSellerError]    = useState<string | null>(null);
  const [fetchTick,      setFetchTick]      = useState(0);

  const [buyers, setBuyers] = useState<Request[]>(DEMO_BUYERS);
  const [labs,   setLabs]   = useState<Request[]>(DEMO_LABS);

  const [deleteTarget, setDeleteTarget] = useState<Request | null>(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Refetch on window focus
  useEffect(() => {
    const onFocus = () => setFetchTick(t => t + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Fetch sellers
  useEffect(() => {
    if (activeTab !== "seller") return;
    let cancelled = false;
    setLoadingSellers(true);
    setSellerError(null);

    fetch(API_URL, { headers: { "X-API-Key": API_KEY } })
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(json => {
        if (cancelled) return;
        const list: any[] = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
        setSellers(list.map(item => ({
          id:        item.tempSellerId,
          requestId: item.tempSellerRequestId,
          name:      item.tempSellerName,
          email:     item.tempSellerEmail,
          date:      item.createdAt ? item.createdAt.split("T")[0] : "—",
          status:    normalizeStatus(item.status ?? ""),
        })));
      })
      .catch(err => { if (!cancelled) setSellerError(err.message ?? "Failed to fetch sellers"); })
      .finally(() => { if (!cancelled) setLoadingSellers(false); });

    return () => { cancelled = true; };
  }, [activeTab, fetchTick]);

  // Reset pagination when filters change
  useEffect(() => { setCurrentPage(1); }, [activeTab, searchTerm, statusFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    setSortField(field);
    setSortOrder(o => field === sortField ? (o === "asc" ? "desc" : "asc") : "asc");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const url = DELETE_API[activeTab](deleteTarget.id);
      const res = await fetch(url, { method: "DELETE", headers: { "X-API-Key": API_KEY } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const setters: Record<RequestType, React.Dispatch<React.SetStateAction<Request[]>>> = {
        seller: setSellers, buyer: setBuyers, lab: setLabs,
      };
      setters[activeTab](prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast(`${deleteTarget.requestId} deleted successfully.`, "success");
    } catch (err: any) {
      showToast(`Failed to delete: ${err.message ?? "unknown error"}`, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeTabLabel = activeTab === "seller" ? "Seller" : activeTab === "buyer" ? "Buyer" : "Lab";

  const filtered = useMemo(() => {
    const base = activeTab === "seller" ? sellers : activeTab === "buyer" ? buyers : labs;
    const term  = searchTerm.toLowerCase();
    return base
      .filter(r =>
        (!term || r.requestId.toLowerCase().includes(term) || r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term)) &&
        (statusFilter === "All" || r.status === statusFilter)
      )
      .sort((a, b) => {
        const av = sortField === "date" ? new Date(a.date).getTime() : a[sortField];
        const bv = sortField === "date" ? new Date(b.date).getTime() : b[sortField];
        return av < bv ? (sortOrder === "asc" ? -1 : 1) : av > bv ? (sortOrder === "asc" ? 1 : -1) : 0;
      });
  }, [activeTab, sellers, buyers, labs, searchTerm, statusFilter, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isLoading  = activeTab === "seller" && loadingSellers;
  const hasError   = activeTab === "seller" && !!sellerError;

  // ── Navigate to detail page — include entityType in URL ──
  const handleRowClick = (item: Request) => {
    router.push(`/RequestDetails/${item.requestId}?sellerId=${item.id}&entityType=${activeTab}`);
  };

  return (
    <>
      <Header admin onLogout={() => router.push("/")} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border
          ${toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
          {toast.type === "success" ? <IconCheck /> : <IconClose className="w-4 h-4 text-red-600 shrink-0" />}
          {toast.message}
        </div>
      )}

      <DeleteModal
        item={deleteTarget}
        tabLabel={activeTabLabel}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      <main className="bg-[#F7F2FB] min-h-screen px-5 pb-10 pt-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden">

            {/* Tabs */}
            <div className="px-8 pt-5">
              <div className="inline-flex bg-[#e9e2ff] p-1 rounded-xl shadow-sm">
                {TABS.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-10 py-2.5 rounded-lg text-base font-bold transition-all duration-200
                      ${activeTab === tab.key
                        ? "bg-[#4B0082] text-white shadow-md"
                        : "text-[#4B0082] hover:bg-white/60"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 py-6">

              {/* Title row */}
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#2D0066]">
                    {activeTab === "seller" ? "Seller Requests" : activeTab === "buyer" ? "Buyer Requests" : "Lab Module Requests"}
                  </h1>
                  <p className="text-gray-500 mt-1 text-sm">Review and manage onboarding requests</p>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="mb-5 flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[260px] relative">
                  <IconSearch />
                  <input
                    type="text"
                    placeholder="Search by Request ID, Name, or Email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4B0082] focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <IconClose />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="appearance-none pl-4 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4B0082] bg-gray-50 focus:bg-white cursor-pointer font-medium text-gray-700 transition-all"
                  >
                    <option value="All">All Status</option>
                    {["Open", "In Progress", "Closed", "Rejected", "Corrections Needed"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <IconChevronDown />
                  </span>
                </div>

                {(searchTerm || statusFilter !== "All") && (
                  <button
                    onClick={() => { setSearchTerm(""); setStatusFilter("All"); }}
                    className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5"
                  >
                    <IconClose />
                    Clear
                  </button>
                )}
              </div>

              {/* Error banner */}
              {hasError && (
                <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <IconWarning />
                  <span><strong>Failed to load:</strong> {sellerError}</span>
                </div>
              )}

              {/* Table */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#faf7ff] border-b border-gray-100">
                        <th className="px-6 py-4 text-left font-semibold text-gray-500 w-16 whitespace-nowrap">Sl. No</th>
                        {COLUMNS.map(({ field, label }) => (
                          <th
                            key={field}
                            onClick={() => handleSort(field)}
                            className="px-6 py-4 text-left font-semibold text-gray-500 cursor-pointer hover:bg-[#f0ebff] transition-colors select-none whitespace-nowrap"
                          >
                            <div className="flex items-center">
                              {label}
                              <SortIcon field={field} sortField={sortField} sortOrder={sortOrder} />
                            </div>
                          </th>
                        ))}
                        <th className="px-6 py-4 text-left font-semibold text-gray-500 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {isLoading ? (
                        <TableSkeleton />
                      ) : paginated.length > 0 ? (
                        paginated.map((item, idx) => {
                          const { badge, dot } = STATUS_STYLES[item.status] ?? DEFAULT_STYLE;
                          return (
                            <tr key={item.id} className="hover:bg-[#faf7ff] transition-colors group">
                              <td className="px-6 py-4 text-gray-400 font-medium">
                                {(safePage - 1) * PAGE_SIZE + idx + 1}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {/* ── FIX: pass entityType in URL ── */}
                                <span
                                  onClick={() => handleRowClick(item)}
                                  className="text-[#4B0082] font-semibold cursor-pointer hover:text-[#751bb5] hover:underline transition-all"
                                >
                                  {item.requestId}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">{item.name}</td>
                              <td className="px-6 py-4">
                                <a
                                  href={`mailto:${item.email}`}
                                  onClick={e => e.stopPropagation()}
                                  className="text-gray-600 hover:text-[#4B0082] transition-colors"
                                >
                                  {item.email}
                                </a>
                              </td>
                              <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  title="Delete request"
                                  onClick={() => setDeleteTarget(item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 bg-red-50 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-150 group/del"
                                >
                                  <IconTrash />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-5 py-14 text-center">
                            <div className="flex flex-col items-center gap-2 text-gray-400">
                              <IconEmpty />
                              <p className="text-sm font-medium">
                                {hasError ? "Could not load data. Please refresh." : "No requests found matching your criteria."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {!isLoading && filtered.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
                  <span className="text-xs text-gray-400">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} records
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCurrentPage(1)}                                  disabled={safePage === 1}          className={NAV_BTN}>«</button>
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}           disabled={safePage === 1}          className={NAV_BTN}>‹</button>
                      {getPageNumbers(safePage, totalPages).map((p, i) =>
                        p === "..." ? (
                          <span key={`e${i}`} className="px-2 py-1.5 text-xs text-gray-400">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p as number)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                              ${safePage === p
                                ? "bg-[#4B0082] text-white border-[#4B0082] shadow-sm"
                                : "border-gray-200 text-gray-600 hover:bg-[#f0ebff] hover:border-[#4B0082] hover:text-[#4B0082]"}`}
                          >
                            {p}
                          </button>
                        )
                      )}
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}  disabled={safePage === totalPages} className={NAV_BTN}>›</button>
                      <button onClick={() => setCurrentPage(totalPages)}                         disabled={safePage === totalPages} className={NAV_BTN}>»</button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </>
  );
}