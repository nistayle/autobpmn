/**
 * AutoBPMN File Management & Multi-tab Storage Service
 */

import { makeBpmnXml } from './bpmnXml';
import { syncXmlToGraph, validateGraphLocally } from './graphModel';

const STORAGE_KEY = 'autobpmn_tabs_v2';
const ACTIVE_TAB_KEY = 'autobpmn_active_tab_v2';
const SOP_SOURCE_DB = 'autobpmn_sop_sources';
const SOP_SOURCE_STORE = 'files';
const COPILOT_CHAT_STORE = 'chats';

let sopSourceDbPromise;

function openSopSourceDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Penyimpanan berkas sumber tidak tersedia di browser ini.'));
  }
  if (!sopSourceDbPromise) {
    sopSourceDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(SOP_SOURCE_DB, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SOP_SOURCE_STORE)) {
          db.createObjectStore(SOP_SOURCE_STORE);
        }
        if (!db.objectStoreNames.contains(COPILOT_CHAT_STORE)) {
          db.createObjectStore(COPILOT_CHAT_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan sumber SOP.'));
      request.onblocked = () => reject(new Error('Penyimpanan sumber SOP sedang diblokir tab lain.'));
    });
  }
  return sopSourceDbPromise;
}

export async function persistSopSource(fileId, file) {
  const db = await openSopSourceDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SOP_SOURCE_STORE, 'readwrite');
    transaction.objectStore(SOP_SOURCE_STORE).put({
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
    }, fileId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Gagal menyimpan berkas sumber SOP.'));
    transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan berkas sumber SOP dibatalkan.'));
  });
}

export async function loadPersistedSopSource(fileId) {
  const db = await openSopSourceDb();
  const record = await new Promise((resolve, reject) => {
    const transaction = db.transaction(SOP_SOURCE_STORE, 'readonly');
    const request = transaction.objectStore(SOP_SOURCE_STORE).get(fileId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Gagal memuat berkas sumber SOP.'));
  });
  if (!record) return null;
  return new File([record.blob], record.name, {
    type: record.type || record.blob.type,
    lastModified: record.lastModified,
  });
}

export async function removePersistedSopSource(fileId) {
  const db = await openSopSourceDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SOP_SOURCE_STORE, 'readwrite');
    transaction.objectStore(SOP_SOURCE_STORE).delete(fileId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Gagal menghapus berkas sumber SOP.'));
    transaction.onabort = () => reject(transaction.error || new Error('Penghapusan berkas sumber SOP dibatalkan.'));
  });
}

export async function loadPersistedCopilotChat(fileId) {
  const db = await openSopSourceDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(COPILOT_CHAT_STORE, 'readonly');
    const request = transaction.objectStore(COPILOT_CHAT_STORE).get(fileId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Gagal memuat riwayat Copilot.'));
  });
}

export async function persistCopilotChat(fileId, messages) {
  const db = await openSopSourceDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(COPILOT_CHAT_STORE, 'readwrite');
    transaction.objectStore(COPILOT_CHAT_STORE).put(messages, fileId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Gagal menyimpan riwayat Copilot.'));
    transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan riwayat Copilot dibatalkan.'));
  });
}

export async function removePersistedCopilotChat(fileId) {
  const db = await openSopSourceDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(COPILOT_CHAT_STORE, 'readwrite');
    transaction.objectStore(COPILOT_CHAT_STORE).delete(fileId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Gagal menghapus riwayat Copilot.'));
    transaction.onabort = () => reject(transaction.error || new Error('Penghapusan riwayat Copilot dibatalkan.'));
  });
}

/**
 * Buat diagram kosong baru (Blank Starter Diagram)
 */
export function createBlankProcess(index = 1) {
  const processId = `process_new_${Date.now()}`;
  const processName = `Proses Baru ${index}`;
  const graph = {
    process_id: processId,
    process_name: processName,
    actors: [],
    nodes: [],
    edges: [],
  };

  const xml = makeBpmnXml(graph);
  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: `Untitled-${index}.bpmn`,
    processName,
    intermediateGraph: graph,
    validation: { is_valid: false, issues: ['Diagram kosong. Tambahkan sumber SOP atau elemen BPMN.'], deadlocks: [], orphan_nodes: [] },
    bpmnXml: xml,
    sopText: '',
    isDirty: false,
  };
}

/**
 * Buat berkas baru dari hasil sintesis SOP
 */
export function createFileFromSynthesis(result, rawSopText = '') {
  const cleanName = (result.process_name || 'Alur_Proses').replace(/\s+/g, '_') + '.bpmn';
  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    processName: result.process_name || 'Alur Proses Bisnis',
    intermediateGraph: result.intermediate_graph,
    validation: result.validation || { is_valid: true, issues: [] },
    bpmnXml: result.bpmn_xml,
    sopText: rawSopText,
    isDirty: false,
  };
}

/**
 * Parse berkas yang diimpor (.bpmn, .xml, .json)
 */
export async function parseImportedFile(file) {
  const text = await file.text();
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.json')) {
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      throw new Error(`Format berkas JSON tidak valid: ${e.message}`);
    }

    // Mendukung baik format direct graph maupun full payload
    const graph = parsedJson.intermediate_graph || parsedJson;
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      throw new Error('Berkas JSON tidak memiliki struktur node BPMN yang dikenali.');
    }

    const xml = makeBpmnXml(graph);
    const val = validateGraphLocally(graph);

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: file.name,
      processName: graph.process_name || file.name.replace(/\.[^/.]+$/, ''),
      intermediateGraph: graph,
      validation: val,
      bpmnXml: xml,
      sopText: '',
      isDirty: false,
    };
  }

  // Berkas .bpmn atau .xml
  const graph = syncXmlToGraph(text);
  const val = validateGraphLocally(graph);

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: file.name,
    processName: graph?.process_name || file.name.replace(/\.[^/.]+$/, ''),
    intermediateGraph: graph,
    validation: val,
    bpmnXml: text,
    sopText: '',
    isDirty: false,
  };
}

/**
 * Unduh konten sebagai berkas lokal
 */
export function triggerFileDownload(content, mimeType, filename) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Muat daftar tab dan pilihan aktif dari satu snapshot LocalStorage.
 */
export function loadPersistedWorkspace() {
  try {
    const rawFiles = localStorage.getItem(STORAGE_KEY);
    const parsedFiles = rawFiles ? JSON.parse(rawFiles) : [];
    return {
      files: Array.isArray(parsedFiles) ? parsedFiles : [],
      activeFileId: localStorage.getItem(ACTIVE_TAB_KEY) || null,
    };
  } catch (e) {
    console.warn('Gagal memuat persisted workspace:', e);
    return { files: [], activeFileId: null };
  }
}

/**
 * Simpan daftar berkas tanpa menulis ulang saat hanya tab aktif berubah.
 */
export function persistFiles(files) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (e) {
    console.warn('Gagal menyimpan persisted files:', e);
  }
}

export function persistActiveTabId(activeFileId) {
  if (!activeFileId) return;
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, activeFileId);
  } catch (e) {
    console.warn('Gagal menyimpan tab aktif:', e);
  }
}
