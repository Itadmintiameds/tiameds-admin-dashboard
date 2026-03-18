"use client";

import Header from "@/app/components/Header";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────
const API_URL = "https://api-test-aggreator.tiameds.ai/api/v1/temp-sellers";
const API_KEY = "YOUR_API_KEY";

const STATUS_MAP: Record<string, string> = {
  APPROVED: "Closed", CLOSED: "Closed",
  IN_PROGRESS: "In Progress", INPROGRESS: "In Progress",
  PENDING: "Open", OPEN: "Open",
  REJECTED: "Rejected",
  CORRECTION: "Corrections Needed", CORRECTION_REQUIRED: "Corrections Needed",
  CORRECTIONS_NEEDED: "Corrections Needed", CORRECTIONREQUIRED: "Corrections Needed",
};

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  "Open":               { badge: "bg-yellow-50 text-yellow-700 ring-yellow-200",  dot: "bg-yellow-500"  },
  "In Progress":        { badge: "bg-blue-50 text-blue-700 ring-blue-200",        dot: "bg-blue-500"    },
  "Closed":             { badge: "bg-green-50 text-green-700 ring-green-200",     dot: "bg-green-500"   },
  "Rejected":           { badge: "bg-red-50 text-red-700 ring-red-200",           dot: "bg-red-500"     },
  "Corrections Needed": { badge: "bg-amber-50 text-amber-700 ring-amber-200",     dot: "bg-amber-500"   },
};
const DEFAULT_STYLE = { badge: "bg-gray-50 text-gray-600 ring-gray-200", dot: "bg-gray-400" };

// ─── Types ────────────────────────────────────────────────────
type TimeRange = "today" | "week" | "month" | "year";

interface Seller {
  id: number;
  requestId: string;
  name: string;
  email: string;
  date: string;   // ISO date string
  status: string; // normalised
}

// ─── Helpers ─────────────────────────────────────────────────
const normalizeStatus = (raw: string) => STATUS_MAP[raw?.toUpperCase()] ?? raw;

const formatDate = (s: string): string => {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
};

const filterByRange = (list: Seller[], range: TimeRange): Seller[] => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(today);
  if (range === "week")  cutoff.setDate(cutoff.getDate() - 7);
  if (range === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  if (range === "year")  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return list.filter(r => new Date(r.date) >= (range === "today" ? today : cutoff));
};

// ─── Sub-components ───────────────────────────────────────────

function StatPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-4 rounded-2xl ${color}`}>
      <span className="text-3xl font-bold">{count}</span>
      <span className="text-xs font-medium mt-1 opacity-80">{label}</span>
    </div>
  );
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-[#2D0066]">{title}</h2>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SellerRow({ seller, onClick }: { seller: Seller; onClick: () => void }) {
  const { badge, dot } = STATUS_STYLES[seller.status] ?? DEFAULT_STYLE;
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F9F6FF] hover:bg-[#ede8ff] transition-colors cursor-pointer group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#4B0082] text-sm group-hover:underline truncate">
            {seller.requestId}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{seller.name}</p>
      </div>
      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {seller.status}
        </span>
        <span className="text-xs text-gray-400 hidden sm:block">{formatDate(seller.date)}</span>
        <svg className="w-4 h-4 text-gray-300 group-hover:text-[#4B0082] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <svg className="w-10 h-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-14 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function AdminInsights() {
  const router = useRouter();

  const [sellers,  setSellers]  = useState<Seller[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  // ── Fetch seller list ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(API_URL, { headers: { "X-API-Key": API_KEY } })
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(json => {
        if (cancelled) return;
        const list: any[] = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
        setSellers(list.map(item => ({
          id:        item.tempSellerId,
          requestId: item.tempSellerRequestId ?? `#${item.tempSellerId}`,
          name:      item.tempSellerName ?? item.sellerName ?? "—",
          email:     item.tempSellerEmail ?? item.email ?? "—",
          date:      item.createdAt ? item.createdAt.split("T")[0] : item.updatedAt?.split("T")[0] ?? "—",
          status:    normalizeStatus(item.status ?? ""),
        })));
      })
      .catch(err => { if (!cancelled) setError(err.message ?? "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Derived data ───────────────────────────────────────────
  const inRange = useMemo(() => filterByRange(sellers, timeRange), [sellers, timeRange]);

  const stats = useMemo(() => ({
    total:       inRange.length,
    open:        inRange.filter(r => r.status === "Open").length,
    inProgress:  inRange.filter(r => r.status === "In Progress").length,
    closed:      inRange.filter(r => r.status === "Closed").length,
    rejected:    inRange.filter(r => r.status === "Rejected").length,
    corrections: inRange.filter(r => r.status === "Corrections Needed").length,
  }), [inRange]);

  // Latest actioned = Closed / Rejected / Corrections Needed — sorted newest first
  const recentActioned = useMemo(() =>
    inRange
      .filter(r => r.status === "Closed" || r.status === "Rejected" || r.status === "Corrections Needed")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    [inRange]
  );

  // Latest open = Open / In Progress — sorted newest first
  const recentOpen = useMemo(() =>
    inRange
      .filter(r => r.status === "Open" || r.status === "In Progress")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    [inRange]
  );

  // All sellers sorted newest first — for "recent requests" strip
  const allRecent = useMemo(() =>
    [...sellers]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [sellers]
  );

  const goToDetail = (seller: Seller) =>
    router.push(`/RequestDetails/${seller.requestId}?sellerId=${seller.id}`);

  return (
    <>
      <Header admin onLogout={() => router.push("/page")} />
      <main className="pt-10 bg-[#F7F2FB] min-h-screen px-5 pb-10">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Page header ──────────────────────────────── */}
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#2D0066]">Seller Insights</h1>
                <p className="text-gray-500 text-sm mt-1">Live overview of seller onboarding requests</p>
              </div>

              {/* Time range toggle */}
              <div className="inline-flex bg-[#e9e2ff] p-1 rounded-full shadow-sm">
                {(["today", "week", "month", "year"] as TimeRange[]).map(r => (
                  <button key={r} onClick={() => setTimeRange(r)}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 capitalize
                      ${timeRange === r ? "bg-[#4B0082] text-white shadow-md" : "text-[#4B0082] hover:bg-white/60"}`}>
                    {r === "today" ? "Today" : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span><strong>Failed to load sellers:</strong> {error}</span>
            </div>
          )}

          {/* ── Summary banner ────────────────────────────── */}
          <div className="bg-gradient-to-r from-[#2D0066] to-[#5c1a9e] rounded-3xl p-8 text-white shadow-lg">
            <p className="text-purple-200 text-xs font-semibold uppercase tracking-widest mb-5">
              {timeRange === "today" ? "Today" : timeRange === "week" ? "Last 7 days" : timeRange === "month" ? "Last 30 days" : "Last 12 months"}
              {" "}· {stats.total} seller request{stats.total !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatPill count={stats.total}       label="Total"       color="bg-white/10 text-white" />
              <StatPill count={stats.open}        label="Open"        color="bg-yellow-400/20 text-yellow-200" />
              <StatPill count={stats.inProgress}  label="In Progress" color="bg-blue-400/20 text-blue-200" />
              <StatPill count={stats.closed}      label="Closed"      color="bg-green-400/20 text-green-200" />
              <StatPill count={stats.rejected}    label="Rejected"    color="bg-red-400/20 text-red-200" />
              <StatPill count={stats.corrections} label="Corrections" color="bg-amber-400/20 text-amber-200" />
            </div>
          </div>

          {/* ── Two-column section ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Recently Actioned */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 p-6">
              <SectionHeading
                title="Recently Actioned"
                sub="Latest Closed · Rejected · Corrections Needed"
              />
              {loading ? <Skeleton /> : recentActioned.length === 0
                ? <EmptyState message="No actioned requests in this period." />
                : (
                  <div className="space-y-2">
                    {recentActioned.map(s => (
                      <SellerRow key={s.id} seller={s} onClick={() => goToDetail(s)} />
                    ))}
                  </div>
                )}
            </div>

            {/* Awaiting Action */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 p-6">
              <SectionHeading
                title="Awaiting Action"
                sub="Latest Open · In Progress requests"
              />
              {loading ? <Skeleton /> : recentOpen.length === 0
                ? <EmptyState message="No pending requests in this period." />
                : (
                  <div className="space-y-2">
                    {recentOpen.map(s => (
                      <SellerRow key={s.id} seller={s} onClick={() => goToDetail(s)} />
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* ── All recent requests strip ─────────────────── */}
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <SectionHeading title="Latest Requests" sub="Most recently submitted — across all statuses" />
              <button
                onClick={() => router.push("/admin_f6c29e3d/dashboard")}
                className="text-xs font-semibold text-[#4B0082] hover:underline flex items-center gap-1"
              >
                View all
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {loading ? <Skeleton /> : allRecent.length === 0
              ? <EmptyState message="No requests found." />
              : (
                <div className="space-y-2">
                  {allRecent.map(s => (
                    <SellerRow key={s.id} seller={s} onClick={() => goToDetail(s)} />
                  ))}
                </div>
              )}
          </div>

        </div>
      </main>
    </>
  );
}