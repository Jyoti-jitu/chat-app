import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

// Safe fallback only when building without environment variables present
const buildSafeConfig = firebaseConfig.apiKey
  ? firebaseConfig
  : {
      ...firebaseConfig,
      apiKey: "AIzaSyDummyKeyForPrerenderSafeBuild00",
      authDomain: "example.firebaseapp.com",
      projectId: "example-project",
      appId: "1:000000000000:web:0000000000000000000000",
    };

// Initialize Firebase singleton
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(buildSafeConfig);
const auth: Auth = getAuth(app);

export { app, auth };
