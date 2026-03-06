"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export type CreateUserState = { error?: string; success?: string };

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const userId = await getCurrentUserId();
  const allUsers = await db.getAllUsers();
  // السماح بإنشاء المستخدم إذا كان المستخدم مسجلاً أو لا يوجد مستخدمون بعد
  if (allUsers.length > 0 && !userId) {
    redirect("/login");
  }

  const username = formData.get("username")?.toString().trim();
  const displayNameAr = formData.get("displayNameAr")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!username || !displayNameAr || !password) {
    return { error: "يرجى تعبئة جميع الحقول" };
  }

  if (password.length < 6) {
    return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
  }

  try {
    await db.createUser({ username, displayNameAr, password });
    revalidatePath("/admin");
    return { success: "تم إنشاء المستخدم بنجاح" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "حدث خطأ";
    return { error: message };
  }
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const currentUserId = await getCurrentUserId();
  const allUsers = await db.getAllUsers();
  if (allUsers.length > 0 && !currentUserId) redirect("/login");
  const userId = formData.get("userId")?.toString();
  if (!userId) return;
  await db.deleteUser(userId);
  revalidatePath("/admin");
}
