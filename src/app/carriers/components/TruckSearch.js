"use client";

export default function TruckSearch({ searchQuery, onSearchChange }) {
  return (
    <div className="mb-3">
      <input
        type="text"
        placeholder="Search trucks..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full sm:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
