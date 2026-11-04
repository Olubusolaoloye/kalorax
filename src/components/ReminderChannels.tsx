// Where reminders are delivered: push notifications and WhatsApp.
// Cloud versions talk to Convex; on-device versions work without an account.
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlarmClock, BellRing, Check, MessageCircle, Send, Smartphone, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { currentPushEndpoint, isInstalled, isIos, notificationsSupported, pushSupported, requestPermission, showNotification, subscribePush, unsubscribePush } from "../lib/push";
import type { ReminderSettings } from "../lib/reminders";
import { useStore } from "../state/store";
import { Card, Switch } from "./ui";

type Save = (patch: Partial<ReminderSettings>) => void;

const message = (err: unknown) =>
  err instanceof ConvexError ? String(err.data) : err instanceof Error ? err.message : "Something went wrong. Please try again.";

/** Hide all but the last 4 digits: +234 803 *** 4567. */
const maskPhone = (p: string) => (p.startsWith("+234") ? `+234 ${p.slice(4, 7)} *** ${p.slice(-4)}` : `${p.slice(0, 4)} *** ${p.slice(-4)}`);

function PushBlocked() {
  if (!notificationsSupported()) return <p className="small muted">This browser can't show notifications. Try Chrome, Edge or Safari.</p>;
  if (isIos() && !isInstalled())
    return (
      <p className="small muted">
        On iPhone, add Kalorax to your Home Screen first: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open it from there.
      </p>
    );
  if (Notification.permission === "denied") return <p className="small error">Notifications are blocked for Kalorax. Allow them in your browser's site settings.</p>;
  return null;
}

function ChannelHead({ icon, title, status }: { icon: React.ReactNode; title: string; status: React.ReactNode }) {
  return (
    <div className="channel-head">
      <span className="channel-icon" aria-hidden>{icon}</span>
      <div className="grow">
        <strong>{title}</strong>
        <div className="small muted">{status}</div>
      </div>
    </div>
  );
}

/* ---------------- Cloud (account) ---------------- */

export function CloudPushCard({ save }: { save: Save }) {
  const { reminders } = useStore();
  const config = useQuery(api.reminders.config);
  const channels = useQuery(api.reminders.myChannels);
  const saveSub = useMutation(api.reminders.savePushSubscription);
  const removeSub = useMutation(api.reminders.removePushSubscription);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void currentPushEndpoint().then(setEndpoint);
  }, []);

  const onThisDevice = !!endpoint && !!channels?.pushEndpoints.includes(endpoint);
  const others = (channels?.pushEndpoints.length ?? 0) - (onThisDevice ? 1 : 0);
  const blocked = <PushBlocked />;

  const turnOn = async () => {
    if (!config?.pushPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      const keys = await subscribePush(config.pushPublicKey);
      await saveSub(keys);
      setEndpoint(keys.endpoint);
      save({ push: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const ep = await unsubscribePush();
      if (ep) await removeSub({ endpoint: ep });
      setEndpoint(null);
      if (others === 0) save({ push: false });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const status = !config ? "Checking…" : !config.pushPublicKey ? "Coming soon" : onThisDevice && reminders.push ? "On for this device" : "Off";
  return (
    <Card className="channel-card">
      <ChannelHead icon={<BellRing size={20} />} title="Push notifications" status={status} />
      <p className="small muted">Reminders pop up on your phone or computer, even when Kalorax is closed.</p>
      {config && !config.pushPublicKey ? (
        <p className="small muted">Push notifications aren't switched on for Kalorax yet.</p>
      ) : !pushSupported() || (isIos() && !isInstalled()) ? (
        blocked
      ) : onThisDevice ? (
        <div className="row channel-actions">
          <span className="ok small"><Check size={15} /> This device gets reminders</span>
          <Switch label="Push reminders" checked={reminders.push} onChange={(push) => save({ push })} />
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={turnOff}>Turn off here</button>
        </div>
      ) : (
        <>
          {blocked}
          <button className="btn btn-primary" disabled={busy || !config} onClick={turnOn}>
            <Smartphone size={17} /> {busy ? "Setting up…" : "Turn on for this device"}
          </button>
        </>
      )}
      {others > 0 && <p className="small muted">Also on {others} other {others === 1 ? "device" : "devices"}.</p>}
      {error && <p className="small error" role="alert">{error}</p>}
    </Card>
  );
}

const NUDGE_KEY = "kalorax:notify-nudge-dismissed";

/** On Messages: offer to turn on notifications for this device, so replies aren't missed. */
export function CloudNotifyNudge() {
  const { reminders, updateReminders } = useStore();
  const config = useQuery(api.reminders.config);
  const channels = useQuery(api.reminders.myChannels);
  const saveSub = useMutation(api.reminders.savePushSubscription);
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(NUDGE_KEY) === "1"; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void currentPushEndpoint().then(setEndpoint);
  }, []);

  const onThisDevice = !!endpoint && !!channels?.pushEndpoints.includes(endpoint);
  if (dismissed || !config?.pushPublicKey || !channels || endpoint === undefined || (onThisDevice && reminders.push)) return null;
  if (!pushSupported() || (isIos() && !isInstalled()) || Notification.permission === "denied") return null;

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      const keys = await subscribePush(config.pushPublicKey!);
      await saveSub(keys);
      setEndpoint(keys.endpoint);
      updateReminders({ ...reminders, push: true, utcOffsetMinutes: -new Date().getTimezoneOffset() });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(NUDGE_KEY, "1"); } catch { /* private mode */ }
  };
  return (
    <div className="notify-nudge" role="region" aria-label="Notifications">
      <BellRing size={18} aria-hidden />
      <span className="grow small">
        <strong>Don't miss a reply.</strong> Get a notification when a friend or your dietitian messages you.
        {error && <span className="error" role="alert"> {error}</span>}
      </span>
      <button className="btn btn-primary btn-small" disabled={busy} onClick={turnOn}>{busy ? "Turning on…" : "Turn on"}</button>
      <button className="icon-btn sm ghost" onClick={dismiss} aria-label="Not now"><X size={16} /></button>
    </div>
  );
}

export function CloudWhatsAppCard({ save }: { save: Save }) {
  const { reminders } = useStore();
  const config = useQuery(api.reminders.config);
  const channels = useQuery(api.reminders.myChannels);
  const start = useMutation(api.reminders.startWhatsApp);
  const confirm = useMutation(api.reminders.confirmWhatsApp);
  const remove = useMutation(api.reminders.removeWhatsApp);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wa = channels?.whatsapp ?? null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await start({ phone });
      setChanging(false);
      setCode("");
    });
  };
  const confirmCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await confirm({ code });
      save({ whatsapp: true });
    });
  };

  const available = config?.whatsappAvailable;
  const status = !config ? "Checking…" : !available ? "Coming soon" : wa?.verified && reminders.whatsapp ? `On · ${maskPhone(wa.phone)}` : wa?.verified ? "Paused" : "Off";

  return (
    <Card className="channel-card">
      <ChannelHead icon={<MessageCircle size={20} />} title="WhatsApp" status={status} />
      <p className="small muted">Get your reminders as WhatsApp messages. Handy if you don't keep the app open.</p>
      {config && !available ? (
        <p className="small muted">WhatsApp reminders are coming soon.</p>
      ) : wa?.verified && !changing ? (
        <div className="row channel-actions">
          <span className="ok small"><Check size={15} /> {maskPhone(wa.phone)} confirmed</span>
          <Switch label="WhatsApp reminders" checked={reminders.whatsapp} onChange={(whatsapp) => save({ whatsapp })} />
          <button className="btn btn-ghost btn-small" onClick={() => setChanging(true)}>Change number</button>
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => run(async () => { await remove(); save({ whatsapp: false }); })}>Remove</button>
        </div>
      ) : wa?.codePending && !changing ? (
        <form onSubmit={confirmCode}>
          <p className="small">We sent a 6-digit code to <strong>{maskPhone(wa.phone)}</strong> on WhatsApp.</p>
          <div className="row">
            <input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" aria-label="Code" />
            <button className="btn btn-primary" disabled={busy || code.length !== 6}>Confirm</button>
          </div>
          <div className="row">
            <button type="button" className="link-btn small" disabled={busy} onClick={() => run(() => start({ phone: wa.phone }))}>Send a new code</button>
            <button type="button" className="link-btn small" onClick={() => setChanging(true)}>Use another number</button>
          </div>
        </form>
      ) : (
        <form onSubmit={sendCode}>
          <label className="field">
            <span>WhatsApp number</span>
            <input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" />
          </label>
          <label className="toggle consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="small">I agree to get reminders from Kalorax on WhatsApp. I can turn them off here at any time.</span>
          </label>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !consent || !phone.trim()}>
              <Send size={16} /> {busy ? "Sending…" : "Send me a code"}
            </button>
            {changing && <button type="button" className="btn btn-ghost btn-small" onClick={() => setChanging(false)}>Cancel</button>}
          </div>
        </form>
      )}
      {error && <p className="small error" role="alert">{error}</p>}
    </Card>
  );
}

export function CloudTestButton({ alarm = false }: { alarm?: boolean }) {
  const sendTest = useMutation(api.reminders.sendTest);
  const [state, setState] = useState<{ ok?: boolean; text: string } | null>(null);
  return (
    <div className="row">
      <button
        className="btn btn-secondary btn-small"
        onClick={() =>
          sendTest({ alarm })
            .then(() => setState({ ok: true, text: alarm ? "Test alarm sent. Lock your phone to see it arrive." : "Test sent. It should arrive in a few seconds." }))
            .catch((e) => setState({ text: message(e) }))
        }
      >
        {alarm ? <AlarmClock size={15} /> : <Send size={15} />} {alarm ? "Test an alarm" : "Send a test reminder"}
      </button>
      {state && <span className={`small ${state.ok ? "ok" : "error"}`}>{state.text}</span>}
    </div>
  );
}

/** On-device: show a test alarm on this device straight away. */
export function LocalAlarmTestButton() {
  return (
    <button className="btn btn-secondary btn-small" onClick={() => void showNotification("⏰ Test alarm", "Alarms stay on screen until you tap Done or Snooze.", "/reminders", "test-alarm", true)}>
      <AlarmClock size={15} /> Test an alarm
    </button>
  );
}

/* ---------------- On-device (no account) ---------------- */

export function LocalPushCard({ save }: { save: Save }) {
  const { reminders } = useStore();
  const [permission, setPermission] = useState(() => (notificationsSupported() ? Notification.permission : "denied"));
  const on = reminders.push && permission === "granted";

  const enable = async () => {
    const p = await requestPermission();
    setPermission(p);
    if (p === "granted") {
      save({ push: true });
      void showNotification("Reminders are on ✅", "This is how your Kalorax reminders will look.", "/reminders", "test");
    }
  };

  return (
    <Card className="channel-card">
      <ChannelHead icon={<BellRing size={20} />} title="Notifications on this device" status={on ? "On" : "Off"} />
      <p className="small muted">
        Without an account, reminders show while Kalorax is open in a tab. Accounts get reminders even when the app is closed.
      </p>
      <PushBlocked />
      {on ? (
        <div className="row channel-actions">
          <span className="ok small"><Check size={15} /> Notifications allowed</span>
          <Switch label="Reminders on this device" checked={reminders.push} onChange={(push) => save({ push })} />
          <button className="btn btn-ghost btn-small" onClick={() => showNotification("Test reminder", "This is how your Kalorax reminders will look.", "/reminders", "test")}>
            Send a test
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" disabled={!notificationsSupported() || permission === "denied"} onClick={enable}>
          <Smartphone size={17} /> Turn on notifications
        </button>
      )}
    </Card>
  );
}

export function LocalWhatsAppCard() {
  return (
    <Card className="channel-card is-muted">
      <ChannelHead icon={<MessageCircle size={20} />} title="WhatsApp" status="Needs a Kalorax account" />
      <p className="small muted">WhatsApp reminders are sent from our servers, so they arrive with Kalorax accounts.</p>
    </Card>
  );
}
