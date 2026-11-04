// Paid interventions and dietitian client tools: one interface for the pages, backed by Convex
// (accounts) or by an on-device preview with sample dietitians and clients (no accounts, no payments).
import { useConvexAuth, useMutation, useQuery, useAction } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SAMPLE_OFFERINGS, sampleClients } from "../data/sampleInterventions";
import { PLATFORM_FEE_PERCENT } from "../data/programmes";
import {
  type Adjunct,
  type CheckIn,
  type ClientDetail,
  type ClientSummary,
  type DietitianCard,
  type DietitianTarget,
  type Earnings,
  type Intake,
  type MemberEnrolment,
  type Offering,
  type ThreadMessage,
} from "../lib/interventions";
import { todayIso, useStore, type Meal } from "./store";

export interface PracticeOffering {
  id: string;
  programmeId: string;
  priceNaira: number;
  active: boolean;
}

export interface PayoutAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface Practice {
  card: DietitianCard;
  payout: PayoutAccount | null;
  offerings: PracticeOffering[];
  earnings: Earnings;
}

export interface PlanItem {
  date: string;
  meal: Meal;
  recipeId: string;
  portion?: number;
}

export interface InterventionsApi {
  /** "preview": no accounts — sample dietitians and clients, nothing is paid or sent. */
  mode: "preview" | "cloud";
  catalogue: Offering[] | undefined;
  myEnrolments: MemberEnrolment[] | undefined;
  enrol: (offeringId: string, intake: Intake) => Promise<string>;
  /** Starts payment: returns a Paystack checkout URL, or demo when no payment is taken. */
  pay: (enrolmentId: string) => Promise<{ url?: string; demo?: boolean }>;
  verify: (reference: string) => Promise<string>;
  cancel: (enrolmentId: string) => Promise<void>;
  sendMessage: (enrolmentId: string, text: string) => Promise<void>;
  markRead: (enrolmentId: string) => void;

  /** Dietitians only (null for everyone else). */
  practice: Practice | null | undefined;
  saveProfile: (p: { bio: string; languages: string[]; yearsExperience: number; payout?: PayoutAccount }) => Promise<void>;
  saveOffering: (o: { programmeId: string; priceNaira: number; active: boolean }) => Promise<void>;
  clients: ClientSummary[] | null | undefined;
  /** A hook: call it at the top level of a component. */
  useClientDetail: (enrolmentId: string) => ClientDetail | null | undefined;
  setTarget: (enrolmentId: string, t: Omit<DietitianTarget, "setAt">) => Promise<void>;
  sendPlan: (enrolmentId: string, weekStart: string, items: PlanItem[]) => Promise<void>;
  addAdjunct: (enrolmentId: string, a: Omit<Adjunct, "id" | "approvedBy" | "approvedAt">) => Promise<void>;
  removeAdjunct: (enrolmentId: string, id: string) => Promise<void>;
  addCheckIn: (enrolmentId: string, c: { summary: string; nextSteps: string; weightKg?: number }) => Promise<void>;
  complete: (enrolmentId: string) => Promise<void>;
}

const Ctx = createContext<InterventionsApi | null>(null);

export function useInterventions(): InterventionsApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useInterventions must be used inside an interventions provider");
  return api;
}

/* ---------------- Cloud ---------------- */

export function CloudInterventionsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const { profile } = useStore();
  const member = isAuthenticated && !!profile;
  const isDietitian = member && profile!.role === "dietitian" && profile!.verification === "verified";

  const catalogue = useQuery(api.interventions.catalogue);
  const myEnrolments = useQuery(api.interventions.myEnrolments, member ? {} : "skip");
  const practice = useQuery(api.clients.myPractice, isDietitian ? {} : "skip");
  const clients = useQuery(api.clients.myClients, isDietitian ? {} : "skip");

  const enrol = useMutation(api.interventions.enrol);
  const startPayment = useAction(api.payments.startPayment);
  const verifyPayment = useAction(api.payments.verifyPayment);
  const cancelPending = useMutation(api.interventions.cancelPending);
  const sendMessage = useMutation(api.interventions.sendMessage);
  const markRead = useMutation(api.interventions.markRead);
  const saveProfile = useMutation(api.clients.saveProfile);
  const saveOffering = useMutation(api.clients.saveOffering);
  const setTarget = useMutation(api.clients.setTarget);
  const sendPlan = useMutation(api.clients.sendPlan);
  const addAdjunct = useMutation(api.clients.addAdjunct);
  const removeAdjunct = useMutation(api.clients.removeAdjunct);
  const addCheckIn = useMutation(api.clients.addCheckIn);
  const complete = useMutation(api.clients.completeEnrolment);

  const value = useMemo<InterventionsApi>(() => {
    const eid = (id: string) => id as Id<"enrolments">;
    const done = (p: Promise<unknown>) => p.then(() => undefined);
    return {
      mode: "cloud",
      catalogue,
      myEnrolments,
      enrol: async (offeringId, intake) => enrol({ offeringId: offeringId as Id<"offerings">, intake }),
      pay: (id) => startPayment({ enrolmentId: eid(id) }),
      verify: (reference) => verifyPayment({ reference }),
      cancel: (id) => done(cancelPending({ enrolmentId: eid(id) })),
      sendMessage: (id, text) => done(sendMessage({ enrolmentId: eid(id), text })),
      markRead: (id) => void markRead({ enrolmentId: eid(id) }).catch(() => {}),
      practice: isDietitian ? practice : null,
      saveProfile: (p) => done(saveProfile(p)),
      saveOffering: (o) => done(saveOffering(o)),
      clients: isDietitian ? clients : null,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useClientDetail: (id) => useQuery(api.clients.clientDetail, isDietitian ? { enrolmentId: eid(id) } : "skip") ?? (isDietitian ? undefined : null),
      setTarget: (id, t) => done(setTarget({ enrolmentId: eid(id), target: { ...t, setAt: "" } })),
      sendPlan: (id, weekStart, items) => done(sendPlan({ enrolmentId: eid(id), weekStart, items })),
      addAdjunct: (id, a) => done(addAdjunct({ enrolmentId: eid(id), ...a })),
      removeAdjunct: (_id, adjunctId) => done(removeAdjunct({ id: adjunctId as Id<"adjuncts"> })),
      addCheckIn: (id, c) => done(addCheckIn({ enrolmentId: eid(id), ...c })),
      complete: (id) => done(complete({ enrolmentId: eid(id) })),
    };
  }, [catalogue, myEnrolments, practice, clients, isDietitian, enrol, startPayment, verifyPayment, cancelPending, sendMessage, markRead, saveProfile, saveOffering, setTarget, sendPlan, addAdjunct, removeAdjunct, addCheckIn, complete]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- Preview (no accounts) ---------------- */

const PREVIEW_KEY = "kalorax:programmes-preview";

interface PreviewEnrolment {
  id: string;
  offeringId: string;
  status: MemberEnrolment["status"];
  createdAt: string;
  startDate?: string;
  intake: Intake;
  messages: ThreadMessage[];
}

interface PreviewState {
  enrolments: PreviewEnrolment[];
  profile: { bio: string; languages: string[]; yearsExperience: number; payout: PayoutAccount | null };
  offerings: PracticeOffering[];
  /** Changes made to sample clients. */
  clients: Record<string, Partial<Pick<ClientDetail, "target" | "planWeekStart" | "adjuncts" | "checkIns" | "messages" | "status" | "unread">>>;
}

const EMPTY_PREVIEW: PreviewState = {
  enrolments: [],
  profile: { bio: "", languages: ["English"], yearsExperience: 0, payout: null },
  offerings: [],
  clients: {},
};

function loadPreview(): PreviewState {
  try {
    return { ...EMPTY_PREVIEW, ...JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? "{}") };
  } catch {
    return EMPTY_PREVIEW;
  }
}

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

export function PreviewInterventionsProvider({ children }: { children: ReactNode }) {
  const { profile } = useStore();
  const [state, setState] = useState<PreviewState>(loadPreview);
  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(state));
    } catch {
      // Private mode: the preview still works for this visit.
    }
  }, [state]);
  const isDietitian = profile?.role === "dietitian" && profile.verification === "verified";

  const value = useMemo<InterventionsApi>(() => {
    const today = todayIso();
    const offeringById = new Map(SAMPLE_OFFERINGS.map((o) => [o.id, o]));
    const clientList: ClientDetail[] = sampleClients(today).map((c) => {
      const o = state.clients[c.enrolmentId] ?? {};
      return { ...c, ...o, messages: o.messages ?? c.messages };
    });
    const updateClient = (id: string, fn: (c: ClientDetail) => PreviewState["clients"][string]) =>
      setState((s) => {
        const c = clientList.find((x) => x.enrolmentId === id);
        return c ? { ...s, clients: { ...s.clients, [id]: { ...s.clients[id], ...fn(c) } } } : s;
      });
    const me: DietitianCard = {
      id: "me", name: profile?.name ?? "You", bio: state.profile.bio, languages: state.profile.languages,
      yearsExperience: state.profile.yearsExperience, clientsHelped: 0,
    };
    const gross = clientList.reduce((t, c) => t + (state.offerings.find((o) => o.programmeId === c.programmeId)?.priceNaira ?? 0), 0);
    const fee = Math.round((gross * PLATFORM_FEE_PERCENT) / 100);

    return {
      mode: "preview",
      catalogue: SAMPLE_OFFERINGS,
      myEnrolments: state.enrolments
        .filter((e) => e.status !== "cancelled")
        .map((e): MemberEnrolment => {
          const o = offeringById.get(e.offeringId)!;
          return {
            id: e.id, programmeId: o.programmeId, priceNaira: o.priceNaira, status: e.status, createdAt: e.createdAt,
            startDate: e.startDate, dietitian: o.dietitian, adjuncts: [], checkIns: [], messages: e.messages, sample: true,
          };
        }),
      enrol: async (offeringId, intake) => {
        const id = uid();
        setState((s) => ({ ...s, enrolments: [...s.enrolments, { id, offeringId, status: "pending_payment", createdAt: now(), intake, messages: [] }] }));
        return id;
      },
      pay: async (id) => {
        setState((s) => ({
          ...s,
          enrolments: s.enrolments.map((e) => {
            if (e.id !== id) return e;
            const d = offeringById.get(e.offeringId)!.dietitian;
            const welcome: ThreadMessage = {
              id: uid(), fromMe: false, senderName: d.name, sentAt: now(),
              text: `Welcome${profile ? `, ${profile.name.split(" ")[0]}` : ""}! I've received your intake. I'll review your logs this week and set your target and first plan. Keep logging your meals — it helps me a lot.`,
            };
            return { ...e, status: "active", startDate: todayIso(), messages: [welcome] };
          }),
        }));
        return { demo: true };
      },
      verify: async () => "activated",
      cancel: async (id) => setState((s) => ({ ...s, enrolments: s.enrolments.map((e) => (e.id === id ? { ...e, status: "cancelled" } : e)) })),
      sendMessage: async (id, text) => {
        const msg: ThreadMessage = { id: uid(), fromMe: true, senderName: profile?.name ?? "You", text: text.trim(), sentAt: now() };
        if (!msg.text) return;
        if (state.enrolments.some((e) => e.id === id)) {
          setState((s) => ({ ...s, enrolments: s.enrolments.map((e) => (e.id === id ? { ...e, messages: [...e.messages, msg] } : e)) }));
        } else {
          updateClient(id, (c) => ({ messages: [...c.messages, msg], unread: 0 }));
        }
      },
      markRead: (id) => {
        const c = clientList.find((x) => x.enrolmentId === id);
        if (c && c.unread > 0) updateClient(id, () => ({ unread: 0 }));
      },

      practice: isDietitian
        ? {
            card: me,
            payout: state.profile.payout,
            offerings: state.offerings,
            earnings: { grossNaira: gross, feeNaira: fee, netNaira: gross - fee, paidOutNaira: 0, balanceNaira: gross - fee, activeClients: clientList.filter((c) => c.status === "active").length },
          }
        : null,
      saveProfile: async ({ payout, ...p }) => setState((s) => ({ ...s, profile: { ...p, payout: payout ?? s.profile.payout } })),
      saveOffering: async (o) =>
        setState((s) => {
          const rest = s.offerings.filter((x) => x.programmeId !== o.programmeId);
          return { ...s, offerings: [...rest, { id: `mine:${o.programmeId}`, ...o }] };
        }),
      clients: isDietitian ? clientList.map(({ enrolmentId, name, programmeId, status, startDate, daysLogged7, lastLogDate, latestWeightKg, weightChangeKg, unread, sample }) => ({ enrolmentId, name, programmeId, status, startDate, daysLogged7, lastLogDate, latestWeightKg, weightChangeKg, unread, sample })) : null,
      useClientDetail: (id) => (isDietitian ? clientList.find((c) => c.enrolmentId === id) ?? null : null),
      setTarget: async (id, t) => updateClient(id, () => ({ target: { ...t, setAt: now() } })),
      sendPlan: async (id, weekStart) => updateClient(id, () => ({ planWeekStart: weekStart })),
      addAdjunct: async (id, a) =>
        updateClient(id, (c) => ({ adjuncts: [...c.adjuncts, { ...a, id: uid(), approvedBy: profile?.name ?? "You", approvedAt: now() }] })),
      removeAdjunct: async (id, adjunctId) => updateClient(id, (c) => ({ adjuncts: c.adjuncts.filter((a) => a.id !== adjunctId) })),
      addCheckIn: async (id, ci) =>
        updateClient(id, (c) => {
          const week = c.startDate ? Math.floor((Date.parse(`${today}T12:00:00`) - Date.parse(`${c.startDate}T12:00:00`)) / (7 * 86_400_000)) + 1 : 1;
          const entry: CheckIn = { id: uid(), week, createdAt: now(), ...ci };
          return { checkIns: [entry, ...c.checkIns] };
        }),
      complete: async (id) => updateClient(id, () => ({ status: "completed" })),
    };
  }, [state, profile, isDietitian]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Reset the preview (used by "Delete my data" on the device). */
export function clearInterventionsPreview() {
  try {
    localStorage.removeItem(PREVIEW_KEY);
  } catch {
    // ignore
  }
}

