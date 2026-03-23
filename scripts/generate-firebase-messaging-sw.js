/**
 * Genera public/firebase-messaging-sw.js con la config de Firebase desde .env
 * Ejecutar: node scripts/generate-firebase-messaging-sw.js
 * Se ejecuta en prebuild para que el SW tenga la config correcta.
 */
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnv() {
  try {
    const envPath = path.join(root, '.env')
    const content = readFileSync(envPath, 'utf8')
    const env = {}
    for (const line of content.split('\n')) {
      const m = line.match(/^VITE_FIREBASE_(.+?)=(.*)$/)
      if (m) env['VITE_FIREBASE_' + m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    return env
  } catch {
    return {}
  }
}

const env = loadEnv()
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
}

const swContent = `/* eslint-disable no-restricted-globals */
/* Generado por scripts/generate-firebase-messaging-sw.js - no editar a mano */
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || payload.data?.title || 'ToListNow';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.svg',
    tag: payload.data?.tag || payload.messageId || ('fcm-' + Date.now()),
    data: payload.data || {},
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.includes(self.location.origin) && 'focus' in clientList[i]) {
          clientList[i].navigate(url);
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
`

writeFileSync(path.join(root, 'public', 'firebase-messaging-sw.js'), swContent)
console.log('Generated public/firebase-messaging-sw.js')
