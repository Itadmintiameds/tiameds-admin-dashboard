"use client";

import { useState } from "react";
import Image from "next/image";
import { FiBell, FiLogOut, FiUser } from "react-icons/fi";

type TopHeaderProps = {
  onLogout?: () => void;
};

export default function TopHeader({ onLogout }: TopHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-end px-8 shadow-sm z-10 relative">
      <div className="flex items-center space-x-6">
        {/* Notification Bell */}
        <button className="relative p-2 text-gray-500 hover:text-[#4B0082] transition-colors rounded-full hover:bg-purple-50">
          <FiBell className="w-6 h-6" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        </button>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-gray-200"></div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            className="flex items-center space-x-3 focus:outline-none"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="w-10 h-10 rounded-full bg-[#4B0082] text-white flex items-center justify-center font-bold text-lg shadow-sm border-2 border-white ring-2 ring-gray-100">
              A
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800">Admin</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </button>

          {dropdownOpen && (
            <>
              {/* Invisible overlay to close dropdown */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setDropdownOpen(false)}
              ></div>
              
              <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-lg py-2 border border-gray-100 z-20">
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#4B0082] flex items-center gap-2"
                  onClick={() => setDropdownOpen(false)}
                >
                  <FiUser className="w-4 h-4" />
                  My Profile
                </button>
                <div className="my-1 border-t border-gray-100"></div>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => {
                    setDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                >
                  <FiLogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
