// Browser side of push notifications: permission, the service worker's push subscription,
// and showing a notification straight away (used by on-device reminders).

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** iPhone/iPad only allow push for apps added to the Home Screen (iOS 16.4+). */
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
export const isInstalled = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Ask permission and subscribe this browser. Throws with a friendly message if it can't. */
export async function subscribePush(publicKey: string): Promise<PushKeys> {
  if (!pushSupported()) throw new Error("This browser can't receive notifications.");
  if ((await requestPermission()) !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings and try again.");
  const reg = await registration();
  const key = keyBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // A subscription made with a different server key can't be reused.
    const current = sub.options.applicationServerKey;
    const same = current && new Uint8Array(current).every((b, i) => b === key[i]);
    if (!same) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Couldn't set up notifications on this device.");
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
}

export async function unsubscribePush(): Promise<string | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  await sub.unsubscribe();
  return sub.endpoint;
}

/** Show a notification now (on-device reminders and previews). */
/** Matches ALARM_VIBRATE in public/sw.js. */
const ALARM_VIBRATE = [800, 300, 800, 300, 800, 300, 1200];

/** `alarm`: stays on screen, vibrates hard and offers Done / Snooze (snooze is handled in public/sw.js). */
export async function showNotification(title: string, body: string, url = "/home", tag?: string, alarm = false) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  // `vibrate`, `renotify` and `actions` exist in browsers but not in TypeScript's NotificationOptions yet.
  const options: NotificationOptions & Record<string, unknown> = {
    body, icon: "/icon-192.png", badge: "/badge-96.png", tag, data: { url, alarm, title, body, tag },
    ...(alarm ? { requireInteraction: true, renotify: !!tag, vibrate: ALARM_VIBRATE, actions: [{ action: "done", title: "✓ Done" }, { action: "snooze", title: "⏰ Snooze 10 min" }] } : {}),
  };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return await reg.showNotification(title, options);
  } catch {
    // Fall through to a plain notification.
  }
  try {
    new Notification(title, options);
  } catch {
    // Some browsers (Android Chrome) only allow notifications from a service worker; nothing more we can do.
  }
}
