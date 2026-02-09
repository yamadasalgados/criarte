// /src/lib/firebaseClient.ts
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    // ajuda MUITO a pegar env faltando no deploy
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

const firebaseConfig = {
apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!, 
authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!, 
projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!, 
storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!, 
messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!, 
appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!, };

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// ✅ Android/WebView: garante persistência estável pro redirect
// - tenta LOCAL primeiro
// - se falhar, cai pra SESSION
if (typeof window !== "undefined") {
  // não precisa await: roda em background e melhora estabilidade
  setPersistence(auth, browserLocalPersistence).catch(() => {
    setPersistence(auth, browserSessionPersistence).catch(() => {});
  });

  // opcional, mas ajuda UX
  auth.languageCode = "pt";
}

export const db = getFirestore(app);
export const storage = getStorage(app);
