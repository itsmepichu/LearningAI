import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export interface Example {
  id: string
  text: string
  label: string
  language: string
}

export interface LabelledSet {
  file: string
  /** "dispute cases": what each row is. */
  noun: string
  /** "reason": what the label means. */
  target: string
  rows: Example[]
  /** A new message to try, in the project's words. */
  tryText: string
}

/** Enough rows to train on, and few enough that embedding them on a laptop takes well under a minute. */
export const MAX_ROWS = 400

interface Review {
  id: string
  stars: number
  language: string
  text: string
  is_injection: boolean
}

const STAR_LABEL = (stars: number) => (stars >= 4 ? 'positive' : stars === 3 ? 'mixed' : 'negative')

/** Each project's labelled text. The same fields come out, so the widget does not know the domain. */
export async function loadLabelled(p: Project, read: DataReader): Promise<LabelledSet> {
  if (p.id === 'bank') {
    const rows = await read.csv('disputes.csv')
    return {
      file: 'disputes.csv',
      noun: 'dispute cases',
      target: 'reason',
      rows: rows.map((r) => ({ id: r.case_id, text: r.text, label: r.reason, language: r.language })),
      tryText: 'The shop took my money twice for one bill.',
    }
  }
  if (p.id === 'harbor') {
    const rows = await read.csv('tickets.csv', MAX_ROWS)
    return {
      file: 'tickets.csv',
      noun: 'support tickets',
      target: 'category',
      rows: rows.map((r) => ({ id: r.ticket_id, text: r.text, label: r.category, language: r.language })),
      tryText: 'My colleague cannot get into the admin console.',
    }
  }
  if (p.id === 'store') {
    const rows = await read.json<Review[]>('reviews.json')
    return {
      file: 'reviews.json',
      noun: 'product reviews',
      target: 'sentiment, from the star rating',
      // The planted prompt-injection reviews belong to another lesson, and their stars say nothing about their text.
      rows: rows.filter((r) => !r.is_injection).slice(0, MAX_ROWS).map((r) => ({ id: r.id, text: r.text, label: STAR_LABEL(r.stars), language: r.language })),
      tryText: 'The colour faded after one wash and the stitching came apart.',
    }
  }
  const rows = await read.csv('requests.csv')
  return {
    file: 'requests.csv',
    noun: 'traveller requests',
    target: 'intent',
    rows: rows.map((r) => ({ id: r.request_id, text: r.text, label: r.intent, language: r.language })),
    tryText: 'Our flight got scrapped because of the storm, what are our options?',
  }
}
