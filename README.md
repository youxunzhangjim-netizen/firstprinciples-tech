# Prototype 3 — FirstPrinciples Tech

**Compliant arXiv/USPTO ODP Research Radar Pipeline + Ghost Draft Publisher + Embeddable Hardware Physics Widgets**

## Component A: Research Ingestion Pipeline (`pipeline/`)
- **arXiv Client (`src/radar/arxiv_client.py`)**: Enforces 2026 arXiv Terms of Use with a process-wide serial lock (concurrency = 1), minimum `>= 3.5s` inter-request spacing, descriptive `User-Agent`, conditional `ETag`/`If-Modified-Since` caching, exponential backoff (`base=2s`, `±30%` jitter, cap `600s`, max 8 retries) on HTTP 429/503, and SQLite idempotency keyed by `(arxiv_id, version)` with SHA-256 hashes.
- **USPTO Open Data Portal Client (`src/radar/uspto_odp_client.py`)**: Targets the post-March 2026 `POST https://api.uspto.gov/api/v1/patent/applications/search` endpoint via `X-API-KEY`.
- **Rubric Scorer & Ghost Draft Publisher (`config/rubric.json`, `src/radar/ghost_publisher.py`)**: Mints pure-stdlib HS256 JWTs for Ghost Admin API and structurally locks posts to `status: "draft"` (human editorial gate).
- **Automated Schedule**: `.github/workflows/daily-radar.yml` runs daily at `06:00 UTC`.

```bash
cd pipeline
.venv/Scripts/python.exe -m pytest -v
.venv/Scripts/python.exe -m radar.cli --dry-run
```

## Component B: Embeddable Physics & Hardware Widgets (`widgets/`)
- **Visual Direction**: Technical Broadsheet & IEEE Datasheet (`Newsreader`, `IBM Plex Sans`, `IBM Plex Mono`, archival cream `#F7F5EF`, blueprint cobalt `#1D4ED8`, oscilloscope copper `#B45309`).
- **`/quantum-overhead`**: Rotated surface-code logical qubit overhead estimator (`p_L ≈ A(p/p_th)^((d+1)/2)`) with log-scale SVG plot and hardware/hype presets.
- **`/ai-roofline`**: Log-log AI Accelerator Roofline Visualizer (B200, H100, MI300X, TPU v6e, Custom Silicon) classifying LLM Decode vs. Prefill bottlenecks.
- Supports `?widget=quantum|roofline&embed=1` chromeless responsive `<iframe>` mode for Ghost(Pro) embeds.

```bash
cd widgets
npm install
npm run typecheck
npm run test
npm run build
```
