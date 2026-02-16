"use client";

import { useMutation } from "@tanstack/react-query";
import { getAllTrucks, createTruck, updateTruck, deleteTruck } from "@/app/lib/carriers-actions/trucks";
import { getAllDrivers } from "@/app/lib/carriers-actions/drivers";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, RefreshCw } from "lucide-react";
import TrucksTable from "./components/TrucksTable";
import TruckForm from "./components/TruckForm";
import TruckSearch from "./components/TruckSearch";

export default function CarriersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { user, loading: userLoading } = useUser();

  const loadTrucks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getAllTrucks({}, user);
      setTrucks(res?.trucks || []);
    } catch (err) {
      setError(err?.message || "Failed to load trucks");
    }
  }, [user]);

  const loadDrivers = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getAllDrivers({}, user);
      setDrivers(res?.drivers || []);
    } catch (err) {
      // drivers load failure doesn't replace trucks error
      setDrivers([]);
    }
  }, [user]);

  const loadUsers = useCallback(async () => {
    if (!user || user?.role !== "super_admin") return;
    try {
      const res = await getAllUsersForSelection();
      setUsers(res?.users || []);
    } catch {
      setUsers([]);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setError(null);
    await Promise.all([loadTrucks(), loadDrivers(), loadUsers()]);
    setRefreshing(false);
  }, [user, loadTrucks, loadDrivers, loadUsers]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getAllTrucks({}, user).then((res) => !cancelled && setTrucks(res?.trucks || [])),
      getAllDrivers({}, user).then((res) => !cancelled && setDrivers(res?.drivers || [])),
      user?.role === "super_admin"
        ? getAllUsersForSelection().then((res) => !cancelled && setUsers(res?.users || []))
        : Promise.resolve(),
    ]).catch((err) => !cancelled && setError(err?.message || "Failed to load")).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user?.userId, user?.role]);

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

  const handleSearchChange = (value) => setSearchQuery(value);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
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
      loadTrucks();
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ truckId, formData }) => updateTruck(truckId, formData),
    onSuccess: (_result, variables) => {
      loadTrucks();
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (truckId) => {
      const result = await deleteTruck(truckId);
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => loadTrucks(),
    onError: (error) => {
      alert(`Error deleting truck: ${error.message || "Unknown error"}`);
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
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-2.5 py-1.5 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-50 flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Refresh trucks and drivers"
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
        <TrucksTable
          trucks={filteredTrucks}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isSuperAdmin={isSuperAdmin}
          deleteMutationPending={deleteMutation.isPending}
        />
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
