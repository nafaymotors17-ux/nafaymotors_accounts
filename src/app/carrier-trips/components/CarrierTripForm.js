"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCarrier, updateCarrierExpense, generateNextTripNumber } from "@/app/lib/carriers-actions/carriers";
import { getAllTrucks } from "@/app/lib/carriers-actions/trucks";
import { useUser } from "@/app/components/UserContext";
import { X, RefreshCw } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function CarrierTripForm({ carrier, users = [], onClose }) {
  const { user } = useUser();
  const [selectedUserId, setSelectedUserId] = useState("");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tripNumber, setTripNumber] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [trucks, setTrucks] = useState([]);
  const notesRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getAllTrucks({}, user).then((res) => !cancelled && setTrucks(res?.trucks || []));
    return () => { cancelled = true; };
  }, [user?.userId, user?.role]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [tripDistance, setTripDistance] = useState("");

  // Auto-resize textareas
  const adjustTextareaHeight = (textarea) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Set selected truck when component mounts or carrier changes
  useEffect(() => {
    if (carrier?.truck) {
      const truckId = carrier.truck._id || carrier.truck;
      const truck = trucks.find(t => t._id === truckId || t._id.toString() === truckId?.toString());
      if (truck) {
        setSelectedTruck(truck);
      }
    } else {
      setSelectedTruck(null);
    }
    // Initialize distance when editing
    if (carrier?.distance) {
      setTripDistance(carrier.distance.toString());
    } else {
      setTripDistance("");
    }
  }, [carrier, trucks]);

  // Auto-generate trip number on mount if creating new trip
  useEffect(() => {
    if (!carrier) {
      loadGeneratedTripNumber();
    } else {
      // If editing, set the existing trip number
      setTripNumber(carrier.tripNumber || "");
    }
  }, [carrier, selectedUserId]);

  // Load generated trip number
  const loadGeneratedTripNumber = async () => {
    setIsGenerating(true);
    try {
      const result = await generateNextTripNumber(selectedUserId || null);
      if (result.success) {
        setTripNumber(result.tripNumber);
      }
    } catch (err) {
      console.error("Error generating trip number:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (notesRef.current) {
      adjustTextareaHeight(notesRef.current);
    }
  }, [carrier]);


  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.target);

    try {
      let result;
      if (carrier) {
        // Update expense, details, and notes
        result = await updateCarrierExpense(carrier._id, formData);
      } else {
        // Create new carrier
        result = await createCarrier(formData);
      }

      if (result.success) {
        if (result.warning) {
          // Show warning but don't block - user can proceed
          alert(`Warning: ${result.warning}`);
        }
        // Close modal - onClose callback will handle refresh
        onClose();
      } else {
        setError(result.error || "Failed to save");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex justify-between items-center p-3 border-b">
          <div>
            <h2 className="text-base font-semibold">
              {carrier ? "Edit Trip" : "Create New Trip"}
            </h2>
            {carrier && (
              <div className="text-xs text-gray-600 mt-0.5">
                {carrier.tripNumber || carrier.name || "N/A"} • {formatDate(carrier.date)}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-2.5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-1.5 rounded text-xs">
              {error}
            </div>
          )}

          {!carrier && (
            <>
              {user?.role === "super_admin" && users.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Create for User
                  </label>
                  <select
                    name="userId"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                    disabled={isSubmitting}
                  >
                    <option value="">Your own account</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.username} {u.role === "super_admin" ? "(Admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input type="hidden" name="type" value="trip" />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Trip Number *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    name="tripNumber"
                    value={tripNumber}
                    onChange={(e) => setTripNumber(e.target.value.toUpperCase())}
                    required
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                    placeholder="e.g., TRIP-001"
                    disabled={isSubmitting || isGenerating}
                  />
                  <button
                    type="button"
                    onClick={loadGeneratedTripNumber}
                    disabled={isSubmitting || isGenerating}
                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Generate new trip number"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Auto-generated, but you can edit it. Must be unique.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Assign Truck <span className="text-gray-500 font-normal"></span>
                </label>
                <select
                  name="truck"
                  id="truck-select"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                  value={selectedTruck?._id || carrier?.truck?._id || carrier?.truck || ""}
                  onChange={(e) => {
                    const truck = trucks.find(t => t._id === e.target.value);
                    setSelectedTruck(truck || null);
                    const distanceField = document.getElementById('truck-distance-field');
                    if (truck && distanceField) {
                      distanceField.style.display = 'block';
                    } else if (distanceField) {
                      distanceField.style.display = 'none';
                    }
                  }}
                >
                  <option value="">No truck assigned</option>
                  {trucks.map((truck) => {
                    const driversText = truck.drivers && truck.drivers.length > 0
                      ? `- ${truck.drivers.map(d => d.name).join(", ")}`
                      : "";
                    const nextMaintenanceKm = (truck.lastMaintenanceKm || 0) + (truck.maintenanceInterval || 1000);
                    const kmsRemaining = nextMaintenanceKm - (truck.currentMeterReading || 0);
                    const maintenanceWarning = kmsRemaining <= 500 && kmsRemaining > 0 ? " ⚠️" : "";
                    return (
                      <option key={truck._id} value={truck._id}>
                        {truck.name} {driversText} {truck.number ? `(${truck.number})` : ""} {maintenanceWarning}
                      </option>
                    );
                  })}
                </select>
                {trucks.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    ⚠ No trucks available. Please create a truck first in the Trucks tab.
                  </p>
                )}
                {trucks.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Select the truck that will carry vehicles for this trip
                  </p>
                )}
              </div>

              {/* Truck Maintenance Info */}
              {selectedTruck && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 space-y-1">
                  <p className="text-xs font-semibold text-blue-800">Truck Maintenance Info</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-gray-600">Current KM:</span>
                      <span className="font-medium ml-1">{selectedTruck.currentMeterReading?.toLocaleString("en-US") || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Maint. KM:</span>
                      <span className="font-medium ml-1">{selectedTruck.lastMaintenanceKm?.toLocaleString("en-US") || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Maint. Interval:</span>
                      <span className="font-medium ml-1">{selectedTruck.maintenanceInterval?.toLocaleString("en-US") || "1000"} km</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Next Maint. At:</span>
                      <span className="font-medium ml-1">
                        {((selectedTruck.lastMaintenanceKm || 0) + (selectedTruck.maintenanceInterval || 1000)).toLocaleString("en-US")} km
                      </span>
                    </div>
                  </div>
                  {selectedTruck.lastMaintenanceDate && (
                    <div className="text-[10px] text-gray-600">
                      Last Maintenance: {formatDate(selectedTruck.lastMaintenanceDate)}
                    </div>
                  )}
                </div>
              )}

              <div id="truck-distance-field" style={{ display: selectedTruck ? 'block' : 'none' }}>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Trip Distance (KMs) <span className="text-gray-500 font-normal"></span>
                </label>
                <input
                  type="number"
                  name="tripDistance"
                  step="0.01"
                  min="0"
                  value={tripDistance}
                  onChange={(e) => {
                    setTripDistance(e.target.value);
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="Enter distance in kilometers"
                  disabled={isSubmitting}
                />
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Distance this truck will travel for this trip (will be added to truck meter)
                </p>
                {selectedTruck && selectedTruck.currentMeterReading && (
                  <p className="text-[10px] text-blue-600 mt-1 font-medium">
                    ℹ️ Current truck meter reading ({selectedTruck.currentMeterReading.toLocaleString("en-US")} km) will be recorded as meter reading at trip creation
                  </p>
                )}
                
                {/* Maintenance Warning */}
                {selectedTruck && tripDistance && parseFloat(tripDistance) > 0 && (() => {
                  const distance = parseFloat(tripDistance);
                  const currentKm = selectedTruck.currentMeterReading || 0;
                  const nextMaintenanceKm = (selectedTruck.lastMaintenanceKm || 0) + (selectedTruck.maintenanceInterval || 1000);
                  const newKm = currentKm + distance;
                  const kmsRemaining = nextMaintenanceKm - currentKm;
                  const willExceed = newKm >= nextMaintenanceKm;
                  
                  if (willExceed) {
                    return (
                      <div className="mt-1.5 p-1.5 bg-red-50 border border-red-300 rounded text-[10px]">
                        <p className="font-semibold text-red-800">⚠️ Maintenance Warning</p>
                        <p className="text-red-700">
                          This trip will exceed maintenance limit! After trip: {newKm.toLocaleString("en-US")} km (Next maintenance: {nextMaintenanceKm.toLocaleString("en-US")} km)
                        </p>
                      </div>
                    );
                  } else if (kmsRemaining > 0) {
                    const remainingAfterTrip = nextMaintenanceKm - newKm;
                    return (
                      <div className="mt-1.5 p-1.5 bg-green-50 border border-green-300 rounded text-[10px]">
                        <p className="font-semibold text-green-800">✓ Maintenance Status</p>
                        <p className="text-green-700">
                          After this trip: {newKm.toLocaleString("en-US")} km. Next maintenance required at: {nextMaintenanceKm.toLocaleString("en-US")} km ({remainingAfterTrip.toLocaleString("en-US")} km remaining)
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </>
          )}

          {carrier && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Trip Number *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    name="tripNumber"
                    value={tripNumber}
                    onChange={(e) => setTripNumber(e.target.value.toUpperCase())}
                    required
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                    placeholder="e.g., TRIP-001"
                    disabled={isSubmitting || isGenerating}
                  />
                  <button
                    type="button"
                    onClick={loadGeneratedTripNumber}
                    disabled={isSubmitting || isGenerating}
                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Generate new trip number"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Editable. Must be unique for your account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Assign Truck
                </label>
                <select
                  name="truck"
                  id="truck-select-edit"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={carrier?.truck?._id || carrier?.truck || ""}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const truck = trucks.find(t => t._id === e.target.value);
                    setSelectedTruck(truck || null);
                    const distanceField = document.getElementById('truck-distance-field-edit');
                    if (truck && distanceField) {
                      distanceField.style.display = 'block';
                    } else if (distanceField) {
                      distanceField.style.display = 'none';
                    }
                  }}
                >
                  <option value="">No truck assigned</option>
                  {trucks.map((truck) => {
                    const driversText = truck.drivers && truck.drivers.length > 0
                      ? `- ${truck.drivers.map(d => d.name).join(", ")}`
                      : "";
                    const nextMaintenanceKm = (truck.lastMaintenanceKm || 0) + (truck.maintenanceInterval || 1000);
                    const kmsRemaining = nextMaintenanceKm - (truck.currentMeterReading || 0);
                    const maintenanceWarning = kmsRemaining <= 500 && kmsRemaining > 0 ? " ⚠️" : "";
                    return (
                      <option key={truck._id} value={truck._id}>
                        {truck.name} {driversText} {truck.number ? `(${truck.number})` : ""} {maintenanceWarning}
                      </option>
                    );
                  })}
                </select>
                {trucks.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    ⚠ No trucks available. Please create a truck first in the Trucks tab.
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Change the truck assigned to this trip
                </p>
              </div>

              {/* Truck Maintenance Info for Edit Mode */}
              {selectedTruck && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 space-y-1">
                  <p className="text-xs font-semibold text-blue-800">Truck Maintenance Info</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-gray-600">Current KM:</span>
                      <span className="font-medium ml-1">{selectedTruck.currentMeterReading?.toLocaleString("en-US") || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Maint. KM:</span>
                      <span className="font-medium ml-1">{selectedTruck.lastMaintenanceKm?.toLocaleString("en-US") || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Maint. Interval:</span>
                      <span className="font-medium ml-1">{selectedTruck.maintenanceInterval?.toLocaleString("en-US") || "1000"} km</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Next Maint. At:</span>
                      <span className="font-medium ml-1">
                        {((selectedTruck.lastMaintenanceKm || 0) + (selectedTruck.maintenanceInterval || 1000)).toLocaleString("en-US")} km
                      </span>
                    </div>
                  </div>
                  {selectedTruck.lastMaintenanceDate && (
                    <div className="text-[10px] text-gray-600">
                      Last Maintenance: {formatDate(selectedTruck.lastMaintenanceDate)}
                    </div>
                  )}
                </div>
              )}

              <div id="truck-distance-field-edit" style={{ display: selectedTruck ? 'block' : 'none' }}>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Trip Distance (KMs) <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  name="tripDistance"
                  step="0.01"
                  min="0"
                  value={tripDistance}
                  onChange={(e) => {
                    setTripDistance(e.target.value);
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                  placeholder="Enter distance in kilometers"
                  disabled={isSubmitting}
                />
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Distance this truck will travel for this trip (will be added to truck meter)
                </p>
                {carrier?.meterReadingAtTrip && (
                  <p className="text-[10px] text-blue-600 mt-1">
                    Meter reading at trip creation: {carrier.meterReadingAtTrip.toLocaleString("en-US")} km
                  </p>
                )}
                {selectedTruck && selectedTruck.currentMeterReading && !carrier?.meterReadingAtTrip && (
                  <p className="text-[10px] text-blue-600 mt-1 font-medium">
                    ℹ️ Current truck meter reading ({selectedTruck.currentMeterReading.toLocaleString("en-US")} km) will be recorded as meter reading at trip creation
                  </p>
                )}
                
                {/* Maintenance Warning for Edit Mode */}
                {selectedTruck && tripDistance && parseFloat(tripDistance) > 0 && (() => {
                  const distance = parseFloat(tripDistance);
                  const currentKm = selectedTruck.currentMeterReading || 0;
                  const nextMaintenanceKm = (selectedTruck.lastMaintenanceKm || 0) + (selectedTruck.maintenanceInterval || 1000);
                  const newKm = currentKm + distance;
                  const kmsRemaining = nextMaintenanceKm - currentKm;
                  const willExceed = newKm >= nextMaintenanceKm;
                  
                  if (willExceed) {
                    return (
                      <div className="mt-1.5 p-1.5 bg-red-50 border border-red-300 rounded text-[10px]">
                        <p className="font-semibold text-red-800">⚠️ Maintenance Warning</p>
                        <p className="text-red-700">
                          This trip will exceed maintenance limit! After trip: {newKm.toLocaleString("en-US")} km (Next maintenance: {nextMaintenanceKm.toLocaleString("en-US")} km)
                        </p>
                      </div>
                    );
                  } else if (kmsRemaining > 0) {
                    const remainingAfterTrip = nextMaintenanceKm - newKm;
                    return (
                      <div className="mt-1.5 p-1.5 bg-green-50 border border-green-300 rounded text-[10px]">
                        <p className="font-semibold text-green-800">✓ Maintenance Status</p>
                        <p className="text-green-700">
                          After this trip: {newKm.toLocaleString("en-US")} km. Next maintenance required at: {nextMaintenanceKm.toLocaleString("en-US")} km ({remainingAfterTrip.toLocaleString("en-US")} km remaining)
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Notes
            </label>
            <textarea
              ref={notesRef}
              name="notes"
              rows="2"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md resize-none overflow-hidden"
              placeholder="Additional notes..."
              defaultValue={carrier?.notes || ""}
              disabled={isSubmitting}
              onInput={(e) => adjustTextareaHeight(e.target)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : carrier ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
