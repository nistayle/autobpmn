from typing import List, Optional, Literal, Dict, Any, Union
from pydantic import BaseModel, Field
from app.schemas.process_graph import Node, Edge, AutoBPMNGraph, NodeType


class AddNodeOp(BaseModel):
    op: Literal["add_node"] = "add_node"
    node: Node = Field(..., description="Node baru yang akan ditambahkan ke diagram")


class RemoveNodeOp(BaseModel):
    op: Literal["remove_node"] = "remove_node"
    node_id: str = Field(..., description="ID node yang akan dihapus")


class UpdateNodeOp(BaseModel):
    op: Literal["update_node"] = "update_node"
    node_id: str = Field(..., description="ID node yang akan diperbarui")
    name: Optional[str] = Field(default=None, description="Label baru node jika diubah")
    actor: Optional[str] = Field(default=None, description="Aktor/peran baru jika diubah")
    type: Optional[NodeType] = Field(default=None, description="Tipe node baru jika diubah")


class AddEdgeOp(BaseModel):
    op: Literal["add_edge"] = "add_edge"
    edge: Edge = Field(..., description="Edge baru yang menghubungkan dua node")


class RemoveEdgeOp(BaseModel):
    op: Literal["remove_edge"] = "remove_edge"
    from_node: str = Field(..., description="ID node asal edge yang akan dihapus")
    to_node: str = Field(..., description="ID node tujuan edge yang akan dihapus")


class UpdateEdgeOp(BaseModel):
    op: Literal["update_edge"] = "update_edge"
    from_node: str = Field(..., description="ID node asal edge")
    to_node: str = Field(..., description="ID node tujuan edge")
    condition: Optional[str] = Field(default=None, description="Kondisi baru jika diubah")


class InsertStepBetweenOp(BaseModel):
    op: Literal["insert_step_between"] = "insert_step_between"
    from_node: str = Field(..., description="ID node pendahulu (upstream)")
    to_node: str = Field(..., description="ID node penerus (downstream)")
    new_node: Node = Field(..., description="Node baru yang disisipkan di antara kedua node")
    condition_from: Optional[str] = Field(default=None, description="Kondisi edge dari from_node ke new_node jika ada")
    condition_to: Optional[str] = Field(default=None, description="Kondisi edge dari new_node ke to_node jika ada")


PatchOperation = Union[
    AddNodeOp,
    RemoveNodeOp,
    UpdateNodeOp,
    AddEdgeOp,
    RemoveEdgeOp,
    UpdateEdgeOp,
    InsertStepBetweenOp,
]


class GraphPatch(BaseModel):
    patch_id: Optional[str] = Field(default=None, description="ID unik operasi patch")
    description: str = Field(..., description="Ringkasan ringkas perubahan yang diajukan")
    rationale: Optional[str] = Field(default=None, description="Alasan atau konteks aturan bisnis di balik perubahan")
    target_node_ids: List[str] = Field(default_factory=list, description="Daftar node yang terpengaruh langsung oleh perubahan")
    operations: List[Dict[str, Any]] = Field(..., description="Daftar operasi terstruktur yang akan dieksekusi")


class AiEditRequest(BaseModel):
    prompt: str = Field(..., description="Instruksi perubahan dalam bahasa alami dari Business Analyst")
    current_graph: AutoBPMNGraph = Field(..., description="Graf proses saat ini")
    selected_node_id: Optional[str] = Field(default=None, description="ID node yang sedang dipilih pengguna jika ada")
    sop_context: Optional[str] = Field(default=None, description="Kutipan teks SOP terkait jika tersedia")


class PatchPreview(BaseModel):
    patch: GraphPatch
    is_valid: bool
    validation_issues: List[str] = Field(default_factory=list)
    diff_summary: Dict[str, Any]
    projected_graph: Optional[AutoBPMNGraph] = None
    bpmn_xml: Optional[str] = None
