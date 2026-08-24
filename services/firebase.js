import { initializeApp, getApps } from 'firebase/app';
import { getFirestore as getClientFirestore, Timestamp } from 'firebase/firestore';

let db = null;
let initAttempted = false;

function firebaseWebConfig() {
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const appId = process.env.FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId,
  };
}

export function getFirestore() {
  if (initAttempted) return db;
  initAttempted = true;

  try {
    const config = firebaseWebConfig();
    if (!config) {
      console.warn(
        '[firebase] FIREBASE_API_KEY / FIREBASE_PROJECT_ID / FIREBASE_APP_ID missing; skipping Firestore writes'
      );
      return null;
    }

    const app =
      getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getClientFirestore(app);
    console.log(
      `[firebase] Firestore initialized project=${config.projectId} collection=${firestoreCollectionName()}`
    );
    return db;
  } catch (err) {
    console.error('[firebase] failed to initialize:', err.message);
    db = null;
    return null;
  }
}

export function firestoreCollectionName() {
  return process.env.FIRESTORE_COLLECTION || 'Monitoring-outputs';
}

export { Timestamp };
