"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { STICKER_PACKS } from "@/lib/sticker-packs";

type Tab = "emojis" | "stickers" | "gifs";

type GifItem = { id: string; url: string; preview: string; title?: string };

type Props = {
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (url: string) => void;
  onGifSelect: (urlOrDataUrl: string) => void;
  onClose?: () => void;
  onSwitchToKeyboard?: () => void;
  keyboardHeightMode?: boolean;
  className?: string;
};

export function MediaPickerPopover({ onEmojiSelect, onStickerSelect, onGifSelect, onClose, onSwitchToKeyboard, keyboardHeightMode, className }: Props) {
  const [tab, setTab] = useState<Tab>("emojis");
  const [packFilter, setPackFilter] = useState<string | null>(null);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchGifs = useCallback(async (q: string) => {
    setGifLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "24");
      const res = await fetch(`/api/gifs/search?${params}`);
      const data = await res.json();
      setGifResults(Array.isArray(data.gifs) ? data.gifs : []);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "gifs" && gifResults.length === 0 && !gifQuery) searchGifs("");
  }, [tab, gifQuery, searchGifs]);

  const packs = STICKER_PACKS;
  const activePack = packFilter ?? packs[0]?.id ?? null;
  const currentPack = packs.find((p) => p.id === activePack);

  return (
    <div
      className={`flex flex-col rounded-2xl bg-slate-800/98 border border-white/10 shadow-xl box-border ${className ?? ""}`.trim()}
      style={{
        width: "100%",
        ...(keyboardHeightMode
          ? {}
          : { height: "min(420px, 58vh)", maxHeight: "min(420px, 58vh)" }),
      }}
    >
      {/* Tabs Header - جزء من نفس المكوّن + زر لوحة المفاتيح عند الطلب */}
      <div className="flex-shrink-0 flex items-center border-b border-white/10 bg-slate-800/80">
        {onSwitchToKeyboard && (
          <button
            type="button"
            onClick={onSwitchToKeyboard}
            className="flex-shrink-0 p-2.5 text-slate-400 hover:text-white transition-colors"
            aria-label="لوحة المفاتيح"
            title="لوحة المفاتيح"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M10 14h4" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab("emojis")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === "emojis" ? "text-emerald-400 border-emerald-400" : "text-slate-400 hover:text-white border-transparent"
          }`}
        >
          Emojis
        </button>
        <button
          type="button"
          onClick={() => setTab("stickers")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === "stickers" ? "text-emerald-400 border-emerald-400" : "text-slate-400 hover:text-white border-transparent"
          }`}
        >
          Stickers
        </button>
        <button
          type="button"
          onClick={() => setTab("gifs")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === "gifs" ? "text-emerald-400 border-emerald-400" : "text-slate-400 hover:text-white border-transparent"
          }`}
        >
          GIFs
        </button>
      </div>

      {/* Panel Content - يأخذ المساحة المتبقية بالكامل */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === "emojis" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <EmojiPickerPopover onSelect={onEmojiSelect} onClose={onClose} />
          </div>
        )}

        {tab === "stickers" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {packs.length > 1 && (
              <div className="flex-shrink-0 flex gap-1 p-2 overflow-x-auto overflow-y-hidden border-b border-white/5 bg-slate-800/50">
                {packs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPackFilter(p.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activePack === p.id ? "bg-emerald-500/30 text-emerald-300" : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 grid grid-cols-4 gap-2 content-start">
              {currentPack?.stickers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onStickerSelect(s.url)}
                  className="aspect-square rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center p-1 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "gifs" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-2 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gifQuery}
                  onChange={(e) => {
                    setGifQuery(e.target.value);
                    if (gifSearchTimeoutRef.current) clearTimeout(gifSearchTimeoutRef.current);
                    gifSearchTimeoutRef.current = setTimeout(() => {
                      if (e.target.value.trim()) searchGifs(e.target.value.trim());
                      else searchGifs("");
                      gifSearchTimeoutRef.current = null;
                    }, 400);
                  }}
                  placeholder="بحث GIF أونلاين..."
                  className="flex-1 h-9 rounded-lg bg-slate-700/80 border border-white/10 px-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {gifLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400 text-sm">جاري التحميل...</div>
              ) : gifResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm text-center px-4">
                  <p>أضف GIPHY_API_KEY في .env لتفعيل البحث أونلاين</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {gifResults.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onGifSelect(g.url)}
                      className="aspect-square rounded-lg overflow-hidden bg-slate-700/50 hover:ring-2 hover:ring-emerald-500/50 focus:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.preview || g.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
