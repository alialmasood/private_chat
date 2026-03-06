import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { isTyping } from "@/lib/typing";
import { getIncomingCallForUser } from "@/lib/call-signal";

/** GET: جلب رسائل المحادثة (للاستطلاع التلقائي) */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "معرف المحادثة مطلوب" }, { status: 400 });
  }
  const conv = await db.getConversationForUser(userId);
  if (!conv || conv.id !== conversationId) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }
  const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
  const otherUserTyping = isTyping(otherUserId);
  const incomingCall = getIncomingCallForUser(conversationId, userId);

  await db.updateLastSeen(userId);

  const otherUser =
    conv.user1_id === userId
      ? conv.users_conversation_user2_idTousers
      : conv.users_conversation_user1_idTousers;
  const lastSeen = otherUser?.last_seen ?? null;
  const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
  const isOnline =
    lastSeen && new Date(lastSeen).getTime() > Date.now() - ONLINE_THRESHOLD_MS;
  const otherUserStatus = isOnline ? "online" : "offline";
  const otherUserLastSeen = lastSeen ? new Date(lastSeen).toISOString() : null;

  const [messages, hiddenIds] = await Promise.all([
    db.getMessages(conversationId),
    db.getHiddenMessageIdsForUser(userId, conversationId),
  ]);
  await db.markMessagesAsReadByRecipient(conversationId, userId);
  const list = messages.map((m) => {
    const msg = m as {
      message_reactions?: { user_id: string; emoji: string }[];
      reply_to?: { id: string; content: string; message_type: string; deleted_at: Date | null; users: { full_name: string | null; username: string | null } };
    };
    const reactions = msg.message_reactions ?? [];
    const reactionsMap: Record<string, { count: number; userIds: string[] }> = {};
    for (const r of reactions) {
      if (!reactionsMap[r.emoji]) reactionsMap[r.emoji] = { count: 0, userIds: [] };
      reactionsMap[r.emoji].count++;
      reactionsMap[r.emoji].userIds.push(r.user_id);
    }
    const reactionsList = Object.entries(reactionsMap).map(([emoji, { count, userIds }]) => ({
      emoji,
      count,
      userIds,
    }));
    const replyTo = msg.reply_to;
    return {
      id: m.id,
      content: m.deleted_at ? "" : m.content,
      senderId: m.sender_id,
      sentAt: m.sent_at.toISOString(),
      senderName: (m.users?.full_name ?? m.users?.username) ?? "مستخدم",
      isRead: m.sender_id === userId ? m.is_read : true,
      messageType: m.message_type || "text",
      isDeleted: !!m.deleted_at,
      hiddenByMe: hiddenIds.has(m.id),
      reactions: reactionsList,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.deleted_at ? "" : (replyTo.content?.slice?.(0, 100) ?? String(replyTo.content).slice(0, 100)),
            messageType: replyTo.message_type,
            senderName: (replyTo.users?.full_name ?? replyTo.users?.username) ?? "مستخدم",
            isDeleted: !!replyTo.deleted_at,
          }
        : undefined,
    };
  });
  return NextResponse.json({
    messages: list,
    otherUserTyping,
    otherUserStatus,
    otherUserLastSeen,
    incomingCall: incomingCall
      ? {
          mode: incomingCall.mode,
          fromUserId: incomingCall.fromUserId,
        }
      : null,
  });
}

/** POST: إرسال رسالة جديدة */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  let body: { conversationId?: string; content?: string; messageType?: string; replyToMessageId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const { conversationId, content, messageType, replyToMessageId } = body;
  const isMedia = ["voice", "image", "sticker", "gif"].includes(messageType ?? "");
  if (!conversationId || typeof content !== "string") {
    return NextResponse.json({ error: "المحتوى مطلوب" }, { status: 400 });
  }
  if (!isMedia && !content.trim()) {
    return NextResponse.json({ error: "المحتوى مطلوب" }, { status: 400 });
  }
  const conv = await db.getConversationForUser(userId);
  if (!conv || conv.id !== conversationId) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }
  const type = (isMedia ? messageType : "text") as "text" | "voice" | "image" | "sticker" | "gif";
  let message: Awaited<ReturnType<typeof db.createMessage>>;
  try {
    message = await db.createMessage(
      conversationId,
      userId,
      content,
      type,
      replyToMessageId ?? undefined
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطأ في حفظ الرسالة";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const replyTo = (message as { reply_to?: { id: string; content: string; message_type: string; users: { full_name: string | null; username: string | null } } }).reply_to;
  return NextResponse.json({
    id: message.id,
    content: message.content,
    senderId: message.sender_id,
    sentAt: message.sent_at.toISOString(),
    senderName: (message.users?.full_name ?? message.users?.username) ?? "مستخدم",
    isRead: message.is_read,
    messageType: message.message_type || "text",
    replyTo: replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          messageType: replyTo.message_type,
          senderName: (replyTo.users?.full_name ?? replyTo.users?.username) ?? "مستخدم",
        }
      : undefined,
  });
}

/** DELETE: حذف جميع رسائل المحادثة - من عندي فقط، أو الوسائط، أو للجميع */
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const mediaOnly = request.nextUrl.searchParams.get("mediaOnly") === "true";
  const forMeOnly = request.nextUrl.searchParams.get("forMeOnly") === "true";
  if (!conversationId) {
    return NextResponse.json({ error: "معرف المحادثة مطلوب" }, { status: 400 });
  }
  const conv = await db.getConversationForUser(userId);
  if (!conv || conv.id !== conversationId) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }
  if (mediaOnly) {
    await db.hideMediaMessagesForUser(userId, conversationId);
  } else if (forMeOnly) {
    await db.hideAllMessagesForUser(userId, conversationId);
  } else {
    await db.deleteConversationMessages(conversationId);
  }
  return NextResponse.json({ success: true });
}
