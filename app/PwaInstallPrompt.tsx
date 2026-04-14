"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"prompt" | "ios" | "secure" | "manual">("prompt");
  const [isStandalone, setIsStandalone] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const DISMISS_UNTIL_KEY = "pwa_install_dismiss_until";
  const INSTALLED_KEY = "pwa_installed";

  const dismissPrompt = () => {
    const dismissUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // أسبوع
    localStorage.setItem(DISMISS_UNTIL_KEY, String(dismissUntil));
    setVisible(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isIosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const isDisplayStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    const standalone = isIosStandalone || isDisplayStandalone;
    setIsStandalone(standalone);

    const installedBefore = localStorage.getItem(INSTALLED_KEY) === "1";
    if (standalone) {
      localStorage.setItem(INSTALLED_KEY, "1");
      setSuppressed(true);
      return;
    }
    if (installedBefore) {
      setSuppressed(true);
      return;
    }

    // تسجيل Service Worker مطلوب لظهور تثبيت PWA.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const now = Date.now();
    const dismissUntil = Number(localStorage.getItem(DISMISS_UNTIL_KEY) ?? "0");
    const isDismissed = dismissUntil > now;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const isSecure = window.isSecureContext || isLocalhost;

    let gotInstallEvent = false;
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      gotInstallEvent = true;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!isDismissed) {
        setMode("prompt");
        setVisible(true);
      }
    };

    const onAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setSuppressed(true);
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (!isDismissed) {
      if (!isSecure) {
        setMode("secure");
        setVisible(true);
      } else if (isIos) {
        setMode("ios");
        setVisible(true);
      } else {
        const manualTimer = window.setTimeout(() => {
          if (!gotInstallEvent && isAndroid) {
            setMode("manual");
            setVisible(true);
          }
        }, 2500);
        return () => {
          window.clearTimeout(manualTimer);
          window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
          window.removeEventListener("appinstalled", onAppInstalled);
        };
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1");
      setSuppressed(true);
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (isStandalone || suppressed || !visible) return null;

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
              onClick={dismissPrompt}
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
            onClick={dismissPrompt}
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
            onClick={dismissPrompt}
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
            onClick={dismissPrompt}
            className="h-10 px-3 rounded-xl bg-white/10 text-white/90 text-[13px] hover:bg-white/15"
          >
            حسنًا
          </button>
        </>
      )}
    </div>
  );
}

