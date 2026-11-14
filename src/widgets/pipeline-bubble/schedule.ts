/** GPipe schedule: every stage runs all forward micro-batches, then all backward ones. Returns where each F and B block sits in time. */
export function gpipe(stages: number, micro: number) {
  const forwardSlots = micro + stages - 1
  const slots = 2 * forwardSlots
  const blocks: { stage: number; micro: number; kind: 'F' | 'B'; slot: number }[] = []
  for (let st = 0; st < stages; st++) {
    for (let m = 0; m < micro; m++) {
      blocks.push({ stage: st, micro: m, kind: 'F', slot: st + m })
      blocks.push({ stage: st, micro: m, kind: 'B', slot: forwardSlots + (stages - 1 - st) + m })
    }
  }
  return { slots, busy: 2 * micro, bubble: (stages - 1) / (micro + stages - 1), blocks }
}
