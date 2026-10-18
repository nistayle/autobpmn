# 📋 AutoBPMN - Master Changelog

Seluruh riwayat perubahan, pembaruan fitur, dan perbaikan bug proyek AutoBPMN terdokumentasi dalam berkas-berkas versi di bawah ini:

| Versi | Tanggal | Sorotan Pembaruan | Berkas Detail |
| :--- | :--- | :--- | :--- |
| **v1.5.5** | 18 Okt 2026 | **Font Connection Lebih Awal**: Mulai koneksi dan unduh stylesheet font dari HTML awal, tanpa menahan render workspace | [v1.5.5.md](./v1.5.5.md) |
| **v1.5.4** | 18 Okt 2026 | **Stylesheet Startup Bertahap**: Stylesheet aplikasi dimuat bersama App, sementara fallback startup menggunakan CSS kritis ringan | [v1.5.4.md](./v1.5.4.md) |
| **v1.5.3** | 18 Okt 2026 | **JSON Viewer Terpisah**: Chunk viewer/editor JSON dimuat hanya saat mode JSON dibuka, dengan loading state kontekstual | [v1.5.3.md](./v1.5.3.md) |
| **v1.5.2** | 18 Okt 2026 | **Copilot Sesuai Kebutuhan**: Menunda pemuatan panel Copilot sampai tersedia SOP, diagram, riwayat percakapan, atau prompt analisis | [v1.5.2.md](./v1.5.2.md) |
| **v1.5.1** | 18 Okt 2026 | **Pemuatan Lebih Ringan & Loading States**: Viewer BPMN ditunda saat workspace kosong, tampilan JSON hanya dirender saat dibuka, serta pemisahan chunk fitur dan indikator loading | [v1.5.1.md](./v1.5.1.md) |
| **v1.5.0** | 17 Okt 2026 | **File Management & Workframe Studio**: VS Code style tab bar, toggle tampilan Visual/JSON pada kanvas, unifikasi menu ekspor (.bpmn, .json, .svg), drag-and-drop file, dan Visual BPMN Modeler | [v1.5.0.md](./v1.5.0.md) |
| **v1.4.0** | 17 Okt 2026 | **AI Copilot & Overdrive Studio**: Grounded AI Copilot, streaming real-time, validasi sitasi verbatim, Command Palette (`Ctrl+K`), Walkthrough Player alur proses, bidirectional canvas highlighter, dan 100% Impeccable Design Quality | [v1.4.0.md](./v1.4.0.md) |
| **v1.3.0** | 17 Okt 2026 | **SOP-to-BPMN Review Studio**: Redesign menyeluruh 3-kolom (Sidebar + Canvas + Detail Inspector), kepatuhan ketat AGENTS.md, inspeksi elemen interaktif, dan visual system enterprise | [v1.3.0.md](./v1.3.0.md) |
| **v1.2.0** | 17 Okt 2026 | **URL-based mode routing**: Prototype Mode (mock API di root `/`) vs Real Simulation Mode (live backend di `/demo`), visual simulation frame, mock pipeline service, dan ESM compatibility | [v1.2.0.md](./v1.2.0.md) |
| **v1.1.0** | 16 Okt 2026 | **Async event-loop offloading**, eliminasi hang/freeze tombol ekstrak, prioritas provider cerdas (Groq/OpenRouter failover), dan perampingan dependensi frontend | [v1.1.0.md](./v1.1.0.md) |
| **v1.0.0** | 16 Okt 2026 | **Multi-provider LLM** (Gemini + Groq + OpenRouter), perombakan **Layout Sugiyama Left-to-Right**, routing Manhattan 90°, UI Vanilla CSS, dan skrip 1-klik `START_AUTOBPMN.bat` | [v1.0.0.md](./v1.0.0.md) |

---

## Ringkasan Komprehensif Arsitektur AutoBPMN

### 1. Multi-Provider LLM Fallback Engine
* **Fallback Chain**: `Google Gemini` $\rightarrow$ `Groq` $\rightarrow$ `OpenRouter`.
* **Resiliensi**: Deteksi model aktif secara live dari endpoint API, injeksi User-Agent untuk bypass Cloudflare 1010, dan auto-load berkas konfigurasi `.env`.

### 2. Mesin Layout Graf & BPMN 2.0 Synthesizer
* **Topological Sugiyama DAG**: Alur mengalir konsisten dari kiri ke kanan (Left-to-Right) dengan alignment geometric center pada seluruh node.
* **DFS Cycle Detection**: Mengisolasi *back-edges* (alur revisi) ke track clearance atas diagram agar tidak merusak rank kolom.
* **Collision-Free Track Allocation**: Percabangan gateway memiliki jarak vertikal bebas tabrakan (+160px).
* **Orthogonal Manhattan Routing**: Konektor bersudut siku 90° tanpa garis diagonal memotong.

### 3. Antarmuka Pengguna (UI) Tool-Grade
* Dibangun dengan **Vanilla CSS** berstandar enterprise tanpa framework CSS eksternal yang berat.
* Dilengkapi toolbar kanvas interaktif (Zoom, Fit Viewport, Unduh format `.bpmn` dan `.svg`), status badge validasi alur proses, dan panel preview JSON intermediate graph.
