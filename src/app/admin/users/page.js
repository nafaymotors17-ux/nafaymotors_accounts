"use server";

import { redirect } from "next/navigation";
import { getAllUsers } from "@/app/lib/users-actions/users";
import { requireSuperAdmin } from "@/app/lib/auth/getSession";
import UserManagement from "./UserManagement";

export default async function UsersPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    redirect("/dashboard");
  }

  const usersResult = await getAllUsers();
  const users = usersResult.users || [];

  return <UserManagement users={users} />;
}
