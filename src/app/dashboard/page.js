"use server";
import Link from "next/link";
import { getAccountsCount } from "../lib/accounting-actions/accounts";
import { getAllCarriers } from "../lib/carriers-actions/carriers";
import { getFilteredCars } from "../lib/carriers-actions/cars";
import { getSession } from "../lib/auth/getSession";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }

  // Only fetch accounts count if user is super admin
  const totalAccounts = session.role === "super_admin" ? await getAccountsCount() : 0;
  
  // Get user's own data (or all if super admin)
  const carriersResult = await getAllCarriers({ limit: 5 });
  const carriers = carriersResult.carriers || [];
  
  // Get user's own cars (or all if super admin)
  const recentCarsResult = await getFilteredCars({});
  const recentCars = recentCarsResult.cars || [];
  
  // Calculate totals
  const totalCars = recentCars.length;
  const totalAmount = recentCars.reduce((sum, car) => sum + (car.amount || 0), 0);

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
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Cars</h3>
          <p className="text-2xl font-bold text-gray-800">{totalCars}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Amount</h3>
          <p className="text-2xl font-bold text-green-600">
            R {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Active Trips</h3>
          <p className="text-2xl font-bold text-blue-600">{carriers.length}</p>
          <Link
            href="/carriers"
            className="text-xs text-blue-600 hover:text-blue-700 underline mt-1 inline-block"
          >
            View All
          </Link>
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
                      {carrier.carCount || 0} cars • R {((carrier.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 }))}
                    </p>
                  </div>
                  <Link
                    href={`/carriers?carrier=${carrier._id}`}
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
              href="/carriers"
              className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 font-medium text-sm transition-colors"
            >
              View All Carriers
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
