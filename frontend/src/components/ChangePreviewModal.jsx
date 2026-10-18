import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import {
  CheckCircle2, AlertTriangle, X, ZoomIn, ZoomOut, Maximize2, GitCompareArrows,
  ArrowRight, ChevronDown, Link2, Unlink2
} from 'lucide-react';
import Keycap from './Keycap';
import { makeBpmnXml } from '../services/bpmnXml';

function syncViewboxes(controller, sourceSide) {
  if (!controller.enabled || controller.syncing) return;
  const source = controller.viewers[sourceSide];
  const target = controller.viewers[sourceSide === 'before' ? 'after' : 'before'];
  if (!source?.ready || !target?.ready) return;

  const sourceCanvas = source.viewer.get('canvas');
  const targetCanvas = target.viewer.get('canvas');
  const viewbox = sourceCanvas.viewbox();
  const targetSize = targetCanvas.viewbox().outer;
  const centerX = viewbox.x + viewbox.width / 2;
  const centerY = viewbox.y + viewbox.height / 2;
  const width = targetSize.width / viewbox.scale;
  const height = targetSize.height / viewbox.scale;
  controller.syncing = true;
  try {
    targetCanvas.viewbox({
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    });
  } finally {
    requestAnimationFrame(() => {
      controller.syncing = false;
    });
  }
}

function BpmnDiffPane({ title, xml, side, changes, processName, syncController }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const requestIdRef = useRef(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const viewer = new BpmnNavigatedViewer({ container: containerRef.current });
    viewerRef.current = viewer;
    syncController.viewers[side] = { viewer, ready: false };
    const eventBus = viewer.get('eventBus');
    const onViewboxChanged = () => {
      if (syncController.syncing) return;
      syncController.lastActiveSide = side;
      syncViewboxes(syncController, side);
    };
    eventBus.on('canvas.viewbox.changed', onViewboxChanged);
    return () => {
      requestIdRef.current += 1;
      eventBus.off('canvas.viewbox.changed', onViewboxChanged);
      if (syncController.viewers[side]?.viewer === viewer) {
        delete syncController.viewers[side];
      }
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [side, syncController]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !xml) return;
    const requestId = ++requestIdRef.current;
    setError('');

    viewer.importXML(xml).then(() => {
      if (requestId !== requestIdRef.current) return;
      const canvas = viewer.get('canvas');
      const registry = viewer.get('elementRegistry');
      canvas.zoom('fit-viewport');
      if (syncController.viewers[side]?.viewer === viewer) {
        syncController.viewers[side].ready = true;
        syncViewboxes(syncController, syncController.lastActiveSide);
      }

      const markers = [
        ...(changes.addedNodes || []).map((id) => [id, 'bpmn-diff-added']),
        ...(changes.removedNodes || []).map((id) => [id, 'bpmn-diff-removed']),
        ...(changes.updatedNodes || []).map((id) => [id, 'bpmn-diff-updated']),
      ];
      markers.forEach(([id, marker]) => {
        if ((marker === 'bpmn-diff-added' && side !== 'after') ||
            (marker === 'bpmn-diff-removed' && side !== 'before')) return;
        if (registry.get(id)) canvas.addMarker(id, marker);
      });

      const edgeChanges = [
        ...(changes.addedEdges || []).map((edge) => ({ ...edge, marker: 'bpmn-diff-added' })),
        ...(changes.removedEdges || []).map((edge) => ({ ...edge, marker: 'bpmn-diff-removed' })),
        ...(changes.updatedEdges || []).map((edge) => ({ ...edge, marker: 'bpmn-diff-updated' })),
      ];
      registry.filter((element) => element.type === 'bpmn:SequenceFlow').forEach((element) => {
        const sourceId = element.businessObject.sourceRef?.id;
        const targetId = element.businessObject.targetRef?.id;
        const change = edgeChanges.find((edge) =>
          edge.from_node === sourceId && edge.to_node === targetId
        );
        if (change && (
          (change.marker === 'bpmn-diff-added' && side === 'after') ||
          (change.marker === 'bpmn-diff-removed' && side === 'before') ||
          change.marker === 'bpmn-diff-updated'
        )) {
          canvas.addMarker(element.id, change.marker);
        }
      });
    }).catch((importError) => {
      if (requestId === requestIdRef.current) {
        setError(importError.message || 'Diagram BPMN tidak dapat ditampilkan.');
      }
    });
  }, [xml, side, changes, syncController]);

  const zoom = (factor) => {
    const canvas = viewerRef.current?.get('canvas');
    if (canvas) canvas.zoom(canvas.zoom() * factor);
  };

  return (
    <section className={`bpmn-diff-pane bpmn-diff-pane--${side}`}>
      <header className="bpmn-diff-pane__header">
        <div className="bpmn-diff-pane__title">
          <span className={`bpmn-diff-pane__status bpmn-diff-pane__status--${side}`} />
          <div>
            <strong>{title}</strong>
            <small>{processName}</small>
          </div>
        </div>
        <div className="bpmn-diff-pane__controls">
          <button type="button" onClick={() => zoom(1.2)} title="Perbesar diagram" aria-label="Perbesar diagram">
            <ZoomIn size={15} />
          </button>
          <button type="button" onClick={() => zoom(0.8)} title="Perkecil diagram" aria-label="Perkecil diagram">
            <ZoomOut size={15} />
          </button>
          <button type="button" onClick={() => viewerRef.current?.get('canvas').zoom('fit-viewport')} title="Sesuaikan diagram" aria-label="Sesuaikan diagram">
            <Maximize2 size={14} />
          </button>
        </div>
      </header>
      <div className="bpmn-diff-pane__canvas-wrap">
        {error ? (
          <div className="bpmn-diff-pane__error" role="alert">{error}</div>
        ) : !xml ? (
          <div className="bpmn-diff-pane__error" role="status">Data diagram tidak tersedia.</div>
        ) : null}
        <div
          ref={containerRef}
          className="bpmn-diff-pane__canvas"
          aria-label={`Diagram BPMN ${title.toLowerCase()}`}
        />
      </div>
    </section>
  );
}

/**
 * ChangePreviewModal
 * Menampilkan preview perubahan (patch diff) sebelum diterapkan ke diagram utama.
 * Memungkinkan Business Analyst memvalidasi operasi yang diajukan AI atau editor.
 */
export default function ChangePreviewModal({
  isOpen,
  previewData, // { patch, is_valid, validation_issues, diff_summary, projected_graph, bpmn_xml }
  currentGraph,
  currentXml,
  processName = '',
  sourceText = '',
  onApply,
  onDiscard,
  isLoading = false,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDiscard();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (previewData?.is_valid && !isLoading) {
          e.preventDefault();
          onApply(previewData);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewData, isLoading, onApply, onDiscard]);

  const diffForMarkers = previewData?.diff_summary || {};
  const changes = useMemo(() => ({
    addedNodes: (diffForMarkers.added_nodes || []).map((node) => node.id),
    removedNodes: (diffForMarkers.removed_nodes || []).map((node) => node.id),
    updatedNodes: (diffForMarkers.modified_nodes || []).map((node) => node.node_id || node.id),
    addedEdges: diffForMarkers.added_edges || [],
    removedEdges: diffForMarkers.removed_edges || [],
    updatedEdges: diffForMarkers.modified_edges || [],
  }), [previewData]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const syncController = useMemo(() => ({
    enabled: true,
    syncing: false,
    lastActiveSide: 'before',
    viewers: {},
  }), []);
  syncController.enabled = syncEnabled;

  if (!isOpen || !previewData) return null;

  const { patch, is_valid, validation_issues = [], diff_summary = {} } = previewData;
  const {
    added_nodes = [],
    removed_nodes = [],
    updated_nodes = diff_summary.modified_nodes || [],
    added_edges = [],
    removed_edges = [],
  } = diff_summary;

  const beforeXml = currentXml || (currentGraph ? makeBpmnXml(currentGraph) : '');
  const afterXml = previewData.bpmn_xml || (
    previewData.projected_graph ? makeBpmnXml(previewData.projected_graph) : ''
  );

  return createPortal((
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onDiscard();
      }}
    >
      <div className="preview-modal">
        <div className="preview-modal__header">
          <div className="preview-modal__identity">
            <span className="preview-modal__identity-icon" aria-hidden="true">
              <GitCompareArrows size={19} />
            </span>
            <div className="preview-modal__title-group">
              <span className="preview-modal__eyebrow">PRATINJAU PERUBAHAN</span>
              <h2 id="preview-modal-title" className="preview-modal__title">Tinjau perubahan diagram</h2>
              <p className="preview-modal__subtitle">
                {processName || currentGraph?.process_name || 'Diagram BPMN'}
                {patch?.description ? ` · ${patch.description}` : ''}
              </p>
            </div>
          </div>
          <div className="preview-modal__header-actions">
            <span
              className={`preview-modal__review-status${is_valid ? ' preview-modal__review-status--valid' : ' preview-modal__review-status--invalid'}`}
              aria-label={is_valid ? 'Siap diterapkan' : 'Perlu ditinjau'}
              title={is_valid ? 'Siap diterapkan' : 'Perlu ditinjau'}
            >
              {is_valid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {is_valid ? 'Siap diterapkan' : 'Perlu ditinjau'}
            </span>
            <button
              type="button"
              className="preview-modal__close-btn"
              onClick={onDiscard}
              disabled={isLoading}
              aria-label="Tutup preview perubahan"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="preview-modal__content">
          <div className="preview-modal__change-summary">
            <span className="preview-modal__change-summary-label">Perubahan yang diajukan</span>
            <span className="preview-modal__change-count preview-modal__change-count--added">
              +{added_nodes.length} ditambahkan
            </span>
            {removed_nodes.length > 0 && (
              <span className="preview-modal__change-count preview-modal__change-count--removed">
                −{removed_nodes.length} dihapus
              </span>
            )}
            {updated_nodes.length > 0 && (
              <span className="preview-modal__change-count preview-modal__change-count--updated">
                {updated_nodes.length} diubah
              </span>
            )}
            <span className="preview-modal__change-summary-note">Belum diterapkan ke diagram</span>
          </div>
          {!is_valid && validation_issues.length > 0 && (
            <ul className="preview-modal__issues-list" role="alert">
              {validation_issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
            </ul>
          )}
          <div className="bpmn-split-diff" aria-label="Perbandingan visual diagram BPMN">
            <div className="bpmn-split-diff__toolbar">
              <button
                type="button"
                className={`bpmn-view-sync${syncEnabled ? ' bpmn-view-sync--active' : ''}`}
                aria-pressed={syncEnabled}
                onClick={() => {
                  const nextEnabled = !syncEnabled;
                  syncController.enabled = nextEnabled;
                  setSyncEnabled(nextEnabled);
                  if (nextEnabled) {
                    syncViewboxes(syncController, syncController.lastActiveSide);
                  }
                }}
              >
                {syncEnabled ? <Link2 size={14} /> : <Unlink2 size={14} />}
                <span>Sinkronkan tampilan</span>
                <span className="bpmn-view-sync__state">{syncEnabled ? 'Aktif' : 'Nonaktif'}</span>
              </button>
              <span className="bpmn-split-diff__toolbar-hint">
                {syncEnabled ? 'Zoom dan posisi kedua diagram bergerak bersama' : 'Setiap diagram dapat digeser dan di-zoom sendiri'}
              </span>
            </div>
            <BpmnDiffPane
              title="Sebelum"
              xml={beforeXml}
              side="before"
              processName={processName || currentGraph?.process_name || ''}
              changes={changes}
              syncController={syncController}
            />
            <div className="bpmn-split-diff__divider" aria-hidden="true">
              <ArrowRight size={16} />
            </div>
            <BpmnDiffPane
              title="Usulan perubahan"
              xml={afterXml}
              side="after"
              processName={processName || previewData.projected_graph?.process_name || ''}
              changes={changes}
              syncController={syncController}
            />
          </div>
          <div className="bpmn-diff-legend" aria-label="Legenda perubahan">
            <span><i className="bpmn-diff-legend__swatch bpmn-diff-legend__swatch--added" /> Ditambahkan</span>
            <span><i className="bpmn-diff-legend__swatch bpmn-diff-legend__swatch--removed" /> Dihapus</span>
            <span><i className="bpmn-diff-legend__swatch bpmn-diff-legend__swatch--updated" /> Diubah</span>
          </div>
          {(sourceText.trim() || patch?.rationale) && (
            <details className="extension-technical-details">
              <summary>
                Sumber & konteks usulan
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="extension-technical-details__body">
                {patch?.rationale && <p>{patch.rationale}</p>}
                {sourceText.trim() && <p>{sourceText.trim()}</p>}
              </div>
            </details>
          )}
        </div>

        {/* Footer Actions */}
        <div className="preview-modal__footer">
          <div className="preview-modal__footer-left">
            <span className="preview-modal__hotkey-hint">
              <Keycap>Esc</Keycap> Batalkan • <Keycap>Ctrl+Enter</Keycap> Terapkan
            </span>
          </div>

          <div className="preview-modal__footer-right">
            <button
              type="button"
              className="toolbar-btn"
              onClick={onDiscard}
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--primary"
              onClick={() => onApply(previewData)}
              disabled={!is_valid || isLoading}
              title={
                !is_valid
                  ? 'Patch tidak dapat diterapkan karena struktur tidak valid'
                  : 'Terapkan perubahan ke kanvas BPMN dan intermediate graph'
              }
            >
              <CheckCircle2 size={13} />
              <span>{isLoading ? 'Menerapkan...' : 'Terapkan tambahan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
