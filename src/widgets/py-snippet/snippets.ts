/**
 * Every runnable snippet, by id. Each chapter's snippets live in their own module; shared types and data helpers are in
 * `common.ts`. Plain data and strings, so a test can run every snippet, for every project, through a local Python.
 */
import type { Snippet } from './common.ts'
import { C1 } from './c1.ts'
import { C2 } from './c2.ts'
import { C3 } from './c3.ts'
import { C4 } from './c4.ts'
import { C5 } from './c5.ts'
import { C6 } from './c6.ts'
import { C7 } from './c7.ts'
import { C8 } from './c8.ts'
import { C9 } from './c9.ts'
import { C10 } from './c10.ts'

export type { Snippet, SnippetBundle } from './common.ts'
export { projectMessages } from './common.ts'

export const SNIPPETS = { ...C1, ...C2, ...C3, ...C4, ...C5, ...C6, ...C7, ...C8, ...C9, ...C10 } satisfies Record<string, Snippet>

export type SnippetId = keyof typeof SNIPPETS
export const SNIPPET_IDS = Object.keys(SNIPPETS) as SnippetId[]
