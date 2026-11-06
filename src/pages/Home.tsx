import { Bell, CalendarDays, Calculator, Droplets, GlassWater, Plus, Scale, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/Layout";
import { Card, DietitianCard, MacroTiles, MealTag, NutrientChips, PageHeader, Ring, SearchBox, Segments, Thumb } from "../components/ui";
import { ARTICLES } from "../data/articles";
import { CUISINES, cuisineOrder, foodById, nutrientsFor, type Cuisine } from "../data/foods";
import { regionById } from "../data/regions";
import { currentStreak } from "../lib/challenges";
import { recipeById } from "../data/recipes";
import { BMI_CATEGORY_LABEL, SACHET_ML, bmiCategory } from "../lib/nutrition";
import { bodySummary, dailyTotals, fmt } from "../state/derived";
import { MEALS, canUseWorkbench, portionOf, todayIso, useStore, type Meal } from "../state/store";

const ROLE_LABEL = { consumer: "Member", student: "Nutrition student", dietitian: "Dietitian" };

/** Popular dishes for quick logging, by cuisine (opens Add food with the dish searched). */
type Popular = { name: string; emoji: string; meal: Meal; query: string; photo: string };
const dish = (name: string, emoji: string, meal: Meal, query: string, photo = query): Popular => ({ name, emoji, meal, query, photo });
const POPULAR: Record<Cuisine, Popular[]> = {
  Nigerian: [
    { name: "Eba with Egusi soup & Beef", emoji: "🍲", meal: "Lunch", query: "eba", photo: "recipe:egusi-eba" },
    { name: "Jollof rice, Dodo & Chicken", emoji: "🍛", meal: "Lunch", query: "jollof", photo: "recipe:jollof-chicken" },
    { name: "Bread & Akara with Tea", emoji: "🧆", meal: "Breakfast", query: "akara", photo: "recipe:akara-pap" },
    { name: "Beans & Fried plantain", emoji: "🫘", meal: "Dinner", query: "beans", photo: "recipe:beans-dodo" },
  ],
  Continental: [
    { name: "Full English breakfast", emoji: "🍳", meal: "Breakfast", query: "english", photo: "english-breakfast" },
    { name: "Grilled salmon & vegetables", emoji: "🐟", meal: "Dinner", query: "salmon", photo: "grilled-salmon" },
    { name: "Spaghetti bolognese", emoji: "🍝", meal: "Lunch", query: "bolognese", photo: "bolognese" },
    { name: "Chicken Caesar salad", emoji: "🥗", meal: "Lunch", query: "caesar", photo: "caesar" },
  ],
  International: [
    { name: "Chicken shawarma", emoji: "🌯", meal: "Dinner", query: "shawarma", photo: "shawarma" },
    { name: "Pepperoni pizza", emoji: "🍕", meal: "Dinner", query: "pizza", photo: "pizza" },
    { name: "Chicken curry", emoji: "🍛", meal: "Lunch", query: "curry", photo: "chicken-curry" },
    { name: "Greek yoghurt & berries", emoji: "🫐", meal: "Breakfast", query: "yoghurt", photo: "yoghurt-bowl" },
  ],
  Ghanaian: [
    dish("Banku with grilled tilapia", "🐟", "Dinner", "banku"),
    dish("Waakye with shito", "🍛", "Lunch", "waakye"),
    dish("Kenkey with fried fish", "🫓", "Lunch", "kenkey"),
    dish("Kelewele", "🍌", "Snacks", "kelewele"),
  ],
  "East African": [
    dish("Ugali & sukuma wiki", "🥬", "Dinner", "ugali"),
    dish("Pilau", "🍛", "Lunch", "pilau"),
    dish("Chapati with chai", "☕", "Breakfast", "chapati"),
    dish("Nyama choma", "🍖", "Dinner", "nyama", "nyama-choma"),
  ],
  "South African": [
    dish("Pap & braai chicken", "🍗", "Dinner", "pap", "sa-pap"),
    dish("Bobotie", "🥘", "Dinner", "bobotie"),
    dish("Bunny chow", "🍞", "Lunch", "bunny", "bunny-chow"),
    dish("Rusks with coffee", "🍪", "Breakfast", "rusk"),
  ],
  Caribbean: [
    dish("Jerk chicken, rice & peas", "🍗", "Dinner", "jerk", "jerk-chicken"),
    dish("Ackee and saltfish", "🍳", "Breakfast", "ackee", "ackee-saltfish"),
    dish("Curry goat", "🍛", "Lunch", "curry goat", "curry-goat"),
    dish("Beef patty", "🥟", "Snacks", "patty"),
  ],
  Russian: [
    dish("Borscht with rye bread", "🍲", "Lunch", "borscht"),
    dish("Pelmeni with sour cream", "🥟", "Dinner", "pelmeni"),
    dish("Buckwheat kasha", "🥣", "Breakfast", "buckwheat", "grechka"),
    dish("Syrniki", "🥞", "Breakfast", "syrniki"),
  ],
  Indian: [
    dish("Dal & rice", "🍲", "Lunch", "dal"),
    dish("Chicken biryani", "🍛", "Dinner", "biryani"),
    dish("Masala dosa", "🌯", "Breakfast", "dosa", "masala-dosa"),
    dish("Butter chicken & naan", "🍛", "Dinner", "butter chicken", "butter-chicken"),
  ],
  Chinese: [
    dish("Chow mein", "🍜", "Lunch", "chow mein", "chow-mein"),
    dish("Kung pao chicken & rice", "🌶️", "Dinner", "kung pao", "kung-pao"),
    dish("Dumplings", "🥟", "Lunch", "dumplings", "jiaozi"),
    dish("Congee", "🥣", "Breakfast", "congee"),
  ],
};

export function Home() {
  const navigate = useNavigate();
  const { profile, diary, water, plan, planPortions, latestWeightKg, dietitianTarget, addWater } = useStore();
  const [filter, setFilter] = useState<Meal | "All">("All");
  const [query, setQuery] = useState("");
  const regionCuisines = cuisineOrder(regionById(profile?.region).cuisines).slice(0, 3);
  const [picked, setCuisine] = useState<Cuisine | null>(null);
  const cuisine = picked && regionCuisines.includes(picked) ? picked : regionCuisines[0];
  if (!profile || latestWeightKg === null) return null;

  const today = todayIso();
  const entries = diary.filter((e) => e.date === today);
  const totals = dailyTotals(entries);
  const s = bodySummary(profile, latestWeightKg, dietitianTarget);
  const waterMl = water[today] ?? 0;
  const cat = bmiCategory(s.bmi);
  const tip = ARTICLES[new Date().getDate() % ARTICLES.length];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const meals = filter === "All" ? MEALS : [filter];
  const streak = currentStreak(diary.map((e) => e.date), today);

  return (
    <div className="page page-aside">
      <div className="with-aside">
        <div>
          <PageHeader title={`${greeting}, ${profile.name}`} subtitle={new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}>
            <form
              className="row grow"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/add?q=${encodeURIComponent(query)}`);
              }}
            >
              <SearchBox value={query} onChange={setQuery} placeholder="Search any food" />
            </form>
            <Link to="/add" className="btn btn-primary"><Plus size={18} /> Log food</Link>
          </PageHeader>

          <div className="section-title"><h2>Today's summary</h2></div>
          {s.target.kind === "target" ? (
            <section className="card featured">
              <div className="featured-main">
                <div className="featured-row">
                  <Ring
                    value={totals.kcal}
                    max={s.target.kcal}
                    label={fmt(Math.abs(s.target.kcal - totals.kcal))}
                    sub={totals.kcal <= s.target.kcal ? "kcal left" : "kcal over"}
                  />
                  <div className="featured-meta">
                    <div className="meta"><span className="meta-icon"><Target size={18} /></span><div><span>Daily target</span><strong>{fmt(s.target.kcal)} kcal</strong></div></div>
                    <div className="meta"><span className="meta-icon"><CalendarDays size={18} /></span><div><span>Items logged</span><strong>{entries.length}</strong></div></div>
                    <div className="meta"><span className="meta-icon"><Scale size={18} /></span><div><span>BMI</span><strong>{fmt(s.bmi, 1)}</strong></div></div>
                    <div className="meta"><span className="meta-icon"><Droplets size={18} /></span><div><span>Water</span><strong>{fmt(waterMl / 1000, 1)} L</strong></div></div>
                  </div>
                </div>
                {totals.kcal > s.target.kcal && <p className="small">You're a bit over today. Tomorrow's a new day.</p>}
                {entries.length > 0 && totals.protein * 4 < totals.kcal * 0.1 && (
                  <p className="small">Protein is a bit low today. Try beans, fish, eggs or moi moi.</p>
                )}
                <Link to="/add" className="btn btn-primary btn-block">Log a meal</Link>
              </div>
              <MacroTiles m={totals} targetKcal={s.target.kcal} />
            </section>
          ) : (
            <>
              <section className="card featured">
                <div className="featured-main">
                  <h2>Food logged today</h2>
                  <p className="stat-value">{fmt(totals.kcal)} kcal</p>
                  <p className="muted small">from {entries.length} item{entries.length === 1 ? "" : "s"}</p>
                  <Link to="/add" className="btn btn-primary btn-block">Log a meal</Link>
                </div>
                <MacroTiles m={totals} />
              </section>
              <DietitianCard reason={s.target.reason} />
            </>
          )}

          <div className="section-title">
            <h2>Today's meals</h2>
            <div className="chip-group" role="group" aria-label="Filter meals">
              {(["All", ...MEALS] as const).map((m) => (
                <button key={m} className={`chip${filter === m ? " on" : ""}`} onClick={() => setFilter(m)}>{m}</button>
              ))}
            </div>
          </div>
          <ul className="food-rows">
            {meals.map((meal) => {
              const items = entries.filter((e) => e.meal === meal);
              if (items.length === 0) {
                return (
                  <li key={meal} className="empty-meal">
                    <div className="row"><MealTag meal={meal} /><span className="muted small">Nothing logged yet</span></div>
                    <Link className="btn btn-primary btn-small" to={`/add?meal=${meal}`}><Plus size={16} /> Add</Link>
                  </li>
                );
              }
              return items.map((e) => {
                const food = foodById(e.foodId);
                if (!food) return null;
                return (
                  <li key={e.id} className="food-row">
                    <Thumb emoji={food.emoji} photo={food.id} />
                    <div className="food-row-body">
                      <div className="food-row-top"><MealTag meal={meal} /><span className="tag tag-outline">{e.portionLabel}</span></div>
                      <strong>{food.name}</strong>
                      <NutrientChips m={nutrientsFor(food, e.grams)} />
                    </div>
                  </li>
                );
              });
            })}
          </ul>
        </div>

        <aside className="aside" aria-label="Your day">
          <div className="card row" style={{ justifyContent: "space-between" }}>
            <Link to="/me" className="profile-chip">
              <Avatar name={profile.name} />
              <span><strong>{profile.name}</strong><span className="muted small">{ROLE_LABEL[profile.role]}</span></span>
            </Link>
            <Link to="/reminders" className="icon-btn" aria-label="Reminders"><Bell size={18} /></Link>
          </div>

          <Card title="Water" action={<span className="muted small">{fmt(waterMl / 1000, 1)} / {fmt(s.waterTargetMl / 1000, 1)} L</span>}>
            <Segments value={waterMl} max={s.waterTargetMl} label={`${fmt(waterMl)} of ${fmt(s.waterTargetMl)} ml`} />
            <div className="chip-row">
              <button className="btn btn-secondary btn-small" onClick={() => addWater(today, SACHET_ML)}><GlassWater size={15} /> Sachet 500 ml</button>
              <button className="btn btn-secondary btn-small" onClick={() => addWater(today, 250)}>Cup 250 ml</button>
              <button className="btn btn-secondary btn-small" onClick={() => addWater(today, 750)}>Bottle 750 ml</button>
              {waterMl > 0 && <button className="chip chip-ghost" onClick={() => addWater(today, -250)}>Undo 250 ml</button>}
            </div>
          </Card>

          <Card title="Today's plan" action={<Link to="/plan" className="link">Meal plan →</Link>}>
            {MEALS.some((m) => plan[today]?.[m]) ? (
              <ul className="entry-list">
                {MEALS.map((m) => {
                  const r = recipeById(plan[today]?.[m] ?? "");
                  return r ? (
                    <li key={m}>
                      <Thumb emoji={r.emoji} size="sm" photo={`recipe:${r.id}`} />
                      <div><span className="muted small">{m}</span><Link to={`/recipes/${r.id}`} className="row-title small">{r.name}</Link></div>
                      <span className="muted small">{fmt(r.kcal * portionOf(planPortions, today, m))} kcal</span>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted small">Nothing planned for today.</span>
                <Link to="/plan" className="btn btn-secondary btn-small">Plan your week</Link>
              </div>
            )}
          </Card>

          <Card title="Weight & BMI" action={<Link to="/progress" className="link">Progress →</Link>}>
            <div className="stat">
              <strong className="stat-value">{fmt(latestWeightKg, 1)} kg</strong>
              <span className="small">BMI {fmt(s.bmi, 1)} · <span className={`pill pill-${cat}`}>{BMI_CATEGORY_LABEL[cat]}</span></span>
            </div>
          </Card>

          {canUseWorkbench(profile) && (
            <Card title="Professional Workbench" className="card-accent">
              <p className="small">BMR, energy requirements and calorie distribution.</p>
              <Link to="/workbench" className="btn btn-primary"><Calculator size={18} /> Open Workbench</Link>
            </Card>
          )}

          <Link to="/challenges" className="card streak-link">
            <span className="streak-flame" aria-hidden>🔥</span>
            <span className="grow">
              <strong>{streak > 0 ? `${streak}-day streak` : "Start a streak today"}</strong>
              <span className="muted small">{streak > 0 ? "Log a meal today to keep it going. See this week's challenges." : "Log a meal each day and take on this week's challenges."}</span>
            </span>
            <Trophy size={20} aria-hidden />
          </Link>

          <div className="section-title"><h2>Popular dishes</h2></div>
          <div className="seg seg-pill" role="tablist" aria-label="Cuisine" style={{ marginBottom: "0.75rem" }}>
            {regionCuisines.map((id) => CUISINES.find((c) => c.id === id)!).map((c) => (
              <button key={c.id} role="tab" aria-selected={cuisine === c.id} className={cuisine === c.id ? "on" : ""} onClick={() => setCuisine(c.id)}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <ul className="food-rows">
            {POPULAR[cuisine].map((p) => (
              <li key={p.name} className="food-row">
                <Thumb emoji={p.emoji} size="sm" photo={p.photo} />
                <div className="food-row-body">
                  <strong className="small">{p.name}</strong>
                  <MealTag meal={p.meal} />
                </div>
                <Link to={`/add?meal=${p.meal}&q=${p.query}`} className="icon-btn sm lime" aria-label={`Log ${p.name}`}><Plus size={16} /></Link>
              </li>
            ))}
          </ul>

          <div className="section-title"><h2>Tip of the day</h2></div>
          <Link to={`/learn/${tip.id}`} className="card tip">
            <span className="tag tag-breakfast">{tip.topic}</span>
            <strong>{tip.title}</strong>
            <span className="muted small">{tip.summary}</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
