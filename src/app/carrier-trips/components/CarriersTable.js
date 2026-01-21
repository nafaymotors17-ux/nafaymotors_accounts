"use client";

import { useState } from "react";
import { Plus, Edit, DollarSign, Truck } from "lucide-react";
import CarrierTripForm from "./CarrierTripForm";
import CarsTable from "./CarsTable";
import InvoiceGenerator from "./InvoiceGenerator";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function CarriersTable({ carriers, cars, companies }) {
  const [showTripForm, setShowTripForm] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);

  if (carriers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">No carrier trips found. Create your first trip to get started.</p>
        <button
          onClick={() => setShowTripForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
        >
          <Plus className="w-4 h-4" />
          Create Trip
        </button>
        {showTripForm && (
          <CarrierTripForm onClose={() => setShowTripForm(false)} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Carrier Trips</h2>
          <button
            onClick={() => {
              setShowTripForm(true);
              setEditingCarrier(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Trip
          </button>
        </div>

        <div className="divide-y">
          {carriers.map((carrier) => {
            const carrierCars = cars.filter(
              (car) => {
                const carCarrierId = car.carrier?._id?.toString() || car.carrier?.toString() || car.carrier;
                return carCarrierId === carrier._id.toString();
              }
            );
            const carrierTotal = carrierCars.reduce((sum, car) => sum + (car.amount || 0), 0);
            const profit = carrierTotal - (carrier.totalExpense || 0);

            return (
              <div key={carrier._id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-800">
                        Trip: {carrier.tripNumber}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {formatDate(carrier.date)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Cars:</span>
                        <span className="font-semibold ml-2">{carrier.carCount || carrierCars.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold text-green-600 ml-2">
                          ${carrierTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Expense:</span>
                        <span className="font-semibold text-red-600 ml-2">
                          ${(carrier.totalExpense || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Profit:</span>
                        <span className={`font-semibold ml-2 ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCarrier(carrier);
                        setShowTripForm(true);
                      }}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCarrier(carrier);
                        setShowInvoice(true);
                      }}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                    >
                      <DollarSign className="w-4 h-4" />
                      Invoice
                    </button>
                  </div>
                </div>

                {selectedCarrier?._id === carrier._id && (
                  <CarsTable
                    carrier={carrier}
                    cars={carrierCars}
                    companies={companies}
                    onClose={() => setSelectedCarrier(null)}
                  />
                )}
                
                {!selectedCarrier && (
                  <button
                    onClick={() => setSelectedCarrier(carrier)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    View Cars →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showTripForm && (
        <CarrierTripForm
          carrier={editingCarrier}
          onClose={() => {
            setShowTripForm(false);
            setEditingCarrier(null);
          }}
        />
      )}

      {showInvoice && selectedCarrier && (
        <InvoiceGenerator
          carrier={selectedCarrier}
          cars={cars.filter(
            (car) => {
              const carCarrierId = car.carrier?._id?.toString() || car.carrier?.toString() || car.carrier;
              return carCarrierId === selectedCarrier._id.toString();
            }
          )}
          companies={companies}
          onClose={() => {
            setShowInvoice(false);
            setSelectedCarrier(null);
          }}
        />
      )}
    </>
  );
}
