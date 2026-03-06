import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { setTyping } from "@/lib/typing";

/** POST: تسجيل أن المستخدم يكتب الآن */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  let body: { conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const { conversationId } = body;
  if (!conversationId) {
    return NextResponse.json({ error: "معرف المحادثة مطلوب" }, { status: 400 });
  }
  const conv = await db.getConversationForUser(userId);
  if (!conv || conv.id !== conversationId) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }
  setTyping(userId);
  return NextResponse.json({ ok: true });
}
