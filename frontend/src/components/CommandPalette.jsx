import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Workflow, Sparkles, Download, Layers,
  PanelLeft, PanelRight, Maximize2, Bot, HelpCircle,
  Play, FileText, ArrowRight, CornerDownLeft, ShieldCheck, X
} from 'lucide-react';
import Keycap from './Keycap';

export default function CommandPalette({
  isOpen,
  onClose,
  nodes = [],
  onSelectNode,
  onExportBpmn,
  onExportSvg,
  onTrySample,
  onFitView,
  onToggleSidebar,
  onToggleDetail,
  onAskCopilot,
  onStartWalkthrough,
  isRealMode,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Build the list of actionable items
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();

    const nodeItems = (nodes || []).map((node) => ({
      id: `node-${node.id}`,
      type: 'node',
      title: node.name || node.id,
      subtitle: `${node.actor ? `Peran: ${node.actor} · ` : ''}Tipe: ${node.type || 'Node'}`,
      icon: <Layers size={15} className="cmd-item__icon cmd-item__icon--node" />,
      badge: node.actor || node.type,
      node,
      action: () => {
        if (onSelectNode) onSelectNode(node);
      },
    }));

    const actionItems = [
      {
        id: 'action-walkthrough',
        type: 'action',
        title: 'Mulai Walkthrough Simulasi Alur',
        subtitle: 'Jalankan presentasi alur proses langkah demi langkah di kanvas',
        icon: <Play size={15} className="cmd-item__icon cmd-item__icon--accent" />,
        shortcut: ['Space'],
        action: () => {
          if (onStartWalkthrough) onStartWalkthrough();
        },
      },
      {
        id: 'action-copilot-gaps',
        type: 'action',
        title: 'Tanya Copilot: Analisis Celah & Ambiguitas SOP',
        subtitle: 'Investigasi aturan bisnis yang belum lengkap atau tanpa SLA di SOP',
        icon: <Bot size={15} className="cmd-item__icon cmd-item__icon--accent" />,
        action: () => {
          if (onAskCopilot) onAskCopilot('Temukan celah atau ambiguitas alur dalam SOP');
        },
      },
      {
        id: 'action-copilot-raci',
        type: 'action',
        title: 'Tanya Copilot: Matriks Peran & RACI',
        subtitle: 'Identifikasi peran yang bertanggung jawab (Responsible, Accountable)',
        icon: <ShieldCheck size={15} className="cmd-item__icon cmd-item__icon--accent" />,
        action: () => {
          if (onAskCopilot) onAskCopilot('Jelaskan peran RACI dalam proses ini');
        },
      },
      {
        id: 'action-export-bpmn',
        type: 'action',
        title: 'Ekspor Model Proses BPMN 2.0 (.bpmn)',
        subtitle: 'Unduh berkas XML standar executable BPMN 2.0',
        icon: <Download size={15} className="cmd-item__icon" />,
        shortcut: ['Alt', 'B'],
        action: () => {
          if (onExportBpmn) onExportBpmn();
        },
      },
      {
        id: 'action-export-svg',
        type: 'action',
        title: 'Ekspor Gambar Vektor Diagram (.svg)',
        subtitle: 'Unduh visual diagram berkualitas tinggi bebas pecah piksel',
        icon: <Download size={15} className="cmd-item__icon" />,
        action: () => {
          if (onExportSvg) onExportSvg();
        },
      },
      {
        id: 'action-fit-view',
        type: 'action',
        title: 'Sesuaikan Diagram ke Layar (Fit Viewport)',
        subtitle: 'Pusatkan seluruh alur proses di tengah kanvas kerja',
        icon: <Maximize2 size={15} className="cmd-item__icon" />,
        shortcut: ['0'],
        action: () => {
          if (onFitView) onFitView();
        },
      },
      {
        id: 'action-toggle-sidebar',
        type: 'action',
        title: 'Buka / Tutup Sidebar SOP (Kiri)',
        subtitle: 'Perluas area kerja kanvas diagram dengan menyembunyikan sidebar',
        icon: <PanelLeft size={15} className="cmd-item__icon" />,
        shortcut: ['['],
        action: () => {
          if (onToggleSidebar) onToggleSidebar();
        },
      },
      {
        id: 'action-toggle-detail',
        type: 'action',
        title: 'Buka / Tutup Panel AI Copilot (Kanan)',
        subtitle: 'Tampilkan asisten review SOP berbasis grounding',
        icon: <PanelRight size={15} className="cmd-item__icon" />,
        shortcut: [']'],
        action: () => {
          if (onToggleDetail) onToggleDetail();
        },
      },
      {
        id: 'action-sample',
        type: 'action',
        title: 'Muat Contoh Dokumen SOP Pengadaan',
        subtitle: 'Isi otomatis formulir dengan teks SOP demo pengadaan perlengkapan kantor',
        icon: <Sparkles size={15} className="cmd-item__icon" />,
        shortcut: ['Alt', 'S'],
        action: () => {
          if (onTrySample) onTrySample();
        },
      },
    ];

    if (!q) {
      return [...actionItems, ...nodeItems];
    }

    const filteredNodes = nodeItems.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.subtitle.toLowerCase().includes(q) ||
        (n.badge && n.badge.toLowerCase().includes(q))
    );

    const filteredActions = actionItems.filter(
      (a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );

    return [...filteredNodes, ...filteredActions];
  }, [query, nodes, onSelectNode, onExportBpmn, onExportSvg, onTrySample, onFitView, onToggleSidebar, onToggleDetail, onAskCopilot, onStartWalkthrough]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Keep selected item in view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('.cmd-item--active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="cmd-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette AutoBPMN"
    >
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrapper">
          <Search size={16} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari aktivitas proses, peran, atau aksi studio..."
            aria-label="Cari perintah atau node proses"
          />
          {query ? (
            <button
              type="button"
              className="cmd-clear-btn"
              onClick={() => setQuery('')}
              title="Hapus pencarian"
              aria-label="Hapus kata kunci"
            >
              <X size={14} />
            </button>
          ) : (
            <span className="cmd-key-hint">
              <Keycap keys="Esc" variant="subtle" />
            </span>
          )}
        </div>

        <div className="cmd-list" ref={listRef} role="listbox">
          {items.length === 0 ? (
            <div className="cmd-empty">
              <HelpCircle size={20} className="cmd-empty__icon" />
              <div className="cmd-empty__title">Tidak ada hasil yang cocok</div>
              <div className="cmd-empty__desc">Coba gunakan kata kunci aktivitas atau nama peran lain.</div>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                role="option"
                aria-selected={idx === selectedIndex}
                className={`cmd-item ${idx === selectedIndex ? 'cmd-item--active' : ''}`}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="cmd-item__left">
                  {item.icon}
                  <div className="cmd-item__text">
                    <div className="cmd-item__title">{item.title}</div>
                    <div className="cmd-item__subtitle">{item.subtitle}</div>
                  </div>
                </div>

                <div className="cmd-item__right">
                  {item.badge && (
                    <span className="cmd-item__badge">{item.badge}</span>
                  )}
                  {item.shortcut && (
                    <Keycap keys={item.shortcut} variant="subtle" />
                  )}
                  {idx === selectedIndex && (
                    <span className="cmd-item__enter">
                      <CornerDownLeft size={12} />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <div className="cmd-footer__hints">
            <span><Keycap keys="↑" variant="subtle" /><Keycap keys="↓" variant="subtle" /> navigasi</span>
            <span><Keycap keys="Enter" variant="subtle" /> pilih</span>
            <span><Keycap keys="Esc" variant="subtle" /> tutup</span>
          </div>
          <span className="cmd-footer__brand">Review Studio Overdrive</span>
        </div>
      </div>
    </div>
  );
}
