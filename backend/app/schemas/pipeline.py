from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.process_graph import AutoBPMNGraph


class TextInputRequest(BaseModel):
    title: Optional[str] = Field(
        default="Dokumen SOP",
        description="Judul atau identitas berkas dokumen",
        examples=["SOP Pengadaan ATK PT Javan"],
    )
    text_content: str = Field(
        ...,
        min_length=20,
        description="Teks narasi atau tabel langkah-langkah SOP",
        examples=[
            "1. Pemohon mengajukan form pengadaan ke Atasan. "
            "2. Atasan memeriksa anggaran. Jika disetujui, diteruskan ke bagian Pengadaan. "
            "Jika ditolak, proses dibatalkan. 3. Bagian Pengadaan memesan barang dan proses selesai."
        ],
    )


class ValidationReport(BaseModel):
    is_valid: bool = Field(
        ...,
        description="Status apakah graf bebas dari cacat logika alur",
        examples=[True],
    )
    issues: List[str] = Field(
        default_factory=list,
        description="Daftar rincian anomali atau pesan error jika validasi gagal",
    )
    deadlocks: List[str] = Field(
        default_factory=list,
        description="Daftar node ID yang mengalami kebuntuan alur tanpa jalur keluar",
    )
    orphan_nodes: List[str] = Field(
        default_factory=list,
        description="Daftar node ID yang tidak memiliki jalur masuk / tidak dapat dicapai",
    )


class PipelineResponse(BaseModel):
    process_id: str = Field(
        ...,
        description="ID proses yang diekstrak",
        examples=["sop_pengadaan_atk"],
    )
    process_name: str = Field(
        ...,
        description="Nama proses yang diekstrak",
        examples=["SOP Pengadaan Alat Tulis Kantor"],
    )
    validation: ValidationReport = Field(
        ...,
        description="Laporan hasil uji validasi logika alur",
    )
    intermediate_graph: AutoBPMNGraph = Field(
        ...,
        description="Struktur data graf JSON perantara",
    )
    bpmn_xml: str = Field(
        ...,
        description="Berkas format BPMN 2.0 XML standar yang siap dieksekusi",
    )
    source_text: Optional[str] = Field(
        default=None,
        description="Teks sumber SOP yang diekstrak untuk disimpan bersama file dan digunakan Copilot",
    )