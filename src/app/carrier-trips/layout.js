// Force dynamic rendering - prevents prerender during build
// Server actions (getAllCarriers, getAllCompanies, etc.) require request context and MongoDB
export const dynamic = "force-dynamic";

export default function CarrierTripsLayout({ children }) {
  return <>{children}</>;
}
