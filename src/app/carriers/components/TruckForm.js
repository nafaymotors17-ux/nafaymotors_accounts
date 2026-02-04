"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function TruckForm({
  editingTruck,
  drivers,
  users,
  isSuperAdmin,
  onSubmit,
  onClose,
  createMutation,
  updateMutation,
}) {
  // Track selected drivers for creation
  const [selectedDriverIds, setSelectedDriverIds] = useState(
    editingTruck?.drivers?.map(d => typeof d === 'object' ? d._id : d) || []
  );

  // Handle form submission with validation
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!editingTruck && selectedDriverIds.length === 0) {
      alert("Please select at least one driver");
      return;
    }

    // For creation, ensure hidden inputs are in the DOM before creating FormData
    if (!editingTruck) {
      // Remove any existing driverIds hidden inputs first
      const existingInputs = e.target.querySelectorAll('input[name="driverIds"]');
      existingInputs.forEach(input => input.remove());
      
      // Create and append hidden inputs for selected drivers to the form DOM
      selectedDriverIds.forEach(driverId => {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'driverIds';
        hiddenInput.value = driverId;
        e.target.appendChild(hiddenInput);
      });
      
      // Debug: Verify driver IDs
      console.log("TruckForm - selectedDriverIds:", selectedDriverIds);
    }

    // Debug: Verify driver IDs are in the form
    if (!editingTruck) {
      const formDataCheck = new FormData(e.target);
      console.log("TruckForm - selectedDriverIds:", selectedDriverIds);
      console.log("TruckForm - FormData driverIds:", formDataCheck.getAll('driverIds'));
    }

    // Call the parent's onSubmit handler
    // The parent will create FormData from e.target, which now includes the hidden inputs
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-gray-800">
            {editingTruck ? "Edit Truck" : "Add New Truck"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {isSuperAdmin && users.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Create for User (Optional)
                </label>
                <select
                  name="userId"
                  defaultValue={editingTruck?.userId || ""}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
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

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Truck Name (Model/Type) *
              </label>
              <input
                type="text"
                name="name"
                defaultValue={editingTruck?.name || ""}
                required
                placeholder="e.g., HINO RANGER"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Drivers * {editingTruck && <span className="text-[10px] text-gray-500">(Existing drivers are locked, you can add new ones)</span>}
            </label>
            {editingTruck ? (
              // When editing, show existing drivers as read-only and allow adding new ones
              <>
                {editingTruck.drivers && editingTruck.drivers.length > 0 && (
                  <div className="mb-2">
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                      Existing Drivers (Locked)
                    </label>
                    <div className="w-full px-2 py-1.5 border border-gray-300 rounded-md bg-gray-50">
                      <div className="space-y-0.5">
                        {editingTruck.drivers.map((driver) => {
                          const driverId = typeof driver === 'object' ? driver._id : driver;
                          const driverName = typeof driver === 'object' ? driver.name : driver;
                          return (
                            <div key={driverId} className="text-xs text-gray-700 flex items-center gap-1.5">
                              <span className="text-gray-400">🔒</span>
                              <span>{driverName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                    Add New Drivers (Optional)
                  </label>
                  <select
                    name="newDriverIds"
                    multiple
                    size={Math.min(drivers.length + 1, 4)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {drivers
                      .filter(driver => {
                        // Filter out already assigned drivers
                        const existingDriverIds = (editingTruck.drivers || []).map(d => 
                          typeof d === 'object' ? d._id : d
                        );
                        return !existingDriverIds.includes(driver._id);
                      })
                      .map((driver) => (
                        <option key={driver._id} value={driver._id}>
                          {driver.name}
                        </option>
                      ))}
                  </select>
                  {drivers.filter(driver => {
                    const existingDriverIds = (editingTruck.drivers || []).map(d => 
                      typeof d === 'object' ? d._id : d
                    );
                    return !existingDriverIds.includes(driver._id);
                  }).length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      All available drivers are already assigned to this truck.
                    </p>
                  )}
                  {drivers.filter(driver => {
                    const existingDriverIds = (editingTruck.drivers || []).map(d => 
                      typeof d === 'object' ? d._id : d
                    );
                    return !existingDriverIds.includes(driver._id);
                  }).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Hold Ctrl (Windows) or Cmd (Mac) to select multiple drivers to add
                    </p>
                  )}
                </div>
              </>
            ) : (
              // When creating, use dropdown with selected drivers shown as chips
              <>
                {drivers.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50">
                    <p className="text-sm text-red-600">
                      No drivers available. Please create a driver first.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Dropdown to select drivers */}
                    <select
                      onChange={(e) => {
                        const driverId = e.target.value;
                        if (driverId && !selectedDriverIds.includes(driverId)) {
                          setSelectedDriverIds([...selectedDriverIds, driverId]);
                          e.target.value = ""; // Reset dropdown
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      <option value="">Select a driver to add...</option>
                      {drivers
                        .filter(driver => !selectedDriverIds.includes(driver._id))
                        .map((driver) => (
                          <option key={driver._id} value={driver._id}>
                            {driver.name}
                          </option>
                        ))}
                    </select>
                    
                    {/* Show selected drivers as chips with remove buttons */}
                    {selectedDriverIds.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {selectedDriverIds.map((driverId) => {
                          const driver = drivers.find(d => d._id === driverId);
                          if (!driver) return null;
                          return (
                            <div
                              key={driverId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs"
                            >
                              <span>{driver.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDriverIds(selectedDriverIds.filter(id => id !== driverId));
                                }}
                                className="text-blue-600 hover:text-blue-800 focus:outline-none"
                                disabled={createMutation.isPending || updateMutation.isPending}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Validation message */}
                    <div className="mt-1.5">
                      {selectedDriverIds.length === 0 ? (
                        <p className="text-[10px] text-red-500">
                          At least one driver is required. Please select a driver from the dropdown above.
                        </p>
                      ) : (
                        <p className="text-[10px] text-gray-500">
                          {selectedDriverIds.length} driver{selectedDriverIds.length > 1 ? 's' : ''} selected. You can add more or remove selected ones.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Truck Number/Identifier
              </label>
              <input
                type="text"
                name="number"
                defaultValue={editingTruck?.number || ""}
                placeholder="e.g., TRUCK-001"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Current Meter Reading (KM)
              </label>
              <input
                type="number"
                name="currentMeterReading"
                defaultValue={editingTruck?.currentMeterReading || 0}
                min="0"
                step="1"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Maintenance Interval (KM)
              </label>
              <input
                type="number"
                name="maintenanceInterval"
                defaultValue={editingTruck?.maintenanceInterval || 1000}
                min="1"
                step="1"
                placeholder="e.g., 1000"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Last Maintenance KM
              </label>
              <input
                type="number"
                name="lastMaintenanceKm"
                defaultValue={editingTruck?.lastMaintenanceKm || 0}
                min="0"
                step="1"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>
          
          <div className="text-[10px] text-gray-500 space-y-0.5">
            <p>• <strong>Current Meter Reading:</strong> The current odometer reading of the truck (e.g., 20000 km). Automatically updated when trips are created.</p>
            <p>• <strong>Maintenance Interval:</strong> Maintenance required every X kilometers (e.g., 1000 means every 1000km)</p>
            <p>• <strong>Last Maintenance KM:</strong> Kilometer reading when last maintenance was performed</p>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingTruck
                ? "Update"
                : "Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </button>
          </div>

          {(createMutation.error || updateMutation.error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-1.5 rounded text-xs">
              {createMutation.error?.message || updateMutation.error?.message || "An error occurred"}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
