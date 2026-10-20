# Compact local agent tasks

After the `user-consent` notice has been explicitly accepted in the conversation, prefer these task-level helpers when available over the existing HTTP API. They reduce repeated request construction and large responses. They use no model, perform no website research and never write the database directly. No additional service, credential or listening port is required.

The helper is `app/dist/tools/agent-tasks.js` in an extracted native release, `dist/tools/agent-tasks.js` after a source build, or `/opt/careervista/bundle/app/dist/tools/agent-tasks.js` in Docker. Run it with the selected native release's bundled Node, an available compatible host Node, or Docker's Node. A Docker user needs no local Node install.

```sh
node dist/tools/agent-tasks.js --help
node dist/tools/agent-tasks.js --origin http://127.0.0.1:4318 --task search-context < task.json
docker exec -i CONTAINER node /opt/careervista/bundle/app/dist/tools/agent-tasks.js --origin http://127.0.0.1:4318 --task search-context < task.json
```

Use the exact running app origin; the helper accepts loopback HTTP origins only and refuses redirects. Docker execution reaches the container listener directly: when the published host port differs from the listener, use the configured exact public origin with the raw host HTTP API instead of assuming Docker localhost will work. JSON input is read from stdin (up to 2 MB). Stdout is compact JSON; errors go to stderr with a nonzero exit. `--help` lists the task input shapes without connecting to the app. TypeScript consumers can import `LocalAgentTasks` and `AgentTaskInputs`.

| Task | Purpose and prerequisites |
| --- | --- |
| `search-context` | `{}` reads the active profile. `{runId,offset?,limit?}` reads the run's pinned profile, costs/counters, first 25 unfinished work items and paged previews (default 25, maximum 100). `nextOffset` and totals expose truncation. It reads no CVs or full listing text; snippets are capped at 500 characters. |
| `plan-search` | `{run,plans}` creates an approved-profile run and one plan per selected source. `run` is the existing `RunInput`; each plan has `source` and `config`. It never approves a draft or invents scope/budgets. Partial planning returns the saved run, successful plans and source-specific failures, with a nonzero CLI exit; inspect state before retrying. |
| `prepare-work` | `{runId,operationId,workKey,modelWork,estimate?,currency?}` reserves an estimate for model work, then authorizes the planned item. Reuse one operation ID only for an identical retry; each new model operation needs a fresh ID/reservation. The caller settles actual/unknown costs through the existing runs API. |
| `save-previews` | `{runId,operationId,searchKey,outcome,listings?}` saves deferred previews for an already prepared search. It creates no jobs or fit assessments. Failed access and genuinely empty successful searches remain separate outcomes. |
| `screen-candidates` | `{runId,operationId,decisions}` selects/skips discovered candidates with reasons, preserving the existing detailed listing limit; returns disposition counts. Read the paged context for candidate work keys. |
| `capture-evidence` | `{runId,capture}` saves verified original evidence for an already selected/prepared listing using the existing capture envelope; returns job/observation IDs, completion and actual capture method, without echoing source text. |
| `save-assessment` | `{assessment}` saves the agent's evidence-linked `AssessmentInput` through the existing API; returns assessment/job IDs, fit label and replay status. It does not invent reasoning, authorize model work, checkpoint the run or change user/application decisions. |

Continue using the existing APIs for profile draft review/approval, run controls/checkpoints/cost settlement, document variants and other operations. Keep explicit user approvals, clickable categorical questions, user-entered numeric values and the headless-first access order. All domain rules, immutable evidence and retry receipts remain owned by the existing API.

Use stable request/operation/submission identifiers. The helper makes no automatic retries. A timeout may follow a successful mutation: inspect saved state and retry unchanged identifiers rather than making new ones. Plan creation is a sequence, not an atomic transaction; earlier successful plans survive later failures. Returned API errors preserve status/code without dumping request bodies. This client and the consent prompt do not technically control an external agent's data handling.

## Batch operations and smaller follow-up reads

Use `--task batch` to run 1–100 ordered tasks in one host tool call:

```json
{"tasks":[{"task":"prepare-work","input":{"runId":"RUN","operationId":"prepare-query-1","workKey":"QUERY1","modelWork":false}},{"task":"prepare-work","input":{"runId":"RUN","operationId":"prepare-query-2","workKey":"QUERY2","modelWork":false}}]}
```

A batch validates task names and object envelopes before any calls, then executes sequentially through the same API. It stops at the first API error or partial result; prior writes persist. Inspect `results`, `stoppedAt`, `remaining` and `error` before resuming with the same identifiers. There is no rollback or automatic retry. Each input must already have the IDs it needs; run planning/capture first to obtain IDs for later batches. Batch model preparation still requires truthful `modelWork:true` and estimates. Do not label agent reasoning as model-free work to bypass budgets.

For subsequent `search-context` reads, use `{ "runId":"RUN", "includeProfile":false, "disposition":"pending", "limit":25 }`. The profile is neither fetched nor returned; only matching previews are paged. `totalCandidates` counts all candidates, `matchingCandidates` counts the filtered set, and `nextOffset` refers to that set. After selecting/skipping rows, restart pending pagination at offset zero because the filtered set changed. Request the profile again when switching runs or revisions. These options reduce repeated context; they do not remove any saved evidence.
