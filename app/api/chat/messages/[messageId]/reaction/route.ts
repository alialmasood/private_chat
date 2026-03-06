import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

/** DELETE: إزالة تفاعل المستخدم من رسالة */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { messageId } = await params;
  if (!messageId) return NextResponse.json({ error: "معرف الرسالة مطلوب" }, { status: 400 });
  const conv = await db.getConversationForUser(userId);
  if (!conv) return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  const message = await db.getMessageById(messageId);
  if (!message || message.conversation_id !== conv.id) {
    return NextResponse.json({ error: "الرسالة غير موجودة" }, { status: 404 });
  }
  await db.removeMessageReaction(messageId, userId);
  return NextResponse.json({ success: true });
}

/** POST: إضافة أو تغيير تفاعل على رسالة */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { messageId } = await params;
  if (!messageId) {
    return NextResponse.json({ error: "معرف الرسالة مطلوب" }, { status: 400 });
  }

  let body: { emoji?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "تفاعل غير مدعوم" }, { status: 400 });
  }

  const conv = await db.getConversationForUser(userId);
  if (!conv) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }

  const message = await db.getMessageById(messageId);
  if (!message || message.conversation_id !== conv.id) {
    return NextResponse.json({ error: "الرسالة غير موجودة أو لا تخص هذه المحادثة" }, { status: 404 });
  }

  await db.setMessageReaction(messageId, userId, emoji);
  return NextResponse.json({ success: true, emoji });
}
