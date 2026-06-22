export interface TMCloudConfig {
  url: string
  key: string
  serviceKey: string
}

let currentConfig: TMCloudConfig | null = null

function normalizeUrl(url: string): string {
  const value = url.trim().replace(/\/+$/, '')
  const match = value.match(/^(https?:\/\/.+?\/api\/prj_[A-Za-z0-9]+)/i)
  return match ? match[1] : value
}

function authHeaders(key: string, json = false): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function responseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.error || body?.message || `HTTP ${res.status}: ${res.statusText}`
}

export async function loadConfig(): Promise<TMCloudConfig> {
  try {
    if ((window as any).electron?.invoke) {
      const res = await (window as any).electron.invoke('tmcloud:getConfig')
      if (res.success && res.data) {
        return {
          url: res.data.url || '',
          key: res.data.public_key || '',
          serviceKey: res.data.secret_key || '',
        }
      }
    }
  } catch (_e) { /* TM Cloud config not available yet. */ }
  return { url: '', key: '', serviceKey: '' }
}

export async function saveConfig(url: string, key: string, serviceKey: string) {
  if (!(window as any).electron?.invoke) throw new Error('Electron no disponible')
  const res = await (window as any).electron.invoke('tmcloud:saveConfig', {
    url: normalizeUrl(url),
    public_key: key.trim(),
    secret_key: serviceKey.trim(),
  })
  if (!res.success) throw new Error(res.error || 'No se pudo guardar configuracion de TM Cloud')
}

export function init(config: { url: string; key: string; serviceKey?: string }) {
  const url = normalizeUrl(config.url)
  const key = config.key.trim()
  const serviceKey = (config.serviceKey || '').trim()
  if (!url || !key) throw new Error('URL del proyecto y Public Key requeridos')
  if (!/^https?:\/\//i.test(url)) throw new Error('La URL debe comenzar con http:// o https://')
  if (!/\/api\/prj_[A-Za-z0-9]+$/i.test(url)) {
    throw new Error('Usa la URL base del proyecto: https://dominio.com/api/prj_xxx')
  }
  currentConfig = { url, key, serviceKey }
}

export function getConfig() {
  return currentConfig
}

export function isConnected() {
  return currentConfig !== null
}

export async function testConnection(url: string, key: string) {
  const base = normalizeUrl(url)
  if (!/\/api\/prj_[A-Za-z0-9]+$/i.test(base)) {
    throw new Error('URL invalida. Usa https://tu-dominio.com/api/prj_xxx')
  }
  const res = await fetch(`${base}/health`, { headers: authHeaders(key.trim()) })
  if (!res.ok) {
    const message = await responseError(res)
    if (res.status === 404 && /route not found/i.test(message)) {
      throw new Error('TMPBase no tiene disponible /health. Sube al servidor la version actualizada de app/Controllers/ApiController.php')
    }
    throw new Error(message)
  }
  const data = await res.json()
  if (data.status !== 'ok') throw new Error('Respuesta inesperada de TMPBase')
  return data.data
}

function getCloudApi(): { url: string; key: string } | null {
  return currentConfig ? { url: currentConfig.url, key: currentConfig.key } : null
}

function getCloudWriteApi(): { url: string; key: string } | null {
  if (!currentConfig) return null
  const key = currentConfig.serviceKey || currentConfig.key
  return { url: currentConfig.url, key }
}

export async function verifyTable(tabla: string) {
  const api = getCloudApi()
  if (!api) return false
  try {
    const res = await fetch(`${api.url}/${encodeURIComponent(tabla)}?limit=1`, {
      headers: authHeaders(api.key),
    })
    return res.ok
  } catch (_e) { return false }
}

export async function syncTableUpload(tabla: string, localData: any[]) {
  const api = getCloudWriteApi()
  if (!api || localData.length === 0) return { success: true, synced: 0 }
  const rows = localData.map(row => cleanRecord(row))
  const res = await fetch(`${api.url}/${encodeURIComponent(tabla)}/upsert`, {
    method: 'POST',
    headers: authHeaders(api.key, true),
    body: JSON.stringify({ rows }),
  })
  if (!res.ok) throw new Error(await responseError(res))
  const json = await res.json()
  const result = json.data || {}
  return { success: true, synced: (result.inserted || 0) + (result.updated || 0) }
}

export async function fetchTable(tabla: string, updatedSince?: string): Promise<any[]> {
  const api = getCloudApi()
  if (!api) return []
  const path = updatedSince
    ? `${api.url}/${encodeURIComponent(tabla)}/sync?from=${encodeURIComponent(updatedSince)}`
    : `${api.url}/${encodeURIComponent(tabla)}?limit=100`
  const res = await fetch(path, { headers: authHeaders(api.key) })
  if (!res.ok) throw new Error(await responseError(res))
  const json = await res.json()
  return json.data || []
}

export async function insertRecord(tabla: string, data: any) {
  const api = getCloudWriteApi()
  if (!api) return null
  const res = await fetch(`${api.url}/${encodeURIComponent(tabla)}`, {
    method: 'POST',
    headers: authHeaders(api.key, true),
    body: JSON.stringify(cleanRecord(data)),
  })
  if (!res.ok) throw new Error(await responseError(res))
  const json = await res.json()
  return json.data || null
}

export async function updateRecord(tabla: string, uid: string | number, data: any) {
  const api = getCloudWriteApi()
  if (!api) return false
  const res = await fetch(`${api.url}/${encodeURIComponent(tabla)}/${encodeURIComponent(String(uid))}`, {
    method: 'PUT',
    headers: authHeaders(api.key, true),
    body: JSON.stringify(cleanRecord(data, true)),
  })
  if (!res.ok) throw new Error(await responseError(res))
  return true
}

export async function deleteRecord(tabla: string, uid: string | number) {
  const api = getCloudWriteApi()
  if (!api) return false
  const res = await fetch(`${api.url}/${encodeURIComponent(tabla)}/${encodeURIComponent(String(uid))}`, {
    method: 'DELETE',
    headers: authHeaders(api.key),
  })
  if (!res.ok && res.status !== 404) throw new Error(await responseError(res))
  return true
}

export function cleanRecord(data: any, updating = false): any {
  const record = { ...data }
  delete record.id
  delete record._rowId
  if (updating) {
    delete record.uid
    delete record.created_at
  }
  return record
}

function getStorageUrl(): string | null {
  if (!currentConfig?.url) return null
  const apiUrl = currentConfig.url.replace(/\/+$/, '')
  const base = apiUrl.replace(/\/api\/[^/]+$/, '')
  const projectMatch = apiUrl.match(/\/(prj_[A-Za-z0-9]+)$/i)
  if (!projectMatch) return null
  const projectUid = projectMatch[1]
  return `${base}/storage/${projectUid}`
}

function getStorageWriteKey(): { key: string; type: 'secret' | 'public' } | null {
  if (currentConfig?.serviceKey) return { key: currentConfig.serviceKey, type: 'secret' }
  if (currentConfig?.key) return { key: currentConfig.key, type: 'public' }
  return null
}

export async function uploadImage(file: File, directory: string): Promise<string> {
  const storageUrl = getStorageUrl()
  const auth = getStorageWriteKey()
  if (!storageUrl || !auth) throw new Error('TM Cloud no configurado')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('directory', directory)

  const res = await fetch(`${storageUrl}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.key}` },
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `HTTP ${res.status} (key: ${auth.type})` +
      (text ? `: ${text.slice(0, 300)}` : '')
    )
  }
  const json = await res.json()
  return json.data?.uid || json.uid || ''
}

export function getImageUrl(uid: string): string | null {
  const storageUrl = getStorageUrl()
  if (!storageUrl || !uid) return null
  return `${storageUrl}/${uid}`
}

export async function deleteImage(uid: string): Promise<boolean> {
  const storageUrl = getStorageUrl()
  const key = getStorageWriteKey()
  if (!storageUrl || !key || !uid) return false
  const res = await fetch(`${storageUrl}/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  })
  return res.ok
}

export { authHeaders, getCloudApi, getCloudWriteApi, responseError, getStorageUrl, getStorageWriteKey }
