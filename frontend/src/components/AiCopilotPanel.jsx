import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, Square, RotateCcw, X,
  AlertTriangle, FileText, CheckCircle2,
  ChevronRight, Layers
} from 'lucide-react';
import Keycap from './Keycap';
import { QUICK_PROMPTS, streamCopilotMessage } from '../services/api';

/**
 * AiCopilotPanel
 * Panel asisten Business Analyst dengan pemahaman grounded dari teks SOP & kanvas BPMN.
 * Menyediakan analisis aturan bisnis, deteksi gap, dan sitasi kutipan SOP.
 */
export default function AiCopilotPanel({
  sopText,
  processName,
  selectedElement,
  onDeselectElement,
  intermediateGraph,
  onCitationClick,
  onClose,
  isRealMode,
  externalPrompt = null,
  initialMessages = [],
  onMessagesChange,
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [copiedQuote, setCopiedQuote] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const cancelStreamRef = useRef(null);
  const lastTriggeredPromptId = useRef(null);

  // Auto scroll saat ada pesan baru atau streaming update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingStatus]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Fokuskan textarea saat node BPMN dipilih agar BA langsung siap bertanya
  useEffect(() => {
    if (selectedElement && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedElement]);

  // Batalkan streaming jika unmount
  useEffect(() => {
    return () => {
      if (cancelStreamRef.current) {
        cancelStreamRef.current();
      }
    };
  }, []);

  // Listen to external prompts from Command Palette or shortcuts
  useEffect(() => {
    if (
      externalPrompt &&
      externalPrompt.id !== lastTriggeredPromptId.current &&
      externalPrompt.prompt
    ) {
      lastTriggeredPromptId.current = externalPrompt.id;
      handleSendMessage(externalPrompt.prompt);
    }
  }, [externalPrompt]);

  const handleClearChat = () => {
    if (isStreaming && cancelStreamRef.current) {
      cancelStreamRef.current();
      setIsStreaming(false);
      setStreamingStatus(null);
    }
    setMessages([]);
  };

  const handleStopGeneration = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setIsStreaming(false);
    setStreamingStatus(null);
  };

  const handleSendMessage = async (textToSend = null) => {
    const content = (textToSend || inputValue).trim();
    if (!content || isStreaming) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      selectedNodeName: selectedElement?.name || null,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!textToSend) {
      setInputValue('');
    }

    const assistantMessageId = `assistant-${Date.now()}`;

    // Alur Tanya Jawab / Analisis SOP Standar (Streaming Grounded)
    const initialAssistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      citations: [],
      confidence: 'high',
      followUps: [],
      warnings: [],
      isPartial: true,
    };

    setMessages([...newMessages, initialAssistantMessage]);
    setIsStreaming(true);
    setStreamingStatus({ stage: 'retrieving', message: 'Mencari konteks SOP & BPMN...' });

    const contextPayload = {
      processName: processName || 'SOP Dokumen',
      sopText: sopText || '',
      selectedElement: selectedElement
        ? {
            id: selectedElement.id,
            name: selectedElement.name || selectedElement.id,
            type: selectedElement.type || 'Task',
            actor: selectedElement.actor || null,
            incoming: selectedElement.incoming || [],
            outgoing: selectedElement.outgoing || [],
          }
        : null,
      graphSummary: intermediateGraph
        ? {
            tasks: (intermediateGraph.nodes || []).filter((n) => n.type === 'task').length,
            gateways: (intermediateGraph.nodes || []).filter((n) => (n.type || '').includes('gateway')).length,
            actors: Array.from(new Set((intermediateGraph.nodes || []).map((n) => n.actor).filter(Boolean))),
          }
        : null,
    };

    const callbacks = {
      onStatus: (status) => setStreamingStatus(status),
      onToken: (delta) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + delta }
              : msg
          )
        );
      },
      onCitations: (citations) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, citations } : msg
          )
        );
      },
      onDone: (data) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content || data.answer || '',
                  citations: data.citations || msg.citations,
                  confidence: data.confidence || 'high',
                  followUps: data.followUps || [],
                  warnings: data.warnings || [],
                  isPartial: false,
                }
              : msg
          )
        );
        setIsStreaming(false);
        setStreamingStatus(null);
        cancelStreamRef.current = null;
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    `⚠️ Gagal memproses permintaan: ${err.message || 'Layanan tidak tersedia.'}`,
                  isPartial: false,
                  confidence: 'low',
                  warnings: ['Koneksi ke penyedia AI terputus atau quota habis.'],
                }
              : msg
          )
        );
        setIsStreaming(false);
        setStreamingStatus(null);
        cancelStreamRef.current = null;
      },
    };

    const cancelFn = streamCopilotMessage(
      newMessages.map((m) => ({ role: m.role, content: m.content })),
      contextPayload,
      callbacks,
      isRealMode
    );
    cancelStreamRef.current = cancelFn;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectCitation = (cit) => {
    if (onCitationClick) {
      onCitationClick(cit);
    }
    setCopiedQuote(cit.chunkId);
    setTimeout(() => setCopiedQuote(null), 2500);
  };

  return (
    <div className="copilot-panel" aria-label="AI Copilot Assistant Panel">
      {/* ── Header ── */}
      <div className="copilot-header">
        <div className="copilot-header__left">
          <Bot size={15} className="copilot-header__icon" />
          <div className="copilot-header__title">
            <span>Analisis SOP & Copilot</span>
          </div>
        </div>

        <div className="copilot-header__actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="toggle-panel-btn"
              onClick={handleClearChat}
              title="Bersihkan riwayat percakapan"
              aria-label="Bersihkan chat"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            type="button"
            className="toggle-panel-btn"
            onClick={onClose}
            title="Tutup panel Copilot (Hot-key: ])"
            aria-label="Tutup panel Copilot"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Active Context Bar ── */}
      {selectedElement && (
        <div className="copilot-context-bar">
          <div className="copilot-context-item copilot-context-item--node">
            <span className="copilot-node-pill">
              <span className="copilot-node-label">Fokus Node:</span>
              <span className="copilot-node-name">{selectedElement.name || selectedElement.id}</span>
              {selectedElement.actor && (
                <span className="copilot-node-actor">({selectedElement.actor})</span>
              )}
            </span>
            <button
              type="button"
              className="copilot-context-clear"
              onClick={onDeselectElement}
              title="Lepas fokus node (Esc)"
              aria-label="Lepas fokus node"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      {/* ── Chat Messages Feed ── */}
      <div className="copilot-feed">
        {messages.length === 0 ? (
          <div className="copilot-empty">
            <p className="copilot-empty__desc">
              Tanyakan verifikasi aturan bisnis, kelengkapan alur keputusan, atau peran penanggung jawab dalam SOP ini.
            </p>

            <div className="copilot-quick-prompts copilot-quick-prompts--empty">
              {selectedElement && (
                <button
                  type="button"
                  className="copilot-chip copilot-chip--highlight"
                  onClick={() =>
                    handleSendMessage(
                      `Jelaskan aturan bisnis dan pelaksana untuk langkah "${selectedElement.name || selectedElement.id}".`
                    )
                  }
                >
                  Analisis langkah "{selectedElement.name || selectedElement.id}"
                </button>
              )}
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.id}
                  type="button"
                  className="copilot-chip"
                  onClick={() => handleSendMessage(qp.prompt)}
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="copilot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`copilot-bubble copilot-bubble--${msg.role}`}
              >
                {msg.role === 'user' ? (
                  <div className="copilot-user-content">
                    {msg.selectedNodeName && (
                      <div className="copilot-user-nodetag">
                        <Layers size={10} />
                        Fokus: {msg.selectedNodeName}
                      </div>
                    )}
                    <div className="copilot-bubble__text">{msg.content}</div>
                  </div>
                ) : (
                  <div className="copilot-assistant-content">
                    <div className="copilot-assistant-meta">
                      <span className="copilot-assistant-name">Copilot</span>
                    </div>

                    {/* Markdown / Text Answer */}
                    <div className="copilot-bubble__text">
                      {msg.content}
                      {msg.isPartial && <span className="copilot-cursor">▋</span>}
                    </div>

                    {/* Warnings (Process Gaps) */}
                    {msg.warnings && msg.warnings.length > 0 && (
                      <div className="copilot-warnings-box">
                        <AlertTriangle size={13} className="copilot-warning-icon" />
                        <div className="copilot-warning-list">
                          {msg.warnings.map((w, wi) => (
                            <div key={wi} className="copilot-warning-item">
                              {w}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grounded Citation Chips */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="copilot-citations-area">
                        <span className="copilot-citations-title">Rujukan SOP:</span>
                        <div className="copilot-citations-list">
                          {msg.citations.map((cit, ci) => (
                            <button
                              key={ci}
                              type="button"
                              className="copilot-citation-chip"
                              onClick={() => handleSelectCitation(cit)}
                              title={`Klik untuk menyorot teks pada SOP: "${cit.quote}"`}
                            >
                              <span className="copilot-citation-chip__badge">
                                {cit.step ? `Langkah ${cit.step}` : 'SOP'}
                              </span>
                              <span className="copilot-citation-chip__quote">
                                {cit.quote.length > 45 ? `${cit.quote.slice(0, 45)}...` : cit.quote}
                              </span>
                            </button>
                          ))}
                        </div>
                        {copiedQuote && (
                          <div className="copilot-citation-toast">
                            ✓ Menyorot kutipan di dokumen SOP
                          </div>
                        )}
                      </div>
                    )}

                    {/* Follow-up Prompts */}
                    {msg.followUps && msg.followUps.length > 0 && !msg.isPartial && (
                      <div className="copilot-followups">
                        <div className="copilot-followups__title">Saran Pertanyaan Lanjutan:</div>
                        <div className="copilot-followups__list">
                          {msg.followUps.map((fu, fi) => (
                            <button
                              key={fi}
                              type="button"
                              className="copilot-followup-pill"
                              onClick={() => handleSendMessage(fu)}
                            >
                              {fu}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming Status Indicator */}
            {isStreaming && streamingStatus && (
              <div className="copilot-streaming-status">
                <span className="copilot-status-dot" />
                <span className="copilot-status-text">{streamingStatus.message}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input Box ── */}
      <div className="copilot-input-area">
        <form
          className="copilot-input-box"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <textarea
            ref={textareaRef}
            className="copilot-textarea"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedElement
                ? `Tanyakan tentang langkah "${selectedElement.name || selectedElement.id}"...`
                : 'Tanyakan aturan alur atau tugas dalam SOP...'
            }
            rows={2}
          />
          <div className="copilot-input-footer">
            <span className="copilot-input-hint">
              Enter kirim · Shift+Enter baris baru
            </span>

            {isStreaming ? (
              <button
                type="button"
                className="copilot-stop-btn"
                onClick={handleStopGeneration}
                title="Hentikan pembuatan respons"
              >
                <Square size={11} fill="currentColor" />
                <span>Berhenti</span>
              </button>
            ) : (
              <button
                type="submit"
                className="copilot-send-btn"
                disabled={!inputValue.trim()}
                title="Kirim pertanyaan (Enter)"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
