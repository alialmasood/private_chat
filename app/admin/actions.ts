"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type CreateUserState = { error?: string; success?: string };

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
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
  const userId = formData.get("userId")?.toString();
  if (!userId) return;
  await db.deleteUser(userId);
  revalidatePath("/admin");
}
