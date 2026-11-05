"use client";

import { useState, useMemo, useRef } from "react";
import { FiX, FiUploadCloud, FiFileText, FiPlay, FiAlertTriangle, FiHome, FiPackage, FiDatabase, FiCheckCircle } from "react-icons/fi";
import { pharmaClient, UPLOAD_PASSCODE_HEADERS } from "@/app/lib/axios";

// ─── Types ────────────────────────────────────────────────────
export type MigrationTarget = {
  type: "pharmacy" | "warehouse";
  id: string;
  name: string;
  organizationName: string;
};

type RowStatus = "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";

type BulkUploadRow = {
  line: number;
  productCode: string | null;
  productName: string | null;
  batchNumber: string | null;
  status: RowStatus;
  productId: string | null;
  packagingId: string | null;
  batchId: string | null;
  stockAdded: number | null;
  error: string | null;
  warnings: string[];
};

type BulkUploadResult = {
  locationType: string;
  locationId: string;
  locationName: string;
  dryRun: boolean;
  totalRows: number;
  productsCreated: number;
  productsUpdated: number;
  batchesCreated: number;
  rowsSkipped: number;
  rowsFailed: number;
  stockAdded: number;
  rows: BulkUploadRow[];
  fileErrors: string[];
};

type RowFilter = "ALL" | RowStatus | "WARNINGS";

// ─── Constants ────────────────────────────────────────────────
const ROWS_PAGE_SIZE = 50;

const ROW_STATUS_STYLES: Record<RowStatus, string> = {
  CREATED: "bg-green-50 text-green-700 ring-green-200",
  UPDATED: "bg-blue-50 text-blue-700 ring-blue-200",
  SKIPPED: "bg-gray-50 text-gray-600 ring-gray-200",
  FAILED:  "bg-red-50 text-red-700 ring-red-200",
};

const FILTERS: { key: RowFilter; label: string }[] = [
  { key: "ALL",      label: "All"           },
  { key: "CREATED",  label: "Created"       },
  { key: "UPDATED",  label: "Updated"       },
  { key: "SKIPPED",  label: "Skipped"       },
  { key: "FAILED",   label: "Failed"        },
  { key: "WARNINGS", label: "With Warnings" },
];

const NAV_BTN = "px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-[#f0ebff] hover:border-[#4B0082] hover:text-[#4B0082] disabled:opacity-40 disabled:cursor-not-allowed transition-all";

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getErrorMessage = (err: any): string =>
  err?.response?.data?.message || err?.message || "Request failed";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

// ─── Stat Tile ────────────────────────────────────────────────
function Stat({ label, value, tone = "text-[#2D0066]" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border border-gray-100 rounded-xl px-4 py-3 bg-gray-50/50">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-0.5 ${tone}`}>{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

// ─── Confirm Migration Popup ──────────────────────────────────
function ConfirmMigrateModal({ target, fileName, preview, onConfirm, onCancel }: {
  target: MigrationTarget; fileName: string; preview: BulkUploadResult; onConfirm: () => void; onCancel: () => void;
}) {
  const lines: [string, number][] = [
    ["Products to create", preview.productsCreated],
    ["Products to update", preview.productsUpdated],
    ["Batches to create",  preview.batchesCreated],
    ["Stock to add",       preview.stockAdded],
    ["Rows skipped",       preview.rowsSkipped],
  ];
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      {/* Explicit width: globals.css defines --spacing-md (16px), which Tailwind v4 uses for max-w-md */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[440px] p-6">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-purple-100 text-[#4B0082] rounded-full flex items-center justify-center">
            <FiDatabase className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-center text-gray-900 mb-1">Confirm Migration</h3>
        <p className="text-sm text-center text-gray-600">This will write inventory into</p>
        <p className="text-sm font-semibold text-center text-[#4B0082] mb-1">{target.name} ({target.id})</p>
        <p className="text-xs text-center text-gray-400 mb-4 truncate">from {fileName}</p>

        <p className="text-xs text-center text-gray-500 mb-2">Based on the dry run:</p>
        <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 mb-4">
          {lines.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-800 tabular-nums">{value.toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>

        {preview.rowsFailed > 0 && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            <FiAlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>{preview.rowsFailed} row(s) failed</strong> in the dry run and will not be imported. The rest will still be written.</span>
          </div>
        )}

        <p className="text-xs text-center text-red-500 mb-5">Writes cannot be undone from here. Re-uploading the same file will not duplicate batches.</p>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-[#4B0082] hover:bg-[#6b21a8] text-white rounded-md text-sm font-medium transition-colors">
            Yes, Migrate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function MigrateModal({ target, onClose }: { target: MigrationTarget; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [running, setRunning] = useState<"dryRun" | "migrate" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<BulkUploadResult | null>(null);
  const [filter, setFilter]   = useState<RowFilter>("ALL");
  const [rowPage, setRowPage] = useState(1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = ""; // allow re-picking the same file after editing it
    if (picked && !picked.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      return;
    }
    setFile(picked);
    setResult(null);
    setError(null);
  };

  const runUpload = async (dryRun: boolean) => {
    if (!file) return;
    setConfirmOpen(false);
    setRunning(dryRun ? "dryRun" : "migrate");
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await pharmaClient.post("/product/bulk-upload", formData, {
        params: { dryRun, [target.type === "pharmacy" ? "pharmacyId" : "warehouseId"]: target.id },
        // Must not be JSON or axios serialises the FormData; the browser fills in the multipart boundary
        headers: { ...UPLOAD_PASSCODE_HEADERS, "Content-Type": "multipart/form-data" },
        skipAuthRefresh: true,
      });
      setResult(res.data?.data ?? res.data);
      setFilter("ALL");
      setRowPage(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRunning(null);
    }
  };

  // Real migration is only offered right after a dry run of this file that the file-level checks passed
  const canMigrate = !!file && !running && !!result?.dryRun && !result.fileErrors?.length && result.totalRows > 0;

  const counts = useMemo(() => {
    const c: Record<RowFilter, number> = { ALL: 0, CREATED: 0, UPDATED: 0, SKIPPED: 0, FAILED: 0, WARNINGS: 0 };
    result?.rows.forEach(r => {
      c.ALL++;
      c[r.status]++;
      if (r.warnings?.length) c.WARNINGS++;
    });
    return c;
  }, [result]);

  const filteredRows = useMemo(() => {
    const rows = result?.rows ?? [];
    if (filter === "ALL") return rows;
    if (filter === "WARNINGS") return rows.filter(r => r.warnings?.length);
    return rows.filter(r => r.status === filter);
  }, [result, filter]);

  const totalRowPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PAGE_SIZE));
  const safeRowPage   = Math.min(rowPage, totalRowPages);
  const pagedRows     = filteredRows.slice((safeRowPage - 1) * ROWS_PAGE_SIZE, safeRowPage * ROWS_PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={!running ? onClose : undefined} />
      {confirmOpen && result && file && (
        <ConfirmMigrateModal target={target} fileName={file.name} preview={result}
          onConfirm={() => runUpload(false)} onCancel={() => setConfirmOpen(false)} />
      )}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-0.5">Migrate Inventory</p>
            <h3 className="text-lg font-bold text-[#2D0066] truncate flex items-center gap-2">
              {target.type === "pharmacy" ? <FiHome className="w-4 h-4 shrink-0" /> : <FiPackage className="w-4 h-4 shrink-0" />}
              {target.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {target.organizationName} · {target.type === "pharmacy" ? "Pharmacy" : "Warehouse"} · {target.id}
            </p>
          </div>
          <button onClick={onClose} disabled={!!running} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* File + actions */}
          <div className="border border-purple-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-[#4B0082] flex items-center justify-center shrink-0">
                <FiFileText className="w-5 h-5" />
              </div>
              {file ? (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No CSV selected</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!!running}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#4B0082] border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all disabled:opacity-50"
              >
                <FiUploadCloud className="w-4 h-4" />{file ? "Change CSV" : "Upload CSV"}
              </button>
              <button
                onClick={() => runUpload(true)}
                disabled={!file || !!running}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#4B0082] border border-[#4B0082] bg-white hover:bg-[#f0ebff] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running === "dryRun" ? <Spinner /> : <FiPlay className="w-4 h-4" />}
                {running === "dryRun" ? "Running..." : "Dry Run"}
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!canMigrate}
                title={canMigrate ? undefined : "Run a successful dry run on this file first"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#6b21a8] to-[#7c3aed] shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none"
              >
                {running === "migrate" ? <Spinner /> : <FiDatabase className="w-4 h-4" />}
                {running === "migrate" ? "Migrating..." : "Migrate"}
              </button>
            </div>
          </div>

          {file && !result && !running && !error && (
            <p className="text-xs text-gray-500 px-1">Run a dry run first — Migrate unlocks once the dry run passes the file checks.</p>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <strong>Failed:</strong> {error}
            </div>
          )}

          {result && (
            <>
              {result.dryRun ? (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                  <strong>Dry run</strong> — nothing was written. This is what the upload would do for{" "}
                  <strong>{result.locationName}</strong> ({result.locationId}).
                </div>
              ) : (
                <div className="flex items-start gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <FiCheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>Migration completed</strong> for <strong>{result.locationName}</strong> ({result.locationId}).
                    {result.rowsFailed > 0 && <> {result.rowsFailed} row(s) failed — fix them in the file and re-run; existing batches won&apos;t be duplicated.</>}
                  </span>
                </div>
              )}

              {result.fileErrors?.length > 0 && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <p className="font-semibold mb-1">File errors</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.fileErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <Stat label="Total Rows"       value={result.totalRows} />
                <Stat label="Products Created" value={result.productsCreated} tone="text-green-700" />
                <Stat label="Products Updated" value={result.productsUpdated} tone="text-blue-700" />
                <Stat label="Batches Created"  value={result.batchesCreated} />
                <Stat label="Rows Skipped"     value={result.rowsSkipped} tone="text-gray-600" />
                <Stat label="Rows Failed"      value={result.rowsFailed} tone={result.rowsFailed ? "text-red-600" : "text-gray-600"} />
                <Stat label="Stock Added"      value={result.stockAdded} />
              </div>

              {/* Row filter */}
              <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => { setFilter(f.key); setRowPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filter === f.key ? "bg-[#4B0082] text-white border-[#4B0082]" : "border-gray-200 text-gray-600 hover:bg-[#f0ebff] hover:border-[#4B0082] hover:text-[#4B0082]"}`}>
                    {f.label} ({counts[f.key]})
                  </button>
                ))}
              </div>

              {/* Rows */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#faf7ff] border-b border-gray-100">
                        {["Line", "Product Code", "Product Name", "Batch", "Status", "Stock", "Details"].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pagedRows.length > 0 ? pagedRows.map(r => (
                        <tr key={r.line} className="align-top hover:bg-[#faf7ff]">
                          <td className="px-4 py-3 text-gray-400 tabular-nums">{r.line}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.productCode || "—"}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{r.productName || "—"}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.batchNumber || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${ROW_STATUS_STYLES[r.status] ?? ROW_STATUS_STYLES.SKIPPED}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums">{r.stockAdded ?? "—"}</td>
                          <td className="px-4 py-3 text-xs space-y-1 min-w-[240px]">
                            {r.error && <p className="text-red-600">{r.error}</p>}
                            {r.warnings?.map((w, i) => (
                              <p key={i} className="flex items-start gap-1 text-amber-700">
                                <FiAlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{w}
                              </p>
                            ))}
                            {!r.error && !r.warnings?.length && <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No rows in this view.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row pagination */}
              {filteredRows.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-1">
                  <span className="text-xs text-gray-400">
                    Showing {(safeRowPage - 1) * ROWS_PAGE_SIZE + 1}–{Math.min(safeRowPage * ROWS_PAGE_SIZE, filteredRows.length)} of {filteredRows.length} rows
                  </span>
                  {totalRowPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setRowPage(p => Math.max(1, p - 1))} disabled={safeRowPage === 1} className={NAV_BTN}>‹ Prev</button>
                      <span className="px-2 text-xs text-gray-500">{safeRowPage} / {totalRowPages}</span>
                      <button onClick={() => setRowPage(p => Math.min(totalRowPages, p + 1))} disabled={safeRowPage === totalRowPages} className={NAV_BTN}>Next ›</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
