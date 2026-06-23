---
name: forms.ts markdown contamination
description: Backtick code fences accidentally inserted at top of forms.ts cause a cryptic runtime error
---

## Rule
If the server fails with `TypeError: "" is not a function` pointing to `forms.ts:1:1`, check for markdown code fence markers (` ``` `) at the very top of the file.

**Why:** In JavaScript, ` ``` ` is parsed as an empty template literal `""` immediately followed by a tagged template call. The tag (`""`) is then called as a function, throwing `TypeError: "" is not a function`. TypeScript/esbuild compilation succeeds (valid JS syntax) but the module crashes on load at runtime.

**How to apply:** After any edit touching the top of forms.ts (or any .ts file), verify lines 1-5 contain only valid TypeScript imports — not markdown fences. Remove any ` ``` ` lines immediately.
