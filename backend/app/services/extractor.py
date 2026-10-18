"""
AutoBPMN Multi-Provider LLM Extractor
Arsitektur fallback: Gemini -> Groq -> OpenRouter
"""
import os
import json
import logging
import urllib.request
import urllib.error
from typing import List, Optional, Dict, Any
from app.schemas.process_graph import AutoBPMNGraph

logger = logging.getLogger("autobpmn.extractor")

# ---------- System Prompt (shared across providers) ----------
SYSTEM_INSTRUCTION = """Anda adalah AI Workflow & BPMN Specialist untuk sistem AutoBPMN.
Tugas: baca dokumen teks narasi SOP lalu ubah menjadi Directed Acyclic Graph (DAG) berformat JSON standar BPMN 2.0.

Aturan ketat penamaan & struktur:
1. Wajib dimulai minimal satu startEvent, setiap cabang keputusan bermuara ke endEvent.
2. Tugas manusia = userTask, automasi/sistem = serviceTask.
3. Setiap percabangan keputusan = exclusiveGateway. Edge keluar dari gateway WAJIB memiliki atribut "condition" yang jelas (misal: "Disetujui", "Ditolak").
4. Tidak boleh ada dangling node. Semua ID di edges harus eksis di daftar nodes.
5. Gunakan format ID ringkas: start_1, task_1, gw_1, end_1, dst.
6. Atribut "actor": tulis peran atau divisi pelaksana secara ringkas (contoh: "Pemohon", "Manager Divisi", "Vendor").
7. Atribut "name": WAJIB berupa frasa tindakan ringkas (maksimal 3-6 kata, format: Kata Kerja + Objek, contoh: "Isi Formulir Pengadaan", "Tinjau Urgensi & Anggaran", "Kirim Barang Pesanan"). JANGAN menyalin seluruh paragraf narasi dan JANGAN mengulang nama aktor di dalam atribut "name".

Output HARUS berupa JSON valid sesuai skema berikut:
{
  "process_id": "string (snake_case)",
  "process_name": "string",
  "actors": ["string"],
  "nodes": [{"id":"string","type":"startEvent|userTask|serviceTask|exclusiveGateway|parallelGateway|endEvent","name":"string","actor":"string"}],
  "edges": [{"from_node":"string","to_node":"string","condition":"string|null"}]
}"""

_CACHED_PROVIDER: Optional[str] = None

# Free cloud tiers in the configured fallback chain accept far less input than
# their advertised context windows. Keep a conservative, provider-neutral cap
# so a large PDF never reaches Groq as an opaque HTTP 413.
MAX_SOP_CHARS = 16_000
# Avoid a model-catalog round trip on every serverless invocation.
GEMINI_FAST_MODEL = "gemini-2.5-flash-lite"
GEMINI_REQUEST_TIMEOUT_MS = 20_000


class InputTooLargeError(ValueError):
    """Raised before sending a document that cannot fit the cloud fallback."""


class ProviderConfigurationError(ValueError):
    """Raised when a configured provider key cannot be used."""


def _validate_sop_size(sop_text: str) -> str:
    normalized = "\n".join(line.rstrip() for line in sop_text.replace("\r\n", "\n").split("\n")).strip()
    if len(normalized) > MAX_SOP_CHARS:
        raise InputTooLargeError(
            "Dokumen terlalu panjang untuk mode cloud gratis. "
            f"Batasnya sekitar {MAX_SOP_CHARS:,} karakter setelah teks PDF diekstrak. "
            "Pisahkan SOP per prosedur atau ringkas bagian lampiran terlebih dahulu."
        )
    return normalized

# ---------- Provider: Gemini ----------
def _call_gemini(sop_text: str, api_key: str) -> AutoBPMNGraph:
    from google import genai
    from google.genai import types

    # Validasi awal singkat apakah API key Gemini valid
    if not api_key.startswith("AIza"):
        raise ProviderConfigurationError(
            "GEMINI_API_KEY tidak valid. Buat key Gemini baru di Google AI Studio dan isi hanya pada GEMINI_API_KEY."
        )

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=GEMINI_REQUEST_TIMEOUT_MS,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )
    print(f"[AutoBPMN] Menghubungi Gemini model: {GEMINI_FAST_MODEL}...")
    resp = client.models.generate_content(
        model=GEMINI_FAST_MODEL,
        contents=f"Ekstrak SOP berikut ke skema graf AutoBPMN:\n\n{sop_text}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=AutoBPMNGraph,
            temperature=0.1,
        ),
    )
    return AutoBPMNGraph.model_validate_json(resp.text)


# ---------- Provider: OpenAI-compatible (Groq / OpenRouter) ----------
def _call_openai_compatible(
    sop_text: str,
    api_key: str,
    base_url: str,
    models: List[str],
    provider_name: str,
    extra_headers: Optional[Dict[str, str]] = None,
) -> AutoBPMNGraph:
    user_prompt = f"Ekstrak SOP berikut ke skema graf AutoBPMN (output JSON only):\n\n{sop_text}"

    last_err = None
    for model in models[:5]:  # Batasi 5 model teratas agar responsif
        try:
            print(f"[AutoBPMN] Menghubungi {provider_name} model: {model}...")
            payload = json.dumps({
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            }).encode("utf-8")

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "AutoBPMN/1.0 (Windows NT 10.0; Win64; x64)",
            }
            if extra_headers:
                headers.update(extra_headers)

            req = urllib.request.Request(
                f"{base_url}/chat/completions",
                data=payload,
                headers=headers,
                method="POST",
            )
            # Timeout responsif 25 detik per model
            with urllib.request.urlopen(req, timeout=25) as resp:
                body = json.loads(resp.read().decode("utf-8"))

            content = body["choices"][0]["message"]["content"]
            # Bersihkan jika ada markdown fencing
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            return AutoBPMNGraph.model_validate_json(content)

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
            print(f"[AutoBPMN] {provider_name} {model} gagal ({e.code}): {err_body[:150]}")
            if e.code == 413:
                raise InputTooLargeError(
                    "Dokumen melebihi batas input provider cloud. Pisahkan SOP menjadi beberapa prosedur."
                ) from e
            if e.code in (401, 403):
                raise ProviderConfigurationError(f"Kredensial {provider_name} ditolak oleh provider.") from e
            last_err = Exception(f"{provider_name} {model}: HTTP {e.code}")
            continue
        except Exception as e:
            print(f"[AutoBPMN] {provider_name} {model} gagal: {e}")
            last_err = e
            continue

    raise RuntimeError(f"{provider_name}: semua model gagal. Terakhir: {last_err}")


# These are production text models, deliberately pinned instead of using every
# model returned by /models (which included TTS and deprecated IDs in the log).
GROQ_TEXT_MODELS = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
]


def _call_groq(sop_text: str, api_key: str) -> AutoBPMNGraph:
    return _call_openai_compatible(
        sop_text=sop_text,
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
        models=GROQ_TEXT_MODELS,
        provider_name="Groq",
    )


def _get_openrouter_free_models(api_key: str) -> List[str]:
    """Mengambil daftar model free-tier aktif secara dinamis dari OpenRouter API."""
    fallback_models = [
        "meta-llama/llama-3.2-3b-instruct:free",
        "meta-llama/llama-3.2-1b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "deepseek/deepseek-r1:free",
        "google/gemini-2.0-flash-thinking-exp:free",
        "mistralai/mistral-small-24b-instruct-2501:free",
    ]
    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/models",
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "AutoBPMN/1.0 (Windows NT 10.0; Win64; x64)",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        discovered = []
        for m in data.get("data", []):
            mid = m.get("id", "")
            if ":free" in mid:
                discovered.append(mid)

        if discovered:
            # Prioritaskan model yang cocok untuk structured output
            preferred = [
                m for m in discovered
                if any(k in m.lower() for k in ["llama", "gemini", "qwen", "mistral", "deepseek"])
            ]
            return preferred + [m for m in discovered if m not in preferred]
    except Exception as e:
        logger.warning(f"Gagal mendeteksi model OpenRouter secara live: {e}")

    return fallback_models


def _call_openrouter(sop_text: str, api_key: str) -> AutoBPMNGraph:
    models = _get_openrouter_free_models(api_key)
    return _call_openai_compatible(
        sop_text=sop_text,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        models=models,
        provider_name="OpenRouter",
        extra_headers={
            "HTTP-Referer": "https://autobpmn.org",
            "X-Title": "AutoBPMN",
        },
    )


def _load_env_file():
    """Membaca berkas .env dari root atau working directory jika ada."""
    search_dirs = [
        os.getcwd(),
        os.path.dirname(os.path.abspath(__file__)),
        os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")),
        os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")),
    ]
    for d in search_dirs:
        env_path = os.path.join(d, ".env")
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for raw_line in f:
                        line = raw_line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if line.startswith("export "):
                            line = line[7:].strip()
                        elif line.startswith("$env:"):
                            line = line[5:].strip()

                        if "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k and v and k not in os.environ:
                                os.environ[k] = v
                break
            except Exception as e:
                logger.warning(f"Gagal membaca .env di {env_path}: {e}")

_load_env_file()


# ---------- Unified entry point ----------
def extract_sop_to_graph(sop_text: str) -> AutoBPMNGraph:
    """
    Pipeline multi-provider: Gemini -> Groq -> OpenRouter.
    Aktifkan provider dengan menyetel env variable API key masing-masing:
      GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
    """
    global _CACHED_PROVIDER

    _load_env_file()
    sop_text = _validate_sop_size(sop_text)

    providers = []

    gemini_key = os.environ.get("GEMINI_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    # Susun urutan provider:
    # Jika GEMINI_API_KEY tidak berawalan AIzaSy, letakkan Groq/OpenRouter di depan
    all_providers = []
    gemini_valid = gemini_key and gemini_key.startswith("AIzaSy")

    if gemini_key and gemini_valid:
        all_providers.append(("gemini", gemini_key, _call_gemini))
    if groq_key:
        all_providers.append(("groq", groq_key, _call_groq))
    if openrouter_key:
        all_providers.append(("openrouter", openrouter_key, _call_openrouter))
    if gemini_key and not gemini_valid:
        all_providers.append(("gemini", gemini_key, _call_gemini))

    if not all_providers:
        raise ValueError(
            "Tidak ada API key yang disetel. "
            "Setel minimal satu di .env: GEMINI_API_KEY, GROQ_API_KEY, atau OPENROUTER_API_KEY"
        )

    # Prioritaskan cached provider yang sudah terbukti berhasil
    if _CACHED_PROVIDER:
        cached = [p for p in all_providers if p[0] == _CACHED_PROVIDER]
        others = [p for p in all_providers if p[0] != _CACHED_PROVIDER]
        providers = cached + others
    else:
        providers = all_providers

    last_error = None
    for name, key, call_fn in providers:
        try:
            logger.info(f"Mencoba provider: {name}")
            result = call_fn(sop_text, key)
            _CACHED_PROVIDER = name
            logger.info(f"Berhasil menggunakan provider: {name}")
            return result
        except Exception as e:
            logger.warning(f"Provider {name} gagal: {e}")
            last_error = e
            continue

    tried = ", ".join(p[0] for p in providers)
    raise RuntimeError(
        f"Seluruh provider LLM ({tried}) gagal. Error terakhir: {last_error}"
    )
