// app/accounting/components/AccountForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount } from "@/app/lib/accounting-actions/accounts";

export default function AccountForm({ onClose }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.target);

    try {
      const result = await createAccount(formData);

      if (result.success) {
        router.refresh(); // Refresh the page to show new account
        onClose();
      } else {
        setError(result.error || "Failed to create account");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Create Account</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isSubmitting}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., OS Motors ZAR"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *
            </label>
            <input
              type="text"
              name="slug"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., os_motors_zar"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Balance *
            </label>
            <input
              type="number"
              step="0.01"
              name="initialBalance"
              required
              defaultValue="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency *
            </label>
            <input
              type="text"
              name="currency"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., ZAR"
              defaultValue="ZAR"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency Symbol *
            </label>
            <input
              type="text"
              name="currencySymbol"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., R"
              defaultValue="R"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
