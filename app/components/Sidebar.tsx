"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { FiHome, FiChevronDown, FiChevronRight, FiPieChart } from "react-icons/fi";

type SidebarProps = {
  activeCategory?: string;
  activeType?: string;
  onSelect?: (category: string, type: string) => void;
};

export default function Sidebar({ activeCategory, activeType, onSelect }: SidebarProps) {
  const pathname = usePathname();
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [updatesOpen, setUpdatesOpen] = useState(true);

  const navItems = [
    { key: "seller", label: "Seller" },
    { key: "buyer", label: "Buyer" },
    { key: "lab", label: "Lab" },
    { key: "pharma", label: "Pharmacy" },
  ];

  const handleSelect = (category: string, type: string) => {
    if (onSelect) {
      onSelect(category, type);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col z-20 shadow-sm">
      <div className="p-6 border-b border-gray-100 flex items-center justify-center">
        <Link href="/components/AdminDashboard" className="relative h-12 w-48 block">
          <Image
            src="/assets/images/tiameds.logo.png"
            alt="TiaMeds"
            fill
            className="object-contain"
            priority
          />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
        <div>
          <Link href="/components/AdminInsights" className={`flex items-center px-2 py-2 mb-4 text-sm font-medium rounded-md transition-colors ${activeCategory === "insights" ? "bg-purple-50 text-[#4B0082]" : "text-gray-700 hover:text-[#4B0082] hover:bg-gray-50"}`}>
            <FiPieChart className="text-lg mr-2" />
            <span>Admin Insights</span>
          </Link>

          {/* Profile Requests Section */}
          <div className="mb-4">
            <button
              onClick={() => setRequestsOpen(!requestsOpen)}
              className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-700 hover:text-[#4B0082] rounded-md transition-colors"
            >
              <span>Profile Requests</span>
              {requestsOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            
            {requestsOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                {navItems.map((item) => {
                  const isActive = activeCategory === "requests" && activeType === item.key;
                  return (
                    <button
                      key={`req-${item.key}`}
                      onClick={() => handleSelect("requests", item.key)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-purple-50 text-[#4B0082] font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Profile Updates Section */}
          <div>
            <button
              onClick={() => setUpdatesOpen(!updatesOpen)}
              className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-700 hover:text-[#4B0082] rounded-md transition-colors"
            >
              <span>Profile Updates</span>
              {updatesOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            
            {updatesOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                {navItems.map((item) => {
                  const isActive = activeCategory === "updates" && activeType === item.key;
                  return (
                    <button
                      key={`upd-${item.key}`}
                      onClick={() => handleSelect("updates", item.key)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-purple-50 text-[#4B0082] font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-center text-gray-400">© 2026 TiaMeds</p>
      </div>
    </aside>
  );
}
