"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDashboardData } from "../lib/dashboard-actions/dashboard";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);
        const result = await getDashboardData();
        
        if (result.error === "Unauthorized") {
          router.push("/login");
          return;
        }
        
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center p-2">
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-full bg-gray-200 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.session) {
    return null;
  }

  const { session, totalAccounts, carriers, stats } = data;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          {session.role === "super_admin" 
            ? "Super Admin - All Data" 
            : `Your Dashboard`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Trips</h3>
          <p className="text-2xl font-bold text-gray-800">{stats.totalTrips}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Active Trips</h3>
          <p className="text-2xl font-bold text-green-600">{stats.activeTrips}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Inactive Trips</h3>
          <p className="text-2xl font-bold text-red-600">{stats.inactiveTrips}</p>
        </div>

        {session.role === "super_admin" && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Accounts</h3>
            <p className="text-2xl font-bold text-gray-800">{totalAccounts}</p>
            <Link
              href="/accounting"
              className="text-xs text-blue-600 hover:text-blue-700 underline mt-1 inline-block"
            >
              View Accounts
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Trips</h2>
          {carriers.length === 0 ? (
            <p className="text-gray-500 text-sm">No trips found</p>
          ) : (
            <div className="space-y-2">
              {carriers.slice(0, 5).map((carrier) => (
                <div key={carrier._id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">
                      {carrier.type === "trip" ? carrier.tripNumber : carrier.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {carrier.carCount || 0} cars • R{((carrier.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 }))}
                    </p>
                  </div>
                  <Link
                    href={`/carrier-trips?carrier=${carrier._id}`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/carrier-trips"
              className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 font-medium text-sm transition-colors"
            >
              View All Carrier Trips
            </Link>
            {session.role === "super_admin" && (
              <Link
                href="/accounting"
                className="block p-3 bg-green-50 hover:bg-green-100 rounded-lg text-green-700 font-medium text-sm transition-colors"
              >
                View Accounting
              </Link>
            )}
            {session.role === "super_admin" && (
              <Link
                href="/admin/users"
                className="block p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 font-medium text-sm transition-colors"
              >
                Manage Users
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
