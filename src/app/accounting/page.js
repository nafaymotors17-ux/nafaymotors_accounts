// app/accounting/page.jsx
import { getAccounts } from "@/lib/accounting-actions/accounts";
import AccountsTable from "./components/AccountsTable";

export default async function AccountingPage({ searchParams }) {
  const params = searchParams;
  const accountsResult = await getAccounts(params);
  const accounts = accountsResult.accounts || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Accounts</h1>
        </div>

        {/* Pass accounts as prop, let client handle modals */}
        <AccountsTable accounts={accounts} />
      </div>
    </div>
  );
}
