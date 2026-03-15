# Firmar la app y generar AAB para Play Store

Después de descargar el paquete Android (desde PWABuilder o Bubblewrap), sigue estos pasos en Android Studio para firmar la app y generar el **AAB** (Android App Bundle) que subes a Google Play.

---

## 1. Abrir el proyecto en Android Studio

1. Abre **Android Studio**.
2. **File** → **Open** y selecciona la carpeta del proyecto que descargaste (la que contiene `build.gradle`, `app/`, etc.).
3. Espera a que Android Studio sincronice Gradle (puede tardar unos minutos la primera vez).

---

## 2. Crear un keystore (solo la primera vez)

El **keystore** es el archivo con el que firmas la app. Guárdalo y no lo pierdas: lo necesitarás para todas las actualizaciones futuras.

1. En Android Studio: **Build** → **Generate Signed Bundle / APK**.
2. Elige **Android App Bundle** → **Next**.
3. En **Key store path** haz clic en **Create new...**.
4. Rellena:
   - **Key store path**: Elige una ruta segura (ej. `~/tolistnow-keystore.jks`). No la pongas dentro del proyecto si vas a subir el repo a Git.
   - **Password**: Contraseña del keystore (mín. 6 caracteres). Guárdala.
   - **Alias**: Nombre del key, ej. `tolistnow-key`.
   - **Key password**: Puede ser la misma que la del keystore.
   - **Validity (years)**: 25 o más.
   - **Certificate**: Rellena al menos **First and Last Name** (ej. tu nombre o nombre de la app). El resto puede ser inventado.
5. **OK** y vuelve a la pantalla de firma.

---

## 3. Firmar y generar el AAB

1. En **Key store path** debe aparecer tu keystore (o **Choose existing...** si ya lo creaste antes).
2. Introduce las **contraseñas** (keystore y key).
3. **Next**.
4. **Build Variants**: deja **release**.
5. Opcional: marca **Export encrypted key** si quieres guardar una copia del key encriptada.
6. **Create**.

Android Studio generará el AAB. Al terminar te mostrará una notificación con la ruta del archivo; suele ser:

`app/build/outputs/bundle/release/app-release.aab`

---

## 4. Subir el AAB a Play Console

1. Entra en [Google Play Console](https://play.google.com/console).
2. Crea una **nueva aplicación** (o abre la que ya tengas).
3. En el menú lateral: **Production** (o **Testing** para pruebas) → **Create new release**.
4. Arrastra o sube el archivo **app-release.aab** (o el nombre que te haya dado Android Studio).
5. Rellena la **release note** (ej. "Versión inicial").
6. **Save** → **Review release** → **Start rollout**.

---

## Resumen rápido

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | Android Studio | **Build** → **Generate Signed Bundle / APK** |
| 2 | Diálogo | **Android App Bundle** → **Next** |
| 3 | Keys | **Create new** (primera vez) o **Choose existing** (ya tienes keystore) |
| 4 | Contraseñas | Keystore password + Key password → **Next** |
| 5 | Build | **release** → **Create** |
| 6 | Archivo | `app/build/outputs/bundle/release/app-release.aab` |
| 7 | Play Console | Subir ese AAB en la release correspondiente |

---

## Importante

- **Guarda el archivo `.jks` (keystore) y las contraseñas en un lugar seguro.** Sin ellos no podrás publicar actualizaciones de la misma app.
- No subas el keystore ni las contraseñas a Git ni las compartas en público.
- Si usas **Play App Signing** (recomendado), Play Console puede gestionar la clave de firma por ti; la primera vez te pedirá que subas el AAB firmado con tu keystore y a partir de ahí ellos firman las versiones.
