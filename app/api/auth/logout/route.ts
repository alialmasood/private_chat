import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

/** POST: تسجيل خروج المستخدم الحالي */
export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

