// Minimal offline support: cache the app shell, serve it when offline.
// Network-first so users always get the newest version when online.
const CACHE = "kalorax-v6";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/badge-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(async () => (await caches.match(req)) || caches.match("/index.html")),
  );
});

// Shared with src/lib/push.ts (on-device reminders): alarms stay on screen, vibrate hard and offer Done / Snooze.
const ALARM_VIBRATE = [800, 300, 800, 300, 800, 300, 1200];
function notificationOptions(data) {
  const alarm = !!data.priority;
  return {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag,
    // A newer message in the same chat (or an alarm coming back from snooze) replaces the old one and still buzzes.
    renotify: alarm || !!(data.tag && data.tag.startsWith("chat-")),
    requireInteraction: alarm,
    vibrate: alarm ? ALARM_VIBRATE : undefined,
    silent: false,
    actions: alarm ? [{ action: "done", title: "✓ Done" }, { action: "snooze", title: "⏰ Snooze 10 min" }] : [],
    data: { url: data.url || "/home", alarm, snoozeUrl: data.snoozeUrl, snoozeToken: data.snoozeToken, title: data.title, body: data.body, tag: data.tag },
  };
}

// Reminders and message alerts sent from the server (web push).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(self.registration.showNotification(data.title || "Kalorax", notificationOptions(data)));
});

// Lets the app show alarms through the service worker (on-device reminders).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "show-alarm") {
    event.waitUntil(self.registration.showNotification(event.data.title, notificationOptions({ ...event.data, priority: true })));
  }
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();
  if (event.action === "done") return;
  if (event.action === "snooze") {
    event.waitUntil(
      data.snoozeUrl
        // Account: the server sends it again in 10 minutes, even if the phone is locked.
        ? fetch(data.snoozeUrl, { method: "POST", body: data.snoozeToken, headers: { "Content-Type": "text/plain" } }).catch(() => {})
        // On-device: ask an open Kalorax window to show it again in 10 minutes.
        : self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) =>
            wins.forEach((w) => w.postMessage({ type: "snooze", title: data.title, body: data.body, url: data.url, tag: data.tag })),
          ),
    );
    return;
  }
  // Open (or focus) the app on the reminder's page.
  const url = new URL(data.url || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
