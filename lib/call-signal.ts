type CallMode = "audio" | "video";

type PendingCall = {
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  mode: CallMode;
  expiresAt: number;
};

const incomingCalls = new Map<string, PendingCall>();
const CALL_TTL_MS = 30_000;

function key(conversationId: string): string {
  return conversationId;
}

function isExpired(call: PendingCall): boolean {
  return call.expiresAt <= Date.now();
}

function cleanupIfExpired(conversationId: string): void {
  const k = key(conversationId);
  const call = incomingCalls.get(k);
  if (!call) return;
  if (isExpired(call)) incomingCalls.delete(k);
}

export function startIncomingCall(
  conversationId: string,
  fromUserId: string,
  toUserId: string,
  mode: CallMode
): void {
  incomingCalls.set(key(conversationId), {
    conversationId,
    fromUserId,
    toUserId,
    mode,
    expiresAt: Date.now() + CALL_TTL_MS,
  });
}

export function getIncomingCallForUser(conversationId: string, userId: string): PendingCall | null {
  cleanupIfExpired(conversationId);
  const call = incomingCalls.get(key(conversationId));
  if (!call) return null;
  if (call.toUserId !== userId) return null;
  return call;
}

export function clearIncomingCall(conversationId: string, userId: string): void {
  const k = key(conversationId);
  const call = incomingCalls.get(k);
  if (!call) return;
  if (call.toUserId !== userId && call.fromUserId !== userId) return;
  incomingCalls.delete(k);
}

