// frontend/src/services/api.js

import { runDemoPipeline } from './demoPipeline';

const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000/api/v1'
  : '/api/v1';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

/**
 * Mendeteksi apakah saat ini berada di mode Real Simulation (URL /demo)
 * atau Simulation Mode / Prototype (Root URL /).
 */
export function isRealApiMode() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path === '/demo' ||
    path.startsWith('/demo/') ||
    search.includes('mode=demo') ||
    search.includes('mode=real') ||
    hash.includes('demo')
  );
}

/**
 * Helper penanganan response dari FastAPI backend.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = 'Terjadi kesalahan pada server backend.';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail);
  }
  return response.json();
}

/**
 * Mengirimkan teks SOP.
 * - Jika isReal true (/demo): panggil backend API FastAPI sesungguhnya.
 * - Jika isReal false (/): simulasikan secara lokal seolah API mengirimkan JSON (prototype).
 */
export async function processSopText(textContent, title = 'Dokumen SOP', forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();

  if (!useReal) {
    // Mode Prototype: simulasi lokal mock JSON
    return runDemoPipeline();
  }

  // Mode Real Simulation: panggil backend API sesungguhnya
  const response = await fetch(`${BASE_URL}/pipeline/process-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title,
      text_content: textContent,
    }),
  });

  return handleResponse(response);
}

/**
 * Mengunggah berkas SOP (.pdf atau .txt).
 * - Jika isReal true (/demo): unggah berkas multipart ke backend FastAPI.
 * - Jika isReal false (/): simulasi lokal fixture (prototype).
 */
export async function processSopFile(file, forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();

  if (!useReal) {
    return runDemoPipeline();
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/pipeline/process-file`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  return handleResponse(response);
}

/**
 * Memeriksa status kesehatan server backend.
 */
export async function checkServerHealth() {
  if (!isRealApiMode()) {
    return { status: 'simulation', service: 'AutoBPMN Local Prototype (Simulation Only)' };
  }

  const rootUrl = BASE_URL.replace('/api/v1', '');
  const response = await fetch(`${rootUrl}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  return handleResponse(response);
}

// ==========================================
// AI COPILOT (SOP ASSISTANT) SERVICES
// ==========================================

export const QUICK_PROMPTS = [
  {
    id: 'ambiguity',
    label: '🔍 Cek Celah & Ambiguitas',
    prompt: 'Apakah ada celah, ambiguitas, batas SLA yang hilang, atau kondisi tanpa penanganan dalam SOP ini?',
  },
  {
    id: 'raci',
    label: '👥 Ringkas Peran & RACI',
    prompt: 'Ringkas peran (RACI) setiap aktor dan tanggung jawabnya menurut SOP.',
  },
  {
    id: 'rejection',
    label: '↩️ Analisis Alur Penolakan',
    prompt: 'Jelaskan alur penolakan dokumen, pengembalian berkas, dan eskalasi persetujuan.',
  },
  {
    id: 'optimization',
    label: '⚡ Sarankan Optimasi Alur',
    prompt: 'Berikan rekomendasi simplifikasi atau otomatisasi langkah kerja untuk Business Analyst.',
  },
];

/**
 * Normalisasi objek sitasi agar kompatibel dengan snake_case backend dan camelCase frontend.
 */
export function normalizeCitation(cit) {
  if (!cit) return null;
  return {
    chunkId: cit.chunk_id || cit.chunkId || '',
    section: cit.section || '',
    step: cit.step ?? null,
    page: cit.page ?? null,
    quote: cit.quote || '',
  };
}

/**
 * Normalisasi response Copilot.
 */
export function normalizeCopilotResponse(data) {
  return {
    answer: data.answer || '',
    citations: (data.citations || []).map(normalizeCitation).filter(Boolean),
    confidence: data.confidence || 'high',
    followUps: data.follow_ups || data.followUps || [],
    warnings: data.warnings || [],
  };
}

/**
 * Fixture simulasi lokal untuk Prototype Mode (SOP Pengadaan Barang/Jasa)
 */
function getSimulatedCopilotResponse(query, context = {}) {
  const q = query.toLowerCase();
  const selectedNode = context.selectedElement?.name || '';
  const selectedActor = context.selectedElement?.actor || '';

  if (selectedNode || q.includes('langkah ini') || q.includes('node')) {
    return {
      answer: `Untuk aktivitas **"${selectedNode || 'Langkah Terpilih'}"**, SOP menetapkan bahwa pelaksana bertanggung jawab penuh memverifikasi keabsahan data sebelum alur dilanjutkan ke tahap berikutnya. Jika ditemukan ketidaksesuaian, berkas wajib dikembalikan langsung kepada pemohon tanpa diproses lebih lanjut.`,
      citations: [
        {
          chunkId: 'sop-chunk-2',
          section: 'Prosedur Pengadaan',
          step: 2,
          page: 1,
          quote: 'Petugas pengadaan memeriksa kelengkapan dokumen permohonan.',
        },
        {
          chunkId: 'sop-chunk-3',
          section: 'Prosedur Pengadaan',
          step: 3,
          page: 1,
          quote: 'Jika dokumen tidak lengkap, petugas mengembalikan berkas ke pemohon untuk diperbaiki.',
        },
      ],
      confidence: 'high',
      followUps: [
        'Bagaimana kriteria kelengkapan dokumen permohonan?',
        'Berapa lama batas waktu perbaikan berkas oleh pemohon?',
      ],
      warnings: ['SOP tidak mendefinisikan batas waktu (SLA) pengembalian berkas oleh pemohon.'],
    };
  }

  if (q.includes('celah') || q.includes('ambiguitas') || q.includes('sla')) {
    return {
      answer: `Berdasarkan analisis dokumen SOP Pengadaan, ditemukan **3 celah kritis (process gaps)**:\n\n1. **Tidak ada batas waktu (SLA)** untuk pemeriksaan kelengkapan berkas pada Langkah 2.\n2. **Kriteria perbaikan tidak jelas**: Tidak dijelaskan berapa kali pemohon boleh merevisi berkas sebelum permohonan dianggap hangus.\n3. **Ambiguitas nilai batas persetujuan**: Tepat di batas nilai Rp 50.000.000 belum didefinisikan secara tegas apakah masuk kategori persetujuan langsung atau wajib eskalasi Kepala Bagian.`,
      citations: [
        {
          chunkId: 'sop-chunk-3',
          section: 'Prosedur Pengadaan',
          step: 3,
          page: 1,
          quote: 'Jika dokumen tidak lengkap, petugas mengembalikan berkas ke pemohon untuk diperbaiki.',
        },
        {
          chunkId: 'sop-chunk-4',
          section: 'Prosedur Pengadaan',
          step: 4,
          page: 1,
          quote: 'Jika dokumen lengkap dan nilai di bawah 50 juta, petugas langsung memproses pesanan pembelian (PO).',
        },
        {
          chunkId: 'sop-chunk-5',
          section: 'Prosedur Pengadaan',
          step: 5,
          page: 1,
          quote: 'Jika nilai pengadaan 50 juta ke atas, berkas diteruskan ke Kepala Bagian untuk persetujuan.',
        },
      ],
      confidence: 'high',
      followUps: [
        'Apakah perlu ditambahkan batas SLA 2x24 jam untuk verifikasi dokumen?',
        'Bagaimana definisi penanganan nilai tepat Rp 50.000.000?',
      ],
      warnings: ['Risiko bottleneck pada tahap persetujuan Kepala Bagian jika volume tinggi.'],
    };
  }

  if (q.includes('raci') || q.includes('peran')) {
    return {
      answer: `Berikut adalah matriks RACI berdasarkan SOP Pengadaan:\n\n- **Pemohon**: Responsible (R) untuk pengajuan formulir awal dan perbaikan berkas; Accountable (A) untuk kebenaran kebutuhan barang.\n- **Petugas Pengadaan**: Responsible (R) untuk verifikasi dokumen kelengkapan dan penerbitan PO (nilai < 50 juta).\n- **Kepala Bagian**: Accountable & Approver (A) khusus untuk pengadaan dengan nilai Rp 50 juta ke atas.`,
      citations: [
        {
          chunkId: 'sop-chunk-1',
          section: 'Prosedur Pengadaan',
          step: 1,
          page: 1,
          quote: 'Pemohon mengajukan formulir permintaan pengadaan barang atau jasa melalui sistem.',
        },
        {
          chunkId: 'sop-chunk-2',
          section: 'Prosedur Pengadaan',
          step: 2,
          page: 1,
          quote: 'Petugas pengadaan memeriksa kelengkapan dokumen permohonan.',
        },
        {
          chunkId: 'sop-chunk-5',
          section: 'Prosedur Pengadaan',
          step: 5,
          page: 1,
          quote: 'Jika nilai pengadaan 50 juta ke atas, berkas diteruskan ke Kepala Bagian untuk persetujuan.',
        },
      ],
      confidence: 'high',
      followUps: [
        'Siapa yang mengonfirmasi penerimaan barang di lapangan?',
        'Apakah Kepala Unit pemohon perlu ikut menandatangani pengajuan awal?',
      ],
      warnings: [],
    };
  }

  if (q.includes('penolakan') || q.includes('eskalasi')) {
    return {
      answer: `Alur penolakan dan eskalasi pada SOP ini terbagi dua jalur:\n\n1. **Penolakan Administratif**: Terjadi di Langkah 3 saat dokumen tidak lengkap. Petugas mengembalikan berkas langsung ke Pemohon untuk dilengkapi.\n2. **Eskalasi Nilai Finansial**: Pada Langkah 5, jika nilai transaksi ≥ Rp 50 juta, wewenang beralih dari Petugas ke Kepala Bagian untuk persetujuan formal sebelum PO diterbitkan.`,
      citations: [
        {
          chunkId: 'sop-chunk-3',
          section: 'Prosedur Pengadaan',
          step: 3,
          page: 1,
          quote: 'Jika dokumen tidak lengkap, petugas mengembalikan berkas ke pemohon untuk diperbaiki.',
        },
        {
          chunkId: 'sop-chunk-5',
          section: 'Prosedur Pengadaan',
          step: 5,
          page: 1,
          quote: 'Jika nilai pengadaan 50 juta ke atas, berkas diteruskan ke Kepala Bagian untuk persetujuan.',
        },
      ],
      confidence: 'high',
      followUps: [
        'Apa yang terjadi jika Kepala Bagian menolak pengajuan ≥ 50 juta?',
        'Apakah ada alur banding bagi pemohon?',
      ],
      warnings: ['SOP belum mendefinisikan skenario penolakan oleh Kepala Bagian.'],
    };
  }

  // Jawaban umum rekomendasi optimasi
  return {
    answer: `Dokumen SOP Pengadaan Barang/Jasa ini memiliki 6 langkah prosedural dengan 2 decision gateway (kelengkapan dokumen & ambang batas nilai 50 juta). Untuk optimasi, disarankan mengintegrasikan validasi otomatis di formulir sistem agar mengurangi tingkat pengembalian dokumen manual pada Langkah 3.`,
    citations: [
      {
        chunkId: 'sop-chunk-1',
        section: 'Prosedur Pengadaan',
        step: 1,
        page: 1,
        quote: 'Pemohon mengajukan formulir permintaan pengadaan barang atau jasa melalui sistem.',
      },
      {
        chunkId: 'sop-chunk-4',
        section: 'Prosedur Pengadaan',
        step: 4,
        page: 1,
        quote: 'Jika dokumen lengkap dan nilai di bawah 50 juta, petugas langsung memproses pesanan pembelian (PO).',
      },
    ],
    confidence: 'high',
    followUps: [
      'Bagaimana cara mengotomatiskan validasi dokumen kelengkapan?',
      'Apakah perlu menambahkan gateway notifikasi email otomatis?',
    ],
    warnings: [],
  };
}

/**
 * Mengirim pesan ke AI Copilot secara non-streaming.
 */
export async function sendCopilotMessage(messages, context = {}, forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();

  if (!useReal) {
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const simData = getSimulatedCopilotResponse(lastUserMsg, context);
    return normalizeCopilotResponse(simData);
  }

  const response = await fetch(`${BASE_URL}/pipeline/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      messages,
      context,
      sop_text: context.sopText || null,
      stream: false,
    }),
  });

  const data = await handleResponse(response);
  return normalizeCopilotResponse(data);
}

/**
 * Mengirim pesan ke AI Copilot dengan streaming SSE.
 * Mendukung pembatalan (abort).
 *
 * @param {Array} messages - Riwayat percakapan [{role, content}]
 * @param {Object} context - Konteks SOP & BPMN {processName, selectedElement, sopChunks, graphSummary}
 * @param {Object} callbacks - { onStatus, onToken, onCitations, onDone, onError }
 * @param {boolean|null} forceReal - Override live API vs prototype
 * @returns {Function} cancelFn - Fungsi untuk membatalkan streaming
 */
export function streamCopilotMessage(messages, context = {}, callbacks = {}, forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();
  const abortController = new AbortController();
  let isCancelled = false;

  const cancel = () => {
    isCancelled = true;
    abortController.abort();
  };

  (async () => {
    const lastUserMsg = messages[messages.length - 1]?.content || '';

    // ==========================================
    // JALUR 1: PROTOTYPE SIMULATION MODE
    // ==========================================
    if (!useReal) {
      try {
        if (callbacks.onStatus) {
          callbacks.onStatus({ stage: 'retrieving', message: 'Menganalisis potongan SOP sumber...' });
        }
        await new Promise((resolve) => setTimeout(resolve, 220));
        if (isCancelled) return;

        if (callbacks.onStatus) {
          callbacks.onStatus({ stage: 'generating', message: 'Menghubungkan elemen BPMN & menyusun sitasi...' });
        }
        await new Promise((resolve) => setTimeout(resolve, 180));
        if (isCancelled) return;

        const simData = getSimulatedCopilotResponse(lastUserMsg, context);
        const words = simData.answer.split(' ');

        for (let i = 0; i < words.length; i++) {
          if (isCancelled) return;
          const delta = words[i] + (i < words.length - 1 ? ' ' : '');
          if (callbacks.onToken) {
            callbacks.onToken(delta);
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        if (isCancelled) return;

        const normalizedCitations = (simData.citations || []).map(normalizeCitation);
        if (callbacks.onCitations) {
          callbacks.onCitations(normalizedCitations);
        }

        if (callbacks.onDone) {
          callbacks.onDone({
            messageId: `sim-${Date.now()}`,
            confidence: simData.confidence,
            followUps: simData.followUps,
            warnings: simData.warnings,
            citations: normalizedCitations,
          });
        }
      } catch (err) {
        if (!isCancelled && callbacks.onError) {
          callbacks.onError(err);
        }
      }
      return;
    }

    // ==========================================
    // JALUR 2: LIVE BACKEND API SSE STREAM
    // ==========================================
    try {
      const response = await fetch(`${BASE_URL}/pipeline/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages,
          context,
          sop_text: context.sopText || null,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errMessage = 'Gagal menghubungi Copilot SSE stream.';
        try {
          const errJson = await response.json();
          errMessage = errJson.detail || errMessage;
        } catch {
          errMessage = response.statusText || errMessage;
        }
        throw new Error(errMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (isCancelled) {
          reader.cancel();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Simpan sisa baris terakhir yang belum selesai ke buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            // Heartbeat atau baris kosong
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.replace('event:', '').trim();
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace('data:', '').trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === 'status' && callbacks.onStatus) {
                callbacks.onStatus(parsed);
              } else if (currentEvent === 'token' && callbacks.onToken) {
                callbacks.onToken(parsed.delta || '');
              } else if (currentEvent === 'citations' && callbacks.onCitations) {
                const cits = (parsed.citations || []).map(normalizeCitation);
                callbacks.onCitations(cits);
              } else if (currentEvent === 'done' && callbacks.onDone) {
                const cits = (parsed.citations || []).map(normalizeCitation);
                callbacks.onDone({
                  ...parsed,
                  citations: cits,
                });
              } else if (currentEvent === 'error' && callbacks.onError) {
                callbacks.onError(new Error(parsed.message || 'Terjadi kesalahan stream Copilot'));
              }
            } catch {
              // Jika data string biasa
              if (currentEvent === 'token' && callbacks.onToken) {
                callbacks.onToken(dataStr);
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Pembatalan disengaja oleh user
        return;
      }
      if (!isCancelled && callbacks.onError) {
        callbacks.onError(err);
      }
    }
  })();

  return cancel;
}

import { validateGraphLocally, applyLocalPatch, computeGraphDiff } from './graphModel';
import { makeBpmnXml } from './demoPipeline';

/**
 * Validasi struktural graf proses BPMN
 */
export async function validateGraphApi(graph, forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();
  if (!useReal) {
    return validateGraphLocally(graph);
  }

  const response = await fetch(`${BASE_URL}/pipeline/validate-graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(graph),
  });
  return handleResponse(response);
}

/**
 * Sintesis graf BPMN langsung menjadi BPMN 2.0 XML
 */
export async function synthesizeGraphApi(graph, forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();
  if (!useReal) {
    const val = validateGraphLocally(graph);
    let xml = '';
    try {
      xml = makeBpmnXml(graph);
    } catch (e) {
      console.warn('Local makeBpmnXml error:', e);
    }
    return {
      process_id: graph.process_id,
      process_name: graph.process_name,
      validation: val,
      intermediate_graph: graph,
      bpmn_xml: xml,
    };
  }

  const response = await fetch(`${BASE_URL}/pipeline/synthesize-graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(graph),
  });
  return handleResponse(response);
}

/**
 * Meminta AI menghasilkan usulan patch terstruktur (AI-assisted Editing)
 */
export async function requestAiEditApi(prompt, currentGraph, selectedNodeId = null, forceReal = null, sopContext = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();

  if (!useReal) {
    // Mode Prototype / Simulasi Lokal Cerdas
    await new Promise((r) => setTimeout(r, 600));
    const promptLower = prompt.toLowerCase();
    let patch = null;

    if (sopContext?.trim()) {
      const endEdge = currentGraph.edges.find((edge) =>
        currentGraph.nodes.some((node) => node.id === edge.to_node && node.type === 'endEvent')
      );
      if (!endEdge) {
        throw new Error('Tidak ditemukan alur menuju akhir proses untuk menambahkan langkah SOP.');
      }

      const names = sopContext
        .split(/\r?\n|(?<=[.!?])\s+/)
        .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
        .filter((line) => !/^(?:sop(?:\s|:)|standar operasional prosedur\b)/i.test(line))
        .filter((line) => line.length > 4)
        .slice(0, 4);
      if (names.length === 0) {
        throw new Error('Tambahkan setidaknya satu langkah baru untuk memperluas diagram.');
      }

      const usedIds = new Set(currentGraph.nodes.map((node) => node.id));
      const operations = [];
      let previousNodeId = endEdge.from_node;
      names.forEach((name, index) => {
        let nodeId = `extend_step_${currentGraph.nodes.length + index + 1}`;
        while (usedIds.has(nodeId)) nodeId = `${nodeId}_new`;
        usedIds.add(nodeId);
        const nextNode = {
          id: nodeId,
          type: 'userTask',
          name: name.slice(0, 100),
          actor: 'Belum ditentukan',
        };
        operations.push({
          op: 'insert_step_between',
          from_node: previousNodeId,
          to_node: endEdge.to_node,
          new_node: nextNode,
        });
        previousNodeId = nodeId;
      });

      patch = {
        patch_id: `sim_patch_extend_${Date.now()}`,
        description: `Menambahkan ${names.length} langkah dari sumber SOP`,
        rationale: 'Diagram yang sudah ada dipertahankan; hanya langkah tambahan yang disisipkan.',
        target_node_ids: [endEdge.from_node, endEdge.to_node],
        operations,
      };
    } else if (promptLower.includes('ubah') && (promptLower.includes('aktor') || promptLower.includes('pelaksana') || promptLower.includes('peran'))) {
      const targetId = selectedNodeId || (currentGraph.nodes[1]?.id || 'task_1');
      const targetNode = currentGraph.nodes.find((n) => n.id === targetId);
      const newActor = promptLower.includes('manajer') ? 'Manager Divisi' : promptLower.includes('keuangan') ? 'Bagian Keuangan' : 'Bagian Kepatuhan & Legal';

      patch = {
        patch_id: 'sim_patch_actor',
        description: `Mengubah pelaksana langkah '${targetNode?.name || targetId}' menjadi ${newActor}`,
        rationale: 'Penyesuaian wewenang operasional SOP.',
        target_node_ids: [targetId],
        operations: [{ op: 'update_node', node_id: targetId, actor: newActor }],
      };
    } else if (promptLower.includes('hapus') && selectedNodeId) {
      const targetNode = currentGraph.nodes.find((n) => n.id === selectedNodeId);
      const inNodes = currentGraph.edges.filter((e) => e.to_node === selectedNodeId).map((e) => e.from_node);
      const outNodes = currentGraph.edges.filter((e) => e.from_node === selectedNodeId).map((e) => e.to_node);

      const ops = [{ op: 'remove_node', node_id: selectedNodeId }];
      if (inNodes.length && outNodes.length) {
        ops.push({ op: 'add_edge', from_node: inNodes[0], to_node: outNodes[0], condition: null });
      }

      patch = {
        patch_id: 'sim_patch_remove',
        description: `Menghapus langkah '${targetNode?.name || selectedNodeId}' dan menyambungkan kembali alur`,
        rationale: 'Penyederhanaan alur proses.',
        target_node_ids: [selectedNodeId],
        operations: ops,
      };
    } else {
      // Default: Sisipkan langkah verifikasi
      const fromNode = selectedNodeId || currentGraph.nodes[0]?.id || 'start_1';
      const outEdge = currentGraph.edges.find((e) => e.from_node === fromNode);
      const toNode = outEdge?.to_node || currentGraph.nodes[currentGraph.nodes.length - 1]?.id || 'end_1';
      const newId = `task_verify_${currentGraph.nodes.length + 1}`;
      const newName = promptLower.includes('notifikasi') ? 'Kirim Notifikasi Status ke Pemohon' : promptLower.includes('legal') ? 'Tinjauan Klausul Legal & Kontrak' : 'Verifikasi Kepatuhan & Anggaran';

      patch = {
        patch_id: 'sim_patch_insert',
        description: `Menyisipkan langkah '${newName}' ke dalam alur proses`,
        rationale: 'Peningkatan kontrol kepatuhan operasional proses bisnis.',
        target_node_ids: [fromNode, toNode],
        operations: [
          {
            op: 'insert_step_between',
            from_node: fromNode,
            to_node: toNode,
            new_node: {
              id: newId,
              type: 'userTask',
              name: newName,
              actor: 'Bagian Kepatuhan',
            },
          },
        ],
      };
    }

    const { success, newGraph, issues, diff } = applyLocalPatch(currentGraph, patch);
    return {
      patch,
      is_valid: success,
      validation_issues: issues,
      diff_summary: diff || computeGraphDiff(currentGraph, newGraph),
      projected_graph: success ? newGraph : null,
      bpmn_xml: success ? makeBpmnXml(newGraph) : null,
    };
  }

  // Real Mode: kirim ke backend FastAPI
  const response = await fetch(`${BASE_URL}/pipeline/ai-edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt,
      current_graph: currentGraph,
      selected_node_id: selectedNodeId,
      sop_context: sopContext || null,
    }),
  });
  return handleResponse(response);
}

/**
 * Menerapkan patch terstruktur yang telah disetujui (Apply)
 */
export async function applyGraphPatchApi(graph, patch, forceReal = null) {
  const useReal = forceReal !== null ? forceReal : isRealApiMode();

  if (!useReal) {
    const { success, newGraph, issues } = applyLocalPatch(graph, patch);
    if (!success) {
      throw new Error(`Gagal menerapkan patch: ${issues.join(', ')}`);
    }
    const val = validateGraphLocally(newGraph);
    return {
      process_id: newGraph.process_id,
      process_name: newGraph.process_name,
      validation: val,
      intermediate_graph: newGraph,
      bpmn_xml: makeBpmnXml(newGraph),
    };
  }

  const response = await fetch(`${BASE_URL}/pipeline/apply-patch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ graph, patch }),
  });
  return handleResponse(response);
}
