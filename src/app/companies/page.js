"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompanyBalances, setCompanyCredit } from "@/app/lib/invoice-actions/company-balances";
import { createCompany, updateCompanyName, deleteCompany } from "@/app/lib/carriers-actions/companies";
import { useState, useMemo } from "react";
import { Edit2, X, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default page size is 10
  const [editingCompany, setEditingCompany] = useState(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCreditBalance, setEditCreditBalance] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc"); // "asc" or "desc"
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [deleteError, setDeleteError] = useState(null);

  const queryClient = useQueryClient();

  const {
    data: balancesData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["company-balances"],
    queryFn: getCompanyBalances,
  });

  const balances = balancesData?.balances || [];

  // Filter and sort balances
  const filteredBalances = useMemo(() => {
    let result = balances.filter((balance) =>
      balance.companyName
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
          case "companyName":
            aValue = (a.companyName || "").toLowerCase();
            bValue = (b.companyName || "").toLowerCase();
            break;
          case "creditBalance":
            aValue = a.creditBalance || 0;
            bValue = b.creditBalance || 0;
            break;
          case "totalDue":
            aValue = a.totalDue || 0;
            bValue = b.totalDue || 0;
            break;
          case "createdAt":
            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
          default:
            return 0;
        }

        // Handle string comparison
        if (typeof aValue === "string" && typeof bValue === "string") {
          if (sortDirection === "asc") {
            return aValue.localeCompare(bValue);
          } else {
            return bValue.localeCompare(aValue);
          }
        }

        // Handle number comparison
        if (sortDirection === "asc") {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    return result;
  }, [balances, searchQuery, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredBalances.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBalances = filteredBalances.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
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
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset to page 1 when sorting changes
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

  const handleOpenUpdate = (balance) => {
    setEditingCompany(balance);
    setEditCompanyName(balance.companyName || "");
    setEditCreditBalance((balance.creditBalance ?? 0).toString());
    setDeleteError(null);
  };

  const handleCloseUpdate = () => {
    setEditingCompany(null);
    setEditCompanyName("");
    setEditCreditBalance("");
    updateCompanyMutation.reset();
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ companyId, currentName, newName, creditBalance }) => {
      const nameTrimmed = (newName || "").trim().toUpperCase();
      if (nameTrimmed !== (currentName || "").trim().toUpperCase()) {
        const r = await updateCompanyName(companyId, nameTrimmed);
        if (r?.error) throw new Error(r.error);
      }
      const setResult = await setCompanyCredit(nameTrimmed, parseFloat(creditBalance) || 0);
      if (setResult?.success === false && setResult?.error) throw new Error(setResult.error);
      return setResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-balances"] });
      handleCloseUpdate();
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: (name) => createCompany(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-balances"] });
      setNewCompanyName("");
      setShowAddCompany(false);
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId) => deleteCompany(companyId),
    onSuccess: (data) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ["company-balances"] });
        setDeleteError(null);
      } else if (data?.error) {
        setDeleteError(data.error);
      }
    },
  });


  const handleCreateCompany = (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      return;
    }
    createCompanyMutation.mutate(newCompanyName);
  };

  const handleUpdateCompany = (e) => {
    e.preventDefault();
    if (!editingCompany || !editCompanyName.trim()) return;
    const balance = parseFloat(editCreditBalance);
    if (isNaN(balance)) {
      alert("Please enter a valid credit balance");
      return;
    }
    updateCompanyMutation.mutate({
      companyId: editingCompany._id,
      currentName: editingCompany.companyName,
      newName: editCompanyName,
      creditBalance: balance,
    });
  };

  const handleDeleteClick = (balance) => {
    setDeleteError(null);
    if (!window.confirm(`Delete company "${balance.companyName}"? This can only be done if the company is not used in any trip.`)) {
      return;
    }
    deleteCompanyMutation.mutate(balance._id);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Companies</h1>
        <button
          onClick={() => setShowAddCompany(true)}
          className="px-2.5 py-1.5 bg-stone-50 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-100 flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Company
        </button>
      </div>

      {/* Search and Pagination Controls */}
      <div className="mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <input
          type="text"
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex items-center gap-2">
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

      {/* Companies Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading companies...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          Error loading companies: {error.message || "Unknown error"}
        </div>
      ) : filteredBalances.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery ? "No companies found matching your search." : "No companies found."}
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
                      onClick={() => handleSort("companyName")}
                    >
                      <div className="flex items-center">
                        Company Name
                        {getSortIcon("companyName")}
                      </div>
                    </th>
                    <th 
                      className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("creditBalance")}
                    >
                      <div className="flex items-center justify-end">
                        Credit Balance
                        {getSortIcon("creditBalance")}
                      </div>
                    </th>
                    <th 
                      className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("totalDue")}
                    >
                      <div className="flex items-center justify-end">
                        Total Due
                        {getSortIcon("totalDue")}
                      </div>
                    </th>
                    <th 
                      className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center">
                        Created At
                        {getSortIcon("createdAt")}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBalances.map((balance) => {
                    return (
                      <tr key={balance.companyName} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <div className="text-xs font-medium text-gray-900">
                            {balance.companyName}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right">
                          <span className="text-xs font-semibold text-green-600">
                            R
                            {(balance.creditBalance || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right">
                          <span className="text-xs font-semibold text-blue-600">
                            R
                            {(balance.totalDue || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                          {balance.createdAt ? formatDate(balance.createdAt) : "-"}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenUpdate(balance)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Update Company"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(balance)}
                              disabled={deleteCompanyMutation.isPending}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              title="Delete company (only if not used in any trip)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filteredBalances.length > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div className="text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredBalances.length)} of{" "}
                {filteredBalances.length} companies
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

      {/* Update Company Modal */}
      {editingCompany && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Update Company</h3>
              <button onClick={handleCloseUpdate} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value.toUpperCase())}
                  placeholder="Company name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={updateCompanyMutation.isPending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Balance *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editCreditBalance}
                  onChange={(e) => setEditCreditBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  required
                  disabled={updateCompanyMutation.isPending}
                />
              </div>
              {updateCompanyMutation.isError && (
                <p className="text-xs text-red-600">
                  {updateCompanyMutation.error?.message || "Failed to update company"}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updateCompanyMutation.isPending || !editCompanyName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseUpdate}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete error toast */}
      {deleteError && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-start gap-2 z-50">
          <span className="text-sm flex-1">{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Add New Company
              </h3>
              <button
                onClick={() => {
                  setShowAddCompany(false);
                  setNewCompanyName("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => {
                    setNewCompanyName(e.target.value.toUpperCase());
                  }}
                  placeholder="Enter company name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  required
                  disabled={createCompanyMutation.isPending}
                />
                {createCompanyMutation.isError && (
                  <p className="text-xs text-red-600 mt-1">
                    {createCompanyMutation.error?.error || "Failed to create company"}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createCompanyMutation.isPending || !newCompanyName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCompany(false);
                    setNewCompanyName("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={createCompanyMutation.isPending}
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
