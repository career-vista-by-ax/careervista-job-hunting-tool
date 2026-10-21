# Before using CareerVista skills

## Notice to show the user

CareerVista skills are instruction files. They do not themselves send your information to CareerVista. The CareerVista app stores the career data you choose to save locally, including job evidence, preferences and any saved CV text or drafts. Job research is not fully offline: search tools, websites and public APIs receive requests when used.

Your chosen AI agent, model provider and connected tools may receive, process, log or retain information used in this workflow, including your messages, CV, career preferences and retrieved content, under their own policies and settings. Local CareerVista storage does not make the agent/model offline or guarantee confidentiality. CareerVista cannot control those providers' data handling. Information already sent to your chat host may already have been processed; this choice cannot undo that.

Share only information you are comfortable providing to your chosen tools. You can continue without a CV, redact personal details, or stop now. Continuing acknowledges these data-handling risks; it does not grant blanket permission to read files, share documents, spend money, submit applications or send messages.

Do you understand this notice and want to continue?

- **I understand and agree to continue**
- **Stop — do not proceed**

## Agent procedure

Show the full notice and ask this as the first user-facing decision before setup, connection checks, intake, reading local profiles/history/documents, browsing, model work on career data or saving anything. Before agreement, read only skill/consent instructions and inspect the host's available question-tool metadata. Use the user's message language to translate the notice faithfully; do not read saved language settings first.

Before presenting the question, check the host's available native question/choice tools. When a suitable tool is available and permitted, **call it** with the full notice and the two suggested answers so the user can click a choice. In Codex, use `request_user_input_async` when listed and follow its current argument schema. If the call is rejected because of an argument-shape error, inspect the error/schema and retry with valid arguments; that error does not mean the choice UI is unavailable. Ordinary Markdown options or asking the user to type agreement are not substitutes. Keep the host's custom/free-text input optional; choosing either suggested answer must require no typing. Offer the two choices above without recommending agreement or treating a preselected choice as acceptance. Only when no permitted native question surface is available in the current mode, display the notice in chat, explain that limitation once, and ask for an explicit reply. This consent question is an exception to the usual recommended-first/undecided intake format.

Wait for an explicit affirmative response to this displayed notice. Silence, timeouts, ambiguous/custom replies, prior setup/profile approval and a request to start are not consent. Clarify ambiguity without starting work. Stop on refusal, withdrawal or a stop choice; acknowledge and take no further workflow action. With asynchronous tools, keep all workflow work pending until agreement arrives.

Explicit agreement to this notice is reusable across the bundled skills in the same conversation; do not ask again when handing off from search to CV tailoring or review. Ask again in a new conversation, if the notice changes, or before proceeding with a changed host/model/provider/data-sharing scope that the previous acknowledgement did not cover. Keep the acknowledgement in the conversation; never invent it or infer it from a stored boolean. Other specific approvals and host execution permissions remain necessary where required.

This is an agent instruction gate, not a technical control over the host or model. When entering through an HTTP guide without a local skill, read this notice before requesting any career records; guide discovery alone may precede it. Updating or discussing the software/skills does not itself invoke a career-data workflow or require the maintainer to accept this notice.
