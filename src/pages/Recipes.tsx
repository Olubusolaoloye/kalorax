import { ArrowLeft, CalendarPlus, ChefHat, Clock, Flame, Gauge, ListOrdered, Minus, NotebookPen, Plus, Timer, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, MacroTiles, MealTag, NutrientChips, PageHeader, SampleNotice, SearchBox, Sheet, Thumb } from "../components/ui";
import { CUISINES, RECIPE_PREFIX, type Cuisine } from "../data/foods";
import { INGREDIENTS, RECIPES, recipeById, type Recipe } from "../data/recipes";
import { fmt } from "../state/derived";
import { MEALS, todayIso, useStore, weekDates, type Meal } from "../state/store";

const totalMinutes = (r: Recipe) => r.prepMinutes + r.cookMinutes;

function RecipeMeta({ r }: { r: Recipe }) {
  return (
    <div className="featured-meta recipe-meta">
      <div className="meta"><span className="meta-icon"><Gauge size={18} /></span><div><span>Difficulty</span><strong>{r.difficulty}</strong></div></div>
      <div className="meta"><span className="meta-icon"><Timer size={18} /></span><div><span>Total time</span><strong>{totalMinutes(r)} min</strong></div></div>
      <div className="meta"><span className="meta-icon"><Users size={18} /></span><div><span>Makes</span><strong>{r.servings} serving{r.servings === 1 ? "" : "s"}</strong></div></div>
      <div className="meta"><span className="meta-icon"><ListOrdered size={18} /></span><div><span>Steps</span><strong>{r.steps.length}</strong></div></div>
    </div>
  );
}

/** Pick a day and meal to put a recipe in the plan. */
export function AddToPlanSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { plan, setPlanSlot } = useStore();
  const dates = weekDates(todayIso()).filter((d) => d >= todayIso());
  const [date, setDate] = useState(dates[0]);
  const [meal, setMeal] = useState<Meal>(recipe.meal);
  const [done, setDone] = useState(false);
  const existing = plan[date]?.[meal];
  return (
    <Sheet title="Add to meal plan" onClose={onClose}>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <Thumb emoji={recipe.emoji} size="sm" photo={`recipe:${recipe.id}`} />
        <strong>{recipe.name}</strong>
      </div>
      <h3>Day</h3>
      <div className="chip-row">
        {dates.map((d) => (
          <button key={d} className={`chip chip-outline${d === date ? " on" : ""}`} onClick={() => { setDate(d); setDone(false); }}>
            {new Date(`${d}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" })}
          </button>
        ))}
      </div>
      <h3>Meal</h3>
      <div className="seg">
        {MEALS.map((m) => (
          <button key={m} className={m === meal ? "on" : ""} onClick={() => { setMeal(m); setDone(false); }}>{m}</button>
        ))}
      </div>
      {existing && existing !== recipe.id && !done && (
        <p className="small muted">This replaces {recipeById(existing)?.name ?? "the current dish"}.</p>
      )}
      {done ? (
        <div className="row" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
          <span className="ok small">✓ Added to {meal.toLowerCase()} on {new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "long" })}</span>
          <Link to="/plan" className="btn btn-secondary btn-small">View plan</Link>
        </div>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => { setPlanSlot(date, meal, recipe.id); setDone(true); }}>
          <CalendarPlus size={18} /> Add to plan
        </button>
      )}
    </Sheet>
  );
}

export function Recipes() {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<Cuisine | "All">("All");
  const [meal, setMeal] = useState<Meal | "All">("All");
  const [sort, setSort] = useState<"kcal" | "protein" | "time">("protein");
  const [planning, setPlanning] = useState<Recipe | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECIPES.filter(
      (r) =>
        (cuisine === "All" || r.cuisine === cuisine) &&
        (meal === "All" || r.meal === meal) &&
        (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)),
    ).sort((a, b) => (sort === "kcal" ? a.kcal - b.kcal : sort === "time" ? totalMinutes(a) - totalMinutes(b) : b.protein - a.protein));
  }, [query, cuisine, meal, sort]);

  const featured = list[0];
  const popular = CUISINES.map((c) => RECIPES.find((r) => r.cuisine === c.id)!).filter(Boolean);
  const quick = [...RECIPES].sort((a, b) => totalMinutes(a) - totalMinutes(b)).slice(0, 3);

  return (
    <div className="page page-aside">
      <PageHeader title="Healthy menu" subtitle="Recipes from Naija kitchens and around the world">
        <SearchBox value={query} onChange={setQuery} placeholder="Search recipes" />
      </PageHeader>

      <div className="with-aside">
        <div>
          <div className="chip-group chip-scroll" role="group" aria-label="Cuisine">
            {(["All", ...CUISINES.map((c) => c.id)] as const).map((c) => (
              <button key={c} className={`chip${cuisine === c ? " on" : ""}`} onClick={() => setCuisine(c)}>
                {c === "All" ? "All cuisines" : `${CUISINES.find((x) => x.id === c)!.emoji} ${CUISINES.find((x) => x.id === c)!.label}`}
              </button>
            ))}
          </div>

          {featured && (
            <>
              <div className="section-title"><h2>Featured recipe</h2></div>
              <section className="card featured featured-recipe">
                <Thumb emoji={featured.emoji} size="lg" photo={`recipe:${featured.id}`} />
                <div className="featured-main">
                  <h2 className="featured-recipe-title">{featured.name}</h2>
                  <div className="row"><MealTag meal={featured.meal} /><span className="tag tag-on-ink">{featured.cuisine}</span></div>
                  <RecipeMeta r={featured} />
                  <div className="row">
                    <Link to={`/recipes/${featured.id}`} className="btn btn-primary grow"><ChefHat size={18} /> View recipe</Link>
                    <button className="btn btn-ink-outline" onClick={() => setPlanning(featured)}><CalendarPlus size={18} /> Add to plan</button>
                  </div>
                </div>
                <MacroTiles m={featured} />
              </section>
            </>
          )}

          <div className="section-title">
            <h2>All recipes <span className="muted small">({list.length})</span></h2>
            <div className="row">
              <div className="chip-group chip-scroll" role="group" aria-label="Meal">
                {(["All", ...MEALS] as const).map((m) => (
                  <button key={m} className={`chip${meal === m ? " on" : ""}`} onClick={() => setMeal(m)}>{m}</button>
                ))}
              </div>
              <label className="sort">
                <span className="muted small">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort recipes">
                  <option value="protein">Most protein</option>
                  <option value="kcal">Fewest calories</option>
                  <option value="time">Quickest</option>
                </select>
              </label>
            </div>
          </div>
          <ul className="food-rows">
            {list.map((r) => (
              <li key={r.id} className="food-row">
                <Link to={`/recipes/${r.id}`} aria-label={r.name}><Thumb emoji={r.emoji} photo={`recipe:${r.id}`} /></Link>
                <div className="food-row-body">
                  <div className="food-row-top">
                    <MealTag meal={r.meal} />
                    <span className="tag tag-outline">{r.cuisine}</span>
                    <span className="muted small row" style={{ gap: "0.2rem" }}><Clock size={13} aria-hidden /> {totalMinutes(r)} min · {r.difficulty}</span>
                  </div>
                  <Link to={`/recipes/${r.id}`} className="row-title">{r.name}</Link>
                  <NutrientChips m={r} />
                </div>
                <button className="btn btn-primary btn-small hide-xs" onClick={() => setPlanning(r)}>Add to plan</button>
                <button className="icon-btn sm lime show-xs" onClick={() => setPlanning(r)} aria-label={`Add ${r.name} to plan`}><Plus size={16} /></button>
              </li>
            ))}
            {list.length === 0 && <li className="empty-meal muted">No recipes match.</li>}
          </ul>
        </div>

        <aside className="aside">
          <div className="section-title"><h2>Popular by cuisine</h2></div>
          <ul className="food-rows">
            {popular.map((r) => (
              <li key={r.id}>
                <Link to={`/recipes/${r.id}`} className="food-row">
                  <Thumb emoji={r.emoji} size="sm" photo={`recipe:${r.id}`} />
                  <div className="food-row-body">
                    <strong className="small">{r.name}</strong>
                    <div className="row"><MealTag meal={r.meal} /><span className="muted small">{r.cuisine}</span></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="section-title"><h2>Quick to make</h2></div>
          <ul className="food-rows">
            {quick.map((r) => (
              <li key={r.id}>
                <Link to={`/recipes/${r.id}`} className="food-row">
                  <Thumb emoji={r.emoji} size="sm" photo={`recipe:${r.id}`} />
                  <div className="food-row-body">
                    <strong className="small">{r.name}</strong>
                    <span className="muted small"><Flame size={12} aria-hidden /> {r.kcal} kcal · {totalMinutes(r)} min</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <SampleNotice>Recipes and their nutrition values are samples until reviewed by Kalorax's dietitians.</SampleNotice>
        </aside>
      </div>
      {planning && <AddToPlanSheet recipe={planning} onClose={() => setPlanning(null)} />}
    </div>
  );
}

const COUNTABLE = ["piece", "cube", "bunch", "pack"];

function formatQty(qty: number, unit: string): string {
  if (COUNTABLE.includes(unit)) {
    const half = Math.ceil(qty * 2 - 1e-9) / 2; // round up to the nearest ½
    return Number.isInteger(half) ? fmt(half) : `${fmt(Math.floor(half)) === "0" ? "" : fmt(Math.floor(half))}½`;
  }
  if (qty >= 10 || Number.isInteger(qty)) return fmt(qty);
  return fmt(qty, qty < 1 ? 2 : 1);
}

export function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addDiaryEntries } = useStore();
  const recipe = id ? recipeById(id) : undefined;
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [planning, setPlanning] = useState(false);
  const [logMeal, setLogMeal] = useState<Meal>(recipe?.meal ?? "Lunch");
  const [logging, setLogging] = useState(false);
  if (!recipe) return <div className="page"><p>Recipe not found. <Link to="/recipes">Back to recipes</Link></p></div>;
  const scale = servings / recipe.servings;

  return (
    <div className="page page-aside">
      <Link to="/recipes" className="btn btn-ghost btn-small"><ArrowLeft size={16} /> Back to menu</Link>
      <PageHeader title="Recipe details" />
      <div className="with-aside">
        <div>
          <section className="card recipe-hero">
            <Thumb emoji={recipe.emoji} size="lg" photo={`recipe:${recipe.id}`} label={recipe.name} />
            <div>
              <h1 className="recipe-title">{recipe.name}</h1>
              <div className="row" style={{ margin: "0.5rem 0 0.75rem" }}>
                <MealTag meal={recipe.meal} /><span className="tag tag-outline">{recipe.cuisine}</span>
              </div>
              <p className="recipe-desc">{recipe.description}</p>
              <dl className="details recipe-times">
                <dt>Prep time</dt><dd>{recipe.prepMinutes} min</dd>
                <dt>Cook time</dt><dd>{recipe.cookMinutes} min</dd>
                <dt>Difficulty</dt><dd>{recipe.difficulty}</dd>
                <dt>Total steps</dt><dd>{recipe.steps.length}</dd>
              </dl>
            </div>
          </section>

          <div className="section-title"><h2>Directions</h2></div>
          <ol className="steps">
            {recipe.steps.map((s, i) => (
              <li key={i}>
                <span className="step-num" aria-hidden>{i + 1}</span>
                <div><strong>{s.title}</strong><p>{s.text}</p></div>
              </li>
            ))}
          </ol>
          {recipe.tips && (
            <>
              <div className="section-title"><h2>Notes</h2></div>
              <div className="card card-warm">{recipe.tips.map((t) => <p key={t} className="small" style={{ margin: 0 }}>💡 {t}</p>)}</div>
            </>
          )}
        </div>

        <aside className="aside">
          <Card title="Total servings" action={
            <div className="stepper compact">
              <button className="icon-btn sm ghost" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Fewer servings"><Minus size={15} /></button>
              <strong aria-live="polite">{servings}</strong>
              <button className="icon-btn sm ghost" onClick={() => setServings((s) => Math.min(20, s + 1))} aria-label="More servings"><Plus size={15} /></button>
            </div>
          }>
            <h3 style={{ marginTop: 0 }}>Ingredients</h3>
            <ol className="ingredients">
              {recipe.ingredients.map((ing, i) => {
                const info = INGREDIENTS[ing.id];
                return (
                  <li key={ing.id}>
                    <span className="step-num sm" aria-hidden>{i + 1}</span>
                    <span className="grow">{info.name}</span>
                    <strong className="small">{formatQty(ing.qty * scale, info.unit)} {info.unit}</strong>
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card title="Per serving">
            <MacroTiles m={recipe} />
          </Card>
          <div className="stack">
            <button className="btn btn-primary" onClick={() => setPlanning(true)}><CalendarPlus size={18} /> Add to meal plan</button>
            <button className="btn btn-secondary" onClick={() => setLogging(true)}><NotebookPen size={18} /> Log 1 serving to diary</button>
          </div>
          <SampleNotice>Nutrition per serving is a sample estimate.</SampleNotice>
        </aside>
      </div>
      {planning && <AddToPlanSheet recipe={recipe} onClose={() => setPlanning(false)} />}
      {logging && (
        <Sheet title="Log to diary" onClose={() => setLogging(false)}>
          <p className="small">Log 1 serving of <strong>{recipe.name}</strong> ({recipe.kcal} kcal) to today's diary.</p>
          <div className="seg">
            {MEALS.map((m) => (
              <button key={m} className={m === logMeal ? "on" : ""} onClick={() => setLogMeal(m)}>{m}</button>
            ))}
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              addDiaryEntries([{ date: todayIso(), meal: logMeal, foodId: RECIPE_PREFIX + recipe.id, grams: 100, portionLabel: "1 serving" }]);
              navigate("/diary");
            }}
          >
            Log to {logMeal}
          </button>
        </Sheet>
      )}
    </div>
  );
}
