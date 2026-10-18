from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SopChunk(BaseModel):
    chunk_id: str = Field(..., description="ID stabil untuk potongan teks SOP")
    section: Optional[str] = Field(default=None, description="Nomor atau nama pasal/seksi SOP")
    step: Optional[int] = Field(default=None, description="Nomor urut langkah jika ada")
    page: Optional[int] = Field(default=None, description="Nomor halaman jika bersumber dari PDF")
    text: str = Field(..., description="Isi teks potongan SOP")


class SelectedElementContext(BaseModel):
    id: str = Field(..., description="ID node BPMN terpilih (misal: task_1, gw_1)")
    type: str = Field(..., description="Tipe elemen BPMN (misal: userTask, exclusiveGateway)")
    name: str = Field(default="", description="Label atau nama aktivitas")
    actor: Optional[str] = Field(default=None, description="Aktor/peran pelaksana jika ada")
    incoming: List[str] = Field(default_factory=list, description="Daftar node masuk")
    outgoing: List[str] = Field(default_factory=list, description="Daftar node keluar")
    documentation: Optional[str] = Field(default=None, description="Dokumentasi elemen jika ada")


class GraphSummaryContext(BaseModel):
    tasks_count: int = Field(default=0, description="Total aktivitas dalam proses")
    gateways_count: int = Field(default=0, description="Total titik keputusan/gateway")
    roles: List[str] = Field(default_factory=list, description="Daftar peran/aktor yang terlibat")


class CopilotChatContext(BaseModel):
    process_name: Optional[str] = Field(default=None, description="Nama proses/SOP")
    sop_chunks: List[SopChunk] = Field(default_factory=list, description="Daftar chunk SOP terindeks")
    selected_element: Optional[SelectedElementContext] = Field(default=None, description="Elemen BPMN yang sedang difokuskan di kanvas")
    graph_summary: Optional[GraphSummaryContext] = Field(default=None, description="Ringkasan struktur graf BPMN")


class ChatMessage(BaseModel):
    role: str = Field(..., description="Peran pesan: 'user' atau 'assistant'")
    content: str = Field(..., description="Teks pesan")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, description="Riwayat percakapan")
    context: Optional[CopilotChatContext] = Field(default=None, description="Konteks terstruktur SOP dan BPMN")
    sop_text: Optional[str] = Field(default=None, description="Teks SOP mentah alternatif jika chunk belum dibuat oleh client")


class Citation(BaseModel):
    chunk_id: str = Field(..., description="chunk_id rujukan dalam konteks SOP")
    section: Optional[str] = Field(default=None, description="Seksi/pasal SOP yang dikutip")
    step: Optional[int] = Field(default=None, description="Langkah nomor jika ada")
    page: Optional[int] = Field(default=None, description="Halaman jika ada")
    quote: str = Field(..., description="Kutipan verbatim pendek dari SOP yang mendasari klaim")


class CopilotResponse(BaseModel):
    answer: str = Field(..., description="Penjelasan langsung dan analisis dari AI Copilot")
    citations: List[Citation] = Field(default_factory=list, description="Daftar sitasi chunk SOP yang memvalidasi jawaban")
    confidence: str = Field(default="high", description="Tingkat keyakinan: 'high', 'medium', 'low'")
    follow_ups: List[str] = Field(default_factory=list, description="Saran pertanyaan lanjutan yang relevan bagi BA")
    warnings: List[str] = Field(default_factory=list, description="Catatan risiko atau ambiguitas dalam SOP")
