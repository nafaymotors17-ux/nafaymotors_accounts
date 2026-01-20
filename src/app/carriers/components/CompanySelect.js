"use client";

import { useState, useRef, useEffect } from "react";

export default function CompanySelect({ companies, value, onChange, required = false, showUserInfo = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Ensure companies is an array and has valid data
  const validCompanies = Array.isArray(companies) ? companies.filter(c => c && c.name) : [];
  
  const filteredCompanies = validCompanies.filter((company) =>
    company.name && company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCompany = validCompanies.find((c) => {
    const cId = c._id?.toString() || c._id;
    const vId = value?.toString() || value;
    return cId === vId;
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debug: log companies count
  if (validCompanies.length === 0 && companies && companies.length > 0) {
    console.log("CompanySelect: companies array exists but no valid companies found", companies);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer bg-white flex items-center justify-between hover:border-gray-400"
      >
        <span className={selectedCompany ? "text-gray-900" : "text-gray-500"}>
          {selectedCompany ? selectedCompany.name : validCompanies.length === 0 ? "No companies available" : "Select Company"}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Search input */}
          <div className="p-2 border-b sticky top-0 bg-white">
            <input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Company list */}
          <div className="max-h-48 overflow-auto">
            {filteredCompanies.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No companies found
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const companyId = company._id?.toString() || company._id;
                const isSelected = (value?.toString() || value) === companyId;
                return (
                  <div
                    key={companyId}
                    onClick={() => {
                      onChange(companyId);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                      isSelected ? "bg-blue-50 font-medium" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{company.name}</span>
                      {showUserInfo && company.user?.username && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({company.user.username})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
