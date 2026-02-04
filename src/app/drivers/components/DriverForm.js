"use client";

import { X } from "lucide-react";

export default function DriverForm({
  editingDriver,
  users,
  isSuperAdmin,
  onSubmit,
  onClose,
  createMutation,
  updateMutation,
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex justify-between items-center p-2.5 border-b">
          <h3 className="text-sm font-semibold text-gray-800">
            {editingDriver ? "Edit Driver" : "Add Driver"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-2.5 space-y-2 max-h-[85vh] overflow-y-auto">
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
              onClick={onClose}
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
  );
}
