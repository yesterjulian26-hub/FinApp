#!/bin/bash
# ══════════════════════════════════════════════════════════════
# FinApp — Firebase Setup Script
# Pega este script completo en Google Cloud Shell
# https://shell.cloud.google.com/?project=finapp-499619
# ══════════════════════════════════════════════════════════════

PROJECT_ID="finapp-499619"
echo "🔧 Configurando Firebase para $PROJECT_ID..."

# 1. Set project
gcloud config set project $PROJECT_ID

# 2. Enable required APIs
echo "📡 Habilitando APIs..."
gcloud services enable firebase.googleapis.com
gcloud services enable identitytoolkit.googleapis.com

# 3. Add Firebase to the project
echo "🔥 Agregando Firebase al proyecto..."
firebase projects:addfirebase $PROJECT_ID --json 2>/dev/null || echo "(Firebase may already be added)"

# 4. Create a web app
echo "🌐 Creando app web..."
firebase apps:create web "FinApp" --project $PROJECT_ID --json 2>/dev/null

# 5. Get the web app config
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  TU CONFIGURACIÓN DE FIREBASE:"
echo "══════════════════════════════════════════════════════════"
firebase apps:sdkconfig web --project $PROJECT_ID
echo "══════════════════════════════════════════════════════════"
echo ""

# 6. Enable Google Sign-In provider
echo "🔐 Para habilitar Google Sign-In:"
echo "   1. Ve a: https://console.firebase.google.com/u/0/project/$PROJECT_ID/authentication/providers"
echo "   2. Click en 'Google' → Habilitar → Guardar"
echo ""
echo "✅ ¡Listo! Copia el firebaseConfig de arriba y pégalo en index.html"
