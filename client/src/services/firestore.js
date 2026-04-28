/**
 * Firestore service — per-user storage for:
 *   /users/{uid}/uploads        — bank statement upload history
 *   /users/{uid}/creditScores   — credit score snapshots
 *   /users/{uid}/transactions   — NLP-classified transactions
 *   /users/{uid}  (doc)         — user profile & latest stats
 */
import {
  getFirestore,
  collection, addDoc, getDocs, setDoc, doc, getDoc,
  query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { isFirebaseConfigured } from "./firebase";
import { getApps } from "firebase/app";

let db = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps()[0]; // reuse already-initialised app from firebase.js
    if (app) db = getFirestore(app);
  } catch (err) {
    console.warn("[Firestore] Init failed:", err.message);
  }
}

// ─── Timeout Wrapper ─────────────────────────────────────────────────────────
const withTimeout = (promise, ms = 3000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const userCol = (uid, sub) => collection(db, "users", uid, sub);
const userDocRef = (uid) => doc(db, "users", uid);

// ─── Guard ───────────────────────────────────────────────────────────────────
const notReady = () => { console.warn("[Firestore] Not configured — data not saved."); };

// ─── User Profile ─────────────────────────────────────────────────────────────
export const saveUserProfile = async (uid, data) => {
  if (!db) return notReady();
  await setDoc(userDocRef(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

export const getUserProfile = async (uid) => {
  if (!db) return null;
  try {
    const snap = await getDoc(userDocRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
};

// ─── Uploads ──────────────────────────────────────────────────────────────────
/**
 * Save a bank statement upload record.
 * @param {string} uid
 * @param {{ fileName, fileSize, creditScore, riskScore, categories, status }} uploadData
 * @returns {string|null} Firestore doc ID
 */
export const saveUpload = async (uid, uploadData) => {
  if (!db) { notReady(); return null; }
  const ref = await addDoc(userCol(uid, "uploads"), {
    ...uploadData,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Fetch all uploads for a user, newest first.
 */
export const getUploads = async (uid) => {
  if (!db) return [];
  try {
    const q = query(userCol(uid, "uploads"), orderBy("createdAt", "desc"), limit(20));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};

// ─── Credit Scores ────────────────────────────────────────────────────────────
/**
 * Save a credit score snapshot and update the user profile's latest score.
 */
export const saveCreditScore = async (uid, score, source = "upload") => {
  if (!db) { notReady(); return null; }
  const ref = await addDoc(userCol(uid, "creditScores"), {
    score, source, createdAt: serverTimestamp(),
  });
  // Keep the user profile in sync
  await saveUserProfile(uid, { latestCreditScore: score });
  return ref.id;
};

/**
 * Fetch the last 12 credit score snapshots.
 */
export const getCreditScoreHistory = async (uid) => {
  if (!db) return [];
  try {
    const q = query(userCol(uid, "creditScores"), orderBy("createdAt", "desc"), limit(12));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};

// ─── Transactions ─────────────────────────────────────────────────────────────
/**
 * Bulk-save NLP-classified transactions from a bank statement.
 */
export const saveTransactions = async (uid, transactions) => {
  if (!db || !transactions?.length) return;
  const col = userCol(uid, "transactions");
  await Promise.all(transactions.map(tx =>
    addDoc(col, { ...tx, createdAt: serverTimestamp() })
  ));
};

/**
 * Fetch stored transactions for a user (most recent 50).
 */
export const getStoredTransactions = async (uid) => {
  if (!db) return [];
  try {
    const q = query(userCol(uid, "transactions"), orderBy("createdAt", "desc"), limit(50));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};

export { db };
export const isFirestoreConfigured = Boolean(db);
