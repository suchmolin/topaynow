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
2. Abre `.env` y rellena con los valores de tu proyecto (Firebase Console → Configuración del proyecto → Tus apps):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
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

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && request.auth.uid == userId;
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

   **Cómo rellenar "Crear un índice compuesto" en la consola:**

   - **Índice 1 – Colección `lists`:** ID de la colección: `lists`. Campos (solo 2; quita cualquier fila extra): `memberIds` → **Arrays**; `updatedAt` → **Descendente**. Crear.

   - **Índice 2 – `payables`:** ID: `payables`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 3 – `receivables`:** ID: `receivables`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 4 – `fixedExpenses`:** ID: `fixedExpenses`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

   - **Índice 5 – `listActivity`:** ID: `listActivity`. Campos: `listId` → **Ascendente**; `createdAt` → **Descendente**. Crear.

## 5. Dominios autorizados (Auth)

Si vas a probar en `localhost`, ya está permitido. Si desplegarás en otro dominio, añádelo en **Autenticación** → **Configuración** → **Dominios autorizados**.

## 6. Iconos PWA (opcional)

Para que la PWA se instale con icono correcto, añade en `public/icons/`:

- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Puedes generar estos a partir de un logo con [realfavicongenerator.net](https://realfavicongenerator.net/) o similar.

---

Después de esto, ejecuta `npm run dev` y la app debería conectar con tu proyecto de Firebase.
