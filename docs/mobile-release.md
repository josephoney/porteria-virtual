# Release móvil — Zima QR Access

## Estado actual

- Expo SDK 58, `expo-router`, TypeScript.
- Bundle/package: `com.porteria.zimaqraccess`.
- Scheme de deep link: `zima-qr-access://`.
- `app.json` ya no permite tráfico HTTP en claro ni `NSAllowsArbitraryLoads`.
- `eas.json` con perfiles `development`, `preview` y `production`.
- Cámara: `expo-camera` con permiso `CAMERA` (sin micrófono en Android).

## Requisitos previos

- Cuenta Expo/EAS y `eas-cli` (`npm i -g eas-cli` o `pnpm dlx eas-cli`).
- Cuenta de Google Play Console para Android.
- Apple Developer Program para iOS/TestFlight.
- API pública con HTTPS y `EXPO_PUBLIC_API_URL` apuntando a ella.
- Icono 1024×1024 PNG, adaptive icon de Android, splash y favicon. Hoy **no están versionados** en `app.json`; hay que generarlos y agregarlos antes del build de tienda.

## Variables

`apps/zima-qr-access/.env` (local) o variables de EAS:

```env
EXPO_PUBLIC_API_URL=https://app.<dominio>
EXPO_PUBLIC_ENV=production
```

No uses `localhost` ni una IP LAN en un build de producción.

## Perfiles EAS

| Perfil        | Salida           | Uso                                |
| ------------- | ---------------- | ---------------------------------- |
| `development` | APK + dev client | Desarrollo con cámara y debugging. |
| `preview`     | APK              | QA interna / sideload.             |
| `production`  | AAB (Android)    | Google Play.                       |

`appVersionSource: remote` y `autoIncrement` en producción: EAS gestiona `versionCode`/`buildNumber`.

## Build Android

```bash
cd apps/zima-qr-access

# Login único
eas login

# APK interno para QA
eas build --profile preview --platform android

# AAB para Play Store
eas build --profile production --platform android
```

El APK de `preview` se comparte por link interno. El AAB de `production` se sube a Play Console (Internal testing → Closed → Production).

## Build iOS

```bash
eas build --profile production --platform ios
eas submit --platform ios --profile production
```

Requiere Apple ID, equipo, certificados y provisioning. Para QA usar TestFlight (Internal testing).

## Submit Android

1. Crear la app en Play Console con el package `com.porteria.zimaqraccess`.
2. Configurar `eas.json` → `submit.production.android.serviceAccountKeyPath` con la service account de Play.
3. Ejecutar:

```bash
eas submit --platform android --profile production
```

## Checklist antes de publicar

- [ ] `EXPO_PUBLIC_API_URL` HTTPS y accesible desde redes móviles.
- [ ] `eas.json` con `production` y `autoIncrement`.
- [ ] Icono, adaptive icon y splash definitivos.
- [ ] Nombre visible “Zima QR Access” y descripción de tienda.
- [ ] Política de privacidad publicada (cámara, documento de visitante, retención): declarar que la identidad se conserva durante la ventana que define la organización (30, 60 o 90 días) y se anonimiza después (ver `docs/tratamiento-datos-personales.md`).
- [ ] Permiso de cámara explicado en la ficha de tienda.
- [ ] Deep link `zima-qr-access://` probado.
- [ ] Login residente/guardia, turno, escaneo, confirmación y rechazo probados en dispositivo real.
- [ ] Crash reporting configurado (Sentry/Expo) o decisión explícita de no usarlo en v1.
- [ ] Plan de actualización: versionCode/buildNumber y compatibilidad con API v1.

## Notas

- La cámara requiere un **development build** o un build nativo; Expo Go sirve para probar el resto, pero no es el canal de distribución.
- El modo guardia solo acepta rol `guard`; `operator` y `community_admin` caen en `no-mode` y deben usar el dashboard.
- El QR del residente rota cada 20 s y el token vive 24 s. No sirve una captura de pantalla.
