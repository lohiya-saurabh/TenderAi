# ADR 0027: Dual-Sink Rotated Structured Logging and Payload Safety Boundary

## Status

Accepted (2026-10-14)

## Context

During continuous integration and extended document extraction sessions, three distinct operational and security liabilities were observed across the platform's observability layer:

1. **Terminal Log Flooding & Unusable Console Output**:
   - Both the NestJS API gateway (`apps/api`) and the FastAPI AI worker (`apps/ai`) streamed 100% of internal diagnostic logs directly to `stdout`/`stderr`.
   - NestJS emitted dozens of framework route-discovery logs (`Mapped {/api/v1/..., GET} route`, `... dependencies initialized`) on every process recycle.
   - Python library pollers (`httpx`, `botocore`) emitted verbose HTTP 200 access traces for every single background queue poll and health check, drowning out critical workflow events, bid evaluation warnings, and errors.
2. **Missing Persistent & Rotated File Sinks**:
   - No structured log files were persisted to disk for historical post-mortem analysis, audit investigations, or debugging.
   - Streaming solely to stdout made offline analysis with standard CLI tooling (`jq`, `grep`, `tail`) difficult during parallel execution.
3. **Uncapped Document & Prompt Log Payloads**:
   - While cryptographic tokens, AWS keys, and Indian statutory identifiers (PAN, GSTIN, Aadhaar) were properly scrubbed by `LogSanitizer`, multi-kilobyte tender prompts, raw PDF page text extracts, and layout chunks were logged in full string representations when attached to log metadata, creating severe log bloat and potential data-spill risks.

## Decision

We implement a zero-dependency **Dual-Sink Rotated Structured Logging Architecture** across both runtime tiers (`apps/api` and `apps/ai`):

### 1. Dual-Sink Routing & Independent Log Levels

Every log emission is decoupled into two independent sinks based on consumer purpose:

```
                          ┌───────────────────────────┐
                          │   Application Log Event   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │    Zero-Trust Sanitizer   │
                          │ (Secrets + Truncation)    │
                          └───────┬───────────┬───────┘
                                  │           │
       LOG_LEVEL_CONSOLE (INFO)   │           │  LOG_LEVEL_FILE (DEBUG)
                                  ▼           ▼
                     ┌──────────────────┐   ┌───────────────────────────────┐
                     │   Console Sink   │   │       Rotated File Sink       │
                     │ (Terminal stdout)│   │  (logs/api.log & logs/ai.log) │
                     │  1-line summary  │   │  Full canonical JSON schema   │
                     └──────────────────┘   └───────────────┬───────────────┘
                                                            │ size >= 10MB
                                                            ▼
                                                    [Log Rotation Engine]
                                                .log -> .log.1 -> ... -> .log.5
```

- **Machine-Facing File Sink (`logs/api.log` & `logs/ai.log`)**:
  - Encodes the full canonical JSON schema: `timestamp`, `level`, `service`, `event`, `message`, `trace_id`, `request_id`, `tenant_id`, `duration_ms`, `error_code`, and `metadata`.
  - Captures fine-grained diagnostics down to `LOG_LEVEL_FILE` (default: `DEBUG`).
  - Size-capped at 10 MB with 5 sequential backup archives (`.1` through `.5`), enforcing a fixed maximum disk ceiling of 50 MB per service.
- **Human-Facing Console Sink (`stdout`)**:
  - Emits minimal, high-signal single-line summaries: `[HH:MM:SS] LEVEL [service] [trace_id] message (durationMs)`.
  - Filtered at `LOG_LEVEL_CONSOLE` (default: `INFO`), eliminating terminal clutter.
  - Automatically suppresses framework bootstrap spam (NestJS route registration and dependency module notices) unless explicitly running at `LOG_LEVEL_CONSOLE=DEBUG`.
  - Silences noisy third-party client pollers (`httpx`, `httpcore`, `urllib3`, `boto3`, `botocore`) in the AI worker.

### 2. Zero-Dependency Atomic Rotating File Stream for Node.js

Rather than importing heavyweight npm packages (such as Winston or Pino) that introduce deep dependency trees and breaking changes to existing test suites, we implemented [`RotatingLogStream.ts`](file:///Users/belikesaurabh/main/TenderAi/apps/api/src/common/logging/RotatingLogStream.ts) using native Node.js APIs (`node:fs`, `node:path`):
- Uses synchronous atomic file descriptors (`fs.openSync`, `fs.writeSync`, `fs.fstatSync`) with restrictive permissions (`0o600`, owner read/write only).
- Avoids asynchronous stream creation races that cause `ENOENT` during rapid log rotation.
- Rotation rolls files atomically: `.5` is pruned, `.4` -> `.5`, `.3` -> `.4`, `.2` -> `.3`, `.1` -> `.2`, and active `.log` -> `.1`.

### 3. Python AI Engine Native Rotation

In [`apps/ai/src/tenderpulse_ai/main.py`](file:///Users/belikesaurabh/main/TenderAi/apps/ai/src/tenderpulse_ai/main.py), the root logger utilizes the Python standard library `logging.handlers.RotatingFileHandler`:
- File handler writes structured JSON via [`JSONLogFormatter`](file:///Users/belikesaurabh/main/TenderAi/apps/ai/src/tenderpulse_ai/logging/formatter.py) directly to `logs/ai.log` (`maxBytes=10MB`, `backupCount=5`).
- Console handler writes clean single-line summaries via [`ConsoleLogFormatter`](file:///Users/belikesaurabh/main/TenderAi/apps/ai/src/tenderpulse_ai/logging/formatter.py).

### 4. Zero-Trust Content Truncation Boundary

Both [`LogSanitizer.ts`](file:///Users/belikesaurabh/main/TenderAi/apps/api/src/common/logging/LogSanitizer.ts) and [`sanitizer.py`](file:///Users/belikesaurabh/main/TenderAi/apps/ai/src/tenderpulse_ai/security/sanitizer.py) enforce safety boundaries on large text payloads:
- Keys matching `prompt`, `full_prompt`, `system_prompt`, `user_prompt`, `document_content`, `raw_page_text`, `page_text`, `extracted_text`, or `file_content` are truncated at 250 characters with an explicit suffix: `... [TRUNCATED: N chars omitted for log safety]`.
- Generic string values are bounded at 3,000 characters to prevent multi-megabyte JSON allocations.

### 5. Configuration Schema

Configured via environment variables with production-grade defaults:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `LOG_DIR` | `logs` | Directory path where log files are stored (relative to workspace root). |
| `LOG_LEVEL_CONSOLE` | `INFO` | Minimum severity logged to the terminal terminal (`INFO`, `WARN`, `ERROR`). |
| `LOG_LEVEL_FILE` | `DEBUG` | Minimum severity persisted to rotated log files (`DEBUG`, `INFO`). |
| `LOG_MAX_BYTES` | `10485760` (10MB) | File size threshold triggering log rotation. |
| `LOG_MAX_FILES` | `5` | Number of rotated backup archives retained before pruning. |
| `LOG_TO_FILE` | `true` | Allows explicitly disabling file logging (e.g. in test runners). |
| `LOG_TO_CONSOLE` | `true` | Allows disabling console stdout in non-interactive production environments. |

## How to Locate and Analyze Logs

### File Locations
- **NestJS API Gateway**: `logs/api.log` (backups: `logs/api.log.1` through `logs/api.log.5`)
- **FastAPI AI Worker**: `logs/ai.log` (backups: `logs/ai.log.1` through `logs/ai.log.5`)

### Practical Analysis Commands

1. **Live Stream of Formatted Logs**:
   ```bash
   tail -f logs/api.log | jq -r '"[\(.timestamp[11:19])] \(.level) [\(.service)] \(.message) \(.duration_ms // "")"'
   tail -f logs/ai.log | jq -r '"[\(.timestamp[11:19])] \(.level) \(.event): \(.message)"'
   ```

2. **Filter by Tenant**:
   ```bash
   grep '"tenant_id":"org_acme_infra"' logs/api.log | jq .
   ```

3. **Trace a Single Request or Job Across Services**:
   ```bash
   grep 'job-test-101' logs/*.log | jq '{service: .service, event: .event, duration_ms: .duration_ms, message: .message}'
   ```

4. **Locate Extraction Failures & Warnings**:
   ```bash
   jq 'select(.level=="ERROR" or .level=="WARN")' logs/ai.log
   ```

5. **Latency Analysis**:
   ```bash
   jq 'select(.duration_ms > 500) | {event: .event, duration_ms: .duration_ms, message: .message}' logs/api.log
   ```

## Consequences

- **Positives**:
  - The developer terminal is clean, high-signal, and easy to follow during multi-service development.
  - Complete, un-truncated diagnostic traces are safely preserved on disk for debugging.
  - Hard disk space is strictly protected by deterministic size-based rotation and backup pruning (capped at 50 MB per service).
  - Prompts and confidential tender document text are automatically truncated before reaching any log file.
  - Zero external npm dependencies added.
- **Trade-offs**:
  - To view verbose debug logs during local development, developers inspect `logs/api.log` and `logs/ai.log` (or set `LOG_LEVEL_CONSOLE=DEBUG`).
