/**
 * @module firebase-app
 * @description Single owner of Firebase SDK initialization for the extension.
 *   Initializes the Firebase app once, the Auth instance (web-extension build
 *   with IndexedDB persistence so the signed-in user survives service-worker
 *   restarts and is shared between the background and extension pages), and the
 *   Functions instance used to invoke Callable Cloud Functions. Every other
 *   module obtains the Auth/Functions singletons from here rather than calling
 *   initializeApp directly. Config is built from the per-profile VITE_FIREBASE_*
 *   env vars, so dev and prod builds target their own Firebase projects.
 * @dependencies firebase/app, firebase/auth/web-extension, firebase/functions
 * @public getFirebaseAuth, getFirebaseFunctions, whenAuthReady
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  type Auth,
} from 'firebase/auth/web-extension';
import { getFunctions, type Functions } from 'firebase/functions';

const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) ?? '';
const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string) ?? '';
const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) ?? '';
const storageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) ?? '';
const appId = (import.meta.env.VITE_FIREBASE_APP_ID as string) ?? '';
const messagingSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) ?? '';
const cfBaseUrl = (import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL as string) ?? '';

/**
 * Derives the Cloud Functions region from the deployment base URL
 * (https://<region>-<project>.cloudfunctions.net). Falls back to us-central1.
 */
function resolveFunctionsRegion(): string {
  try {
    const host = new URL(cfBaseUrl).hostname; // <region>-<project>.cloudfunctions.net
    const region = host.split('.')[0].replace(`-${projectId}`, '');
    return region || 'us-central1';
  } catch {
    return 'us-central1';
  }
}

// Omit optional keys when unset so the SDK never receives empty strings.
const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  ...(storageBucket ? { storageBucket } : {}),
  ...(appId ? { appId } : {}),
  ...(messagingSenderId ? { messagingSenderId } : {}),
};

// Reuse an existing app across HMR / repeated imports in the same realm.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth | null = null;
let functionsInstance: Functions | null = null;

/**
 * The shared Firebase Auth instance (web-extension build).
 *
 * IndexedDB persistence is mandatory: a service worker has no localStorage, and
 * IndexedDB is shared across the extension origin, so the session established in
 * the background is visible to extension pages (dashboard/popup) too.
 */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    try {
      authInstance = initializeAuth(app, { persistence: indexedDBLocalPersistence });
    } catch {
      // Already initialized on this app (e.g. an HMR re-evaluation) — reuse it.
      authInstance = getAuth(app);
    }
  }
  return authInstance;
}

/** The shared Functions instance, pinned to the deployment region. */
export function getFirebaseFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, resolveFunctionsRegion());
  }
  return functionsInstance;
}

/**
 * Resolves once the Auth instance has finished rehydrating persisted state, so
 * callers never invoke a Callable before `currentUser` is loaded on a cold
 * service-worker start.
 */
export async function whenAuthReady(): Promise<void> {
  await getFirebaseAuth().authStateReady();
}
