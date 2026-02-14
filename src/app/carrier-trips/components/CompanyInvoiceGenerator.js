"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { X, Download, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getCarsByCompany } from "@/app/lib/carriers-actions/cars";
import { formatDate } from "@/app/lib/utils/dateFormat";
import { useUser } from "@/app/components/UserContext";
import { createInvoice } from "@/app/lib/invoice-actions/invoices";

export default function CompanyInvoiceGenerator({
  companies,
  initialCompany = null,
  onClose,
  selectedTripIds = [],
}) {
  const params = useSearchParams();

  // Get filters from URL params (set in main page)
  const companyFilter = params.get("company") || "";
  const startDateFilter = params.get("startDate") || "";
  const endDateFilter = params.get("endDate") || "";
  const isActiveFilter = params.get("isActive") || "";
  const tripNumberFilter = params.get("tripNumber") || "";

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [descriptions, setDescriptions] = useState([]);
  const { fullUserData } = useUser();

  // Sender company details - auto-filled from user profile, but editable
  const [senderCompanyName, setSenderCompanyName] = useState("");
  const [senderCompanyAddress, setSenderCompanyAddress] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vatPercentage, setVatPercentage] = useState(""); // VAT percentage (e.g., 15 for 15%)
  const [isSaving, setIsSaving] = useState(false);

  // Find the selected company from companies list
  const selectedCompany = useMemo(() => {
    if (companyFilter) {
      return companies.find((c) => c.name === companyFilter) || null;
    }
    return initialCompany;
  }, [companyFilter, companies, initialCompany]);

  const clientName = selectedCompany?.name || companyFilter || "";

  // Cars are already filtered by selected trips from backend
  // No need for frontend filtering
  const filteredCars = cars;

  // Extract unique trip numbers from cars
  const tripNumbers = useMemo(() => {
    const tripSet = new Set();
    filteredCars.forEach((car) => {
      if (car.carrier && car.carrier.tripNumber) {
        tripSet.add(car.carrier.tripNumber);
      }
    });
    return Array.from(tripSet).sort();
  }, [filteredCars]);

  const totals = useMemo(() => {
    const totalAmount = filteredCars.reduce(
      (sum, car) => sum + (car?.amount || 0),
      0,
    );
    const vatPercent = parseFloat(vatPercentage) || 0;
    const vatAmount = vatPercent > 0 ? (totalAmount * vatPercent) / 100 : 0;
    const totalWithVat = totalAmount + vatAmount;
    return {
      totalAmount,
      vatPercentage: vatPercent,
      vatAmount,
      totalWithVat,
    };
  }, [filteredCars, vatPercentage]);

  // Set sender company details from user context on mount
  useEffect(() => {
    if (fullUserData) {
      // Set sender company name from name field (for backend, not shown in UI)
      const userName = fullUserData.name || fullUserData.username || "";
      setSenderCompanyName(userName);
      // Set address (for backend, not shown in UI)
      setSenderCompanyAddress(fullUserData.address || "");
    }
  }, [fullUserData]);

  // Fetch cars only when company and date filters are applied
  useEffect(() => {
    const fetchCars = async () => {
      // Only fetch if we have company and date filters
      if (!companyFilter || !startDateFilter || !endDateFilter) {
        setCars([]);
        return;
      }

      if (!selectedCompany) {
        setCars([]);
        return;
      }

      setLoading(true);
      try {
        // If trips are selected in main view, filter by those trip IDs
        // Otherwise, use trip number filter if provided
        const carrierIds =
          selectedTripIds.length > 0 ? selectedTripIds : undefined;

        const result = await getCarsByCompany({
          companyName: selectedCompany.name,
          startDate: startDateFilter,
          endDate: endDateFilter,
          tripNumber: tripNumberFilter || undefined, // Pass trip number filter
          carrierIds: carrierIds, // Pass selected trip IDs from main view
          isActive: isActiveFilter, // Pass the active/inactive filter
        });

        if (result.success) {
          const fetchedCars = result.cars || [];
          setCars(fetchedCars);
        } else {
          alert(result.error || "Failed to fetch cars");
          setCars([]);
        }
      } catch (error) {
        console.error("Error fetching cars:", error);
        alert("Failed to fetch cars");
        setCars([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, [
    companyFilter,
    startDateFilter,
    endDateFilter,
    isActiveFilter,
    tripNumberFilter,
    selectedCompany,
    selectedTripIds,
  ]);

  const addDescription = () => {
    setDescriptions([...descriptions, ""]);
  };

  const removeDescription = (index) => {
    setDescriptions(descriptions.filter((_, i) => i !== index));
  };

  const updateDescription = (index, value) => {
    const updated = [...descriptions];
    updated[index] = value;
    setDescriptions(updated);
  };

  const saveInvoice = async () => {
    if (!selectedCompany || filteredCars.length === 0) {
      return { success: false, error: "No cars to invoice" };
    }

    // Use default sender company name if not set (from user)
    const finalSenderName =
      senderCompanyName.trim() ||
      fullUserData?.name ||
      fullUserData?.username ||
      "COMPANY";

    try {
      const invoiceData = {
        senderCompanyName: finalSenderName,
        senderAddress: senderCompanyAddress.trim() || "",
        clientCompanyName: clientName,
        invoiceDate: new Date(),
        startDate: startDateFilter,
        endDate: endDateFilter,
        carIds: filteredCars.map((car) => car._id),
        subtotal: totals.totalAmount,
        vatPercentage: totals.vatPercentage,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalWithVat,
        descriptions: descriptions.filter((d) => d.trim()),
        isActive: isActiveFilter,
      };

      const result = await createInvoice(invoiceData);
      return result;
    } catch (error) {
      console.error("Error saving invoice:", error);
      return { success: false, error: "Failed to save invoice" };
    }
  };

  const generatePDF = async () => {
    if (!selectedCompany || cars.length === 0) {
      alert(
        "Please ensure company and date filters are applied and there are cars to invoice",
      );
      return;
    }

    // Use default sender company name if not set
    const finalSenderName =
      senderCompanyName.trim() ||
      fullUserData?.name ||
      fullUserData?.username ||
      "COMPANY";

    // Save invoice
    setIsSaving(true);
    const saveResult = await saveInvoice();
    setIsSaving(false);

    if (!saveResult.success) {
      alert(saveResult.error || "Failed to create invoice");
    } else {
      alert(
        `✓ Invoice ${saveResult.invoice?.invoiceNumber || "created"} has been successfully created!\n\nYou can now download it from the Invoices tab.`,
      );
      onClose();
    }
  };

  const generateExcel = async () => {
    if (!selectedCompany || cars.length === 0) {
      alert(
        "Please ensure company and date filters are applied and there are cars to invoice",
      );
      return;
    }

    // Use default sender company name if not set
    const finalSenderName =
      senderCompanyName.trim() ||
      fullUserData?.name ||
      fullUserData?.username ||
      "COMPANY";

    // Save invoice
    setIsSaving(true);
    const saveResult = await saveInvoice();
    setIsSaving(false);

    if (!saveResult.success) {
      alert(saveResult.error || "Failed to create invoice");
    } else {
      alert(
        `✓ Invoice ${saveResult.invoice?.invoiceNumber || "created"} has been successfully created!\n\nYou can now download it from the Invoices tab.`,
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-2 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Generate TAX INVOICE
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                {!companyFilter || !startDateFilter || !endDateFilter
                  ? "Please apply company and date filters in the main page first"
                  : `Client: ${clientName} | Period: ${startDateFilter} to ${endDateFilter}${isActiveFilter ? ` | Status: ${isActiveFilter === "true" ? "Active" : "Inactive"}` : ""}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Invoice Details */}
          <div className="bg-gray-50 p-2 rounded-lg space-y-2">
            <h3 className="text-xs font-medium text-gray-700">
              Invoice Details
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) =>
                    setInvoiceNumber(e.target.value.toUpperCase())
                  }
                  placeholder="Auto-generated when saved"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                  readOnly
                  title="Invoice number is auto-generated when you save/generate the invoice"
                />
                <p className="text-[9px] text-gray-500 mt-0.5">
                  Auto-generated
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                  Trip Number(s)
                </label>
                <input
                  type="text"
                  value={tripNumbers.join(", ") || "N/A"}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                  readOnly
                  title="Trip numbers from selected trips"
                />
                <p className="text-[9px] text-gray-500 mt-0.5">
                  {tripNumbers.length > 0
                    ? `${tripNumbers.length} trip(s) selected`
                    : "No trips found"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                  VAT Percentage (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={vatPercentage}
                  onChange={(e) => setVatPercentage(e.target.value)}
                  placeholder="e.g., 15 for 15%"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                />
                <p className="text-[9px] text-gray-500 mt-0.5">
                  Leave empty for zero VAT
                </p>
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div className="bg-purple-50 p-2 rounded-lg">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-gray-700">
                Descriptions
              </label>
              <button
                type="button"
                onClick={addDescription}
                className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {descriptions.length > 0 && (
              <div className="space-y-1.5">
                {descriptions.map((desc, index) => (
                  <div key={index} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      placeholder="Enter description"
                      value={desc}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      className="flex-1 px-2 py-1 border border-purple-300 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeDescription(index)}
                      className="px-1.5 py-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Trips Info */}
          {selectedTripIds.length > 0 && (
            <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-gray-700 mb-1">
                Selected Trips: {selectedTripIds.length} trip(s) selected in
                main view
              </p>
              <p className="text-[10px] text-gray-600">
                Invoice will include cars from the selected trips only. To
                change selection, go back to the main table.
              </p>
            </div>
          )}

          {/* Preview */}
          {loading ? (
            <div className="text-center py-4 text-gray-500 text-xs">
              Loading cars...
            </div>
          ) : !companyFilter || !startDateFilter || !endDateFilter ? (
            <div className="text-center py-4 text-gray-500 border rounded-lg bg-yellow-50 text-xs">
              <p className="font-medium mb-1">Filters Required</p>
              <p>
                Please apply company and date filters in the main page before
                generating invoice.
              </p>
            </div>
          ) : filteredCars.length === 0 ? (
            <div className="text-center py-4 text-gray-500 border rounded-lg text-xs">
              {selectedTripIds.length > 0
                ? "No cars found for the selected trips"
                : "No cars found for the selected filters"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-1.5 border-b">
                <h3 className="font-semibold text-gray-800 text-xs">
                  Invoice Preview ({filteredCars.length} cars
                  {selectedTripIds.length > 0
                    ? ` from ${selectedTripIds.length} trip(s)`
                    : ""}
                  )
                </h3>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        SR
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        DATE
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        STOCK
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        CLIENT
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        VEHICLE
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">
                        CHASSIS
                      </th>
                      <th className="px-1.5 py-1 text-right text-[10px] font-medium text-gray-500 uppercase">
                        AMOUNT
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCars.map((car, index) => (
                      <tr key={car._id} className="hover:bg-gray-50">
                        <td className="px-1.5 py-1 text-gray-600">
                          {index + 1}
                        </td>
                        <td className="px-1.5 py-1 whitespace-nowrap">
                          {formatDate(car.date)}
                        </td>
                        <td className="px-1.5 py-1 font-medium">
                          {car.stockNo}
                        </td>
                        <td className="px-1.5 py-1">
                          {car.companyName || clientName || ""}
                        </td>
                        <td className="px-1.5 py-1">{car.name}</td>
                        <td className="px-1.5 py-1 font-mono text-[10px]">
                          {car.chassis}
                        </td>
                        <td className="px-1.5 py-1 text-green-600 font-semibold text-right whitespace-nowrap">
                          R{" "}
                          {(car.amount || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 sticky bottom-0">
                    <tr>
                      <td
                        colSpan="6"
                        className="px-1.5 py-1.5 text-right font-semibold text-xs"
                      >
                        SUBTOTAL:
                      </td>
                      <td className="px-1.5 py-1.5 text-green-600 font-semibold text-right text-xs">
                        R{" "}
                        {totals.totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                    {totals.vatPercentage > 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-1.5 py-1.5 text-right font-semibold text-xs"
                        >
                          VAT ({totals.vatPercentage}%):
                        </td>
                        <td className="px-1.5 py-1.5 text-green-600 font-semibold text-right text-xs">
                          R{" "}
                          {totals.vatAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        colSpan="6"
                        className="px-1.5 py-1.5 text-right font-bold text-xs"
                      >
                        TOTAL:
                      </td>
                      <td className="px-1.5 py-1.5 text-green-600 font-bold text-right text-xs">
                        R{" "}
                        {totals.totalWithVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={generatePDF}
              disabled={
                !selectedCompany ||
                !senderCompanyName.trim() ||
                cars.length === 0 ||
                loading ||
                isSaving
              }
              className="px-4 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              <Download className="w-4 h-4" />
              {isSaving ? "Creating Invoice..." : "Create & Save Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
