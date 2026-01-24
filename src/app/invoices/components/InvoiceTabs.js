"use client";

import { useState } from "react";

export default function InvoiceTabs({ children, defaultTab = "invoices" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [
    { id: "invoices", label: "Invoices", icon: "📋" },
    { id: "breakdown", label: "Company Breakdown", icon: "📊" },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {typeof children === "function" ? children(activeTab) : children}
      </div>
    </div>
  );
}
