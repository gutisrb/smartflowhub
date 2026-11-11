// Checks one cold-email draft for the red flags Nikola has rejected. Usage: node lint_copy.mjs <file>
// First line of the file is the subject, the rest is the body. Exit 1 on a flag; warnings do not fail.
import { readFileSync } from 'fs'
import { redFlags } from './lib/copy-red-flags.mjs'

const [subject, ...rest] = readFileSync(process.argv[2], 'utf8').replace(/^Subject:\s*/i, '').split('\n')
const { flags, warnings } = redFlags({ subject, body: rest.join('\n') })
for (const f of flags) console.log(`✗ ${f}`)
for (const w of warnings) console.log(`! ${w}`)
console.log(flags.length ? `\n${flags.length} red flag(s)` : '\n✓ no red flags')
process.exit(flags.length ? 1 : 0)
