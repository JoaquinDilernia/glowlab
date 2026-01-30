const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const STORE_ID = '6854698'; // Tu store ID

const premiumTemplates = [
  {
    name: "🎄 Navidad Mágica",
    category: "Festividades",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJjaHJpc3RtYXMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMxZTQwYWY7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwNTc1MmQ7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50Pjwvl2Vmc48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIGZpbGw9InVybCgjY2hyaXN0bWFzKSIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEwMCIgcj0iNCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iMzAwIiBjeT0iMjAwIiByPSIzIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI5MDAiIGN5PSIxNTAiIHI9IjUiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOSIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjQwMCIgcj0iNCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43Ii8+PGNpcmNsZSBjeD0iMTA1MCIgY3k9IjMwMCIgcj0iMyIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44Ii8+PHBvbHlnb24gcG9pbnRzPSI2MDAsNTAgNjIwLDExMCA1ODAsODAgNjQwLDgwIDYwMCwxMTAiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuOSIvPjxwb2x5Z29uIHBvaW50cz0iMjAwLDMwMCAyMTUsMzUwIDE5MCwzMjUgMjI1LDMyNSAyMDAsMzUwIiBmaWxsPSIjZmZkNzAwIiBvcGFjaXR5PSIwLjgiLz48cG9seWdvbiBwb2ludHM9IjEwMDAsNDAwIDEwMTUsNDUwIDk5MCw0MjUgMTAzMCw0MjUgMTAwMCw0NTAiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuOSIvPjwvc3ZnPg==",
    textPosition: "center",
    textColor: "#FFFFFF",
    fontSize: 56,
    isDefault: false
  },
  {
    name: "🎉 Cumpleaños Festivo",
    category: "Celebraciones",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJiaXJ0aGRheSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2VjNDg5OTtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjU5ZTBiO3N0b3Atb3BhY2l0eToxIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOGI1Y2Y2O3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjI4IiBmaWxsPSJ1cmwoI2JpcnRoZGF5KSIvPjxyZWN0IHg9IjEwMCIgeT0iNTAiIHdpZHRoPSIzMCIgaGVpZ2h0PSI4MCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4zIiB0cmFuc2Zvcm09InJvdGF0ZSgxNSA2MDAgMzAwKSIvPjxyZWN0IHg9IjMwMCIgeT0iNDAwIiB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmZmQiIG9wYWNpdHk9IjAuNCIgdHJhbnNmb3JtPSJyb3RhdGUoLTE1IDYwMCAzMDApIi8+PHJlY3QgeD0iOTAwIiB5PSIxMDAiIHdpZHRoPSIzNSIgaGVpZ2h0PSI3MCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4zNSIgdHJhbnNmb3JtPSJyb3RhdGUoMjUgNjAwIDMwMCkiLz48Y2lyY2xlIGN4PSI0MDAiIGN5PSIxNTAiIHI9IjgiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjgwMCIgY3k9IjUwMCIgcj0iMTAiIGZpbGw9IiMzYjgyZjYiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjgwIiByPSI2IiBmaWxsPSIjZWM0ODk5IiBvcGFjaXR5PSIwLjgiLz48L3N2Zz4=",
    textPosition: "center",
    textColor: "#FFFFFF",
    fontSize: 54,
    isDefault: false
  },
  {
    name: "💎 Lujo Premium",
    category: "Elegante",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJsdXh1cnkiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwZjE3MmE7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMxZTE5MWI7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIGZpbGw9InVybCgjbHV4dXJ5KSIvPjxsaW5lIHgxPSIwIiB5MT0iMTAwIiB4Mj0iMTIwMCIgeTI9IjEwMCIgc3Ryb2tlPSIjZmZkNzAwIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuMyIvPjxsaW5lIHgxPSIwIiB5MT0iNTI4IiB4Mj0iMTIwMCIgeTI9IjUyOCIgc3Ryb2tlPSIjZmZkNzAwIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuMyIvPjxyZWN0IHg9IjgwIiB5PSI1MCIgd2lkdGg9IjMiIGhlaWdodD0iNTI4IiBmaWxsPSIjZmZkNzAwIiBvcGFjaXR5PSIwLjQiLz48cmVjdCB4PSIxMTE3IiB5PSI1MCIgd2lkdGg9IjMiIGhlaWdodD0iNTI4IiBmaWxsPSIjZmZkNzAwIiBvcGFjaXR5PSIwLjQiLz48cG9seWdvbiBwb2ludHM9IjYwMCwxODAgNjIwLDE5MCA2MTAsMjEwIDU5MCwyMTAgNTgwLDE5MCIgZmlsbD0iI2ZmZDcwMCIgb3BhY2l0eT0iMC42Ii8+PHBvbHlnb24gcG9pbnRzPSI2MDAsMzgwIDYyMCwzOTAgNjEwLDQxMCA1OTAsNDEwIDU4MCwzOTAiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuNiIvPjwvc3ZnPg==",
    textPosition: "center",
    textColor: "#FFD700",
    fontSize: 52,
    isDefault: false
  },
  {
    name: "💝 Romántico",
    category: "Amor",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJyb21hbnRpYyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZjZTdmMztzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZkYmZkMjtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjYyOCIgZmlsbD0idXJsKCNyb21hbnRpYykiLz48cGF0aCBkPSJNMzAwLDI1MCBRMzAwLDIwMCAzNTAsMjAwIFE0MDAsMjAwIDQwMCwyNTAgUTQwMCwzMDAgMzAwLDM4MCBRMjAwLDMwMCAyMDAsMjUwIFEyMDAsMjAwIDI1MCwyMDAgUTMwMCwyMDAgMzAwLDI1MCIgZmlsbD0iI2ZiN2E4NSIgb3BhY2l0eT0iMC4yIi8+PHBhdGggZD0iTTkwMCwxNTAgUTkwMCwxMDAgOTUwLDEwMCBRMTAwMCwxMDAgMTAwMCwxNTAgUTEwMDAsMjAwIDkwMCwyODAgUTgwMCwyMDAgODAwLDE1MCBRODAwLDEwMCA4NTAsMTAwIFE5MDAsMTAwIDkwMCwxNTAiIGZpbGw9IiNmYjdhODUiIG9wYWNpdHk9IjAuMTUiLz48Y2lyY2xlIGN4PSI2MDAiIGN5PSI1MDAiIHI9IjgwIiBmaWxsPSIjZmI3YTg1IiBvcGFjaXR5PSIwLjEiLz48Y2lyY2xlIGN4PSI0NTAiIGN5PSI0MDAiIHI9IjUwIiBmaWxsPSIjZjljMmNiIiBvcGFjaXR5PSIwLjIiLz48L3N2Zz4=",
    textPosition: "center",
    textColor: "#EC4899",
    fontSize: 50,
    isDefault: false
  },
  {
    name: "🌴 Tropical Verano",
    category: "Estaciones",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJ0cm9waWNhbCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzA4OTFiMjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzA1NzVhMTtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjYyOCIgZmlsbD0idXJsKCN0cm9waWNhbCkiLz48ZWxsaXBzZSBjeD0iMjAwIiBjeT0iMTAwIiByeD0iNDAiIHJ5PSI2MCIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4zIi8+PGVsbGlwc2UgY3g9IjIyMCIgY3k9IjkwIiByeD0iMzUiIHJ5PSI1NSIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4yNSIvPjxlbGxpcHNlIGN4PSIxMDAwIiBjeT0iNDAwIiByeD0iNDUiIHJ5PSI2NSIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4yOCIvPjxlbGxpcHNlIGN4PSIxMDIwIiBjeT0iMzgwIiByeD0iNDAiIHJ5PSI2MCIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4yMiIvPjxjaXJjbGUgY3g9IjkwMCIgY3k9IjgwIiByPSI1MCIgZmlsbD0iI2ZiZDM4ZCIgb3BhY2l0eT0iMC40Ii8+PGNpcmNsZSBjeD0iNTAwIiBjeT0iNTUwIiByPSI0MCIgZmlsbD0iI2ZiZDM4ZCIgb3BhY2l0eT0iMC4zNSIvPjwvc3ZnPg==",
    textPosition: "center",
    textColor: "#FFFFFF",
    fontSize: 52,
    isDefault: false
  },
  {
    name: "🎨 Moderno Geométrico",
    category: "Moderno",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnZW9tZXRyaWMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NjdlZWE7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzhiNWNmNjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2VjNDg5OTtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjYyOCIgZmlsbD0idXJsKCNnZW9tZXRyaWMpIi8+PHBvbHlnb24gcG9pbnRzPSIyMDAsMTAwIDMwMCw1MCAzMDAsMTUwIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjEiLz48cG9seWdvbiBwb2ludHM9IjkwMCw0MDAgMTAwMCwzNTAgMTAwMCw0NTAiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMTIiLz48cmVjdCB4PSI0MDAiIHk9IjIwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMDgiIHRyYW5zZm9ybT0icm90YXRlKDQ1IDYwMCAzMDApIi8+PGNpcmNsZSBjeD0iNzAwIiBjeT0iNTAwIiByPSI2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9IjAuMTUiLz48Y2lyY2xlIGN4PSIzMDAiIGN5PSI0MDAiIHI9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgb3BhY2l0eT0iMC4xIi8+PC9zdmc+",
    textPosition: "center",
    textColor: "#FFFFFF",
    fontSize: 54,
    isDefault: false
  },
  {
    name: "🌸 Primavera Floral",
    category: "Estaciones",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJzcHJpbmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmYWY1ZmY7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOWQ1ZmY7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIGZpbGw9InVybCgjc3ByaW5nKSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE1MCIgcj0iMjAiIGZpbGw9IiNmOWExYjgiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjE5MCIgY3k9IjE3MCIgcj0iMTUiIGZpbGw9IiNmYjdhODUiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjIxMCIgY3k9IjE3MCIgcj0iMTUiIGZpbGw9IiNmNmQzYmEiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjkwMCIgY3k9IjQwMCIgcj0iMjUiIGZpbGw9IiNkOGI0ZmUiIG9wYWNpdHk9IjAuNSIvPjxjaXJjbGUgY3g9Ijg4NSIgY3k9IjQyNSIgcj0iMTgiIGZpbGw9IiNjMDg0ZmMiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjkxNSIgY3k9IjQyNSIgcj0iMTgiIGZpbGw9IiNlOWQ1ZmYiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjUwIiByPSIyMiIgZmlsbD0iI2Y5YTFiOCIgb3BhY2l0eT0iMC41NSIvPjxjaXJjbGUgY3g9IjQ1MCIgY3k9IjUwMCIgcj0iMjAiIGZpbGw9IiNmNmQzYmEiIG9wYWNpdHk9IjAuNiIvPjwvc3ZnPg==",
    textPosition: "center",
    textColor: "#7C3AED",
    fontSize: 52,
    isDefault: false
  },
  {
    name: "✨ Minimalista Elegante",
    category: "Minimalista",
    imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJtaW5pbWFsIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjlmYWZiO3N0b3Atb3BhY2l0eToxIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjNmNGY2O3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjI4IiBmaWxsPSJ1cmwoI21pbmltYWwpIi8+PGxpbmUgeDE9IjEwMCIgeTE9IjEwMCIgeDI9IjExMDAiIHkyPSIxMDAiIHN0cm9rZT0iIzY2N2VlYSIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIwLjMiLz48bGluZSB4MT0iMTAwIiB5MT0iNTI4IiB4Mj0iMTEwMCIgeTI9IjUyOCIgc3Ryb2tlPSIjNjY3ZWVhIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuMyIvPjxyZWN0IHg9IjEwMCIgeT0iMTAwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MjgiIGZpbGw9IiM2NjdlZWEiIG9wYWNpdHk9IjAuMyIvPjxyZWN0IHg9IjEwOTgiIHk9IjEwMCIgd2lkdGg9IjIiIGhlaWdodD0iNDI4IiBmaWxsPSIjNjY3ZWVhIiBvcGFjaXR5PSIwLjMiLz48Y2lyY2xlIGN4PSI2MDAiIGN5PSIzMTQiIHI9IjUiIGZpbGw9IiM2NjdlZWEiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==",
    textPosition: "center",
    textColor: "#1F2937",
    fontSize: 52,
    isDefault: false
  }
];

async function installTemplates() {
  try {
    console.log('🎨 Instalando templates premium para store', STORE_ID);
    
    for (let i = 0; i < premiumTemplates.length; i++) {
      const template = premiumTemplates[i];
      const templateId = `template_premium_${Date.now()}_${i}`;
      
      await db.collection("giftcard_templates").doc(templateId).set({
        templateId,
        storeId: STORE_ID,
        name: template.name,
        category: template.category,
        imageUrl: template.imageUrl,
        textPosition: template.textPosition,
        textColor: template.textColor,
        fontSize: template.fontSize,
        isDefault: template.isDefault,
        isSystemTemplate: true,
        createdAt: FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Template instalado: ${template.name}`);
    }
    
    console.log('\n🎉 ¡Todos los templates premium instalados exitosamente!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error instalando templates:', error);
    process.exit(1);
  }
}

installTemplates();
