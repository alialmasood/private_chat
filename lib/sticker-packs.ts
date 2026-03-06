/**
 * حزم الملصقات - تدعم PNG/WebP ثابتة و WebP/GIF متحركة
 * يمكن إضافة حزم جديدة في /public/stickers/ أو روابط CDN
 * مشابه لواتساب: حزم متعددة مع إمكانية التوسع
 */

const TWEMOJI = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72";

export type StickerDef = {
  id: string;
  url: string;
  animated?: boolean;
};

export type StickerPack = {
  id: string;
  name: string;
  stickers: StickerDef[];
};

export const STICKER_PACKS: StickerPack[] = [
  {
    id: "emoji-faces",
    name: "الوجوه",
    stickers: [
      { id: "1f600", url: `${TWEMOJI}/1f600.png` },
      { id: "1f601", url: `${TWEMOJI}/1f601.png` },
      { id: "1f602", url: `${TWEMOJI}/1f602.png` },
      { id: "1f603", url: `${TWEMOJI}/1f603.png` },
      { id: "1f604", url: `${TWEMOJI}/1f604.png` },
      { id: "1f605", url: `${TWEMOJI}/1f605.png` },
      { id: "1f606", url: `${TWEMOJI}/1f606.png` },
      { id: "1f607", url: `${TWEMOJI}/1f607.png` },
      { id: "1f608", url: `${TWEMOJI}/1f608.png` },
      { id: "1f609", url: `${TWEMOJI}/1f609.png` },
      { id: "1f60a", url: `${TWEMOJI}/1f60a.png` },
      { id: "1f60b", url: `${TWEMOJI}/1f60b.png` },
      { id: "1f60c", url: `${TWEMOJI}/1f60c.png` },
      { id: "1f60d", url: `${TWEMOJI}/1f60d.png` },
      { id: "1f60e", url: `${TWEMOJI}/1f60e.png` },
    ],
  },
  {
    id: "hearts",
    name: "القلوب",
    stickers: [
      { id: "2764", url: `${TWEMOJI}/2764.png` },
      { id: "1f495", url: `${TWEMOJI}/1f495.png` },
      { id: "1f496", url: `${TWEMOJI}/1f496.png` },
      { id: "1f497", url: `${TWEMOJI}/1f497.png` },
      { id: "1f498", url: `${TWEMOJI}/1f498.png` },
      { id: "1f499", url: `${TWEMOJI}/1f499.png` },
      { id: "1f49a", url: `${TWEMOJI}/1f49a.png` },
      { id: "1f49b", url: `${TWEMOJI}/1f49b.png` },
      { id: "1f49c", url: `${TWEMOJI}/1f49c.png` },
    ],
  },
  {
    id: "gestures",
    name: "الإيماءات",
    stickers: [
      { id: "1f44d", url: `${TWEMOJI}/1f44d.png` },
      { id: "1f44e", url: `${TWEMOJI}/1f44e.png` },
      { id: "1f44f", url: `${TWEMOJI}/1f44f.png` },
      { id: "1f64c", url: `${TWEMOJI}/1f64c.png` },
      { id: "1f64f", url: `${TWEMOJI}/1f64f.png` },
      { id: "1f91d", url: `${TWEMOJI}/1f91d.png` },
      { id: "270c", url: `${TWEMOJI}/270c.png` },
      { id: "1f4aa", url: `${TWEMOJI}/1f4aa.png` },
    ],
  },
  {
    id: "animals",
    name: "الحيوانات",
    stickers: [
      { id: "1f436", url: `${TWEMOJI}/1f436.png` },
      { id: "1f431", url: `${TWEMOJI}/1f431.png` },
      { id: "1f42d", url: `${TWEMOJI}/1f42d.png` },
      { id: "1f430", url: `${TWEMOJI}/1f430.png` },
      { id: "1f98a", url: `${TWEMOJI}/1f98a.png` },
      { id: "1f43b", url: `${TWEMOJI}/1f43b.png` },
      { id: "1f428", url: `${TWEMOJI}/1f428.png` },
      { id: "1f42f", url: `${TWEMOJI}/1f42f.png` },
      { id: "1f984", url: `${TWEMOJI}/1f984.png` },
      { id: "1f993", url: `${TWEMOJI}/1f993.png` },
    ],
  },
  {
    id: "food",
    name: "الطعام",
    stickers: [
      { id: "1f355", url: `${TWEMOJI}/1f355.png` },
      { id: "1f354", url: `${TWEMOJI}/1f354.png` },
      { id: "1f37f", url: `${TWEMOJI}/1f37f.png` },
      { id: "1f368", url: `${TWEMOJI}/1f368.png` },
      { id: "1f366", url: `${TWEMOJI}/1f366.png` },
      { id: "1f382", url: `${TWEMOJI}/1f382.png` },
      { id: "2615", url: `${TWEMOJI}/2615.png` },
      { id: "1f375", url: `${TWEMOJI}/1f375.png` },
      { id: "1f36a", url: `${TWEMOJI}/1f36a.png` },
    ],
  },
  {
    id: "activities",
    name: "الأنشطة",
    stickers: [
      { id: "26bd", url: `${TWEMOJI}/26bd.png` },
      { id: "1f3c0", url: `${TWEMOJI}/1f3c0.png` },
      { id: "1f3be", url: `${TWEMOJI}/1f3be.png` },
      { id: "1f3b8", url: `${TWEMOJI}/1f3b8.png` },
      { id: "1f3ae", url: `${TWEMOJI}/1f3ae.png` },
      { id: "1f4f7", url: `${TWEMOJI}/1f4f7.png` },
      { id: "1f4fa", url: `${TWEMOJI}/1f4fa.png` },
      { id: "1f4fb", url: `${TWEMOJI}/1f4fb.png` },
    ],
  },
  {
    id: "objects",
    name: "الأشياء",
    stickers: [
      { id: "1f4a1", url: `${TWEMOJI}/1f4a1.png` },
      { id: "1f4a2", url: `${TWEMOJI}/1f4a2.png` },
      { id: "1f389", url: `${TWEMOJI}/1f389.png` },
      { id: "1f38a", url: `${TWEMOJI}/1f38a.png` },
      { id: "2764", url: `${TWEMOJI}/2764.png` },
      { id: "1f49e", url: `${TWEMOJI}/1f49e.png` },
      { id: "1f48e", url: `${TWEMOJI}/1f48e.png` },
      { id: "1f4da", url: `${TWEMOJI}/1f4da.png` },
    ],
  },
];

/**
 * لإضافة حزم جديدة:
 * - ثابتة: أضف كائنًا جديدًا إلى STICKER_PACKS (مثل أعلاه)
 * - من ملفات محلية: ضع الصور في /public/stickers/ واستخدم url: "/stickers/اسم الملف.png"
 * - متحركة: أضف animated: true للعناصر من نوع GIF/WebP
 */
