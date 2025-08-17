const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const archiveDir = path.join(dataDir, 'archived_user_configs')

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true })

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'))

for (const f of files) {
  // keep server config and channel files
  if (f.endsWith('-config.json') || f.endsWith('-channel.json')) continue

  const src = path.join(dataDir, f)
  const dest = path.join(archiveDir, f)

  console.log(`Archiving ${f} -> archived_user_configs/${f}`)
  fs.renameSync(src, dest)
}

console.log('Migration complete. Archived user-specific files to data/archived_user_configs')
