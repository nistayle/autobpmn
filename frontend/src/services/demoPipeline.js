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

const positions = {
  start_1: [55, 190, 36, 36], task_1: [135, 168, 150, 80], task_2: [365, 168, 150, 80],
  gw_1: [575, 183, 50, 50], task_3: [690, 335, 150, 80], task_4: [690, 168, 170, 80],
  task_5: [950, 168, 150, 80], task_6: [1180, 168, 180, 80], end_1: [1440, 190, 36, 36],
};

const colors = {
  startEvent: ['#059669', '#ecfdf5'],
  endEvent: ['#e11d48', '#fff1f2'],
  userTask: ['#0284c7', '#f0f9ff'],
  serviceTask: ['#7c3aed', '#f5f3ff'],
  exclusiveGateway: ['#d97706', '#fffbeb'],
};

const escapeXml = (value) => String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
const flowId = (edge) => `flow_${edge.from_node}_${edge.to_node}`;

function getNodeBounds(nodeId, nodeType = 'userTask', index = 0) {
  if (positions[nodeId]) return positions[nodeId];
  const w = nodeType.includes('gateway') ? 50 : nodeType.includes('Event') ? 36 : 150;
  const h = nodeType.includes('gateway') ? 50 : nodeType.includes('Event') ? 36 : 80;
  return [100 + index * 180, 168, w, h];
}

function edgeWaypoints(edge, graph) {
  const nodeMap = new Map((graph.nodes || []).map((n, i) => [n.id, { node: n, index: i }]));
  const fromInfo = nodeMap.get(edge.from_node);
  const toInfo = nodeMap.get(edge.to_node);

  const [sx, sy, sw, sh] = getNodeBounds(edge.from_node, fromInfo?.node?.type, fromInfo?.index || 0);
  const [tx, ty, tw, th] = getNodeBounds(edge.to_node, toInfo?.node?.type, toInfo?.index || 1);

  const sourceX = sx + sw;
  const sourceY = sy + sh / 2;
  const targetX = tx;
  const targetY = ty + th / 2;

  if (edge.from_node === 'gw_1' && edge.to_node === 'task_3') {
    return [[sx + sw / 2, sy + sh], [sx + sw / 2, targetY], [targetX, targetY]];
  }
  if (edge.from_node === 'task_3' && edge.to_node === 'end_1') {
    return [[sourceX, sourceY], [1458, sourceY], [1458, 226]];
  }
  return [[sourceX, sourceY], [targetX, targetY]];
}

function makeBpmnXml(graph) {
  const nodeBoundsMap = new Map();
  graph.nodes.forEach((node, idx) => {
    nodeBoundsMap.set(node.id, getNodeBounds(node.id, node.type, idx));
  });

  const processElements = graph.nodes.map((node) => {
    const incoming = graph.edges.filter((edge) => edge.to_node === node.id).map((edge) => `<bpmn:incoming>${flowId(edge)}</bpmn:incoming>`).join('');
    const outgoing = graph.edges.filter((edge) => edge.from_node === node.id).map((edge) => `<bpmn:outgoing>${flowId(edge)}</bpmn:outgoing>`).join('');
    return `<bpmn:${node.type} id="${node.id}" name="${escapeXml(node.name)}">${incoming}${outgoing}</bpmn:${node.type}>`;
  }).join('');
  const flows = graph.edges.map((edge) => `<bpmn:sequenceFlow id="${flowId(edge)}" sourceRef="${edge.from_node}" targetRef="${edge.to_node}"${edge.condition ? ` name="${escapeXml(edge.condition)}"` : ''} />`).join('');
  const shapes = graph.nodes.map((node) => {
    const [x, y, width, height] = nodeBoundsMap.get(node.id);
    const [stroke, fill] = colors[node.type] || ['#0284c7', '#f0f9ff'];
    return `<bpmndi:BPMNShape id="shape_${node.id}" bpmnElement="${node.id}" bioc:stroke="${stroke}" bioc:fill="${fill}"><dc:Bounds x="${x}" y="${y}" width="${width}" height="${height}" /></bpmndi:BPMNShape>`;
  }).join('');
  const diagramEdges = graph.edges.map((edge) => `<bpmndi:BPMNEdge id="edge_${flowId(edge)}" bpmnElement="${flowId(edge)}">${edgeWaypoints(edge, graph).map(([x, y]) => `<di:waypoint x="${x}" y="${y}" />`).join('')}</bpmndi:BPMNEdge>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="Definitions_demo" targetNamespace="https://autobpmn.local/demo">
  <bpmn:process id="${graph.process_id}" name="${graph.process_name}" isExecutable="false">${processElements}${flows}</bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_demo"><bpmndi:BPMNPlane id="Plane_demo" bpmnElement="${graph.process_id}">${shapes}${diagramEdges}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

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

export { DEMO_GRAPH, makeBpmnXml };
