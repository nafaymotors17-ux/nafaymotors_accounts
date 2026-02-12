"use client";

import { useRouter } from "next/navigation";
import { Edit2, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function TrucksTable({
  trucks,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  isSuperAdmin,
  deleteMutationPending,
}) {
  const router = useRouter();
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 inline-block ml-1 text-gray-400" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="w-3 h-3 inline-block ml-1 text-blue-600" />;
    }
    return <ArrowDown className="w-3 h-3 inline-block ml-1 text-blue-600" />;
  };

  if (trucks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No trucks found.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center">
                  Name
                  {getSortIcon("name")}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => onSort("driver")}
              >
                <div className="flex items-center">
                  Driver
                  {getSortIcon("driver")}
                </div>
              </th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                Number
              </th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">
                Current KM
              </th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">
                Maint. Status
              </th>
              {isSuperAdmin && (
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
              )}
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                Created At
              </th>
              <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trucks.map((truck) => (
              <tr key={truck._id} className="hover:bg-gray-50">
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <a
                    href={`/carriers/${truck._id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(`/carriers/${truck._id}`, '_blank');
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {truck.name}
                  </a>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {truck.drivers && truck.drivers.length > 0
                    ? truck.drivers.map(d => d.name).join(", ")
                    : "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {truck.number || "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                  {truck.currentMeterReading?.toLocaleString("en-US") || "0"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right">
                  {(() => {
                    const lastMaintenanceKm = truck.lastMaintenanceKm || 0;
                    const maintenanceInterval = truck.maintenanceInterval || 1000;
                    const currentKm = truck.currentMeterReading || 0;
                    const nextMaintenanceKm = lastMaintenanceKm + maintenanceInterval;
                    const kmsRemaining = nextMaintenanceKm - currentKm;
                    
                    if (kmsRemaining <= 0) {
                      const exceeded = Math.abs(kmsRemaining);
                      return (
                        <span className="text-red-600 font-semibold">
                          -{exceeded.toLocaleString("en-US")} km exceeded
                        </span>
                      );
                    } else {
                      return (
                        <span className="text-gray-600">
                          {kmsRemaining.toLocaleString("en-US")} km remaining
                        </span>
                      );
                    }
                  })()}
                </td>
                {isSuperAdmin && (
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                    {truck.user?.username || "-"}
                  </td>
                )}
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {truck.createdAt ? formatDate(truck.createdAt) : "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(truck)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Truck"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(truck._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Truck"
                      disabled={deleteMutationPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
