// The words of every email Kalorax sends. Layout and branding live in emailLayout.ts.
import { siteUrl, type EmailContent } from "./emailLayout";

export function resetCodeEmail(code: string): EmailContent {
  return {
    preheader: `Your code is ${code}. It expires in 15 minutes.`,
    heading: "Reset your password",
    blocks: [
      { p: "Here's your code to choose a new Kalorax password. Enter it in the app:" },
      { code },
      { small: "It expires in 15 minutes. If you didn't ask to reset your password, you can ignore this email: your password stays the same." },
    ],
    reason: "You're getting this because someone asked to reset the password for this email on Kalorax.",
  };
}

export function verifyCodeEmail(code: string): EmailContent {
  return {
    preheader: `Your code is ${code}. Enter it to finish setting up your account.`,
    heading: "Confirm your email",
    blocks: [
      { p: "Welcome to Kalorax! Enter this code in the app to confirm your email and finish setting up your account:" },
      { code },
      { small: "It expires in 30 minutes. If you didn't create a Kalorax account, you can ignore this email." },
    ],
    reason: "You're getting this because this email was used to create a Kalorax account.",
  };
}

const WELCOME: Record<"member" | "student" | "dietitian", string> = {
  member: "We'll email you when Kalorax opens to everyone, with a few tips to get your first week off to a good start.",
  student: "We'll email you when Kalorax opens, including how to get your student account verified so you can use the Workbench.",
  dietitian: "We'll email you when Kalorax opens, including how to get verified and start offering paid programmes to clients.",
};

export function waitlistWelcomeEmail(role: keyof typeof WELCOME, confirmToken: string, code: string, referralGoal: number): EmailContent {
  const site = siteUrl();
  const share = `${site}/?ref=${code}`;
  return {
    preheader: "Confirm your email to keep your place in line.",
    heading: "You're on the Kalorax waitlist",
    blocks: [
      { p: "Thanks for joining! Please confirm your email so we can send your invite." },
      { button: { label: "Confirm my email", url: `${site}/?confirm=${confirmToken}` } },
      { p: WELCOME[role] },
      { p: `Want an earlier invite? Share your link. When ${referralGoal} friends join and confirm, you move into the first group:` },
      { button: { label: "Get my invite link", url: share } },
      { small: `Or copy it: ${share}` },
    ],
    reason: "You're getting this because you joined the Kalorax waitlist. If that wasn't you, ignore this email and we won't write again.",
  };
}

export function betaWelcomeEmail(name: string): EmailContent {
  const site = siteUrl();
  return {
    preheader: "Thank you for testing Kalorax. Here's what to try first.",
    heading: name ? `Welcome to the beta, ${name} 💚` : "Welcome to the Kalorax beta 💚",
    blocks: [
      { p: "Thank you for being one of the first people to use Kalorax. You're now part of our beta test, and your feedback will shape what we build next." },
      { p: "What to try this week:" },
      {
        list: [
          "Snap your plate in Messages → Kalorax Coach to get the calories and ingredients",
          "Set where you eat on the Me page, so your food list starts with your local dishes",
          "Take on this week's challenges and invite a friend to the leaderboard",
        ],
      },
      { button: { label: "Open Kalorax", url: site } },
      { p: "Found a bug or have an idea? Open the Me page and tap Send feedback. It goes straight to the team." },
      { p: "Thanks for helping us build Kalorax.\nThe Kalorax team" },
    ],
    reason: "You're getting this because you have a Kalorax account. You can turn off beta emails on the Me page.",
  };
}
