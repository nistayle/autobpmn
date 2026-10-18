const GRAPH = {
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

const BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_pengadaan" targetNamespace="http://autobpmn.org/schema">
  <bpmn:process id="pengadaan_perlengkapan_kantor" name="SOP Pengadaan Perlengkapan Kantor" isExecutable="true">
    <bpmn:startEvent id="start_1" name="Mulai"><bpmn:outgoing>flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="task_1" name="Isi Formulir Pengadaan&#10;(Pemohon)"><bpmn:incoming>flow_1</bpmn:incoming><bpmn:outgoing>flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="task_2" name="Tinjau Urgensi &amp; Anggaran&#10;(Manager Divisi)"><bpmn:incoming>flow_2</bpmn:incoming><bpmn:outgoing>flow_3</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="gw_1" name="Persetujuan"><bpmn:incoming>flow_3</bpmn:incoming><bpmn:outgoing>flow_4</bpmn:outgoing><bpmn:outgoing>flow_5</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:serviceTask id="task_3" name="Kembalikan Formulir"><bpmn:incoming>flow_4</bpmn:incoming><bpmn:outgoing>flow_6</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:userTask id="task_4" name="Cari Vendor &amp; Bandingkan Harga&#10;(Bagian Pengadaan)"><bpmn:incoming>flow_5</bpmn:incoming><bpmn:outgoing>flow_7</bpmn:outgoing></bpmn:userTask>
    <bpmn:serviceTask id="task_5" name="Kirim Barang Pesanan&#10;(Vendor)"><bpmn:incoming>flow_7</bpmn:incoming><bpmn:outgoing>flow_8</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:userTask id="task_6" name="Terima Barang &amp; Tanda Tangan BA&#10;(Pemohon)"><bpmn:incoming>flow_8</bpmn:incoming><bpmn:outgoing>flow_9</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="end_1" name="Selesai"><bpmn:incoming>flow_6</bpmn:incoming><bpmn:incoming>flow_9</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_1" sourceRef="start_1" targetRef="task_1" />
    <bpmn:sequenceFlow id="flow_2" sourceRef="task_1" targetRef="task_2" />
    <bpmn:sequenceFlow id="flow_3" sourceRef="task_2" targetRef="gw_1" />
    <bpmn:sequenceFlow id="flow_4" name="Ditolak" sourceRef="gw_1" targetRef="task_3" />
    <bpmn:sequenceFlow id="flow_5" name="Disetujui" sourceRef="gw_1" targetRef="task_4" />
    <bpmn:sequenceFlow id="flow_6" sourceRef="task_3" targetRef="end_1" />
    <bpmn:sequenceFlow id="flow_7" sourceRef="task_4" targetRef="task_5" />
    <bpmn:sequenceFlow id="flow_8" sourceRef="task_5" targetRef="task_6" />
    <bpmn:sequenceFlow id="flow_9" sourceRef="task_6" targetRef="end_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_pengadaan"><bpmndi:BPMNPlane id="Plane_pengadaan" bpmnElement="pengadaan_perlengkapan_kantor">
    <bpmndi:BPMNShape id="shape_start" bpmnElement="start_1"><dc:Bounds x="52" y="162" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_task_1" bpmnElement="task_1"><dc:Bounds x="130" y="140" width="160" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_task_2" bpmnElement="task_2"><dc:Bounds x="365" y="140" width="160" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_gw" bpmnElement="gw_1"><dc:Bounds x="605" y="155" width="50" height="50" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_task_3" bpmnElement="task_3"><dc:Bounds x="745" y="290" width="160" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_task_4" bpmnElement="task_4"><dc:Bounds x="745" y="90" width="175" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_task_5" bpmnElement="task_5"><dc:Bounds x="1010" y="90" width="160" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_task_6" bpmnElement="task_6"><dc:Bounds x="1240" y="90" width="180" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="shape_end" bpmnElement="end_1"><dc:Bounds x="1490" y="162" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="edge_1" bpmnElement="flow_1"><di:waypoint x="88" y="180" /><di:waypoint x="130" y="180" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_2" bpmnElement="flow_2"><di:waypoint x="290" y="180" /><di:waypoint x="365" y="180" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_3" bpmnElement="flow_3"><di:waypoint x="525" y="180" /><di:waypoint x="605" y="180" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_4" bpmnElement="flow_4"><di:waypoint x="630" y="205" /><di:waypoint x="630" y="330" /><di:waypoint x="745" y="330" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_5" bpmnElement="flow_5"><di:waypoint x="630" y="155" /><di:waypoint x="630" y="130" /><di:waypoint x="745" y="130" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_6" bpmnElement="flow_6"><di:waypoint x="905" y="330" /><di:waypoint x="1450" y="330" /><di:waypoint x="1450" y="180" /><di:waypoint x="1490" y="180" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_7" bpmnElement="flow_7"><di:waypoint x="920" y="130" /><di:waypoint x="1010" y="130" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_8" bpmnElement="flow_8"><di:waypoint x="1170" y="130" /><di:waypoint x="1240" y="130" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="edge_9" bpmnElement="flow_9"><di:waypoint x="1420" y="130" /><di:waypoint x="1450" y="130" /><di:waypoint x="1450" y="180" /><di:waypoint x="1490" y="180" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Simulates the response contract of /pipeline/process-* without network I/O. */
export function simulatePipelineResponse() {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve({
      process_id: GRAPH.process_id,
      process_name: GRAPH.process_name,
      validation: { is_valid: true, issues: [], deadlocks: [], orphan_nodes: [] },
      intermediate_graph: structuredClone(GRAPH),
      bpmn_xml: BPMN_XML,
    }), 650);
  });
}
