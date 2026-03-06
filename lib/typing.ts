/**
 * تخزين مؤقت لحالة الكتابة (في الذاكرة)
 * userId -> آخر وقت كتابة (timestamp)
 */
const typingUntil = new Map<string, number>();
const TYPING_TTL_MS = 4000;

export function setTyping(userId: string): void {
  typingUntil.set(userId, Date.now() + TYPING_TTL_MS);
}

export function isTyping(userId: string): boolean {
  const until = typingUntil.get(userId);
  return until != null && until > Date.now();
}
