// app/accounting/components/AccountsTable.jsx
"use client";

import { useState } from "react";
import TransactionForm from "./TransactionForm";
import AccountStatement from "./AccountStatement";
import AccountForm from "./AccountForm";
function formatAmount(amount, symbol) {
  return `${symbol || ""}${(amount ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AccountsTable({ accounts }) {
  // Modal state - all client side now
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        <p>No accounts found. Create your first account to get started.</p>
        <button
          onClick={() => setShowAccountForm(true)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Create Account
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex justify-end">
          <button
            onClick={() => setShowAccountForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Create Account
          </button>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accounts.map((account) => (
              <tr key={account._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{account.title}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    onClick={() => {
                      setSelectedAccount(account);
                      setShowStatement(true);
                    }}
                  >
                    {account.slug}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {account.currency}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {account.currencySymbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {formatAmount(account.currentBalance, account.currencySymbol)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    className="text-green-600 hover:text-green-900 font-medium"
                    onClick={() => {
                      setSelectedAccount(account);
                      setShowTransactionForm(true);
                    }}
                  >
                    Record Transaction
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Client-side modals */}
      {showAccountForm && (
        <AccountForm onClose={() => setShowAccountForm(false)} />
      )}
      {showTransactionForm && selectedAccount && (
        <TransactionForm
          account={selectedAccount}
    
          onClose={() => setShowTransactionForm(false)}
        />
      )}
      {showStatement && selectedAccount && (
        <AccountStatement
          account={selectedAccount}
          onClose={() => setShowStatement(false)}
        />
      )}
    </>
  );
}
