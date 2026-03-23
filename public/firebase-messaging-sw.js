/* eslint-disable no-restricted-globals */
/* Generado por scripts/generate-firebase-messaging-sw.js - no editar a mano */
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({"apiKey":"AIzaSyCr-pd_l3dvKQ9360UUqjc-UVkmsKBOnVU","authDomain":"cuentas-pwa.firebaseapp.com","projectId":"cuentas-pwa","storageBucket":"cuentas-pwa.firebasestorage.app","messagingSenderId":"592382157261","appId":"1:592382157261:web:a06b3e24e38c7e88446484"});
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
