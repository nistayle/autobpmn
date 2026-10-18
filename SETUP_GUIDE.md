# 🚀 Panduan Menjalankan AutoBPMN (Super Praktis untuk Siapa Saja)

Panduan ini dibuat seringkas dan sejelas mungkin agar siapa pun (bahkan tanpa latar belakang teknis) bisa menjalankan AutoBPMN tanpa bingung.

---

## ⚡ CARA PALING CEPAT (1-Klik)

Jika Python & Node.js sudah pernah terpasang di komputer Anda:

1. Buka folder proyek ini (`autobpmn`).
2. Klik ganda (**Double Click**) file:
   👉 **`START_AUTOBPMN.bat`**
3. Dua jendela hitam kecil akan terbuka otomatis dan browser Anda akan langsung membuka:
   🌐 **http://localhost:5173**
4. Selesai! Aplikasi langsung siap digunakan.

---

## 🛠️ SETUP AWAL (Hanya Dilakukan 1 Kali di Awal)

Jika Anda baru pertama kali memasang proyek ini di laptop/PC baru:

### Langkah 1: Pastikan 2 Aplikasi Ini Terinstall di Laptop

1. **Python** (Mesin Otak):
   - Unduh di: [python.org/downloads](https://www.python.org/downloads/)
   - ⚠️ **Wajib Centang**: Saat menginstall, centang kotak **"Add python.exe to PATH"** di layar pertama sebelum klik *Install*.
2. **Node.js** (Mesin Tampilan Web):
   - Unduh di: [nodejs.org](https://nodejs.org/) (Pilih versi **LTS**).
   - Klik *Next* terus sampai *Finish*.

---

### Langkah 2: Isi API Key AI (Gratis)

AutoBPMN membutuhkan model AI untuk membaca dokumen SOP Anda. Untuk penggunaan gratis yang paling konsisten, pilih **Google Gemini** sebagai provider utama. Groq dipakai sebagai fallback cepat, sedangkan OpenRouter free hanya fallback pengembangan karena kuotanya lebih kecil dan modelnya dapat berubah.

1. Buka file bernama **`.env`** di folder utama menggunakan Notepad / VS Code.
2. Isi salah satu kunci berikut:

| Pilihan Provider | Link Dapatkan Kunci (Gratis) | Contoh Format di `.env` |
| :--- | :--- | :--- |
| **Groq (Sangat Cepat)** | [console.groq.com](https://console.groq.com/keys) | `GROQ_API_KEY=gsk_...` |
| **OpenRouter (Banyak Pilihan)** | [openrouter.ai](https://openrouter.ai/keys) | `OPENROUTER_API_KEY=sk-or-v1-...` |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com/app/apikey) | `GEMINI_API_KEY=AIzaSy...` |

*(Cukup isi 1 saja sudah langsung jalan. Simpan file `.env`)*.

> Untuk menjaga request tetap berada dalam batas free tier cloud, AutoBPMN menerima maksimal sekitar **16.000 karakter teks** setelah PDF diekstrak. Jika SOP lebih panjang, pisahkan per prosedur atau hilangkan lampiran terlebih dahulu.

---

### Langkah 3: Install Dependensi (Hanya 1 Kali)

Buka terminal **PowerShell** di folder `autobpmn`, lalu copy-paste perintah berikut:

```powershell
# 1. Siapkan mesin Python
python -m venv venv
.\venv\Scripts\python.exe -m pip install fastapi uvicorn pydantic google-genai pypdf python-multipart

# 2. Siapkan mesin Tampilan Web
cd frontend
npm install
cd ..
```

---

## 💻 CARA MANUAL (Jika Tidak Ingin Pakai File .bat)

Jika ingin menjalankan secara manual lewat terminal:

### Terminal 1 — Menjalankan Backend:
Buka PowerShell di folder `autobpmn`:
```powershell
.\venv\Scripts\Activate.ps1
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*(Status: `Uvicorn running on http://127.0.0.1:8000`)*

### Terminal 2 — Menjalankan Web:
Buka PowerShell kedua di folder `autobpmn`:
```powershell
cd frontend
npx vite
```
*(Status: Buka browser di `http://localhost:5173`)*

---

## 🎯 CARA MENGGUNAKAN APLIKASI DI BROWSER

1. Buka **http://localhost:5173**.
2. Di panel kiri:
   - Klik tombol **"Contoh"** untuk memasukkan teks SOP otomatis, **ATAU**
   - Pilih tab **"Unggah Berkas"** lalu upload file PDF / TXT dokumen SOP Anda.
3. Klik tombol biru **"Ekstrak ke BPMN"**.
4. Diagram alur proses BPMN 2.0 yang rapi, berwarna, dan terstandarisasi akan langsung muncul di kanvas tengah.
5. Anda bisa klik tombol **.bpmn** atau **.svg** di pojok kanan atas kanvas untuk men-download diagramnya.
