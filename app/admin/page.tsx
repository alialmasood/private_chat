import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const userId = await getCurrentUserId();
  const users = await db.getAllUsers();

  // إذا لم يوجد أي مستخدم، نسمح بالدخول لإنشاء أول مستخدم
  if (users.length > 0 && !userId) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  const currentUser = userId ? await db.findUserById(userId) : null;

  type UserRow = (typeof users)[number];

  return (
    <div className="min-h-[100dvh] bg-slate-900 text-white">
      <AdminClient
        currentUser={currentUser ?? undefined}
        users={users.map((u: UserRow) => ({
          id: u.id,
          username: u.username ?? "",
          displayNameAr: u.full_name ?? "",
          createdAt: u.created_at.toISOString(),
        }))}
        maxUsersReached={users.length >= 2}
      />
    </div>
  );
}
