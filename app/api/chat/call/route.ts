import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { clearIncomingCall, startIncomingCall } from "@/lib/call-signal";

type Body = {
  conversationId?: string;
  action?: "start" | "accept" | "decline";
  mode?: "audio" | "video";
};

/** POST: إدارة إشعار الاتصال الوارد (بدء/قبول/رفض) */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { conversationId, action, mode } = body;
  if (!conversationId || !action) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const conv = await db.getConversationForUser(userId);
  if (!conv || conv.id !== conversationId) {
    return NextResponse.json({ error: "المحادثة غير متاحة" }, { status: 403 });
  }

  const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

  if (action === "start") {
    if (mode !== "audio" && mode !== "video") {
      return NextResponse.json({ error: "نوع الاتصال غير صالح" }, { status: 400 });
    }
    startIncomingCall(conversationId, userId, otherUserId, mode);
    return NextResponse.json({ ok: true });
  }

  if (action === "accept" || action === "decline") {
    clearIncomingCall(conversationId, userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
}

