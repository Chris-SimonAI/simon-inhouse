# Agent Handoff Template

Use this template when switching between Codex and Claude Code.

## 1) Session Snapshot
- Date/Time:
- Agent:
- Branch:
- Base commit:
- Target repo:
- Ticket/goal:

## 2) Current Status
- What is done:
- What is in progress:
- What is blocked:

## 3) Code Changes
- Files changed:
- Behavior changes:
- Non-obvious decisions/tradeoffs:

## 4) Validation Run
- Commands executed:
- Result summary:
- Not run (and why):

## 5) Risks / Follow-Ups
- Known risks:
- Required follow-up checks:
- Suggested next 1-3 actions:

## 6) Runtime / Env Notes
- Environment used (local, Railway, etc.):
- Required env vars touched:
- Migration/data changes:

## 7) Repo Safety Guardrails
- Only push/PR to:
- `simoninhouse`
- `chris-simonai`
- Never push/PR to:
- `podifi`

## 8) Cloudflare Fortification Notes (if relevant)
- Scraping status:
- Order bot status:
- Last known failure stage:
- Logs or traces to inspect next:

## 9) Railway Log Query Cheat-Sheet
- Base telemetry filter: `[bot-telemetry]`
- Failures only: `[bot-telemetry] "success":false`
- Cloudflare-hit runs: `[bot-telemetry] "cf_detected":true`
- Order bot failures: `[bot-telemetry] "run_type":"toast-order" "success":false`
- Menu scrape failures: `[bot-telemetry] "run_type":"menu-scrape" "success":false`
- Calibrate/test failures: `[bot-telemetry] "run_type":"scraper-calibrate" "success":false` and `[bot-telemetry] "run_type":"scraper-test" "success":false`
- Slow runs quick scan: `[bot-telemetry] "duration_ms":` then sort by newest and inspect high values
