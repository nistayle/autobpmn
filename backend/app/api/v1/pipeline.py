from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional
import json

from app.schemas.pipeline import TextInputRequest, PipelineResponse, ValidationReport
from app.schemas.process_graph import AutoBPMNGraph
from app.schemas.copilot import ChatRequest, CopilotResponse
from app.services.ingestion import extract_text_from_file
from app.services.extractor import (
    InputTooLargeError,
    ProviderConfigurationError,
    extract_sop_to_graph,
)
from app.services.validator import validate_process_graph
from app.services.bpmn_synthesizer import generate_bpmn_xml
from app.services.copilot import generate_copilot_response, stream_copilot_events

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])

@router.post("/process-text", response_model=PipelineResponse)
async def process_sop_text(payload: TextInputRequest):
    """
    Pipeline lengkap dari teks narasi SOP mentah:
    Ekstraksi LLM -> Validasi Graf -> Sintesis BPMN 2.0 XML
    """
    # 1. Extraction (LLM -> Structured JSON Graph)
    try:
        import asyncio
        graph: AutoBPMNGraph = await asyncio.to_thread(extract_sop_to_graph, payload.text_content)
    except InputTooLargeError as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except ProviderConfigurationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Provider AI sementara tidak tersedia atau quota free tier sedang penuh. Coba lagi sebentar, atau periksa provider utama."
        )

    # 2. Validation (Verifikasi Logika Graf & Integritas Alur)
    val_result = validate_process_graph(graph)

    # 3. Synthesis (Intermediate Graph -> BPMN 2.0 XML)
    try:
        bpmn_xml = generate_bpmn_xml(graph)
    except Exception as e:
        if not val_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "Validasi graf gagal dan sintesis BPMN tidak dapat dilanjutkan",
                    "errors": val_result,
                    "synthesis_error": str(e)
                }
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mensintesis BPMN XML: {str(e)}"
        )

    return PipelineResponse(
        process_id=graph.process_id,
        process_name=graph.process_name,
        validation=ValidationReport(**val_result),
        intermediate_graph=graph,
        bpmn_xml=bpmn_xml,
        source_text=payload.text_content,
    )

@router.post("/process-file", response_model=PipelineResponse)
async def process_sop_file(file: UploadFile = File(...)):
    """
    Pipeline lengkap dari berkas dokumen (PDF/TXT):
    File Parsing (Ingestion) -> Ekstraksi LLM -> Validasi Graf -> Sintesis BPMN 2.0 XML
    """
    # 0. Ingestion (Baca berkas menjadi teks mentah)
    raw_text = await extract_text_from_file(file)
    if len(raw_text.strip()) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Berkas tidak memuat teks SOP yang cukup untuk diproses."
        )

    # Lanjutkan ke alur parsing teks
    return await process_sop_text(TextInputRequest(title=file.filename, text_content=raw_text))


@router.post("/chat", response_model=CopilotResponse)
async def copilot_chat(payload: ChatRequest):
    """
    AI Copilot non-streaming endpoint:
    Menerima konteks SOP + elemen graf BPMN + pertanyaan BA,
    mengembalikan jawaban terstruktur dengan sitasi terverifikasi.
    """
    try:
        import asyncio
        return await asyncio.to_thread(generate_copilot_response, payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Layanan AI Copilot sementara tidak tersedia: {str(e)}",
        )


@router.post("/chat/stream")
async def copilot_chat_stream(payload: ChatRequest):
    """
    AI Copilot streaming SSE endpoint:
    Menerima konteks SOP + elemen graf BPMN + pertanyaan BA,
    mengalirkan event: status, token, citations, done, error via text/event-stream.
    """
    return StreamingResponse(
        stream_copilot_events(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


from app.schemas.graph_patch import AiEditRequest, PatchPreview, GraphPatch
from app.services.graph_patcher import validate_and_apply_patch, generate_ai_patch
from pydantic import BaseModel


class ApplyPatchRequest(BaseModel):
    graph: AutoBPMNGraph
    patch: GraphPatch


@router.post("/validate-graph", response_model=ValidationReport)
async def validate_graph_endpoint(graph: AutoBPMNGraph):
    """
    Validasi integritas struktural graf BPMN (deadlocks, orphan nodes, reachability).
    Digunakan oleh Visual Editor dan AI Editor secara real-time.
    """
    val_result = validate_process_graph(graph)
    return ValidationReport(**val_result)


@router.post("/synthesize-graph", response_model=PipelineResponse)
async def synthesize_graph_endpoint(graph: AutoBPMNGraph):
    """
    Mensintesis graf BPMN (AutoBPMNGraph) langsung menjadi BPMN 2.0 XML standar dengan layout otomatis.
    Memastikan single source of truth antara visual canvas dan structured data.
    """
    val_result = validate_process_graph(graph)
    try:
        bpmn_xml = generate_bpmn_xml(graph)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Gagal mensintesis BPMN XML dari graf: {str(e)}"
        )

    return PipelineResponse(
        process_id=graph.process_id,
        process_name=graph.process_name,
        validation=ValidationReport(**val_result),
        intermediate_graph=graph,
        bpmn_xml=bpmn_xml
    )


@router.post("/ai-edit", response_model=PatchPreview)
async def ai_edit_endpoint(payload: AiEditRequest):
    """
    AI-assisted editing endpoint:
    Menerima instruksi bahasa alami + konteks graf ringkas,
    menghasilkan PatchPreview berisi operasi terstruktur dan ringkasan diff sebelum diterapkan.
    """
    import asyncio
    patch = await asyncio.to_thread(generate_ai_patch, payload)
    is_valid, projected_graph, issues, diff = validate_and_apply_patch(payload.current_graph, patch)

    projected_xml = None
    if is_valid and projected_graph:
        try:
            projected_xml = generate_bpmn_xml(projected_graph)
        except Exception:
            pass

    return PatchPreview(
        patch=patch,
        is_valid=is_valid,
        validation_issues=issues,
        diff_summary=diff,
        projected_graph=projected_graph,
        bpmn_xml=projected_xml
    )


@router.post("/apply-patch", response_model=PipelineResponse)
async def apply_patch_endpoint(payload: ApplyPatchRequest):
    """
    Menerapkan patch operasi yang telah disetujui (Apply) ke graf proses,
    menghasilkan graf baru dan BPMN XML terverifikasi secara deterministik.
    """
    is_valid, new_graph, issues, _ = validate_and_apply_patch(payload.graph, payload.patch)
    if not is_valid or not new_graph:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Operasi patch tidak valid dan ditolak untuk melindungi integritas diagram",
                "errors": issues
            }
        )

    val_result = validate_process_graph(new_graph)
    bpmn_xml = generate_bpmn_xml(new_graph)

    return PipelineResponse(
        process_id=new_graph.process_id,
        process_name=new_graph.process_name,
        validation=ValidationReport(**val_result),
        intermediate_graph=new_graph,
        bpmn_xml=bpmn_xml
    )

