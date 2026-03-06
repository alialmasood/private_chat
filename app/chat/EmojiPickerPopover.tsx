"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";

const Picker = dynamic(() => import("@emoji-mart/react"), { ssr: false });

type EmojiSelection = { native?: string; id?: string; [key: string]: unknown };

const STORAGE_RECENT = "chat_emoji_recent";
const STORAGE_FAVORITES = "chat_emoji_favorites";
const STORAGE_SKIN = "chat_emoji_skin";
const MAX_RECENT = 24;
const MAX_FAVORITES = 20;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(STORAGE_RECENT);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_RECENT, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

function loadFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(STORAGE_FAVORITES);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveFavorites(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(list.slice(0, MAX_FAVORITES)));
  } catch {}
}

function loadSkin(): string {
  if (typeof window === "undefined") return "1";
  try {
    return localStorage.getItem(STORAGE_SKIN) || "1";
  } catch {
    return "1";
  }
}

function saveSkin(skin: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_SKIN, skin);
  } catch {}
}

function nativeToCustom(id: string, native: string) {
  return { id: `custom_${id}`, name: id, keywords: [], skins: [{ native }] };
}

const AR_I18N = {
  search: "البحث",
  search_no_results_1: "لا توجد نتائج",
  search_no_results_2: "جرّب كلمات أخرى",
  pick: "اختر إيموجي",
  categories: {
    frequent: "آخر المستخدمة",
    people: "الوجوه",
    nature: "الحيوانات",
    foods: "الطعام",
    activity: "الأنشطة",
    places: "السفر",
    objects: "الأشياء",
    symbols: "الرموز",
    flags: "الأعلام",
    custom: "المفضلة",
    search: "نتائج البحث",
  },
  skins: {
    choose: "اختر لون البشرة",
    "1": "افتراضي",
    "2": "فاتح",
    "3": "فاتح متوسط",
    "4": "متوسط",
    "5": "داكن متوسط",
    "6": "داكن",
  },
};

type Props = {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
};

export function EmojiPickerPopover({ onSelect, onClose }: Props) {
  const [recent, setRecent] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [skin, setSkin] = useState("1");

  useEffect(() => {
    setRecent(loadRecent());
    setFavorites(loadFavorites());
    setSkin(loadSkin());
  }, []);

  const lastClickRef = useRef<{ native: string; ts: number } | null>(null);

  const handleSelectWithFavorites = useCallback(
    (emojiData: EmojiSelection) => {
      const native = "native" in emojiData ? String(emojiData.native) : "";
      if (!native) return;
      const now = Date.now();
      const last = lastClickRef.current;
      if (last?.native === native && now - last.ts < 400) {
        lastClickRef.current = null;
        setFavorites((prev) => {
          const next = prev.includes(native)
            ? prev.filter((e) => e !== native)
            : [native, ...prev].slice(0, MAX_FAVORITES);
          saveFavorites(next);
          return next;
        });
        return;
      }
      lastClickRef.current = { native, ts: now };
      onSelect(native);
      setRecent((prev) => {
        const next = [native, ...prev.filter((e) => e !== native)].slice(0, MAX_RECENT);
        saveRecent(next);
        return next;
      });
    },
    [onSelect]
  );

  const customCategories: { id: string; name: string; emojis: { id: string; name: string; keywords: string[]; skins: { native: string }[] }[] }[] = [];
  if (recent.length > 0) {
    customCategories.push({
      id: "recent",
      name: AR_I18N.categories.frequent,
      emojis: recent.map((native, i) => nativeToCustom(`rec_${i}`, native)),
    });
  }
  if (favorites.length > 0) {
    customCategories.push({
      id: "favorites",
      name: AR_I18N.categories.custom,
      emojis: favorites.map((native, i) => nativeToCustom(`fav_${i}`, native)),
    });
  }

  return (
    <div
      className="emoji-picker-root w-full h-full min-h-0 flex flex-col"
      dir="ltr"
    >
      {recent.length > 0 && (
        <div className="flex-shrink-0 px-2 py-1 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-400 whitespace-nowrap">استخداماتك الأخيرة</span>
          <div className="flex items-center gap-1">
            {recent.map((native) => (
              <button
                key={native}
                type="button"
                onClick={() => handleSelectWithFavorites({ native })}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800/40 hover:bg-slate-700/70 text-lg"
              >
                {native}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* حاوية البيكر: تمتد بعرض الشاشة بالكامل */}
      <div className="emoji-picker-inner flex-1 min-h-0 flex flex-col min-w-0 w-full">
        <Picker
        data={data}
        i18n={AR_I18N}
        locale="ar"
        theme="dark"
        skin={parseInt(skin, 10) as 1 | 2 | 3 | 4 | 5 | 6}
        onEmojiSelect={handleSelectWithFavorites}
        onClickOutside={() => {}}
        categories={["people", "nature", "foods", "activity", "places", "objects", "symbols", "flags"]}
        custom={customCategories}
        searchPosition="none"
        skinTonePosition="search"
        previewPosition="none"
        perLine={8}
        emojiSize={24}
        emojiButtonSize={36}
        dynamicWidth
      />
      </div>
    </div>
  );
}
