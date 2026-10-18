import pytest
from app.services.copilot import (
    chunk_sop_text,
    select_relevant_chunks,
    validate_citations,
)
from app.schemas.copilot import (
    SopChunk,
    Citation,
    SelectedElementContext,
)


def test_chunk_sop_text_numbered():
    sop = """SOP Pengadaan
1. Pemohon mengisi formulir permohonan.
2. Manager meninjau dokumen kelayakan.
3. Bagian pengadaan menghubungi vendor."""
    chunks = chunk_sop_text(sop, "SOP Pengadaan")
    assert len(chunks) == 3
    assert chunks[0].chunk_id == "sop-chunk-1"
    assert chunks[0].step == 1
    assert "mengisi formulir" in chunks[0].text
    assert chunks[1].chunk_id == "sop-chunk-2"
    assert chunks[1].step == 2


def test_select_relevant_chunks_prioritizes_terms_and_selected_element():
    chunks = [
        SopChunk(chunk_id="sop-chunk-1", section="SOP", step=1, text="1. Pemohon mengisi form."),
        SopChunk(chunk_id="sop-chunk-2", section="SOP", step=2, text="2. Manager memeriksa anggaran dan SLA."),
        SopChunk(chunk_id="sop-chunk-3", section="SOP", step=3, text="3. Tim IT setup akun server."),
    ]
    elem = SelectedElementContext(
        id="task_2",
        type="userTask",
        name="Memeriksa Anggaran",
        actor="Manager",
    )
    selected = select_relevant_chunks(chunks, query="apa SLA langkah ini?", selected_element=elem, max_chunks=2)
    assert len(selected) <= 2
    selected_ids = [c.chunk_id for c in selected]
    assert "sop-chunk-2" in selected_ids


def test_validate_citations_filters_hallucinated_chunks():
    available = [
        SopChunk(chunk_id="sop-chunk-1", section="SOP", step=1, text="1. Teks langkah 1."),
        SopChunk(chunk_id="sop-chunk-2", section="SOP", step=2, text="2. Teks langkah 2."),
    ]
    cits = [
        Citation(chunk_id="sop-chunk-1", quote="Teks langkah 1."),
        Citation(chunk_id="sop-chunk-999", quote="Halusinasi tidak ada di teks."),
    ]
    validated = validate_citations(cits, available)
    assert len(validated) == 1
    assert validated[0].chunk_id == "sop-chunk-1"
