# Rekomendasi Pesan Git Commit (GitHub)

Gunakan salah satu format berikut untuk melakukan commit perubahan ke repositori GitHub.

---

## Commit: Release v1.2.0 (URL-Based Mode Routing & Simulation Framework)

### Judul Commit (Title):
```text
feat: add URL-based mode routing with prototype and real simulation modes
```

### Deskripsi Commit (Description):
```markdown
- Add isRealApiMode() URL detection for /demo (real API) vs root / (mock simulation)
- Implement dual-mode UI: simulation outer frame with dashed border and banner on prototype mode
- Add mock pipeline service (demoPipeline.js) for instant SOP-to-BPMN demo without backend
- Sync standalone viewer (public/index.html) with mode detection and CTA navigation
- Add "type": "module" to package.json for Vite v8 ESM compatibility
- Add AGENTS.md (UI/UX Design Contract) and PRODUCT.md project documentation
- Update whatsnew/ with v1.2.0 release notes and CHANGELOG entry
```

---

## Perintah Git untuk Terminal PowerShell:

```powershell
git add .
git commit -m "feat: add URL-based mode routing with prototype and real simulation modes" -m "- Add isRealApiMode() URL detection for /demo (real API) vs root / (mock simulation)`n- Implement dual-mode UI: simulation outer frame with dashed border and banner on prototype mode`n- Add mock pipeline service (demoPipeline.js) for instant SOP-to-BPMN demo without backend`n- Sync standalone viewer (public/index.html) with mode detection and CTA navigation`n- Add type: module to package.json for Vite v8 ESM compatibility`n- Add AGENTS.md (UI/UX Design Contract) and PRODUCT.md project documentation`n- Update whatsnew/ with v1.2.0 release notes and CHANGELOG entry"
git push origin rebuild
```
