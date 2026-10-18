import copy
import json
import logging
import re
from typing import Dict, Any, List, Tuple, Optional
from app.schemas.process_graph import AutoBPMNGraph, Node, Edge
from app.schemas.graph_patch import GraphPatch, AiEditRequest
from app.services.validator import validate_process_graph
from app.services.copilot import call_copilot_llm

logger = logging.getLogger(__name__)


def compute_diff_summary(before: AutoBPMNGraph, after: AutoBPMNGraph) -> Dict[str, Any]:
    """Menghitung ringkasan perbedaan (diff) antara dua state graf proses."""
    before_nodes = {n.id: n for n in before.nodes}
    after_nodes = {n.id: n for n in after.nodes}

    added_nodes = [after_nodes[nid].model_dump() for nid in after_nodes if nid not in before_nodes]
    removed_nodes = [before_nodes[nid].model_dump() for nid in before_nodes if nid not in after_nodes]
    modified_nodes = []

    for nid in before_nodes:
        if nid in after_nodes:
            b_n = before_nodes[nid]
            a_n = after_nodes[nid]
            changes = {}
            if b_n.name != a_n.name:
                changes["name"] = {"from": b_n.name, "to": a_n.name}
            if b_n.actor != a_n.actor:
                changes["actor"] = {"from": b_n.actor, "to": a_n.actor}
            if b_n.type != a_n.type:
                changes["type"] = {"from": b_n.type, "to": a_n.type}
            if changes:
                modified_nodes.append({
                    "id": nid,
                    "changes": changes
                })

    def edge_key(e: Edge) -> Tuple[str, str]:
        return (e.from_node, e.to_node)

    before_edges = {edge_key(e): e for e in before.edges}
    after_edges = {edge_key(e): e for e in after.edges}

    added_edges = [after_edges[k].model_dump() for k in after_edges if k not in before_edges]
    removed_edges = [before_edges[k].model_dump() for k in before_edges if k not in after_edges]
    modified_edges = []

    for k in before_edges:
        if k in after_edges:
            b_e = before_edges[k]
            a_e = after_edges[k]
            if b_e.condition != a_e.condition:
                modified_edges.append({
                    "from_node": k[0],
                    "to_node": k[1],
                    "condition": {"from": b_e.condition, "to": a_e.condition}
                })

    return {
        "added_nodes": added_nodes,
        "removed_nodes": removed_nodes,
        "modified_nodes": modified_nodes,
        "added_edges": added_edges,
        "removed_edges": removed_edges,
        "modified_edges": modified_edges,
        "total_changes": len(added_nodes) + len(removed_nodes) + len(modified_nodes) + len(added_edges) + len(removed_edges) + len(modified_edges)
    }


def validate_and_apply_patch(
    graph: AutoBPMNGraph,
    patch: GraphPatch
) -> Tuple[bool, Optional[AutoBPMNGraph], List[str], Dict[str, Any]]:
    """
    Menerapkan patch operasi terstruktur ke graf secara deterministik.
    Memvalidasi integritas sebelum dan sesudah perubahan.
    """
    issues: List[str] = []
    new_graph = copy.deepcopy(graph)

    node_map = {n.id: n for n in new_graph.nodes}
    actors_set = set(new_graph.actors)

    for idx, raw_op in enumerate(patch.operations):
        op_type = raw_op.get("op")

        if op_type == "add_node":
            node_data = raw_op.get("node")
            if not node_data or "id" not in node_data or "type" not in node_data or "name" not in node_data:
                issues.append(f"Operasi #{idx+1} [add_node] tidak memiliki data node yang valid.")
                continue

            nid = node_data["id"]
            if nid in node_map:
                issues.append(f"Gagal menambahkan node: ID '{nid}' sudah ada dalam diagram.")
                continue

            new_node = Node(
                id=nid,
                type=node_data["type"],
                name=node_data["name"],
                actor=node_data.get("actor", "System")
            )
            new_graph.nodes.append(new_node)
            node_map[nid] = new_node
            if new_node.actor:
                actors_set.add(new_node.actor)

        elif op_type == "remove_node":
            nid = raw_op.get("node_id")
            if not nid or nid not in node_map:
                issues.append(f"Operasi #{idx+1} [remove_node]: Node '{nid}' tidak ditemukan.")
                continue

            # Hapus node
            new_graph.nodes = [n for n in new_graph.nodes if n.id != nid]
            del node_map[nid]

            # Bersihkan edge yang terhubung ke node yang dihapus
            new_graph.edges = [e for e in new_graph.edges if e.from_node != nid and e.to_node != nid]

        elif op_type == "update_node":
            nid = raw_op.get("node_id")
            if not nid or nid not in node_map:
                issues.append(f"Operasi #{idx+1} [update_node]: Node '{nid}' tidak ditemukan.")
                continue

            target = node_map[nid]
            if "name" in raw_op and raw_op["name"] is not None:
                target.name = raw_op["name"]
            if "actor" in raw_op and raw_op["actor"] is not None:
                target.actor = raw_op["actor"]
                actors_set.add(raw_op["actor"])
            if "type" in raw_op and raw_op["type"] is not None:
                target.type = raw_op["type"]

        elif op_type == "add_edge":
            edge_data = raw_op.get("edge") or raw_op
            from_n = edge_data.get("from_node")
            to_n = edge_data.get("to_node")
            cond = edge_data.get("condition")

            if not from_n or from_n not in node_map:
                issues.append(f"Operasi #{idx+1} [add_edge]: Node asal '{from_n}' tidak ditemukan.")
                continue
            if not to_n or to_n not in node_map:
                issues.append(f"Operasi #{idx+1} [add_edge]: Node tujuan '{to_n}' tidak ditemukan.")
                continue

            # Hindari edge duplikat
            existing = any(e.from_node == from_n and e.to_node == to_n for e in new_graph.edges)
            if existing:
                # Update condition jika sudah ada
                for e in new_graph.edges:
                    if e.from_node == from_n and e.to_node == to_n:
                        e.condition = cond
            else:
                new_graph.edges.append(Edge(from_node=from_n, to_node=to_n, condition=cond))

        elif op_type == "remove_edge":
            from_n = raw_op.get("from_node")
            to_n = raw_op.get("to_node")
            new_graph.edges = [e for e in new_graph.edges if not (e.from_node == from_n and e.to_node == to_n)]

        elif op_type == "update_edge":
            from_n = raw_op.get("from_node")
            to_n = raw_op.get("to_node")
            cond = raw_op.get("condition")
            found = False
            for e in new_graph.edges:
                if e.from_node == from_n and e.to_node == to_n:
                    e.condition = cond
                    found = True
                    break
            if not found:
                issues.append(f"Operasi #{idx+1} [update_edge]: Alur dari '{from_n}' ke '{to_n}' tidak ditemukan.")

        elif op_type == "insert_step_between":
            from_n = raw_op.get("from_node")
            to_n = raw_op.get("to_node")
            node_data = raw_op.get("new_node")

            if not from_n or from_n not in node_map:
                issues.append(f"Operasi #{idx+1} [insert_step_between]: Node asal '{from_n}' tidak ditemukan.")
                continue
            if not to_n or to_n not in node_map:
                issues.append(f"Operasi #{idx+1} [insert_step_between]: Node tujuan '{to_n}' tidak ditemukan.")
                continue
            if not node_data or "id" not in node_data or "name" not in node_data:
                issues.append(f"Operasi #{idx+1} [insert_step_between]: Node baru tidak valid.")
                continue

            nid = node_data["id"]
            if nid in node_map:
                issues.append(f"Operasi #{idx+1} [insert_step_between]: ID '{nid}' sudah ada.")
                continue

            # 1. Tambah node baru
            new_node = Node(
                id=nid,
                type=node_data.get("type", "userTask"),
                name=node_data["name"],
                actor=node_data.get("actor", "System")
            )
            new_graph.nodes.append(new_node)
            node_map[nid] = new_node
            if new_node.actor:
                actors_set.add(new_node.actor)

            # 2. Hapus edge langsung lama antara from_n dan to_n (jika ada)
            old_condition = None
            kept_edges = []
            for e in new_graph.edges:
                if e.from_node == from_n and e.to_node == to_n:
                    old_condition = e.condition
                else:
                    kept_edges.append(e)
            new_graph.edges = kept_edges

            # 3. Buat edge masuk dan keluar
            cond_from = raw_op.get("condition_from", old_condition)
            cond_to = raw_op.get("condition_to", None)

            new_graph.edges.append(Edge(from_node=from_n, to_node=nid, condition=cond_from))
            new_graph.edges.append(Edge(from_node=nid, to_node=to_n, condition=cond_to))

        else:
            issues.append(f"Operasi #{idx+1}: Tipe operasi tidak dikenali '{op_type}'.")

    new_graph.actors = sorted(list(actors_set))

    # Validasi integritas graf hasil patch
    val_report = validate_process_graph(new_graph)
    if not val_report["is_valid"]:
        issues.extend(val_report["issues"])

    diff = compute_diff_summary(graph, new_graph)
    is_valid = len(issues) == 0

    return (is_valid, new_graph if is_valid else None, issues, diff)


def build_scoped_context(request: AiEditRequest) -> str:
    """
    Membangun konteks ringkas (scoped context) untuk AI editor tanpa membocorkan seluruh graf mentah.
    """
    graph = request.current_graph
    nodes_summary = []
    edges_summary = []

    sel_id = request.selected_node_id

    # Jika ada selected node, sorot node dan 1-hop sekitarnya
    if sel_id:
        target_node = next((n for n in graph.nodes if n.id == sel_id), None)
        in_edges = [e for e in graph.edges if e.to_node == sel_id]
        out_edges = [e for e in graph.edges if e.from_node == sel_id]

        context_str = f"Fokus Perubahan: Node '{target_node.name if target_node else sel_id}' ({sel_id})\n"
        if target_node:
            context_str += f"- Tipe: {target_node.type}, Aktor: {target_node.actor}\n"
        if out_edges:
            out_desc = [f"{e.to_node} (kondisi: {e.condition or '-'})" for e in out_edges]
            context_str += f"- Alur Keluar ke: {', '.join(out_desc)}\n"
        return context_str

    # Jika tidak ada node spesifik, berikan ringkasan alur sekuensial
    for n in graph.nodes:
        nodes_summary.append(f"{n.id} ({n.type}, actor: {n.actor}): {n.name}")
    for e in graph.edges:
        cond_str = f" [{e.condition}]" if e.condition else ""
        edges_summary.append(f"{e.from_node} -> {e.to_node}{cond_str}")

    return f"Proses: {graph.process_name}\nNodes:\n" + "\n".join(nodes_summary) + "\nAlur:\n" + "\n".join(edges_summary)


def generate_ai_patch(request: AiEditRequest) -> GraphPatch:
    """
    Meminta LLM menghasilkan patch terstruktur berdasarkan instruksi natural language.
    Jika provider tidak tersedia, beralih ke simulasi cerdas (prototype mode).
    """
    scoped_ctx = build_scoped_context(request)

    prompt_system = """Anda adalah Senior BPMN Workflow Architect.
Tugas Anda adalah memodifikasi alur diagram proses bisnis berdasarkan instruksi pengguna.
HANYA kembalikan patch terstruktur yang memuat operasi minimum yang diperlukan (targeted patch), BUKAN seluruh graf.

Format respons WAJIB berupa JSON murni dengan skema:
{
  "description": "Penjelasan singkat perubahan dalam Bahasa Indonesia",
  "rationale": "Alasan kepatuhan aturan proses di balik perubahan",
  "target_node_ids": ["id_node_yang_terpengaruh"],
  "operations": [
    {
      "op": "add_node" | "remove_node" | "update_node" | "add_edge" | "remove_edge" | "update_edge" | "insert_step_between",
      ...spesifikasi parameter operasi...
    }
  ]
}

Aturan operasi:
- add_node: {"op": "add_node", "node": {"id": "...", "type": "userTask"|"serviceTask"|"exclusiveGateway"|"parallelGateway", "name": "...", "actor": "..."}}
- remove_node: {"op": "remove_node", "node_id": "..."}
- update_node: {"op": "update_node", "node_id": "...", "name": "...", "actor": "...", "type": "..."}
- add_edge: {"op": "add_edge", "edge": {"from_node": "...", "to_node": "...", "condition": "..."}}
- remove_edge: {"op": "remove_edge", "from_node": "...", "to_node": "..."}
- update_edge: {"op": "update_edge", "from_node": "...", "to_node": "...", "condition": "..."}
- insert_step_between: {"op": "insert_step_between", "from_node": "...", "to_node": "...", "new_node": {"id": "...", "type": "...", "name": "...", "actor": "..."}, "condition_from": null, "condition_to": null}

Jaga agar diagram tetap valid BPMN 2.0 (selalu terhubung dari startEvent ke endEvent tanpa deadlock).
Jika SOP Tambahan diberikan, perlakukan sebagai extend: pertahankan seluruh langkah dan alur yang ada,
gunakan operasi penambahan/penyisipan saja, dan jangan menghapus atau mengganti bagian lama.
"""

    sop_context = (
        f"\nSOP Tambahan yang menjadi sumber perubahan:\n{request.sop_context}\n"
        if request.sop_context
        else ""
    )
    prompt_user = f"""Konteks Diagram Saat Ini:
{scoped_ctx}
{sop_context}

Instruksi Perubahan:
"{request.prompt}"

Hasilkan JSON GraphPatch yang valid."""

    try:
        combined_prompt = f"{prompt_system}\n\n{prompt_user}"
        response_text = call_copilot_llm(combined_prompt)

        # Parse JSON
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]

        parsed = json.loads(clean_text.strip())
        patch = GraphPatch(**parsed)
        additive_operations = {"add_node", "add_edge", "insert_step_between"}
        if request.sop_context and any(
            operation.get("op") not in additive_operations
            for operation in patch.operations
        ):
            raise ValueError("Extend hanya boleh menambahkan atau menyisipkan langkah.")
        return patch

    except Exception as e:
        logger.warning(f"AI Edit LLM call failed or fell back: {e}. Menggunakan simulasi lokal cerdas.")
        return generate_simulated_patch(request)


def generate_simulated_patch(request: AiEditRequest) -> GraphPatch:
    """
    Fallback patch generator deterministik untuk Prototype Mode atau saat provider offline.
    Mendukung skenario umum editing BA: menambah langkah verifikasi, ganti aktor, atau hapus langkah.
    """
    prompt_lower = request.prompt.lower()
    graph = request.current_graph
    sel_id = request.selected_node_id

    if request.sop_context and request.sop_context.strip():
        end_ids = {node.id for node in graph.nodes if node.type == "endEvent"}
        end_edge = next((edge for edge in graph.edges if edge.to_node in end_ids), None)
        if not end_edge:
            raise ValueError("Tidak ditemukan alur menuju akhir proses untuk menambahkan langkah SOP.")

        names = []
        for line in re.split(r"[\r\n]+|(?<=[.!?])\s+", request.sop_context):
            cleaned = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip()
            if re.match(r"^(?:sop(?:\s|:)|standar operasional prosedur\b)", cleaned, re.IGNORECASE):
                continue
            if len(cleaned) > 4:
                names.append(cleaned[:100])
            if len(names) == 4:
                break
        if not names:
            raise ValueError("Tambahkan setidaknya satu langkah baru untuk memperluas diagram.")

        used_ids = {node.id for node in graph.nodes}
        operations = []
        previous_id = end_edge.from_node
        for index, name in enumerate(names, start=1):
            node_id = f"extend_step_{len(graph.nodes) + index}"
            while node_id in used_ids:
                node_id += "_new"
            used_ids.add(node_id)
            operations.append({
                "op": "insert_step_between",
                "from_node": previous_id,
                "to_node": end_edge.to_node,
                "new_node": {
                    "id": node_id,
                    "type": "userTask",
                    "name": name,
                    "actor": "Belum ditentukan",
                },
            })
            previous_id = node_id

        return GraphPatch(
            patch_id="sim_patch_extend_sop",
            description=f"Menambahkan {len(names)} langkah dari sumber SOP",
            rationale="Diagram yang sudah ada dipertahankan; hanya langkah tambahan yang disisipkan.",
            target_node_ids=[end_edge.from_node, end_edge.to_node],
            operations=operations,
        )

    # Skenario 1: Ubah penanggung jawab / aktor
    if "ubah" in prompt_lower and ("aktor" in prompt_lower or "peran" in prompt_lower or "pelaksana" in prompt_lower or "menjadi" in prompt_lower):
        target_id = sel_id or (graph.nodes[1].id if len(graph.nodes) > 1 else "task_1")
        target_node = next((n for n in graph.nodes if n.id == target_id), None)
        new_actor = "Bagian Kepatuhan & Legal"
        if "manajer" in prompt_lower or "manager" in prompt_lower:
            new_actor = "Manager Divisi"
        elif "keuangan" in prompt_lower:
            new_actor = "Bagian Keuangan"
        elif "logistik" in prompt_lower:
            new_actor = "Bagian Logistik"

        return GraphPatch(
            patch_id="sim_patch_update_actor",
            description=f"Mengubah pelaksana tugas pada langkah '{target_node.name if target_node else target_id}' menjadi {new_actor}",
            rationale="Penyesuaian matriks wewenang operasional SOP sesuai permintaan pengguna.",
            target_node_ids=[target_id],
            operations=[
                {
                    "op": "update_node",
                    "node_id": target_id,
                    "actor": new_actor
                }
            ]
        )

    # Skenario 2: Hapus langkah
    if "hapus" in prompt_lower and sel_id:
        target_node = next((n for n in graph.nodes if n.id == sel_id), None)
        in_nodes = [e.from_node for e in graph.edges if e.to_node == sel_id]
        out_nodes = [e.to_node for e in graph.edges if e.from_node == sel_id]

        ops = [{"op": "remove_node", "node_id": sel_id}]
        # Hubungkan kembali alur jika memungkinkan
        if in_nodes and out_nodes:
            ops.append({
                "op": "add_edge",
                "edge": {"from_node": in_nodes[0], "to_node": out_nodes[0], "condition": None}
            })

        return GraphPatch(
            patch_id="sim_patch_remove_step",
            description=f"Menghapus langkah '{target_node.name if target_node else sel_id}' dan menyambungkan kembali alur proses",
            rationale="Penyederhanaan alur proses bisnis dengan mengeliminasi langkah yang tidak diperlukan.",
            target_node_ids=[sel_id],
            operations=ops
        )

    # Skenario 3: Sisipkan langkah verifikasi / review (default cerdas)
    from_node = sel_id
    to_node = None
    if from_node:
        out_edges = [e for e in graph.edges if e.from_node == from_node]
        if out_edges:
            to_node = out_edges[0].to_node

    if not from_node or not to_node:
        # Sisipkan antara langkah pertama dan kedua
        user_tasks = [n for n in graph.nodes if n.type in ("userTask", "serviceTask")]
        if len(user_tasks) >= 2:
            from_node = user_tasks[0].id
            to_node = user_tasks[1].id
        else:
            from_node = graph.nodes[0].id
            to_node = graph.nodes[-1].id

    new_id = f"task_verify_{len(graph.nodes) + 1}"
    new_name = "Verifikasi Kepatuhan & Anggaran"
    if "notifikasi" in prompt_lower:
        new_name = "Kirim Notifikasi Status ke Pemohon"
    elif "legal" in prompt_lower:
        new_name = "Tinjauan Klausul Legal & Kontrak"

    return GraphPatch(
        patch_id="sim_patch_insert_step",
        description=f"Menyisipkan langkah '{new_name}' ke dalam alur proses",
        rationale="Peningkatan kontrol kepatuhan operasional sesuai rekomendasi analisis alur bisnis.",
        target_node_ids=[from_node, to_node],
        operations=[
            {
                "op": "insert_step_between",
                "from_node": from_node,
                "to_node": to_node,
                "new_node": {
                    "id": new_id,
                    "type": "userTask",
                    "name": new_name,
                    "actor": "Bagian Kepatuhan"
                }
            }
        ]
    )
