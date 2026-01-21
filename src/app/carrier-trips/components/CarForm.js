"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCar, createMultipleCars } from "@/app/lib/carriers-actions/cars";
import CompanySelect from "./CompanySelect";
import { useUser } from "@/app/components/UserContext";
import { X, Plus, Trash2 } from "lucide-react";

export default function CarForm({ carrier, companies, users = [], car, onClose }) {
  const router = useRouter();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("single"); // "single" or "multiple"
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  
  const [carRows, setCarRows] = useState([
    {
      stockNo: "",
      name: "",
      chassis: "",
      amount: "",
      companyId: "",
      date: new Date().toISOString().split("T")[0],
    },
  ]);


  const addCarRow = () => {
    setCarRows([
      ...carRows,
      {
        stockNo: "",
        name: "",
        chassis: "",
        amount: "",
        companyId: "",
        date: new Date().toISOString().split("T")[0],
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

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate carrier exists and has _id
      if (!carrier || !carrier._id) {
        setError("Invalid trip/carrier. Please try again.");
        console.error("[CarForm] Carrier is missing or has no _id:", carrier);
        return;
      }

      // Ensure carrier._id is converted to string
      const carrierId = carrier._id.toString ? carrier._id.toString() : carrier._id;
      console.log("[CarForm] Adding car to trip/carrier:", {
        carrierId,
        tripNumber: carrier.tripNumber,
        name: carrier.name,
        type: carrier.type
      });

      if (mode === "multiple") {
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
            date: row.date,
          };
        });
        const result = await createMultipleCars(carsData, carrierId, user?.role === "super_admin" && selectedUserId ? selectedUserId : null);
        if (result.success) {
          // Close modal - onClose callback will handle refresh
          onClose();
        } else {
          setError(result.error || "Failed to add cars");
        }
      } else {
        // Create single car
        const formData = new FormData(event.target);
        formData.append("carrierId", carrierId);
        if (user?.role === "super_admin" && selectedUserId) {
          formData.append("userId", selectedUserId);
        }
        const result = await createCar(formData);
        if (result.success) {
          // Close modal - onClose callback will handle refresh
          onClose();
        } else {
          setError(result.error || "Failed to add car");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("[CarForm] Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Add Car(s) to Trip: {carrier?.tripNumber}</h2>
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`px-3 py-1 text-sm rounded ${
                  mode === "single"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Single Car
              </button>
              <button
                type="button"
                onClick={() => setMode("multiple")}
                className={`px-3 py-1 text-sm rounded ${
                  mode === "multiple"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Multiple Cars
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
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

          {mode === "single" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock No *
                  </label>
                  <input
                    type="text"
                    name="stockNo"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={isSubmitting}
                  />
                </div>

                {user?.role === "super_admin" && users.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Create for User (Optional)
                    </label>
                    <select
                      name="userId"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      disabled={isSubmitting}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company (Customer) *
                  </label>
                  <CompanySelect
                    companies={companies}
                    value={selectedCompanyId}
                    onChange={(companyId) => {
                      setSelectedCompanyId(companyId);
                    }}
                    required
                    showUserInfo={user?.role === "super_admin"}
                  />
                  <input
                    type="hidden"
                    name="companyName"
                    value={
                      companies.find((c) => c._id === selectedCompanyId)?.name || ""
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Car Name/Model *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chassis Number *
                  </label>
                  <input
                    type="text"
                    name="chassis"
                    required
                    placeholder="e.g., JTMHV05J304123456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the vehicle chassis/VIN number</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="amount"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the amount in dollars</p>
                </div>

              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">
                    Add multiple cars at once. Companies will be created automatically if they don't exist.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCarRow}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
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
                    disabled={isSubmitting}
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
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            required
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
          )}

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Saving..."
                : mode === "multiple"
                ? `Add ${carRows.length} Car(s)`
                : "Add Car"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
