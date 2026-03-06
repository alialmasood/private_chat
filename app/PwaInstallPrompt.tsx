"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"prompt" | "ios" | "secure" | "manual">("prompt");

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    const isIosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const isDisplayStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    return isIosStandalone || isDisplayStandalone;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const isSecure = window.isSecureContext || isLocalhost;

    // تسجيل Service Worker مطلوب لظهور تثبيت PWA على أغلب المتصفحات.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // iOS لا يدعم beforeinstallprompt؛ نظهر شرحًا يدويًا.
    if (isIos) {
      setMode("ios");
      setVisible(true);
    }

    // على الهواتف عبر HTTP (IP محلي) لا يظهر تثبيت PWA؛ نعرض سبب المشكلة.
    if (!isSecure) {
      setMode("secure");
      setVisible(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode("prompt");
      setVisible(true);
    };

    const onAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // Android أحيانًا لا يطلق الحدث مبكرًا؛ نعرض تلميحًا يدويًا بعد ثوانٍ.
    const manualTimer = window.setTimeout(() => {
      if (!deferredPrompt && isAndroid && isSecure && !isIos) {
        setMode("manual");
        setVisible(true);
      }
    }, 2500);

    return () => {
      window.clearTimeout(manualTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [deferredPrompt, isStandalone]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (isStandalone || !visible) return null;

  return (
    <div className="fixed bottom-3 right-3 left-3 z-[100] sm:left-auto sm:w-[360px] rounded-2xl bg-[#111B21] text-white shadow-2xl border border-white/10 p-3">
      {mode === "prompt" && (
        <>
          <p className="text-[13px] text-white/90 mb-2">ثبّت التطبيق للوصول السريع وفتحه بدون واجهة المتصفح.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 h-10 rounded-xl bg-[#00A884] text-white text-[14px] font-medium hover:bg-[#06CF9C]"
            >
              تثبيت
            </button>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="h-10 px-3 rounded-xl bg-white/10 text-white/90 text-[13px] hover:bg-white/15"
            >
              لاحقًا
            </button>
          </div>
        </>
      )}

      {mode === "ios" && (
        <>
          <p className="text-[13px] text-white/90 mb-2">لتثبيت التطبيق على iPhone: اضغط مشاركة ثم «Add to Home Screen».</p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="h-10 px-3 rounded-xl bg-white/10 text-white/90 text-[13px] hover:bg-white/15"
          >
            فهمت
          </button>
        </>
      )}

      {mode === "secure" && (
        <>
          <p className="text-[13px] text-white/90 mb-2">التثبيت على الهاتف يحتاج رابط آمن HTTPS. افتح الموقع عبر دومين HTTPS بدل عنوان IP المحلي.</p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="h-10 px-3 rounded-xl bg-white/10 text-white/90 text-[13px] hover:bg-white/15"
          >
            موافق
          </button>
        </>
      )}

      {mode === "manual" && (
        <>
          <p className="text-[13px] text-white/90 mb-2">من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» لإضافته للشاشة الرئيسية.</p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="h-10 px-3 rounded-xl bg-white/10 text-white/90 text-[13px] hover:bg-white/15"
          >
            حسنًا
          </button>
        </>
      )}
    </div>
  );
}

