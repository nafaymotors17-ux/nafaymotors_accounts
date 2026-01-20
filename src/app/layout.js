import "./globals.css";
import { Inter } from "next/font/google";
import TabNavigation from "./components/TabNavigation";
import { UserProvider } from "./components/UserContext";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Enterprise System",
  description: "Modular business management system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider>
          {/* Global navbar - will be conditionally rendered in TabNavigation */}
          <nav className="bg-white border-b shadow-sm fixed top-0 left-0 right-0 z-50">
            <div className="container mx-auto px-6 py-4">
              <div className="text-lg font-bold text-gray-800 mb-2">
                Enterprise System
              </div>
              <TabNavigation />
            </div>
          </nav>
          <main className="min-h-screen bg-gray-100 pt-24">{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
