import { prisma } from "./prisma";
import { hashPassword } from "./auth";

const MAX_USERS = 2;

export const db = {
  async createUser(data: { username: string; displayNameAr: string; password: string }) {
    const count = await prisma.users.count();
    if (count >= MAX_USERS) {
      throw new Error("لا يُسمح إلا بمستخدمين اثنين فقط في النظام");
    }
    const usernameNorm = data.username.trim();
    const displayNameAr = data.displayNameAr.trim();
    const existing = await prisma.users.findFirst({
      where: { username: { equals: usernameNorm, mode: "insensitive" } },
    });
    if (existing) {
      throw new Error("اسم المستخدم مستخدم بالفعل");
    }
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.users.create({
      data: {
        full_name: displayNameAr,
        username: usernameNorm,
        email: null,
        password_hash: passwordHash,
      },
    });
    return user;
  },

  async findUserById(id: string) {
    return prisma.users.findUnique({
      where: { id },
    });
  },

  /** البحث باسم المستخدم فقط (المصادقة بالاسم وكلمة المرور) */
  async findUserByLogin(username: string) {
    const normalized = username.trim();
    if (!normalized) return null;
    return prisma.users.findFirst({
      where: { username: { equals: normalized, mode: "insensitive" } },
    });
  },

  async getAllUsers() {
    return prisma.users.findMany({
      orderBy: { created_at: "desc" },
    });
  },

  async getUserCount() {
    return prisma.users.count();
  },

  async deleteUser(id: string) {
    await prisma.users.delete({ where: { id } });
  },

  /** تحديث صورة المستخدم (مسار الصورة بعد الرفع) */
  async updateUserAvatar(userId: string, avatarUrl: string) {
    await prisma.users.update({
      where: { id: userId },
      data: { avatar_url: avatarUrl, updated_at: new Date() },
    });
  },

  /** الحصول على المحادثة الوحيدة (بين المستخدمين الاثنين) أو إنشاؤها */
  async getOrCreateConversation() {
    const users = await prisma.users.findMany({ orderBy: { created_at: "asc" }, take: 2 });
    if (users.length < 2) return null;
    const [u1, u2] = users;
    let conv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1_id: u1.id, user2_id: u2.id },
          { user1_id: u2.id, user2_id: u1.id },
        ],
      },
      include: { messages: { orderBy: { sent_at: "asc" } } },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: { user1_id: u1.id, user2_id: u2.id },
        include: { messages: true },
      });
    }
    return conv;
  },

  /** محادثة المستخدم الحالي (إن وُجدت) */
  async getConversationForUser(userId: string) {
    return prisma.conversation.findFirst({
      where: {
        OR: [{ user1_id: userId }, { user2_id: userId }],
      },
      include: {
        messages: {
          orderBy: { sent_at: "asc" },
          include: {
            users: { select: { id: true, username: true, full_name: true } },
            message_reactions: { select: { user_id: true, emoji: true } },
            reply_to: {
              select: {
                id: true,
                content: true,
                message_type: true,
                sender_id: true,
                deleted_at: true,
                users: { select: { full_name: true, username: true } },
              },
            },
          },
        },
        users_conversation_user1_idTousers: true,
        users_conversation_user2_idTousers: true,
      },
    });
  },

  async getMessages(conversationId: string) {
    return prisma.messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { sent_at: "asc" },
      include: {
        users: { select: { id: true, username: true, full_name: true } },
        message_reactions: { select: { user_id: true, emoji: true } },
        reply_to: {
          select: {
            id: true,
            content: true,
            message_type: true,
            sender_id: true,
            deleted_at: true,
            users: { select: { full_name: true, username: true } },
          },
        },
      },
    });
  },

  /** إضافة أو تغيير تفاعل المستخدم على رسالة */
  async setMessageReaction(messageId: string, userId: string, emoji: string) {
    await prisma.message_reactions.upsert({
      where: {
        message_id_user_id: { message_id: messageId, user_id: userId },
      },
      create: { message_id: messageId, user_id: userId, emoji },
      update: { emoji },
    });
  },

  /** إزالة تفاعل المستخدم من رسالة */
  async removeMessageReaction(messageId: string, userId: string) {
    await prisma.message_reactions.deleteMany({
      where: { message_id: messageId, user_id: userId },
    });
  },

  async getMessageById(messageId: string) {
    return prisma.messages.findUnique({
      where: { id: messageId },
      select: { id: true, conversation_id: true, sender_id: true, sent_at: true, deleted_at: true },
    });
  },

  async createMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: "text" | "voice" | "image" | "sticker" | "gif" = "text",
    replyToMessageId?: string | null
  ) {
    return prisma.messages.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        content: ["text"].includes(messageType) ? content.trim() : content,
        message_type: messageType,
        reply_to_message_id: replyToMessageId ?? undefined,
      },
      include: {
        users: { select: { id: true, username: true, full_name: true } },
        reply_to: {
          select: {
            id: true,
            content: true,
            message_type: true,
            sender_id: true,
            users: { select: { full_name: true, username: true } },
          },
        },
      },
    });
  },

  async deleteConversationMessages(conversationId: string) {
    await prisma.messages.deleteMany({
      where: { conversation_id: conversationId },
    });
  },

  /** مسح المحادثة من عندي فقط: إخفاء جميع الرسائل للمستخدم الحالي */
  async hideAllMessagesForUser(userId: string, conversationId: string) {
    const msgs = await prisma.messages.findMany({
      where: { conversation_id: conversationId },
      select: { id: true },
    });
    if (msgs.length === 0) return;
    await prisma.message_hidden.createMany({
      data: msgs.map((m) => ({ user_id: userId, message_id: m.id })),
      skipDuplicates: true,
    });
  },

  /** حذف الوسائط فقط (من عندي): إخفاء رسائل الصوت والصورة والملصقات والـ GIF للمستخدم الحالي */
  async hideMediaMessagesForUser(userId: string, conversationId: string) {
    const mediaMsgs = await prisma.messages.findMany({
      where: {
        conversation_id: conversationId,
        message_type: { in: ["voice", "image", "sticker", "gif"] },
      },
      select: { id: true },
    });
    await prisma.message_hidden.createMany({
      data: mediaMsgs.map((m) => ({ user_id: userId, message_id: m.id })),
      skipDuplicates: true,
    });
  },

  /** معرفات الرسائل المخفاة «من عندي فقط» للمستخدم في هذه المحادثة */
  async getHiddenMessageIdsForUser(userId: string, conversationId: string): Promise<Set<string>> {
    const rows = await prisma.message_hidden.findMany({
      where: { user_id: userId, messages: { conversation_id: conversationId } },
      select: { message_id: true },
    });
    return new Set(rows.map((r) => r.message_id));
  },

  /** حذف من عندي فقط: إخفاء الرسالة عن المستخدم الحالي */
  async hideMessageForUser(userId: string, messageId: string) {
    await prisma.message_hidden.upsert({
      where: {
        user_id_message_id: { user_id: userId, message_id: messageId },
      },
      create: { user_id: userId, message_id: messageId },
      update: {},
    });
  },

  /** حذف من المحادثة بالكامل (للجميع) - مسموح للمرسل فقط وفي وقت محدد (مثلاً 15 دقيقة) */
  async deleteMessageForEveryone(messageId: string, userId: string): Promise<"ok" | "forbidden" | "expired"> {
    const msg = await prisma.messages.findUnique({
      where: { id: messageId },
      select: { sender_id: true, sent_at: true, deleted_at: true },
    });
    if (!msg) return "forbidden";
    if (msg.sender_id !== userId) return "forbidden";
    if (msg.deleted_at) return "ok";
    const DELETE_FOR_EVERYONE_LIMIT_MS = 15 * 60 * 1000;
    if (Date.now() - msg.sent_at.getTime() > DELETE_FOR_EVERYONE_LIMIT_MS) return "expired";
    await prisma.messages.update({
      where: { id: messageId },
      data: { deleted_at: new Date() },
    });
    return "ok";
  },

  /** تحديث وقت آخر ظهور للمستخدم (عند فتح المحادثة أو الاستطلاع) */
  async updateLastSeen(userId: string) {
    await prisma.users.update({
      where: { id: userId },
      data: { last_seen: new Date() },
    });
  },

  /** تعليم رسائل المحادثة كمقروءة عند فتح المستلم للمحادثة */
  async markMessagesAsReadByRecipient(conversationId: string, recipientUserId: string) {
    await prisma.messages.updateMany({
      where: {
        conversation_id: conversationId,
        sender_id: { not: recipientUserId },
      },
      data: { is_read: true },
    });
  },
};
