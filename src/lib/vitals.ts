// Real-user speed tracking: measures how fast pages load and respond for actual visitors
// (Core Web Vitals) and sends the numbers to the backend's /vitals route. No account, name
// or personal details are sent: only the metric, the page (ids removed) and phone or desktop.

type Report = { metric: string; value: number; path: string; device: "mobile" | "desktop" };

/** "/clients/k17abc…" → "/clients/:id", so pages group together and no ids are stored. */
export function pagePattern(pathname: string): string {
  const segs = pathname.split("/");
  // Ids, and the secret token in an invite link (/join/<token>), never leave the browser.
  const parts = segs.map((seg, i) => (segs[i - 1] === "join" ? ":token" : /^[a-z0-9]{16,}$/i.test(seg) || /^\d+$/.test(seg) ? ":id" : seg));
  return (parts.join("/") || "/").slice(0, 60);
}

/** Loads the measuring library once the page has finished loading, so it never slows the first screen. */
export function startVitals(endpoint: string) {
  const begin = () => {
    void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const queue: Report[] = [];
      const device = window.matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop";
      const add = (m: { name: string; value: number }) => {
        // CLS is a small unitless score; the others are milliseconds.
        const value = m.name === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value);
        queue.push({ metric: m.name, value, path: pagePattern(location.pathname), device });
      };
      // Sent in one go when the visitor leaves or switches away (the browser delivers it even as the page closes).
      const flush = () => {
        if (queue.length === 0) return;
        const body = JSON.stringify(queue.splice(0, 10));
        if (!navigator.sendBeacon?.(endpoint, body)) void fetch(endpoint, { method: "POST", body, keepalive: true }).catch(() => {});
      };
      addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
      addEventListener("pagehide", flush);
      onLCP(add);
      onINP(add);
      onCLS(add);
      onFCP(add);
      onTTFB(add);
    });
  };
  if (document.readyState === "complete") setTimeout(begin, 0);
  else addEventListener("load", () => setTimeout(begin, 0), { once: true });
}
