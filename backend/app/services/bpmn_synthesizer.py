"""
AutoBPMN BPMN 2.0 Synthesizer
Generates clean, enterprise-grade BPMN 2.0 XML with:
- Top-down / Horizontal Flow:
  * Strict DAG topological rank (feedback edges broken during layering)
  * Branch lane assignment (exclusive branches never overlap)
  * Join node alignment (nodes with multiple inputs positioned after all ancestors)
  * Rectilinear orthogonal routing with lane clearance
  * Clean node label formatting (no text overflow)
"""
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from typing import Dict, Tuple, List, Set, Optional
from app.schemas.process_graph import AutoBPMNGraph, Node, Edge

COLOR_PALETTE = {
    "startEvent": {
        "stroke": "#059669",  # Emerald 600
        "fill": "#ecfdf5",
    },
    "endEvent": {
        "stroke": "#e11d48",  # Rose 600
        "fill": "#fff1f2",
    },
    "userTask": {
        "stroke": "#0284c7",  # Sky 600
        "fill": "#f0f9ff",
    },
    "serviceTask": {
        "stroke": "#7c3aed",  # Violet 600
        "fill": "#f5f3ff",
    },
    "exclusiveGateway": {
        "stroke": "#d97706",  # Amber 600
        "fill": "#fffbeb",
    },
    "parallelGateway": {
        "stroke": "#0891b2",  # Cyan 600
        "fill": "#ecfeff",
    },
    "default": {
        "stroke": "#475569",  # Slate 600
        "fill": "#f8fafc",
    }
}

DIMENSIONS = {
    "startEvent": (36, 36),
    "endEvent": (36, 36),
    "exclusiveGateway": (50, 50),
    "parallelGateway": (50, 50),
    "userTask": (150, 80),
    "serviceTask": (150, 80),
    "default": (150, 80),
}

SLOT_W = 150
SLOT_H = 80


def _find_feedback_edges(graph: AutoBPMNGraph) -> Set[Tuple[str, str]]:
    """Mendeteksi feedback/back-edges (siklus revisi) menggunakan DFS 3-color."""
    node_ids = {n.id for n in graph.nodes}
    adj = defaultdict(list)
    for e in graph.edges:
        if e.from_node in node_ids and e.to_node in node_ids:
            adj[e.from_node].append(e.to_node)

    color: Dict[str, int] = {nid: 0 for nid in node_ids}  # 0: white, 1: gray, 2: black
    back_edges: Set[Tuple[str, str]] = set()

    def dfs(u: str):
        color[u] = 1
        for v in adj[u]:
            if color[v] == 1:
                back_edges.add((u, v))
            elif color[v] == 0:
                dfs(v)
        color[u] = 2

    # Mulai dari startEvent jika ada
    for n in graph.nodes:
        if n.type == "startEvent" and color[n.id] == 0:
            dfs(n.id)
    for n in graph.nodes:
        if color[n.id] == 0:
            dfs(n.id)

    return back_edges


def calculate_layout(graph: AutoBPMNGraph) -> Dict[str, Tuple[int, int, int, int]]:
    """
    Menghitung tata letak koordinat visual graf secara proporsional.
    Menghilangkan penumpukan elemen dan menjamin alur yang mudah dibaca.
    """
    node_map = {n.id: n for n in graph.nodes}
    back_edges = _find_feedback_edges(graph)

    # Buat adjacency list murni DAG (tanpa back-edges)
    dag_adj_out = defaultdict(list)
    dag_in_degree = defaultdict(int)
    for n in graph.nodes:
        dag_in_degree[n.id] = 0

    for e in graph.edges:
        if e.from_node in node_map and e.to_node in node_map:
            if (e.from_node, e.to_node) not in back_edges:
                dag_adj_out[e.from_node].append(e.to_node)
                dag_in_degree[e.to_node] += 1

    # 1. Topological Longest-Path Layering (Rank X)
    ranks: Dict[str, int] = {}
    queue = deque([n.id for n in graph.nodes if dag_in_degree[n.id] == 0])
    for nid in queue:
        ranks[nid] = 0

    in_deg_copy = dict(dag_in_degree)
    while queue:
        curr = queue.popleft()
        curr_rank = ranks[curr]
        for nxt in dag_adj_out[curr]:
            ranks[nxt] = max(ranks.get(nxt, 0), curr_rank + 1)
            in_deg_copy[nxt] -= 1
            if in_deg_copy[nxt] == 0:
                queue.append(nxt)

    # Pastikan semua node punya rank
    for n in graph.nodes:
        if n.id not in ranks:
            ranks[n.id] = 0

    # 2. Track Assignment (Y) dengan Pemisahan Cabang yang Jelas
    # Track 0 = Alur utama. Cabang keputusan diberi track 1, 2, dst.
    tracks: Dict[str, int] = {}
    visited = set()

    start_nodes = [n.id for n in graph.nodes if n.type == "startEvent"]
    if not start_nodes and graph.nodes:
        start_nodes = [graph.nodes[0].id]

    for s_id in start_nodes:
        tracks[s_id] = 0

    queue = deque(start_nodes)
    while queue:
        curr = queue.popleft()
        if curr in visited:
            continue
        visited.add(curr)

        curr_track = tracks.get(curr, 0)
        children = dag_adj_out[curr]
        curr_node = node_map.get(curr)

        if not children:
            continue

        if curr_node and "Gateway" in curr_node.type and len(children) > 1:
            # Cabang pertama tetap pada track saat ini
            # Cabang berikutnya mendapatkan track baru ke bawah
            for idx, child in enumerate(children):
                new_track = curr_track if idx == 0 else curr_track + idx
                if child not in tracks:
                    tracks[child] = new_track
                    queue.append(child)
                else:
                    tracks[child] = max(tracks[child], new_track)
        else:
            for child in children:
                if child not in tracks:
                    tracks[child] = curr_track
                    queue.append(child)

    for n in graph.nodes:
        if n.id not in tracks:
            tracks[n.id] = 0

    # 3. Collision Resolution pada (Rank, Track) yang sama
    # Kelompokkan berdasarkan rank, lalu ratakan track agar tidak bertumpuk
    rank_groups = defaultdict(list)
    for n in graph.nodes:
        rank_groups[ranks[n.id]].append(n.id)

    final_tracks: Dict[str, int] = dict(tracks)
    for r in sorted(rank_groups.keys()):
        nodes_in_rank = rank_groups[r]
        # Urutkan berdasarkan initial track
        nodes_in_rank.sort(key=lambda nid: tracks.get(nid, 0))
        used_tracks_in_col = set()
        for nid in nodes_in_rank:
            t = tracks[nid]
            while t in used_tracks_in_col:
                t += 1
            used_tracks_in_col.add(t)
            final_tracks[nid] = t

    # 4. Hitung Koordinat Nyata (Pixels)
    BASE_X = 60
    BASE_Y = 120
    STEP_X = 240   # Jarak horizontal antar rank (lebar 150 + gap 90)
    STEP_Y = 160   # Jarak vertikal antar track (tinggi 80 + gap 80)

    layout: Dict[str, Tuple[int, int, int, int]] = {}

    for node in graph.nodes:
        r = ranks[node.id]
        t = final_tracks[node.id]

        w, h = DIMENSIONS.get(node.type, DIMENSIONS["default"])

        center_x = BASE_X + (r * STEP_X) + (SLOT_W // 2)
        center_y = BASE_Y + (t * STEP_Y) + (SLOT_H // 2)

        x = center_x - (w // 2)
        y = center_y - (h // 2)

        layout[node.id] = (x, y, w, h)

    return layout


def _calculate_waypoints(
    edge: Edge,
    src_node: Node,
    tgt_node: Node,
    layout: Dict[str, Tuple[int, int, int, int]],
    is_back_edge: bool
) -> List[Tuple[int, int]]:
    """Menghitung rute garis orthogonal siku-siku rapi."""
    src_x, src_y, src_w, src_h = layout[edge.from_node]
    tgt_x, tgt_y, tgt_w, tgt_h = layout[edge.to_node]

    src_cx = src_x + (src_w // 2)
    src_cy = src_y + (src_h // 2)
    tgt_cx = tgt_x + (tgt_w // 2)
    tgt_cy = tgt_y + (tgt_h // 2)

    is_gateway = "Gateway" in src_node.type

    # Kasus A: Loop-back / Alur Mundur (Revisi ke node sebelumnya)
    if is_back_edge or tgt_x <= src_x:
        # Jalur memutar di atas node agar bersih dan tidak memotong alur utama
        clear_y = min(src_y, tgt_y) - 60
        return [
            (src_cx, src_y),          # Keluar dari atas
            (src_cx, clear_y),        # Naik ke clearance track
            (tgt_cx, clear_y),        # Mundur ke kiri
            (tgt_cx, tgt_y)           # Masuk ke atas target
        ]

    # Kasus B: Alur Maju Horizontal Selevel
    if abs(src_cy - tgt_cy) <= 8:
        return [
            (src_x + src_w, src_cy),
            (tgt_x, tgt_cy)
        ]

    # Kasus C: Percabangan Gateway ke Bawah
    if is_gateway and tgt_cy > src_cy:
        return [
            (src_cx, src_y + src_h),  # Keluar bawah gateway
            (src_cx, tgt_cy),          # Siku 90 derajat
            (tgt_x, tgt_cy)           # Masuk kiri target
        ]

    # Kasus D: Percabangan Gateway ke Atas
    if is_gateway and tgt_cy < src_cy:
        return [
            (src_cx, src_y),          # Keluar atas gateway
            (src_cx, tgt_cy),
            (tgt_x, tgt_cy)
        ]

    # Kasus E: Alur Maju Antar Track Berbeda (Siku Orthogonal 2 Titik)
    mid_x = (src_x + src_w + tgt_x) // 2
    return [
        (src_x + src_w, src_cy),
        (mid_x, src_cy),
        (mid_x, tgt_cy),
        (tgt_x, tgt_cy)
    ]


def _format_label(node: Node) -> str:
    """Format label ringkas & proporsional untuk BPMN tanpa teks kepanjangan."""
    name = (node.name or "").strip()
    actor = (node.actor or "").strip()

    if "Event" in node.type or "Gateway" in node.type:
        return name

    # Hapus repetisi nama aktor di awal nama task
    if actor and name.lower().startswith(actor.lower()):
        cleaned = name[len(actor):].strip(" -:,\t\n")
        if cleaned:
            name = cleaned[:1].upper() + cleaned[1:]

    # Batasi panjang kata per baris agar rapi dalam task box
    words = name.split()
    if len(words) > 6:
        name = " ".join(words[:6]) + "..."

    if actor and actor.lower() not in ("system", "none", "", "user"):
        return f"{name}\n({actor})"
    return name


def generate_bpmn_xml(graph: AutoBPMNGraph) -> str:
    """Mengonversi AutoBPMNGraph menjadi BPMN 2.0 XML dengan visual styling enterprise."""

    layout = calculate_layout(graph)
    node_map = {n.id: n for n in graph.nodes}
    back_edges = _find_feedback_edges(graph)

    bpmn_def = ET.Element("bpmn:definitions", {
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
        "xmlns:bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
        "xmlns:dc": "http://www.omg.org/spec/DD/20100524/DC",
        "xmlns:di": "http://www.omg.org/spec/DD/20100524/DI",
        "xmlns:bioc": "http://bpmn.io/schema/bpmn/biocolor/1.0",
        "xmlns:color": "http://www.omg.org/spec/BPMN/non-normative/color/1.0",
        "id": f"Definitions_{graph.process_id}",
        "targetNamespace": "http://autobpmn.org/schema"
    })

    process = ET.SubElement(bpmn_def, "bpmn:process", {
        "id": graph.process_id,
        "name": graph.process_name,
        "isExecutable": "true"
    })

    # Nodes
    for node in graph.nodes:
        tag_name = f"bpmn:{node.type}"
        elem = ET.SubElement(process, tag_name, {
            "id": node.id,
            "name": _format_label(node)
        })

        for edge in graph.edges:
            flow_id = f"flow_{edge.from_node}_{edge.to_node}"
            if edge.from_node == node.id:
                ET.SubElement(elem, "bpmn:outgoing").text = flow_id
            if edge.to_node == node.id:
                ET.SubElement(elem, "bpmn:incoming").text = flow_id

    # Sequence Flows
    for edge in graph.edges:
        flow_id = f"flow_{edge.from_node}_{edge.to_node}"
        flow_attrib = {
            "id": flow_id,
            "sourceRef": edge.from_node,
            "targetRef": edge.to_node
        }
        if edge.condition:
            flow_attrib["name"] = edge.condition

        ET.SubElement(process, "bpmn:sequenceFlow", flow_attrib)

    # BPMNDiagram
    diagram = ET.SubElement(bpmn_def, "bpmndi:BPMNDiagram", {"id": f"BPMNDiagram_{graph.process_id}"})
    plane = ET.SubElement(diagram, "bpmndi:BPMNPlane", {
        "id": f"BPMNPlane_{graph.process_id}",
        "bpmnElement": graph.process_id
    })

    # Shapes
    for node in graph.nodes:
        x, y, w, h = layout.get(node.id, (100, 100, 150, 80))
        palette = COLOR_PALETTE.get(node.type, COLOR_PALETTE["default"])

        shape_attrib = {
            "id": f"BPMNShape_{node.id}",
            "bpmnElement": node.id,
            "bioc:stroke": palette["stroke"],
            "bioc:fill": palette["fill"],
            "color:border-color": palette["stroke"],
            "color:background-color": palette["fill"]
        }
        shape = ET.SubElement(plane, "bpmndi:BPMNShape", shape_attrib)
        ET.SubElement(shape, "dc:Bounds", {
            "x": str(x),
            "y": str(y),
            "width": str(w),
            "height": str(h)
        })

    # Edges & Waypoints
    for edge in graph.edges:
        flow_id = f"flow_{edge.from_node}_{edge.to_node}"
        src_node = node_map.get(edge.from_node)
        tgt_node = node_map.get(edge.to_node)

        if not src_node or not tgt_node:
            continue

        is_back = (edge.from_node, edge.to_node) in back_edges
        waypoints = _calculate_waypoints(edge, src_node, tgt_node, layout, is_back)

        edge_shape = ET.SubElement(plane, "bpmndi:BPMNEdge", {
            "id": f"BPMNEdge_{flow_id}",
            "bpmnElement": flow_id,
            "bioc:stroke": "#64748b",
            "color:border-color": "#64748b"
        })

        for wp_x, wp_y in waypoints:
            ET.SubElement(edge_shape, "di:waypoint", {"x": str(wp_x), "y": str(wp_y)})

    # XML String
    xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_string = ET.tostring(bpmn_def, encoding="utf-8", method="xml").decode("utf-8")

    return xml_declaration + xml_string
