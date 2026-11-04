import { useConvexAuth } from "convex/react";
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SkeletonPage } from "./components/ui";
import { useStore } from "./state/store";

// Each page is its own download, fetched when it's first opened; the rest are fetched
// quietly once the first screen is up (see usePrefetchPages), so later taps stay instant.
const loaders = {
  AddFood: () => import("./pages/AddFood"),
  Auth: () => import("./pages/Auth"),
  Calendar: () => import("./pages/Calendar"),
  Clients: () => import("./pages/Clients"),
  Credits: () => import("./pages/Credits"),
  Diary: () => import("./pages/Diary"),
  Exercises: () => import("./pages/Exercises"),
  Grocery: () => import("./pages/Grocery"),
  Home: () => import("./pages/Home"),
  Landing: () => import("./pages/Landing"),
  Learn: () => import("./pages/Learn"),
  MealPlan: () => import("./pages/MealPlan"),
  Me: () => import("./pages/Me"),
  Messages: () => import("./pages/Messages"),
  Onboarding: () => import("./pages/Onboarding"),
  Pro: () => import("./pages/Pro"),
  Programmes: () => import("./pages/Programmes"),
  Progress: () => import("./pages/Progress"),
  Recipes: () => import("./pages/Recipes"),
  Reminders: () => import("./pages/Reminders"),
  Workbench: () => import("./pages/Workbench"),
};

function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType<any> }));
}

const AddFood = page(loaders.AddFood, "AddFood");
const Auth = page(loaders.Auth, "Auth");
const Calendar = page(loaders.Calendar, "Calendar");
const Clients = page(loaders.Clients, "Clients");
const ClientPage = page(loaders.Clients, "ClientPage");
const Credits = page(loaders.Credits, "Credits");
const Diary = page(loaders.Diary, "Diary");
const Exercises = page(loaders.Exercises, "Exercises");
const Grocery = page(loaders.Grocery, "Grocery");
const Home = page(loaders.Home, "Home");
const Landing = page(loaders.Landing, "Landing");
const Learn = page(loaders.Learn, "Learn");
const ArticlePage = page(loaders.Learn, "ArticlePage");
const MealPlan = page(loaders.MealPlan, "MealPlan");
const Me = page(loaders.Me, "Me");
const Messages = page(loaders.Messages, "Messages");
const Onboarding = page(loaders.Onboarding, "Onboarding");
const ProGate = page(loaders.Pro, "ProGate");
const ProPaymentReturn = page(loaders.Pro, "ProPaymentReturn");
const Programmes = page(loaders.Programmes, "Programmes");
const ProgrammeDetail = page(loaders.Programmes, "ProgrammeDetail");
const MyProgramme = page(loaders.Programmes, "MyProgramme");
const PaymentReturn = page(loaders.Programmes, "PaymentReturn");
const Progress = page(loaders.Progress, "Progress");
const Recipes = page(loaders.Recipes, "Recipes");
const RecipeDetail = page(loaders.Recipes, "RecipeDetail");
const Reminders = page(loaders.Reminders, "Reminders");
const Workbench = page(loaders.Workbench, "Workbench");
/** Admin pages load only when an admin opens them, so members never download them. */
const Admin = page(() => import("./pages/Admin"), "Admin");

/** Once the first screen has rendered and the browser is idle, fetch the other pages (skipped on Data Saver). */
function usePrefetchPages() {
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return;
    const run = () => Object.values(loaders).forEach((load) => void load().catch(() => {}));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 2000);
    return () => clearTimeout(id);
  }, []);
}

/** The signed-in app (sidebar layout). */
function appRoutes(isAdmin: boolean) {
  return (
    <Route element={<Layout />}>
      <Route path="/home" element={<Home />} />
      <Route path="/diary" element={<Diary />} />
      <Route path="/add" element={<AddFood />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/learn" element={<Learn />} />
      <Route path="/learn/:id" element={<ArticlePage />} />
      <Route path="/me" element={<Me />} />
      <Route path="/workbench" element={<ProGate><Workbench /></ProGate>} />
      <Route path="/pro/paid" element={<ProPaymentReturn />} />
      <Route path="/recipes" element={<Recipes />} />
      <Route path="/recipes/:id" element={<RecipeDetail />} />
      <Route path="/plan" element={<MealPlan />} />
      <Route path="/grocery" element={<Grocery />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/exercises" element={<Exercises />} />
      <Route path="/reminders" element={<Reminders />} />
      <Route path="/programmes" element={<Programmes />} />
      <Route path="/programmes/paid" element={<PaymentReturn />} />
      <Route path="/programmes/:id" element={<ProgrammeDetail />} />
      <Route path="/my-programmes/:id" element={<MyProgramme />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/clients/:id" element={<ClientPage />} />
      {isAdmin && <Route path="/admin" element={<Admin />} />}
    </Route>
  );
}

/** Shown while the account loads: the page's shape, not a blank screen. */
function Splash() {
  return (
    <div className="main">
      <SkeletonPage label="Loading Kalorax" />
    </div>
  );
}

/** On-device mode: no accounts. */
function LocalApp() {
  const { profile } = useStore();
  return (
    <Routes>
      <Route path="/" element={profile ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/start" element={profile ? <Navigate to="/home" replace /> : <Onboarding />} />
      <Route path="/credits" element={<Credits />} />
      {profile && appRoutes(false)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Cloud mode: sign in → set up profile → app. */
function CloudApp() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { ready, profile, account } = useStore();

  if (isLoading || (isAuthenticated && !ready)) return <Splash />;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/start" element={<Navigate to="/auth?mode=signup" replace />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/start" element={<Onboarding />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="*" element={<Navigate to="/start" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/credits" element={<Credits />} />
      {appRoutes(!!account?.isAdmin)}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default function App() {
  const { mode } = useStore();
  usePrefetchPages();
  return <Suspense fallback={<Splash />}>{mode === "cloud" ? <CloudApp /> : <LocalApp />}</Suspense>;
}
