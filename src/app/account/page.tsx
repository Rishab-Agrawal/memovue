import { requireHost } from "@/lib/session";

import { AccountScreen } from "./AccountScreen";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireHost();

  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || user.email[0]?.toUpperCase() || "?";

  return (
    <AccountScreen
      name={user.name}
      email={user.email}
      initials={initials}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
