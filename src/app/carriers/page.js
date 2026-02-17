"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllTrucks, createTruck, updateTruck, deleteTruck } from "@/app/lib/carriers-actions/trucks";
import { getAllDrivers } from "@/app/lib/carriers-actions/drivers";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Plus, RefreshCw } from "lucide-react";
import TrucksTable from "./components/TrucksTable";
import TruckForm from "./components/TruckForm";
import TruckSearch from "./components/TruckSearch";
import { Toast } from "@/app/components/Toast";

const DRIVERS_QUERY_KEY = ["drivers"];
const USERS_SELECTION_QUERY_KEY = ["users-selection"];
const PER_PAGE = 10;

export default function CarriersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [createPending, setCreatePending] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [toast, setToast] = useState(null);
  const { user, loading: userLoading } = useUser();
  const userRef = useRef(user);
  userRef.current = user;

  const userId = user?.userId ?? null;
  const isSuperAdmin = user?.role === "super_admin";

  const loadTrucks = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await getAllTrucks({}, u);
      setTrucks(res?.trucks ?? []);
    } catch (err) {
      setError(err?.message ?? "Failed to load trucks");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (userLoading || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const u = userRef.current;
    getAllTrucks({}, u)
      .then((res) => {
        if (!cancelled) setTrucks(res?.trucks ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load trucks");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userLoading, userId]);

  // Lazy: only fetch drivers when form is open (for driver dropdown in TruckForm)
  const driversQuery = useQuery({
    queryKey: [...DRIVERS_QUERY_KEY, userId],
    queryFn: () => getAllDrivers({}, user).then((res) => res?.drivers ?? []),
    enabled: !userLoading && !!userId && showForm,
  });

  // Lazy: only fetch users when form is open and super_admin (for "Create for User" in TruckForm)
  const usersQuery = useQuery({
    queryKey: [...USERS_SELECTION_QUERY_KEY, userId],
    queryFn: () => getAllUsersForSelection().then((res) => res?.users ?? []),
    enabled: !userLoading && !!userId && isSuperAdmin && showForm,
  });

  const drivers = driversQuery.data ?? [];
  const users = usersQuery.data ?? [];

  // Filter and sort trucks
  const filteredTrucks = useMemo(() => {
    let result = trucks.filter((truck) => {
      const truckDrivers = truck.drivers && truck.drivers.length > 0
        ? truck.drivers.map(d => d.name).join(" ")
        : "";
      return (
        truck.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        truck.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        truckDrivers.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aValue, bValue;
        switch (sortField) {
          case "name":
            aValue = (a.name || "").toLowerCase();
            bValue = (b.name || "").toLowerCase();
            break;
          case "driver":
            const aDrivers = a.drivers && a.drivers.length > 0 ? a.drivers.map(d => d.name).join(", ") : "";
            const bDrivers = b.drivers && b.drivers.length > 0 ? b.drivers.map(d => d.name).join(", ") : "";
            aValue = aDrivers.toLowerCase();
            bValue = bDrivers.toLowerCase();
            break;
          default:
            return 0;
        }
        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }
    return result;
  }, [trucks, searchQuery, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredTrucks.length / PER_PAGE));
  const paginatedTrucks = useMemo(
    () => filteredTrucks.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredTrucks, page]
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

  const handleEdit = (carrier) => {
    setEditingCarrier(carrier);
    setShowForm(true);
  };

  const handleCloseForm = useCallback(() => {
    setEditingCarrier(null);
    setShowForm(false);
    setCreateError(null);
    setUpdateError(null);
  }, []);

  const createMutate = useCallback(async (formData) => {
    setCreateError(null);
    setCreatePending(true);
    try {
      const result = await createTruck(formData);
      if (result?.error) {
        const msg = result.error;
        setCreateError(new Error(msg));
        setToast({ message: msg, type: "error" });
        return;
      }
      const t = result.truck;
      const newTruck = {
        _id: t?._id?.toString?.() ?? t?._id,
        name: t?.name ?? "",
        number: t?.number ?? "",
        drivers: [],
        currentMeterReading: t?.currentMeterReading ?? 0,
        maintenanceInterval: t?.maintenanceInterval ?? 1000,
        lastMaintenanceKm: t?.lastMaintenanceKm ?? 0,
        userId: t?.userId?.toString?.() ?? t?.userId,
        user: null,
        isActive: t?.isActive ?? true,
        createdAt: t?.createdAt,
        updatedAt: t?.updatedAt,
      };
      setTrucks((prev) => [...prev, newTruck]);
      setToast({ message: "Truck created successfully", type: "success" });
      handleCloseForm();
    } catch (err) {
      const msg = err?.message || "Failed to create truck";
      setCreateError(err);
      setToast({ message: msg, type: "error" });
    } finally {
      setCreatePending(false);
    }
  }, [handleCloseForm]);

  const updateMutate = useCallback(async ({ truckId, formData }) => {
    setUpdateError(null);
    setUpdatePending(true);
    try {
      const result = await updateTruck(truckId, formData);
      if (result?.error) {
        const msg = result.error;
        setUpdateError(new Error(msg));
        setToast({ message: msg, type: "error" });
        return;
      }
      const t = result.truck;
      setTrucks((prev) =>
        prev.map((tr) =>
          (tr._id ?? tr._id?.toString?.()) === (truckId?.toString?.() ?? truckId)
            ? {
                ...tr,
                name: t?.name ?? tr.name,
                number: t?.number ?? tr.number,
                currentMeterReading: t?.currentMeterReading ?? tr.currentMeterReading,
                maintenanceInterval: t?.maintenanceInterval ?? tr.maintenanceInterval,
                lastMaintenanceKm: t?.lastMaintenanceKm ?? tr.lastMaintenanceKm,
                lastMaintenanceDate: t?.lastMaintenanceDate ?? tr.lastMaintenanceDate,
              }
            : tr
        )
      );
      setToast({ message: "Truck updated successfully", type: "success" });
      handleCloseForm();
    } catch (err) {
      const msg = err?.message || "Failed to update truck";
      setUpdateError(err);
      setToast({ message: msg, type: "error" });
    } finally {
      setUpdatePending(false);
    }
  }, [handleCloseForm]);

  const createMutation = useMemo(() => ({
    mutate: (formData) => createMutate(formData),
    isPending: createPending,
    error: createError,
  }), [createMutate, createPending, createError]);

  const updateMutation = useMemo(() => ({
    mutate: (vars) => updateMutate(vars),
    isPending: updatePending,
    error: updateError,
  }), [updateMutate, updatePending, updateError]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    if (editingCarrier) {
      updateMutation.mutate({ truckId: editingCarrier._id, formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [editingCarrier, createMutation, updateMutation]);

  const refresh = useCallback(() => {
    loadTrucks();
  }, [loadTrucks]);

  const handleDelete = useCallback((truckId) => {
    if (!confirm("Are you sure you want to delete this truck?")) return;
    const id = truckId?.toString?.() ?? truckId;
    setDeletePending(true);
    deleteTruck(truckId)
      .then((result) => {
        if (result?.error) {
          setToast({ message: result.error, type: "error" });
          return;
        }
        setTrucks((prev) => prev.filter((t) => (t._id?.toString?.() ?? t._id) !== id));
        setToast({ message: "Truck deleted successfully", type: "success" });
      })
      .catch((err) => setToast({ message: err?.message || "Failed to delete truck", type: "error" }))
      .finally(() => setDeletePending(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Trucks</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-2.5 py-1.5 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-50 flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Refresh trucks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-2.5 py-1.5 bg-stone-50 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-100 flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Truck
          </button>
        </div>
      </div>

      <TruckSearch searchQuery={searchQuery} onSearchChange={handleSearchChange} />

      {(userLoading || loading) ? (
        <div className="text-center py-8 text-gray-500">Loading trucks...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          Error loading trucks: {error}
        </div>
      ) : filteredTrucks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery ? "No trucks found matching your search." : "No trucks found."}
        </div>
      ) : (
        <>
          <TrucksTable
            trucks={paginatedTrucks}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isSuperAdmin={isSuperAdmin}
            deleteMutationPending={deletePending}
          />
          <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {page} of {totalPages} ({filteredTrucks.length} trucks)
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
        <TruckForm
          editingTruck={editingCarrier}
          drivers={drivers}
          users={users}
          isSuperAdmin={isSuperAdmin}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          createMutation={createMutation}
          updateMutation={updateMutation}
        />
      )}
    </div>
  );
}
