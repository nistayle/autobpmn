import React, { useEffect, useRef, useState, useMemo } from 'react';
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import {
  ZoomIn, ZoomOut, Maximize2, Download,
  Sparkles, Workflow, ScanLine, ChevronDown,
  FileCode2, FileJson, Image, Play, Pause, ChevronLeft,
  ChevronRight, X, Layers, Edit3, Undo2, Redo2,
  Check, AlertTriangle, ShieldCheck, ArrowLeft,
  Command, Sliders, FileText, CornerDownLeft
} from 'lucide-react';
import Keycap from './Keycap';
import CanvasPropertyDrawer from './CanvasPropertyDrawer';
import LoadingState from './LoadingState';
import { syncXmlToGraph, validateGraphLocally } from '../services/graphModel';
import { makeBpmnXml } from '../services/bpmnXml';

const FIRST_RUN_KEY = 'autobpmn-first-run-done';
const WorkframeJsonViewer = React.lazy(() => import('./WorkframeJsonViewer'));

export default function BpmnViewer({
  xml,
  processName = '',
  onTrySample,
  onSelectElement,
  intermediateGraph = null,
  highlightedNodeId = null,
  isWalkthroughActive = false,
  onToggleWalkthrough,
  onGraphUpdate,
  onFocusSidebar,
}) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const onSelectRef = useRef(onSelectElement);
  onSelectRef.current = onSelectElement;
  const importIdRef = useRef(0);
  const isDestroyedRef = useRef(false);

  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'json'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [firstRun, setFirstRun] = useState(() => !localStorage.getItem(FIRST_RUN_KEY));
  const [showNudge, setShowNudge] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const prevXml = useRef(null);

  // Visual Editor State
  const [isEditMode, setIsEditMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeDrawerElement, setActiveDrawerElement] = useState(null);
  const [editValidation, setEditValidation] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [BpmnModelerClass, setBpmnModelerClass] = useState(null);
  const [draftGraph, setDraftGraph] = useState(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const draftGraphRef = useRef(draftGraph);
  draftGraphRef.current = draftGraph;

  // Walkthrough state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const prevStepMarkerRef = useRef(null);

  // Extract sequential process nodes for step-through
  const walkthroughNodes = useMemo(() => {
    if (intermediateGraph?.nodes?.length) {
      return intermediateGraph.nodes;
    }
    return [];
  }, [intermediateGraph]);

  const currentNode = walkthroughNodes[currentStepIndex] || null;

  // Setup either Viewer or Modeler depending on isEditMode
  useEffect(() => {
    if (!containerRef.current || (isEditMode && !BpmnModelerClass)) return;

    // Destroy existing instance cleanly
    if (instanceRef.current) {
      try {
        instanceRef.current.destroy();
      } catch (e) {
        console.warn('Instance destroy error:', e);
      }
      instanceRef.current = null;
    }

    let instance = null;

    if (isEditMode) {
      // Modeler mode with palette, context pad, and direct editing
      instance = new BpmnModelerClass({ container: containerRef.current });
      instanceRef.current = instance;

      const commandStack = instance.get('commandStack');

      const handleCommandStackChange = async () => {
        setCanUndo(commandStack.canUndo());
        setCanRedo(commandStack.canRedo());

        // Real-time structural validation during edit
        try {
          const { xml: currXml } = await instance.saveXML({ format: false });
          const currentGraph = syncXmlToGraph(currXml, draftGraphRef.current || intermediateGraph);
          setDraftGraph(currentGraph);
          if (viewModeRef.current === 'visual') {
            setJsonDraft(JSON.stringify(currentGraph, null, 2));
          }
          const val = validateGraphLocally(currentGraph);
          setEditValidation(val);
        } catch (e) {}
      };

      instance.on('commandStack.changed', handleCommandStackChange);

      const handleSelectionChange = (e) => {
        const selection = e.newSelection || [];
        if (!selection.length) {
          setActiveDrawerElement(null);
          return;
        }

        const el = selection[0];
        if (!el || el.type === 'bpmn:Process' || el.id?.startsWith('Process_')) {
          setActiveDrawerElement(null);
          return;
        }

        // Extract condition from sequence flow or name
        let condition = '';
        if (el.businessObject?.name) {
          condition = el.businessObject.name;
        }

        let actor = el.businessObject?.actor || '';
        if (!actor) {
          const docText = el.businessObject?.documentation?.[0]?.text || '';
          const match = docText.match(/actor:\s*([^;\n]+)/i);
          if (match) actor = match[1].trim();
        }

        setActiveDrawerElement({
          id: el.id,
          type: el.type ? el.type.replace('bpmn:', '') : 'Element',
          rawType: el.type,
          name: el.businessObject?.name || el.id,
          actor,
          condition,
          incomingCount: el.incoming?.length || 0,
          outgoingCount: el.outgoing?.length || 0,
        });
      };

      instance.on('selection.changed', handleSelectionChange);
    } else {
      // Clean NavigatedViewer mode for calm reading and presentation
      instance = new BpmnNavigatedViewer({ container: containerRef.current });
      instanceRef.current = instance;

      const handleElementClick = (e) => {
        const el = e.element;
        if (!el || el.type === 'bpmn:Process' || el.id.startsWith('Process_')) {
          if (onSelectRef.current) onSelectRef.current(null);
          return;
        }
        if (onSelectRef.current) {
          onSelectRef.current({
            id: el.id,
            type: el.type ? el.type.replace('bpmn:', '') : 'Element',
            rawType: el.type,
            name: el.businessObject?.name || el.id,
            actor: el.businessObject?.actor || '',
            incomingCount: el.incoming?.length || 0,
            outgoingCount: el.outgoing?.length || 0,
            documentation: el.businessObject?.documentation?.[0]?.text || '',
          });
        }
      };

      instance.on('element.click', handleElementClick);
    }

    isDestroyedRef.current = false;

    return () => {
      isDestroyedRef.current = true;
      if (instance) {
        try {
          instance.destroy();
        } catch (e) {}
      }
    };
  }, [isEditMode, BpmnModelerClass]);

  // Single controlled effect to import XML into the active instance
  useEffect(() => {
    if (!instanceRef.current || !xml) return;

    const currentImportId = ++importIdRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await instanceRef.current.importXML(xml);
        if (importIdRef.current !== currentImportId || isDestroyedRef.current) return;

        try {
          instanceRef.current.get('canvas').zoom('fit-viewport');
        } catch (e) {}

        if (isEditMode) {
          const draftGraph = syncXmlToGraph(xml, intermediateGraph);
          setEditValidation(validateGraphLocally(draftGraph));
        }

        if (xml !== prevXml.current) {
          if (firstRun) {
            localStorage.setItem(FIRST_RUN_KEY, '1');
            setFirstRun(false);
          }
          setShowNudge(true);
        }
        prevXml.current = xml;
      } catch (err) {
        if (importIdRef.current !== currentImportId || isDestroyedRef.current) return;
        setError(err.message || 'Gagal merender diagram BPMN.');
      } finally {
        if (importIdRef.current === currentImportId && !isDestroyedRef.current) {
          setLoading(false);
          if (isEditMode) setIsLoadingEditor(false);
        }
      }
    })();
  }, [xml, isEditMode]);

  // Handle external node highlight (Bidirectional Traceability)
  useEffect(() => {
    if (!instanceRef.current || !highlightedNodeId) return;
    try {
      const canvas = instanceRef.current.get('canvas');
      const elementRegistry = instanceRef.current.get('elementRegistry');
      const el = elementRegistry.get(highlightedNodeId);
      if (el) {
        canvas.scrollToElement(el);
        canvas.addMarker(highlightedNodeId, 'bpmn-node-pulse');
        const timer = setTimeout(() => {
          try {
            canvas.removeMarker(highlightedNodeId, 'bpmn-node-pulse');
          } catch (e) {}
        }, 3200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Highlight node error:', e);
    }
  }, [highlightedNodeId]);

  // Handle Walkthrough active step changes
  useEffect(() => {
    if (!isWalkthroughActive || !instanceRef.current || !walkthroughNodes.length) {
      if (prevStepMarkerRef.current && instanceRef.current) {
        try {
          instanceRef.current.get('canvas').removeMarker(prevStepMarkerRef.current, 'bpmn-node-walkthrough-active');
        } catch (e) {}
        prevStepMarkerRef.current = null;
      }
      return;
    }

    const node = walkthroughNodes[currentStepIndex];
    if (!node) return;

    try {
      const canvas = instanceRef.current.get('canvas');
      const elementRegistry = instanceRef.current.get('elementRegistry');

      if (prevStepMarkerRef.current) {
        canvas.removeMarker(prevStepMarkerRef.current, 'bpmn-node-walkthrough-active');
      }

      const el = elementRegistry.get(node.id);
      if (el) {
        canvas.scrollToElement(el);
        canvas.addMarker(node.id, 'bpmn-node-walkthrough-active');
        prevStepMarkerRef.current = node.id;
      }

      if (onSelectRef.current) {
        onSelectRef.current({
          id: node.id,
          type: node.type || 'Element',
          name: node.name || node.id,
          actor: node.actor || '',
        });
      }
    } catch (err) {
      console.warn('Walkthrough step error:', err);
    }
  }, [isWalkthroughActive, currentStepIndex, walkthroughNodes]);

  // Walkthrough Auto-Play interval
  useEffect(() => {
    if (!isWalkthroughActive || !isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= walkthroughNodes.length - 1) {
          setIsAutoPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isWalkthroughActive, isAutoPlaying, walkthroughNodes.length]);

  const handleNextStep = () => {
    if (currentStepIndex < walkthroughNodes.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const zoom = (step) => {
    if (!instanceRef.current) return;
    const c = instanceRef.current.get('canvas');
    c.zoom(c.zoom() + step);
  };

  const fitView = () => instanceRef.current?.get('canvas').zoom('fit-viewport');

  const downloadXml = async () => {
    if (!instanceRef.current) return;
    const { xml: out } = await instanceRef.current.saveXML({ format: true });
    downloadBlob(out, 'application/xml', `${slugify(processName)}.bpmn`);
  };

  const downloadJson = () => {
    let graph = intermediateGraph;
    if (isEditMode) {
      try {
        graph = JSON.parse(jsonDraft);
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
          throw new Error('JSON harus memiliki properti nodes dan edges berupa array.');
        }
      } catch (err) {
        setJsonError(err.message);
        return;
      }
    } else if (!intermediateGraph) {
      return;
    }
    const jsonStr = JSON.stringify(graph, null, 2);
    downloadBlob(jsonStr, 'application/json', `${slugify(processName)}.json`);
  };

  const downloadSvg = async () => {
    if (!instanceRef.current) return;
    const { svg } = await instanceRef.current.saveSVG();
    downloadBlob(svg, 'image/svg+xml', `${slugify(processName)}.svg`);
  };

  // Listen to autobpmn-export custom event (triggered from Command Palette or external actions)
  useEffect(() => {
    const handleCustomExport = (e) => {
      const format = e.detail?.format;
      if (format === 'bpmn') downloadXml();
      else if (format === 'svg') downloadSvg();
      else if (format === 'json') downloadJson();
    };
    window.addEventListener('autobpmn-export', handleCustomExport);
    return () => window.removeEventListener('autobpmn-export', handleCustomExport);
  }, [xml, processName, intermediateGraph]);

  // Edit Mode Actions
  const handleStartEdit = async () => {
    if (!xml || isLoadingEditor) return;
    setIsLoadingEditor(true);
    setError(null);
    if (isWalkthroughActive && onToggleWalkthrough) {
      onToggleWalkthrough(false);
    }
    try {
      const { default: Modeler } = await import('bpmn-js/lib/Modeler');
      setBpmnModelerClass(() => Modeler);
      setDraftGraph(intermediateGraph);
      setJsonDraft(intermediateGraph ? JSON.stringify(intermediateGraph, null, 2) : '{}');
      setJsonError(null);
      setIsEditMode(true);
    } catch (err) {
      console.error('Load BPMN editor error:', err);
      setError(err.message || 'Gagal memuat editor BPMN.');
      setIsLoadingEditor(false);
    }
  };

  const handleCancelEdit = () => {
    setActiveDrawerElement(null);
    setDraftGraph(null);
    setJsonDraft('');
    setJsonError(null);
    setIsEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!isEditMode) return;
    setIsSaving(true);
    try {
      let newGraph;
      let newXml;
      if (viewMode === 'json') {
        newGraph = JSON.parse(jsonDraft);
        if (!newGraph || !Array.isArray(newGraph.nodes) || !Array.isArray(newGraph.edges)) {
          throw new Error('JSON harus memiliki properti nodes dan edges berupa array.');
        }
        newXml = makeBpmnXml(newGraph);
      } else {
        if (!instanceRef.current) return;
        const result = await instanceRef.current.saveXML({ format: true });
        newXml = result.xml;
        newGraph = syncXmlToGraph(newXml, draftGraph || intermediateGraph);
      }
      const val = validateGraphLocally(newGraph);

      if (onGraphUpdate) {
        onGraphUpdate({
          graph: newGraph,
          bpmnXml: newXml,
          validation: val,
        });
      }

      setActiveDrawerElement(null);
      setDraftGraph(null);
      setJsonDraft('');
      setJsonError(null);
      setIsEditMode(false);
    } catch (err) {
      console.error('Save edit error:', err);
      setError(err.message || 'Gagal menyimpan perubahan visual.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = () => {
    if (instanceRef.current && isEditMode) {
      try {
        instanceRef.current.get('commandStack').undo();
      } catch (e) {}
    }
  };

  const handleRedo = () => {
    if (instanceRef.current && isEditMode) {
      try {
        instanceRef.current.get('commandStack').redo();
      } catch (e) {}
    }
  };

  const handleJsonTextChange = (text) => {
    setJsonDraft(text);
    try {
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error('JSON harus memiliki properti nodes dan edges berupa array.');
      }
      setDraftGraph(parsed);
      setEditValidation(validateGraphLocally(parsed));
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleViewModeChange = async (nextMode) => {
    if (nextMode === viewMode) return;

    if (nextMode === 'json' && isEditMode && viewMode === 'visual') {
      try {
        const { xml: currentXml } = await instanceRef.current.saveXML({ format: false });
        const currentGraph = syncXmlToGraph(currentXml, draftGraph || intermediateGraph);
        setDraftGraph(currentGraph);
        setJsonDraft(JSON.stringify(currentGraph, null, 2));
        setJsonError(null);
      } catch (err) {
        setError(err.message || 'Gagal menyiapkan JSON untuk diedit.');
        return;
      }
    }

    if (nextMode === 'visual' && isEditMode && viewMode === 'json') {
      let graph;
      try {
        graph = JSON.parse(jsonDraft);
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
          throw new Error('JSON harus memiliki properti nodes dan edges berupa array.');
        }
      } catch (err) {
        setJsonError(err.message);
        return;
      }

      if (!instanceRef.current) return;
      setLoading(true);
      try {
        await instanceRef.current.importXML(makeBpmnXml(graph));
        setDraftGraph(graph);
        setEditValidation(validateGraphLocally(graph));
        setLoading(false);
      } catch (err) {
        setLoading(false);
        setJsonError(err.message || 'JSON tidak dapat ditampilkan sebagai diagram BPMN.');
        return;
      }
    }

    setViewMode(nextMode);
  };

  const handlePropertyChange = (propName, propValue) => {
    if (!instanceRef.current || !activeDrawerElement) return;
    try {
      const elementRegistry = instanceRef.current.get('elementRegistry');
      const modeling = instanceRef.current.get('modeling');
      const el = elementRegistry.get(activeDrawerElement.id);
      if (!el) return;

      if (propName === 'name' || propName === 'condition') {
        modeling.updateProperties(el, { name: propValue });
      } else if (propName === 'actor') {
        const bpmnFactory = instanceRef.current.get('bpmnFactory');
        const doc = bpmnFactory.create('bpmn:Documentation', { text: `actor: ${propValue}` });
        modeling.updateProperties(el, { documentation: [doc] });
      }

      setActiveDrawerElement((prev) => (prev ? { ...prev, [propName]: propValue } : null));
    } catch (e) {
      console.warn('Property update error:', e);
    }
  };

  const handleDeleteActiveElement = (elemId) => {
    if (!instanceRef.current || !elemId) return;
    try {
      const elementRegistry = instanceRef.current.get('elementRegistry');
      const modeling = instanceRef.current.get('modeling');
      const el = elementRegistry.get(elemId);
      if (el) {
        modeling.removeElements([el]);
        setActiveDrawerElement(null);
      }
    } catch (e) {
      console.warn('Delete element error:', e);
    }
  };

  // Keyboard shortcuts for canvas actions
  useEffect(() => {
    const handleCanvasKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      // Edit Mode Shortcuts
      if (isEditMode) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
          e.preventDefault();
          handleRedo();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          handleSaveEdit();
          return;
        }
        if (e.key === 'Escape') {
          if (activeDrawerElement) {
            e.preventDefault();
            setActiveDrawerElement(null);
          }
          return;
        }
      }

      // Enter edit mode hotkey: E
      if (!isEditMode && xml && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        handleStartEdit();
        return;
      }

      // Walkthrough navigation shortcuts
      if (isWalkthroughActive) {
        if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
          e.preventDefault();
          handleNextStep();
          return;
        }
        if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
          e.preventDefault();
          handlePrevStep();
          return;
        }
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          setIsAutoPlaying((prev) => !prev);
          return;
        }
        if (e.key === 'Escape' || e.code === 'Escape') {
          e.preventDefault();
          if (onToggleWalkthrough) onToggleWalkthrough(false);
          return;
        }
      }

      if (e.key === '+' || e.key === '=') zoom(0.2);
      if (e.key === '-' || e.key === '_') zoom(-0.2);
      if (e.key === '0') fitView();

      if (
        (e.key === 'w' || e.key === 'W') &&
        walkthroughNodes.length > 0 &&
        onToggleWalkthrough &&
        !isEditMode
      ) {
        e.preventDefault();
        onToggleWalkthrough(!isWalkthroughActive);
        return;
      }

      if (
        e.altKey &&
        (e.key === 'b' || e.key === 'B' || e.code === 'KeyB') &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        if (xml) {
          e.preventDefault();
          downloadXml();
        }
      }
    };

    window.addEventListener('keydown', handleCanvasKeyDown, true);
    return () => window.removeEventListener('keydown', handleCanvasKeyDown, true);
  }, [
    xml,
    processName,
    isWalkthroughActive,
    currentStepIndex,
    walkthroughNodes.length,
    onToggleWalkthrough,
    isEditMode,
    activeDrawerElement,
    canUndo,
    canRedo,
  ]);

  // Handle click outside to close export dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  return (
    <>
      {/* ── Dynamic Toolbar ── */}
      <div className="canvas-toolbar">
        <div className="canvas-toolbar__left">
          {/* Segmented View Mode Toggle: Visual vs JSON */}
          <div className="canvas-view-toggle" role="group" aria-label="Mode Tampilan Workframe">
            <button
              type="button"
              className={`canvas-view-toggle__btn ${viewMode === 'visual' ? 'canvas-view-toggle__btn--active' : ''}`}
              onClick={() => handleViewModeChange('visual')}
              title="Tampilkan diagram alur proses visual"
            >
              <Workflow size={13} />
              <span>Visual</span>
            </button>
            <button
              type="button"
              className={`canvas-view-toggle__btn ${viewMode === 'json' ? 'canvas-view-toggle__btn--active' : ''}`}
              onClick={() => handleViewModeChange('json')}
              title="Tampilkan model graf JSON terstruktur"
            >
              <FileJson size={13} />
              <span>JSON</span>
            </button>
          </div>

          {/* Edit Mode Badge & Controls */}
          {isEditMode ? (
            <div className="edit-mode-badge-group">
              <span className="edit-mode-badge">
                <Edit3 size={12} /> Mode Edit {viewMode === 'json' ? 'JSON' : 'Visual'}
              </span>

              {/* Undo / Redo */}
              {viewMode === 'visual' && <div className="toolbar-button-group">
                <button
                  type="button"
                  className="toolbar-btn toolbar-btn--icon"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Urungkan perubahan (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <Undo2 size={13} />
                </button>
                <button
                  type="button"
                  className="toolbar-btn toolbar-btn--icon"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Ulangi perubahan (Ctrl+Y)"
                  aria-label="Redo"
                >
                  <Redo2 size={13} />
                </button>
              </div>}

              {/* Structural Validation Chip */}
              {editValidation && (
                <span
                  className={`edit-validation-chip ${
                    editValidation.is_valid
                      ? 'edit-validation-chip--valid'
                      : 'edit-validation-chip--warning'
                  }`}
                  title={
                    editValidation.issues?.length
                      ? editValidation.issues.join('\n')
                      : 'Kaidah struktural BPMN terpenuhi'
                  }
                >
                  {editValidation.is_valid ? (
                    <>
                      <Check size={11} /> BPMN Valid
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={11} /> {editValidation.issues.length} Peringatan
                    </>
                  )}
                </span>
              )}
            </div>
          ) : (
            walkthroughNodes.length > 0 && (
              <button
                type="button"
                className={`toolbar-btn toolbar-btn--walkthrough${
                  isWalkthroughActive ? ' toolbar-btn--active' : ''
                }`}
                onClick={() => onToggleWalkthrough && onToggleWalkthrough(!isWalkthroughActive)}
                title="Simulasi alur proses langkah demi langkah (Hot-key: W)"
                aria-label="Simulasi alur proses"
              >
                <Play size={13} fill={isWalkthroughActive ? 'currentColor' : 'none'} />
                <span>{isWalkthroughActive ? 'Berhenti' : 'Simulasi Alur'}</span>
              </button>
            )
          )}
        </div>

        <div className="canvas-toolbar__right">
          {isEditMode ? (
            <div className="edit-mode-actions">
              <button
                type="button"
                className="toolbar-btn"
                onClick={handleCancelEdit}
                disabled={isSaving}
                title="Batalkan perubahan dan keluar dari mode edit"
              >
                Batal
              </button>
              <button
                type="button"
                className="toolbar-btn toolbar-btn--primary"
                onClick={handleSaveEdit}
                disabled={isSaving}
                title="Simpan perubahan JSON atau diagram ke model (Ctrl+S)"
              >
                <Check size={13} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Visual Mode Specific Tools */}
              {viewMode === 'visual' && (
                <>
                  {/* Edit Diagram Button */}
                  {xml && (
                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn--edit"
                      onClick={handleStartEdit}
                      disabled={isLoadingEditor}
                      title="Ubah diagram secara visual dengan drag-and-drop (Hot-key: E)"
                      aria-label="Edit Diagram"
                    >
                      <Edit3 size={13} />
                      <span>{isLoadingEditor ? 'Memuat editor...' : 'Edit Diagram'}</span>
                    </button>
                  )}

                  <div className="toolbar-button-group">
                    <button
                      className="toolbar-btn toolbar-btn--icon"
                      onClick={() => zoom(0.2)}
                      title="Perbesar diagram (Hot-key: +)"
                      aria-label="Perbesar tampilan"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      className="toolbar-btn toolbar-btn--icon"
                      onClick={() => zoom(-0.2)}
                      title="Perkecil diagram (Hot-key: -)"
                      aria-label="Perkecil tampilan"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      className="toolbar-btn toolbar-btn--icon"
                      onClick={fitView}
                      title="Sesuaikan diagram ke layar penuh (Hot-key: 0)"
                      aria-label="Sesuaikan ke layar"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>

                  <span className="toolbar-sep" />
                </>
              )}

              {/* Unified Export Dropdown (Tersedia baik di mode Visual maupun JSON) */}
              <div className="toolbar-dropdown" ref={exportDropdownRef}>
                <button
                  className={`toolbar-btn toolbar-btn--primary${exportOpen ? ' toolbar-btn--active' : ''}`}
                  onClick={() => setExportOpen((prev) => !prev)}
                  disabled={!xml && !intermediateGraph}
                  title="Unduh diagram alur proses (.bpmn, .json, atau .svg)"
                  aria-label="Ekspor diagram proses"
                  aria-expanded={exportOpen}
                  aria-haspopup="true"
                >
                  <Download size={13} />
                  <span>Ekspor</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transition: 'transform 0.15s ease',
                      transform: exportOpen ? 'rotate(180deg)' : 'none',
                      marginLeft: 1,
                    }}
                  />
                </button>

                {exportOpen && (
                  <div className="toolbar-dropdown__menu" role="menu">
                    <button
                      type="button"
                      className="toolbar-dropdown__item"
                      role="menuitem"
                      onClick={() => {
                        downloadXml();
                        setExportOpen(false);
                      }}
                      title="Unduh berkas model standar BPMN 2.0 XML (Alt+B)"
                    >
                      <span className="toolbar-dropdown__item-left">
                        <FileCode2 className="toolbar-dropdown__item-icon" />
                        <span>Format BPMN 2.0 (.bpmn)</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-dropdown__item"
                      role="menuitem"
                      onClick={() => {
                        downloadJson();
                        setExportOpen(false);
                      }}
                      title="Unduh model graf terstruktur AutoBPMN JSON"
                    >
                      <span className="toolbar-dropdown__item-left">
                        <FileJson className="toolbar-dropdown__item-icon" />
                        <span>Model AutoBPMN JSON (.json)</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-dropdown__item"
                      role="menuitem"
                      onClick={() => {
                        downloadSvg();
                        setExportOpen(false);
                      }}
                      title="Unduh gambar vektor berkualitas tinggi (.svg)"
                    >
                      <span className="toolbar-dropdown__item-left">
                        <Image className="toolbar-dropdown__item-icon" />
                        <span>Vektor Grafis (.svg)</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Canvas / Workframe Area ── */}
      <div className={`canvas-container ${isEditMode ? 'canvas-container--editing' : ''} ${viewMode === 'json' ? 'canvas-container--json' : ''}`}>
        {/* BPMN Canvas Container (kept alive in DOM, hidden when viewing JSON) */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            display: viewMode === 'visual' ? 'block' : 'none',
          }}
        />

        {viewMode === 'json' && (
          <React.Suspense
            fallback={
              <LoadingState
                variant="workframe"
                label="Memuat tampilan JSON..."
                description="Menyiapkan editor model graf."
              />
            }
          >
            <WorkframeJsonViewer
              graphData={isEditMode ? draftGraph || intermediateGraph : intermediateGraph}
              processName={processName}
              onDownloadJson={downloadJson}
              editable={isEditMode}
              jsonText={jsonDraft}
              jsonError={jsonError}
              onJsonTextChange={handleJsonTextChange}
            />
          </React.Suspense>
        )}

        {/* Live Canvas Property Drawer (Shown in Edit Mode on Element Click) */}
        {isEditMode && (
          <CanvasPropertyDrawer
            element={activeDrawerElement}
            isOpen={!!activeDrawerElement}
            onClose={() => setActiveDrawerElement(null)}
            onChangeProperty={handlePropertyChange}
            onDeleteElement={handleDeleteActiveElement}
          />
        )}

        {(loading || isLoadingEditor) && viewMode === 'visual' && (
          <div className="canvas-overlay">
            <LoadingState
              variant="canvas"
              label={isLoadingEditor ? 'Menyiapkan editor BPMN...' : 'Memuat diagram...'}
            />
          </div>
        )}

        {/* Floating Walkthrough Player Bar */}
        {isWalkthroughActive && walkthroughNodes.length > 0 && !isEditMode && viewMode === 'visual' && (
          <div className="walkthrough-bar" role="region" aria-label="Kontrol Walkthrough Alur Proses">
            <div className="walkthrough-bar__badge">
              Langkah {currentStepIndex + 1} / {walkthroughNodes.length}
            </div>

            <div className="walkthrough-bar__info">
              <span className="walkthrough-bar__name">{currentNode?.name || currentNode?.id}</span>
              {currentNode?.actor && (
                <span className="walkthrough-bar__actor">({currentNode.actor})</span>
              )}
            </div>

            <div className="walkthrough-bar__actions">
              <button
                type="button"
                className="walkthrough-btn"
                onClick={handlePrevStep}
                disabled={currentStepIndex <= 0}
                title="Langkah sebelumnya (←)"
                aria-label="Langkah sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                className={`walkthrough-btn walkthrough-btn--play ${
                  isAutoPlaying ? 'walkthrough-btn--playing' : ''
                }`}
                onClick={() => setIsAutoPlaying((prev) => !prev)}
                title={isAutoPlaying ? 'Jeda simulasi otomatis (Space)' : 'Mulai simulasi otomatis (Space)'}
                aria-label={isAutoPlaying ? 'Jeda otomatis' : 'Mulai otomatis'}
              >
                {isAutoPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>

              <button
                type="button"
                className="walkthrough-btn"
                onClick={handleNextStep}
                disabled={currentStepIndex >= walkthroughNodes.length - 1}
                title="Langkah berikutnya (→)"
                aria-label="Langkah berikutnya"
              >
                <ChevronRight size={15} />
              </button>

              <span className="toolbar-sep" style={{ margin: '0 4px' }} />

              <button
                type="button"
                className="walkthrough-btn walkthrough-btn--close"
                onClick={() => onToggleWalkthrough && onToggleWalkthrough(false)}
                title="Selesai walkthrough (Esc)"
                aria-label="Tutup walkthrough"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {!xml && !loading && !error && viewMode === 'visual' && (
          <div className="empty-state">
            <div className="empty-state__hub">
              {/* Header: Notice & Action */}
              <div className="empty-state__header">
                <div className="empty-state__badge">
                  <Workflow size={13} className="empty-state__badge-icon" />
                  <span>Belum Ada BPMN Aktif</span>
                </div>
                <h2 className="empty-state__title">
                  Mulai Sintesis Alur Proses BPMN 2.0
                </h2>
                <p className="empty-state__desc">
                  Diagram proses pada berkas ini masih kosong. Tambahkan narasi dokumen SOP atau gunakan sampel untuk memulai analisis alur kerja secara instan.
                </p>

                {/* Primary CTA Buttons */}
                <div className="empty-state__actions">
                  <button
                    type="button"
                    className="empty-state__cta-focus"
                    onClick={onFocusSidebar}
                    title="Buka panel kiri dan fokus ke kotak teks SOP"
                  >
                    <ArrowLeft size={14} className="empty-state__arrow-left" />
                    <span>Tambahkan Sumber SOP Sekarang</span>
                  </button>

                  {onTrySample && (
                    <button
                      type="button"
                      className="empty-state__cta-sample"
                      onClick={onTrySample}
                      title="Sintesis contoh SOP Pengadaan secara cepat (Alt+S)"
                    >
                      <Sparkles size={14} />
                      <span>Coba Contoh SOP</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid: Feature Highlights & Keyboard Shortcuts */}
              <div className="empty-state__grid">
                {/* Kolom 1: Fitur Utama Studio */}
                <div className="empty-state__card">
                  <div className="empty-state__card-title">
                    <Sliders size={13} />
                    <span>Fitur Studio AutoBPMN</span>
                  </div>
                  <ul className="empty-state__list">
                    <li>
                      <strong>Sintesis Otomatis:</strong> Ekstraksi teks SOP menjadi graf BPMN 2.0 dengan layout Sugiyama rapi & collision-free.
                    </li>
                    <li>
                      <strong>Visual & JSON Workframe:</strong> Beralih seketika antara tinjauan visual diagram dan model graf JSON terstruktur.
                    </li>
                    <li>
                      <strong>Visual Modeler:</strong> Ubah langsung diagram via drag-and-drop node, koneksi flow, dan properti elemen.
                    </li>
                    <li>
                      <strong>Grounded AI Copilot:</strong> Verifikasi aturan bisnis dan sitasi teks SOP langkah demi langkah tanpa halusinasi.
                    </li>
                  </ul>
                </div>

                {/* Kolom 2: Pintasan Keyboard (Shortcuts) */}
                <div className="empty-state__card">
                  <div className="empty-state__card-title">
                    <Command size={13} />
                    <span>Pintasan Keyboard</span>
                  </div>
                  <div className="empty-state__shortcuts">
                    <div className="empty-state__shortcut-item">
                      <span className="empty-state__shortcut-desc">Command Palette</span>
                      <Keycap keys={['Ctrl', 'K']} />
                    </div>
                    <div className="empty-state__shortcut-item">
                      <span className="empty-state__shortcut-desc">Ekstrak Teks SOP</span>
                      <Keycap keys={['Ctrl', 'Enter']} />
                    </div>
                    <div className="empty-state__shortcut-item">
                      <span className="empty-state__shortcut-desc">Muat Contoh SOP</span>
                      <Keycap keys={['Alt', 'S']} />
                    </div>
                    <div className="empty-state__shortcut-item">
                      <span className="empty-state__shortcut-desc">Mode Edit Visual</span>
                      <Keycap keys={['E']} />
                    </div>
                    <div className="empty-state__shortcut-item">
                      <span className="empty-state__shortcut-desc">Simulasi Alur (Walkthrough)</span>
                      <Keycap keys={['W']} />
                    </div>
                    <div className="empty-state__shortcut-item">
                      <span className="empty-state__shortcut-desc">Tutup Tab / Simpan Ekspor</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Keycap keys={['Ctrl', 'W']} />
                        <Keycap keys={['Ctrl', 'S']} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="canvas-error" role="alert">
            <svg
              style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </>
  );
}

function slugify(s) {
  return (s || 'process').replace(/\s+/g, '_').toLowerCase();
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
