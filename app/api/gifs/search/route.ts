import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";

export type GifSearchItem = {
  id: string;
  url: string;
  preview: string;
  title?: string;
};

/** GET: بحث GIF أونلاين عبر Giphy (يحتاج GIPHY_API_KEY في .env) */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 30);
  const offset = Number(request.nextUrl.searchParams.get("offset")) || 0;

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "خدمة البحث غير مفعّلة", gifs: [] },
      { status: 200 }
    );
  }

  if (!q) {
    const trendingUrl = `${GIPHY_BASE}/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}&rating=g`;
    try {
      const res = await fetch(trendingUrl);
      const json = await res.json();
      const list: GifSearchItem[] = (json.data || [])
        .map((g: { id: string; images?: { fixed_height?: { url: string }; original?: { url: string } }; title?: string }) => ({
          id: g.id,
          url: g.images?.original?.url || g.images?.fixed_height?.url || "",
          preview: g.images?.fixed_height?.url || g.images?.original?.url || "",
          title: g.title,
        }))
        .filter((x: GifSearchItem) => x.url);
      return NextResponse.json({ gifs: list });
    } catch {
      return NextResponse.json({ gifs: [] });
    }
  }

  const searchUrl = `${GIPHY_BASE}/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=g&lang=ar`;
  try {
    const res = await fetch(searchUrl);
    const json = await res.json();
    const list: GifSearchItem[] = (json.data || [])
      .map((g: { id: string; images?: { fixed_height?: { url: string }; original?: { url: string } }; title?: string }) => ({
        id: g.id,
        url: g.images?.original?.url || g.images?.fixed_height?.url || "",
        preview: g.images?.fixed_height?.url || g.images?.original?.url || "",
        title: g.title,
      }))
      .filter((x: GifSearchItem) => x.url);
    return NextResponse.json({ gifs: list });
  } catch {
    return NextResponse.json({ gifs: [] });
  }
}
