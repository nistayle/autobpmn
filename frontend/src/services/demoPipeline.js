import { makeBpmnXml } from './bpmnXml';

// Local demonstration fixture. It deliberately never contacts a network API.
const DEMO_GRAPH = {
  process_id: 'pengadaan_perlengkapan_kantor',
  process_name: 'SOP Pengadaan Perlengkapan Kantor',
  actors: ['Pemohon', 'Manager Divisi', 'Bagian Pengadaan', 'Vendor', 'System'],
  nodes: [
    { id: 'start_1', type: 'startEvent', name: 'Start', actor: '' },
    { id: 'task_1', type: 'userTask', name: 'Isi Formulir Pengadaan', actor: 'Pemohon' },
    { id: 'task_2', type: 'userTask', name: 'Tinjau Urgensi & Anggaran', actor: 'Manager Divisi' },
    { id: 'gw_1', type: 'exclusiveGateway', name: 'Keputusan Persetujuan', actor: '' },
    { id: 'task_3', type: 'serviceTask', name: 'Kembalikan Formulir', actor: 'System' },
    { id: 'task_4', type: 'userTask', name: 'Cari Vendor & Bandingkan Harga', actor: 'Bagian Pengadaan' },
    { id: 'task_5', type: 'serviceTask', name: 'Kirim Barang Pesanan', actor: 'Vendor' },
    { id: 'task_6', type: 'userTask', name: 'Terima Barang & Tandatangani Berita Acara', actor: 'Pemohon' },
    { id: 'end_1', type: 'endEvent', name: 'End', actor: '' },
  ],
  edges: [
    { from_node: 'start_1', to_node: 'task_1', condition: null },
    { from_node: 'task_1', to_node: 'task_2', condition: null },
    { from_node: 'task_2', to_node: 'gw_1', condition: null },
    { from_node: 'gw_1', to_node: 'task_3', condition: 'Ditolak' },
    { from_node: 'gw_1', to_node: 'task_4', condition: 'Disetujui' },
    { from_node: 'task_3', to_node: 'end_1', condition: null },
    { from_node: 'task_4', to_node: 'task_5', condition: null },
    { from_node: 'task_5', to_node: 'task_6', condition: null },
    { from_node: 'task_6', to_node: 'end_1', condition: null },
  ],
};

export async function runDemoPipeline() {
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  return {
    process_id: DEMO_GRAPH.process_id,
    process_name: DEMO_GRAPH.process_name,
    intermediate_graph: DEMO_GRAPH,
    validation: { is_valid: true, issues: [], deadlocks: [], orphan_nodes: [] },
    bpmn_xml: makeBpmnXml(DEMO_GRAPH),
  };
}

export { DEMO_GRAPH };
