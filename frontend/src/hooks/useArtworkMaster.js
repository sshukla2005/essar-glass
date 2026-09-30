// Artwork Master: the per-company artwork library (Masters > Artwork), stored in
// company settings under 'artwork_master' as [{ id, name, file_name, file_data, created_at }].
//
// The server is the source of truth. The localStorage copy is only a cache for code
// that reads it synchronously, and is overwritten with every server read, so a
// deleted list stays deleted. A failed read raises instead of returning [], so a
// save can never replace the library with an empty list by accident.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'

export const ARTWORK_SETTING_KEY = 'artwork_master'
const CACHE_KEY = 'artwork_master'

const queryKey = () => ['artwork_master', localStorage.getItem('active_company_id') || '']

const writeCache = (list) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)) } catch { /* storage full or blocked */ }
}

const fetchArtworks = async () => {
  const res = await api.get(`/api/v1/settings/${ARTWORK_SETTING_KEY}`)
  const raw = res.data?.value
  const list = raw ? JSON.parse(raw) : []
  const artworks = Array.isArray(list) ? list : []
  writeCache(artworks)
  return artworks
}

const saveArtworks = async (list) => {
  await api.post('/api/v1/settings/', { key: ARTWORK_SETTING_KEY, value: JSON.stringify(list) })
  writeCache(list)
  return list
}

export const newArtworkEntry = (name, fileName, fileData) => ({
  id: Date.now(),
  name,
  file_name: fileName || null,
  file_data: fileData,
  created_at: new Date().toISOString().split('T')[0],
})

export const useArtworkMaster = () => {
  const qc = useQueryClient()
  const { data: artworks = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKey(),
    queryFn: fetchArtworks,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: saveArtworks,
    onSuccess: (list) => qc.setQueryData(queryKey(), list),
  })

  // Always build on the freshest server list, never on a possibly stale cache
  const update = async (change) => {
    const current = await qc.fetchQuery({ queryKey: queryKey(), queryFn: fetchArtworks, staleTime: 0 })
    return mutation.mutateAsync(change(current))
  }

  return {
    artworks,
    isLoading,
    isError,
    refetch,
    isSaving: mutation.isPending,
    add: async (entry) => { await update(list => [...list, entry]); return entry },
    rename: (id, name) => update(list => list.map(a => (a.id === id ? { ...a, name } : a))),
    remove: (id) => update(list => list.filter(a => a.id !== id)),
    removeAll: () => mutation.mutateAsync([]),
  }
}
