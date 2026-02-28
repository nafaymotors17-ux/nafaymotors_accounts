"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "@/app/lib/carriers-actions/drivers";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, RefreshCw } from "lucide-react";
import DriversTable from "./components/DriversTable";
import DriverForm from "./components/DriverForm";
import DriverSearch from "./components/DriverSearch";
import DriverRentModal from "@/app/carrier-trips/components/DriverRentModal";
import { Toast } from "@/app/components/Toast";

const DRIVERS_QUERY_KEY = ["drivers"];
const USERS_SELECTION_QUERY_KEY = ["users-selection"];
const PER_PAGE = 10;

export default function DriversPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDriver, setEditingDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [showDriverRentModal, setShowDriverRentModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [toast, setToast] = useState(null);
  const { user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();

  const userId = user?.userId ?? null;
  const isSuperAdmin = user?.role === "super_admin";

  const driversQuery = useQuery({
    queryKey: [...DRIVERS_QUERY_KEY, userId],
    queryFn: () => getAllDrivers({}, user).then((res) => res?.drivers ?? []),
    enabled: !userLoading && !!userId,
  });

  // Lazy: only fetch users when form is open (for "Create for User" in DriverForm)
  const usersQuery = useQuery({
    queryKey: [...USERS_SELECTION_QUERY_KEY, userId],
    queryFn: () => getAllUsersForSelection().then((res) => res?.users ?? []),
    enabled: !userLoading && !!userId && isSuperAdmin && showForm,
  });

  const drivers = driversQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const loading = driversQuery.isLoading;
  const error = driversQuery.error?.message ?? null;
  const refreshing = driversQuery.isRefetching || usersQuery.isRefetching;

  const refresh = useCallback(() => {
    queryClient.refetchQueries({ queryKey: DRIVERS_QUERY_KEY });
    if (isSuperAdmin && showForm)
      queryClient.refetchQueries({ queryKey: USERS_SELECTION_QUERY_KEY });
  }, [queryClient, isSuperAdmin, showForm]);

  const driversQueryKey = [...DRIVERS_QUERY_KEY, userId];

  // Filter and sort drivers
  const filteredDrivers = useMemo(() => {
    let result = drivers.filter(
      (driver) =>
        driver.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.licenseNumber
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        driver.address?.toLowerCase().includes(searchQuery.toLowerCase()),
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
          case "createdAt":
            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
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

        // Handle number comparison (for createdAt)
        if (sortDirection === "asc") {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    return result;
  }, [drivers, searchQuery, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / PER_PAGE));
  const paginatedDrivers = useMemo(
    () => filteredDrivers.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredDrivers, page],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handleEdit = (driver) => {
    setEditingDriver(driver);
    setShowForm(true);
  };

  const handleCloseForm = useCallback(() => {
    setEditingDriver(null);
    setShowForm(false);
  }, []);

  const createMutation = useMutation({
    mutationFn: (formData) => createDriver(formData),
    onSuccess: (data) => {
      if (data?.error) {
        setToast({ message: data.error, type: "error" });
        return;
      }
      const d = data.driver;
      if (d) {
        const newDriver = { ...d, _id: d._id?.toString?.() ?? d._id };
        queryClient.setQueryData(driversQueryKey, (old) => [
          ...(old || []),
          newDriver,
        ]);
      }
      setToast({ message: "Driver created successfully", type: "success" });
      handleCloseForm();
    },
    onError: (err) =>
      setToast({
        message: err?.message || "Failed to create driver",
        type: "error",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ driverId, formData }) => updateDriver(driverId, formData),
    onSuccess: (data) => {
      if (data?.error) {
        setToast({ message: data.error, type: "error" });
        return;
      }
      const d = data.driver;
      if (d) {
        const id = d._id?.toString?.() ?? d._id;
        queryClient.setQueryData(driversQueryKey, (old) =>
          (old || []).map((dr) =>
            (dr._id?.toString?.() ?? dr._id) === id
              ? { ...dr, ...d, _id: id }
              : dr,
          ),
        );
      }
      setToast({ message: "Driver updated successfully", type: "success" });
      handleCloseForm();
    },
    onError: (err) =>
      setToast({
        message: err?.message || "Failed to update driver",
        type: "error",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: (data, driverId) => {
      if (data?.error) {
        setToast({ message: data.error, type: "error" });
        return;
      }
      const id = driverId?.toString?.() ?? driverId;
      queryClient.setQueryData(driversQueryKey, (old) =>
        (old || []).filter((dr) => (dr._id?.toString?.() ?? dr._id) !== id),
      );
      setToast({ message: "Driver deleted successfully", type: "success" });
    },
    onError: (err) =>
      setToast({
        message: err?.message || "Failed to delete driver",
        type: "error",
      }),
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

  return (
    <div className="container mx-auto px-4 py-8">
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Drivers</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-2.5 py-1.5 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-50 flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Refresh drivers"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-2.5 py-1.5 bg-stone-50 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-100 flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Driver
          </button>
        </div>
      </div>

      <DriverSearch
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />

      {userLoading || loading ? (
        <div className="text-center py-8 text-gray-500">Loading drivers...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          Error loading drivers: {error}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery
            ? "No drivers found matching your search."
            : "No drivers found."}
        </div>
      ) : (
        <>
          <DriversTable
            drivers={paginatedDrivers}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDriverNameClick={(driver) => {
              setSelectedDriver({
                id: driver._id,
                name: driver.name,
              });
              setShowDriverRentModal(true);
            }}
            isSuperAdmin={isSuperAdmin}
            deleteMutationPending={deleteMutation.isPending}
          />
          <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {page} of {totalPages} ({filteredDrivers.length} drivers)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <DriverForm
          editingDriver={editingDriver}
          users={users}
          isSuperAdmin={isSuperAdmin}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          createMutation={createMutation}
          updateMutation={updateMutation}
        />
      )}

      {showDriverRentModal && selectedDriver && (
        <DriverRentModal
          driverId={selectedDriver.id}
          driverName={selectedDriver.name}
          onClose={() => {
            setShowDriverRentModal(false);
            setSelectedDriver(null);
          }}
        />
      )}
    </div>
  );
}
