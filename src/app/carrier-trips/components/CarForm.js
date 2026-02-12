"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMultipleCars } from "@/app/lib/carriers-actions/cars";
import { useUser } from "@/app/components/UserContext";
import { X, Plus, Trash2, FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";

export default function CarForm({ carrier, companies, users = [], car, onClose }) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  
  // Get trip date - use carrier date if available, otherwise current date
  const tripDate = carrier?.date 
    ? new Date(carrier.date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const [carRows, setCarRows] = useState([
    {
      stockNo: "",
      name: "",
      chassis: "",
      amount: "",
      companyId: "",
      date: tripDate, // Use trip date by default
    },
  ]);

  // Update all car rows to use trip date when carrier changes
  useEffect(() => {
    if (carrier?.date) {
      const newTripDate = new Date(carrier.date).toISOString().split("T")[0];
      setCarRows(prevRows => 
        prevRows.map(row => ({ ...row, date: newTripDate }))
      );
    }
  }, [carrier?.date]);


  const addCarRow = () => {
    setCarRows([
      ...carRows,
      {
        stockNo: "",
        name: "",
        chassis: "",
        amount: "",
        companyId: "",
        date: tripDate, // Use trip date for new rows
      },
    ]);
  };

  const removeCarRow = (index) => {
    setCarRows(carRows.filter((_, i) => i !== index));
  };

  const updateCarRow = (index, field, value) => {
    const newRows = [...carRows];
    newRows[index][field] = value;
    setCarRows(newRows);
  };

  // Function to find company by name (exact match only, case-insensitive)
  const findCompanyByName = (companyName) => {
    if (!companyName) return null;
    
    const searchName = companyName.trim().toUpperCase();
    
    // Only exact match (case-insensitive)
    const company = companies.find(
      (c) => c.name.toUpperCase().trim() === searchName
    );
    
    return company;
  };

  // Parse Excel file and import cars
  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: "",
        raw: false
      });

      if (jsonData.length < 2) {
        setError("Excel file must have at least a header row and one data row");
        setIsImporting(false);
        return;
      }

      // Find header row (look for common column names)
      let headerRowIndex = 0;
      const headerRow = jsonData[0];
      
      // Map column indices
      const getColumnIndex = (possibleNames) => {
        for (let i = 0; i < headerRow.length; i++) {
          const cellValue = String(headerRow[i] || "").toUpperCase().trim();
          for (const name of possibleNames) {
            if (cellValue === name.toUpperCase() || cellValue.includes(name.toUpperCase())) {
              return i;
            }
          }
        }
        return -1;
      };

      const dateCol = getColumnIndex(["DATE", "Date", "date"]);
      const stockNoCol = getColumnIndex(["STOCK NO", "STOCK NO.", "Stock No", "Stock Number", "STOCK"]);
      const companyCol = getColumnIndex(["COMPANY", "Company", "company"]);
      const nameCol = getColumnIndex(["NAME", "Name", "name", "CAR NAME", "Car Name"]);
      const chassisCol = getColumnIndex(["CHASSIS", "Chassis", "chassis", "CHASSIS NO", "Chassis No"]);
      const amountCol = getColumnIndex(["AMOUNT", "Amount", "amount", "AMOUNT (R)", "Amount (R)"]);

      // Validate required columns
      if (stockNoCol === -1 || companyCol === -1 || nameCol === -1 || chassisCol === -1) {
        setError("Excel file must contain columns: STOCK NO, COMPANY, NAME, and CHASSIS");
        setIsImporting(false);
        return;
      }

      // Parse data rows (skip header row)
      const importedRows = [];
      const errors = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        // Skip empty rows
        if (row.every(cell => !cell || String(cell).trim() === "")) continue;

        const stockNo = String(row[stockNoCol] || "").trim();
        const companyName = String(row[companyCol] || "").trim();
        const name = String(row[nameCol] || "").trim();
        const chassis = String(row[chassisCol] || "").trim();
        const amount = row[amountCol] !== undefined ? String(row[amountCol] || "0").trim() : "0";
        
        // Parse date
        let dateValue = "";
        if (dateCol !== -1 && row[dateCol]) {
          const dateCell = row[dateCol];
          // Handle Excel date serial number or date string
          if (typeof dateCell === 'number') {
            // Excel date serial number
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + dateCell * 24 * 60 * 60 * 1000);
            dateValue = date.toISOString().split("T")[0];
          } else {
            // Try to parse as date string
            const dateStr = String(dateCell).trim();
            
            // Try MM/DD/YYYY format first (common US format)
            if (dateStr.includes("/")) {
              const parts = dateStr.split("/").map(p => p.trim());
              if (parts.length === 3) {
                let month = parts[0];
                let day = parts[1];
                let year = parts[2];
                
                // Handle 2-digit year
                if (year.length === 2) {
                  year = `20${year}`;
                }
                
                // Pad with zeros
                month = month.padStart(2, "0");
                day = day.padStart(2, "0");
                
                // Try MM/DD/YYYY first (US format)
                const usDate = new Date(`${year}-${month}-${day}`);
                if (!isNaN(usDate.getTime()) && usDate.getFullYear() == parseInt(year)) {
                  dateValue = usDate.toISOString().split("T")[0];
                } else {
                  // Try DD/MM/YYYY (European format)
                  const euDate = new Date(`${year}-${day}-${month}`);
                  if (!isNaN(euDate.getTime()) && euDate.getFullYear() == parseInt(year)) {
                    dateValue = euDate.toISOString().split("T")[0];
                  }
                }
              }
            } else {
              // Try standard date parsing
              const parsedDate = new Date(dateCell);
              if (!isNaN(parsedDate.getTime())) {
                dateValue = parsedDate.toISOString().split("T")[0];
              }
            }
          }
        }
        
        // Validate required fields
        if (!stockNo || !companyName || !name || !chassis) {
          errors.push(`Row ${i + 1}: Missing required fields (STOCK NO, COMPANY, NAME, or CHASSIS)`);
          continue;
        }

        // Find company
        const company = findCompanyByName(companyName);
        if (!company) {
          errors.push(`Row ${i + 1}: Company "${companyName}" not found. Please ensure the company exists in the system.`);
          continue;
        }

        // Parse amount
        let amountValue = 0;
        if (amount) {
          // Remove currency symbols and commas
          const cleanAmount = amount.replace(/[R$,\s]/g, "");
          amountValue = parseFloat(cleanAmount) || 0;
        }

        // Use trip date if no date provided
        if (!dateValue) {
          dateValue = tripDate;
        }

        importedRows.push({
          stockNo,
          name,
          chassis,
          amount: amountValue.toString(),
          companyId: company._id,
          date: tripDate, // Always use trip date, ignore Excel date
        });
      }

      if (importedRows.length === 0) {
        setError("No valid rows found in Excel file. " + (errors.length > 0 ? errors.slice(0, 3).join("; ") : ""));
        setIsImporting(false);
        return;
      }

      // Show warnings if any
      if (errors.length > 0) {
        const warningMsg = `Imported ${importedRows.length} row(s). ${errors.length} row(s) had errors:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ""}`;
        alert(warningMsg);
      }

      // Set imported rows
      setCarRows(importedRows);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Excel import error:", err);
      setError(`Failed to import Excel file: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const createCarsMutation = useMutation({
    mutationFn: async ({ carsData, carrierId, userId }) => {
      return await createMultipleCars(carsData, carrierId, userId);
    },
    onMutate: async ({ carsData, carrierId }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["trip", carrierId] });
      
      // Snapshot previous value
      const previousTripData = queryClient.getQueryData(["trip", carrierId]);
      
      // Create optimistic car objects
      const optimisticCars = carsData.map((carData, index) => ({
        _id: `temp-car-${Date.now()}-${index}`,
        stockNo: carData.stockNo,
        name: carData.name,
        chassis: carData.chassis,
        amount: parseFloat(carData.amount) || 0,
        companyName: carData.companyName,
        date: carData.date || new Date().toISOString().split("T")[0],
      }));
      
      // Calculate total amount for new cars
      const newCarsTotal = optimisticCars.reduce((sum, car) => sum + (car.amount || 0), 0);
      
      // Optimistically update cache - add cars immediately
      if (previousTripData) {
        queryClient.setQueryData(["trip", carrierId], (old) => {
          if (!old) return old;
          return {
            ...old,
            cars: [...(old.cars || []), ...optimisticCars],
            totalAmount: (old.totalAmount || 0) + newCarsTotal,
          };
        });
      }
      
      return { previousTripData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousTripData) {
        queryClient.setQueryData(["trip", variables.carrierId], context.previousTripData);
      }
      setError(error.message || "Failed to add cars. Changes have been reverted.");
    },
    onSuccess: async (result, variables) => {
      if (result.success) {
        const carrierId = variables.carrierId;
        
        // Replace optimistic cars with real ones from server
        queryClient.setQueryData(["trip", carrierId], (old) => {
          if (!old) return old;
          // Remove temporary cars and add real ones
          const cars = (old.cars || []).filter(car => !car._id?.startsWith("temp-car-"));
          return {
            ...old,
            cars: [...cars, ...result.cars],
          };
        });
        
        // Invalidate to ensure all related queries are fresh
        queryClient.invalidateQueries({ queryKey: ["trip", carrierId] });
        queryClient.invalidateQueries({ queryKey: ["carriers"] });
        queryClient.invalidateQueries({ queryKey: ["carrierCars"] });
        
        // Close modal after successful creation
        onClose();
      }
    },
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    try {
      // Validate carrier exists and has _id
      if (!carrier || !carrier._id) {
        setError("Invalid trip/carrier. Please try again.");
        return;
      }

      // Ensure carrier._id is converted to string
      const carrierId = carrier._id.toString ? carrier._id.toString() : carrier._id;

      // Create multiple cars - convert companyId to companyName
      const carsData = carRows.map((row, idx) => {
        if (!row.companyId) {
          setError(`Please select a company for row ${idx + 1}`);
          throw new Error(`Company not selected for row ${idx + 1}`);
        }
        const selectedCompany = companies.find((c) => c._id === row.companyId);
        if (!selectedCompany) {
          setError(`Company not found for row ${idx + 1}`);
          throw new Error(`Company not found for row ${idx + 1}`);
        }
        return {
          stockNo: row.stockNo,
          name: row.name,
          chassis: row.chassis,
          amount: row.amount,
          companyName: selectedCompany.name,
          date: tripDate, // Always use trip date, ignore row.date
        };
      });
      
      const userId = user?.role === "super_admin" && selectedUserId ? selectedUserId : null;
      await createCarsMutation.mutateAsync({ carsData, carrierId, userId });
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      console.error("[CarForm] Error:", err);
    }
  }
  
  // Use mutation's pending state
  const isSubmittingState = createCarsMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b shrink-0">
          <h2 className="text-xl font-semibold">Add Car(s) to Trip: {carrier?.tripNumber}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmittingState || createCarsMutation.isPending}
            title={isSubmittingState || createCarsMutation.isPending ? "Please wait for the operation to complete" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelImport}
                    className="hidden"
                    id="excel-import-input"
                    disabled={isSubmittingState || isImporting}
                  />
                  <label
                    htmlFor="excel-import-input"
                    className={`px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 cursor-pointer ${(isSubmittingState || isImporting) ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isImporting ? (
                      <>
                        <Upload className="w-4 h-4 animate-pulse" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4" />
                        Import Excel
                      </>
                    )}
                  </label>
                  <span className="text-xs text-gray-500">
                    Format: NO, DATE, STOCK NO, COMPANY, NAME, CHASSIS, AMOUNT
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addCarRow}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                    disabled={isSubmittingState || isImporting}
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </button>
              </div>

              {user?.role === "super_admin" && users.length > 0 && (
                <div className="bg-blue-50 p-2 rounded text-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Create for User (Optional)
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    disabled={isSubmittingState}
                  >
                    <option value="">Your own account</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.username} {u.role === "super_admin" ? "(Admin)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to create for yourself</p>
                </div>
              )}

              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">NO</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">DATE</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">STOCK NO</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">COMPANY</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">NAME</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">CHASSIS</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">AMOUNT</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carRows.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-2 py-2 text-gray-600">{index + 1}</td>
                        <td className="px-2 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateCarRow(index, "date", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-100"
                            disabled
                            required
                            title="Car date matches trip date and cannot be changed"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.stockNo}
                            onChange={(e) => updateCarRow(index, "stockNo", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="Stock number"
                            required
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={row.companyId}
                            onChange={(e) => updateCarRow(index, "companyId", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            required
                          >
                            <option value="">Select Company</option>
                            {companies.map((company) => (
                              <option key={company._id} value={company._id}>
                                {company.name}
                                {user?.role === "super_admin" && company.user?.username ? ` (${company.user.username})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateCarRow(index, "name", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="Car name/model"
                            required
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.chassis}
                            onChange={(e) => updateCarRow(index, "chassis", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="Chassis number"
                            required
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount}
                            onChange={(e) => updateCarRow(index, "amount", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="0.00"
                            required
                          />
                        </td>
                        <td className="px-2 py-2">
                          {carRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCarRow(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmittingState || createCarsMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingState || createCarsMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(isSubmittingState || createCarsMutation.isPending) ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Saving...</span>
                </>
              ) : (
                `Add ${carRows.length} Car${carRows.length === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
