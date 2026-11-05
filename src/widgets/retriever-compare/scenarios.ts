import type { ProjectId } from '../../data/projects'

/**
 * One query per project. The lexical ranking is computed live with BM25.
 * Dense and hybrid rankings are written by hand, because no embedding model runs on this page.
 */
export interface CompareScenario {
  query: string
  grades: Record<string, number>
  dense: string[]
  hybrid: string[]
}

export const COMPARE: Record<ProjectId, CompareScenario> = {
  harbor: {
    query: 'get my money back after an outage on our annual plan',
    grades: { 'HP-010': 3, 'HP-009': 2, 'HP-006': 1 },
    dense: ['HP-010', 'HP-008', 'HP-006', 'HP-013', 'HP-009', 'HP-014', 'HP-011', 'HP-012'],
    hybrid: ['HP-010', 'HP-009', 'HP-006', 'HP-008', 'HP-012', 'HP-013', 'HP-011', 'HP-014'],
  },
  store: {
    query: 'comfortable shoes for walking UK 8',
    grades: { 'BZ-FOO-1102': 3, 'BZ-FOO-1205': 2, 'BZ-FOO-1080': 1 },
    dense: ['BZ-FOO-1084', 'BZ-FOO-1102', 'BZ-FOO-1026', 'BZ-FOO-1030', 'BZ-FOO-1205', 'BZ-FOO-1093', 'BZ-FOO-1052', 'BZ-FOO-1130'],
    hybrid: ['BZ-FOO-1102', 'BZ-FOO-1205', 'BZ-FOO-1080', 'BZ-FOO-1290', 'BZ-FOO-1242', 'BZ-FOO-1084', 'BZ-FOO-1026', 'BZ-FOO-1030'],
  },
  bank: {
    query: 'UPI debit reversal',
    grades: { 'NB-002': 3, 'NB-001': 2, 'NB-006': 1 },
    dense: ['NB-001', 'NB-005', 'NB-007', 'NB-002', 'NB-003', 'NB-006', 'NB-004', 'NB-008'],
    hybrid: ['NB-002', 'NB-001', 'NB-006', 'NB-005', 'NB-003', 'NB-007', 'NB-004', 'NB-008'],
  },
  travel: {
    query: 'flight cancelled because of heavy rain, can I get my money back',
    grades: { 'SR-007': 3, 'SR-002': 2, 'SR-003': 1 },
    dense: ['SR-002', 'SR-006', 'SR-004', 'SR-007', 'SR-005', 'SR-003', 'SR-001', 'SR-008'],
    hybrid: ['SR-007', 'SR-002', 'SR-003', 'SR-006', 'SR-004', 'SR-001', 'SR-005', 'SR-008'],
  },
}
