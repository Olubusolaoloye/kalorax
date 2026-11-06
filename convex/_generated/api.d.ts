/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as beta from "../beta.js";
import type * as challenges from "../challenges.js";
import type * as clients from "../clients.js";
import type * as coach from "../coach.js";
import type * as coachAgent from "../coachAgent.js";
import type * as coachTools from "../coachTools.js";
import type * as crons from "../crons.js";
import type * as data from "../data.js";
import type * as email from "../email.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as importLocal from "../importLocal.js";
import type * as interventions from "../interventions.js";
import type * as me from "../me.js";
import type * as notify from "../notify.js";
import type * as passwordReset from "../passwordReset.js";
import type * as payments from "../payments.js";
import type * as pro from "../pro.js";
import type * as profile from "../profile.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reminders from "../reminders.js";
import type * as settings from "../settings.js";
import type * as snooze from "../snooze.js";
import type * as social from "../social.js";
import type * as storageCleanup from "../storageCleanup.js";
import type * as teams from "../teams.js";
import type * as usernames from "../usernames.js";
import type * as validators from "../validators.js";
import type * as verification from "../verification.js";
import type * as vitals from "../vitals.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  alerts: typeof alerts;
  auth: typeof auth;
  beta: typeof beta;
  challenges: typeof challenges;
  clients: typeof clients;
  coach: typeof coach;
  coachAgent: typeof coachAgent;
  coachTools: typeof coachTools;
  crons: typeof crons;
  data: typeof data;
  email: typeof email;
  helpers: typeof helpers;
  http: typeof http;
  importLocal: typeof importLocal;
  interventions: typeof interventions;
  me: typeof me;
  notify: typeof notify;
  passwordReset: typeof passwordReset;
  payments: typeof payments;
  pro: typeof pro;
  profile: typeof profile;
  rateLimit: typeof rateLimit;
  reminders: typeof reminders;
  settings: typeof settings;
  snooze: typeof snooze;
  social: typeof social;
  storageCleanup: typeof storageCleanup;
  teams: typeof teams;
  usernames: typeof usernames;
  validators: typeof validators;
  verification: typeof verification;
  vitals: typeof vitals;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
