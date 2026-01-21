// app/carriers/page.jsx
import { getAllCarriers } from "@/app/lib/carriers-actions/carriers";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import { getAllUsersForSelection } from "@/app/lib/users-actions/users";
import { getSession } from "@/app/lib/auth/getSession";
import SimpleCarriersTable from "./components/SimpleCarriersTable";
import CompactFilters from "./components/CompactFilters";

export default async function CarriersPage({ searchParams }) {
  const params = await searchParams;
  const session = await getSession();
  
  // Get data
  const [carriersResult, companiesResult, usersResult] = await Promise.all([
    getAllCarriers(params),
    getAllCompanies(),
    session?.role === "super_admin" ? getAllUsersForSelection() : Promise.resolve({ success: false, users: [] }),
  ]);
  const carriers = carriersResult.carriers || [];
  const companies = companiesResult.companies || [];
  const users = usersResult.users || [];
  const pagination = carriersResult.pagination;

  // Calculate totals from all carriers
  const totalCars = carriers.reduce((sum, c) => sum + (c.carCount || 0), 0);
  const totalAmount = carriers.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards - Top level stats shown first */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Cars</p>
            <p className="text-lg font-bold text-gray-800">{totalCars}</p>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Amount</p>
            <p className="text-lg font-bold text-green-600">
              ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-[10px] text-gray-500 mb-0.5">Total Trips</p>
            <p className="text-lg font-bold text-blue-600">{pagination?.total || carriers.length}</p>
          </div>
        </div>

        {/* Compact Filters */}
        <CompactFilters 
          companies={companies} 
          carriers={carriers} 
          isSuperAdmin={session?.role === "super_admin"}
          users={users}
        />

        {/* Simple Carriers Table */}
        <SimpleCarriersTable 
          carriers={carriers} 
          companies={companies}
          users={users}
          pagination={pagination}
          isSuperAdmin={session?.role === "super_admin"}
        />
      </div>
    </div>
  );
}
