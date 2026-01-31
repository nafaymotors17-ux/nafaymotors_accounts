"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllTrucks, createTruck, updateTruck, deleteTruck } from "@/app/lib/carriers-actions/trucks";
import { getAllDrivers } from "@/app/lib/carriers-actions/drivers";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, X, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export default function CarriersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const { user } = useUser();
  
  const queryClient = useQueryClient();

  const { data: trucksData, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["trucks", { isActive: isActiveFilter }],
    queryFn: () => getAllTrucks({ isActive: isActiveFilter }),
  });

  const { data: driversData } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getAllDrivers({ isActive: "true" }),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: getAllUsersForSelection,
    enabled: user?.role === "super_admin",
  });

  const trucks = trucksData?.trucks || [];
  const drivers = driversData?.drivers || [];
  const users = usersData?.users || [];

  // Filter and sort trucks
  const filteredTrucks = useMemo(() => {
    let result = trucks.filter((truck) =>
      truck.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.driver?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
          case "name":
            aValue = (a.name || "").toLowerCase();
            bValue = (b.name || "").toLowerCase();
            break;
          case "driver":
            aValue = (a.driver?.name || "").toLowerCase();
            bValue = (b.driver?.name || "").toLowerCase();
            break;
          default:
            return 0;
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          if (sortDirection === "asc") {
            return aValue.localeCompare(bValue);
          } else {
            return bValue.localeCompare(aValue);
          }
        }

        return 0;
      });
    }

    return result;
  }, [trucks, searchQuery, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTrucks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTrucks = filteredTrucks.slice(startIndex, endIndex);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 inline-block ml-1 text-gray-400" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="w-3 h-3 inline-block ml-1 text-blue-600" />;
    }
    return <ArrowDown className="w-3 h-3 inline-block ml-1 text-blue-600" />;
  };

  const handleEdit = (carrier) => {
    setEditingCarrier(carrier);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setEditingCarrier(null);
    setShowForm(false);
  };

  const createMutation = useMutation({
    mutationFn: (formData) => createTruck(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ truckId, formData }) => updateTruck(truckId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTruck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (editingCarrier) {
      updateMutation.mutate({ truckId: editingCarrier._id, formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (truckId) => {
    if (confirm("Are you sure you want to delete this truck?")) {
      deleteMutation.mutate(truckId);
    }
  };

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Trucks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Truck
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <input
          type="text"
          placeholder="Search trucks..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex items-center gap-2">
          <select
            value={isActiveFilter}
            onChange={(e) => {
              setIsActiveFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="all">All Trucks</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            <span className="text-xs">Refresh</span>
          </button>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-gray-600">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Carriers Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading trucks...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          Error loading trucks: {error.message || "Unknown error"}
        </div>
      ) : filteredTrucks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery ? "No trucks found matching your search." : "No trucks found."}
        </div>
      ) : (
        <>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Name
                        {getSortIcon("name")}
                      </div>
                    </th>
                    <th 
                      className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("driver")}
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
                      Total KM
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Maint. Interval
                    </th>
                    {isSuperAdmin && (
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                    )}
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTrucks.map((truck) => (
                    <tr key={truck._id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">
                          {truck.name}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                        {truck.driver?.name || "-"}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                        {truck.number || "-"}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                        {truck.currentMeterReading?.toLocaleString("en-US") || "0"}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                        {truck.totalKms?.toLocaleString("en-US") || "0"}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                        {truck.maintenanceInterval?.toLocaleString("en-US") || "0"} km
                      </td>
                      {isSuperAdmin && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                          {truck.user?.username || "-"}
                        </td>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          truck.isActive !== false 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {truck.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(truck)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Truck"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(truck._id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete Truck"
                            disabled={deleteMutation.isPending}
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

          {/* Pagination */}
          {filteredTrucks.length > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div className="text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredTrucks.length)} of{" "}
                {filteredTrucks.length} trucks
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-xs"
                >
                  Prev
                </button>
                <span className="px-2 py-1 text-gray-700">
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Carrier Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {editingCarrier ? "Edit Truck" : "Add New Truck"}
              </h3>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSuperAdmin && users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Create for User (Optional)
                  </label>
                  <select
                    name="userId"
                    defaultValue={editingCarrier?.userId || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck Name (Model/Type) *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingCarrier?.name || ""}
                  required
                  placeholder="e.g., HINO RANGER"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Driver (Optional)
                </label>
                <select
                  name="driverId"
                  defaultValue={editingCarrier?.driver?._id || ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <option value="">No driver assigned</option>
                  {drivers.map((driver) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                {drivers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No drivers available. Create a driver first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck Number/Identifier
                </label>
                <input
                  type="text"
                  name="number"
                  defaultValue={editingCarrier?.number || ""}
                  placeholder="e.g., TRUCK-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Meter Reading (KM)
                </label>
                <input
                  type="number"
                  name="currentMeterReading"
                  defaultValue={editingCarrier?.currentMeterReading || 0}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Kilometers
                </label>
                <input
                  type="number"
                  name="totalKms"
                  defaultValue={editingCarrier?.totalKms || 0}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maintenance Interval (KM)
                </label>
                <input
                  type="number"
                  name="maintenanceInterval"
                  defaultValue={editingCarrier?.maintenanceInterval || 1000}
                  min="1"
                  step="1"
                  placeholder="e.g., 1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maintenance required every X kilometers (e.g., 1000 means every 1000km)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Maintenance KM
                </label>
                <input
                  type="number"
                  name="lastMaintenanceKm"
                  defaultValue={editingCarrier?.lastMaintenanceKm || 0}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kilometer reading when last maintenance was performed
                </p>
              </div>

              {editingCarrier && (
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={editingCarrier.isActive !== false}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingCarrier
                    ? "Update"
                    : "Create"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </button>
              </div>

              {(createMutation.error || updateMutation.error) && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {createMutation.error?.message || updateMutation.error?.message || "An error occurred"}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
