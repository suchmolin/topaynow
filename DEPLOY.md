# Desplegar la aplicación

Puedes desplegar en **Firebase Hosting** o **Vercel**. Los dos funcionan bien con esta PWA.

---

## Recomendación: Firebase Hosting

Tiene sentido usar **Firebase Hosting** porque ya usas Firebase (Auth y Firestore): un solo lugar para proyecto, dominio y configuración. El plan gratuito incluye 10 GB de almacenamiento y ancho de banda suficiente para una app de este tipo.

---

## Opción 1: Firebase Hosting

### 1. Firebase CLI (sin instalar global)

Puedes usar **npx** y no instalar nada global (evita problemas de permisos):

```bash
npx firebase-tools login
```

Si prefieres instalarlo global y te pide permisos, usa:

```bash
sudo npm install -g firebase-tools
```

### 2. Vincular el proyecto

En la raíz del repositorio (`cuentas-pwa`):

```bash
npx firebase-tools use --add
```

Elige tu proyecto de Firebase (el mismo donde tienes Auth y Firestore). Si solo tienes uno, se puede dejar por defecto.

### 3. Build y despliegue

```bash
npm run deploy
```

Ese comando hace `build` y despliega **solo Hosting** (`firebase deploy --only hosting`), así no necesitas el plan Blaze. La URL quedará tipo:

Si más adelante activas el plan Blaze y quieres desplegar también Cloud Functions (notificaciones con la app cerrada), usa:

```bash
npm run deploy:all
```

La URL de tu app quedará tipo:

- `https://<tu-project-id>.webapp.app`
- `https://<tu-project-id>.firebaseapp.com`

### 4. Dominios autorizados en Auth

En [Firebase Console](https://console.firebase.google.com/) → **Autenticación** → **Configuración** → **Dominios autorizados**, añade:

- `tu-project-id.webapp.app`
- `tu-project-id.firebaseapp.com`

Así login (incluido Google) funcionará en producción.

### 5. Siguientes despliegues

```bash
npm run deploy
```

(Este script hace build y `firebase deploy --only hosting`; no requiere plan Blaze.)

---

## Opción 2: Vercel

### 1. Cuenta y CLI (opcional)

- Crea cuenta en [vercel.com](https://vercel.com).
- Opcional: `npm i -g vercel` para desplegar por terminal.

### 2. Conectar el repositorio (recomendado)

1. Entra en [vercel.com/new](https://vercel.com/new).
2. Importa el repo de GitHub/GitLab/Bitbucket donde esté `cuentas-pwa`.
3. **Root Directory**: si el repo es solo esta app, deja `.`; si el repo contiene varias carpetas, pon `cuentas-pwa` (o la ruta donde esté este proyecto).
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. Despliega. Vercel te dará una URL tipo `https://cuentas-pwa-xxx.vercel.app`.

### 3. Variables de entorno en Vercel

En el proyecto en Vercel → **Settings** → **Environment Variables**, añade las mismas variables que tienes en `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Asigna a **Production** (y a Preview si quieres).

### 4. Dominios autorizados en Firebase Auth

En Firebase Console → **Autenticación** → **Configuración** → **Dominios autorizados**, añade el dominio que te dé Vercel, por ejemplo:

- `cuentas-pwa-xxx.vercel.app`
- O tu dominio propio si lo configuras en Vercel.

### 5. SPA (rutas)

Vercel ya sirve bien una SPA con rutas tipo `/list/123/payables` si el build genera `index.html` en `dist` y las rutas son manejadas por React Router. Si alguna ruta devolviera 404, en Vercel añade un **Rewrite** a `/index.html` para esa ruta (en la configuración del proyecto).

---

## Resumen

| Criterio           | Firebase Hosting     | Vercel                |
|--------------------|----------------------|------------------------|
| Mismo ecosistema   | Sí (Auth + Firestore)| No                    |
| Configuración      | `firebase.json` ya   | Config en dashboard    |
| Dominio por defecto| `.webapp.app`        | `.vercel.app`         |
| Variables de entorno | No (usa las de build) | Sí, en el dashboard |

Recomendación: **Firebase Hosting** para tener todo en un solo sitio. Usa **Vercel** si prefieres sus previews por rama o ya trabajas con Vercel en otros proyectos.
