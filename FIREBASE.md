# Configuración de Firebase

Sigue estos pasos para conectar la aplicación con tu proyecto de Firebase.

## 1. Crear proyecto en Firebase

1. Entra a [Firebase Console](https://console.firebase.google.com/).
2. Crea un proyecto nuevo (o usa uno existente).
3. Añade una aplicación **Web** (icono `</>`). Registra la app y anota el objeto `firebaseConfig`.

## 2. Variables de entorno

1. En la raíz del proyecto, copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
2. Abre `.env` y rellena con los valores de tu proyecto (Firebase Console → Configuración del proyecto → Tus apps). Para notificaciones push, añade también la clave VAPID (ver sección 5.1):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_VAPID_KEY=...   # Opcional; ver §5.1 (Mensajería en la nube → Certificados push web)
   ```

## 3. Autenticación

1. En Firebase Console → **Compilación** → **Autenticación**.
2. Haz clic en **Comenzar** y activa el método **Correo/Contraseña** (nombre y contraseña).

## 4. Firestore

1. En Firebase Console → **Compilación** → **Firestore Database**.
2. Crea la base de datos en modo **Producción** (elegir región, por ejemplo `us-central1`).
3. Ve a la pestaña **Reglas** y pega las siguientes reglas (ajusta si quieres restricciones distintas):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(ownerId) {
      return isSignedIn() && request.auth.uid == ownerId;
    }
    function isMember(memberIds) {
      return isSignedIn() && request.auth.uid in memberIds;
    }

    match /lists/{listId} {
      allow read: if isSignedIn() && (
        request.auth.uid in resource.data.memberIds
        || resource.data.ownerId == request.auth.uid
        || resource.data.inviteToken != null
      );
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.ownerId;
      allow update: if isOwner(resource.data.ownerId)
        || (isSignedIn() && request.auth.uid in request.resource.data.memberIds
            && !(request.auth.uid in resource.data.memberIds)
            && request.resource.data.memberIds.size() == resource.data.memberIds.size() + 1);
      allow delete: if isOwner(resource.data.ownerId);
    }

    match /listInvites/{token} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.ownerId == request.auth.uid;
    }

    match /payables/{id} {
      allow read, write: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.memberIds;
      allow create: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(request.resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.memberIds;
    }

    match /receivables/{id} {
      allow read, write: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.memberIds;
      allow create: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(request.resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.memberIds;
    }

    match /fixedExpenses/{id} {
      allow read, write: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.memberIds;
      allow create: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(request.resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.memberIds;
    }

    match /todos/{id} {
      allow read, write: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.memberIds;
      allow create: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(request.resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.memberIds;
    }

    match /todoRecurrenceTemplates/{id} {
      allow read, write: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.memberIds;
      allow create: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(request.resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.memberIds;
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId}/fcmTokens/{tokenId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    match /listActivity/{id} {
      allow read: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.memberIds;
      allow create: if isSignedIn() && exists(/databases/$(database)/documents/lists/$(request.resource.data.listId))
        && request.auth.uid in get(/databases/$(database)/documents/lists/$(request.resource.data.listId)).data.memberIds;
    }
  }
}
```

4. **Índices compuestos**: al usar la app, Firestore puede pedir crear índices. Si aparece un enlace en la consola del navegador o en la pestaña “Índices” de Firestore, haz clic y crea el índice. Los que necesitas son:
   - **Colección `lists`**: Campos indexados: `memberIds` (Arrays), `updatedAt` (Descending). Consulta: `array-contains` en memberIds + `orderBy` updatedAt.
   - **Colección `payables`**: `listId` (Ascending), `createdAt` (Descending).
   - **Colección `receivables`**: `listId` (Ascending), `createdAt` (Descending).
   - **Colección `fixedExpenses`**: `listId` (Ascending), `createdAt` (Descending).
   - **Colección `todos`**: `listId` (Ascending), `createdAt` (Descending).
   - **Colección `todoRecurrenceTemplates`**: `listId` (Ascending), `createdAt` (Descending).

   **Cómo rellenar "Crear un índice compuesto" en la consola:**

   - **Índice 1 – Colección `lists`:** ID de la colección: `lists`. Campos (solo 2; quita cualquier fila extra): `memberIds` → **Arrays**; `updatedAt` → **Descendente**. Crear.

   - **Índice 2 – `payables`:** ID: `payables`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 3 – `receivables`:** ID: `receivables`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 4 – `fixedExpenses`:** ID: `fixedExpenses`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 5 – `listActivity`:** ID: `listActivity`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 6 – `todos`:** ID: `todos`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 7 – `todoRecurrenceTemplates`:** ID: `todoRecurrenceTemplates`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 8 – `todos` (para Cloud Functions):** ID: `todos`. Campos: `listId` → **Ascendente**; `recurrenceTemplateId` → **Ascendente**; `instanceDate` → **Ascendente**. Crear.

   - **Índice 9 – `todos` (pendientes hoy):** ID: `todos`. Campos: `dueDateStr` → **Ascendente**. Crear (índice de un solo campo si hace falta).

## 5. Notificaciones push (FCM) y Cloud Functions

Para que las notificaciones lleguen **con la app cerrada** (y para que la app pueda solicitar el token FCM y enviar notificaciones desde código), necesitas la **clave VAPID**.

### 5.1 Dónde encontrar o generar la clave VAPID

La clave VAPID **no** está en la pantalla de “Crear notificación” (Mensajes de Firebase). Está en la **configuración del proyecto**:

1. En [Firebase Console](https://console.firebase.google.com/), abre tu proyecto.
2. Haz clic en el **engranaje** (⚙️) junto a “Descripción general del proyecto” → **Configuración del proyecto**.
3. Ve a la pestaña **Mensajería en la nube** (Cloud Messaging).
4. Baja hasta la sección **“Configuración web”** / **“Web configuration”**.
5. Ahí verás **“Certificados de notificaciones push web”** / **“Web Push certificates”**.
   - Si ya hay un **par de claves**: verás una clave larga que empieza por `B...` (es la clave **pública**). Esa es la VAPID key.
   - Si no hay par de claves: haz clic en **“Generar par de claves”** / **“Generate key pair”**. Copia la clave que se muestra (la pública, la que empieza por `B...`).
6. En la raíz del proyecto, abre `.env` y añade o edita:
   ```
   VITE_FIREBASE_VAPID_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   (pega tu clave completa, sin espacios al inicio ni al final).
7. Ejecuta `npm run build` o `npm run prebuild` para regenerar `public/firebase-messaging-sw.js` si hace falta.

**Resumen de ruta:** Configuración del proyecto (⚙️) → pestaña **Mensajería en la nube** → sección **Configuración web** → **Certificados de notificaciones push web** → clave pública (o “Generar par de claves”).

### 5.2 Cloud Functions

1. Instala dependencias de las funciones:
   ```bash
   cd functions && npm install && cd ..
   ```
2. Despliega las funciones (requiere plan Blaze de Firebase):
   ```bash
   npx firebase-tools deploy --only functions
   ```
3. Se desplegarán:
   - **recurrencePush**: cada minuto comprueba si hay tareas recurrentes que deban crearse a la hora programada (usa la zona horaria del usuario guardada al crear la plantilla) y envía un push.
   - **pendingTodayPush**: cada día a las 13:00 UTC envía un push con las tareas pendientes para hoy.

Si no tienes plan de pago, las notificaciones solo funcionarán **con la app abierta** (notificaciones locales).

## 6. Dominios autorizados (Auth)

Si vas a probar en `localhost`, ya está permitido. Si desplegarás en otro dominio, añádelo en **Autenticación** → **Configuración** → **Dominios autorizados**.

## 7. Iconos PWA (opcional)

Para que la PWA se instale con icono correcto, añade en `public/icons/`:

- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Puedes generar estos a partir de un logo con [realfavicongenerator.net](https://realfavicongenerator.net/) o similar.

---

Después de esto, ejecuta `npm run dev` y la app debería conectar con tu proyecto de Firebase.
