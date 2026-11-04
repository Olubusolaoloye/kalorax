# Kalorax — Product Strategy & Plan

_Draft 1 · October 2026_

This plan reviews Kalorax from seven angles, the way a full founding team would:

| Seat | Focus |
|---|---|
| Product strategist | Scope, phasing, what to build first |
| Clinical dietitian | Nutrition science, safety, clinical credibility |
| Data / ML lead | Food composition data, portion estimation, predictions |
| Engineering lead | Architecture, stack, offline use, security |
| Regulatory & compliance | Health data law, liability, product vetting |
| Business & monetisation | Revenue model, pricing, unit economics |
| Growth & partnerships | Go-to-market, distribution, trust |

---

## 1. The idea in one sentence

**Kalorax is a localised nutrition platform. Everyday users track, plan and improve how they eat. Dietitians and nutrition students get professional calculation tools. People with clinical needs pay for dietitian-led interventions. Vetted food sellers pay to reach them.**

That makes it four products in one app. This is the biggest strategic risk, and the plan below is built around managing it:

1. **Consumer app**: BMI, food diary, water, meal schedule, pregnancy and child growth monitors, newsfeed.
2. **Professional workbench**: BMR, energy requirements, calorie and macro distribution, client management. Dietitians and students only.
3. **Interventions marketplace**: paid, dietitian-supervised plans for conditions such as diabetes, hypertension, CKD, obesity, PCOS, malnutrition and pregnancy.
4. **Food product marketplace**: vetted sellers, with Kalorax paid per sale and for visibility.

---

## 2. Team evaluation: what is strong, what needs to change

### ✅ Strengths
- **Local food composition is a real gap.** Most global apps (MyFitnessPal, Cronometer) cover Nigerian and West African foods such as eba, amala, ogbono soup, moi moi and akara poorly. Owning this data is a lasting advantage.
- **Pregnancy and child growth fill a public-health gap.** Malnutrition and stunting are major issues in Nigeria and across sub-Saharan Africa, so these features open doors to NGOs, government and donor partners, not just consumers.
- **Several revenue streams:** subscriptions, interventions, professional seats and marketplace fees.
- **A professional tier builds credibility.** If dietitians use Kalorax, consumers trust it.

### ⚠️ Issues to fix in the design

**1. The "BMR and energy only for professionals" rule conflicts with personalised meal plans.**
A personalised meal plan *needs* an energy requirement. If consumers can't access it, the app can't personalise for them.
- **Recommendation:** Compute energy needs **on the server for everyone**, but expose them differently:
  - **Consumers** see a friendly result, e.g. "Your daily target: ~2,100 kcal", with a plate split. They see no formulas or equation choices and can't edit anything. This keeps the feature safe and simple.
  - **Dietitians and students** get the full **workbench**. They choose the equation (Mifflin-St Jeor, Harris-Benedict, Schofield/FAO-WHO, Henry), set activity and stress factors, edit macro distribution, compare equations side by side, export results, and override targets for their clients.
  - Consumers with a medical condition **don't get an auto-calculated target**. They are routed to a dietitian, who sets the target in the workbench.

**2. "Recommend adjuncts by age and disease" carries the highest liability in the app.**
Automatically recommending supplements or therapeutic foods for disease could cause harm (drug–nutrient interactions, CKD and potassium, pregnancy and vitamin A). It may also make the app a regulated medical device.
- **Recommendation:** The app **never auto-prescribes**. It may show *general, evidence-based education*, e.g. "Folic acid is recommended for women planning pregnancy; speak to your provider." Any condition-specific adjunct must be **set or approved by a verified dietitian** inside a paid intervention. Every recommendation records who approved it.

**3. Photo-based "food models" that predict portion size are hard.**
Photo portion estimation is still hard for research teams, and harder for mixed Nigerian dishes (soups with swallow, stews).
- **Recommendation:** Start with **visual portion guides**: photos of local household measures and serving sizes, e.g. "1 wrap of eba (fist-size)", "1 cooking spoon of jollof", "1 medium piece of meat", with gram weights. Then collect labelled photos from users who opt in. Once that dataset is big enough, add AI photo estimation in Phase 3. This is safer and buildable now, and it creates the training data you need later.

**4. Two marketplaces at launch is too much.**
Each marketplace has a chicken-and-egg problem. You need buyers to attract sellers and sellers to attract buyers.
- **Recommendation:** Launch the **interventions** marketplace first. It uses your own expertise and network, and its margins are higher. Launch the **food product** marketplace later, starting as a **vetted directory with order links**, then move to full in-app checkout and commission once you have traffic.

**5. The newsfeed must be curated, not scraped.**
Nutrition misinformation is everywhere. If you aggregate it, you damage trust.
- **Recommendation:** Publish **editorial content reviewed by dietitians**, plus summaries of trusted sources (WHO, FAO, UNICEF, NCDC, the Federal Ministry of Health, national surveys). Each item is tagged *Global / National / Prevention tip*.

---

## 3. Users and personas

| Persona | Need | Pays for |
|---|---|---|
| **Health-conscious adult** (22–45, urban) | Weight management, eating better, tracking | Premium subscription |
| **Person with a condition** (diabetes, hypertension, CKD, PCOS, obesity) | Expert guidance that fits local foods | Paid interventions |
| **Pregnant woman / new mother** | Safe weight gain, nutrition, infant feeding | Premium, or a pregnancy package |
| **Caregiver of a child under 5** | Is my child growing well? What should I feed them? | Premium; often free through NGO or clinic partners |
| **Dietitian** | Calculations, client management, earning from consultations | Pro subscription plus revenue share on interventions |
| **Nutrition / dietetics student** | Learning tools, practice calculations, case studies | Low-cost student plan |
| **Food seller / brand** | Reaching health-focused buyers | Commission per sale plus featured listings |
| **Institutions** (hospitals, HMOs, employers, NGOs) | Population nutrition, staff wellness, programme monitoring | B2B licences |

---

## 4. Full feature map

### A. Body metrics and assessment
- **BMI** (everyone): kg/m², with WHO categories. Add a note that BMI is a screening tool, not a diagnosis. Optional waist circumference and waist-to-height ratio, which are better at flagging cardiometabolic risk.
- **BMI trend monitoring:** weight log, chart over time, goal line.
- **Pro workbench only:**
  - **BMR:** Mifflin-St Jeor (default), Harris-Benedict (revised), Schofield / FAO-WHO-UNU, Henry (Oxford). Katch-McArdle if body fat % is known.
  - **Energy requirement (TEE):** BMR × PAL (physical activity level). Add stress and injury factors for clinical cases, plus pregnancy and lactation increments.
  - **Calorie distribution:** carbs / protein / fat split, defaulting to AMDR ranges (CHO 45–65%, protein 10–35%, fat 20–35%). Add condition presets (diabetic, renal, high-protein) and per-meal distribution (breakfast, lunch, dinner, snacks).
  - **Food sources for each nutrient:** "Top local sources of iron / calcium / vitamin A / protein / fibre", drawn from the food composition table.
  - **Side-by-side equation comparison** and **printable / exportable reports**.
  - **Student mode:** worked examples that show each step, plus practice cases with answer checking.

### B. Food composition table (by location)
- Main sources: the **West African Food Composition Table (FAO/INFOODS)**, the **Nigerian Food Composition Table**, and other national tables. **USDA FoodData Central** fills gaps.
- Each food stores: local names (English, Yoruba, Igbo, Hausa, Pidgin…), region, energy and macro/micronutrients per 100 g, household measures in grams, and the data source.
- **Location-aware search:** a user in Lagos sees "ofada rice" before "basmati".
- **Recipe builder:** compute nutrients for mixed dishes such as egusi soup, using cooking yield factors.
- **Dietitian contributions:** professionals can submit foods and recipes, which are reviewed before publishing. This is your data moat.

### C. Food diary and portion estimation
- Log meals by search, recent and favourite foods, saved meals, or barcode for packaged foods.
- **Visual portion guides** (Phase 1) → **AI photo estimation** (Phase 3).
- Daily and weekly totals compared with targets: energy, macros and key micronutrients.
- Notes on mood, hunger and symptoms. This is useful for interventions such as IBS and diabetes.

### D. Meal planning and scheduling
- **Personalised meal plans** built from the energy target, preferences, budget, culture/religion (halal, fasting periods), allergies and **local food availability**.
- **Meal schedule** with reminders ("Lunch at 1pm: beans & plantain").
- **Swap engine:** "Swap this for something similar" (same calories, locally available, within budget).
- **Shopping / sourcing plan:** an auto-generated grocery list from the weekly plan, with estimated cost. Later it links to marketplace sellers and nearby markets.

### E. Alerts and reminders
- Meal times, water, weigh-ins, supplement times (if a dietitian prescribed them), antenatal visit reminders, child growth check reminders and immunisation-linked feeding milestones.
- Smart alerts such as "You're low on protein today" or "No water logged since 10am".
- **Low-data option:** SMS or WhatsApp reminders. Many target users are on WhatsApp more than in apps.

### F. Water intake
- Quick-tap logging (cup, sachet "pure water" = 500 ml, bottle sizes).
- Target based on body weight, activity and climate, with higher targets for pregnancy and lactation.

### G. Pregnancy monitor
- Gestational age and trimester tracking.
- **Gestational weight gain** tracked against **IOM 2009 ranges by pre-pregnancy BMI**.
- Trimester-specific energy additions and key nutrients: folate, iron, iodine, calcium, DHA, choline.
- Food safety guidance (foods to avoid), nausea and heartburn tips, and warning signs that point users to clinic visits.
- Continues into **lactation mode** after delivery.

### H. Child growth monitor (infant and young child feeding, IYCF)
- **WHO Child Growth Standards (0–5 y)** and **WHO 2007 Growth Reference (5–19 y)**.
- Plot and calculate **z-scores**: weight-for-age, length/height-for-age, weight-for-length/height, BMI-for-age, plus **MUAC** (mid-upper arm circumference).
- Automatic flags for **underweight, stunting, wasting and overweight**, with "see a health worker" prompts for moderate or severe cases.
- IYCF guidance: exclusive breastfeeding to 6 months, then complementary feeding by age with locally made recipes (e.g. enriched pap / ogi with crayfish and groundnut), minimum dietary diversity and meal frequency.
- Multiple child profiles under one caregiver account.

### I. Paid interventions
- Programmes such as **Diabetes Control (12 weeks)**, **Hypertension (DASH, localised)**, **Weight Loss**, **PCOS**, **CKD**, **Pregnancy Nutrition**, **Child Catch-up Growth** and **Sports Nutrition**.
- Each includes: an intake assessment, a dietitian-set target and plan, weekly check-ins (chat or video), progress tracking, and adjuncts *approved by the dietitian*.
- Formats: one-off consultation, 4/8/12-week programmes, or group programmes (cheaper, scales better).
- Dietitians are verified and listed with ratings. Kalorax takes a platform fee.

### J. Food product marketplace
- **Vetting pipeline:** seller KYC → product submission → regulatory check (e.g. NAFDAC registration number for packaged foods in Nigeria) → label and nutrient review by a dietitian → approval badge → periodic re-checks and complaint handling.
- Products are tagged by benefit (e.g. "Low GI", "High protein", "Suitable for diabetics").
- Revenue: **commission per sale** plus **featured / sponsored listings**, always clearly labelled as sponsored. Sponsorship must never change clinical recommendations.

### K. Newsfeed
- Global, national and prevention tips, reviewed by dietitians.
- Seasonal and outbreak-aware content (e.g. cholera season → water hygiene; Ramadan → fasting nutrition).
- Short formats: cards, infographics, 60-second videos, local-language versions.

---

## 5. Access model (who sees what)

| Feature | Free | Premium | Student | Dietitian (Pro) |
|---|:-:|:-:|:-:|:-:|
| BMI + trend | ✅ | ✅ | ✅ | ✅ |
| Food diary (basic) | ✅ | ✅ | ✅ | ✅ |
| Water tracking | ✅ | ✅ | ✅ | ✅ |
| Newsfeed | ✅ | ✅ | ✅ | ✅ |
| Daily target (simple view) | ✅ | ✅ | ✅ | ✅ |
| Personalised meal plans + scheduling | Limited (1 sample) | ✅ | ✅ | ✅ |
| Shopping / sourcing lists | – | ✅ | ✅ | ✅ |
| Pregnancy & child growth monitors | Basic | Full | ✅ | ✅ |
| Detailed micronutrient reports | – | ✅ | ✅ | ✅ |
| **BMR / energy / calorie distribution workbench** | – | – | ✅ | ✅ |
| Nutrient food-source finder (pro view) | – | – | ✅ | ✅ |
| Worked examples & practice cases | – | – | ✅ | – |
| Client management, plan builder, reports | – | – | – | ✅ |
| Offer paid interventions | – | – | – | ✅ |
| Buy interventions | Pay per programme | Pay per programme (discount) | – | – |

**Verification:**
- **Dietitians:** licence or registration number, checked against the national dietetics register or professional body, plus ID.
- **Students:** institutional email or student ID upload, re-verified each year.

---

## 6. Business model

| Stream | How it works | Indicative pricing (Nigeria, to test) |
|---|---|---|
| Consumer Premium | Monthly / yearly subscription | ₦2,000–₦3,500/month; yearly at ~2 months free |
| Student plan | Discounted pro tools | ₦1,000–₦1,500/month or per semester |
| Dietitian Pro | Workbench + client tools | ₦5,000–₦10,000/month |
| Interventions | User pays per programme; Kalorax keeps 15–30% | ₦10,000–₦60,000 per programme |
| Marketplace commission | % of each sale | 8–15% |
| Featured listings | Sellers pay for visibility | Monthly placement fee |
| B2B / institutional | HMOs, employers, hospitals, NGOs, schools | Per-seat or per-programme licences |
| Grants / programmes | Child and maternal nutrition funding | Donor-funded deployments |

**Payments:** Paystack and/or Flutterwave (cards, bank transfer, USSD), with split payments for dietitian and seller payouts.

Treat prices as hypotheses and test them with real users before committing (see §10).

---

## 7. Phased roadmap

### Phase 0 — Validate (4–6 weeks)
- Interview 30–50 people across personas: consumers, pregnant women, caregivers, 10+ dietitians, students, 5+ sellers.
- Landing page + waitlist with tier pricing to measure intent.
- Secure 5–10 founding dietitians to co-design interventions and review content.
- Choose and license food composition data sources. Start the local food database (aim for 500+ common foods).

### Phase 1 — MVP (≈ 3–4 months)
Goal: a useful daily habit app plus the pro workbench.
- Delivered as a **mobile-first React PWA** (web app first; Play Store wrapper soon after).
- Accounts, profiles and roles (consumer / student / dietitian) with verification.
- BMI + weight trend; simple daily target for consumers.
- **Pro workbench:** BMR, TEE and calorie/macro distribution, with equation choice and export.
- Local food composition database and search.
- Food diary with visual portion guides.
- Water tracking.
- Basic reminders (push + WhatsApp/SMS).
- Curated newsfeed (manually published).
- Payments for Premium, Student and Pro.

### Phase 2 — Personalisation and paid care (≈ 3–4 months)
- Personalised meal plans, swap engine, scheduling, shopping lists.
- **Interventions marketplace:** dietitian profiles, booking, chat/video, programme templates, payouts.
- Pregnancy monitor and child growth monitor (WHO z-scores).
- Dietitian client management (see client diaries with consent).
- Nutrient food-source finder.

### Phase 3 — Marketplace and intelligence (≈ 4–6 months)
- Food product marketplace: vetting pipeline, seller dashboard, commission, featured listings.
- AI photo-based food recognition and portion estimation, trained on consented local data.
- Predictive insights, e.g. weight trajectory or "at this rate you'll reach your goal by…".
- B2B dashboards for HMOs, NGOs and employers.
- More countries (Ghana, Kenya…) with their own food composition tables.

---

## 8. Technology plan

| Layer | Recommendation | Why |
|---|---|---|
| App (Phase 1) | **React + Vite progressive web app (PWA)**, mobile-first and responsive | One codebase for the consumer app and the Pro Workbench. No big download, shareable on WhatsApp, instant updates |
| Play Store (Phase 1.5) | Package the same PWA as a Trusted Web Activity / Capacitor wrapper | A store listing for trust and discovery, without a rebuild |
| Native (Phase 3+, only if needed) | React Native, to reuse the React skills and code | Only if heavy camera AI or device sensors need it |
| Backend | **PostgreSQL** via Supabase (auth, storage, row-level security) or a NestJS/Node API | Fast to build; row-level security fits strict per-role access |
| Calculation engine | One versioned, server-side "nutrition engine" module (BMR, TEE, macros, z-scores, gestational weight gain) | One source of truth, tested against reference values, auditable |
| Offline | Local cache of the food database + offline diary logging that syncs later | Patchy connectivity, expensive data |
| Notifications | Firebase Cloud Messaging + WhatsApp Business API / SMS gateway | Reach users outside the app |
| Payments | Paystack / Flutterwave with split payouts | Local payment methods |
| ML (Phase 3) | Food image classification + portion estimation with a reference object | Built on consented local images |
| Analytics | Product analytics (PostHog / Mixpanel) | Retention and funnel metrics |

**Engineering must-dos:**
- Unit-test the calculation engine against published worked examples (WHO z-score tables, IOM weight gain ranges, equation reference values).
- Store **which equation, version and data source** produced every number, for clinical traceability.
- Encrypt health data at rest and in transit. Use role-based access. Log every time a dietitian views client data.

---

## 9. Regulatory, safety and trust

- **Data protection:** comply with the **Nigeria Data Protection Act (2023)**, plus GDPR principles if you expand. Health data counts as *sensitive personal data*, so you need explicit consent, a privacy policy, a data protection officer or contact, and data-minimisation. Data on children and pregnancy needs extra care.
- **Clinical safety:**
  - A clear disclaimer: Kalorax supports, but does not replace, medical care.
  - Escalation rules: red-flag symptoms in pregnancy, severe acute malnutrition in children, and very low BMI or rapid weight loss trigger "seek care now" messaging.
  - No auto-prescription of adjuncts (see §2).
  - Content and intervention templates reviewed and signed off by a clinical lead dietitian.
- **Professional verification:** licence checks for every dietitian, renewed periodically. Students can't offer paid services.
- **Product vetting:** NAFDAC (or local equivalent) registration for packaged foods, label claim checks, and a takedown process for complaints.
- **Advertising ethics:** sponsored items are always labelled. Follow the **International Code of Marketing of Breast-milk Substitutes**: **don't promote infant formula** to caregivers. This matters for the child growth module.
- **Legal docs:** Terms of Service, Privacy Policy, Dietitian Agreement, Seller Agreement, refund policy.

---

## 10. Go-to-market

1. **Dietitians first.** Each one brings clients. Recruit through professional associations, conferences and university departments. Offer free Pro for the first 6 months to founding dietitians.
2. **Students as ambassadors.** Campus programmes at schools with nutrition and dietetics departments. Students become future Pro users.
3. **Content-led growth.** Short local-food nutrition videos on TikTok, Instagram and YouTube, e.g. "How many calories in your plate of amala & ewedu?".
4. **WhatsApp communities** for pregnancy, diabetes and weight-loss groups, run by dietitians.
5. **Partnerships:** antenatal clinics, paediatric clinics, HMOs, corporate wellness programmes, NGOs working on maternal and child nutrition.
6. **Sellers last.** Once you have engaged health-focused users, sellers will pay to reach them.

---

## 11. Success metrics

| Area | KPI | Early target |
|---|---|---|
| Engagement | Weekly active users / monthly active users | > 35% |
| Habit | Days per week with a diary entry | ≥ 3 |
| Retention | Day-30 retention | > 20% |
| Conversion | Free → Premium | 3–5% |
| Pro | Verified dietitians active monthly | 50 in first 6 months |
| Interventions | Programme completion rate | > 60% |
| Outcomes | % of intervention users reaching their goal (weight, HbA1c reported, BP) | Track from day one |
| Child growth | % of flagged children referred | 100% shown a referral prompt |
| Marketplace | Gross merchandise value, repeat purchase rate | Phase 3 |

---

## 12. Key risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Too many features, slow launch | High | Strict phasing; MVP = tracking + pro workbench |
| Inaccurate food data | High | Use authoritative tables, record each source, dietitian review |
| Clinical harm / liability | High | No auto-prescribing, escalation rules, dietitian sign-off, insurance |
| Low willingness to pay | Medium | Strong free tier; B2B and NGO revenue; test pricing early |
| Data breach of health data | High | Encryption, row-level security, audits, minimal data collection |
| Seller fraud / fake products | Medium | KYC, regulatory number checks, reviews, fast takedown |
| Dietitian supply / quality | Medium | Verification, ratings, standard programme templates |
| Low data / low-end phones | Medium | Offline mode, light app, WhatsApp/SMS channel |

---

## 13. Core team to hire or assemble

| Role | When |
|---|---|
| Founder / product lead (you) — vision, clinical network | Now |
| Clinical lead dietitian (could be you) — content, protocols, safety sign-off | Now |
| Mobile + backend developers (2) | Phase 1 |
| UI/UX designer (local food visuals, portion photography) | Phase 0–1 |
| Nutrition data curator (food composition database) | Phase 0 |
| Growth / community manager | Phase 1 |
| Partnerships & sales (B2B, NGOs, sellers) | Phase 2 |
| ML engineer | Phase 3 |
| Legal / compliance advisor (part-time) | Phase 0 |

---

## 14. Decisions needed from you

1. **Launch market:** Nigeria only first, or Nigeria + Ghana?
2. **Consumer energy targets:** accept the hybrid approach in §2 (consumers see a simple target; professionals get the full workbench)?
3. **First three interventions** to build: suggested **Weight Management, Diabetes, Pregnancy Nutrition**.
4. **Build approach:** in-house developers, an agency, or a no-code/low-code prototype for validation first?
5. **Brand position:** clinical and professional, or friendly lifestyle? Recommendation: *"friendly on the outside, clinically sound inside."*

---

## 15. Immediate next steps (next 30 days)

- [ ] Confirm decisions in §14
- [ ] Run 30+ user interviews and 10+ dietitian interviews
- [ ] Build a landing page + waitlist with pricing tiers
- [ ] Compile the first 500 local foods with household measures
- [ ] Recruit 5 founding dietitians and 2 student ambassadors
- [ ] Design wireframes for the MVP screens (onboarding, BMI, diary, water, pro workbench)
- [ ] Specify and test the nutrition calculation engine
- [ ] Draft privacy policy, terms and the dietitian agreement
