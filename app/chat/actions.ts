"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export type SendMessageState = { error?: string };

export async function sendMessageAction(
  _prev: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "يجب تسجيل الدخول" };

  const conversationId = formData.get("conversationId")?.toString();
  const content = formData.get("content")?.toString()?.trim();

  if (!conversationId || !content) {
    return { error: "المحتوى مطلوب" };
  }

  const conv = await db.getConversationForUser(userId);
  if (!conv || conv.id !== conversationId) {
    return { error: "المحادثة غير متاحة" };
  }

  await db.createMessage(conversationId, userId, content);
  revalidatePath("/chat");
  return {};
}
