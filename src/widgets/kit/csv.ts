/** A small RFC 4180 reader: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  const [head, ...body] = rows
  if (!head) return []
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])))
}

/**
 * The first `rows` rows of a CSV response, reading no more of it than that needs.
 * Counting lines is enough because the datasets have no newlines inside quoted fields.
 */
export async function readCsvHead(res: Response, rows: number): Promise<Record<string, string>[]> {
  if (!res.body) return parseCsv(await res.text()).slice(0, rows)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let lines = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return parseCsv(text + decoder.decode()).slice(0, rows)
      const part = decoder.decode(value, { stream: true })
      text += part
      lines += part.split('\n').length - 1
      if (lines > rows) return parseCsv(text.slice(0, text.lastIndexOf('\n') + 1)).slice(0, rows)
    }
  } finally {
    reader.cancel().catch(() => undefined)
  }
}
