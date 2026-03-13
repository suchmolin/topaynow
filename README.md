# Cuentas PWA

Aplicación móvil (PWA) para gestionar **cuentas por pagar**, **cuentas por cobrar** y **gastos fijos**, organizados en listas compartibles.

## Stack

- **React** + **Vite**
- **Tailwind CSS**
- **Firebase** (Auth + Firestore, sin backend propio)
- **React Router**
- **PWA** (vite-plugin-pwa)

## Requisitos

- Node 18+
- Cuenta en [Firebase](https://console.firebase.google.com/)

## Pasos para ejecutar

1. **Clonar e instalar**
   ```bash
   cd cuentas-pwa
   npm install
   ```

2. **Configurar Firebase**  
   Sigue las instrucciones en [FIREBASE.md](./FIREBASE.md): crear proyecto, Auth (correo/contraseña), Firestore, reglas, índices y variables en `.env`.

3. **Arrancar en desarrollo**
   ```bash
   npm run dev
   ```
   Abre la URL que muestre Vite (p. ej. `http://localhost:5173`). Para probar en móvil, usa la IP de tu máquina y el mismo puerto.

4. **Build para producción**
   ```bash
   npm run build
   npm run preview
   ```

## Estructura principal

- `src/pages/` – Login, Register, Listas, Payables, Receivables, FixedExpenses, Settings, InviteLanding
- `src/components/` – Modal, FAB, BottomNav
- `src/hooks/` – useLists, usePayables, useReceivables, useFixedExpenses
- `src/context/AuthContext.jsx` – estado de autenticación
- `src/lib/firebase.js` – inicialización de Firebase

## PWA

La app es instalable en el móvil. Los iconos se buscan en `public/icons/` (icon-192.png, icon-512.png). Si no existen, la instalación puede usar un icono por defecto; ver [FIREBASE.md](./FIREBASE.md) para generarlos.

## Despliegue

Para desplegar en **Firebase Hosting** o **Vercel**, sigue los pasos en [DEPLOY.md](./DEPLOY.md). Recomendado Firebase Hosting por tener Auth y Firestore en el mismo proyecto.
