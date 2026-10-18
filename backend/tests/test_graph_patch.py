import pytest
from app.schemas.process_graph import AutoBPMNGraph, Node, Edge
from app.schemas.graph_patch import GraphPatch, AiEditRequest
from app.services.graph_patcher import (
    validate_and_apply_patch,
    generate_ai_patch,
    generate_simulated_patch,
)


@pytest.fixture
def sample_graph():
    return AutoBPMNGraph(
        process_id="test_proc",
        process_name="Test Process",
        actors=["Pemohon", "Manager", "System"],
        nodes=[
            Node(id="start_1", type="startEvent", name="Start", actor=""),
            Node(id="task_1", type="userTask", name="Isi Formulir", actor="Pemohon"),
            Node(id="task_2", type="userTask", name="Review", actor="Manager"),
            Node(id="end_1", type="endEvent", name="End", actor=""),
        ],
        edges=[
            Edge(from_node="start_1", to_node="task_1", condition=None),
            Edge(from_node="task_1", to_node="task_2", condition=None),
            Edge(from_node="task_2", to_node="end_1", condition=None),
        ]
    )


def test_insert_step_between(sample_graph):
    patch = GraphPatch(
        description="Sisipkan langkah verifikasi di antara task_1 dan task_2",
        operations=[
            {
                "op": "insert_step_between",
                "from_node": "task_1",
                "to_node": "task_2",
                "new_node": {
                    "id": "task_verify",
                    "type": "serviceTask",
                    "name": "Verifikasi Otomatis",
                    "actor": "System"
                }
            }
        ]
    )

    is_valid, new_graph, issues, diff = validate_and_apply_patch(sample_graph, patch)
    assert is_valid is True
    assert len(issues) == 0
    assert len(new_graph.nodes) == 5
    assert any(n.id == "task_verify" for n in new_graph.nodes)

    # Pastikan alur lama dihapus dan alur baru terpasang
    assert not any(e.from_node == "task_1" and e.to_node == "task_2" for e in new_graph.edges)
    assert any(e.from_node == "task_1" and e.to_node == "task_verify" for e in new_graph.edges)
    assert any(e.from_node == "task_verify" and e.to_node == "task_2" for e in new_graph.edges)
    assert diff["total_changes"] >= 3


def test_update_node_actor_and_name(sample_graph):
    patch = GraphPatch(
        description="Ganti pelaksana Review",
        operations=[
            {
                "op": "update_node",
                "node_id": "task_2",
                "name": "Review Legal",
                "actor": "Bagian Legal"
            }
        ]
    )

    is_valid, new_graph, issues, diff = validate_and_apply_patch(sample_graph, patch)
    assert is_valid is True
    assert "Bagian Legal" in new_graph.actors
    target = next(n for n in new_graph.nodes if n.id == "task_2")
    assert target.name == "Review Legal"
    assert target.actor == "Bagian Legal"
    assert len(diff["modified_nodes"]) == 1


def test_invalid_patch_rejected_safely(sample_graph):
    # Coba buat edge ke node fiktif
    patch = GraphPatch(
        description="Patch rusak",
        operations=[
            {
                "op": "add_edge",
                "from_node": "task_1",
                "to_node": "non_existent_node"
            }
        ]
    )

    is_valid, new_graph, issues, _ = validate_and_apply_patch(sample_graph, patch)
    assert is_valid is False
    assert new_graph is None
    assert any("tidak ditemukan" in issue for issue in issues)


def test_simulated_ai_patch_generation(sample_graph):
    req = AiEditRequest(
        prompt="Ubah pelaksana review menjadi Bagian Keuangan",
        current_graph=sample_graph,
        selected_node_id="task_2"
    )
    patch = generate_simulated_patch(req)
    assert len(patch.operations) > 0
    is_valid, new_graph, issues, _ = validate_and_apply_patch(sample_graph, patch)
    assert is_valid is True
    assert any(n.actor == "Bagian Keuangan" for n in new_graph.nodes)


def test_simulated_sop_extension_preserves_existing_steps(sample_graph):
    req = AiEditRequest(
        prompt="Tambahkan langkah dari SOP tambahan saja",
        current_graph=sample_graph,
        sop_context=(
            "SOP Pengadaan Barang\n"
            "1. Petugas mengirim notifikasi hasil pemeriksaan.\n"
            "2. Pemohon menerima konfirmasi."
        ),
    )
    patch = generate_simulated_patch(req)

    assert all(operation["op"] == "insert_step_between" for operation in patch.operations)
    is_valid, new_graph, issues, diff = validate_and_apply_patch(sample_graph, patch)
    assert is_valid is True
    assert issues == []
    assert len(diff["added_nodes"]) == 2
    assert not diff["removed_nodes"]
    assert {node.id for node in sample_graph.nodes}.issubset({node.id for node in new_graph.nodes})


def test_ai_sop_extension_falls_back_when_patch_rewrites_existing_graph(sample_graph, monkeypatch):
    monkeypatch.setattr(
        "app.services.graph_patcher.call_copilot_llm",
        lambda _prompt: (
            '{"description":"Menghapus langkah lama","operations":'
            '[{"op":"remove_node","node_id":"task_1"}]}'
        ),
    )
    req = AiEditRequest(
        prompt="Tambahkan aturan tambahan",
        current_graph=sample_graph,
        sop_context="Tambahkan pemeriksaan oleh petugas sebelum proses berakhir.",
    )

    patch = generate_ai_patch(req)

    assert patch.operations
    assert all(
        operation["op"] in {"add_node", "add_edge", "insert_step_between"}
        for operation in patch.operations
    )
