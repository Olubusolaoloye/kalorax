import { describe, expect, it } from "vitest";
import { renderEmail } from "../../convex/emailLayout";
import { betaWelcomeEmail, resetCodeEmail, waitlistWelcomeEmail } from "../../convex/emails";

describe("branded emails", () => {
  it("put the logo, heading, button and footer in the HTML, and the same words in the text version", () => {
    const { html, text } = renderEmail(betaWelcomeEmail("Ada"));
    expect(html).toContain('src="https://kalorax.app/email/kalorax-logo.png"');
    expect(html).toContain('alt="Kalorax"');
    expect(html).toContain("Welcome to the beta, Ada");
    expect(html).toContain('href="https://kalorax.app"');
    expect(html).toContain("Feel good.");
    expect(text.startsWith("Welcome to the beta, Ada")).toBe(true);
    expect(text).toContain("Open Kalorax: https://kalorax.app");
    expect(text).toContain("- Snap your plate");
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it("show an 8-digit code as two groups of four on one line", () => {
    const { html, text } = renderEmail(resetCodeEmail("48201937"));
    expect(html).toContain("4820 1937");
    expect(html).toContain("white-space:nowrap");
    expect(text).toContain("48201937"); // plain text keeps it unbroken, so it copies cleanly
  });

  it("escape anything that could break the HTML, like a name", () => {
    const { html } = renderEmail(betaWelcomeEmail('<img src=x onerror="alert(1)">'));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("link the confirm and share buttons in the waitlist email", () => {
    const { html } = renderEmail(waitlistWelcomeEmail("member", "a".repeat(36), "k7m2xq9p", 3));
    expect(html).toContain(`href="https://kalorax.app/?confirm=${"a".repeat(36)}"`);
    expect(html).toContain('href="https://kalorax.app/?ref=k7m2xq9p"');
  });
});
