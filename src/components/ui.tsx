import { Droplet, Flame, Lock, Search, Wheat, Beef } from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import { photoFor, photoSources } from "../data/photos";
import { Link } from "react-router-dom";
import { fmt } from "../state/derived";
import type { Meal } from "../state/store";

export function Ring({ value, max, label, sub }: { value: number; max: number; label: string; sub: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = value > max;
  return (
    <div className="ring" role="img" aria-label={`${label}. ${sub}`}>
      <svg viewBox="0 0 120 120" width="150" height="150">
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={`ring-value${over ? " over" : ""}`}
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-text">
        <strong>{label}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

export function Bar({ value, max, label, hint }: { value: number; max: number; label: string; hint?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="bar">
      {(label || hint) && (
        <div className="bar-head">
          <span>{label}</span>
          {hint && <span className="muted">{hint}</span>}
        </div>
      )}
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Segmented progress, e.g. water glasses. */
export function Segments({ value, max, count = 10, label }: { value: number; max: number; count?: number; label: string }) {
  const filled = max > 0 ? Math.min(count, Math.round((value / max) * count)) : 0;
  return (
    <div className="segments" role="img" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i < filled ? "on" : ""} />
      ))}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-title">
        <h1>{title}</h1>
        {subtitle && <span className="muted">{subtitle}</span>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  );
}

/** Grey placeholder shapes shown while a page or its data loads, so the layout appears at once. */
export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="sk-list" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <span className="sk sk-dot" />
          <span className="grow">
            <span className="sk sk-line" />
            <span className="sk sk-line short" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** A whole page's worth of placeholders: title, a row of tiles and two cards. */
export function SkeletonPage({ label = "Loading" }: { label?: string }) {
  return (
    <div className="page sk-page" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="sk-tiles">
        {[0, 1, 2, 3].map((i) => <span key={i} className="sk sk-tile" />)}
      </div>
      <div className="card"><SkeletonLines rows={3} /></div>
      <div className="card"><SkeletonLines rows={2} /></div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <label className="search-box">
      <Search size={18} aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} />
    </label>
  );
}

export interface Macros {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** The four coloured nutrient tiles from the reference design. They lay out by the space they're given, not the screen width. */
export function MacroTiles({ m, targetKcal }: { m: Macros; targetKcal?: number }) {
  return (
    <div className="tiles-wrap">
    <div className="tiles">
      <div className="tile tile-kcal">
        <span className="tile-icon"><Flame size={18} /></span>
        <div><span>Calories</span><strong>{fmt(m.kcal)} <small>{targetKcal ? `/ ${fmt(targetKcal)} kcal` : "kcal"}</small></strong></div>
      </div>
      <div className="tile tile-carbs">
        <span className="tile-icon"><Wheat size={18} /></span>
        <div><span>Carbs</span><strong>{fmt(m.carbs)} <small>g</small></strong></div>
      </div>
      <div className="tile tile-protein">
        <span className="tile-icon"><Beef size={18} /></span>
        <div><span>Protein</span><strong>{fmt(m.protein)} <small>g</small></strong></div>
      </div>
      <div className="tile tile-fat">
        <span className="tile-icon"><Droplet size={18} /></span>
        <div><span>Fat</span><strong>{fmt(m.fat)} <small>g</small></strong></div>
      </div>
    </div>
    </div>
  );
}

export function NutrientChips({ m }: { m: Macros }) {
  return (
    <div className="nchips">
      <span className="nchip"><Flame size={13} aria-hidden /> {fmt(m.kcal)} kcal</span>
      <span className="nchip"><Wheat size={13} aria-hidden /> {fmt(m.carbs)}g carbs</span>
      <span className="nchip"><Beef size={13} aria-hidden /> {fmt(m.protein)}g protein</span>
      <span className="nchip"><Droplet size={13} aria-hidden /> {fmt(m.fat)}g fat</span>
    </div>
  );
}

const THUMB_WIDTH = { "": 240, sm: 160, lg: 960 } as const;

/** Dish photo (Wikimedia Commons) with the emoji as placeholder and fallback. */
// Memoised: long lists of dishes don't redraw their photos every time other data changes.
export const Thumb = memo(function Thumb({ emoji, size = "", label, photo }: { emoji: string; size?: "" | "sm" | "lg"; label?: string; photo?: string }) {
  const p = photo ? photoFor(photo) : undefined;
  const sources = p ? photoSources(p, THUMB_WIDTH[size]) : [];
  const key = sources[0] ?? null;
  // Tied to the first URL so a reused thumbnail resets when its dish changes. On error, try the next source.
  const [status, setStatus] = useState<{ key: string | null; tried: number; ok: boolean } | null>(null);
  const tried = status && status.key === key ? status.tried : 0;
  const loaded = !!status && status.key === key && status.ok;
  const url = sources[tried] ?? null;
  return (
    <span
      className={`thumb ${size}${url ? " has-photo" : ""}${loaded ? " is-loaded" : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="thumb-emoji">{emoji}</span>
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus({ key, tried, ok: true })}
          onError={() => setStatus({ key, tried: tried + 1, ok: false })}
        />
      )}
    </span>
  );
});

export function MealTag({ meal }: { meal: Meal }) {
  return <span className={`tag tag-${meal.toLowerCase()}`}>{meal}</span>;
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      Nutrintel supports healthy eating but does not replace advice from your doctor or dietitian.
    </p>
  );
}

export function DietitianCard({ reason, showLink = true }: { reason: "condition" | "under_18"; showLink?: boolean }) {
  return (
    <div className="card card-warm">
      <h2>Your target should be set by a dietitian</h2>
      <p>
        {reason === "condition"
          ? "Because of the health condition you told us about, a dietitian should set your daily target and plan with you."
          : "For people under 18, energy needs change with growth, so a dietitian should set your target."}
      </p>
      {showLink ? (
        <Link to="/programmes" className="btn btn-primary">Find a dietitian</Link>
      ) : (
        <p className="small"><strong>Next:</strong> once you've finished, choose a verified dietitian under <strong>Programmes</strong>.</p>
      )}
      <p className="muted small">You can still log your meals, water and weight.</p>
    </div>
  );
}

export function Locked() {
  return (
    <div className="card card-warm locked">
      <span className="lock-icon" aria-hidden><Lock size={24} /></span>
      <h2>For dietitians &amp; nutrition students</h2>
      <p>
        The Professional Workbench (BMR, energy requirements and calorie distribution) is available to verified
        dietitians and nutrition students.
      </p>
      <Link to="/me" className="btn btn-secondary">
        Go to Me
      </Link>
    </div>
  );
}

type Tone = "kcal" | "carbs" | "protein" | "fat" | "ink";

/** Top-of-page summary card: coloured icon tile, label, value and an optional change vs a previous period. */
export function StatCard({ icon, tone, label, value, unit, delta }: { icon: ReactNode; tone: Tone; label: string; value: string; unit?: string; delta?: number | null }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon tone-${tone}`} aria-hidden>{icon}</span>
      <div className="grow">
        <span className="stat-label">{label}</span>
        <div className="stat-line">
          <strong>{value}</strong>
          {unit && <small>{unit}</small>}
        </div>
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`delta ${delta >= 0 ? "up" : "down"}`}>
            {delta >= 0 ? "↗" : "↘"} {delta >= 0 ? "+" : ""}{fmt(delta, 1)}% <span className="muted">vs last week</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Modal on desktop, bottom sheet on mobile. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn sm ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function SampleNotice({ children }: { children: ReactNode }) {
  return <p className="sample-notice">{children}</p>;
}

/** An on/off switch (role="switch"). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch${checked ? " on" : ""}`} disabled={disabled} onClick={() => onChange(!checked)}>
      <span aria-hidden />
    </button>
  );
}
