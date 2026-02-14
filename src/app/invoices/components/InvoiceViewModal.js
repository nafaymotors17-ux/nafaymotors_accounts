"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, X, Edit2, FileSpreadsheet } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import { setCompanyCredit } from "@/app/lib/invoice-actions/company-balances";
import { useUser } from "@/app/components/UserContext";
import PaymentTrackingSection from "./PaymentTrackingSection";
import TripDetailsModal from "./TripDetailsModal";

export default function InvoiceViewModal({
  invoice,
  invoiceCars,
  loadingCars,
  generatingPDF,
  generatingExcel,
  paymentInfo,
  getPaymentStatusBadge,
  companyBalance,
  loadingCompanyBalance,
  onClose,
  onDownloadPDF,
  onDownloadExcel,
  onRecordPayment,
  onDeletePayment,
}) {
  const [selectedTrips, setSelectedTrips] = useState(null);
  const [editingCredit, setEditingCredit] = useState(false);
  const [newCreditBalance, setNewCreditBalance] = useState("");
  const queryClient = useQueryClient();
  const { fullUserData } = useUser();

  // Get bank details from user context
  const senderBankDetails = fullUserData?.bankDetails || "";

  const updateCreditMutation = useMutation({
    mutationFn: ({ companyName, newBalance }) =>
      setCompanyCredit(companyName, parseFloat(newBalance) || 0),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["companyBalance", invoice.clientCompanyName],
      });
      queryClient.invalidateQueries({ queryKey: ["company-balances"] });
      setEditingCredit(false);
      setNewCreditBalance("");
    },
  });

  const handleEditCredit = () => {
    if (companyBalance?.success) {
      setNewCreditBalance((companyBalance.creditBalance || 0).toString());
      setEditingCredit(true);
    }
  };

  const handleUpdateCredit = (e) => {
    e.preventDefault();
    const balance = parseFloat(newCreditBalance);
    if (isNaN(balance)) {
      alert("Please enter a valid number");
      return;
    }

    updateCreditMutation.mutate({
      companyName: invoice.clientCompanyName,
      newBalance: balance,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Invoice {invoice.invoiceNumber}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(invoice.invoiceDate)} • {invoice.clientCompanyName}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onDownloadPDF}
                disabled={
                  generatingPDF || loadingCars || invoiceCars.length === 0
                }
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {generatingPDF ? "Generating..." : "PDF"}
              </button>
              <button
                onClick={onDownloadExcel}
                disabled={
                  generatingExcel || loadingCars || invoiceCars.length === 0
                }
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {generatingExcel ? "Generating..." : "Excel"}
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loadingCars ? (
            <div className="text-center py-8 text-gray-500">
              Loading invoice details...
            </div>
          ) : invoiceCars.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No cars found for this invoice
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Sender
                  </h3>
                  <p className="text-sm text-gray-900">
                    {invoice.senderCompanyName}
                  </p>
                  {invoice.senderAddress && (
                    <p className="text-sm text-gray-600 mt-1">
                      {invoice.senderAddress}
                    </p>
                  )}
                  {senderBankDetails && (
                    <div className="text-sm text-gray-600 mt-2 whitespace-pre-line">
                      {senderBankDetails}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Client
                  </h3>
                  <p className="text-sm text-gray-900">
                    {invoice.clientCompanyName}
                  </p>
                  {loadingCompanyBalance ? (
                    <p className="text-xs text-gray-500 mt-2">
                      Loading balance...
                    </p>
                  ) : companyBalance?.success ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Credit Balance:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-600">
                            R
                            {(companyBalance.creditBalance || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                              },
                            )}
                          </span>
                          <button
                            onClick={handleEditCredit}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Credit Balance"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Due Balance:</span>
                        <span className="font-semibold text-blue-600">
                          R
                          {(companyBalance.dueBalance || 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Trip Information */}
              {invoice.tripNumbers && invoice.tripNumbers.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Trip Information
                  </h3>
                  {invoice.tripNumbers.length === 1 &&
                  invoice.tripIds &&
                  invoice.tripIds.length > 0 &&
                  invoice.tripIds[0] ? (
                    // Single trip with ID - navigate directly to detail page
                    <a
                      href={`/carrier-trips/${invoice.tripIds[0]}`}
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(
                          `/carrier-trips/${invoice.tripIds[0]}`,
                          "_blank",
                        );
                      }}
                      className="block w-full text-left text-sm px-3 py-2 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-300 transition-colors cursor-pointer hover:shadow-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {invoice.tripNumbers[0]}
                      {invoice.tripDates && invoice.tripDates[0] && (
                        <>/{formatDate(invoice.tripDates[0])}</>
                      )}
                    </a>
                  ) : (
                    // Multiple trips or no ID - open modal
                    <button
                      onClick={() => {
                        const trips = invoice.tripNumbers.map(
                          (tripNumber, idx) => ({
                            tripNumber,
                            date:
                              invoice.tripDates && invoice.tripDates[idx]
                                ? invoice.tripDates[idx]
                                : null,
                            tripId:
                              invoice.tripIds && invoice.tripIds[idx]
                                ? invoice.tripIds[idx]
                                : null,
                            truckNumber:
                              invoice.truckNumbers && invoice.truckNumbers[idx]
                                ? invoice.truckNumbers[idx]
                                : null,
                          }),
                        );
                        setSelectedTrips(trips);
                      }}
                      className="block w-full text-left text-sm px-3 py-2 bg-white hover:bg-blue-100 text-blue-700 rounded border border-blue-300 transition-colors cursor-pointer hover:shadow-sm"
                      title="Click to view all trips"
                    >
                      {invoice.tripNumbers[0]}
                      {invoice.tripDates && invoice.tripDates[0] && (
                        <>/{formatDate(invoice.tripDates[0])}</>
                      )}
                      {invoice.tripNumbers.length > 1 && (
                        <span className="ml-2">...</span>
                      )}
                    </button>
                  )}
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-2 border-b">
                  <h3 className="font-semibold text-gray-800 text-sm">
                    Invoice Items ({invoiceCars.length} cars)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          SR
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          Stock
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          Vehicle
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          Chassis
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoiceCars.map((car, index) => (
                        <tr key={car._id}>
                          <td className="px-3 py-2 text-gray-600">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {formatDate(car.date)}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {car.stockNo}
                          </td>
                          <td className="px-3 py-2">{car.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {car.chassis}
                          </td>
                          <td className="px-3 py-2 text-right text-green-600 font-semibold">
                            R
                            {(car.amount || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td
                          colSpan="5"
                          className="px-3 py-2 text-right font-semibold"
                        >
                          Subtotal:
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-600">
                          R
                          {invoice.subtotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                      {invoice.vatPercentage > 0 && (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-3 py-2 text-right font-semibold"
                          >
                            VAT ({invoice.vatPercentage}%):
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">
                            R
                            {invoice.vatAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td
                          colSpan="5"
                          className="px-3 py-2 text-right font-bold"
                        >
                          Total:
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-green-600">
                          R
                          {invoice.totalAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {invoice.descriptions && invoice.descriptions.length > 0 && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 text-sm mb-2">
                    Descriptions
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {invoice.descriptions.map((desc, index) => (
                      <li key={index} className="text-sm text-gray-700">
                        {desc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <PaymentTrackingSection
                invoice={invoice}
                paymentInfo={paymentInfo}
                getPaymentStatusBadge={getPaymentStatusBadge}
                onRecordPayment={onRecordPayment}
                onDeletePayment={onDeletePayment}
              />
            </div>
          )}
        </div>
      </div>

      {/* Trip Details Modal */}
      {selectedTrips && (
        <TripDetailsModal
          trips={selectedTrips}
          onClose={() => {
            setSelectedTrips(null);
          }}
        />
      )}

      {/* Edit Credit Balance Modal */}
      {editingCredit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Update Credit Balance
              </h3>
              <button
                onClick={() => {
                  setEditingCredit(false);
                  setNewCreditBalance("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Company:{" "}
                <span className="font-semibold">
                  {invoice.clientCompanyName}
                </span>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Current Credit Balance: R
                {(companyBalance?.creditBalance || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>

            <form onSubmit={handleUpdateCredit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Credit Balance *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newCreditBalance}
                  onChange={(e) => setNewCreditBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updateCreditMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateCreditMutation.isPending
                    ? "Updating..."
                    : "Update Balance"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCredit(false);
                    setNewCreditBalance("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
