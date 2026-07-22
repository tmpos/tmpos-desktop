import * as tmc from './tmCloudClient'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
// Las credenciales SMTP son configuracion sensible de cada instalacion. No se
// descargan ni se sobrescriben mediante sincronizacion o realtime.
const LOCAL_SYSTEM_TABLES = ['configuracion', 'tmcloud_config', 'sync_deletes', 'bitacora', 'licencia', 'correo', 'otp_local_config']

const SYSTEM_TABLE_DEFS: Record<string, string[]> = {
  configuracion: ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'clave TEXT UNIQUE NOT NULL', 'valor TEXT DEFAULT ""', 'tipo TEXT DEFAULT "string"', 'categoria TEXT DEFAULT "general"', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
  tmcloud_config: ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'url TEXT NOT NULL DEFAULT ""', 'public_key TEXT NOT NULL DEFAULT ""', 'secret_key TEXT NOT NULL DEFAULT ""', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
  sync_deletes: ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'tabla TEXT NOT NULL', 'uid TEXT NOT NULL', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
  bitacora: ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'tabla TEXT DEFAULT ""', 'registro_id INTEGER DEFAULT 0', 'accion TEXT DEFAULT ""', 'usuario TEXT DEFAULT ""', 'datos_nuevos TEXT DEFAULT ""', 'datos_anteriores TEXT DEFAULT ""', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
  licencia: ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'licencia_equipo TEXT', 'licencia_cifrada TEXT', 'estado TEXT DEFAULT "sin_verificar"', 'nombre_empresa TEXT', 'fecha_inicio_prueba TEXT', 'fecha_vencimiento TEXT', 'ultima_verificacion TEXT', 'api_key TEXT', 'datos_servidor TEXT', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
}

interface ServerColumn {
  name: string
  type: string
  nullable?: boolean
  primary?: boolean
}

interface ServerTableInfo {
  name: string
  count: number
  columns: ServerColumn[]
}

export type SyncMode = 'offline' | 'online' | 'ambos'

export interface SyncDetail {
  tabla: string
  downloaded: number
  uploaded: number
  errors: number
}

export interface SyncResult {
  success: boolean
  inserts: number
  updates: number
  errors: number
  message: string
}

export interface SyncStatus {
  running: boolean
  tabla?: string
  progreso?: string
  error?: string
  lastSync?: string
  mode?: SyncMode
  result?: SyncResult
  details?: SyncDetail[]
  realtime?: boolean
}

let intervalId: ReturnType<typeof setInterval> | null = null
let realtimeStop: (() => void) | null = null
let syncingInProgress = false
let realtimeConnected = false
let currentMode: SyncMode = 'ambos'
let onStatusChange: ((status: SyncStatus) => void) | null = null
let onSyncComplete: ((details: SyncDetail[]) => void) | null = null

export function setStatusCallback(cb: (status: SyncStatus) => void) {
  onStatusChange = cb
}

export function setSyncCompleteCallback(cb: (details: SyncDetail[]) => void) {
  onSyncComplete = cb
}

export function setSyncMode(mode: SyncMode) {
  currentMode = mode
}

export function getSyncMode(): SyncMode {
  return currentMode
}

export function isOnline(): boolean {
  return currentMode !== 'offline' && tmc.isConnected()
}

export function isRealtimeConnected(): boolean {
  return realtimeConnected
}

function notify(status: SyncStatus) {
  onStatusChange?.(status)
}

function notifyLocalRealtimeChange(eventType: 'INSERT' | 'UPDATE', tabla: string, uid?: string) {
  window.dispatchEvent(new CustomEvent('tmcloud:local-change', {
    detail: { eventType, table: tabla, uid },
  }))
}

function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function getConfigValue(key: string): Promise<string> {
  try {
    const res = await (window as any).db.getAll('configuracion')
    if (!res.success || !Array.isArray(res.data)) return ''
    return res.data.find((row: any) => row.clave === key)?.valor || ''
  } catch {
    return ''
  }
}

async function setConfigValue(key: string, value: string): Promise<void> {
  const res = await (window as any).db.getAll('configuracion')
  if (!res.success || !Array.isArray(res.data)) return
  const row = res.data.find((item: any) => item.clave === key)
  if (row) {
    await (window as any).db.update('configuracion', row.id, { valor: value })
  } else {
    await (window as any).db.insert('configuracion', {
      clave: key,
      valor: value,
      tipo: 'string',
      categoria: 'tmcloud',
    })
  }
}

async function ensureCloudApi(): Promise<boolean> {
  if (tmc.isConnected()) return true
  const config = await tmc.loadConfig()
  if (!config.url || !config.key) return false
  try {
    tmc.init(config)
    return true
  } catch {
    return false
  }
}

async function reloadCloudApi(): Promise<boolean> {
  const config = await tmc.loadConfig()
  if (!config.url || !config.key) return false
  try {
    tmc.init(config)
    return true
  } catch {
    return false
  }
}

async function getLocalRows(tabla: string): Promise<any[]> {
  try {
    const res = await (window as any).db.getAll(tabla)
    return res.success && Array.isArray(res.data) ? res.data : []
  } catch {
    return []
  }
}

function timestamp(row: any): string {
  return String(row?.updated_at || row?.created_at || '')
}

function sameData(a: any, b: any): boolean {
  const clean = (row: any) => {
    const value = { ...row }
    delete value.id
    delete value._rowId
    delete value.created_at
    delete value.updated_at
    return value
  }
  return JSON.stringify(clean(a)) === JSON.stringify(clean(b))
}

interface CloudSyncChanges {
  updated: any[]
  deleted: string[]
}

async function fetchCloudSyncAll(since?: string): Promise<Record<string, CloudSyncChanges> | null> {
  const api = tmc.getCloudApi()
  if (!api) throw new Error('TM Cloud no configurado')
  const url = since
    ? `${api.url}/sync?since=${encodeURIComponent(since)}`
    : `${api.url}/sync`
  try {
    const res = await fetch(url, { headers: tmc.authHeaders(api.key) })
    if (!res.ok) {
      if (res.status === 404) return null
      if (res.status === 400 || res.status === 429) return {}
      throw new Error(await tmc.responseError(res))
    }
    const json = await res.json()
    // Try various possible response shapes:
    //   1. { changes: { table: { updated, deleted } } }
    //   2. { data: { changes: { table: { updated, deleted } } } }
    //   3. { data: { table: { updated, deleted } } }
    const raw = json.changes || json.data?.changes || json.data
    if (!raw || typeof raw !== 'object') return {}
    return raw as Record<string, CloudSyncChanges>
  } catch { return {} }
}

async function fetchCloudRows(tabla: string, since?: string): Promise<any[]> {
  const api = tmc.getCloudApi()
  if (!api) throw new Error('TM Cloud no configurado')

  // try sync endpoint first (incremental), fallback to paginated fetch
  if (since) {
    try {
      const res = await fetch(
        `${api.url}/${encodeURIComponent(tabla)}/sync?from=${encodeURIComponent(since)}`,
        { headers: tmc.authHeaders(api.key) },
      )
      if (res.ok) return (await res.json()).data || []
      if (res.status === 429) return []
    } catch {
      // fall through
    }
  }

  const all: any[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${api.url}/${encodeURIComponent(tabla)}?page=${page}&limit=100`,
      { headers: tmc.authHeaders(api.key) },
    )
    if (!res.ok) {
      if (res.status === 400 || res.status === 404 || res.status === 429) return []
      throw new Error(await tmc.responseError(res))
    }
    const json = await res.json()
    const rows = json.data || []
    all.push(...rows)
    const totalPages = json.meta?.pages || Math.ceil((json.meta?.total || 1) / 100)
    if (page >= totalPages || rows.length < 100) break
    page++
  }
  return all
}

export async function fetchServerSchema(): Promise<ServerTableInfo[]> {
  return fetchServerFullSchema()
}

async function fetchServerFullSchema(): Promise<ServerTableInfo[]> {
  const api = tmc.getCloudApi()
  if (!api) return []
  try {
    const res = await fetch(`${api.url}/schema`, { headers: tmc.authHeaders(api.key) })
    if (!res.ok) {
      if (res.status === 429) await delay(2000)
      return []
    }
    const json = await res.json()
    const data = json.data || {}
    return Object.entries(data).map(([name, info]: [string, any]) => ({
      name,
      count: info.count || 0,
      columns: info.columns || [],
    }))
  } catch { return [] }
}

function columnsToSqlDefs(cols: ServerColumn[]): string[] {
  return cols.map(c => {
    let def = `${c.name} ${c.type}`
    if (c.pk) def += ' PRIMARY KEY'
    if (c.notnull) def += ' NOT NULL'
    return def
  })
}

async function recreateLocalTable(tabla: string, columns: ServerColumn[]): Promise<boolean> {
  try {
    await (window as any).electron?.invoke('consultaservidor', 'eliminarTabla', tabla)
    const colDefs = columnsToSqlDefs(columns)
    await (window as any).electron?.invoke('consultaservidor', 'crearTabla', tabla, colDefs)
    return true
  } catch {
    return false
  }
}

async function upsertLocal(tabla: string, cloudRow: any): Promise<'inserted' | 'updated' | 'skipped'> {
  const localRows = await getLocalRows(tabla)
  let existing = localRows.find((row: any) => row.uid === cloudRow.uid)
  // Una instalacion nueva crea usuarios iniciales con UID local. Al recibir los
  // definitivos desde la API se reconcilian por email/usuario para no duplicar
  // cuentas ni dejar que el registro inicial oculte al registro remoto.
  if (!existing && tabla === 'usuarios') {
    const email = String(cloudRow.email || '').trim().toLowerCase()
    const usuario = String(cloudRow.usuario || '').trim().toLowerCase()
    existing = localRows.find((row: any) =>
      (email && String(row.email || '').trim().toLowerCase() === email) ||
      (usuario && String(row.usuario || '').trim().toLowerCase() === usuario)
    )
  }
  const cleanRow = { ...cloudRow }
  if (tabla === 'imei') {
    const telefonoUid = String(cleanRow.id_equi || '').trim()
    if (telefonoUid) {
      cleanRow.telefono_uid = telefonoUid
      const telefonos = await getLocalRows('telefonos')
      const telefono = telefonos.find((item: any) => String(item.uid || '') === telefonoUid)
      cleanRow.id_equi = telefono ? telefono.id : null
    }
  }
  if (tabla === 'serial') {
    const equipoUid = String(cleanRow.equipo_uid || '').trim()
    if (equipoUid) {
      const equipos = await getLocalRows('electrodomesticos')
      const equipo = equipos.find((item: any) => String(item.uid || '') === equipoUid)
      cleanRow.id_equi = equipo ? equipo.id : null
      if (!cleanRow.equipo && equipo) cleanRow.equipo = equipo.nombre || ''
    }
  }
  delete cleanRow.id
  if (!existing) {
    const result = await (window as any).db.insert(tabla, cleanRow)
    if (!result.success) throw new Error(result.error || `No se pudo insertar en ${tabla}`)
    return 'inserted'
  }
  if (sameData(existing, cleanRow) || (existing.uid === cleanRow.uid && timestamp(existing) >= timestamp(cleanRow))) return 'skipped'
  const result = await (window as any).db.update(tabla, existing.id, cleanRow)
  if (!result.success) throw new Error(result.error || `No se pudo actualizar ${tabla}`)
  return 'updated'
}

async function applyRealtimeChange(payload: any): Promise<void> {
  const tabla = String(payload?.table || '')
  if (!tabla || LOCAL_SYSTEM_TABLES.includes(tabla)) return
  const eventType = String(payload?.eventType || payload?.type || '').toUpperCase()
  const recordUid = payload?.record_uid || payload?.changes?.uid || payload?.new?.uid || payload?.old?.uid
  if (!recordUid && eventType !== 'INSERT') return

  if (eventType === 'DELETE') {
    const local = (await getLocalRows(tabla)).find((row: any) => row.uid === recordUid)
    if (local) await deleteLocalFromRealtime(tabla, local.id)
    notify({ running: false, tabla, progreso: `Realtime DELETE ${tabla}`, realtime: true })
    return
  }

  if (eventType === 'INSERT') {
    const row = payload.new || payload.changes
    if (row?.uid) {
      const action = await upsertLocal(tabla, row)
      if (action === 'inserted' || action === 'updated') notifyLocalRealtimeChange('INSERT', tabla, row.uid)
      notify({ running: false, tabla, progreso: `Realtime INSERT ${tabla}`, realtime: true })
    }
    return
  }

  if (eventType === 'UPDATE') {
    const local = (await getLocalRows(tabla)).find((row: any) => row.uid === recordUid)
    if (!local) {
      if (payload.new?.uid) {
        const action = await upsertLocal(tabla, payload.new)
        if (action === 'inserted' || action === 'updated') notifyLocalRealtimeChange('UPDATE', tabla, payload.new.uid)
      }
      return
    }
    const changes = payload.changes || payload.new || {}
    const result = await (window as any).db.update(tabla, local.id, { ...changes, updated_at: changes.updated_at || nowSql() })
    if (!result?.success) throw new Error(result?.error || `No se pudo aplicar realtime en ${tabla}`)
    notifyLocalRealtimeChange('UPDATE', tabla, recordUid)
    notify({ running: false, tabla, progreso: `Realtime UPDATE ${tabla}`, realtime: true })
  }
}

async function deleteLocalFromRealtime(tabla: string, id: number): Promise<void> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tabla)) throw new Error('Tabla invalida en realtime')
  const result = await (window as any).electron?.invoke('consultaservidor', 'rawQuery', `DELETE FROM "${tabla}" WHERE id = ${Number(id)}`)
  if (result && result.success === false) throw new Error(result.error || `No se pudo borrar ${tabla}`)
}

export async function startRealtime() {
  stopRealtime()
  if (!await ensureCloudApi() || currentMode === 'offline') return false
  realtimeStop = tmc.subscribeRealtime(
    (payload) => {
      applyRealtimeChange(payload).catch((error) => {
        notify({ running: false, error: error?.message || 'Error aplicando realtime', realtime: false })
      })
    },
    () => {
      realtimeConnected = false
      notify({ running: false, error: 'Realtime desconectado', realtime: false })
    },
  )
  realtimeConnected = true
  notify({ running: false, progreso: 'Realtime conectado', realtime: true })
  return true
}

export function stopRealtime() {
  if (realtimeStop) realtimeStop()
  realtimeStop = null
  realtimeConnected = false
}

async function upsertCloud(tabla: string, rows: any[]): Promise<{ inserted: number; updated: number; errors: number }> {
  const api = tmc.getCloudWriteApi()
  if (!api || rows.length === 0) return { inserted: 0, updated: 0, errors: 0 }

  let inserted = 0
  let updated = 0
  let errors = 0
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500).map(row => {
      const record = tmc.cleanRecord(row)
      if (tabla === 'gastos') delete record.turno_id
      if (tabla === 'imei') {
        if (record.telefono_uid) record.id_equi = record.telefono_uid
        delete record.telefono_uid
      }
      if (tabla === 'serial') delete record.id_equi
      return record
    })
    const res = await fetch(`${api.url}/${encodeURIComponent(tabla)}/upsert`, {
      method: 'POST',
      headers: tmc.authHeaders(api.key, true),
      body: JSON.stringify({ rows: batch }),
    })
    if (!res.ok) {
      errors += batch.length
      continue
    }
    const json = await res.json()
    inserted += json.data?.inserted || 0
    updated += json.data?.updated || 0
    errors += json.data?.failed || 0
  }
  return { inserted, updated, errors }
}

async function syncTable(tabla: string, mode: SyncMode, incremental: boolean, skipDownload = false): Promise<SyncDetail> {
  notify({ running: true, tabla, progreso: `Sincronizando ${tabla}...`, mode })
  const lastSync = incremental ? await getConfigValue(`last_sync_${tabla}`) : ''
  const localBeforeDownload = await getLocalRows(tabla)
  const cloudByUid = new Map<string, any>()
  let downloaded = 0
  let uploaded = 0
  let errors = 0

  if (mode === 'ambos' && !skipDownload) {
    try {
      const cloudRows = await fetchCloudRows(tabla, lastSync || undefined)
      for (const row of cloudRows) {
        if (row.uid) cloudByUid.set(row.uid, row)
        try {
          const action = await upsertLocal(tabla, row)
          if (action !== 'skipped') downloaded++
        } catch {
          errors++
        }
      }
    } catch {
      errors++
    }
  }

  if (mode !== 'offline') {
    const candidates = incremental && lastSync
      ? localBeforeDownload.filter(row => timestamp(row) > lastSync)
      : localBeforeDownload
    const changedRows = candidates.filter(row => {
      const cloud = cloudByUid.get(row.uid)
      return !cloud || timestamp(row) > timestamp(cloud)
    })
    const result = await upsertCloud(tabla, changedRows)
    uploaded = result.inserted + result.updated
    errors += result.errors
  }

  await setConfigValue(`last_sync_${tabla}`, nowSql())
  return { tabla, downloaded, uploaded, errors }
}

async function syncDeletes(): Promise<number> {
  const api = tmc.getCloudWriteApi()
  if (!api) return 0
  const rows = await getLocalRows('sync_deletes')
  let deleted = 0
  for (const row of rows) {
    if (row.tabla === 'sync_deletes') {
      await (window as any).db.delete('sync_deletes', row.id)
      continue
    }
    const uid = row.uid_registro || row.registro_uid || row.uid
    if (!row.tabla || !uid) continue
    try {
      const res = await fetch(
        `${api.url}/${encodeURIComponent(row.tabla)}/${encodeURIComponent(String(uid))}`,
        { method: 'DELETE', headers: tmc.authHeaders(api.key) },
      )
      if (res.ok || res.status === 404 || res.status === 400) {
        await (window as any).db.delete('sync_deletes', row.id)
        deleted++
      }
    } catch { /* Retry on the next synchronization. */ }
  }
  return deleted
}

async function ensureLocalTableExists(tabla: string, columns: ServerColumn[]): Promise<boolean> {
  try {
    const res = await (window as any).electron?.invoke('consultaservidor', 'getTableColumns', tabla, 'names')
    const localCols: string[] = Array.isArray(res) ? res : []
    const serverCols = columns.filter(c => c.name !== 'id').map(c => c.name)
    const missing = serverCols.filter(c => !localCols.includes(c))
    if (!missing.length) return true
    for (const col of missing) {
      const def = columns.find(c => c.name === col)
      if (def) {
        await (window as any).electron?.invoke('consultaservidor', 'addColumnToTable', tabla, col)
      }
    }
    return true
  } catch {
    // table doesn't exist, create it
    try {
      const colDefs = columnsToSqlDefs(columns)
      await (window as any).electron?.invoke('consultaservidor', 'crearTabla', tabla, colDefs)
      return true
    } catch { return false }
  }
}

async function executeSync(mode: SyncMode, incremental: boolean): Promise<SyncResult> {
  if (mode === 'offline') {
    return { success: true, inserts: 0, updates: 0, errors: 0, message: 'Modo offline' }
  }
  if (!await ensureCloudApi()) {
    return { success: false, inserts: 0, updates: 0, errors: 1, message: 'TM Cloud no conectado' }
  }
  await repairSystemTables()

  const schema = await fetchServerFullSchema()
  if (!schema.length) {
    return { success: false, inserts: 0, updates: 0, errors: 1, message: 'No se pudo obtener esquema del servidor' }
  }

  // Ensure all schema tables exist locally first
  const tableSchemaMap = new Map(schema.map(t => [t.name, t]))
  for (const table of schema) {
    if (!LOCAL_SYSTEM_TABLES.includes(table.name)) {
      await ensureLocalTableExists(table.name, table.columns)
    }
  }

  const details: SyncDetail[] = []
  let totalUploaded = 0
  let totalDownloaded = 0
  let totalErrors = 0
  const completedAt = nowSql()

  // --- DOWNLOAD from cloud (single call for ALL tables) ---
  if (incremental) {
    // En la primera sincronizacion no existe marca local. Consultar desde el
    // inicio permite descargar el proyecto antes de intentar subir defaults.
    const lastSync = await getConfigValue('ultimo_sync_tm') || '1970-01-01 00:00:00'
    const changes = await fetchCloudSyncAll(lastSync)
      if (changes !== null) {
        for (const [tabla, change] of Object.entries(changes)) {
          if (LOCAL_SYSTEM_TABLES.includes(tabla)) continue
          let tabDownloaded = 0
          let tabErrors = 0
          for (const row of (Array.isArray(change?.updated) ? change.updated : [])) {
            try {
              const action = await upsertLocal(tabla, row)
              if (action !== 'skipped') tabDownloaded++
            } catch { tabErrors++ }
          }
          for (const uid of (Array.isArray(change?.deleted) ? change.deleted : [])) {
            try {
              const local = (await getLocalRows(tabla)).find((r: any) => r.uid === uid)
              if (local) await (window as any).db.delete(tabla, local.id)
            } catch { tabErrors++ }
          }
          if (tabDownloaded > 0 || tabErrors > 0) {
            details.push({ tabla, downloaded: tabDownloaded, uploaded: 0, errors: tabErrors })
            totalDownloaded += tabDownloaded
            totalErrors += tabErrors
          }
        }
        notify({ running: true, progreso: `Descarga completada (${totalDownloaded} cambios)`, mode })
      } else {
        // bulk endpoint not available (404) — skip download entirely
        notify({ running: true, progreso: 'Bulk sync no disponible', mode })
      }
  }

  // --- UPLOAD local→cloud (only tables with local modifications) ---
  if (mode !== 'offline') {
    const uploadBatch: { tabla: string; rows: any[] }[] = []
    for (const table of schema) {
      const tabla = table.name
      if (LOCAL_SYSTEM_TABLES.includes(tabla)) continue
      const tablaLastSync = incremental
        ? (await getConfigValue(`last_sync_${tabla}`) || '')
        : ''
      let candidates: any[]
      if (incremental && tablaLastSync) {
        candidates = (await getLocalRows(tabla)).filter(r => timestamp(r) > tablaLastSync)
      } else {
        candidates = await getLocalRows(tabla)
      }
      if (candidates.length > 0) uploadBatch.push({ tabla, rows: candidates })
    }

    for (const { tabla, rows } of uploadBatch) {
      const serverCols = tableSchemaMap.get(tabla)
      const serverColNames = serverCols ? serverCols.columns.map(c => c.name) : null
      const cleanRows = serverColNames
        ? rows.map(r => {
            const cleaned: any = { uid: r.uid }
            for (const col of serverColNames) {
              if (col in r) cleaned[col] = r[col]
            }
            return cleaned
          })
        : rows
      notify({ running: true, tabla, progreso: `Subiendo ${tabla} (${cleanRows.length} registros)...`, mode })
      const result = await upsertCloud(tabla, cleanRows)
      if (result.inserted + result.updated > 0 || result.errors > 0) {
        const ups = result.inserted + result.updated
        details.push({ tabla, downloaded: 0, uploaded: ups, errors: result.errors })
        totalUploaded += ups
        totalErrors += result.errors
      }
      await setConfigValue(`last_sync_${tabla}`, completedAt)
    }
  }

  await syncDeletes()
  await setConfigValue('ultimo_sync_tm', completedAt)
  onSyncComplete?.(details)

  const result: SyncResult = {
    success: totalErrors === 0,
    inserts: totalUploaded,
    updates: totalDownloaded,
    errors: totalErrors,
    message: `${totalUploaded} subidos, ${totalDownloaded} descargados, ${totalErrors} errores`,
  }
  notify({ running: false, lastSync: completedAt, mode, result, details })
  return result
}

export async function refreshLoginUsers(): Promise<{ success: boolean; downloaded: number; error?: string }> {
  try {
    // La verificacion de licencia puede cambiar proyecto y llaves con la app
    // abierta. Se recarga la configuracion para evitar credenciales en cache.
    if (!await reloadCloudApi()) return { success: false, downloaded: 0, error: 'TM Cloud no configurado' }
    const rows = await fetchCloudRows('usuarios')
    let downloaded = 0
    for (const row of rows) {
      if (!row?.uid) continue
      const action = await upsertLocal('usuarios', row)
      if (action !== 'skipped') downloaded++
    }
    return { success: true, downloaded }
  } catch (error: any) {
    return { success: false, downloaded: 0, error: error?.message || 'No se pudieron descargar los usuarios' }
  }
}

async function repairSystemTables(): Promise<void> {
  for (const [tabla, defs] of Object.entries(SYSTEM_TABLE_DEFS)) {
    try {
      const res = await (window as any).electron?.invoke('consultaservidor', 'getTableColumns', tabla, 'names')
      const cols: string[] = Array.isArray(res) ? res : []
      const needed = defs.map(d => d.split(' ')[0])
      const missing = needed.filter(n => !cols.includes(n))
      if (missing.length > 0) {
        await (window as any).electron?.invoke('consultaservidor', 'eliminarTabla', tabla)
        await (window as any).electron?.invoke('consultaservidor', 'crearTabla', tabla, defs)
      }
    } catch {
      try {
        await (window as any).electron?.invoke('consultaservidor', 'crearTabla', tabla, defs)
      } catch {}
    }
  }
}

export async function downloadAllTables(): Promise<SyncResult> {
  if (!await ensureCloudApi()) {
    return { success: false, inserts: 0, updates: 0, errors: 1, message: 'TM Cloud no conectado' }
  }
  await repairSystemTables()

  const schema = await fetchServerFullSchema()
  if (!schema.length) {
    return { success: false, inserts: 0, updates: 0, errors: 1, message: 'No se pudo obtener esquema del servidor' }
  }

  const details: SyncDetail[] = []
  for (const [index, table] of schema.entries()) {
    const tabla = table.name
    if (LOCAL_SYSTEM_TABLES.includes(tabla)) continue
    if (index > 0) await delay(350)
    notify({ running: true, tabla, progreso: `Descargando ${tabla} (${table.count} registros)...` })
    let downloaded = 0
    let errors = 0
    try {
      if (!(await ensureLocalTableExists(tabla, table.columns))) continue
      const cloudRows = await fetchCloudRows(tabla)
      for (const row of cloudRows) {
        if (row.uid) {
          try {
            const action = await upsertLocal(tabla, row)
            if (action !== 'skipped') downloaded++
          } catch {
            errors++
          }
        }
      }
    } catch {
      errors++
    }
    if (downloaded > 0 || errors > 0) {
      details.push({ tabla, downloaded, uploaded: 0, errors })
    }
    await setConfigValue(`last_sync_${tabla}`, nowSql())
  }

  const downloaded = details.reduce((total, item) => total + item.downloaded, 0)
  const errors = details.reduce((total, item) => total + item.errors, 0)
  const completedAt = nowSql()
  await setConfigValue('ultimo_sync_tm', completedAt)
  onSyncComplete?.(details)

  const result: SyncResult = {
    success: errors === 0,
    inserts: 0,
    updates: downloaded,
    errors,
    message: `${downloaded} descargados, ${errors} errores`,
  }
  notify({ running: false, lastSync: completedAt, mode: currentMode, result, details })
  return result
}

export async function pushAllTables(mode?: SyncMode): Promise<SyncResult> {
  const selected = mode || currentMode
  return executeSync(selected === 'offline' ? 'offline' : 'online', false)
}

export async function pushLocalRowToCloud(tabla: string, id: number): Promise<{ success: boolean; error?: string }> {
  try {
    if (!await ensureCloudApi()) return { success: false, error: 'TM Cloud no conectado' }
    const rows = await getLocalRows(tabla)
    const row = rows.find(item => Number(item.id) === Number(id))
    if (!row) return { success: false, error: 'Registro local no encontrado' }
    // Las tablas locales pueden tener columnas nuevas antes de que TM Cloud las tenga.
    // En el envio inmediato filtramos por el esquema remoto para no rechazar todo el registro.
    const schema = await fetchServerFullSchema()
    const tablaRemota = schema.find(item => item.name === tabla)
    const columnasRemotas = tablaRemota?.columns.map(columna => columna.name)
    const fila = columnasRemotas
      ? columnasRemotas.reduce((acumulado: any, columna: string) => {
          if (row[columna] !== undefined) acumulado[columna] = row[columna]
          return acumulado
        }, {})
      : row
    if (tabla === 'imei') {
      if (row.telefono_uid) fila.id_equi = row.telefono_uid
      delete fila.telefono_uid
    }
    if (tabla === 'serial') delete fila.id_equi
    if (row.uid && fila.uid === undefined) fila.uid = row.uid
    const result = await upsertCloud(tabla, [fila])
    if (result.errors > 0) return { success: false, error: 'TMPBase rechazo el registro' }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'No se pudo sincronizar el registro' }
  }
}

export async function syncAll(mode?: SyncMode, incremental = false): Promise<SyncResult> {
  return executeSync(mode || currentMode, incremental)
}

export async function startAutoSync(intervalMs = 30000) {
  stopAutoSync()
  if (!await ensureCloudApi() || currentMode === 'offline') return
  await startRealtime()
  if (syncingInProgress) return

  syncingInProgress = true
  try {
    await syncAll(undefined, true)
  } finally {
    syncingInProgress = false
  }
  if (intervalMs <= 0) return

  intervalId = setInterval(async () => {
    if (syncingInProgress || currentMode === 'offline') return
    syncingInProgress = true
    try {
      await syncAll(undefined, true)
    } finally {
      syncingInProgress = false
    }
  }, Math.max(intervalMs, 10000))
}

export function stopAutoSync() {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
  syncingInProgress = false
  stopRealtime()
}

export async function initAutoSyncFromConfig() {
  try {
    await repairSystemTables()
    const mode = (await getConfigValue('tm_sync_mode') || 'ambos') as SyncMode
    const interval = parseInt(await getConfigValue('tm_sync_interval') || '30', 10) * 1000
    const enabled = await getConfigValue('tm_auto_sync') === '1'
    currentMode = mode
    if (enabled && mode !== 'offline') await startAutoSync(interval)
    else if (mode !== 'offline') await startRealtime()
  } catch { /* Configuration will be retried when the user opens TM Cloud. */ }
}
