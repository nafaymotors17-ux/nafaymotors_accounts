"use client";

import { Edit2, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function DriversTable({
  drivers,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  onDriverNameClick,
  isSuperAdmin,
  deleteMutationPending,
}) {
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 inline-block ml-1 text-gray-400" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="w-3 h-3 inline-block ml-1 text-blue-600" />;
    }
    return <ArrowDown className="w-3 h-3 inline-block ml-1 text-blue-600" />;
  };

  if (drivers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No drivers found.
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
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                Phone
              </th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                License Number
              </th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                Address
              </th>
              {isSuperAdmin && (
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
              )}
              <th
                className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => onSort("createdAt")}
              >
                <div className="flex items-center">
                  Created At
                  {getSortIcon("createdAt")}
                </div>
              </th>
              <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drivers.map((driver) => (
              <tr key={driver._id} className="hover:bg-gray-50">
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <button
                    onClick={() => onDriverNameClick(driver)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    title="View rent history"
                  >
                    {driver.name}
                  </button>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {driver.phone || "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {driver.email || "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {driver.licenseNumber || "-"}
                </td>
                <td
                  className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 max-w-[150px] truncate"
                  title={driver.address || ""}
                >
                  {driver.address || "-"}
                </td>
                {isSuperAdmin && (
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                    {driver.user?.username || "-"}
                  </td>
                )}
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                  {driver.createdAt ? formatDate(driver.createdAt) : "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(driver)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Driver"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(driver._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Driver"
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
