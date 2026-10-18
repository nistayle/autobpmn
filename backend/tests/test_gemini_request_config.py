import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services.copilot import _call_gemini_copilot
from app.services.extractor import (
    GEMINI_FAST_MODEL,
    GEMINI_REQUEST_TIMEOUT_MS,
    _call_gemini,
)


def test_sop_extraction_uses_single_bounded_gemini_request():
    graph_payload = {
        "process_id": "test_process",
        "process_name": "Test Process",
        "actors": ["Pemohon"],
        "nodes": [
            {"id": "start_1", "type": "startEvent", "name": "Start", "actor": ""},
            {"id": "task_1", "type": "userTask", "name": "Submit Form", "actor": "Pemohon"},
            {"id": "end_1", "type": "endEvent", "name": "End", "actor": ""},
        ],
        "edges": [
            {"from_node": "start_1", "to_node": "task_1", "condition": None},
            {"from_node": "task_1", "to_node": "end_1", "condition": None},
        ],
    }
    client = Mock()
    client.models.generate_content.return_value = SimpleNamespace(text=json.dumps(graph_payload))

    with patch("google.genai.Client", return_value=client) as client_factory:
        graph = _call_gemini("Synthetic SOP", "AIzaSyTestKey")

    assert graph.process_id == "test_process"
    client_factory.assert_called_once()
    options = client_factory.call_args.kwargs["http_options"]
    assert options.timeout == GEMINI_REQUEST_TIMEOUT_MS
    assert options.retry_options.attempts == 1
    client.models.list.assert_not_called()
    client.models.generate_content.assert_called_once()
    assert client.models.generate_content.call_args.kwargs["model"] == GEMINI_FAST_MODEL


def test_copilot_uses_single_bounded_gemini_request():
    client = Mock()
    client.models.generate_content.return_value = SimpleNamespace(text='{"answer":"ok"}')

    with patch("google.genai.Client", return_value=client) as client_factory:
        result = _call_gemini_copilot("Synthetic prompt", "AIzaSyTestKey")

    assert result == '{"answer":"ok"}'
    client_factory.assert_called_once()
    options = client_factory.call_args.kwargs["http_options"]
    assert options.timeout == GEMINI_REQUEST_TIMEOUT_MS
    assert options.retry_options.attempts == 1
    client.models.list.assert_not_called()
    client.models.generate_content.assert_called_once()
    assert client.models.generate_content.call_args.kwargs["model"] == GEMINI_FAST_MODEL
