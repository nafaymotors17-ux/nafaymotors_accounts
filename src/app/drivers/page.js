"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllDrivers, createDriver, updateDriver, deleteDriver } from "@/app/lib/carriers-actions/drivers";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, X, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export default function DriversPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingDriver, setEditingDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const { user } = useUser();
  
  const queryClient = useQueryClient();

  const { data: driversData, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["drivers", { isActive: isActiveFilter }],
    queryFn: () => getAllDrivers({ isActive: isActiveFilter }),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: getAllUsersForSelection,
    enabled: user?.role === "super_admin",
  });

  const drivers = driversData?.drivers || [];
  const users = usersData?.users || [];

  // Filter and sort drivers
  const filteredDrivers = useMemo(() => {
    let result = drivers.filter((driver) =>
      driver.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.licenseNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.address?.toLowerCase().includes(searchQuery.toLowerCase())
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
          case "phone":
            aValue = (a.phone || "").toLowerCase();
            bValue = (b.phone || "").toLowerCase();
            break;
          case "email":
            aValue = (a.email || "").toLowerCase();
            bValue = (b.email || "").toLowerCase();
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
  }, [drivers, searchQuery, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDrivers = filteredDrivers.slice(startIndex, endIndex);

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

  const handleEdit = (driver) => {
    setEditingDriver(driver);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setEditingDriver(null);
    setShowForm(false);
  };

  const createMutation = useMutation({
    mutationFn: (formData) => createDriver(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ driverId, formData }) => updateDriver(driverId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (editingDriver) {
      updateMutation.mutate({ driverId: editingDriver._id, formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (driverId) => {
    if (confirm("Are you sure you want to delete this driver?")) {
      deleteMutation.mutate(driverId);
    }
  };

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Drivers</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Driver
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <input
          type="text"
          placeholder="Search drivers..."
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
            <option value="all">All Drivers</option>
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

      {/* Drivers Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading drivers...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          Error loading drivers: {error.message || "Unknown error"}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery ? "No drivers found matching your search." : "No drivers found."}
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
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedDrivers.map((driver) => (
                    <tr key={driver._id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">
                          {driver.name}
                        </div>
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
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 max-w-[150px] truncate" title={driver.address || ""}>
                        {driver.address || "-"}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                          {driver.user?.username || "-"}
                        </td>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          driver.isActive !== false 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {driver.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(driver)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Driver"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(driver._id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete Driver"
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
          {filteredDrivers.length > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div className="text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredDrivers.length)} of{" "}
                {filteredDrivers.length} drivers
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

      {/* Driver Form Modal - Compact */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex justify-between items-center p-2.5 border-b">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingDriver ? "Edit Driver" : "Add Driver"}
              </h3>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-2.5 space-y-2 max-h-[85vh] overflow-y-auto">
              {isSuperAdmin && users.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    User (Optional)
                  </label>
                  <select
                    name="userId"
                    defaultValue={editingDriver?.userId || ""}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    <option value="">Your account</option>
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
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingDriver?.name || ""}
                  required
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingDriver?.phone || ""}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingDriver?.email || ""}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  License Number
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  defaultValue={editingDriver?.licenseNumber || ""}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Address
                </label>
                <textarea
                  name="address"
                  rows="2"
                  defaultValue={editingDriver?.address || ""}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows="2"
                  defaultValue={editingDriver?.notes || ""}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              {editingDriver && (
                <div>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={editingDriver.isActive !== false}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    />
                    <span className="text-xs text-gray-700">Active</span>
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-1.5 border-t">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingDriver
                    ? "Update"
                    : "Create"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
      )}
    </div>
  );
}
