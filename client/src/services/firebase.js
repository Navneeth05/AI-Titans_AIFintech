import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app       = null;
let auth      = null;
let messaging = null;

if (isFirebaseConfigured) {
  try {
    app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    // Analytics only works in browser (not SSR/workers)
    if (typeof window !== "undefined") {
      try { getAnalytics(app); } catch (_) {}
    }
    try { messaging = getMessaging(app); } catch (_) {}
  } catch (err) {
    console.warn("[Firebase] Init error:", err.message);
  }
}

export { app, auth };
export const googleProvider = new GoogleAuthProvider();

export const loginWithEmail = async (email, password) => {
  if (!auth) throw new Error("Firebase not configured");
  const r = await signInWithEmailAndPassword(auth, email, password);
  return r.user;
};

export const registerWithEmail = async (email, password) => {
  if (!auth) throw new Error("Firebase not configured");
  const r = await createUserWithEmailAndPassword(auth, email, password);
  return r.user;
};

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase not configured");
  const r = await signInWithPopup(auth, googleProvider);
  return r.user;
};

export const logout = () => (auth ? signOut(auth) : Promise.resolve());

export const setupMessaging = async () => {
  if (!messaging) return null;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;
    return await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
  } catch (err) {
    console.warn("[FCM]", err.message);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, resolve);
  });
