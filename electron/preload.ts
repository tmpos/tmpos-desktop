import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
})

function getUsuario() {
  try { return localStorage.getItem('mr_user_usuario') || '' } catch { return '' }
}

contextBridge.exposeInMainWorld('db', {
  getAll: (tabla: string) => ipcRenderer.invoke('db:getAll', tabla),
  getWhere: (tabla: string, where: string, params: unknown[] = []) => ipcRenderer.invoke('db:getWhere', tabla, where, params),
  getModified: (tabla: string, desde: string) => ipcRenderer.invoke('db:getModified', tabla, desde),
  getById: (tabla: string, id: number) => ipcRenderer.invoke('db:getById', tabla, id),
  insert: (tabla: string, data: Record<string, unknown>) => ipcRenderer.invoke('db:insert', tabla, data, getUsuario()),
  update: (tabla: string, id: number, data: Record<string, unknown>) => ipcRenderer.invoke('db:update', tabla, id, data, getUsuario()),
  delete: (tabla: string, id: number) => ipcRenderer.invoke('db:delete', tabla, id, getUsuario()),
  bitacoraList: (limite?: number) => ipcRenderer.invoke('db:bitacoraList', limite),
  bitacoraDeleteAll: () => ipcRenderer.invoke('db:bitacoraDeleteAll'),
})
