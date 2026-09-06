import { requireHost } from "@/lib/session";

import { AccountScreen } from "./AccountScreen";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireHost();

  return <AccountScreen name={user.name} email={user.email} isAdmin={user.role === "ADMIN"} />;
}
