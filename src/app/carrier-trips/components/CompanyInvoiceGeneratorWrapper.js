"use client";

import { useState } from "react";
import { FileText, Building2 } from "lucide-react";
import CompanyInvoiceGenerator from "./CompanyInvoiceGenerator";

export default function CompanyInvoiceGeneratorWrapper({ companies }) {
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowInvoiceGenerator(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
      >
        <Building2 className="w-4 h-4" />
        <FileText className="w-4 h-4" />
        Company Invoice
      </button>

      {showInvoiceGenerator && (
        <CompanyInvoiceGenerator
          companies={companies}
          onClose={() => setShowInvoiceGenerator(false)}
        />
      )}
    </>
  );
}
