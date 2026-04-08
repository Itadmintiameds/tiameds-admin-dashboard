"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

interface AdminLoginProps {
  onClose: () => void;
}

export default function AdminLogin({ onClose }: AdminLoginProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((res) => setTimeout(res, 500));
    

    if (username === "admin" && password === "admin123") {
      setSuccess(true);
      // Keep modal visible while new page loads — zero flicker
      await new Promise((res) => setTimeout(res, 900));
      router.push("/components/AdminDashboard");
    } else {
      setIsLoading(false);
      setError("Invalid username or password");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60"
      onClick={onClose}
    >
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(145deg, #f0e8f8 0%, #e9ddf5 50%, #ede4f7 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Watermark */}
        <div
          className="absolute inset-0 bg-center bg-no-repeat bg-contain opacity-5"
          style={{ backgroundImage: "url('/assets/images/tiameds.logo.png')" }}
        />

<<<<<<< HEAD
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
=======
        {/* Decorative blobs */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(155,100,230,0.15) 0%, transparent 70%)",
            transform: "translate(-30%, -30%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(120,70,200,0.12) 0%, transparent 70%)",
            transform: "translate(30%, 30%)",
          }}
        />

        <div className="flex flex-col items-center gap-6 relative z-10">
          {/* Logo */}
          <Link
            href="/"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
>>>>>>> main
          >
            <img
              src="/assets/images/tiameds.logo.png"
              alt="Company logo"
              className="w-[220px] hover:opacity-80 transition-opacity duration-200"
            />
          </Link>

          {/* Card */}
          <div
            className="w-[420px] rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.5)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow:
                "0 8px 32px rgba(100,50,180,0.13), 0 2px 8px rgba(100,50,180,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            {/* Purple top accent bar */}
            <div
              style={{ height: "4px", background: "linear-gradient(90deg, #6b21a8, #9333ea, #7c3aed)" }}
            />

            <div className="p-8">
              {success ? (
                /* ── Redirecting state — stays visible while page navigates ── */
                <div className="flex flex-col items-center py-4 gap-5">
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 6px 24px rgba(124,58,237,0.3)",
                      animation: "pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
                    }}
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12.5l4.5 4.5L19 7"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[#4B0082] text-base">Login successful!</p>
                    <p className="text-sm mt-1" style={{ color: "#7c5aab" }}>
                      Redirecting to dashboard…
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: "4px", background: "rgba(107,33,168,0.1)" }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: "9999px",
                        background: "linear-gradient(90deg, #7c3aed, #9333ea)",
                        animation: "fill-bar 0.85s ease forwards",
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* ── Login form ── */
                <form onSubmit={handleSubmit}>
                  <h2 className="text-2xl font-bold text-center text-[#4B0082] mb-1">
                    Admin Login
                  </h2>
                  <p className="text-center text-sm mb-6" style={{ color: "#7c5aab" }}>
                    Sign in to access the admin panel
                  </p>

                  {error && (
                    <div
                      className="mb-5 px-4 py-2.5 rounded-lg text-sm text-center"
                      style={{
                        background: "rgba(220,38,38,0.07)",
                        border: "1px solid rgba(220,38,38,0.18)",
                        color: "#b91c1c",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block mb-1.5 text-sm font-semibold text-[#4B0082]">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                      placeholder="Enter username"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-[#171717] outline-none transition-all duration-150 disabled:opacity-60"
                      style={{
                        background: "rgba(255,255,255,0.8)",
                        border: "1.5px solid rgba(107,33,168,0.2)",
                      }}
                      onFocus={(e) => {
                        e.target.style.border = "1.5px solid #7c3aed";
                        e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)";
                      }}
                      onBlur={(e) => {
                        e.target.style.border = "1.5px solid rgba(107,33,168,0.2)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block mb-1.5 text-sm font-semibold text-[#4B0082]">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      placeholder="Enter password"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-[#171717] outline-none transition-all duration-150 disabled:opacity-60"
                      style={{
                        background: "rgba(255,255,255,0.8)",
                        border: "1.5px solid rgba(107,33,168,0.2)",
                      }}
                      onFocus={(e) => {
                        e.target.style.border = "1.5px solid #7c3aed";
                        e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)";
                      }}
                      onBlur={(e) => {
                        e.target.style.border = "1.5px solid rgba(107,33,168,0.2)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:cursor-not-allowed"
                    style={{
                      background: isLoading
                        ? "rgba(107,33,168,0.45)"
                        : "linear-gradient(135deg, #6b21a8, #7c3aed)",
                      boxShadow: isLoading ? "none" : "0 4px 16px rgba(107,33,168,0.32)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        const btn = e.currentTarget;
                        btn.style.background = "linear-gradient(135deg, #7c3aed, #9333ea)";
                        btn.style.boxShadow = "0 6px 20px rgba(107,33,168,0.42)";
                        btn.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        const btn = e.currentTarget;
                        btn.style.background = "linear-gradient(135deg, #6b21a8, #7c3aed)";
                        btn.style.boxShadow = "0 4px 16px rgba(107,33,168,0.32)";
                        btn.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Signing in…
                      </span>
                    ) : (
                      "Login"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Back to site */}
          {/* {!isLoading && !success && (
            <button
              onClick={onClose}
              className="text-sm transition-colors duration-150"
              style={{ color: "rgba(107,33,168,0.45)" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "rgba(107,33,168,0.8)")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "rgba(107,33,168,0.45)")}
            >
              ← Back to site
            </button>
          )} */}
        </div>
      </div>

      <style jsx>{`
        @keyframes pop-in {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes fill-bar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        input::placeholder {
          color: rgba(107, 33, 168, 0.28);
        }
      `}</style>
    </div>
  );
}