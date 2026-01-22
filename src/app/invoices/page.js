import { getInvoices } from "@/app/lib/invoice-actions/invoices";
import { getAllCompanies } from "@/app/lib/carriers-actions/companies";
import InvoicesTable from "./components/InvoicesTable";

export default async function InvoicesPage({ searchParams }) {
  const params = await searchParams;
  const [invoicesResult, companiesResult] = await Promise.all([
    getInvoices(params),
    getAllCompanies(),
  ]);
  
  const invoices = invoicesResult.invoices || [];
  const pagination = invoicesResult.pagination;
  const companies = companiesResult.companies || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
        <p className="text-gray-600 mt-2">View and manage all your invoices</p>
      </div>

      <InvoicesTable invoices={invoices} pagination={pagination} companies={companies} />
    </div>
  );
}
