# Language preference and bilingual recommendations

GET `/api/v1/settings/language` returns `{language:null|"en"|"zh-CN"|"zh-Hant"}`. POST the same endpoint with `{language}` to save the user's chosen language. User-facing names are **English**, **简体中文**, **繁体中文**, without country/region qualifiers. Explicit instructions override a saved preference. When none is established, the user's own prompt language is a useful signal; confirm only when ambiguous. A copied starter prompt contains its selected language explicitly. Respond and conduct intake in that language, save it for the webpage and reuse known answers.

Australian source listings, employer titles, verbatim quotations and original evidence remain English. Store the canonical structured assessment in English, then save parallel translated explanations. This preserves practical English wording for CVs, recruiter questions and clarification. The local app does not call a translation provider or invent missing translations.

After saving an assessment, POST `/api/v1/jobs/:jobId/translations`:

```json
{"operationId":"unique-translation-operation","assessmentId":"SAVED_ASSESSMENT_ID","language":"zh-CN","entries":[{"english":"Exact saved assessment statement","translated":"对应的中文说明"}]}
```

Include the reasons, concerns, unknowns, follow-up questions, axis explanations and confidence explanation relevant to the user. Each English string must exactly match a statement in that saved assessment. Translation entries cannot replace source quotes. Changed translations use a new operationId. GET the same URL reads translation history. The UI shows translated explanations with expandable English originals. Missing translations are explicitly labelled and fall back to English. The webpage's language control can change its preference independently; changing it reloads the page, so save form edits first. Full reset clears the preference and translations too.
