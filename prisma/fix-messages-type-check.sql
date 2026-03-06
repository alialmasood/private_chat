-- إصلاح قيد message_type ليشمل "gif"
-- الخطأ: new row for relation "messages" violates check constraint "messages_type_check"
-- التشغيل: npx prisma db execute --file prisma/fix-messages-type-check.sql

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (message_type IN ('text', 'voice', 'image', 'sticker', 'gif'));
