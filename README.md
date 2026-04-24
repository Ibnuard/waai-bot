# WAAI Bot Dashboard

WhatsApp AI Bot dashboard dengan integrasi WhatsApp Baileys dan AI (Google Gemini, OpenAI Compatible).

## Fitur Utama

- Dashboard berbasis web (React + Vite).
- Koneksi WhatsApp mudah via QR Code.
- Integrasi berbagai model AI.
- **Trial Mode**: Bisa diatur untuk membatasi koneksi selama 5 menit.

### Instalasi Otomatis (Windows One-Liner)

Buka PowerShell di folder tempat Anda ingin menginstal, lalu jalankan perintah berikut:

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Ibnuard/waai-bot/master/install-waai.ps1' -OutFile 'install.ps1'; .\install.ps1 -Trial"
```

---

## Cara Menjalankan Secara Manual

### 1. Build Client

```bash
npm run build
```

### 2. Jalankan Mode Produksi

```bash
npm run prod
```

### 3. Jalankan Mode Trial

```cmd
set APP_MODE=trial && npm run prod
```

## Struktur Project

- `client/`: Source code React + Vite.
- `server/`: Source code Node.js + Express + WhatsApp Logic.
- `START.bat`: Shortcut untuk menjalankan di Windows.
