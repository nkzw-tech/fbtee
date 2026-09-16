---
name: fbtee-translate
description: Translate new fbtee catalog entries across a project's supported locales, matching existing language style and source-code context. Use when asked to translate or update fbtee translations.
---

# Translate with fbtee

Complete every new translation in every supported locale unless the user requests a narrower scope.

1. Find the project's translation scripts, editable catalog directories, and supported locales in its configuration and existing catalogs. Reuse its package manager, paths, and compiler options, including common strings and source directories.
2. Run `fbtee collect`, then `fbtee prepare-translations` for all requested locales, using the project's scripts or equivalent commands. Edit the prepared translation files, not generated runtime catalogs.
3. Before translating each locale, read its existing translations to match terminology, formal or informal address, capitalization, punctuation, and tone. Follow any project glossary or style guide. For a new locale, use the source context and project guidance to choose a consistent style.
4. Translate every entry with `"status": "new"`. Read the description and locate the phrase in source code using the collected source references to understand its UI context and dynamic values. Preserve placeholder names and markup tokens exactly. Use natural phrasing and the plural and gender variants required by the target language, following the existing catalog format and comparable entries.
5. Remove `"status": "new"` only when the entire entry, including its variants, is complete. Preserve completed translations unless the user requests edits. If context is insufficient to resolve an ambiguity, leave the entry marked new and report the specific blocker.
6. Run `fbtee translate` with the project's options and any existing translation checks. Inspect the editable catalog diff for unintended changes and verify that no `"status": "new"` entries remain in the requested locales, except reported blockers. Successful compilation alone does not prove completion. Report the locales completed and any unresolved entries; continue through all locales rather than stopping after a sample.
