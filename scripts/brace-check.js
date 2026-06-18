#!/usr/bin/env node
// Brace/paren/bracket balance check for source files. Quick gate to catch
// edit corruption before commits. Walk the dir argv[2] (default src/).
const fs = require('fs'), path = require('path')
const root = process.argv[2] || 'src'
let bad = 0, total = 0
function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const fp = path.join(p, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) { walk(fp); continue }
    if (!/\.(js|jsx|ts|tsx|mjs)$/.test(f)) continue
    total++
    const src = fs.readFileSync(fp, 'utf8')
    const c = { '{': 0, '}': 0, '(': 0, ')': 0, '[': 0, ']': 0 }
    for (const ch of src) if (ch in c) c[ch]++
    const issues = []
    if (c['{'] !== c['}']) issues.push(`braces ${c['{']}/${c['}']}`)
    if (c['('] !== c[')']) issues.push(`parens ${c['(']}/${c[')']}`)
    if (c['['] !== c[']']) issues.push(`brackets ${c['[']}/${c[']']}`)
    if (issues.length) { console.error('✗ ' + fp + ': ' + issues.join(', ')); bad++ }
    else console.log('✓ ' + fp)
  }
}
walk(root)
console.log(`\n${bad} of ${total} file(s) unbalanced`)
process.exit(bad ? 1 : 0)
