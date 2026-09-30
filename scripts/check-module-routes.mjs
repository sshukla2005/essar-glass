#!/usr/bin/env node
// Guard: every MODULES route (frontend/src/utils/modules.js) and every sidebar
// menu link (frontend/src/components/Layout/AppLayout.jsx) must match a route
// registered in frontend/src/App.jsx. An unregistered path hits the catch-all
// and silently redirects to "/".
//
// Run from the repo root:  node scripts/check-module-routes.mjs
// Exits 1 and lists each mismatch, or exits 0.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src')
const read = (p) => readFileSync(join(src, p), 'utf8')

// modules.js is plain data with no imports, so load the real MODULES array
const modulesSrc = read('utils/modules.js')
const { MODULES } = await import('data:text/javascript,' + encodeURIComponent(modulesSrc))

// Routes in App.jsx: nested ones are relative ("masters/hsn-codes"), a few are absolute ("/super/users")
const routes = new Set(
  [...read('App.jsx').matchAll(/<Route\s[^>]*?path="([^"]+)"/g)]
    .map(m => m[1])
    .filter(p => p !== '*')
    .map(p => (p.startsWith('/') ? p : '/' + p))
)
routes.add('/') // the index route

// Sidebar links in AppLayout.jsx: menu item keys that are paths ("/quotations"; groups are "grp_*")
const menuLinks = [...read('components/Layout/AppLayout.jsx').matchAll(/key:\s*'(\/[^']*)'/g)].map(m => m[1])

const problems = []
for (const m of MODULES) {
  if (!routes.has(m.route)) problems.push(`MODULES '${m.key}' route ${m.route} is not a route in App.jsx`)
}
for (const link of new Set(menuLinks)) {
  if (!routes.has(link)) problems.push(`AppLayout menu link ${link} is not a route in App.jsx`)
}

if (problems.length) {
  console.error(`✗ ${problems.length} route mismatch(es):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`✓ ${MODULES.length} module routes and ${new Set(menuLinks).size} menu links all match routes in App.jsx`)
