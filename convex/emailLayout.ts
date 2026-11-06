// The Kalorax email design: one branded layout for every email (logo header, lime-and-ink colours, a button
// for links, a large box for codes, footer with the tagline), plus a plain-text version for text-only apps.
// Email HTML is old-fashioned on purpose: tables and inline styles are what Gmail, Outlook and Apple Mail
// all show the same way. Keep it that way when editing.

export type Block =
  | { p: string }
  | { list: string[] }
  | { code: string }
  | { button: { label: string; url: string } }
  | { small: string };

export interface EmailContent {
  /** The grey line many inboxes show after the subject. */
  preheader: string;
  heading: string;
  blocks: Block[];
  /** Why they're getting it (shown small in the footer). */
  reason: string;
}

const C = {
  page: "#f4f5ef",
  card: "#ffffff",
  ink: "#11180d",
  text: "#2b3325",
  muted: "#6b7364",
  line: "#e6e8df",
  lime: "#c3ee6a",
  lime2: "#a9dc4b",
  onLime: "#142008",
  soft: "#eef8da",
  brand: "#4a7a12",
};
const FONT = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const siteUrl = () => (process.env.SITE_URL ?? "https://kalorax.app").replace(/\/$/, "");

function blockHtml(b: Block): string {
  if ("p" in b) return `<p style="margin:0 0 16px;font:400 16px/1.6 ${FONT};color:${C.text};white-space:pre-line">${esc(b.p)}</p>`;
  if ("small" in b) return `<p style="margin:0 0 16px;font:400 14px/1.6 ${FONT};color:${C.muted};overflow-wrap:anywhere;word-break:break-word">${esc(b.small)}</p>`;
  if ("list" in b) {
    const items = b.list
      .map((i) => `<tr><td valign="top" style="padding:0 10px 10px 0;font:700 16px/1.6 ${FONT};color:${C.brand}">&#10003;</td><td style="padding:0 0 10px;font:400 16px/1.6 ${FONT};color:${C.text}">${esc(i)}</td></tr>`)
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${items}</table>`;
  }
  if ("code" in b) {
    // "4820 1937": easier to read and type; the app ignores the space if it's pasted.
    const shown = b.code.length === 8 ? `${b.code.slice(0, 4)} ${b.code.slice(4)}` : b.code;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px"><tr><td align="center" style="background:${C.soft};border:1px solid ${C.lime2};border-radius:16px;padding:18px 12px;font:800 32px/1.1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:4px;white-space:nowrap;color:${C.ink}">${esc(shown)}</td></tr></table>`;
  }
  const { label, url } = b.button;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr><td align="center" bgcolor="${C.lime}" style="border-radius:999px;background:${C.lime}"><a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font:800 16px/1 ${FONT};color:${C.onLime};text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
}

function blockText(b: Block): string {
  if ("p" in b) return b.p;
  if ("small" in b) return b.small;
  if ("list" in b) return b.list.map((i) => `- ${i}`).join("\n");
  if ("code" in b) return `    ${b.code}`;
  return `${b.button.label}: ${b.button.url}`;
}

/** The email as HTML (branded) and plain text (same words). */
export function renderEmail(e: EmailContent): { html: string; text: string } {
  const site = siteUrl();
  const host = site.replace(/^https?:\/\//, "");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(e.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${esc(e.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td style="padding:0 8px 18px">
      <a href="${esc(site)}" target="_blank" style="text-decoration:none"><img src="${esc(site)}/email/kalorax-logo.png" width="165" height="44" alt="Kalorax" style="display:block;border:0;outline:none;width:165px;height:44px;font:800 22px ${FONT};color:${C.ink}"></a>
    </td></tr>
    <tr><td bgcolor="${C.card}" style="background:${C.card};border-radius:24px;border:1px solid ${C.line};border-top:6px solid ${C.lime}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:28px 28px 14px">
          <h1 style="margin:0 0 16px;font:800 26px/1.2 ${FONT};letter-spacing:-0.4px;color:${C.ink}">${esc(e.heading)}</h1>
          ${e.blocks.map(blockHtml).join("\n          ")}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 16px 0" align="center">
      <p style="margin:0 0 6px;font:800 15px/1.4 ${FONT};color:${C.ink}">Eat well. Move more. <span style="color:${C.brand}">Feel good.</span></p>
      <p style="margin:0 0 10px;font:400 13px/1.5 ${FONT};color:${C.muted}"><a href="${esc(site)}" target="_blank" style="color:${C.brand};text-decoration:none;font-weight:700">${esc(host)}</a></p>
      <p style="margin:0;font:400 12px/1.5 ${FONT};color:${C.muted}">${esc(e.reason)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  const text = [e.heading, "", ...e.blocks.map(blockText).flatMap((t) => [t, ""]), "Eat well. Move more. Feel good.", host, "", e.reason].join("\n");
  return { html, text };
}
