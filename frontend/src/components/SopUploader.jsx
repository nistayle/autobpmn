import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Send, Sparkles, ArrowUpRight } from 'lucide-react';
import Keycap from './Keycap';

const SAMPLE_SOP = `SOP Pengadaan Perlengkapan Kantor
1. Pemohon mengisi formulir permohonan pengadaan barang.
2. Manager Divisi meninjau urgensi kebutuhan dan ketersediaan anggaran.
3. Jika ditolak, formulir dikembalikan ke Pemohon beserta catatan revisi.
4. Jika disetujui, Bagian Pengadaan mencari vendor dan membandingkan harga.
5. Vendor terpilih mengirimkan barang pesanan ke kantor.
6. Pemohon menerima barang dan menandatangani berita acara penerimaan.`;

export default function SopUploader({
  onProcessText,
  onProcessFile,
  onSourceTextChange,
  onSourceFileChange,
  onClearSourceFile,
  fileId,
  sourceFile = null,
  hasExistingGraph = false,
  isNewFile = false,
  isLoading,
  isRealMode = false,
  highlightedCitation = null,
  initialText = '',
}) {
  const [tab, setTab] = useState('text');
  const [text, setText] = useState(initialText);
  const [extendText, setExtendText] = useState('');
  const [file, setFile] = useState(sourceFile);
  const [isDragging, setIsDragging] = useState(false);
  const [processMode, setProcessMode] = useState('replace');
  const fileRef = useRef(null);

  useEffect(() => {
    setText(initialText || '');
    setExtendText('');
    setFile(sourceFile || null);
    setProcessMode('replace');
  }, [fileId]);

  useEffect(() => {
    setText(initialText || '');
  }, [initialText]);

  useEffect(() => {
    setFile(sourceFile || null);
  }, [sourceFile, fileId]);

  // Global & scoped keyboard shortcuts for SopUploader
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+S to load sample SOP
      if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        e.preventDefault();
        setTab('text');
        if (processMode === 'extend') {
          setExtendText(SAMPLE_SOP);
        } else {
          setText(SAMPLE_SOP);
          onSourceTextChange?.(SAMPLE_SOP);
        }
        return;
      }

      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        if (tab === 'text' && (processMode === 'extend' ? extendText : text).trim() && !isLoading) {
          e.preventDefault();
          onProcessText(processMode === 'extend' ? extendText : text, processMode);
        } else if (tab === 'file' && file && processMode !== 'extend' && !isLoading) {
          e.preventDefault();
          onProcessFile(file, processMode);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [tab, text, extendText, file, processMode, isLoading, onProcessText, onProcessFile, onSourceTextChange]);

  const handleTextSubmit = (e) => {
    e.preventDefault();
    const sourceText = processMode === 'extend' ? extendText : text;
    if (!sourceText.trim() || isLoading) return;
    onProcessText(sourceText, processMode);
  };

  const handleFileSubmit = (e) => {
    e.preventDefault();
    if (!file || isLoading || processMode === 'extend') return;
    onProcessFile(file, processMode);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (processMode === 'extend') return;
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      onSourceFileChange?.(e.dataTransfer.files[0]);
    }
  };

  return (
    <>
      {isNewFile && (
        <div className="sop-empty-note">
          <FileText size={15} aria-hidden="true" />
          <span>Tambahkan sumber SOP. Hasilnya akan dibuat sebagai file BPMN baru.</span>
        </div>
      )}

      <div className="sop-process-mode" role="group" aria-label="Mode pemrosesan sumber SOP">
        <button
          type="button"
          className={`sop-process-mode__option${processMode === 'replace' ? ' sop-process-mode__option--active' : ''}`}
          onClick={() => setProcessMode('replace')}
          aria-pressed={processMode === 'replace'}
        >
          <span>Proses ulang</span>
          <small>{hasExistingGraph ? 'Ganti diagram aktif' : 'Buat diagram'}</small>
        </button>
        <button
          type="button"
          className={`sop-process-mode__option${processMode === 'extend' ? ' sop-process-mode__option--active' : ''}`}
          onClick={() => setProcessMode('extend')}
          disabled={!hasExistingGraph}
          aria-pressed={processMode === 'extend'}
          title={!hasExistingGraph ? 'Buat diagram BPMN terlebih dahulu' : 'Tinjau tambahan sebelum diterapkan'}
        >
          <span>Extend</span>
          <small>Tinjau tambahan</small>
        </button>
      </div>
      <p className="sop-process-mode__hint">
        {processMode === 'extend'
          ? 'Sumber baru akan menjadi usulan perubahan; diagram lama tetap aman sampai Anda menerapkan preview.'
          : hasExistingGraph
            ? 'Sumber SOP ini akan mengganti diagram pada file aktif.'
            : 'Sumber SOP disimpan pada file BPMN yang dihasilkan.'}
      </p>

      {/* Tab Switcher */}
      <div className="tabs">
        <button
          type="button"
          onClick={() => setTab('text')}
          className={`tab-btn ${tab === 'text' ? 'tab-btn--active' : ''}`}
        >
          Teks Narasi
        </button>
        <button
          type="button"
          onClick={() => setTab('file')}
          className={`tab-btn ${tab === 'file' ? 'tab-btn--active' : ''}`}
        >
          Unggah Berkas
        </button>
      </div>

      {/* Text Tab */}
      {tab === 'text' && (
        <form onSubmit={handleTextSubmit} className="input-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label htmlFor="sop-textarea" className="input-label">
              {processMode === 'extend' ? 'Tambahan SOP' : 'Teks Narasi SOP'}
            </label>
            <button
              type="button"
              className="sample-btn"
              onClick={() => {
                if (processMode === 'extend') {
                  setExtendText(SAMPLE_SOP);
                } else {
                  setText(SAMPLE_SOP);
                  onSourceTextChange?.(SAMPLE_SOP);
                }
              }}
              title="Isi dengan contoh SOP pengadaan (Alt+S)"
            >
              <Sparkles size={13} />
              Contoh SOP
            </button>
          </div>
          {highlightedCitation && (
            <div className="citation-highlight-banner" role="region" aria-label="Kutipan SOP Disorot">
              <div className="citation-highlight-banner__header">
                <span className="citation-highlight-banner__badge">
                  Rujukan SOP {highlightedCitation.step ? `Langkah ${highlightedCitation.step}` : ''}
                </span>
                <span className="citation-highlight-banner__hint">Disorot dari Copilot</span>
              </div>
              <div className="citation-highlight-banner__quote">
                "{highlightedCitation.quote}"
              </div>
            </div>
          )}
          <textarea
            id="sop-textarea"
            className={`text-input${highlightedCitation ? ' text-input--highlighted' : ''}`}
            value={processMode === 'extend' ? extendText : text}
            onChange={(e) => {
              if (processMode === 'extend') {
                setExtendText(e.target.value);
              } else {
                setText(e.target.value);
                onSourceTextChange?.(e.target.value);
              }
            }}
            placeholder={processMode === 'extend'
              ? 'Masukkan langkah baru yang ingin ditambahkan ke diagram...'
              : 'Tulis atau tempel teks SOP untuk diekstrak menjadi alur proses BPMN 2.0...'}
            rows={10}
          />
          <div className="input-meta">
            <span>
              {(processMode === 'extend' ? extendText : text).trim()
                ? `${(processMode === 'extend' ? extendText : text).trim().split(/\s+/).length} kata`
                : 'Minimal satu langkah proses'}
            </span>
            <span>{isRealMode ? 'Backend API' : 'Simulasi lokal'}</span>
          </div>
          <button
            type="submit"
            disabled={!(processMode === 'extend' ? extendText : text).trim() || isLoading}
            className={`btn btn--primary${isLoading ? ' btn--loading' : ''}`}
            title={`${processMode === 'extend' ? 'Buat preview tambahan' : 'Proses sumber SOP'} (Ctrl+Enter)`}
          >
            <span className="btn__spinner" aria-hidden="true" />
            {isLoading ? 'Mengekstrak alur proses...' : (
              <>
                <span>
                  {processMode === 'extend'
                    ? 'Tinjau tambahan'
                    : isNewFile
                      ? 'Buat file BPMN'
                      : 'Proses ulang & ganti diagram'}
                </span>
                <ArrowUpRight size={14} style={{ marginLeft: 2 }} />
              </>
            )}
          </button>
        </form>
      )}

      {/* File Tab */}
      {tab === 'file' && (
        <form onSubmit={handleFileSubmit} className="input-group">
          <label className="input-label">
            {isRealMode ? 'Berkas sumber SOP (.pdf, .txt)' : 'Berkas sumber untuk simulasi'}
          </label>

          {processMode === 'extend' ? (
            <div className="sop-file-note">
              Untuk mode extend, tambahkan langkah baru melalui tab <strong>Teks Narasi</strong>.
            </div>
          ) : null}

          {!file ? (
            <div
              className={`dropzone ${isDragging ? 'dropzone--active' : ''}${processMode === 'extend' ? ' dropzone--disabled' : ''}`}
              onClick={() => processMode !== 'extend' && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (processMode !== 'extend') setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <span className="dropzone__icon"><UploadCloud size={22} /></span>
              <div className="dropzone__text">
                Pilih atau seret berkas SOP
              </div>
              <div className="dropzone__hint">
                {isRealMode ? 'PDF atau TXT · Diproses oleh backend FastAPI' : 'tidak diunggah · PDF atau TXT'}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                className="sr-only"
                disabled={processMode === 'extend'}
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    setFile(selectedFile);
                    onSourceFileChange?.(selectedFile);
                  }
                }}
              />
            </div>
          ) : (
            <div className="dropzone__file">
              <FileText style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span className="dropzone__file__name">{file.name}</span>
              <button
                type="button"
                className="dropzone__file__remove"
                onClick={() => {
                  setFile(null);
                  onClearSourceFile?.();
                }}
                disabled={processMode === 'extend'}
                aria-label="Hapus berkas"
              >
                ×
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || isLoading || processMode === 'extend'}
            className={`btn btn--primary${isLoading ? ' btn--loading' : ''}`}
            title="Unggah dan ekstrak alur proses (Ctrl+Enter)"
          >
            <span className="btn__spinner" aria-hidden="true" />
            {isLoading ? 'Memproses berkas SOP...' : (
              <>
                <Send size={14} />
                <span>
                  {isLoading
                    ? 'Memproses berkas SOP...'
                    : isNewFile
                      ? 'Buat file BPMN'
                      : hasExistingGraph
                        ? 'Proses ulang & ganti diagram'
                        : 'Buat diagram BPMN'}
                </span>
              </>
            )}
          </button>
        </form>
      )}
    </>
  );
}
