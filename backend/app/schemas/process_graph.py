from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# Tipe elemen BPMN 2.0 standar yang didukung oleh AutoBPMN
NodeType = Literal[
    "startEvent",
    "userTask",
    "serviceTask",
    "exclusiveGateway",
    "parallelGateway",
    "endEvent",
]


class Node(BaseModel):
    id: str = Field(
        ...,
        description="Pengidentifikasi unik untuk node (contoh: 'start_1', 'task_1', 'gw_1', 'end_1')",
    )
    type: NodeType = Field(
        ...,
        description="Tipe elemen proses bisnis BPMN (startEvent, userTask, serviceTask, exclusiveGateway, parallelGateway, endEvent)",
    )
    name: str = Field(
        ...,
        description="Label deskriptif aktivitas atau nama gerbang keputusan",
    )
    actor: str = Field(
        default="System",
        description="Peran, divisi, atau sistem pelaksana tugas",
    )


class Edge(BaseModel):
    from_node: str = Field(
        ...,
        description="ID simpul asal (source node ID)",
    )
    to_node: str = Field(
        ...,
        description="ID simpul tujuan (target node ID)",
    )
    condition: Optional[str] = Field(
        default=None,
        description="Kondisi logika percabangan jika berasal dari gateway (contoh: 'Lengkap', 'Tidak Lengkap')",
    )


class AutoBPMNGraph(BaseModel):
    process_id: str = Field(
        ...,
        description="ID unik proses dalam format snake_case tanpa spasi",
    )
    process_name: str = Field(
        ...,
        description="Nama judul SOP operasional proses bisnis",
    )
    actors: List[str] = Field(
        default_factory=list,
        description="Daftar seluruh entitas aktor/role yang terlibat dalam SOP",
    )
    nodes: List[Node] = Field(
        ...,
        description="Daftar simpul (start, tasks, gateways, end) dalam proses",
    )
    edges: List[Edge] = Field(
        ...,
        description="Daftar relasi berarah (sequence flows) antar-simpul",
    )
