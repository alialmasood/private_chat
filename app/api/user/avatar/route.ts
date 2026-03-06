import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** POST: رفع صورة المستخدم الشخصية */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let file: File;
  try {
    const formData = await request.formData();
    file = formData.get("avatar") as File;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم إرسال ملف صورة" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "حجم الصورة يجب أن يكون أقل من 2 ميجابايت" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم (استخدم jpeg أو png أو webp)" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const dir = path.join(process.cwd(), "public", "avatars");
  const filename = `${userId}.${ext}`;
  const filepath = path.join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));
  } catch (e) {
    console.error("Avatar write error:", e);
    return NextResponse.json({ error: "فشل حفظ الصورة" }, { status: 500 });
  }

  const avatarUrl = `/avatars/${filename}`;
  try {
    await db.updateUserAvatar(userId, avatarUrl);
  } catch (e) {
    console.error("Avatar DB update error:", e);
    return NextResponse.json({ error: "فشل تحديث الملف الشخصي" }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
