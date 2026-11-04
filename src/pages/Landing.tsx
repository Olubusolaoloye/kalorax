import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  Droplets,
  Dumbbell,
  Footprints,
  HeartHandshake,
  Lock,
  NotebookPen,
  ShieldCheck,
  ShoppingBasket,
  Stethoscope,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Thumb } from "../components/ui";
import { WaitlistForm } from "../components/WaitlistForm";
import { useStore } from "../state/store";
import { ARTICLES } from "../data/articles";
import { CUISINES, FOODS } from "../data/foods";
import { RECIPES } from "../data/recipes";
import {
  ACTIVITIES,
  BMR_EQUATION_INFO,
  activityById,
  activityKcal,
  calculateEnergy,
  compareBmr,
  consumerDailyTarget,
  type Anthropometrics,
} from "../lib/nutrition";
import { fmt } from "../state/derived";
import "./landing.css";
import { Logo } from "../components/Logo";

// The sample person from the design brief, run through the real engine.
const ADAEZE: Anthropometrics = { sex: "female", ageYears: 30, weightKg: 70, heightCm: 165 };
const BMR_ROWS = compareBmr(ADAEZE);
const TEE = calculateEnergy(ADAEZE, { equation: "mifflin", pal: 1.55 }).tee;
const TARGET = consumerDailyTarget({ ...ADAEZE, activity: "light", goal: "lose", conditions: [] });
const WALK_MIN = 30;
const WALK_KCAL = activityKcal(activityById("brisk-walking")!.met, ADAEZE.weightKg, WALK_MIN);
/** An example active week (minutes per day) for the bento visual. */
const WEEK_MINUTES: Array<[string, number]> = [["M", 30], ["T", 20], ["W", 45], ["T", 0], ["F", 30], ["S", 60], ["S", 15]];

const RIBBON = [
  ["jollof", "🍛", "Jollof rice"], ["egusi", "🍲", "Egusi soup"], ["moimoi", "🫘", "Moi moi"], ["suya", "🍢", "Suya"],
  ["efo", "🥬", "Efo riro"], ["shawarma", "🌯", "Shawarma"], ["akara", "🧆", "Akara"], ["pancakes", "🥞", "Pancakes"],
  ["ofada", "🍚", "Ofada rice"], ["bolognese", "🍝", "Bolognese"], ["okra", "🍲", "Okra soup"], ["chicken-curry", "🍛", "Chicken curry"],
  ["zobo", "🥤", "Zobo"], ["greek-salad", "🥗", "Greek salad"], ["ogbono", "🍲", "Ogbono"], ["sushi", "🍣", "Sushi"],
] as const;

const CUISINE_PHOTOS: Record<string, string> = { Nigerian: "recipe:egusi-eba", Continental: "english-breakfast", International: "pad-thai" };

const FAQ: Array<[string, ReactNode]> = [
  ["Is Nigerian food really in it?", <>Yes — that's the point. Eba, amala, pounded yam, jollof, ofada, egusi, efo riro, ogbono, moi moi, akara, suya and more, with local names and portions like wraps, cooking spoons and pieces. Continental and international dishes are there too.</>],
  ["Why don't I see BMR formulas?", <>Members get one simple daily target and a plate guide. The full calculations (BMR equations, energy requirements, macro distribution) live in the Professional Workbench for verified dietitians and nutrition students.</>],
  ["I have diabetes / high blood pressure / I'm pregnant. Can I use it?", <>Yes, for logging and learning. Kalorax won't auto-set a target for you — a dietitian should. Paid, dietitian-led programmes are coming.</>],
  ["Does it work on my phone without data?", <>Kalorax is a light web app you can add to your home screen. Your logs are saved on the device and it keeps working when you're offline.</>],
  ["Is my health data private?", <>Your data stays on your device in this early version. As accounts arrive, Kalorax is built to the Nigeria Data Protection Act's standard for sensitive health data.</>],
  ["Does Kalorax replace my doctor or dietitian?", <>No. Kalorax supports healthy eating and helps you work with professionals — it doesn't diagnose or prescribe.</>],
];

/** Fade sections in as they scroll into view (skipped when reduced motion is on). */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!els) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return root;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="lp-eyebrow">{children}</span>;
}

/** A phone built from real app pieces: calorie ring, tiles and a logged dish. */
function PhoneMock() {
  const target = TARGET.kind === "target" ? TARGET.kcal : 1700;
  const eaten = 1046;
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-phone-notch" />
      <div className="lp-phone-screen">
        <div className="lp-phone-top">
          <span>Good morning, Adaeze</span>
          <span className="lp-avatar">A</span>
        </div>
        <div className="lp-phone-hero">
          <svg viewBox="0 0 110 110" width="104" height="104">
            <circle cx="55" cy="55" r={r} className="lp-ring-track" />
            <circle cx="55" cy="55" r={r} className="lp-ring-value" strokeDasharray={`${(c * eaten) / target} ${c}`} transform="rotate(-90 55 55)" />
          </svg>
          <div className="lp-ring-text">
            <strong>{fmt(target - eaten)}</strong>
            <span>kcal left</span>
          </div>
          <div className="lp-phone-meta">
            <span>Target</span>
            <strong>{fmt(target)} kcal</strong>
            <span>Water</span>
            <strong>1.5 / 2.5 L</strong>
          </div>
        </div>
        <div className="lp-phone-tiles">
          <span className="t1">Carbs <b>126 g</b></span>
          <span className="t2">Protein <b>58 g</b></span>
          <span className="t3">Fat <b>34 g</b></span>
        </div>
        <div className="lp-phone-row">
          <Thumb emoji="🍛" size="sm" photo="jollof" />
          <div>
            <small>Lunch · 2 cooking spoons</small>
            <strong>Jollof rice</strong>
          </div>
          <b>224</b>
        </div>
        <div className="lp-phone-row">
          <Thumb emoji="🫘" size="sm" photo="moimoi" />
          <div>
            <small>Breakfast · 1 wrap</small>
            <strong>Moi moi</strong>
          </div>
          <b>225</b>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const root = useReveal();
  const { mode } = useStore();
  const nigerian = FOODS.filter((f) => f.cuisine === "Nigerian").length;

  return (
    <div className="lp" ref={root}>
      <div className="lp-aura" aria-hidden>
        <span className="a1" /><span className="a2" /><span className="a3" />
      </div>

      <header className="lp-nav">
        <Link to="/" className="lp-brand"><Logo size={30} /></Link>
        <nav aria-label="Sections">
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#pros">For professionals</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="row" style={{ gap: "0.35rem" }}>
          {mode === "cloud" && <Link to="/auth" className="lp-signin">Sign in</Link>}
          <Link to="/start" className="lp-btn lp-btn-dark lp-btn-sm">{mode === "cloud" ? "Get started" : "Open the app"}</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-copy" data-reveal>
          <h1>
            Eat well.
            <br />
            Move more.
            <br />
            <em>Feel good.</em>
          </h1>
          <p className="lp-lead">
            Kalorax brings your meals, water and movement together in one calm place — with portions that match real plates,
            from jollof and egusi to pasta and salads. Small, steady habits, backed by dietitians.
          </p>
          <div className="lp-cta-row">
            <Link to="/start" className="lp-btn lp-btn-lime">Start free <ArrowRight size={18} aria-hidden /></Link>
            <a href="#pros" className="lp-btn lp-btn-ghost">I'm a dietitian or student</a>
          </div>
          <ul className="lp-proof">
            <li><Check size={15} aria-hidden /> Free to start</li>
            <li><Check size={15} aria-hidden /> Works offline</li>
            <li><Check size={15} aria-hidden /> No app store needed</li>
          </ul>
        </div>

        <div className="lp-hero-visual" data-reveal>
          <div className="lp-orbit" aria-hidden />
          <PhoneMock />
          <div className="lp-float f1" aria-hidden>
            <Thumb emoji="🫓" size="sm" photo="eba" />
            <div><strong>Eba · medium wrap</strong><span>250 g · 400 kcal</span></div>
          </div>
          <div className="lp-float f2" aria-hidden>
            <span className="lp-float-icon warm"><Footprints size={18} /></span>
            <div><strong>Brisk walk · {WALK_MIN} min</strong><span>≈ {fmt(WALK_KCAL)} kcal burned</span></div>
          </div>
          <div className="lp-float f3" aria-hidden>
            <span className="lp-float-icon lime"><BadgeCheck size={18} /></span>
            <div><strong>Plan by a verified dietitian</strong><span>1-to-1 programmes</span></div>
          </div>
        </div>
      </section>

      {/* Facts strip (real counts from the app) */}
      <section className="lp-facts" data-reveal>
        <div><strong>{FOODS.length}</strong><span>dishes with portion guides</span></div>
        <div><strong>{nigerian}</strong><span>Nigerian staples, with local names</span></div>
        <div><strong>{ACTIVITIES.length}</strong><span>activities with calorie estimates</span></div>
        <div><strong>{RECIPES.length}</strong><span>recipes you can plan and shop for</span></div>
      </section>

      {/* Dish ribbon */}
      <section className="lp-ribbon" aria-label="Some of the dishes in Kalorax">
        <div className="lp-ribbon-track">
          {[...RIBBON, ...RIBBON].map(([key, emoji, name], i) => (
            <span key={`${key}-${i}`} className="lp-dish" aria-hidden={i >= RIBBON.length}>
              <Thumb emoji={emoji} size="sm" photo={key} />
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Product bento */}
      <section className="lp-section" id="product">
        <div className="lp-head" data-reveal>
          <Eyebrow>The product</Eyebrow>
          <h2>Everything you need to feel your best, <em>nothing you don't.</em></h2>
          <p>One quiet place for your meals, water, movement and progress — designed around how people really eat and live.</p>
        </div>

        <div className="lp-bento">
          <article className="lp-tile span-2 tall" data-reveal>
            <div className="lp-tile-copy">
              <span className="lp-icon"><NotebookPen size={20} /></span>
              <h3>Portion guides that make sense</h3>
              <p>No food scale needed. Pick a small, medium or large wrap, a cooking spoon or a piece — Kalorax does the maths.</p>
            </div>
            <div className="lp-portions" aria-hidden>
              {[
                ["Small wrap", "150 g", 0.55],
                ["Medium wrap", "250 g", 0.78],
                ["Large wrap", "350 g", 1],
              ].map(([label, g, s], i) => (
                <div key={label as string} className={`lp-portion${i === 1 ? " on" : ""}`}>
                  <span className="lp-portion-dot" style={{ ["--s" as string]: s }} />
                  <strong>{label}</strong>
                  <small>{g}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="lp-tile" data-reveal>
            <span className="lp-icon"><Droplets size={20} /></span>
            <h3>Water, by the sachet</h3>
            <p>Tap a sachet, cup or bottle. Your target adjusts to your body.</p>
            <div className="lp-sachets" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < 3 ? "on" : ""} />)}
            </div>
          </article>

          <article className="lp-tile" data-reveal>
            <span className="lp-icon"><HeartHandshake size={20} /></span>
            <h3>Notes on how you felt</h3>
            <p>After each meal: a mood, a tag, a line. Spot patterns gently.</p>
            <div className="lp-feelings" aria-hidden>
              <span>😕</span><span>😐</span><span className="on">🙂</span><span>😄</span>
              <em>Satisfied · Energised</em>
            </div>
          </article>

          <article className="lp-tile span-2" data-reveal>
            <div className="lp-split">
              <div>
                <span className="lp-icon"><CalendarRange size={20} /></span>
                <h3>Plan the week. Shop it in one tap.</h3>
                <p>Fill a week with Naija, continental or international recipes, then get a grocery list with ₦ estimates.</p>
              </div>
              <div className="lp-mini-plan" aria-hidden>
                {[
                  ["Mon", "moimoi", "🫘", "recipe:jollof-chicken", "🍛", "recipe:egusi-eba", "🍲"],
                  ["Tue", "recipe:akara-pap", "🧆", "chicken-curry", "🍛", "recipe:beans-dodo", "🍌"],
                  ["Wed", "oatmeal", "🥣", "bolognese", "🍝", "shawarma", "🌯"],
                ].map(([day, a, ae, b, be, c, ce]) => (
                  <div key={day} className="lp-plan-row">
                    <span>{day}</span>
                    <Thumb emoji={ae} size="sm" photo={a} />
                    <Thumb emoji={be} size="sm" photo={b} />
                    <Thumb emoji={ce} size="sm" photo={c} />
                  </div>
                ))}
                <div className="lp-basket"><ShoppingBasket size={16} /> 29 items · ₦34,410 est.</div>
              </div>
            </div>
          </article>

          <article className="lp-tile span-2" data-reveal>
            <div className="lp-split">
              <div>
                <span className="lp-icon"><Dumbbell size={20} /></span>
                <h3>Move more, see what it does</h3>
                <p>Log walks, dance, football, gym or house chores. Kalorax estimates the energy you burn and tracks your weekly minutes.</p>
              </div>
              <div className="lp-activity" aria-hidden>
                <div className="lp-activity-head">
                  <strong>{WEEK_MINUTES.reduce((t, [, m]) => t + m, 0)} min</strong>
                  <span>of 150 min weekly goal</span>
                </div>
                <div className="lp-bars">
                  {WEEK_MINUTES.map(([d, m], i) => (
                    <div key={i} className="lp-bar">
                      <i style={{ height: `${Math.max(6, (m / 60) * 100)}%` }} className={m === 0 ? "rest" : ""} />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="lp-tile" data-reveal>
            <span className="lp-icon"><BookOpen size={20} /></span>
            <h3>Insights you can trust</h3>
            <p>{ARTICLES.length} short reads on portions, salt, iron and more — reviewed by dietitians, shareable on WhatsApp.</p>
          </article>
        </div>
      </section>

      {/* Cuisines */}
      <section className="lp-section lp-cuisines">
        <div className="lp-head" data-reveal>
          <Eyebrow>Three kitchens</Eyebrow>
          <h2>From the buka to the bistro.</h2>
        </div>
        <div className="lp-cuisine-grid">
          {CUISINES.map((c) => {
            const count = FOODS.filter((f) => f.cuisine === c.id).length;
            return (
              <Link key={c.id} to="/start" className="lp-cuisine" data-reveal>
                <Thumb emoji={c.emoji} size="lg" photo={CUISINE_PHOTOS[c.id]} />
                <div className="lp-cuisine-copy">
                  <span>{c.emoji} {count} dishes</span>
                  <h3>{c.label}</h3>
                  <p>{c.blurb}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section" id="how">
        <div className="lp-head" data-reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2>Three calm steps.</h2>
        </div>
        <ol className="lp-steps">
          {[
            ["Tell us about you", "A few gentle questions: your body, your day, your goal. Anything medical? We'll point you to a dietitian instead of guessing."],
            ["Log what you really eat", "Search in your own words — garri, iyan, shawarma — pick the portion, build the combo. About ten seconds a meal."],
            ["Move, see, adjust", "Add your walks and workouts, see your day and week at a glance, and get insights that nudge rather than nag."],
          ].map(([t, d], i) => (
            <li key={t} data-reveal>
              <span className="lp-step-num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Professionals */}
      <section className="lp-pros" id="pros">
        <div className="lp-pros-inner">
          <div className="lp-pros-copy" data-reveal>
            <Eyebrow>For dietitians &amp; nutrition students</Eyebrow>
            <h2>A professional workbench, <em>built in.</em></h2>
            <p>
              Compare BMR equations side by side, apply activity, stress and pregnancy factors, distribute calories by macro
              and meal — with every step shown, and a printable report.
            </p>
            <ul className="lp-checks">
              <li><Check size={16} aria-hidden /> Mifflin-St Jeor, Harris-Benedict, Schofield, Katch-McArdle</li>
              <li><Check size={16} aria-hidden /> Show-working mode and practice cases for students</li>
              <li><Check size={16} aria-hidden /> Licence and student verification</li>
              <li><Check size={16} aria-hidden /> Paid client programmes, with chat, check-ins and meal plans</li>
            </ul>
            <Link to="/start" className="lp-btn lp-btn-lime">Get verified access <ArrowRight size={18} aria-hidden /></Link>
          </div>
          <div className="lp-wb" data-reveal aria-label="Example workbench output">
            <div className="lp-wb-head">
              <span>Case · F, 30 y, 70 kg, 165 cm</span>
              <span className="lp-wb-badge">PRO</span>
            </div>
            <table>
              <thead><tr><th>Equation</th><th>BMR</th></tr></thead>
              <tbody>
                {BMR_ROWS.map((row) => (
                  <tr key={row.equation} className={row.equation === "mifflin" ? "on" : ""}>
                    <td>{BMR_EQUATION_INFO[row.equation].name}</td>
                    <td>{fmt(row.kcal)} kcal</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre>{`TEE = BMR × PAL\n    = ${fmt(BMR_ROWS[0].kcal, 1)} × 1.55\n    = ${fmt(TEE, 1)} kcal/day`}</pre>
            <div className="lp-wb-macros">
              <span style={{ flex: 55 }}>C 55%</span>
              <span style={{ flex: 15 }}>P 15%</span>
              <span style={{ flex: 30 }}>F 30%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="lp-section">
        <div className="lp-head" data-reveal>
          <Eyebrow>Care built in</Eyebrow>
          <h2>Kind by design. <em>Safe by default.</em></h2>
        </div>
        <div className="lp-trust">
          {[
            [<Stethoscope size={20} key="i" />, "Dietitian-first for conditions", "Diabetes, high blood pressure, kidney disease or pregnancy? No automatic targets — a dietitian sets yours."],
            [<ShieldCheck size={20} key="i" />, "No supplement pushing", "Kalorax never auto-recommends supplements. Any adjunct comes from a verified professional."],
            [<Lock size={20} key="i" />, "Private by default", "Health data treated as sensitive, built to the Nigeria Data Protection Act standard."],
            [<HeartHandshake size={20} key="i" />, "No shaming, ever", "Encouraging language, no before-and-after photos, no fad diets."],
          ].map(([icon, t, d]) => (
            <div key={t as string} className="lp-trust-item" data-reveal>
              <span className="lp-icon soft">{icon}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-section" id="pricing">
        <div className="lp-head" data-reveal>
          <Eyebrow>Pricing</Eyebrow>
          <h2>Start free. <em>Grow when you're ready.</em></h2>
          <p>Planned pricing for launch — subject to change.</p>
        </div>
        <div className="lp-plans">
          {[
            { name: "Free", price: "₦0", note: "forever", items: ["BMI and daily target", "Food diary and water", "Notes and insights"], cta: "Start free" },
            { name: "Premium", price: "₦2,500", note: "per month", items: ["Everything in Free", "Meal plans and grocery lists", "Detailed nutrient reports"], cta: "Start free", featured: true },
            { name: "Student", price: "₦1,000", note: "per month", items: ["Workbench in learning mode", "Show working and practice cases", "Verified student badge"], cta: "Verify as a student" },
            { name: "Dietitian Pro", price: "₦7,500", note: "per month", items: ["30-day free trial", "Full workbench and reports", "Client tools, chat and paid programmes"], cta: "Verify your licence" },
          ].map((p) => (
            <div key={p.name} className={`lp-plan${p.featured ? " is-featured" : ""}`} data-reveal>
              {p.featured && <span className="lp-plan-flag">Recommended</span>}
              <h3>{p.name}</h3>
              <div className="lp-price"><strong>{p.price}</strong><span>{p.note}</span></div>
              <ul>{p.items.map((i) => <li key={i}><Check size={15} aria-hidden /> {i}</li>)}</ul>
              <Link to="/start" className={`lp-btn ${p.featured ? "lp-btn-lime" : "lp-btn-ghost"} lp-btn-block`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section lp-faq" id="faq">
        <div className="lp-head" data-reveal>
          <Eyebrow>Questions</Eyebrow>
          <h2>Good to know.</h2>
        </div>
        <div className="lp-faq-list" data-reveal>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}<ChevronDown size={18} aria-hidden /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-final" data-reveal>
        <h2>Small steps. <em>Real change.</em></h2>
        <p>Log one meal or one walk today. It takes less than a minute.</p>
        <Link to="/start" className="lp-btn lp-btn-lime lp-btn-lg">Start free <ArrowRight size={18} aria-hidden /></Link>
        {mode === "cloud" && (
          <div className="lp-waitlist-wrap">
            <p className="small">Dietitian, student or just curious? Get launch news and early access.</p>
            <WaitlistForm />
          </div>
        )}
      </section>

      <footer className="lp-footer">
        <Link to="/" className="lp-brand"><Logo size={26} /></Link>
        <p>Kalorax supports healthy eating but does not replace advice from your doctor or dietitian.</p>
        <nav aria-label="Footer">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <Link to="/credits">Photo credits</Link>
        </nav>
      </footer>
    </div>
  );
}
