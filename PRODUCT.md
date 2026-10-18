# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Business analysts and process owners who are responsible for documenting organisational procedures. They work with SOP documents (PDF or plain-text) and need those procedures turned into BPMN 2.0 diagrams they can hand to developers, upload to BPM platforms, or present to stakeholders — without writing XML or knowing diagram notation.

## Product Purpose

AutoBPMN converts Standard Operating Procedure (SOP) documents into executable BPMN 2.0 process diagrams automatically. A user pastes or uploads an SOP; the engine extracts a structured process graph, validates it for structural correctness, and returns a renderable BPMN 2.0 XML diagram with an interactive canvas.

Success is defined as: a user can turn a real SOP document into a structurally valid, downloadable BPMN diagram in a single session without touching XML or manually drawing nodes.

## Positioning

AutoBPMN's differentiating mechanism is its intermediate graph-logic validation layer: LLM extraction produces a node-and-edge graph representation that is structurally checked for deadlocks, orphaned nodes, and unreachable flows before any BPMN XML is generated. This validation step catches mal-formed process logic that raw LLM-to-XML approaches emit silently, giving the output a structural correctness guarantee competitors relying on direct text-to-XML cannot truthfully claim.

## Operating Context

- Users open the web app in a desktop browser alongside their SOP document.
- Typical SOP sources: internal policy PDFs, procedure manuals, regulatory documents.
- The output BPMN file is downloaded (`.bpmn` or `.svg`) for import into tools such as Camunda, Bizagi, or Signavio, or for presentation in stakeholder reviews.
- The app is currently run locally (FastAPI backend + Vite/React frontend); deployment target is undecided.
- Tech readiness target: TKT 3 / TKT 5 functional prototype.

## Capabilities and Constraints

- **Input formats:** plain text (paste) and uploaded `.pdf` / `.txt` files.
- **Output:** BPMN 2.0 XML (downloadable `.bpmn`) and `.svg` export.
- **Node types supported:** `startEvent`, `userTask`, `serviceTask`, `exclusiveGateway`, `endEvent`.
- **Validation:** deadlock detection, orphan-node detection, flow reachability check — performed before BPMN rendering.
- **LLM backend:** multi-provider pipeline with automatic failover (Gemini primary, other providers as fallback); configured via environment variables.
- **Deployment:** local dev stack only at present; deployment target undecided.
- **PDF limitation:** scanned/image-only PDFs are rejected with an explicit error; only text-layer PDFs are supported.
- **Intermediate graph:** exposed in the sidebar as JSON for inspection and manual editing before re-synthesis.

## Brand Commitments

- Product name: **AutoBPMN** (capitalisation confirmed).
- Subtitle used in UI: **SOP → BPMN 2.0 Engine**.
- No logo asset exists yet; the current UI uses a letter-mark ("B") placeholder.

## Evidence on Hand

- Working prototype codebase (FastAPI backend + React/Vite frontend, bpmn-js viewer).
- Confirmed pipeline: SOP text → LLM extraction → intermediate graph → graph validation → BPMN 2.0 XML → interactive canvas.
- No real user testimonials, benchmarks, or case studies on file; future work must not fabricate them.

## Product Principles

1. **Structural guarantees over speed** — every diagram output passes graph-logic validation before it reaches the user; a rejected graph is better than a silently broken one.
2. **Transparency of the intermediate representation** — the process graph is visible and editable in the sidebar so users can inspect and correct extraction before committing to the final diagram.
3. **Zero notation expertise required** — the UI hides BPMN XML entirely; the user's mental model is SOP-in, diagram-out.
4. **Resilient extraction** — multi-provider LLM fallback ensures the pipeline completes even when a single provider is unavailable.
5. **Open handoff** — outputs are standard BPMN 2.0 files importable by any conforming BPM tool; no proprietary format lock-in.

## Accessibility & Inclusion

- UI copy is bilingual: Bahasa Indonesia is the primary language for UI text and inline documentation; English is used for technical labels, BPMN terminology, and downloadable artefacts. Both languages are binding.
- No specific WCAG level has been formally committed to yet; accessibility requirements are an open decision for future work.
