self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// إبقاء الـ SW بسيطاً. الهدف هنا تفعيل قابلية تثبيت التطبيق.
self.addEventListener("fetch", () => {});

