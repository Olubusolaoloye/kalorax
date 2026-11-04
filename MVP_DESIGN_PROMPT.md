# Kalorax MVP — UI/UX Design Brief (prompt for the design agent)

> Copy everything below the line into your UI/UX design agent.

---

## Your role

You are a senior product designer. Design a **clickable, high-fidelity prototype** of the MVP for **Kalorax**, a nutrition app for **Nigeria**.

**Platform: a web app first.** Kalorax launches as a **mobile-first, responsive progressive web app (PWA)** built in React. People open it from a link (often shared on WhatsApp) and can "Add to home screen" so it feels like an app. A Google Play listing of the same web app comes later. Design for the browser, not a native app.

Produce:

1. A small **design system**: colours, type, spacing, components.
2. **Responsive screens** at three breakpoints:
   - **Mobile, 360 × 800**: the main target; most consumers use Android phones.
   - **Tablet, 768**.
   - **Desktop, 1440**: consumer screens sit in a centred column or two-pane layout. The **Professional Workbench** uses the full desktop width and must stay usable at 1024.
3. **Linked user flows** so the prototype can be clicked through end to end.

Where this brief doesn't settle a design choice, decide it yourself and note why in one line.

---

## 1. Product context

Kalorax helps Nigerians track and improve what they eat, using **Nigerian foods and portions**. It has three user types:

| Role | Who | What they get |
|---|---|---|
| **Consumer** (free or Premium) | Adults managing weight and health | BMI and weight trend, a **simple daily calorie target**, food diary, water tracking, reminders, newsfeed |
| **Student** (verified) | Nutrition and dietetics students | Everything consumers get, plus the **Professional Workbench** in learning mode (worked steps, practice cases) |
| **Dietitian** (verified, Pro) | Licensed dietitians | Everything, plus the full **Professional Workbench** (BMR, energy requirements, calorie and macro distribution, nutrient food sources, export) |

### The key access rule ("hybrid model")
- **Consumers never see formulas, equation names or editable macro splits.** They see one friendly result: *"Your daily target: about 1,700 kcal"*, plus a simple plate split ("about half your plate starches, a quarter protein…").
- **Consumers who report a medical condition** (diabetes, hypertension, kidney disease, pregnancy, etc.) **do not get an automatic target**. They see a warm card: *"Because you have diabetes, your target should be set by a dietitian."* with a button: **"Talk to a dietitian (coming soon)"**.
- **Students and dietitians** unlock the **Workbench**. They pick the equation, activity level and macro split; see every calculation step; compare equations side by side; and export results.
- Locked pro features appear to consumers as **locked**: a padlock and the text "For dietitians & nutrition students". Never show them broken or empty.

---

## 2. Audience and design principles

- **Users:** urban and semi-urban Nigerians aged 18–55. Many use **low- to mid-range Android phones**, have **expensive or patchy data**, and use WhatsApp every day.
- **Principles:**
  1. **Feels local.** Use Nigerian foods, names and portions throughout: eba, amala, pounded yam, jollof rice, ofada rice, beans, moi moi, akara, plantain (dodo), egusi, ogbono, efo riro, okra soup, suya, garri, pap/ogi, bread & akara, Indomie, zobo, "pure water" sachet.
  2. **Friendly outside, clinically sound inside.** Warm and encouraging, never shaming. Show numbers to professionals; give consumers plain language.
  3. **Fast and light.** Few heavy images, skeleton loaders, clear offline states.
  4. **Accessible.** WCAG AA contrast, tap targets ≥ 48 dp, readable at 1.3× system font size, and never colour alone to show meaning (e.g. BMI category gets a label as well as a colour).
  5. **Trustworthy.** Show data sources ("Source: West African Food Composition Table"), a clear disclaimer that Kalorax doesn't replace medical care, and a visible privacy reassurance at sign-up.

---

## 3. Brand direction (starting point — refine it)

- **Name:** Kalorax. **Tagline idea:** "Eat well, the Naija way." (Propose 2 alternatives.)
- **Personality:** warm, smart, optimistic, credible.
- **Colour:** a fresh green primary (health and growth) and a warm accent drawn from Nigerian food (palm-oil orange / plantain yellow), on a clean light neutral background. Provide a **dark mode** too. Give semantic colours for success, warning, danger and info, plus BMI category colours (each always paired with a text label).
- **Type:** one highly legible sans-serif with good numerals (e.g. Inter, Manrope, or similar), with a clear scale for large stat numbers.
- **Illustration:** simple, friendly illustrations of food and people that reflect Nigerian skin tones and settings. Portion guides use **real-looking food photos or realistic illustrations** on local plates and bowls.
- **Iconography:** one consistent line icon set.
- **Currency and units:** ₦ (Naira), kg, cm, kcal, ml. Allow lb/ft as a setting only.
- **Language:** English for the MVP. Leave room for longer strings (Pidgin, Yoruba, Igbo and Hausa come later), so don't use fixed-width text containers.

---

## 4. Navigation

**Mobile (< 768 px): bottom navigation (5 tabs).** **Tablet and desktop: the same items in a left sidebar.**
1. **Home**: today's dashboard
2. **Diary**: food log
3. **Add (+)**: central quick-add button (food, water, weight)
4. **Learn**: newsfeed
5. **Me**: profile, progress, settings, plan

Students and dietitians also see a **"Workbench"** entry, as a highlighted card on Home and an item in Me. It opens the pro tools. On mobile it's a simplified version; the full version is on the web.

---

## 5. Screens to design (MVP)

Design each screen's **default, empty, loading, error/offline** states where relevant.

### A. Onboarding and account
1. **Landing page** (public, also the PWA start URL): what Kalorax does, "Get started" and "Log in", plus a short section for dietitians and students. It must load fast on 3G.
2. **Welcome carousel** (3 slides): track Nigerian foods · know your body · get expert help.
3. **Sign up / Log in**: phone number + OTP (primary), email, Google. Include a short privacy reassurance ("Your health data is private and protected under the Nigeria Data Protection Act").
4. **Choose your role**: "I want to improve my nutrition" / "I'm a nutrition student" / "I'm a dietitian".
5. **Verification** (students and dietitians):
   - **Student:** institution, matric number, upload student ID or use a school email.
   - **Dietitian:** full name, licence/registration number, upload certificate.
   - Show a **"Verification pending"** state. They can use consumer features while they wait.
6. **Profile setup** (consumer), one question per screen with a progress bar: sex, date of birth, height, weight, activity level (illustrated choices: "Mostly sitting", "On my feet a lot", "Very active / manual work"), goal (lose / maintain / gain weight, eat healthier), and **"Do you have any of these conditions?"** as a multi-select (diabetes, high blood pressure, kidney disease, pregnant, breastfeeding, none). Also dietary preferences (e.g. no pork, vegetarian) and allergies.
7. **Your results**: BMI with category gauge, then either:
   - **No condition:** "Your daily target: about 1,700 kcal" (with a goal of losing weight) + plate split illustration + water target; or
   - **With condition:** the "set by a dietitian" card, plus general healthy-eating tips.
8. **Reminders permission**: choose meal-time, water and weigh-in reminders; optional WhatsApp reminders toggle.
9. **Paywall / plans** (shown after setup, skippable): Free vs Premium (₦2,500/month, ₦25,000/year as placeholders). Student and Pro plans are shown only to those roles.

### B. Home (today's dashboard, consumer)
- Greeting with the date and an encouraging line.
- **Calorie ring**: eaten vs target vs remaining. If there's no target because of a condition, show a "food logged today" summary instead.
- **Macro bars** (carbs, protein, fat) in plain language for consumers, e.g. "Protein: a bit low today".
- **Water tracker card**: glasses/sachets filled; tap to add.
- **Meal slots**: Breakfast, Lunch, Dinner, Snacks, each with "+ Add".
- **Weight / BMI mini-card** with a sparkline and a "Log weight" button.
- **Tip of the day** from Learn.
- For students and dietitians: a **Workbench** shortcut card.

### C. Food diary and logging
1. **Diary day view**: date switcher, meal sections, items with portion and kcal, daily total vs target.
2. **Add food search**:
   - Search box with local name aliases (typing "garri" finds "Eba (garri)").
   - Tabs: Recent · Favourites · My meals.
   - "Can't find it? Request a food".
   - A barcode-scan entry point (for packaged foods).
3. **Food detail + portion picker** (key screen):
   - Food name, local names, source badge.
   - **Visual portion guide**: a horizontal selector of photos showing local portion sizes, e.g. for eba: "Small wrap (fist-size) · Medium wrap · Large wrap", each with grams. For rice: "1 cooking spoon · 2 cooking spoons · 1 plate". For meat: "Small piece · Medium piece · Large piece".
   - Quantity stepper and grams field.
   - Live nutrition: kcal, carbs, protein, fat. Premium also sees fibre, iron, calcium and vitamin A.
   - Choose meal → **Add**.
4. **Combo meal shortcut**: Nigerians often eat swallow + soup + protein together. Design an "Add a combo" flow, e.g. *Eba + Egusi soup + Beef*, where each part has its own portion picker, saved as one meal.
5. **Food logged confirmation** (snackbar) with undo.

### D. Water
- Quick-add buttons: **Pure water sachet (500 ml)**, Cup (250 ml), Bottle (750 ml), Custom.
- Daily progress with a friendly visual (e.g. filling glass), plus history for the week.

### E. Body and progress
1. **Log weight** (optional waist circumference).
2. **Progress screen**: weight trend chart (week / month / 3 months), BMI over time with category bands, goal line, streaks (days logged).
3. **BMI explainer**: what BMI means, categories and its limits ("BMI is a screening tool, not a diagnosis").

### F. Learn (newsfeed)
1. **Feed** with filter chips: **Global · Nigeria · Prevention tips**. Cards show image, title, 1-line summary, read time and a **"Reviewed by a dietitian"** badge.
2. **Article view**: readable typography, source citation, share to WhatsApp, save.

### G. Me / settings
- Profile, edit body details and conditions, targets (read-only for consumers), reminders, units, plan and billing, privacy and data (download/delete my data), help, disclaimer, log out.
- **Locked Workbench teaser** for consumers.

### H. Professional Workbench (web, full; mobile, simplified)
The **core pro screen**. Layout: **inputs on the left, results on the right**, with a top bar for client/case selection (dietitians) or "Practice case" (students).

1. **Inputs panel:** sex, age, weight, height, (optional) body fat %, activity level / PAL value, physiological state (none / pregnant trimester 1–3 / lactating), clinical stress factor (optional, pro only).
2. **BMR results**: an equation selector with **Mifflin-St Jeor (default), Harris-Benedict (revised), Schofield (FAO/WHO/UNU)**, and Katch-McArdle if body fat is entered. Include a **"Compare all"** toggle that shows a small table of all results side by side.
3. **Energy requirement**: BMR × PAL = TEE, shown as a clear step-by-step calculation.
4. **Calorie distribution**:
   - Macro split sliders or inputs (carbs / protein / fat %), with AMDR reference ranges shown (CHO 45–65%, protein 10–35%, fat 20–35%). Show a warning if outside range, and enforce a 100% total.
   - Presets: Standard, Diabetic-friendly, High-protein, Renal (placeholder).
   - Output in **% / kcal / grams** for each macro.
   - **Per-meal distribution** table (e.g. breakfast 25%, lunch 35%, dinner 30%, snacks 10%).
5. **Food sources for each nutrient**: pick a nutrient (protein, iron, calcium, vitamin A, fibre…) to see the top Nigerian food sources ranked per 100 g and per typical portion, with a source citation.
6. **Show working** (students): an expandable step-by-step derivation with the formula and the numbers substituted in.
7. **Practice cases** (students): a case card ("Mrs A, 30 y, 70 kg, 165 cm, moderately active…"). The student enters answers and the app checks them, showing ✓/✗ and the working.
8. **Export / print**: a clean one-page report preview (PDF style) with Kalorax branding, inputs, results, the equation used and a date stamp.
9. **Dietitian "My clients" list** (MVP stub): a simple list + "Add client". Show that full client management is coming soon.

### I. System screens
- Offline banner ("You're offline. Your logs will sync when you reconnect").
- **"Add Kalorax to your home screen"** prompt: an Android install banner, plus an iPhone instruction sheet (Share → Add to Home Screen). Show it after the user's first logged meal, not on first visit.
- **"New version available — Refresh"** update banner.
- Generic error, empty states (with illustrations), loading skeletons.
- Browser push notification examples (meal, water, weigh-in), plus a WhatsApp reminder mock. **WhatsApp/SMS is the main reminder channel**, because web push on iPhone only works once the app has been added to the home screen.

---

## 6. Sample data (use this so screens look real)

**Sample consumer:** Adaeze, female, 30 y, 165 cm, 70 kg, moderately active, goal: lose weight, no medical conditions.
- BMI = 70 / 1.65² = **25.7 → "Overweight"**
- Energy needs to maintain her weight ≈ 2,200 kcal. Her goal is weight loss, so the target shown to her is **"about 1,700 kcal"** (maintenance − 500, rounded to the nearest 50).
- Water target: **about 2.5 litres** (2,450 ml at 35 ml/kg, ~5 sachets)

**Same person in the Workbench (pro view):**
| Equation | BMR (kcal/day) |
|---|---|
| Mifflin-St Jeor | 1,420 |
| Harris-Benedict (revised) | 1,476 |
| Schofield (F, 30–60 y) | 1,438 |

- PAL 1.55 → TEE ≈ 1,420 × 1.55 = **2,201 kcal**
- Split 55 / 15 / 30 → **Carbs 1,210 kcal (303 g) · Protein 330 kcal (83 g) · Fat 660 kcal (73 g)**

**Sample consumer with a condition:** Musa, male, 52 y, type 2 diabetes. He sees the "Your target should be set by a dietitian" card.

**Sample diary day (Adaeze)**, using placeholder values:
- Breakfast: Bread (2 slices) + Akara (3 balls) + Tea with milk
- Lunch: Jollof rice (2 cooking spoons) + Fried plantain (5 pieces) + Chicken (1 medium piece)
- Snack: Groundnuts (1 small pack), Zobo (1 bottle)
- Dinner: Eba (1 medium wrap) + Egusi soup (1 serving) + Beef (2 small pieces)
- Water: 3 sachets + 1 cup

**Sample dietitian:** Dt. Folake Adeyemi, RD (verified badge).
**Sample student:** Tunde Bakare, 300L Nutrition & Dietetics (verified student badge).

> Calorie and nutrient values per food are **placeholders**: make them look plausible, and label the design file "sample data – not for clinical use". The real values will come from the food composition database.

---

## 7. Key user flows to link in the prototype

1. **New consumer:** Landing page → Welcome → Sign up (OTP) → Role: consumer → Profile setup → Results (target) → Reminders → Paywall (skip) → Home.
2. **Consumer with a condition:** profile setup with "Diabetes" ticked → Results with "set by a dietitian" card → Home without calorie ring.
3. **Log a meal:** Home → + Add → search "eba" → portion picker (medium wrap) → add combo with egusi + beef → Diary shows updated total → Home ring updates.
4. **Log water:** Home water card → tap sachet → progress updates.
5. **Log weight and view progress:** Me → Progress → Log weight → chart updates.
6. **Read news:** Learn → filter "Nigeria" → article → share to WhatsApp.
7. **Student:** Sign up → Role: student → Verification → pending → approved → Workbench → Practice case → answer → show working.
8. **Dietitian:** Workbench (web) → enter client data → compare equations → adjust macro split → per-meal distribution → export report.
9. **Consumer taps a locked Workbench feature** → explanation sheet ("For dietitians & nutrition students").

---

## 8. Design-ahead (low fidelity, Phase 2 — not MVP)

Provide **wireframe-level** concepts only, so the design system scales to:
- Personalised **meal plan** and meal schedule (weekly calendar, swap a meal, shopping list with ₦ estimates)
- **Pregnancy monitor** (gestational week, weight gain vs recommended range chart)
- **Child growth monitor** (child profiles, WHO growth chart with z-score bands, flags)
- **Interventions marketplace** (dietitian profiles, programme cards, booking, chat)
- **Food product marketplace** (vetted product cards with "Kalorax-vetted" and NAFDAC badges, "Sponsored" label)

---

## 9. Deliverables checklist

- [ ] Design system page: colours (light + dark), type scale, spacing, grid, icons, components (buttons, inputs, chips, cards, rings/gauges, charts, bottom nav, sheets, snackbars, badges incl. "Verified dietitian", "Verified student", "Reviewed by a dietitian", "Locked/Pro")
- [ ] All MVP screens in section 5 at mobile (360) with states, plus tablet (768) and desktop (1440) versions of Home, Diary, Add food, Progress and Learn
- [ ] Workbench web screens (full) + mobile simplified version
- [ ] Clickable prototype linking the 9 flows in section 7
- [ ] Low-fi wireframes for the section 8 features
- [ ] A short rationale (1 page): key design decisions, accessibility notes, and anything you recommend changing in this brief

## 10. Must-haves / don'ts

- ✅ Show the medical disclaimer in onboarding, Results and Settings.
- ✅ Every nutrition number in pro views shows its source/equation.
- ✅ Encouraging, non-judgemental tone, e.g. "You're 300 kcal over today. Tomorrow's a new day."
- ❌ Don't show formulas, equation names or editable macros to consumers.
- ❌ Don't auto-recommend supplements or "adjuncts" anywhere in the MVP.
- ❌ Don't show infant formula promotions anywhere (even in the Phase 2 concepts).
- ❌ No body-shaming imagery, and no "before/after" weight-loss photos.
