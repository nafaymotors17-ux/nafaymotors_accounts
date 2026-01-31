"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompanyBalances, setCompanyCredit } from "@/app/lib/invoice-actions/company-balances";
import { useState, useMemo } from "react";
import { Edit2, X, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default page size is 10
  const [editingCompany, setEditingCompany] = useState(null);
  const [newCreditBalance, setNewCreditBalance] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc"); // "asc" or "desc"
  
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

  const handleEditCredit = (balance) => {
    setEditingCompany(balance);
    setNewCreditBalance(balance.creditBalance?.toString() || "0");
  };

  const handleCloseModal = () => {
    setEditingCompany(null);
    setNewCreditBalance("");
  };

  const updateCreditMutation = useMutation({
    mutationFn: ({ companyName, newBalance }) => setCompanyCredit(companyName, parseFloat(newBalance) || 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-balances"] });
      handleCloseModal();
    },
  });

  const handleUpdateCredit = (e) => {
    e.preventDefault();
    if (!editingCompany) return;
    
    const balance = parseFloat(newCreditBalance);
    if (isNaN(balance)) {
      alert("Please enter a valid number");
      return;
    }

    updateCreditMutation.mutate({
      companyName: editingCompany.companyName,
      newBalance: balance,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">


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
                        <td className="px-2 py-1.5 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleEditCredit(balance)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Update Credit Balance"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Edit Credit Balance Modal */}
      {editingCompany && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Update Credit Balance
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Company: <span className="font-semibold">{editingCompany.companyName}</span>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Current Credit Balance: R
                {(editingCompany.creditBalance || 0).toLocaleString("en-US", {
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
                />
            
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updateCreditMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateCreditMutation.isPending ? "Updating..." : "Update Balance"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
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
