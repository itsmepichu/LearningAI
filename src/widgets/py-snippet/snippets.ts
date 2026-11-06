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
import { C11 } from './c11.ts'
import { C12 } from './c12.ts'
import { C13 } from './c13.ts'
import { C14 } from './c14.ts'
import { C15 } from './c15.ts'
import { C16 } from './c16.ts'
import { C17 } from './c17.ts'
import { C18 } from './c18.ts'
import { C19 } from './c19.ts'
import { C20 } from './c20.ts'
import { C21 } from './c21.ts'
import { C22 } from './c22.ts'
import { C23 } from './c23.ts'
import { CAPSTONE } from './capstone.ts'

export type { Snippet, SnippetBundle } from './common.ts'
export { projectMessages } from './common.ts'

export const SNIPPETS = { ...C1, ...C2, ...C3, ...C4, ...C5, ...C6, ...C7, ...C8, ...C9, ...C10, ...C11, ...C12, ...C13, ...C14, ...C15, ...C16, ...C17, ...C18, ...C19, ...C20, ...C21, ...C22, ...C23, ...CAPSTONE } satisfies Record<string, Snippet>

export type SnippetId = keyof typeof SNIPPETS
export const SNIPPET_IDS = Object.keys(SNIPPETS) as SnippetId[]
