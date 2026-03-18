"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import Image from 'next/image';
import { FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { FaHome, FaArrowLeft, FaChartLine } from 'react-icons/fa';

type HeaderProps = {
    admin?: boolean;
    onLogout?: () => void;
};

const NavLink = ({ href, icon: Icon, label }: { href: string; icon?: React.ElementType; label: string }) => (
    <Link
        href={href}
        className="group relative px-4 py-2 text-neutral-700 hover:text-[#4B0082] font-medium text-sm transition-colors duration-200"
    >
        <span className="flex items-center">
            {Icon && <Icon className="mr-2" />}
            {label}
        </span>
        <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#4B0082] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
    </Link>
);

const Header = ({ admin = false, onLogout }: HeaderProps) => {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            {/* Header */}
            <header className="fixed top-0 left-0 w-full z-50 bg-white border-b border-neutral-200 shadow-sm">
                <div className="mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-20">

                        {/* Logo */}
                        <Link href="/components/AdminDashboard" className="flex items-center group shrink-0">
                            <div className="relative h-14 w-48 sm:h-16 sm:w-56 lg:h-18 lg:w-64">
                                <Image
                                    src="/assets/images/tiameds.logo.png"
                                    alt="TiaMeds Technologies"
                                    fill
                                    className="object-contain transition-transform duration-300 group-hover:scale-105"
                                    sizes="100vw"
                                    priority
                                />
                            </div>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center space-x-6 ml-auto mr-6">
                            {admin ? (
                                <>
                                    <button
                                        onClick={() => router.back()}
                                        className="group relative px-4 py-2 text-neutral-700 hover:text-primary-600 font-medium text-sm transition-colors duration-200"
                                    >
                                        <span className="flex items-center">
                                            <FaArrowLeft className="mr-2" />
                                            Back
                                        </span>
                                        <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                                    </button>

                                    <NavLink href="/components/AdminDashboard" icon={FaHome} label="Home" />
                                    <NavLink href="/components/AdminInsights" icon={FaChartLine} label="Admin Insights" />
                                </>
                            ) : (
                                <NavLink href="/components/AdminDashboard" label="Home" />
                            )}
                        </nav>

                        {/* Divider + Logout */}
                        {onLogout && (
                            <>
                                <div className="hidden lg:block h-5 w-px bg-neutral-200 mr-4" />
                                <button
                                    onClick={onLogout}
                                    className="hidden lg:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-600 hover:text-red-600 border border-neutral-200 hover:border-red-300 rounded-lg transition-all duration-200 hover:bg-red-50"
                                >
                                    <FiLogOut className="text-sm" />
                                    Logout
                                </button>
                            </>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMenuOpen(true)}
                            className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors duration-200"
                            aria-label="Open menu"
                        >
                            <FiMenu className="w-6 h-6 text-neutral-700" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Spacer */}
            <div className="h-10" />

            {/* Mobile Overlay */}
            {menuOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMenuOpen(false)} />
            )}

            {/* Mobile Drawer */}
            <div className={`fixed top-0 right-0 h-screen w-72 bg-white z-50 transform transition-transform duration-300 ease-out lg:hidden shadow-xl ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
                <div className="flex items-center justify-between p-4 border-b border-neutral-100">
                    <div className="h-8 w-32 relative">
                        <Image src="/assets/images/tiameds.logo.png" alt="TiaMeds" fill className="object-contain" sizes="100vw" />
                    </div>
                    <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Close menu">
                        <FiX className="w-5 h-5 text-neutral-700" />
                    </button>
                </div>

                <div className="p-4">
                    <nav className="space-y-1 mb-8">
                        {admin ? (
                            <>
                                <button
                                    onClick={() => { setMenuOpen(false); router.back(); }}
                                    className="w-full flex items-center px-4 py-3 text-neutral-700 hover:text-[#4B0082] font-medium rounded-lg hover:bg-primary-50 transition-colors"
                                >
                                    <FaArrowLeft className="mr-3" /> Back
                                </button>
                                <Link href="/admin_f6c29e3d" onClick={() => setMenuOpen(false)}
                                    className="flex items-center px-4 py-3 text-neutral-700 hover:text-[#4B0082] font-medium rounded-lg hover:bg-primary-50 transition-colors">
                                    <FaHome className="mr-3" /> Home
                                </Link>
                                <Link href="/components/AdminInsights" onClick={() => setMenuOpen(false)}
                                    className="flex items-center px-4 py-3 text-neutral-700 hover:text-[#4B0082] font-medium rounded-lg hover:bg-primary-50 transition-colors">
                                    <FaChartLine className="mr-3" /> Admin Insights
                                </Link>
                            </>
                        ) : (
                            <Link href="/components/AdminDashboard" onClick={() => setMenuOpen(false)}
                                className="flex items-center px-4 py-3 text-neutral-700 hover:text-[#4B0082] font-medium rounded-lg hover:bg-primary-50 transition-colors">
                                Home
                            </Link>
                        )}
                    </nav>

                    {onLogout && (
                        <div className="pt-6 border-t border-neutral-100">
                            <button
                                onClick={() => { setMenuOpen(false); onLogout(); }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                            >
                                <FiLogOut /> Logout
                            </button>
                        </div>
                    )}

                    {!onLogout && (
                        <div className="mt-8 pt-6 border-t border-neutral-100">
                            <p className="text-neutral-500 text-sm text-center px-2">Transforming healthcare through innovative technology</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Header;