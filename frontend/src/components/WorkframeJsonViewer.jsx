import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Copy, Check, Download, FileJson, Layers, GitBranch, Users } from 'lucide-react';

/**
 * WorkframeJsonViewer
 * Tampilan model graf JSON terstruktur pada area kerja utama (canvas workframe).
 * Dilengkapi nomor baris, statistik graf, tombol salin, dan unduh.
 */
export default function WorkframeJsonViewer({
  graphData,
  processName = 'process',
  onDownloadJson,
  editable = false,
  jsonText,
  jsonError = null,
  onJsonTextChange,
  hidden = false,
}) {
  const [copied, setCopied] = useState(false);
  const lineNumbersRef = useRef(null);

  const jsonString = useMemo(() => {
    return graphData ? JSON.stringify(graphData, null, 2) : '{\n  "message": "Belum ada data graf proses."\n}';
  }, [graphData]);

  const displayedJson = editable ? jsonText : jsonString;
  const lines = useMemo(() => {
    return displayedJson.split('\n');
  }, [displayedJson]);

  useEffect(() => {
    if (!copied) return undefined;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const stats = useMemo(() => {
    if (!graphData) return { nodes: 0, edges: 0, actors: 0 };
    const nodes = graphData.nodes?.length || 0;
    const edges = graphData.edges?.length || 0;
    const actors = Array.isArray(graphData.actors)
      ? graphData.actors.length
      : new Set((graphData.nodes || []).map((n) => n.actor).filter(Boolean)).size;
    return { nodes, edges, actors };
  }, [graphData]);

  const handleCopy = () => {
    if (!graphData) return;
    navigator.clipboard.writeText(displayedJson);
    setCopied(true);
  };

  const handleEditorScroll = (event) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const handleEditorChange = (event) => {
    onJsonTextChange?.(event.currentTarget.value);
  };

  return (
    <div
      className="workframe-json"
      role="region"
      aria-label={editable ? 'Editor Model Graf JSON' : 'Model Graf JSON'}
      style={{ display: hidden ? 'none' : 'flex' }}
    >
      {/* ── Subheader / Meta Info Bar ── */}
      <div className="workframe-json__header">
        <div className="workframe-json__meta">
          <span className="workframe-json__badge">
            <FileJson size={12} /> AutoBPMNGraph v2
          </span>
          <span className="workframe-json__sep">•</span>
          <span className="workframe-json__stat">
            <Layers size={12} className="workframe-json__stat-icon" />
            <span>{stats.nodes} Nodes</span>
          </span>
          <span className="workframe-json__stat">
            <GitBranch size={12} className="workframe-json__stat-icon" />
            <span>{stats.edges} Flows</span>
          </span>
          <span className="workframe-json__stat">
            <Users size={12} className="workframe-json__stat-icon" />
            <span>{stats.actors} Roles</span>
          </span>
        </div>

        <div className="workframe-json__actions">
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleCopy}
            disabled={!graphData}
            title="Salin seluruh isi JSON ke clipboard"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-600" />
                <span className="text-emerald-700 font-medium">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Salin JSON</span>
              </>
            )}
          </button>

          {onDownloadJson && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={onDownloadJson}
              disabled={!graphData}
              title="Unduh berkas model JSON"
            >
              <Download size={12} />
              <span>Unduh .json</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Code Display with Line Numbers ── */}
      <div className={`workframe-json__body${editable ? ' workframe-json__body--editable' : ''}`}>
        {editable ? (
          <>
            <div className="workframe-json__lines" ref={lineNumbersRef} aria-hidden="true">
              {lines.map((_, i) => (
                <div key={i} className="workframe-json__line-no">{i + 1}</div>
              ))}
            </div>
            <textarea
              className="workframe-json__editor"
              value={displayedJson}
              onChange={handleEditorChange}
              onScroll={handleEditorScroll}
              spellCheck={false}
              aria-label={`Edit JSON ${processName}`}
              aria-invalid={Boolean(jsonError)}
              aria-describedby={jsonError ? 'workframe-json-error' : undefined}
              wrap="off"
            />
          </>
        ) : (
          <>
            <div className="workframe-json__lines" aria-hidden="true">
              {lines.map((_, i) => (
                <div key={i} className="workframe-json__line-no">{i + 1}</div>
              ))}
            </div>
            <div className="workframe-json__code-wrap">
              <pre className="workframe-json__code">
                <code>
                  {lines.map((line, i) => (
                    <div key={i} className="workframe-json__code-row">
                      {colorizeJsonLine(line)}
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          </>
        )}
      </div>
      {editable && jsonError && (
        <div className="workframe-json__error" id="workframe-json-error" role="alert">
          JSON tidak valid: {jsonError}
        </div>
      )}
    </div>
  );
}

/**
 * Syntax colorizer ringan untuk baris JSON
 */
function colorizeJsonLine(line) {
  // Key: "key":
  const keyRegex = /^(\s*)"([^"]+)":\s*(.*)$/;
  const match = line.match(keyRegex);

  if (match) {
    const [, indent, key, rest] = match;
    return (
      <>
        <span>{indent}</span>
        <span className="json-token-key">"{key}"</span>
        <span>: </span>
        {renderJsonValue(rest)}
      </>
    );
  }

  // Value only (e.g. array items or brackets)
  return renderJsonValue(line);
}

function renderJsonValue(valStr) {
  const trimmed = valStr.trim();

  // Strings: "..."
  if (trimmed.startsWith('"') && (trimmed.endsWith('"') || trimmed.endsWith('",'))) {
    const hasComma = trimmed.endsWith(',');
    const text = hasComma ? trimmed.slice(0, -1) : trimmed;
    return (
      <>
        <span className="json-token-string">{text}</span>
        {hasComma && <span>,</span>}
      </>
    );
  }

  // Booleans
  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'true,' || trimmed === 'false,') {
    return <span className="json-token-bool">{valStr}</span>;
  }

  // Null
  if (trimmed === 'null' || trimmed === 'null,') {
    return <span className="json-token-null">{valStr}</span>;
  }

  // Numbers
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?,?$/i.test(trimmed)) {
    return <span className="json-token-number">{valStr}</span>;
  }

  return <span>{valStr}</span>;
}
