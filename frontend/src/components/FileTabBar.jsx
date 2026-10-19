import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode2, Plus, X, FolderOpen, FileText, FilePlus2
} from 'lucide-react';

/**
 * FileTabBar
 * VS Code style tab bar untuk multi-file management diagram BPMN.
 * Mendukung multiple tabs, switch tab, tutup tab, buat berkas baru, impor, dan ekspor.
 */
export default function FileTabBar({
  files = [],
  activeFileId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onImportFile,
  onExport,
  onRenameTab,
  onCreateFromSopFile,
  isCreatingFile = false,
}) {
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [newFileMenuOpen, setNewFileMenuOpen] = useState(false);
  const [newFileMenuPosition, setNewFileMenuPosition] = useState({ top: 0, left: 0 });

  const fileInputRef = useRef(null);
  const bpmnFileInputRef = useRef(null);
  const sopFileInputRef = useRef(null);
  const addFileButtonRef = useRef(null);
  const renameInputRef = useRef(null);
  const tabListRef = useRef(null);

  // Auto focus input when renaming tab
  useEffect(() => {
    if (editingTabId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingTabId]);

  useEffect(() => {
    if (!newFileMenuOpen) return undefined;
    const handleMenuKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setNewFileMenuOpen(false);
        addFileButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleMenuKeyDown);
    return () => window.removeEventListener('keydown', handleMenuKeyDown);
  }, [newFileMenuOpen]);

  const handleStartRename = (e, file) => {
    e.stopPropagation();
    setEditingTabId(file.id);
    setEditingName(file.name);
  };

  const handleFinishRename = () => {
    if (editingTabId && editingName.trim()) {
      let finalName = editingName.trim();
      if (!finalName.endsWith('.bpmn') && !finalName.endsWith('.xml') && !finalName.endsWith('.json')) {
        finalName += '.bpmn';
      }
      onRenameTab(editingTabId, finalName);
    }
    setEditingTabId(null);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingTabId(null);
    }
  };

  const handleTabKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % files.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + files.length) % files.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = files.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabListRef.current?.querySelectorAll('.vscode-tab')[nextIndex];
    nextTab?.focus();
    if (files[nextIndex]) onSelectTab(files[nextIndex].id);
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onImportFile(selectedFile);
    }
    e.target.value = ''; // Reset input
  };

  const handleSopFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onCreateFromSopFile(selectedFile);
    }
    e.target.value = '';
  };

  const showNewFileMenu = () => {
    const trigger = addFileButtonRef.current;
    const tabbar = trigger?.closest('.vscode-tabbar');
    if (trigger && tabbar) {
      const triggerRect = trigger.getBoundingClientRect();
      const tabbarRect = tabbar.getBoundingClientRect();
      const menuWidth = Math.min(232, window.innerWidth - 24);
      const preferredLeft = triggerRect.right - tabbarRect.left + 4;
      const maxLeft = Math.max(8, tabbarRect.width - menuWidth - 8);
      setNewFileMenuPosition({
        top: Math.max(0, triggerRect.top - tabbarRect.top - 5),
        left: Math.min(Math.max(8, preferredLeft), maxLeft),
      });
    }
    setNewFileMenuOpen(true);
  };

  const importSopFile = () => {
    setNewFileMenuOpen(false);
    sopFileInputRef.current?.click();
  };

  const createBlankFile = () => {
    setNewFileMenuOpen(false);
    onNewTab();
  };

  // Drag & drop file handler onto the tab bar
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (/\.(pdf|txt)$/i.test(droppedFile.name)) {
        onCreateFromSopFile(droppedFile);
      } else {
        onImportFile(droppedFile);
      }
    }
  };

  return (
    <div
      id="file-history"
      className={`vscode-tabbar ${isDragOver ? 'vscode-tabbar--dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseLeave={() => setNewFileMenuOpen(false)}
    >
      <div className="vscode-tabbar__file-section">
        <span className="vscode-tabbar__section-label">BERKAS TERBUKA</span>
        <div
          className="vscode-tabbar__tabs"
          ref={tabListRef}
          role="group"
          aria-label="Daftar berkas BPMN terbuka"
          onScroll={() => {
            if (newFileMenuOpen) showNewFileMenu();
          }}
        >
          {files.map((file, index) => {
            const isActive = file.id === activeFileId;
            const isEditing = file.id === editingTabId;

            return (
              <div
                key={file.id}
                className={`vscode-tab-entry${isActive ? ' vscode-tab-entry--active' : ''}`}
                role="presentation"
              >
                {isEditing ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="vscode-tab__rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={isActive}
                    tabIndex={0}
                    aria-label={`${file.name}${file.isDirty ? ', perubahan belum disimpan' : ''}${isActive ? ', aktif' : ''}`}
                    className={`vscode-tab${isActive ? ' vscode-tab--active' : ''}`}
                    onClick={() => onSelectTab(file.id)}
                    onDoubleClick={(e) => handleStartRename(e, file)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    title={`${file.name}${file.isDirty ? ' · Belum disimpan' : ''} · Klik ganda untuk ganti nama`}
                  >
                    <FileCode2 size={13} className="vscode-tab__icon" aria-hidden="true" />
                    <span className="vscode-tab__title">{file.name}</span>
                    {file.isDirty && (
                      <span
                        className="vscode-tab__dirty-dot"
                        aria-hidden="true"
                        title="Perubahan belum disimpan"
                      />
                    )}
                  </button>
                )}

                {!isEditing && (
                  <button
                    type="button"
                    className="vscode-tab__close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(file.id);
                    }}
                    title="Tutup berkas (Ctrl+W)"
                    aria-label={`Tutup ${file.name}`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}

          <button
            ref={addFileButtonRef}
            type="button"
            className="vscode-tabbar__add-btn"
            onMouseEnter={showNewFileMenu}
            onFocus={showNewFileMenu}
            onClick={showNewFileMenu}
            aria-expanded={newFileMenuOpen}
            aria-haspopup="menu"
            title="Tambah file"
            aria-label="Tampilkan pilihan file baru"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="vscode-tabbar__actions" role="group" aria-label="Aksi file">
        <span className="vscode-tabbar__section-label">AKSI FILE</span>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".bpmn,.xml,.json"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* Import Button */}
        <button
          type="button"
          className="vscode-tabbar__action-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Buka atau impor berkas (.bpmn, .xml, .json)"
          aria-label="Buka atau impor berkas"
        >
          <FolderOpen size={13} />
          <span>Buka Berkas</span>
        </button>
      </div>

      <input
        ref={bpmnFileInputRef}
        type="file"
        accept=".bpmn,.xml"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <input
        ref={sopFileInputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        style={{ display: 'none' }}
        onChange={handleSopFileChange}
      />

      {newFileMenuOpen && (
        <div
          className="new-file-menu"
          role="menu"
          aria-label="Pilihan file baru"
          style={{
            top: `${newFileMenuPosition.top}px`,
            left: `${newFileMenuPosition.left}px`,
          }}
        >
          <button
            type="button"
            className="new-file-menu__item"
            role="menuitem"
            onClick={() => {
              setNewFileMenuOpen(false);
              bpmnFileInputRef.current?.click();
            }}
            disabled={isCreatingFile}
          >
            <FolderOpen size={15} aria-hidden="true" />
            <span>Impor file BPMN</span>
          </button>
          <button
            type="button"
            className="new-file-menu__item"
            role="menuitem"
            onClick={importSopFile}
            disabled={isCreatingFile}
          >
            <FileText size={15} aria-hidden="true" />
            <span>Impor sumber SOP dari lokal</span>
          </button>
          <button
            type="button"
            className="new-file-menu__item"
            role="menuitem"
            onClick={createBlankFile}
            disabled={isCreatingFile}
          >
            <FilePlus2 size={15} aria-hidden="true" />
            <span>Mulai dari file kosong</span>
          </button>
        </div>
      )}
    </div>
  );
}
