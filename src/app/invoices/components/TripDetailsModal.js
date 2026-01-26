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
                <span className="font-semibold text-blue-600">{trip.tripNumber}</span>
                {trip.date && (
                  <>
                    {" "}- <span className="text-gray-600">{formatDate(trip.date)}</span>
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
