"use client";

import { useState, useEffect } from "react";
import { FiDownload, FiFileText, FiSearch, FiX, FiChevronDown, FiChevronRight, FiHome, FiPackage, FiUploadCloud } from "react-icons/fi";
import { pharmaClient, UPLOAD_PASSCODE_HEADERS } from "@/app/lib/axios";
import MigrateModal, { type MigrationTarget } from "./MigrateModal";

// ─── Types ────────────────────────────────────────────────────
type MigrationEntity = { id: string; name: string };
type Organization = {
  organizationId: number;
  organizationName: string;
  pharmacies: MigrationEntity[];
  warehouses: MigrationEntity[];
};
type OrgPage = { data: Organization[]; page: number; size: number; totalElements: number; totalPages: number; hasMore: boolean };

// ─── Constants ────────────────────────────────────────────────
const TEMPLATE_FALLBACK_NAME = "product_bulk_upload_template.csv";
const ORG_PAGE_SIZE          = 20;
const SEARCH_DEBOUNCE_MS     = 400;

const NAV_BTN = "px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-[#f0ebff] hover:border-[#4B0082] hover:text-[#4B0082] disabled:opacity-40 disabled:cursor-not-allowed transition-all";

// 1-based page numbers with ellipses, e.g. [1, "...", 4, 5, 6, "...", 12]
const getPageNumbers = (current: number, total: number): (number | "...")[] => {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
    .filter(p => p === 1 || p === total || Math.abs(p - current) <= 1);
  return pages.reduce<(number | "...")[]>((acc, p, i, arr) => {
    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
    acc.push(p);
    return acc;
  }, []);
};

// Pull the filename out of Content-Disposition, e.g. `attachment; filename="template.csv"`
const getFileName = (disposition?: string): string => {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : TEMPLATE_FALLBACK_NAME;
};

// With responseType "blob", error bodies also arrive as a Blob — read the message out of it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getErrorMessage = async (err: any): Promise<string> => {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return JSON.parse(text)?.message || text || err.message;
    } catch {
      return err.message;
    }
  }
  return data?.message || err?.message || "Failed to download template";
};

// ─── Entity List (pharmacies / warehouses of an org) ──────────
function EntityList({ title, icon, items, onMigrate }: {
  title: string; icon: React.ReactNode; items: MigrationEntity[]; onMigrate: (item: MigrationEntity) => void;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {icon}{title} ({items.length})
      </p>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-lg px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.id}</p>
              </div>
              <button
                onClick={() => onMigrate(item)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4B0082] border border-purple-200 bg-purple-50 hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082] transition-all duration-150"
              >
                <FiUploadCloud className="w-3.5 h-3.5" />Migrate
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No {title.toLowerCase()} found.</p>
      )}
    </div>
  );
}

export default function PharmaMigration() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Organizations (server-side search + pagination; page is 0-based) ──
  const [searchInput, setSearchInput]   = useState("");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(0);
  const [orgs, setOrgs]                 = useState<OrgPage | null>(null);
  const [loadingOrgs, setLoadingOrgs]   = useState(false);
  const [orgError, setOrgError]         = useState<string | null>(null);
  const [expandedOrgId, setExpandedOrgId] = useState<number | null>(null);
  const [migrateTarget, setMigrateTarget] = useState<MigrationTarget | null>(null);

  // Debounce typing before hitting the backend
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoadingOrgs(true);
    setOrgError(null);
    pharmaClient.get<OrgPage>("/admin/organizations", {
      params: { search, page, size: ORG_PAGE_SIZE },
      headers: UPLOAD_PASSCODE_HEADERS,
      skipAuthRefresh: true,
    })
      .then(res => { if (!cancelled) { setOrgs(res.data); setExpandedOrgId(null); } })
      .catch(err => { if (!cancelled) setOrgError(err?.response?.data?.message || err?.message || "Failed to fetch organizations"); })
      .finally(() => { if (!cancelled) setLoadingOrgs(false); });
    return () => { cancelled = true; };
  }, [search, page]);

  const handleMigrate = (org: Organization, type: "pharmacy" | "warehouse", item: MigrationEntity) => {
    setMigrateTarget({ type, id: item.id, name: item.name, organizationName: org.organizationName });
  };

  const totalPages = orgs?.totalPages ?? 0;
  const currentPage = page + 1; // 1-based for display

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await pharmaClient.get("/product/bulk-upload/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = getFileName(res.headers["content-disposition"]);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(await getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden">
      {migrateTarget && <MigrateModal target={migrateTarget} onClose={() => setMigrateTarget(null)} />}
      <div className="px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D0066]">Pharmacy Data Migration</h1>
          <p className="text-gray-500 mt-1 text-sm">Bulk upload pharmacy products using the CSV template</p>
        </div>

        {/* Template Download */}
        <div className="border border-purple-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-[#4B0082] flex items-center justify-center shrink-0">
              <FiFileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D0066]">Product Upload Template</h2>
              <p className="text-gray-500 text-sm mt-0.5">Download the CSV template, fill in the product details, and upload it for migration.</p>
            </div>
          </div>
          <button
            onClick={handleDownloadTemplate}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#6b21a8] to-[#7c3aed] shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {downloading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <FiDownload className="w-4 h-4" />
            )}
            {downloading ? "Downloading..." : "Download Template"}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <strong>Download failed:</strong> {error}
          </div>
        )}

        {/* Organizations */}
        <div className="border border-purple-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#2D0066]">Organizations</h2>
            <p className="text-gray-500 text-sm mt-0.5">Search an organization and pick a pharmacy or warehouse to migrate</p>
          </div>

          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search organizations..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4B0082] focus:border-transparent transition-all bg-gray-50 focus:bg-white" />
            {searchInput && (
              <button onClick={() => setSearchInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {orgError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <strong>Failed to load:</strong> {orgError}
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {loadingOrgs ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="h-3.5 w-1/3 bg-gray-100 rounded-full animate-pulse" />
                </div>
              ))
            ) : orgs && orgs.data.length > 0 ? (
              orgs.data.map(org => {
                const isOpen = expandedOrgId === org.organizationId;
                return (
                  <div key={org.organizationId}>
                    <button
                      onClick={() => setExpandedOrgId(isOpen ? null : org.organizationId)}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${isOpen ? "bg-[#faf7ff]" : "hover:bg-[#faf7ff]"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isOpen ? <FiChevronDown className="w-4 h-4 text-[#4B0082] shrink-0" /> : <FiChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className="text-sm font-semibold text-gray-800 truncate">{org.organizationName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200">{org.pharmacies.length} Pharmacies</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">{org.warehouses.length} Warehouses</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 bg-[#faf7ff] grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <EntityList title="Pharmacies" icon={<FiHome className="w-3.5 h-3.5" />} items={org.pharmacies}
                          onMigrate={item => handleMigrate(org, "pharmacy", item)} />
                        <EntityList title="Warehouses" icon={<FiPackage className="w-3.5 h-3.5" />} items={org.warehouses}
                          onMigrate={item => handleMigrate(org, "warehouse", item)} />
                      </div>
                    )}
                  </div>
                );
              })
            ) : !orgError ? (
              <p className="px-5 py-12 text-center text-sm font-medium text-gray-400">No organizations found.</p>
            ) : null}
          </div>

          {/* Pagination */}
          {!loadingOrgs && orgs && orgs.totalElements > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
              <span className="text-xs text-gray-400">
                Showing {page * orgs.size + 1}–{Math.min(page * orgs.size + orgs.data.length, orgs.totalElements)} of {orgs.totalElements} organizations
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(0)} disabled={page === 0} className={NAV_BTN}>«</button>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className={NAV_BTN}>‹</button>
                  {getPageNumbers(currentPage, totalPages).map((p, i) =>
                    p === "..." ? (
                      <span key={`e${i}`} className="px-2 py-1.5 text-xs text-gray-400">…</span>
                    ) : (
                      <button key={p} onClick={() => setPage((p as number) - 1)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${currentPage === p ? "bg-[#4B0082] text-white border-[#4B0082] shadow-sm" : "border-gray-200 text-gray-600 hover:bg-[#f0ebff] hover:border-[#4B0082] hover:text-[#4B0082]"}`}>
                        {p}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={!orgs.hasMore} className={NAV_BTN}>›</button>
                  <button onClick={() => setPage(totalPages - 1)} disabled={!orgs.hasMore} className={NAV_BTN}>»</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
