import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ConvexStoreProvider } from "./state/cloudStore";
import { CloudInterventionsProvider, PreviewInterventionsProvider } from "./state/interventions";
import { startVitals } from "./lib/vitals";
import { LocalStoreProvider, migrateOldStorageKeys } from "./state/store";
import "./styles.css";

/** Set VITE_CONVEX_URL to use accounts and the cloud database; otherwise data stays on the device. */
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function Providers({ children }: { children: ReactNode }) {
  if (!convex)
    return (
      <LocalStoreProvider>
        <PreviewInterventionsProvider>{children}</PreviewInterventionsProvider>
      </LocalStoreProvider>
    );
  return (
    <ConvexAuthProvider client={convex}>
      <ConvexStoreProvider>
        <CloudInterventionsProvider>{children}</CloudInterventionsProvider>
      </ConvexStoreProvider>
    </ConvexAuthProvider>
  );
}

migrateOldStorageKeys();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);

// Real-user speed tracking (live site only): reports go to the backend's /vitals route on .convex.site.
if (convexUrl && import.meta.env.PROD) startVitals(`${convexUrl.replace(/\.convex\.cloud\/?$/, ".convex.site")}/vitals`);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
