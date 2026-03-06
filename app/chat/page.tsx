import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  await db.getOrCreateConversation();
  const conversation = await db.getConversationForUser(userId);

  const otherUser = conversation
    ? conversation.user1_id === userId
      ? conversation.users_conversation_user2_idTousers
      : conversation.users_conversation_user1_idTousers
    : null;

  if (!conversation) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-900 text-white px-5">
        <div className="text-center max-w-[360px]">
          <h1 className="text-xl font-bold">الدردشة</h1>
          <p className="text-slate-400 mt-2">
            يجب وجود مستخدمين اثنين في النظام لبدء المحادثة. أنشئ المستخدم الثاني من صفحة الإدارة.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 text-emerald-400 hover:text-emerald-300"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const lastSeen = otherUser?.last_seen ?? null;
  const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
  const initialOnline =
    lastSeen && new Date(lastSeen).getTime() > Date.now() - ONLINE_THRESHOLD_MS;
  const initialStatus = initialOnline ? "online" : "offline";
  const initialLastSeen = lastSeen ? new Date(lastSeen).toISOString() : null;

  type MessageRow = (typeof conversation.messages)[number];
  const toReactions = (rows: { user_id: string; emoji: string }[]) => {
    const map: Record<string, { count: number; userIds: string[] }> = {};
    for (const r of rows) {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, userIds: [] };
      map[r.emoji].count++;
      map[r.emoji].userIds.push(r.user_id);
    }
    return Object.entries(map).map(([emoji, { count, userIds }]) => ({ emoji, count, userIds }));
  };
  const messages = conversation.messages.map((m) => {
    const msg = m as MessageRow & { reply_to?: { id: string; content: string; message_type: string; deleted_at: Date | null; users: { full_name: string | null; username: string | null } } | null };
    const replyTo = msg.reply_to;
    return {
      id: msg.id,
      content: msg.content,
      senderId: msg.sender_id,
      sentAt: msg.sent_at.toISOString(),
      senderName: (msg.users?.full_name ?? msg.users?.username) ?? "مستخدم",
      isRead: msg.is_read,
      messageType: msg.message_type || "text",
      isDeleted: !!msg.deleted_at,
      hiddenByMe: false,
      reactions: toReactions((msg as { message_reactions: { user_id: string; emoji: string }[] }).message_reactions ?? []),
      replyTo: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.deleted_at ? "" : (String(replyTo.content).slice(0, 100)),
            messageType: replyTo.message_type,
            senderName: (replyTo.users?.full_name ?? replyTo.users?.username) ?? "مستخدم",
            isDeleted: !!replyTo.deleted_at,
          }
        : undefined,
    };
  });

  return (
    <ChatClient
      conversationId={conversation.id}
      currentUserId={userId}
      otherUserId={otherUser?.id ?? ""}
      otherUserName={otherUser?.full_name ?? otherUser?.username ?? "المستخدم الآخر"}
      otherUserAvatarUrl={otherUser?.avatar_url ?? null}
      otherUserStatus={initialStatus}
      otherUserLastSeen={initialLastSeen}
      messages={messages}
    />
  );
}
