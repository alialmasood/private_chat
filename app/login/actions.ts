"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword, setSession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const login = formData.get("login")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!login || !password) {
    return { error: "يرجى إدخال اسم المستخدم وكلمة المرور" };
  }

  const user = await db.findUserByLogin(login);
  if (!user) {
    return { error: "بيانات الدخول غير صحيحة" };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { error: "بيانات الدخول غير صحيحة" };
  }

  await setSession(user.id);
  redirect("/chat");
}
