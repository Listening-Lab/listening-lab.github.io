import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// These config values are not secrets (Firebase web config is public by design), but until
// they're set (see .env) getAuth() throws and would take the whole site down, since
// AuthProvider wraps every page including the public marketing pages. Degrade instead:
// auth is null and the rest of the app treats that as "signed out, sign-in unavailable".
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey)

export const firebaseApp = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
