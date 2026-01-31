export default function TripDetailLayout({ children }) {
  // This layout doesn't add anything - it's just to override the main padding
  // The root layout will handle providers, and ConditionalNavigation will hide nav
  return <>{children}</>;
}
