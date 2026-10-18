import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo } from 'react';
import './index.css';
import SopUploader from './components/SopUploader';
import ValidationBadge from './components/ValidationBadge';
import Keycap from './components/Keycap';
import FileTabBar from './components/FileTabBar';
import LoadingState from './components/LoadingState';
import {
  isRealApiMode,
  processSopText,
  processSopFile,
  requestAiEditApi,
  applyGraphPatchApi,
} from './services/api';
import {
  createBlankProcess,
  createFileFromSynthesis,
  parseImportedFile,
  triggerFileDownload,
  loadPersistedFiles,
  persistFiles,
  loadPersistedActiveTabId,
  loadPersistedSopSource,
  loadPersistedCopilotChat,
  persistCopilotChat,
  removePersistedCopilotChat,
  persistSopSource,
  removePersistedSopSource,
} from './services/fileManager';
import {
  PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen,
  Search, ShieldCheck, Undo2, Redo2,
  FolderOpen, Plus, ArrowLeft, Sparkles, Workflow
} from 'lucide-react';

const BpmnViewer = lazy(() => import('./components/BpmnViewer'));
const AiCopilotPanel = lazy(() => import('./components/AiCopilotPanel'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const ChangePreviewModal = lazy(() => import('./components/ChangePreviewModal'));

const SAMPLE_SOP = `SOP Pengadaan Perlengkapan Kantor
1. Pemohon mengisi formulir permohonan pengadaan barang.
2. Manager Divisi meninjau urgensi kebutuhan dan ketersediaan anggaran.
3. Jika ditolak, formulir dikembalikan ke Pemohon beserta catatan revisi.
4. Jika disetujui, Bagian Pengadaan mencari vendor dan membandingkan harga.
5. Vendor terpilih mengirimkan barang pesanan ke kantor.
6. Pemohon menerima barang dan menandatangani berita acara penerimaan.`;

export default function App() {
  const [isRealMode, setIsRealMode] = useState(() => isRealApiMode());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Memproses permintaan...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [copilotSession, setCopilotSession] = useState({ fileId: '', messages: [], loaded: false });
  const [changePreview, setChangePreview] = useState(null);
  const [pendingExtension, setPendingExtension] = useState(null);

  // ── Multi-Tab File Management State ──
  const [files, setFiles] = useState(() => {
    const saved = loadPersistedFiles();
    if (saved && Array.isArray(saved)) return saved;
    return [];
  });

  const [activeFileId, setActiveFileId] = useState(() => {
    const savedActive = loadPersistedActiveTabId();
    const savedFiles = loadPersistedFiles();
    if (savedActive && savedFiles?.some((f) => f.id === savedActive)) {
      return savedActive;
    }
    return savedFiles?.[0]?.id || '';
  });

  // Ensure activeFile matches activeFileId or null if no files
  const activeFile = useMemo(() => {
    if (!files || files.length === 0) return null;
    return files.find((f) => f.id === activeFileId) || files[0] || null;
  }, [files, activeFileId]);

  useEffect(() => {
    let isCurrent = true;
    setSourceFile(null);
    if (!activeFile?.sopFileName) return () => { isCurrent = false; };

    loadPersistedSopSource(activeFile.id)
      .then((savedSource) => {
        if (isCurrent) {
          setSourceFile(savedSource);
          if (!savedSource) {
            setErrorMessage('Berkas sumber SOP tidak ditemukan di penyimpanan browser.');
          }
        }
      })
      .catch((err) => {
        console.error('Load SOP source error:', err);
        if (isCurrent) setErrorMessage(err.message || 'Gagal memuat berkas sumber SOP.');
      });

    return () => { isCurrent = false; };
  }, [activeFile?.id, activeFile?.sopFileName]);

  useEffect(() => {
    let isCurrent = true;
    if (!activeFile?.id) {
      setCopilotSession({ fileId: '', messages: [], loaded: true });
      return () => { isCurrent = false; };
    }

    setCopilotSession({ fileId: activeFile.id, messages: [], loaded: false });
    loadPersistedCopilotChat(activeFile.id)
      .then((messages) => {
        if (isCurrent) setCopilotSession({ fileId: activeFile.id, messages, loaded: true });
      })
      .catch((err) => {
        console.error('Load Copilot chat error:', err);
        if (isCurrent) {
          setErrorMessage(err.message || 'Gagal memuat riwayat Copilot.');
          setCopilotSession({ fileId: activeFile.id, messages: [], loaded: true });
        }
      });
    return () => { isCurrent = false; };
  }, [activeFile?.id]);

  // Persist files whenever they change (can be empty array)
  useEffect(() => {
    persistFiles(files, activeFileId);
  }, [files, activeFileId]);

  // Citation highlight state (from AI Copilot → SopUploader)
  const [highlightedCitation, setHighlightedCitation] = useState(null);

  // Overdrive: Canvas node pulse highlight & Walkthrough & Command Palette
  const [highlightedCanvasNodeId, setHighlightedCanvasNodeId] = useState(null);
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [copilotExternalPrompt, setCopilotExternalPrompt] = useState(null);

  // Panel visibility
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const hasCopilotContext = Boolean(
    activeFile?.sopText?.trim() ||
    activeFile?.intermediateGraph?.nodes?.length ||
    (copilotSession.fileId === activeFile?.id && copilotSession.messages.length > 0) ||
    copilotExternalPrompt
  );

  // ── Tab Management Actions ──
  const handleSelectTab = useCallback((fileId) => {
    setActiveFileId(fileId);
    setSelectedElement(null);
    setErrorMessage(null);
  }, []);

  const handleNewTab = useCallback(() => {
    const nextIndex = files.length + 1;
    const newFile = createBlankProcess(nextIndex);
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setSelectedElement(null);
    setErrorMessage(null);
  }, [files.length]);

  const handleCloseTab = useCallback(
    (fileIdToClose) => {
      const fileToClose = files.find((f) => f.id === fileIdToClose);
      if (fileToClose?.isDirty) {
        const confirmClose = window.confirm(
          `Berkas "${fileToClose.name}" memiliki perubahan yang belum disimpan. Yakin ingin menutup?`
        );
        if (!confirmClose) return;
      }

      const closedIndex = files.findIndex((f) => f.id === fileIdToClose);
      const remainingFiles = files.filter((f) => f.id !== fileIdToClose);
      if (fileToClose?.sopFileName) {
        removePersistedSopSource(fileIdToClose).catch((err) => {
          console.error('Remove SOP source error:', err);
          setErrorMessage(err.message || 'Gagal menghapus berkas sumber SOP.');
        });
      }
      removePersistedCopilotChat(fileIdToClose).catch((err) => {
        console.error('Remove Copilot chat error:', err);
        setErrorMessage(err.message || 'Gagal menghapus riwayat Copilot.');
      });
      setFiles(remainingFiles);

      if (remainingFiles.length === 0) {
        setActiveFileId('');
        setSelectedElement(null);
        return;
      }

      if (activeFileId === fileIdToClose) {
        const nextActiveIndex = Math.max(0, closedIndex - 1);
        setActiveFileId(remainingFiles[nextActiveIndex]?.id || remainingFiles[0]?.id || '');
      }
    },
    [files, activeFileId]
  );

  const handleRenameTab = useCallback((tabId, newName) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === tabId
          ? {
              ...f,
              name: newName,
              processName: newName.replace(/\.[^/.]+$/, ''),
            }
          : f
      )
    );
  }, []);

  const handleImportFile = useCallback(async (fileObj) => {
    try {
      setLoadingMessage('Mengimpor diagram...');
      setIsLoading(true);
      setErrorMessage(null);
      const imported = await parseImportedFile(fileObj);
      setFiles((prev) => [...prev, imported]);
      setActiveFileId(imported.id);
      setSelectedElement(null);
    } catch (err) {
      console.error('Import file error:', err);
      setErrorMessage(err.message || 'Gagal mengimpor berkas diagram.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleExport = useCallback(
    (format) => {
      if (!activeFile) return;

      const baseName = (activeFile.name || 'process').replace(/\.[^/.]+$/, '');

      if (format === 'bpmn') {
        const filename = `${baseName}.bpmn`;
        triggerFileDownload(activeFile.bpmnXml || '', 'application/xml', filename);
        // Mark tab as clean after save/export
        setFiles((prev) =>
          prev.map((f) => (f.id === activeFile.id ? { ...f, isDirty: false } : f))
        );
      } else if (format === 'json') {
        const filename = `${baseName}.json`;
        const jsonContent = JSON.stringify(activeFile.intermediateGraph || {}, null, 2);
        triggerFileDownload(jsonContent, 'application/json', filename);
        setFiles((prev) =>
          prev.map((f) => (f.id === activeFile.id ? { ...f, isDirty: false } : f))
        );
      } else if (format === 'svg') {
        window.dispatchEvent(new CustomEvent('autobpmn-export', { detail: { format: 'svg' } }));
      }
    },
    [activeFile]
  );

  // Visual Editor Save Callback (Updates the active tab & marks as dirty)
  const handleVisualGraphUpdate = useCallback(
    ({ graph, bpmnXml: newXml, validation: newVal }) => {
      if (!activeFile) return;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFile.id
            ? {
                ...f,
                intermediateGraph: graph,
                bpmnXml: newXml,
                validation: newVal,
                processName: graph.process_name || f.processName,
                isDirty: true,
              }
            : f
        )
      );
      setErrorMessage(null);
    },
    [activeFile]
  );

  // Global keyboard shortcuts (VS Code tab style)
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        setSelectedElement(null);
        return;
      }

      // Open Command Palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
        return;
      }

      // Close Active Tab: Ctrl+W or Cmd+W (when not typing in text)
      const tag = document.activeElement?.tagName?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W') && !e.shiftKey) {
        if (tag !== 'input' && tag !== 'textarea' && activeFileId) {
          e.preventDefault();
          handleCloseTab(activeFileId);
          return;
        }
      }

      // Quick Save / Export BPMN: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleExport('bpmn');
        return;
      }

      if (tag === 'input' || tag === 'textarea') return;

      // Toggle left sidebar: '['
      if (e.key === '[' || e.code === 'BracketLeft') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Toggle right detail panel: ']'
      else if (e.key === ']' || e.code === 'BracketRight') {
        e.preventDefault();
        setDetailOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts, true);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, true);
  }, [activeFileId, handleCloseTab, handleExport]);

  // Monitor URL changes (browser back/forward & pushState)
  useEffect(() => {
    const handlePopState = () => {
      setIsRealMode(isRealApiMode());
      setErrorMessage(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const switchMode = (toReal) => {
    const targetPath = toReal ? '/demo' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setIsRealMode(toReal);
    setErrorMessage(null);
  };

  const handleSynthesisResult = async (data, rawSop = '', source = null, createNewFile = false) => {
    const synthesizedFile = createFileFromSynthesis(data, rawSop);
    const existingFile = createNewFile ? null : activeFile;
    const targetFile = existingFile
      ? {
          ...existingFile,
          ...synthesizedFile,
          id: existingFile.id,
          name: existingFile.name.startsWith('Untitled-') ? synthesizedFile.name : existingFile.name,
          sopFileName: source?.name || '',
        }
      : {
          ...synthesizedFile,
          sopFileName: source?.name || '',
        };

    if (source) {
      await persistSopSource(targetFile.id, source);
      setSourceFile(source);
    } else if (existingFile?.sopFileName) {
      await removePersistedSopSource(existingFile.id);
      setSourceFile(null);
    }

    setFiles((prev) => existingFile
      ? prev.map((file) => (file.id === existingFile.id ? targetFile : file))
      : [...prev, targetFile]);
    setActiveFileId(targetFile.id);
    setSelectedElement(null);
    setErrorMessage(null);
  };

  const handleProcessText = async (text, mode = 'replace') => {
    if (!text.trim()) return;
    setLoadingMessage(mode === 'extend' ? 'Menganalisis tambahan SOP...' : 'Memproses teks SOP...');
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (mode === 'extend') {
        if (!activeFile?.intermediateGraph) {
          throw new Error('Buat diagram BPMN terlebih dahulu sebelum menggunakan extend.');
        }
        const preview = await requestAiEditApi(
          'Tambahkan hanya langkah atau aturan baru yang didukung oleh sumber SOP tambahan. Pertahankan seluruh langkah dan alur yang sudah ada; jangan menghapus atau mengganti bagian lama kecuali sangat diperlukan untuk menyisipkan tambahan.',
          activeFile.intermediateGraph,
          null,
          isRealMode,
          text
        );
        setPendingExtension({ fileId: activeFile.id, text });
        setChangePreview(preview);
        return;
      }
      const res = await processSopText(text, 'Dokumen SOP', isRealMode);
      await handleSynthesisResult(res, text);
    } catch (err) {
      setErrorMessage(err.message || 'Gagal memproses teks SOP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessFile = async (file, mode = 'replace') => {
    if (mode === 'extend') return;
    setLoadingMessage('Memproses berkas SOP...');
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await processSopFile(file, isRealMode);
      const rawText = res.source_text || (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')
        ? await file.text()
        : '');
      await handleSynthesisResult(res, rawText, file);
    } catch (err) {
      setErrorMessage(err.message || 'Gagal memproses berkas SOP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromSopFile = async (file) => {
    setLoadingMessage('Membuat diagram dari SOP...');
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await processSopFile(file, isRealMode);
      const rawText = result.source_text || (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')
        ? await file.text()
        : '');
      await handleSynthesisResult(result, rawText, file, true);
    } catch (err) {
      console.error('Create BPMN from SOP file error:', err);
      setErrorMessage(err.message || 'Gagal membuat file BPMN dari sumber SOP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceTextChange = useCallback((text) => {
    if (!activeFile) return;
    setFiles((prev) => prev.map((file) => (
      file.id === activeFile.id
        ? { ...file, sopText: text, sopFileName: '' }
        : file
    )));
    if (activeFile.sopFileName) {
      removePersistedSopSource(activeFile.id).catch((err) => {
        console.error('Remove replaced SOP source error:', err);
        setErrorMessage(err.message || 'Gagal memperbarui sumber SOP.');
      });
      setSourceFile(null);
    }
  }, [activeFile]);

  const handleSourceFileChange = useCallback(async (file) => {
    if (!activeFile) return;
    try {
      await persistSopSource(activeFile.id, file);
      setSourceFile(file);
      setFiles((prev) => prev.map((tab) => (
        tab.id === activeFile.id
          ? { ...tab, sopFileName: file.name, sopText: '' }
          : tab
      )));
      setErrorMessage(null);
    } catch (err) {
      console.error('Persist SOP source error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan berkas sumber SOP.');
    }
  }, [activeFile]);

  const handleClearSourceFile = useCallback(() => {
    if (!activeFile) return;
    removePersistedSopSource(activeFile.id).catch((err) => {
      console.error('Clear SOP source error:', err);
      setErrorMessage(err.message || 'Gagal menghapus berkas sumber SOP.');
    });
    setSourceFile(null);
    setFiles((prev) => prev.map((file) => (
      file.id === activeFile.id
        ? { ...file, sopFileName: '' }
        : file
    )));
  }, [activeFile]);

  const handleApplyExtension = async (preview) => {
    if (!pendingExtension) return;
    const targetFile = files.find((file) => file.id === pendingExtension.fileId);
    if (!targetFile?.intermediateGraph) {
      setErrorMessage('File BPMN tujuan tidak lagi tersedia untuk menerima tambahan.');
      return;
    }

    setLoadingMessage('Menerapkan perubahan ke diagram...');
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await applyGraphPatchApi(targetFile.intermediateGraph, preview.patch, isRealMode);
      const updatedFile = {
        ...targetFile,
        intermediateGraph: result.intermediate_graph,
        bpmnXml: result.bpmn_xml,
        validation: result.validation,
        sopText: [targetFile.sopText, pendingExtension.text].filter(Boolean).join('\n\n'),
        isDirty: true,
      };
      setFiles((prev) => prev.map((file) => (
        file.id === updatedFile.id ? updatedFile : file
      )));
      setChangePreview(null);
      setPendingExtension(null);
    } catch (err) {
      console.error('Apply SOP extension error:', err);
      setErrorMessage(err.message || 'Gagal menerapkan tambahan SOP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscardExtension = () => {
    setChangePreview(null);
    setPendingExtension(null);
  };

  const handleCopilotMessagesChange = useCallback((messages) => {
    if (!activeFile?.id || copilotSession.fileId !== activeFile.id || !copilotSession.loaded) return;
    persistCopilotChat(activeFile.id, messages).catch((err) => {
      console.error('Persist Copilot chat error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan riwayat Copilot.');
    });
  }, [activeFile?.id, copilotSession.fileId, copilotSession.loaded]);

  const handleTrySample = useCallback(() => {
    if (isLoading) return;
    setLoadingMessage('Memuat contoh proses...');
    setIsLoading(true);
    setErrorMessage(null);
    processSopText(SAMPLE_SOP, 'Dokumen SOP', isRealMode)
      .then((res) => handleSynthesisResult(res, SAMPLE_SOP))
      .catch((err) => setErrorMessage(err.message || 'Gagal memproses contoh SOP.'))
      .finally(() => setIsLoading(false));
  }, [isLoading, isRealMode]);

  const handleSelectElement = useCallback((elem) => {
    setSelectedElement(elem);
    if (elem) {
      setDetailOpen(true);
    }
  }, []);

  const handleCitationClick = useCallback((citation) => {
    setHighlightedCitation(citation);
    if (citation?.node_id) {
      setHighlightedCanvasNodeId(citation.node_id);
    } else if (citation?.id) {
      setHighlightedCanvasNodeId(citation.id);
    }
    setTimeout(() => {
      setHighlightedCitation(null);
      setHighlightedCanvasNodeId(null);
    }, 8000);
  }, []);

  const appContent = (
    <div className="app-shell" aria-busy={isLoading}>
      {/* ── Top Bar ── */}
      <header className="app-header">
        <div className="app-header__brand">
          <button
            className="toggle-panel-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Tutup sidebar dokumen (Hot-key: [)' : 'Buka sidebar dokumen (Hot-key: [)'}
            aria-label={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          <div className="app-header__title">AutoBPMN</div>
          {activeFile && (
            <>
              <span className="app-header__sep">/</span>
              <span className="app-header__doc-title">{activeFile.name}</span>
            </>
          )}
        </div>

        <div className="app-header__center">
          <button
            type="button"
            className="cmd-trigger-btn"
            onClick={() => setCmdPaletteOpen(true)}
            title="Cari alur proses atau tindakan cepat (Ctrl+K)"
            aria-label="Cari node proses atau tindakan cepat"
          >
            <Search size={13} className="cmd-trigger-btn__icon" />
            <span className="cmd-trigger-btn__text">Cari alur atau aksi...</span>
            <span className="cmd-trigger-btn__kbd">Ctrl K</span>
          </button>
        </div>

        <div className="app-header__actions">
          <div className="app-header__save-status">
            <span
              className="app-header__save-dot"
              style={{
                background: isLoading
                  ? 'var(--warning-500)'
                  : activeFile?.bpmnXml
                  ? 'var(--success-600)'
                  : 'var(--gray-400)',
              }}
            />
            <span>
              {isLoading
                ? 'Memproses...'
                : activeFile?.isDirty
                ? 'Dimodifikasi'
                : activeFile?.bpmnXml
                ? (isRealMode ? 'Live API' : 'Simulasi')
                : 'Siap'}
            </span>
          </div>

          <button
            className="toggle-panel-btn"
            onClick={() => setDetailOpen(!detailOpen)}
            title={detailOpen ? 'Tutup panel Copilot (Hot-key: ])' : 'Buka panel Copilot (Hot-key: ])'}
            aria-label={detailOpen ? 'Tutup panel Copilot' : 'Buka panel Copilot'}
          >
            {detailOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
      </header>

      {/* ── Three-column body ── */}
      <div className="app-body">
        {/* LEFT SIDEBAR */}
        <aside className={`sidebar${sidebarOpen ? '' : ' sidebar--collapsed'}`}>
          <div className="sidebar__header">
            <div className="sidebar__title">
              {activeFile ? `Sumber SOP${activeFile.name ? ` · ${activeFile.name}` : ''}` : 'Tambahkan Sumber SOP'}
            </div>
            <p className="sidebar__description">
              {activeFile
                ? activeFile.sopFileName
                  ? `Berkas sumber tersimpan: ${activeFile.sopFileName}`
                  : 'Sumber tersimpan terpisah pada file BPMN aktif.'
                : 'Masukkan teks atau unggah berkas. Sistem akan membuat file BPMN baru.'}
            </p>
          </div>

          <div className="sidebar__content">
            <SopUploader
              key={activeFile?.id || 'no-active-file'}
              onProcessText={handleProcessText}
              onProcessFile={handleProcessFile}
              onSourceTextChange={handleSourceTextChange}
              onSourceFileChange={handleSourceFileChange}
              onClearSourceFile={handleClearSourceFile}
              fileId={activeFile?.id || ''}
              sourceFile={sourceFile}
              hasExistingGraph={Boolean(activeFile?.intermediateGraph?.nodes?.length)}
              isNewFile={!activeFile}
              isLoading={isLoading}
              isRealMode={isRealMode}
              highlightedCitation={highlightedCitation}
              initialText={activeFile?.sopText || ''}
            />

            {errorMessage && (
              <div className="error-banner" role="alert">
                <svg className="error-banner__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {activeFile?.validation && <ValidationBadge validation={activeFile.validation} />}
          </div>
        </aside>

        {/* CENTER — VS Code Style Tabs & BPMN Canvas */}
        <main className="canvas-area">
          {/* File Tab Bar (VS Code Tabs) */}
          <FileTabBar
            files={files}
            activeFileId={activeFileId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
            onImportFile={handleImportFile}
            onRenameTab={handleRenameTab}
            onCreateFromSopFile={handleCreateFromSopFile}
            isCreatingFile={isLoading}
          />

          {activeFile?.bpmnXml ? (
            <Suspense
              fallback={
                <LoadingState
                  variant="workframe"
                  label="Memuat kanvas BPMN..."
                  description="Menyiapkan tampilan diagram."
                />
              }
            >
              <BpmnViewer
                xml={activeFile.bpmnXml}
                processName={activeFile.processName || activeFile.name || ''}
                intermediateGraph={activeFile.intermediateGraph || null}
                highlightedNodeId={highlightedCanvasNodeId}
                isWalkthroughActive={isWalkthroughActive}
                onToggleWalkthrough={setIsWalkthroughActive}
                onTrySample={handleTrySample}
                onSelectElement={handleSelectElement}
                onGraphUpdate={handleVisualGraphUpdate}
                onFocusSidebar={() => {
                  setSidebarOpen(true);
                  setTimeout(() => {
                    const el = document.getElementById('sop-textarea') || document.querySelector('.sidebar textarea');
                    if (el) {
                      el.focus();
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 60);
                }}
              />
            </Suspense>
          ) : (
            <section className="canvas-area__empty-state" aria-label="Belum ada diagram BPMN">
              <div className="empty-state__hub">
                <div className="empty-state__header">
                  <div className="empty-state__badge">
                    <Workflow size={13} className="empty-state__badge-icon" />
                    <span>Belum Ada BPMN Aktif</span>
                  </div>
                  <h2 className="empty-state__title">Mulai Sintesis Alur Proses BPMN 2.0</h2>
                  <p className="empty-state__desc">
                    Tambahkan narasi SOP atau gunakan sampel untuk membuat diagram pertama.
                  </p>
                  <div className="empty-state__actions">
                    <button
                      type="button"
                      className="empty-state__cta-focus"
                      onClick={() => {
                        setSidebarOpen(true);
                        setTimeout(() => {
                          const el = document.getElementById('sop-textarea') || document.querySelector('.sidebar textarea');
                          el?.focus();
                        }, 60);
                      }}
                    >
                      <ArrowLeft size={14} className="empty-state__arrow-left" />
                      <span>Tambahkan Sumber SOP</span>
                    </button>
                    <button
                      type="button"
                      className="empty-state__cta-sample"
                      onClick={handleTrySample}
                      disabled={isLoading}
                    >
                      <Sparkles size={14} />
                      <span>Coba Contoh SOP</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        {/* RIGHT - AI Copilot Panel (Investigasi SOP & Analisis Kaidah BPMN) */}
        <aside className={`detail-panel${detailOpen ? '' : ' detail-panel--collapsed'}`}>
          {hasCopilotContext ? (
            <Suspense
              fallback={
                detailOpen ? (
                  <LoadingState
                    variant="panel"
                    label="Memuat Copilot..."
                    description="Menyiapkan panel analisis."
                  />
                ) : null
              }
            >
              <AiCopilotPanel
                key={`${activeFile?.id || 'no-file'}-${copilotSession.loaded ? 'loaded' : 'loading'}`}
                sopText={activeFile?.sopText || ''}
                processName={activeFile?.processName || ''}
                selectedElement={selectedElement}
                onDeselectElement={() => setSelectedElement(null)}
                intermediateGraph={activeFile?.intermediateGraph || null}
                onCitationClick={handleCitationClick}
                onClose={() => setDetailOpen(false)}
                isRealMode={isRealMode}
                externalPrompt={copilotExternalPrompt}
                initialMessages={copilotSession.fileId === activeFile?.id ? copilotSession.messages : []}
                onMessagesChange={handleCopilotMessagesChange}
              />
            </Suspense>
          ) : (
            <div className="copilot-prerequisite" role="status">
              <Sparkles size={20} aria-hidden="true" />
              <h2>Copilot siap saat konteks tersedia</h2>
              <p>Tambahkan SOP atau buka diagram proses untuk memulai analisis.</p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Command Palette (Ctrl+K) ── */}
      {cmdPaletteOpen && (
        <Suspense fallback={<LoadingState variant="overlay" label="Membuka pencarian..." />}>
          <CommandPalette
            isOpen={cmdPaletteOpen}
            onClose={() => setCmdPaletteOpen(false)}
            nodes={activeFile?.intermediateGraph?.nodes || []}
            onSelectNode={(node) => {
              setHighlightedCanvasNodeId(node.id);
              setSelectedElement({
                id: node.id,
                type: node.type || 'Element',
                name: node.name || node.label || node.id,
                actor: node.actor || '',
              });
              setDetailOpen(true);
            }}
            onStartWalkthrough={() => {
              setIsWalkthroughActive(true);
            }}
            onAskCopilot={(prompt) => {
              setDetailOpen(true);
              setCopilotExternalPrompt(prompt);
            }}
            onExportBpmn={() => handleExport('bpmn')}
            onExportSvg={() => handleExport('svg')}
            onTrySample={handleTrySample}
            onFitView={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', code: 'Digit0' }));
            }}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            onToggleDetail={() => setDetailOpen((prev) => !prev)}
            isRealMode={isRealMode}
          />
        </Suspense>
      )}

      {changePreview && (
        <Suspense fallback={<LoadingState variant="overlay" label="Menyiapkan pratinjau perubahan..." />}>
          <ChangePreviewModal
            isOpen={Boolean(changePreview)}
            previewData={changePreview}
            currentGraph={activeFile?.intermediateGraph}
            currentXml={activeFile?.bpmnXml}
            processName={activeFile?.processName || activeFile?.name}
            sourceText={pendingExtension?.text}
            onApply={handleApplyExtension}
            onDiscard={handleDiscardExtension}
            isLoading={isLoading}
          />
        </Suspense>
      )}
      {isLoading && <LoadingState variant="overlay" label={loadingMessage} />}
    </div>
  );

  // Real Simulation Mode (/demo): normal look
  if (isRealMode) {
    return appContent;
  }

  // Simulation Mode (Root /): wrap with outer border & banner
  return (
    <div className="simulation-outer-frame">
      <div className="simulation-border-box">
        <div className="simulation-banner">
          <div className="simulation-banner__left">
            <span className="simulation-badge">Simulation Only</span>
            <span className="simulation-banner__text">
              Mode simulasi lokal (Fake API). Menampilkan hasil seolah API telah merespons.
            </span>
          </div>
          <button
            type="button"
            className="simulation-banner__action"
            onClick={() => switchMode(true)}
            title="Buka live prototype dengan pemanggilan API nyata di /demo"
          >
            <span>Klik di sini untuk prototype asli</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="simulation-inner-app">
          {appContent}
        </div>
      </div>
    </div>
  );
}
