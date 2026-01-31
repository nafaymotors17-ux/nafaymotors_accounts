import "./globals.css";
import { Inter } from "next/font/google";
import ConditionalNavigation from "./components/ConditionalNavigation";
import ConditionalMain from "./components/ConditionalMain";
import { UserProvider } from "./components/UserContext";
import { QueryProvider } from "./components/QueryProvider";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Enterprise System",
  description: "Modular business management system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <UserProvider>
            {/* Global navbar - conditionally rendered based on route */}
            <ConditionalNavigation />
            <ConditionalMain>{children}</ConditionalMain>
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
