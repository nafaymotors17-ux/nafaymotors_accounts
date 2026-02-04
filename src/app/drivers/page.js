"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllDrivers, createDriver, updateDriver, deleteDriver } from "@/app/lib/carriers-actions/drivers";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { useUser } from "@/app/components/UserContext";
import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import DriversTable from "./components/DriversTable";
import DriverForm from "./components/DriverForm";
import DriverSearch from "./components/DriverSearch";
import DriverRentModal from "@/app/carrier-trips/components/DriverRentModal";

export default function DriversPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDriver, setEditingDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [showDriverRentModal, setShowDriverRentModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const { user } = useUser();
  
  const queryClient = useQueryClient();

  const { data: driversData, isLoading, error } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getAllDrivers({}),
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

  const handleSearchChange = (value) => {
    setSearchQuery(value);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
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
          className="px-2.5 py-1.5 bg-stone-50 text-gray-700 border border-gray-300 rounded-md hover:bg-stone-100 flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Driver
        </button>
      </div>

      <DriverSearch searchQuery={searchQuery} onSearchChange={handleSearchChange} />

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
        <DriversTable
          drivers={filteredDrivers}
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
