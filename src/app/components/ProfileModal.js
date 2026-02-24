"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/app/components/UserContext";
import { updateOwnProfile } from "@/app/lib/users-actions/users";
import { X } from "lucide-react";

export default function ProfileModal({ open, onClose }) {
  const { fullUserData, refetchUser, setUser } = useUser();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && fullUserData) {
      setUsername(fullUserData.username || "");
      setName(fullUserData.name || "");
      setAddress(fullUserData.address || "");
      setBankDetails(fullUserData.bankDetails || "");
      setPassword("");
      setMessage(null);
      setError(null);
    }
  }, [open, fullUserData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.target);
      const result = await updateOwnProfile(formData);
      if (result.success) {
        setMessage("Profile updated successfully.");
        setPassword("");
        await refetchUser();
        if (result.user?.username && setUser) {
          setUser((prev) => (prev ? { ...prev, username: result.user.username } : null));
        }
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (err) {
      setError(err?.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Update your account details. Leave password blank to keep your current password.
          </p>
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Login username"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your name (e.g. for invoices)"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password <span className="text-gray-500 font-normal">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your address (e.g. for invoices)"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank details</label>
            <textarea
              name="bankDetails"
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Bank details (e.g. for invoices)"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
