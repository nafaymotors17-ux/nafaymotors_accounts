"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import CarForm from "./CarForm";
import { deleteCar } from "@/app/lib/carriers-actions/cars";
import { useRouter } from "next/navigation";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function CarsTable({ carrier, cars, companies, onClose }) {
  const router = useRouter();
  const [showCarForm, setShowCarForm] = useState(false);
  const [editingCar, setEditingCar] = useState(null);

  const handleDelete = async (carId) => {
    if (!confirm("Are you sure you want to delete this car?")) return;

    const result = await deleteCar(carId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || "Failed to delete car");
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-700">Cars in this Trip</h4>
        <button
          onClick={() => {
            setShowCarForm(true);
            setEditingCar(null);
          }}
          className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Car(s)
        </button>
      </div>

      {cars.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No cars added to this trip yet. Click "Add Car(s)" to get started.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">NO</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">DATE</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">STOCK NO</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">COMPANY</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">NAME</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CHASSIS</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">AMOUNT</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CUSTOMER</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cars.map((car, index) => (
                <tr key={car._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{index + 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {formatDate(car.date)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{car.stockNo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{car.companyName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{car.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{car.chassis}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-green-600 font-semibold">
                    R{(car.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{car.customer || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(car._id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="6" className="px-3 py-2 text-right font-semibold">
                  Total:
                </td>
                <td className="px-3 py-2 text-green-600 font-bold">
                  R{cars.reduce((sum, car) => sum + (car.amount || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showCarForm && (
        <CarForm
          carrier={carrier}
          companies={companies}
          car={editingCar}
          onClose={() => {
            setShowCarForm(false);
            setEditingCar(null);
          }}
        />
      )}
    </div>
  );
}
