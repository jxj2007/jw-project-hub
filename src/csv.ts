/** 简易 CSV 解析：支持引号包裹、逗号转义、CRLF */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQ = false
  const s = text.replace(/^\ufeff/, '')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else inQ = false
      } else cell += c
    } else if (c === '"') {
      inQ = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (c !== '\r') {
      cell += c
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''))
}

/** 按表头别名取值 */
export function pick(row: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    const v = row[a]
    if (v !== undefined && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}
