# FinApp — Configuración

## Arquitectura actual
- **Frontend**: HTML/CSS/JS estático, ES modules (sin build step)
- **Datos**: Firebase Firestore (cliente, por usuario en `/users/{uid}/...`)
- **Auth**: Firebase Authentication (Google Sign-In)
- **Hosting**: Netlify
- **IA**: Google Gemini API, vía Netlify Function (`netlify/functions/chat-ia.js`) para no exponer la key en el cliente

## Paso 1: Firebase

1. Abre [Firebase Console](https://console.firebase.google.com/u/0/project/finapp-499619/overview)
2. **Authentication → Sign-in method → Google → Habilitar**
3. **Authentication → Settings → Authorized domains** → agrega el dominio de Netlify (ej: `finapp-dr.netlify.app`)
4. **Firestore Database → Rules** → pega el contenido de [`firestore.rules`](firestore.rules)

La configuración del SDK (`apiKey`, `projectId`, etc.) ya está en [`js/firebase-config.js`](js/firebase-config.js).

## Paso 2: Netlify

1. **Site configuration → Environment variables** → agrega `GEMINI_API_KEY` con tu key de [Google AI Studio](https://aistudio.google.com/apikey)
2. **Deploys → Trigger deploy → Deploy site** (las env vars solo se inyectan en deploys nuevos)
3. El deploy usa [`netlify.toml`](netlify.toml): publica la raíz del repo y sirve las funciones desde `netlify/functions`

## Estructura de datos (Firestore)

```
/users/{uid}
  transacciones/{id}   — fecha, tipo, categoria, descripcion, monto, cuenta
  presupuestos/{id}    — categoria, montoLimite
  categorias/{id}       — tipo, nombre, icono, color
  metas/{id}             — nombre, montoObjetivo, montoActual, meses, montoMensual, estado
  cuentas/{id}           — nombre, tipo, saldoInicial
  recurrentes/{id}       — tipo, categoria, descripcion, monto, cuenta, frecuencia, proximaFecha
  prestamos/{id}
    cuotas/{cuotaId}     — numero, fechaVencimiento, estado
```

## Límites gratuitos

| Servicio | Límite gratis |
|----------|---------------|
| Firebase Auth | 50,000 usuarios/mes |
| Firestore | 50K lecturas / 20K escrituras por día |
| Netlify | 100 GB transferencia/mes, 125K invocaciones de funciones/mes |
| Gemini API | Tier gratuito con límites generosos |
