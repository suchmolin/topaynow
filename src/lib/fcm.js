/**
 * Firebase Cloud Messaging: registro del token y guardado en Firestore
 * para que las Cloud Functions puedan enviar push con la app cerrada.
 */
import { getToken } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { getMessagingInstance } from './firebase'
import { db } from './firebase'

const FCM_TOKENS_COLLECTION = 'fcmTokens'

/** Obtiene el token FCM y lo guarda en Firestore para el usuario. */
export async function registerFCMToken(userId) {
  if (!userId) return null
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('FCM: VITE_FIREBASE_VAPID_KEY no configurada')
    return null
  }
  const messaging = await getMessagingInstance()
  if (!messaging) return null
  try {
    const token = await getToken(messaging, { vapidKey })
    if (!token) return null
    const tokenId = token.slice(0, 20) + token.slice(-10)
    await setDoc(doc(db, 'users', userId, FCM_TOKENS_COLLECTION, tokenId), {
      token,
      updatedAt: new Date(),
    })
    return token
  } catch (e) {
    console.error('FCM getToken error', e)
    return null
  }
}
