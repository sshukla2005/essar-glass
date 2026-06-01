import api from './axios'

const KEYS = {
  GLASS_RATE_MATRIX:    'glass_rate_matrix',
  UOM_RATE_MASTER:      'uom_rate_master',
  GLASS_DROPDOWN_CONFIG:'glass_dropdown_config',
  ARTWORK_MASTER:       'artwork_master',
}

const get = async (key) => {
  try {
    const res = await api.get(`/api/v1/settings/${key}`)
    if (res.data?.value) {
      return JSON.parse(res.data.value)
    }
    return null
  } catch {
    return null
  }
}

const save = async (key, value) => {
  try {
    await api.post('/api/v1/settings/', {
      key,
      value: JSON.stringify(value),
    })
  } catch (err) {
    console.error('Settings save failed:', err)
  }
}

// ── One-time migration from localStorage to backend ──────────
// Call this once on app startup (in App.jsx or main layout)
// If backend already has the value, skip. If not, migrate from localStorage.
const migrateFromLocalStorage = async () => {
  const migrations = [
    {
      lsKey:     'glass_rate_matrix',
      backendKey: KEYS.GLASS_RATE_MATRIX,
      default:   {}
    },
    {
      lsKey:     'uom_rate_master',
      backendKey: KEYS.UOM_RATE_MASTER,
      default:   []
    },
    {
      lsKey:     'glass_dropdown_config',
      backendKey: KEYS.GLASS_DROPDOWN_CONFIG,
      default:   {}
    },
    {
      lsKey:     'artwork_master',
      backendKey: KEYS.ARTWORK_MASTER,
      default:   []
    },
  ]

  for (const m of migrations) {
    try {
      // Check if backend already has it
      const existing = await get(m.backendKey)
      if (existing !== null && existing !== undefined) {
        // Backend already has data — skip migration but also
        // update localStorage to stay in sync
        localStorage.setItem(m.lsKey, JSON.stringify(existing))
        continue
      }

      // Backend empty — check localStorage
      const lsRaw = localStorage.getItem(m.lsKey)
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw)
          // Only migrate if there is actual data (not empty object/array)
          const hasData = Array.isArray(parsed)
            ? parsed.length > 0
            : Object.keys(parsed || {}).length > 0

          if (hasData) {
            await save(m.backendKey, parsed)
            console.log(`✅ Migrated ${m.lsKey} to backend`)
          }
        } catch {}
      }
    } catch (err) {
      console.error(`Migration failed for ${m.lsKey}:`, err)
    }
  }
}

export const settingsApi = { get, save, migrateFromLocalStorage, KEYS }
export default settingsApi
