import { initializeApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

let messaging = null
export async function getMessagingInstance() {
  if (messaging) return messaging
  const supported = await isMessagingSupported()
  if (!supported) return null
  messaging = getMessaging(app)
  return messaging
}

// Persistir sesión en local storage hasta que cierre sesión
export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence)
  } catch (e) {
    console.error('Error setting auth persistence', e)
  }
}

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider)
}

export default app
