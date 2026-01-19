import "./globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Enterprise System",
  description: "Modular business management system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Global navbar can go here later */}
        <nav className="bg-white border-b shadow-sm fixed top-0 left-0 right-0 z-50">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-lg font-bold text-gray-800">
              Enterprise System
            </div>
          </div>
          <div className="flex gap-6 text-sm font-medium">
            <Link href="/dashboard" className="hover:text-blue-600">
              Dashboard
            </Link>
            <Link href="/accounting" className="hover:text-blue-600">
              Accounts
            </Link>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-100 pt-16">{children}</main>
      </body>
    </html>
  );
}
