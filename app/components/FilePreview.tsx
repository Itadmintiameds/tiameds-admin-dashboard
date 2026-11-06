"use client";

/**
 * Loads a protected document through the API client and shows it from a local blob URL.
 * The API sends X-Frame-Options: DENY and a sandbox CSP (so files can never run script on our origin);
 * a blob copy is not subject to those headers, so PDFs and images render fine in the viewer.
 */

import { useEffect, useState } from "react";
import { sellerClient } from "@/app/lib/axios";

export type FileBlob = { url: string | null; type: string; loading: boolean; error: string | null };

const EMPTY: FileBlob = { url: null, type: "", loading: false, error: null };

export function useFileBlob(path: string | null, params?: Record<string, string>): FileBlob {
  const [state, setState] = useState<FileBlob>(EMPTY);
  const key = path ? `${path}?${JSON.stringify(params ?? {})}` : null;

  useEffect(() => {
    if (!path) { setState(EMPTY); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    sellerClient.get(path, { params, responseType: "blob" })
      .then(r => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(r.data);
        setState({ url: objectUrl, type: (r.data.type || "").toLowerCase(), loading: false, error: null });
      })
      .catch(e => {
        if (!cancelled) setState({ ...EMPTY, error: e?.response?.status === 404 ? "File not found in storage." : "Could not load the file." });
      });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export default function FilePreview({ file, label }: { file: FileBlob; label: string }) {
  if (file.loading) return <p className="text-sm text-gray-400">Loading document…</p>;
  if (file.error) return <p className="text-sm text-red-500">{file.error}</p>;
  if (!file.url) return null;
  if (file.type === "application/pdf") {
    return <iframe src={file.url} title={label} className="w-full h-[60vh] rounded-lg border border-gray-200 shadow" />;
  }
  if (file.type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt={label} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow" />;
  }
  return (
    <a href={file.url} download className="px-4 py-2 rounded-lg bg-[#4B0082] text-white text-sm font-medium">
      Download file
    </a>
  );
}
