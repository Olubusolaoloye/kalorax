import {
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  CalendarRange,
  ChefHat,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  MessageCircle,
  NotebookPen,
  Plus,
  ShieldCheck,
  ShoppingBasket,
  TrendingUp,
  UserRound,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { canUseWorkbench, useStore } from "../state/store";
import { useLocalReminders } from "../state/useLocalReminders";
import { CloudEnsureUsername, CloudUnreadBadge } from "./Social";
import { SkeletonPage } from "./ui";
import { Logo } from "./Logo";

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Brand() {
  return (
    <Link to="/home" className="brand">
      <Logo size={30} />
    </Link>
  );
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden>{name.trim()[0]?.toUpperCase() ?? "N"}</span>;
}

export interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  sub?: boolean;
}

/** Full menu, used by the desktop sidebar and the "More" grid on Me. */
export const NAV_ENTRIES: NavEntry[] = [
  { to: "/home", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/programmes", label: "Programmes", icon: HeartPulse },
  { to: "/recipes", label: "Healthy menu", icon: ChefHat },
  { to: "/plan", label: "Meal plan", icon: CalendarRange },
  { to: "/grocery", label: "Grocery list", icon: ShoppingBasket, sub: true },
  { to: "/diary", label: "Food diary", icon: NotebookPen },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/exercises", label: "Exercises", icon: Dumbbell },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/learn", label: "Health insights", icon: BookOpen },
];

const MOBILE_TABS: NavEntry[] = [
  { to: "/home", label: "Home", icon: LayoutDashboard },
  { to: "/diary", label: "Diary", icon: NotebookPen },
  { to: "/messages", label: "Chat", icon: MessageCircle },
  { to: "/plan", label: "Plan", icon: CalendarRange },
  { to: "/me", label: "Me", icon: UserRound },
];

export function Layout() {
  const { profile, account, mode } = useStore();
  const online = useOnline();
  useLocalReminders();
  const pro = canUseWorkbench(profile);
  const cls = (extra = "") => ({ isActive }: { isActive: boolean }) => `nav-item ${extra}${isActive ? " active" : ""}`;

  return (
    <div className="shell">
      {mode === "cloud" && <CloudEnsureUsername />}
      <nav className="sidebar" aria-label="Main">
        <div className="nav-brand"><Brand /></div>
        <NavLink to="/add" className="btn btn-primary sidebar-cta"><Plus size={18} /> Log food</NavLink>
        {NAV_ENTRIES.map((n) => (
          <NavLink key={n.to} to={n.to} className={cls(n.sub ? "nav-sub" : "")}>
            <span className="nav-icon"><n.icon size={19} /></span>
            <span className="grow">{n.label}</span>
            {n.badge ? <span className="nav-badge" aria-label={`${n.badge} unread`}>{n.badge}</span> : null}
            {n.to === "/messages" && mode === "cloud" && <CloudUnreadBadge />}
          </NavLink>
        ))}
        {pro && profile?.role === "dietitian" && (
          <NavLink to="/clients" className={cls()}>
            <span className="nav-icon"><Users size={19} /></span><span className="grow">Clients</span><span className="nav-pro">PRO</span>
          </NavLink>
        )}
        {pro && (
          <NavLink to="/workbench" className={cls()}>
            <span className="nav-icon"><Calculator size={19} /></span><span className="grow">Workbench</span><span className="nav-pro">PRO</span>
          </NavLink>
        )}
        {account?.isAdmin && (
          <NavLink to="/admin" className={cls()}>
            <span className="nav-icon"><ShieldCheck size={19} /></span><span className="grow">Admin</span>
          </NavLink>
        )}
        <NavLink to="/me" className={cls()}>
          <span className="nav-icon"><UserRound size={19} /></span><span className="grow">Me &amp; settings</span>
        </NavLink>
        <div className="nav-spacer" />
        <div className="nav-promo promo">
          <div className="promo-art" aria-hidden>🥗</div>
          <p>Get a personalised meal plan from a <strong>verified dietitian</strong>.</p>
          <Link to="/programmes" className="btn btn-small">Find a dietitian</Link>
        </div>
      </nav>

      <nav className="tabbar" aria-label="Quick">
        {MOBILE_TABS.map((n) => (
          <NavLink key={n.to} to={n.to} className={cls(n.to === "/messages" ? "nav-add" : "")}>
            <span className="nav-icon"><n.icon size={n.to === "/messages" ? 22 : 20} /></span>
            <span>{n.label}</span>
            {n.to === "/messages" && mode === "cloud" && <CloudUnreadBadge />}
          </NavLink>
        ))}
      </nav>

      <main className="main">
        <div className="mobile-top">
          <Brand />
          {profile && (
            <Link to="/me" aria-label="Me">
              <Avatar name={profile.name} />
            </Link>
          )}
        </div>
        {!online && (
          <div className="banner banner-warn" role="status">
            <WifiOff size={16} aria-hidden /> You're offline. Your logs are saved on this device.
          </div>
        )}
        <Suspense fallback={<SkeletonPage />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
