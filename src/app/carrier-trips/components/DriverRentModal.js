"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { getDriverRentPayments } from "@/app/lib/carriers-actions/driver-rents";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function DriverRentModal({ driverId, driverName, onClose }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["driverRentPayments", driverId, page, limit],
    queryFn: () => getDriverRentPayments(driverId, page, limit),
    enabled: !!driverId,
  });

  const payments = data?.payments || [];
  const pagination = data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 };
  const totalAmount = data?.totalAmount || 0; // Get total from API (all expenses, not just current page)

  const handleTripClick = (tripId, e) => {
    e.preventDefault();
    window.open(`/carrier-trips/${tripId}`, '_blank');
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
      <div className="bg-white border border-gray-300 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-lg pointer-events-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Driver Rent History</h2>
            <p className="text-sm text-gray-600 mt-1">Driver: {driverName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading rent payments...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error loading rent payments: {error.message || "Unknown error"}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No rent payments found for this driver.
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Rent Paid:</span>
                  <span className="text-lg font-bold text-blue-600">
                    R{totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Trip
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Truck
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(payment.date)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          R{payment.amount?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {payment.trip ? (
                            <a
                              href={`/carrier-trips/${payment.trip._id}`}
                              onClick={(e) => handleTripClick(payment.trip._id, e)}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium cursor-pointer"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {payment.trip.tripNumber}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                          {payment.trip?.truckName ? (
                            <div>
                              <div>{payment.trip.truckName}</div>
                              {payment.trip.truckNumber && (
                                <div className="text-xs text-gray-500">#{payment.trip.truckNumber}</div>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 max-w-[200px] truncate" title={payment.details || ""}>
                          {payment.details || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {(pagination.totalPages > 1 || pagination.total > 0) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} payments
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Show:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    const newLimit = parseInt(e.target.value);
                    setLimit(newLimit);
                    setPage(1); // Reset to first page when changing limit
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
