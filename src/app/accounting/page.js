// app/accounting/page.jsx
import { getAccounts } from "@/app/lib/accounting-actions/accounts";
import { requireSuperAdmin } from "@/app/lib/auth/getSession";
import { redirect } from "next/navigation";
import AccountsTable from "./components/AccountsTable";
import AccountFilters from "./components/AccountFilters";

export default async function AccountingPage({ searchParams }) {
  try {
    // Check if user is super admin - redirect if not
    await requireSuperAdmin();
  } catch (error) {
    // Log the error for debugging
    console.error("[AccountingPage] Access denied:", error.message);
    // If not super admin, redirect to dashboard
    redirect("/dashboard");
  }

  const params = await searchParams;
  const accountsResult = await getAccounts(params);
  const accounts = accountsResult.accounts || [];
  const pagination = accountsResult.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  // Build query string for pagination links
  const searchQuery = params.search ? `&search=${encodeURIComponent(params.search)}` : "";
  const currencyQuery = params.currency && params.currency !== "all" ? `&currency=${encodeURIComponent(params.currency)}` : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Accounts</h1>
        </div>

        <AccountFilters accounts={accounts} />

        <AccountsTable accounts={accounts} />

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-700">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} accounts
            </div>
            <div className="flex gap-2">
              <a
                href={`/accounting?page=1${searchQuery}${currencyQuery}`}
                className={`px-4 py-2 border border-gray-300 rounded-md ${!pagination.hasPrevPage ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:bg-gray-50"}`}
              >
                First
              </a>
              <a
                href={`/accounting?page=${pagination.page - 1}${searchQuery}${currencyQuery}`}
                className={`px-4 py-2 border border-gray-300 rounded-md ${!pagination.hasPrevPage ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:bg-gray-50"}`}
              >
                Previous
              </a>
              <span className="px-4 py-2 text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <a
                href={`/accounting?page=${pagination.page + 1}${searchQuery}${currencyQuery}`}
                className={`px-4 py-2 border border-gray-300 rounded-md ${!pagination.hasNextPage ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:bg-gray-50"}`}
              >
                Next
              </a>
              <a
                href={`/accounting?page=${pagination.totalPages}${searchQuery}${currencyQuery}`}
                className={`px-4 py-2 border border-gray-300 rounded-md ${!pagination.hasNextPage ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:bg-gray-50"}`}
              >
                Last
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
