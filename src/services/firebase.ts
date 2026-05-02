import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Warn developers when placeholder Firebase config values are detected
if (__DEV__ && firebaseConfig.apiKey.startsWith('YOUR_')) {
  console.warn(
    '[ChoreShare] Firebase is not configured. Replace placeholder values in src/services/firebase.ts with your actual Firebase project credentials.'
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export default app;
