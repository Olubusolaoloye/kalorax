import { ArrowLeft, Minus, Plus, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, MacroTiles, MealTag, NutrientChips, PageHeader, SearchBox, Thumb } from "../components/ui";
import { CATEGORIES_BY_CUISINE, CUISINES, cuisineOrder, nutrientsFor, searchFoods, type Cuisine, type Food } from "../data/foods";
import { regionById } from "../data/regions";
import { fmt } from "../state/derived";
import { MEALS, todayIso, useStore, type Meal } from "../state/store";

interface Pending {
  food: Food;
  grams: number;
  portionLabel: string;
}

const defaultPortion = (f: Food) => f.portions[Math.min(1, f.portions.length - 1)];

export function AddFood() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addDiaryEntries, profile } = useStore();
  const region = regionById(profile?.region);
  // The member's region's cuisines lead: three big tabs, the rest in a row below.
  const order = useMemo(() => cuisineOrder(region.cuisines), [region]);
  const info = (id: Cuisine) => CUISINES.find((c) => c.id === id)!;
  const initialMeal = MEALS.includes(params.get("meal") as Meal) ? (params.get("meal") as Meal) : "Lunch";
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const initialCuisine = CUISINES.some((c) => c.id === params.get("cuisine")) ? (params.get("cuisine") as Cuisine) : order[0];
  const [cuisine, setCuisine] = useState<Cuisine>(initialCuisine);
  const [category, setCategory] = useState<string>("All");
  const [selected, setSelected] = useState<Food | null>(null);
  const [tray, setTray] = useState<Pending[]>([]);
  // The box updates on every key; the list follows when the phone has a moment, so typing never lags.
  const search = useDeferredValue(query);
  const searching = search.trim().length > 0;

  // Searching looks across every cuisine, grouped by cuisine. Browsing shows one cuisine, grouped by category.
  const sections = useMemo(() => {
    const found = searchFoods(search, order);
    if (searching) {
      return order.map((id) => ({
        title: `${info(id).emoji} ${info(id).label}`,
        foods: found.filter((f) => f.cuisine === id),
      })).filter((s) => s.foods.length > 0);
    }
    return CATEGORIES_BY_CUISINE[cuisine]
      .filter((cat) => category === "All" || cat === category)
      .map((cat) => ({ title: cat, foods: found.filter((f) => f.cuisine === cuisine && f.category === cat) }))
      .filter((s) => s.foods.length > 0);
  }, [search, searching, cuisine, category, order]);

  const save = () => {
    addDiaryEntries(tray.map((p) => ({ date: todayIso(), meal, foodId: p.food.id, grams: p.grams, portionLabel: p.portionLabel })));
    navigate("/diary");
  };
  const trayKcal = tray.reduce((t, p) => t + nutrientsFor(p.food, p.grams).kcal, 0);

  const trayCard = tray.length > 0 && !selected && (
    <Card title={tray.length > 1 ? "Your combo" : "Ready to add"} action={<MealTag meal={meal} />} className="tray">
      <ul className="entry-list">
        {tray.map((p, i) => (
          <li key={i}>
            <Thumb emoji={p.food.emoji} size="sm" photo={p.food.id} />
            <div>
              <strong>{p.food.name}</strong>
              <span className="muted small">{p.portionLabel} · {fmt(nutrientsFor(p.food, p.grams).kcal)} kcal</span>
            </div>
            <button className="icon-btn sm" onClick={() => setTray((t) => t.filter((_, j) => j !== i))} aria-label={`Remove ${p.food.name}`}><X size={16} /></button>
          </li>
        ))}
      </ul>
      <p className="muted small">Add more items to build a combo, e.g. rice + stew + chicken.</p>
      <button className="btn btn-primary btn-block" onClick={save}>
        Save to {meal} · {fmt(trayKcal)} kcal
      </button>
    </Card>
  );

  return (
    <div className="page page-aside">
      <PageHeader title="Add food" subtitle={`Dishes from ${region.label === "Somewhere else" ? "around the world" : region.label} first, in the portions you really eat`}>
        <div className="seg" role="group" aria-label="Meal">
          {MEALS.map((m) => (
            <button key={m} className={meal === m ? "on" : ""} onClick={() => setMeal(m)}>{m}</button>
          ))}
        </div>
      </PageHeader>

      <div className="with-aside">
        <div>
          {trayCard && <div className="tray-mobile">{trayCard}</div>}
          {selected ? (
            <PortionPicker
              food={selected}
              onCancel={() => setSelected(null)}
              onAdd={(p) => {
                setTray((t) => [...t, p]);
                setSelected(null);
                setQuery("");
              }}
            />
          ) : (
            <>
              <SearchBox value={query} onChange={setQuery} placeholder="Search any dish: jollof, borscht, pizza, dal…" autoFocus />
              {!searching && (
                <>
                  <div className="cuisine-tabs" role="tablist" aria-label="Cuisine">
                    {order.slice(0, 3).map(info).map((c) => (
                      <button
                        key={c.id}
                        role="tab"
                        aria-selected={cuisine === c.id}
                        className={`cuisine-tab${cuisine === c.id ? " on" : ""}`}
                        onClick={() => {
                          setCuisine(c.id);
                          setCategory("All");
                        }}
                      >
                        <span className="cuisine-emoji" aria-hidden>{c.emoji}</span>
                        <span>
                          <strong>{c.label}</strong>
                          <small>{c.blurb}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="chip-group chip-scroll more-cuisines" role="group" aria-label="More cuisines">
                    {order.slice(3).map(info).map((c) => (
                      <button key={c.id} className={`chip chip-outline${cuisine === c.id ? " on" : ""}`} aria-pressed={cuisine === c.id} onClick={() => { setCuisine(c.id); setCategory("All"); }}>
                        <span aria-hidden>{c.emoji}</span> {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="chip-group chip-scroll" role="group" aria-label="Section">
                    {["All", ...CATEGORIES_BY_CUISINE[cuisine]].map((c) => (
                      <button key={c} className={`chip${category === c ? " on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
                    ))}
                  </div>
                </>
              )}
              {sections.map((sec) => (
                <section key={sec.title} className="food-section">
                  <div className="section-title">
                    <h2>{sec.title}</h2>
                    <span className="muted small">{sec.foods.length} dish{sec.foods.length === 1 ? "" : "es"}</span>
                  </div>
                  <ul className="food-rows">
                    {sec.foods.map((f) => {
                      const portion = defaultPortion(f);
                      return (
                        <li key={f.id}>
                          <button className="food-row" onClick={() => setSelected(f)}>
                            <Thumb emoji={f.emoji} photo={f.id} />
                            <div className="food-row-body">
                              <div className="food-row-top">
                                <span className="tag tag-outline">{searching ? f.category : f.aliases[0]}</span>
                              </div>
                              <strong>{f.name}</strong>
                              <NutrientChips m={nutrientsFor(f, portion.grams)} />
                              <span className="muted small">per {portion.label.toLowerCase()} ({portion.grams} g)</span>
                            </div>
                            <span className="icon-btn sm lime" aria-hidden><Plus size={16} /></span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {sections.length === 0 && <div className="empty-meal muted">No match for “{query}”. Try a shorter word or another spelling (e.g. “ewedu” or “jute”).</div>}
            </>
          )}
        </div>
        <aside className="aside tray-desktop">
          {trayCard || (
            <Card title="Build a combo" className="card-warm">
              <p className="small muted">Pick a food, choose your portion, then add the rest of the plate. Save it all to {meal} in one go.</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function PortionPicker({ food, onAdd, onCancel }: { food: Food; onAdd: (p: Pending) => void; onCancel: () => void }) {
  const [portion, setPortion] = useState(defaultPortion(food));
  const [qty, setQty] = useState(1);
  const grams = portion.grams * qty;
  const n = nutrientsFor(food, grams);

  return (
    <section className="card picker">
      <div>
        <button className="btn btn-ghost btn-small" onClick={onCancel}><ArrowLeft size={16} /> Back</button>
        <Thumb emoji={food.emoji} size="lg" label={food.name} photo={food.id} />
      </div>
      <div>
        <div className="food-row-top"><span className="tag tag-outline">{food.cuisine} · {food.category}</span><span className="badge">{food.source}</span></div>
        <h1 style={{ margin: "0.5rem 0 0.25rem" }}>{food.name}</h1>
        <p className="muted small">Also called: {food.aliases.join(", ")}</p>

        <h3>Choose your portion</h3>
        <div className="portion-row" role="radiogroup" aria-label="Portion size">
          {food.portions.map((p) => (
            <button
              key={p.label}
              role="radio"
              aria-checked={p === portion}
              className={`portion${p === portion ? " selected" : ""}`}
              onClick={() => setPortion(p)}
            >
              <span className="portion-visual" aria-hidden style={{ ["--size" as string]: Math.min(1, 0.45 + p.grams / 400) }} />
              <span>{p.label}</span>
              <span className="muted small">{p.grams} g</span>
            </button>
          ))}
        </div>
        <div className="stepper">
          <button className="icon-btn sm" style={{ border: 0 }} onClick={() => setQty((q) => Math.max(0.5, q - 0.5))} aria-label="Less"><Minus size={16} /></button>
          <span className="small"><strong>{qty}</strong> × {portion.label}</span>
          <button className="icon-btn sm" style={{ border: 0 }} onClick={() => setQty((q) => q + 0.5)} aria-label="More"><Plus size={16} /></button>
        </div>
        <div style={{ margin: "0.9rem 0" }}><MacroTiles m={n} /></div>
        <button className="btn btn-primary btn-block" onClick={() => onAdd({ food, grams, portionLabel: qty === 1 ? portion.label : `${qty} × ${portion.label}` })}>
          Add {grams} g to plate
        </button>
      </div>
    </section>
  );
}
