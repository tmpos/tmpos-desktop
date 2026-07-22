import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (channel === 'db:insert' && args[1] && typeof args[1] === 'object') args[1] = withAlmacen(args[1] as Record<string, unknown>)
    if (channel === 'caja:abrirTurno' && args[0] && typeof args[0] === 'object') args[0] = withAlmacen(args[0] as Record<string, unknown>)
    if ((channel === 'cuadre:realizar' || channel === 'precio:registrarHistorial') && args[0] && typeof args[0] === 'object') args[0] = withAlmacen(args[0] as Record<string, unknown>)
    if ((channel === 'caja:getTurnoActivo' || channel === 'caja:getTurnoAbierto') && !args[0]) args[0] = getAlmacenContext().almacen_uid
    if ((channel === 'cuadre:listar' || channel === 'cuadre:ventasTurno' || channel === 'cuadre:gastosTurno') && !args[0]) args[0] = getAlmacenContext().almacen_uid
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
})

function getUsuario() {
  try { return localStorage.getItem('mr_user_usuario') || '' } catch { return '' }
}

function getAlmacenContext() {
  try {
    return {
      almacen_id: Number(localStorage.getItem('almacen_id') || localStorage.getItem('almacen_default_id') || 0),
      almacen_uid: localStorage.getItem('almacen_uid') || localStorage.getItem('almacen_default_uid') || '',
    }
  } catch {
    return { almacen_id: 0, almacen_uid: '' }
  }
}

function withAlmacen(data: Record<string, unknown>) {
  const context = getAlmacenContext()
  return {
    almacen_id: context.almacen_id,
    almacen_uid: context.almacen_uid,
    ...data,
  }
}

contextBridge.exposeInMainWorld('db', {
  getAll: (tabla: string) => ipcRenderer.invoke('db:getAll', tabla),
  getWhere: (tabla: string, where: string, params: unknown[] = []) => ipcRenderer.invoke('db:getWhere', tabla, where, params),
  getModified: (tabla: string, desde: string) => ipcRenderer.invoke('db:getModified', tabla, desde),
  getById: (tabla: string, id: number) => ipcRenderer.invoke('db:getById', tabla, id),
  insert: (tabla: string, data: Record<string, unknown>) => ipcRenderer.invoke('db:insert', tabla, withAlmacen(data), getUsuario()),
  update: (tabla: string, id: number, data: Record<string, unknown>) => ipcRenderer.invoke('db:update', tabla, id, data, getUsuario()),
  delete: (tabla: string, id: number) => ipcRenderer.invoke('db:delete', tabla, id, getUsuario()),
  bitacoraList: (limite?: number) => ipcRenderer.invoke('db:bitacoraList', limite),
  bitacoraDeleteAll: () => ipcRenderer.invoke('db:bitacoraDeleteAll'),
})

contextBridge.exposeInMainWorld('config', {
  get: (clave: string) => ipcRenderer.invoke('config:get', clave),
  set: (clave: string, valor: string) => ipcRenderer.invoke('config:set', clave, valor),
})
