import React from 'react';
import {
  X, Trash2, Tag, User, GitBranch,
  ArrowRight, ShieldCheck, Check
} from 'lucide-react';

/**
 * CanvasPropertyDrawer
 * Drawer panel properti elemen kanvas yang muncul saat mode edit aktif.
 * Mengubah langsung nama, aktor, dan kondisi gateway tanpa merusak struktur.
 */
export default function CanvasPropertyDrawer({
  element,
  isOpen,
  onClose,
  onChangeProperty,
  onDeleteElement,
}) {
  if (!isOpen || !element) return null;

  const isTask = element.type?.toLowerCase().includes('task');
  const isGateway = element.type?.toLowerCase().includes('gateway');
  const isSequenceFlow =
    element.type?.toLowerCase().includes('sequenceflow') ||
    element.rawType === 'bpmn:SequenceFlow';

  return (
    <aside
      className="canvas-prop-drawer"
      aria-label="Panel Properti Elemen BPMN"
    >
      {/* Header */}
      <div className="canvas-prop-drawer__header">
        <div className="canvas-prop-drawer__title-group">
          <span className="canvas-prop-drawer__type-badge">
            {element.type || 'Element'}
          </span>
          <span className="canvas-prop-drawer__id" title={element.id}>
            {element.id}
          </span>
        </div>
        <button
          type="button"
          className="canvas-prop-drawer__close-btn"
          onClick={onClose}
          aria-label="Tutup panel properti"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body Fields */}
      <div className="canvas-prop-drawer__body">
        {/* Label / Name */}
        <div className="canvas-prop-field">
          <label htmlFor="elem-prop-name" className="canvas-prop-field__label">
            <Tag size={12} className="canvas-prop-field__icon" />
            <span>Label / Nama Elemen</span>
          </label>
          <input
            id="elem-prop-name"
            type="text"
            className="canvas-prop-field__input"
            value={element.name || ''}
            onChange={(e) => onChangeProperty('name', e.target.value)}
            placeholder="Contoh: Verifikasi Kelengkapan Dokumen"
          />
        </div>

        {/* Actor (for Tasks) */}
        {isTask && (
          <div className="canvas-prop-field">
            <label htmlFor="elem-prop-actor" className="canvas-prop-field__label">
              <User size={12} className="canvas-prop-field__icon" />
              <span>Pelaksana / Actor</span>
            </label>
            <input
              id="elem-prop-actor"
              type="text"
              className="canvas-prop-field__input"
              value={element.actor || ''}
              onChange={(e) => onChangeProperty('actor', e.target.value)}
              placeholder="Contoh: Manager Divisi, Pemohon"
            />
            <span className="canvas-prop-field__hint">
              Menentukan swimlane atau peran operasional dalam SOP.
            </span>
          </div>
        )}

        {/* Condition (for Sequence Flows or Gateways) */}
        {(isSequenceFlow || isGateway) && (
          <div className="canvas-prop-field">
            <label htmlFor="elem-prop-cond" className="canvas-prop-field__label">
              <GitBranch size={12} className="canvas-prop-field__icon" />
              <span>{isSequenceFlow ? 'Kondisi Alur (Condition)' : 'Kondisi Gateway'}</span>
            </label>
            <input
              id="elem-prop-cond"
              type="text"
              className="canvas-prop-field__input"
              value={element.condition || element.name || ''}
              onChange={(e) => {
                onChangeProperty('condition', e.target.value);
                if (isSequenceFlow) {
                  onChangeProperty('name', e.target.value);
                }
              }}
              placeholder="Contoh: Disetujui, Ditolak, Nominal > 50jt"
            />
            <span className="canvas-prop-field__hint">
              Teks ini ditampilkan pada garis panah keluar dari gateway.
            </span>
          </div>
        )}

        {/* Connection Counts */}
        <div className="canvas-prop-drawer__connections">
          <div className="canvas-prop-drawer__conn-pill">
            <span className="canvas-prop-drawer__conn-label">Inbound:</span>
            <span className="canvas-prop-drawer__conn-val">{element.incomingCount || 0}</span>
          </div>
          <div className="canvas-prop-drawer__conn-pill">
            <span className="canvas-prop-drawer__conn-label">Outbound:</span>
            <span className="canvas-prop-drawer__conn-val">{element.outgoingCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="canvas-prop-drawer__footer">
        <button
          type="button"
          className="canvas-prop-drawer__delete-btn"
          onClick={() => onDeleteElement(element.id)}
          title="Hapus elemen ini dari diagram"
        >
          <Trash2 size={13} />
          <span>Hapus Elemen</span>
        </button>
      </div>
    </aside>
  );
}
