"use client";

import { Download, X } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";
import PaymentTrackingSection from "./PaymentTrackingSection";

export default function InvoiceViewModal({
  invoice,
  invoiceCars,
  loadingCars,
  generatingPDF,
  paymentInfo,
  getPaymentStatusBadge,
  onClose,
  onDownloadPDF,
  onRecordPayment,
  onDeletePayment,
}) {
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
                disabled={generatingPDF || loadingCars || invoiceCars.length === 0}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {generatingPDF ? "Generating..." : "PDF"}
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Sender</h3>
                  <p className="text-sm text-gray-900">{invoice.senderCompanyName}</p>
                  {invoice.senderAddress && (
                    <p className="text-sm text-gray-600 mt-1">{invoice.senderAddress}</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Client</h3>
                  <p className="text-sm text-gray-900">{invoice.clientCompanyName}</p>
                </div>
              </div>

              {/* Trip Information */}
              {(invoice.tripNumbers && invoice.tripNumbers.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Trip Information</h3>
                  <div className="space-y-1">
                    {invoice.tripNumbers.map((tripNumber, index) => (
                      <div key={index} className="text-sm text-gray-700">
                        <span className="font-medium">Trip:</span> {tripNumber}
                        {invoice.tripDates && invoice.tripDates[index] && (
                          <span className="ml-2 text-gray-600">
                            • Date: {formatDate(invoice.tripDates[index])}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
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
                          <td className="px-3 py-2 text-gray-600">{index + 1}</td>
                          <td className="px-3 py-2 text-gray-600">{formatDate(car.date)}</td>
                          <td className="px-3 py-2 font-medium">{car.stockNo}</td>
                          <td className="px-3 py-2">{car.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{car.chassis}</td>
                          <td className="px-3 py-2 text-right text-green-600 font-semibold">
                            R{(car.amount || 0).toLocaleString("en-US", {
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
                          R{invoice.subtotal.toLocaleString("en-US", {
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
                            R{invoice.vatAmount.toLocaleString("en-US", {
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
                          R{invoice.totalAmount.toLocaleString("en-US", {
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
    </div>
  );
}
