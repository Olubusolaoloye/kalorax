import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DietitianCard, Disclaimer } from "../components/ui";
import {
  BMI_CATEGORY_LABEL,
  CONDITION_LABEL,
  PAL,
  bmiCategory,
  type ActivityLevel,
  type Condition,
  type Goal,
  type Sex,
} from "../lib/nutrition";
import { guessRegion, regionById, REGIONS } from "../data/regions";
import { planCuisinesFor } from "../lib/planner";
import { bodySummary, fmt } from "../state/derived";
import { useStore, type Profile, type Role } from "../state/store";
import { Logo } from "../components/Logo";

const GOALS: Array<{ value: Goal; label: string }> = [
  { value: "lose", label: "Lose weight" },
  { value: "maintain", label: "Maintain my weight" },
  { value: "gain", label: "Gain weight" },
  { value: "eat_healthier", label: "Just eat healthier" },
];

const ROLES: Array<{ value: Role; label: string; hint: string }> = [
  { value: "consumer", label: "I want to improve my nutrition", hint: "Track meals, water and weight" },
  { value: "student", label: "I'm a nutrition student", hint: "Unlock the workbench after verification" },
  { value: "dietitian", label: "I'm a dietitian", hint: "Unlock the workbench after licence check" },
];

type Draft = {
  role: Role;
  name: string;
  credential: string;
  sex: Sex;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  activity: ActivityLevel;
  goal: Goal;
  conditions: Condition[];
  region: string;
};

export function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding, mode, planPrefs, updatePlanPrefs } = useStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Draft>({
    role: "consumer",
    name: "",
    credential: "",
    sex: "female",
    birthDate: "",
    heightCm: "",
    weightKg: "",
    activity: "light",
    goal: "lose",
    conditions: [],
    region: guessRegion(),
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const isPro = d.role !== "consumer";
  const steps = ["role", ...(isPro ? ["verify"] : []), "about", "region", "body", "activity", "goal", "conditions", "results"];
  const current = steps[step];
  const height = Number(d.heightCm);
  const weight = Number(d.weightKg);

  const profile: Profile = {
    name: d.name.trim() || "Friend",
    role: d.role,
    verification: isPro ? "pending" : "none",
    sex: d.sex,
    birthDate: d.birthDate,
    heightCm: height,
    activity: d.activity,
    goal: d.goal,
    conditions: d.conditions,
    region: d.region,
  };

  const canContinue =
    (current === "verify" && d.credential.trim().length >= 3) ||
    (current === "about" && d.name.trim() && d.birthDate && new Date(d.birthDate) < new Date()) ||
    (current === "body" && height >= 50 && height <= 250 && weight >= 20 && weight <= 350) ||
    ["role", "region", "activity", "goal", "conditions", "results"].includes(current);

  const next = async () => {
    if (current !== "results") {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding(profile, weight, isPro ? d.credential.trim() : undefined);
      // Meal plans start with dishes from where they eat.
      updatePlanPrefs({ ...planPrefs, cuisines: planCuisinesFor(regionById(d.region).cuisines) });
      navigate("/home");
    } catch (e) {
      setError(mode === "cloud" ? "We couldn't save your profile. Check your connection and try again." : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="landing-brand" style={{ marginBottom: "1rem" }}>
        <Logo size={30} />
      </div>
      <div className="onboarding-card">
      <div className="progress-dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
        <div className="progress-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      {current === "role" && (
        <Step title="How will you use Kalorax?">
          {ROLES.map((r) => (
            <Choice key={r.value} selected={d.role === r.value} onClick={() => set("role", r.value)} label={r.label} hint={r.hint} />
          ))}
          <p className="muted small">Your health data is private. Only you can see it unless you choose to share it.</p>
        </Step>
      )}

      {current === "verify" && (
        <Step title={d.role === "student" ? "Verify you're a student" : "Verify your licence"}>
          <label className="field">
            <span>{d.role === "student" ? "Institution and matric number" : "Licence / registration number"}</span>
            <input value={d.credential} onChange={(e) => set("credential", e.target.value)} placeholder={d.role === "student" ? "e.g. UNN, 2022/123456" : "e.g. DT/12345"} />
          </label>
          <p className="muted small">
            We'll review this before unlocking the Workbench. You can use everything else while you wait.
            You can add a photo or PDF of your licence or ID on the Me page after setup.
          </p>
        </Step>
      )}

      {current === "about" && (
        <Step title="Tell us about you">
          <label className="field">
            <span>First name</span>
            <input value={d.name} onChange={(e) => set("name", e.target.value)} autoComplete="given-name" />
          </label>
          <div className="field">
            <span>Sex</span>
            <div className="seg">
              {(["female", "male"] as Sex[]).map((s) => (
                <button key={s} type="button" className={d.sex === s ? "on" : ""} onClick={() => set("sex", s)}>
                  {s === "female" ? "Female" : "Male"}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Date of birth</span>
            <input type="date" value={d.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </label>
        </Step>
      )}

      {current === "region" && (
        <Step title="Where do you usually eat?">
          <p className="muted small">Your food list, recipes and meal plans start with dishes from here. You can change it any time on the Me page.</p>
          <div className="region-grid" role="radiogroup" aria-label="Region">
            {REGIONS.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={d.region === r.id} className={`choice region-choice${d.region === r.id ? " selected" : ""}`} onClick={() => set("region", r.id)}>
                <span className="region-flag" aria-hidden>{r.flag}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </Step>
      )}

      {current === "body" && (
        <Step title="Your height and weight">
          <label className="field">
            <span>Height (cm)</span>
            <input inputMode="decimal" value={d.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="e.g. 165" />
          </label>
          <label className="field">
            <span>Weight (kg)</span>
            <input inputMode="decimal" value={d.weightKg} onChange={(e) => set("weightKg", e.target.value)} placeholder="e.g. 70" />
          </label>
        </Step>
      )}

      {current === "activity" && (
        <Step title="How active is your day?">
          {(["sedentary", "light", "moderate", "vigorous"] as ActivityLevel[]).map((a) => (
            <Choice key={a} selected={d.activity === a} onClick={() => set("activity", a)} label={PAL[a].consumerLabel} />
          ))}
        </Step>
      )}

      {current === "goal" && (
        <Step title="What's your goal?">
          {GOALS.map((g) => (
            <Choice key={g.value} selected={d.goal === g.value} onClick={() => set("goal", g.value)} label={g.label} />
          ))}
        </Step>
      )}

      {current === "conditions" && (
        <Step title="Do any of these apply to you?">
          {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
            <Choice
              key={c}
              selected={d.conditions.includes(c)}
              onClick={() =>
                set("conditions", d.conditions.includes(c) ? d.conditions.filter((x) => x !== c) : [...d.conditions, c])
              }
              label={CONDITION_LABEL[c]}
            />
          ))}
          <Choice selected={d.conditions.length === 0} onClick={() => set("conditions", [])} label="None of these" />
        </Step>
      )}

      {current === "results" && <Results profile={profile} weightKg={weight} />}

      {error && <p className="error small" role="alert">{error}</p>}
      <div className="onboarding-actions">
        {step > 0 && (
          <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        <button className="btn btn-primary" disabled={!canContinue || saving} onClick={next}>
          {current === "results" ? (saving ? "Saving…" : "Go to my dashboard") : "Continue"}
        </button>
      </div>
      </div>
    </div>
  );
}

function Results({ profile, weightKg }: { profile: Profile; weightKg: number }) {
  const s = bodySummary(profile, weightKg);
  const cat = bmiCategory(s.bmi);
  return (
    <Step title={`Here's where you are, ${profile.name}`}>
      <div className="card">
        <div className="stat">
          <span className="stat-label">Your BMI</span>
          <strong className="stat-value">{fmt(s.bmi, 1)}</strong>
          <span className={`pill pill-${cat}`}>{BMI_CATEGORY_LABEL[cat]}</span>
        </div>
        <p className="muted small">BMI is a screening tool, not a diagnosis.</p>
      </div>
      {s.target.kind === "target" ? (
        <div className="card">
          <div className="stat">
            <span className="stat-label">Your daily target</span>
            <strong className="stat-value">about {fmt(s.target.kcal)} kcal</strong>
          </div>
          {s.target.note && <p className="small">{s.target.note}</p>}
          <p>Fill about half your plate with vegetables and soup, a quarter with starch (rice, bread, potatoes, swallow) and a quarter with protein (fish, beans, meat, eggs).</p>
        </div>
      ) : (
        <DietitianCard reason={s.target.reason} showLink={false} />
      )}
      <div className="card">
        <div className="stat">
          <span className="stat-label">Water</span>
          <strong className="stat-value">about {fmt(s.waterTargetMl / 1000, 1)} litres</strong>
          <span className="muted">{["nigeria", "ghana"].includes(profile.region ?? "") ? `≈ ${Math.round(s.waterTargetMl / 500)} sachets a day` : `≈ ${Math.round(s.waterTargetMl / 250)} glasses a day`}</span>
        </div>
      </div>
      <Disclaimer />
    </Step>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function Choice({ selected, onClick, label, hint }: { selected: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button type="button" className={`choice${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onClick}>
      <span>{label}</span>
      {hint && <span className="muted small">{hint}</span>}
    </button>
  );
}
