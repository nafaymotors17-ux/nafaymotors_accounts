"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function TripDetailsModal({ trips, onClose }) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => onClose(), 200);
  };

  const handleTripClick = (tripNumber, tripId, e) => {
    e.preventDefault();
    if (tripId) {
      window.open(`/carrier-trips/${tripId}`, '_blank');
    } else {
      window.open(`/carrier-trips?tripNumber=${encodeURIComponent(tripNumber)}`, '_blank');
    }
  };

  if (!isOpen || !trips || trips.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-lg shadow-2xl">
        <div className="sticky top-0 bg-white border-b p-4 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Trips</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-2">
            {trips.map((trip, index) => (
              <div
                key={index}
                className="text-sm text-gray-700 py-2 border-b border-gray-100 last:border-b-0"
              >
                <span className="font-medium">{index + 1}.</span>{" "}
                <a
                  href={trip.tripId ? `/carrier-trips/${trip.tripId}` : `/carrier-trips?tripNumber=${encodeURIComponent(trip.tripNumber)}`}
                  onClick={(e) => handleTripClick(trip.tripNumber, trip.tripId, e)}
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {trip.tripNumber}
                </a>
                {trip.date && (
                  <>
                    {" "}- <span className="text-gray-600">{formatDate(trip.date)}</span>
                  </>
                )}
                {trip.truckNumber && (
                  <>
                    {" "}- <span className="text-gray-500">Truck: #{trip.truckNumber}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
