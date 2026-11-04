import type { ProjectId } from '../../data/projects'

/** A hand-written ranking and relevance judgements over document ids from the project's dataset. */
export interface RankingScenario {
  query: string
  ranked: string[]
  grades: Record<string, number>
}

export const SCENARIOS: Record<ProjectId, RankingScenario> = {
  harbor: {
    query: 'Can a customer get money back after an outage?',
    ranked: ['HP-011', 'HP-009', 'HP-013', 'HP-010', 'HP-008', 'HP-014', 'HP-006', 'HP-012', 'HP-007', 'HP-001'],
    grades: { 'HP-010': 3, 'HP-009': 2, 'HP-006': 1 },
  },
  store: {
    query: 'Comfortable walking shoes, UK 8',
    ranked: ['BZ-FOO-1084', 'BZ-FOO-1205', 'BZ-FOO-1026', 'BZ-FOO-1102', 'BZ-FOO-1030', 'BZ-FOO-1093', 'BZ-FOO-1080', 'BZ-FOO-1052', 'BZ-FOO-1130', 'BZ-KIT-1065'],
    grades: { 'BZ-FOO-1102': 3, 'BZ-FOO-1205': 2, 'BZ-FOO-1080': 1 },
  },
  bank: {
    query: 'Money left my account but the UPI payment failed. What happens now?',
    ranked: ['NB-005', 'NB-001', 'NB-004', 'NB-002', 'NB-007', 'NB-003', 'NB-006', 'NB-008'],
    grades: { 'NB-002': 3, 'NB-001': 2, 'NB-006': 1 },
  },
  travel: {
    query: 'The airline cancelled my flight because of fog. Can I get a refund?',
    ranked: ['SR-006', 'SR-002', 'SR-004', 'SR-007', 'SR-005', 'SR-008', 'SR-003', 'SR-001'],
    grades: { 'SR-007': 3, 'SR-002': 2, 'SR-003': 1 },
  },
}
