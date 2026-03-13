import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const USERS = 'users'

export function useUserProfile(uid) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(!!uid)

  useEffect(() => {
    if (!uid) {
      setProfile(null)
      setLoading(false)
      return
    }
    getDoc(doc(db, USERS, uid))
      .then((snap) => {
        if (snap.exists()) {
          setProfile(snap.data())
        } else {
          setProfile(null)
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [uid])

  return { profile, loading }
}

export async function syncCurrentUserProfile(user) {
  if (!user?.uid) return
  const { displayName, email } = user
  await setDoc(
    doc(db, USERS, user.uid),
    {
      displayName: displayName || email || null,
      email: email || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
