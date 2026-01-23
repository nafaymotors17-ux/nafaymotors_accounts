"use client";

import { useState } from "react";
import { createMultipleCars } from "@/app/lib/carriers-actions/cars";
import { useUser } from "@/app/components/UserContext";
import { X, Plus, Trash2 } from "lucide-react";

export default function CarForm({ carrier, companies, users = [], car, onClose }) {

  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
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
          <h2 className="text-xl font-semibold">Add Car(s) to Trip: {carrier?.tripNumber}</h2>
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

          <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
               
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
                : `Add ${carRows.length} Car${carRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
