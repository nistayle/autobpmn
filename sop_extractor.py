import os
import json
import logging
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# 1. Definisi Pydantic Schema untuk Intermediate Graph
# ---------------------------------------------------------
class Node(BaseModel):
    id: str = Field(description="ID unik untuk node (contoh: 'start_1', 'task_1', 'gw_1', 'end_1')")
    type: Literal["startEvent", "userTask", "serviceTask", "exclusiveGateway", "endEvent"] = Field(
        description="Tipe elemen BPMN sesuai fungsi langkah"
    )
    name: str = Field(description="Label ringkas aktivitas atau kondisi keputusan")
    actor: str = Field(description="Aktor / unit kerja / sistem penanggung jawab tugas ini")

class Edge(BaseModel):
    from_node: str = Field(description="ID node asal")
    to_node: str = Field(description="ID node tujuan")
    condition: Optional[str] = Field(
        default=None, 
        description="Kondisi logika jika berasal dari gateway percabangan"
    )

class AutoBPMNGraph(BaseModel):
    process_id: str = Field(description="ID unik proses dalam format snake_case")
    process_name: str = Field(description="Nama lengkap proses SOP")
    actors: List[str] = Field(description="Daftar seluruh aktor/role yang terlibat dalam SOP")
    nodes: List[Node] = Field(description="Kumpulan node aktivitas, gerbang keputusan, awal, dan akhir")
    edges: List[Edge] = Field(description="Daftar koneksi berarah yang menghubungkan setiap node")

# ---------------------------------------------------------
# 2. Prompt Engineering System Instruction
# ---------------------------------------------------------
SYSTEM_INSTRUCTION = """
Anda adalah AI Workflow & BPMN Specialist untuk sistem AutoBPMN.
Tugas Anda adalah membaca dokumen teks narasi SOP (Standar Operasional Prosedur) dan mengubahnya secara akurat menjadi representasi Directed Acyclic Graph (DAG) berbasis skema JSON.

Panduan Pemetaan:
1. Elemen Awal & Akhir:
   - Harus selalu dimulai dengan satu atau lebih `startEvent`.
   - Setiap jalur alur percabangan harus bermuara pada `endEvent`.
2. Tugas & Aktivitas:
   - Tindakan manual/manusia dipetakan ke `userTask`.
   - Tindakan automasi/sistem dipetakan ke `serviceTask`.
   - Petakan atribut 'actor' secara konsisten sesuai peran yang melakukan langkah tersebut.
3. Percabangan & Keputusan:
   - Setiap keputusan atau kondisi validasi wajib menggunakan `exclusiveGateway`.
   - Setiap cabang keluar dari gateway wajib memiliki label 'condition' pada edge penghubungnya.
4. Integritas Graf:
   - Pastikan tidak ada dangling nodes.
   - Pastikan setiap ID di 'edges.from_node' dan 'edges.to_node' eksis di daftar 'nodes'.
"""

CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
]

# ---------------------------------------------------------
# 3. Fungsi Ekstraksi dengan Resilient Fallback
# ---------------------------------------------------------
def extract_sop_to_graph(sop_text: str) -> AutoBPMNGraph:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Environment variable GEMINI_API_KEY belum disetel.")

    client = genai.Client(api_key=api_key)
    last_error = None

    for model_name in CANDIDATE_MODELS:
        try:
            print(f"[AutoBPMN] Mencoba model: {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=f"Ekstrak SOP berikut ke dalam representasi skema graf AutoBPMN:\n\n{sop_text}",
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=AutoBPMNGraph,
                    temperature=0.1
                ),
            )
            return AutoBPMNGraph.model_validate_json(response.text)
        except Exception as e:
            print(f"[Warning] Gagal dengan {model_name}: {e}")
            last_error = e
            continue

    raise RuntimeError(f"Semua model fallback gagal. Terakhir: {last_error}")

if __name__ == "__main__":
    sample_sop = """
    SOP Verifikasi Tagihan Vendor (PT Javan Cipta Solusi)
    1. Vendor mengirimkan berkas tagihan (invoice, faktur pajak, dan berita acara serah terima).
    2. Finance Admin memeriksa kelengkapan berkas fisik dan digital.
    3. Jika berkas tidak lengkap, Finance Admin mengembalikan tagihan ke Vendor untuk diperbaiki.
    4. Jika berkas lengkap, Finance Admin memasukkan data invoice ke ERP sistem dan meneruskan ke Finance Manager.
    5. Finance Manager melakukan persetujuan (approval) pembayaran.
    6. Jika disetujui, Bagian Treasury mengeksekusi transfer pembayaran ke rekening Vendor dan proses selesai.
    7. Jika ditolak, Finance Manager memberikan catatan penolakan dan proses pengajuan dibatalkan.
    """

    print("--- Mengekstrak SOP ke Skema Graf AutoBPMN ---")
    result_graph = extract_sop_to_graph(sample_sop)
    json_output = result_graph.model_dump_json(indent=2)
    print(json_output)

    with open("extracted_graph.json", "w", encoding="utf-8") as f:
        f.write(json_output)
    print("\n[OK] Hasil ekstraksi disimpan ke 'extracted_graph.json'")
