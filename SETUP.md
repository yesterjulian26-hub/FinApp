# FinApp — Configuración Rápida (5 minutos)

## Estado actual
- **Proyecto GCP creado**: `finapp-499619`
- **Backend listo**: `Code.gs` con soporte multi-usuario
- **Frontend listo**: `index.html` con UI premium y Firebase Auth
- **Falta**: Agregar Firebase al proyecto + obtener config

---

## Paso 1: Agregar Firebase al proyecto (2 min)

1. Abre: **https://console.firebase.google.com/u/0/project/finapp-499619/overview**
2. Acepta las condiciones de Firebase → Click **Continuar**
3. En la pantalla de Google Analytics, desactívalo → Click **Agregar Firebase**
4. Espera ~30 segundos a que se configure

## Paso 2: Registrar la App Web y copiar config (1 min)

1. En la página principal del proyecto Firebase, click el ícono **</>** (Web)
2. Nombre: `FinApp` → Click **Registrar app**
3. Copia el bloque `firebaseConfig` que aparece
4. Abre `index.html`, busca `REEMPLAZA ESTO` (línea ~1018) y pega tu config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",          // ← tu valor
  authDomain: "finapp-499619.firebaseapp.com",
  projectId: "finapp-499619",
  storageBucket: "finapp-499619.firebasestorage.app",
  messagingSenderId: "879966880858",
  appId: "1:879966880858:web:..." // ← tu valor
};
```

## Paso 3: Habilitar Google Sign-In (1 min)

1. En Firebase Console → **Build → Authentication → Get Started**
2. Pestaña **Sign-in method** → Click **Google**
3. **Habilitar** → Selecciona tu email como "Support email" → **Guardar**

---

## Paso 4: Desplegar Code.gs en Apps Script

1. Ve a [Google Apps Script](https://script.google.com/)
2. Crea un nuevo proyecto → pega el contenido de `Code.gs`
3. **Implementar → Nueva implementación** → App web → Ejecutar como: Yo → Acceso: Cualquiera
4. Copia la URL y actualiza la constante `API` en `index.html` (línea ~1013)

**IMPORTANTE**: Cada vez que modifiques Code.gs, crea una **nueva implementación**.

## Paso 5: Hosting (elige uno, ambos gratis)

### Opción A: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # directorio: . | NO es SPA
firebase deploy
```

### Opción B: GitHub Pages
1. Sube `index.html` y `manifest.json` a un repo
2. Settings → Pages → Deploy from branch → main

---

## Arquitectura
- **Frontend**: HTML/CSS/JS estático
- **Backend**: Google Apps Script + Google Sheets
- **Auth**: Firebase Authentication (Google Sign-In)
- **IA**: Google Gemini API
- **Límite**: 30 usuarios gratuitos (configurable en Code.gs → MAX_USERS)

## Estructura de Hojas (Google Sheets)

| Hoja | Columnas |
|------|----------|
| Usuarios | UID, Email, Nombre, FotoURL, FechaRegistro, OnboardingCompleto |
| Transacciones | ID, UID, Fecha, Tipo, Categoria, Descripcion, Monto, Cuenta |
| Presupuestos | UID, Categoria, MontoMensual |
| Categorias | UID, Tipo, Nombre |
| Metas | ID, UID, Nombre, MontoObjetivo, MontoActual, FechaLimite, Estado |
| Cuentas | ID, UID, Nombre, Tipo, SaldoInicial |
| Recurrentes | ID, UID, Tipo, Categoria, Descripcion, Monto, Cuenta, Frecuencia, ProximaFecha |

## Límites Gratuitos

| Servicio | Límite Gratis |
|----------|---------------|
| Firebase Auth | 50,000 usuarios/mes |
| Firebase Hosting | 10 GB transferencia/mes |
| Google Sheets | 10 millones de celdas |
| Apps Script | 90 min ejecución/día, 20,000 llamadas/día |
| Gemini API | Tier gratuito con límites generosos |
