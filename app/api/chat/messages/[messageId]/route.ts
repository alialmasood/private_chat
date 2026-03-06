import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

/** DELETE: حذف رسالة واحدة - إما «من عندي فقط» أو «من المحادثة بالكامل» */
export async function DELETE(
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

  let body: { type?: "for_me" | "for_everyone" };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const type = body.type === "for_everyone" ? "for_everyone" : "for_me";

  const conv = await db.getConversationForUser(userId);
  if (!conv) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }

  const message = await db.getMessageById(messageId);
  if (!message || message.conversation_id !== conv.id) {
    return NextResponse.json({ error: "الرسالة غير موجودة أو لا تخص هذه المحادثة" }, { status: 404 });
  }

  if (type === "for_me") {
    await db.hideMessageForUser(userId, messageId);
    return NextResponse.json({ success: true, hiddenByMe: true });
  }

  const result = await db.deleteMessageForEveryone(messageId, userId);
  if (result === "forbidden") {
    return NextResponse.json({ error: "غير مسموح بحذف هذه الرسالة للجميع" }, { status: 403 });
  }
  if (result === "expired") {
    return NextResponse.json(
      { error: "انتهت المدة المسموح فيها لحذف الرسالة من المحادثة (15 دقيقة)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true, deletedForEveryone: true });
}
