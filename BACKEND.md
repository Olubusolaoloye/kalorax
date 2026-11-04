# Kalorax backend (Convex)

Kalorax runs in two modes:

- **On-device** (no `VITE_CONVEX_URL`): no accounts; data is saved in the browser. This is what runs until Convex is set up.
- **Cloud** (`VITE_CONVEX_URL` set): email + password accounts, data synced to Convex, real verification.

## What's in `convex/`

| File | What it does |
|---|---|
| `schema.ts` | Tables: profiles, verifications, diary, water, weights, notes, plan (with portions), grocery, events, exercises, settings, pushSubscriptions, whatsapp, reminderLog, waitlist (+ Convex Auth tables) |
| `auth.ts`, `auth.config.ts`, `http.ts` | Convex Auth with the Password provider (email + password) |
| `passwordReset.ts` | "Forgot password?": emails an 8-digit reset code through Resend |
| `settings.ts` | Saves meal-plan preferences and reminder settings |
| `reminders.ts` | Push subscriptions, WhatsApp number confirmation (6-digit code), test reminders, and `claimDue`, which works out what's due and records it so nothing is sent twice |
| `pro.ts` | Dietitian Pro: trial, paid months, who can be booked (`isBookable`); payments go through `payments.ts` (`startProPayment`, `verifyProPayment`) and the Paystack webhook |
| `notify.ts` | Sends reminders and new-message alerts (Node runtime): web push with VAPID keys, WhatsApp Cloud API template messages |
| `snooze.ts` | Signed "Snooze 10 min" links on alarm reminders: `POST /reminders/snooze` (in `http.ts`) re-sends the alarm 10 minutes later, at most 3 times; links are HMAC-signed with `VAPID_PRIVATE_KEY`, expire after 12 hours and work once |
| `alerts.ts` | New-message alerts: each chat message schedules one 15 s later, sent only if it's still unread then and is the latest in the burst. Programme chats never put the message text in the notification; WhatsApp alerts say who wrote, at most once an hour per chat |
| `crons.ts` | Checks for due reminders every 5 minutes; clears speed reports older than 30 days once a day |
| `interventions.ts` | Paid programmes: catalogue of verified dietitians' offerings, enrolment with intake and consent, member programme view, messages, payment confirmation (`markPaid`) |
| `payments.ts` | Paystack checkout (`startPayment`) and verification on return (`verifyPayment`) |
| `admin.ts` | Admin portal (admins only): `overview` (counts, 30-day sign-up and active-member trends, programmes and revenue, messaging and reminders), `feed` (latest sign-ups, verifications, enrolments, payments, payouts, waitlist, new chats) `people` (search by name or email, last active) and `log` (the audit log). No message text or food logs |
| `usernames.ts` | @username rules (3–20 characters, letters, numbers, _ and ., reserved names), lookup and a free name made from the person's name |
| `social.ts` | Member-to-member chats: find members by @username prefix (`findPeople`), start a chat by @username, send text, a week of the meal plan, or a grocery list that both people can tick off (`tickGroceryItem`), inbox with unread counts, mark read, block. Only the two people in a chat can read it; deleting your data deletes your chats |
| `clients.ts` | Dietitian tools: profile and payout account, offerings and prices, client list, client detail, set target, send plan, supplements, check-ins, complete; admin payouts |
| `http.ts` | Convex Auth routes and the Paystack webhook (`/paystack/webhook`, signature-checked) |
| `me.ts` | `snapshot` — one reactive query with everything the signed-in user needs (dated logs from the last 180 days, plus planned days ahead and every weigh-in); `history` — older days, up to two months at a time, for the diary and calendar |
| `vitals.ts` | Real-user speed: browsers send Core Web Vitals (load, tap response, layout shift) to `POST /vitals`; admins see the 75th percentile under **Admin → Overview**. Nothing identifies the visitor |
| `profile.ts` | Create the profile at the end of onboarding (with an @username); edit personal details (role and verification can't be changed by users); `setUsername`, `usernameAvailable`, `ensureUsername` (gives older profiles a username) |
| `data.ts` | Diary, water, weight, notes, plan, grocery, calendar and exercise mutations; delete my data / account |
| `verification.ts` | Upload a document, submit for review, admin review queue and approve/reject |
| `importLocal.ts` | One-time import of data saved on a device before accounts |
| `waitlist.ts` | Public landing-page waitlist (`join`, one entry per email). New joiners get a "you're on the list" email through Resend when `AUTH_RESEND_KEY` is set, at most 60 an hour. Admins see everyone under **Admin → Waitlist** (`list`) and can download a CSV. Each download is noted in the audit log (`recordExport`) |
| `access.ts` | Private mode and invite links. Admins switch private mode under **Admin → Access**. While it's on, the public home page shows only the waitlist, and only confirmed admins and people who used a **one-time invite link** (`/join/<token>`, 14 days) can create an account (checked in `auth.ts` when an account is created) or use the app (checked in `requireUser`). Admins create links from the Access or Waitlist tab and send them themselves (Copy link, WhatsApp). Sign-ups aren't email-verified, so knowing an invited or admin email gets nobody in. Turning private mode on the first time **locks the admin list**: the `ADMIN_EMAILS` accounts that exist then are confirmed, and admin emails that sign up later need confirming by an admin. Everything goes in the audit log |
| `helpers.ts`, `validators.ts` | Auth checks, ownership checks, input validation, `logAdminAction` (writes the admin audit log in the same transaction as the action) |
| `backend.test.ts` | Tests (run with `npm test`) |

Every function checks who is signed in and only touches that user's rows. Only admins (emails in `ADMIN_EMAILS`) can approve verification. Every admin query checks this on the server, and every admin action (approve, reject, payout) is written to the `adminLog` audit table.

## One-time setup (on your computer)

You need Node.js 20+ and a free Convex account (https://convex.dev).

```bash
git clone -b claude/nutrifi-strategy https://github.com/Olubusolaoloye/nutrifi   # repository and branch keep their original names
cd nutrifi
npm install

# 1. Create the Convex project and push the functions.
#    Log in when asked, choose "create a new project" (e.g. "kalorax").
#    This writes CONVEX_DEPLOYMENT and VITE_CONVEX_URL into .env.local.
npx convex dev --once

# 2. Set up sign-in keys (answer the prompts; use http://localhost:5173 as the site URL).
npx @convex-dev/auth

# 3. Make yourself an admin so you can review verification requests.
npx convex env set ADMIN_EMAILS "you@example.com"

# 4. Run it.
npm run dev:backend   # keeps Convex in sync while you work (leave running)
npm run dev           # in a second terminal → http://localhost:5173
```

Create an account with the email you put in `ADMIN_EMAILS`, and the **Verification queue** appears in the sidebar.

## Going live on Netlify

1. In the Convex dashboard, open your project → **Production** → **Settings** → generate a **Production deploy key**.
2. Set up auth keys for production: `npx @convex-dev/auth --prod` (use `https://kalorax.netlify.app` as the site URL), then
   `npx convex env set --prod ADMIN_EMAILS "you@example.com"`.
3. In Netlify → **kalorax** → **Project configuration → Environment variables**, add `CONVEX_DEPLOY_KEY` with that key.
4. Redeploy. The build (`npm run build:ci`) deploys the Convex functions, sets `VITE_CONVEX_URL` automatically, and builds the app in cloud mode.
   Only production builds deploy to Convex. Deploy previews and branch deploys do a plain build (Convex refuses a production key there); set `VITE_CONVEX_URL` for those contexts in Netlify if you want previews connected to Convex.

## Password reset emails (Resend)

1. Create a free account at https://resend.com, verify your sending domain (e.g. `kalorax.ng`) and create an API key.
2. `npx convex env set AUTH_RESEND_KEY re_xxx` and `npx convex env set AUTH_EMAIL_FROM "Kalorax <no-reply@kalorax.ng>"` (add `--prod` for production).

The same key and sender also send the waitlist welcome email.

Without these, "Forgot password?" tells people reset isn't available yet.

## Reminders: push notifications

1. Generate VAPID keys once: `npx web-push generate-vapid-keys`
2. Save them in Convex (add `--prod` for production):
   ```bash
   npx convex env set VAPID_PUBLIC_KEY  "<public key>"
   npx convex env set VAPID_PRIVATE_KEY "<private key>"
   npx convex env set VAPID_SUBJECT     "mailto:hello@kalorax.ng"
   ```
3. Members turn notifications on per device under **Reminders**. On iPhone, push only works once Kalorax is added to the Home Screen (iOS 16.4+).

The production deployment already has its keys (set October 2026), with `VAPID_SUBJECT` set to the site's address.

Never change the VAPID keys once people have subscribed — existing devices would stop receiving reminders until they turn notifications on again.

## Reminders: WhatsApp (Meta WhatsApp Cloud API)

1. In https://developers.facebook.com create an app → add **WhatsApp**, connect a business phone number and create a **permanent access token** (System User in Business Settings, with `whatsapp_business_messaging`).
2. Create a message template in WhatsApp Manager, category **Utility**, language English, named `kalorax_reminder`, with this body:
   > Hi {{1}}, a reminder from Kalorax: {{2}}

   Wait for Meta to approve it. (Optional: an **Authentication** template for the confirmation code — set its name in `WHATSAPP_CODE_TEMPLATE`; otherwise the code is sent with the reminder template.)
3. Save the settings in Convex:
   ```bash
   npx convex env set WHATSAPP_TOKEN "<permanent token>"
   npx convex env set WHATSAPP_PHONE_NUMBER_ID "<phone number id>"
   npx convex env set WHATSAPP_TEMPLATE kalorax_reminder        # optional, this is the default
   npx convex env set WHATSAPP_TEMPLATE_LANG en                 # optional, must match the template's language code
   ```

The same template carries new-message alerts ("Hi Ada, a reminder from Kalorax: Bisi sent you a message on Kalorax. Open the app to reply."). Members can switch message alerts off under **Reminders → New messages**.

Members add their number under **Reminders**, tick the consent box and confirm it with the 6-digit code sent to WhatsApp. Reminders only go to confirmed numbers; up to 3 codes an hour and 5 tries per code. Meta charges per conversation — check current WhatsApp pricing for Nigeria.

## Paid programmes: Paystack

1. Create a Paystack business account (https://paystack.com) and get your **secret key** (Settings → API Keys & Webhooks). Start with the `sk_test_…` key.
2. `npx convex env set PAYSTACK_SECRET_KEY sk_test_xxx` (add `--prod` for production with the `sk_live_…` key). `SITE_URL` (set during auth setup) is where Paystack sends members back: `<SITE_URL>/programmes/paid`.
3. In Paystack → **Webhook URL**, enter `https://<your-deployment>.convex.site/paystack/webhook` (the `.convex.site` URL is shown in the Convex dashboard).

How money flows: the member pays Kalorax the dietitian's price; Kalorax keeps the platform fee (20%, `PLATFORM_FEE_PERCENT` in `src/data/programmes.ts`); admins pay the dietitian's share by bank transfer and record it under **Admin → Dietitian payouts**. An enrolment only becomes active when Paystack confirms a charge for exactly the price (via the webhook or the return check), so a tampered redirect can't activate it. Paystack split payments (subaccounts) can replace manual payouts later.

For testing without Paystack, `npx convex env set PAYMENTS_DEMO true` activates programmes without payment. Demo enrolments are marked and never count as earnings. **Never set it in production.**

Privacy: a dietitian sees a member's diary, water, weight and notes only while that member's paid programme is active and only because the member ticked the consent box. When the programme ends the logs stop being shared; when a member deletes their data, their messages, check-ins and supplements are deleted and the enrolment stays only as a payment record.

## Dietitian Pro: Paystack

Pro uses the same Paystack key and webhook as programmes (Pro references start with `np_`, programmes with `nf_`).

- **Price:** ₦7,500 a month by default; change it with `npx convex env set PRO_PRICE_NAIRA 7500`. Dietitians pay for 1, 3, 6 or 12 months up front (card, bank transfer or USSD), and nothing renews automatically. New months start when the current trial or paid period ends.
- **Trial:** 30 days, counted from verification or from billing launch (24 Oct 2026, `PRO_BILLING_LAUNCH` in `convex/pro.ts`), whichever is later.
- **Until Paystack is set up**, Pro is free for every verified dietitian ("early access").
- **What lapses:** the Workbench and being listed on Programmes, so new members can't book them. Existing clients keep their chat, plans and check-ins, so members who already paid are never cut off.
- After paying, Paystack returns the dietitian to `<SITE_URL>/pro/paid`. Students and members don't pay for anything here.

## Speed

- Each page is its own JavaScript file; React, the router and Convex sit in a `vendor` file and icons in an `icons` file (`vite.config.ts`), so app releases don't make visitors download the libraries again. Hashed files under `/assets/` are cached for a year (`netlify.toml`). Netlify compresses responses (Brotli or gzip) on its own.
- Food photos go through Netlify's Image CDN (`/.netlify/images`, allowed sources in `netlify.toml`), which converts them to AVIF or WebP and caches them near visitors. If it fails, the photo loads from Wikimedia directly, then falls back to the emoji.
- Long chats show the latest 200 messages. Unread counts read only messages after the last read time (`messages.by_enrolment_sent`).
- Calls to Paystack, WhatsApp, Resend and push services give up after 10–15 seconds.

## Notes

- The reminder cron reads every member's settings each run, which is fine for the MVP; shard or index by next-due time as the user base grows.
- Without an account (on-device mode), reminders show as browser notifications only while Kalorax is open.
- Sign-in is email + password for now. Phone OTP can be added with an SMS provider (e.g. Termii) as a custom Convex Auth provider.
- Verification documents are stored in Convex file storage and visible only to admins.
- `convex/_generated/` is generated by Convex (`npx convex dev` keeps it up to date); commit it after changing functions or the schema.
