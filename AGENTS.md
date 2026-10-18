# UI/UX Design Contract

## Product
SOP-to-BPMN Review Studio untuk Business Analyst.
Tujuan: mengubah SOP menjadi draft BPMN yang dapat direview,
ditautkan ke sumber dokumen, dan diekspor.

## Design direction
Modern, clean, creative, dan business-ready.
Bukan dashboard generik, bukan landing page, bukan crypto/neon aesthetic.

## Foundation
- React + TypeScript + Vite.
- HeroUI sebagai component foundation.
- Tailwind CSS v4.
- lucide-react untuk ikon.
- bpmn-js untuk kanvas BPMN.
- Jangan menambah UI library lain tanpa persetujuan.

## Visual system
- Light mode default; dark mode opsional.
- Background: #FAFAFA atau neutral slate.
- Surface: putih dengan border halus, bukan shadow tebal.
- Accent: satu warna biru-teal profesional, misalnya hsl(199 89% 48%).
- Success: hijau lembut; warning: amber; danger: red-500.
- Radius: 10px card, 8px button/input, 6px badge.
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48px.
- Typography: Inter atau Geist; hierarchy jelas.
- Maksimal 2 font family.
- Animasi hanya 150–250ms, subtle, dan mendukung feedback.

## Layout rules
- Desktop: sidebar kiri + kanvas BPMN tengah + detail panel kanan.
- Kanvas BPMN harus mendapat ruang terbesar.
- Mobile: sidebar menjadi drawer; panel detail menjadi sheet/tab.
- Tidak ada horizontal scroll pada 360px.
- Setiap halaman harus punya loading, empty, error, dan success state.

## Quality bar
- Kontras WCAG AA.
- Focus ring selalu terlihat.
- Semua ikon bermakna penting punya label/tooltip.
- Tidak ada gradient dekoratif berlebihan.
- Tidak ada glassmorphism pada area kerja utama.
- Tidak ada animasi yang mengganggu input pengguna.