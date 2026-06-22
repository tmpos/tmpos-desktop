import { initDatabase, dbGetAll, dbGetModified, dbGetById, dbInsert, dbUpdate, dbDelete, dbBitacoraList, dbBitacoraDeleteAll, dbExecuteSQL } from './capacitorDb'
import { handleElectronInvoke, initLicencia } from './capacitorElectron'

export async function initCapacitorApp() {
  console.log('[Capacitor] Inicializando app para Android...')
  await initDatabase()

  const db = (window as any).db
  if (!db) {
    const dbApi: any = {
      getAll: (tabla: string) => Promise.resolve(dbGetAll(tabla)),
      getModified: (tabla: string, desde: string) => Promise.resolve(dbGetModified(tabla, desde)),
      getById: (tabla: string, id: number) => Promise.resolve(dbGetById(tabla, id)),
      insert: (tabla: string, data: Record<string, any>) => Promise.resolve(dbInsert(tabla, data)),
      update: (tabla: string, id: number, data: Record<string, any>) => Promise.resolve(dbUpdate(tabla, id, data)),
      delete: (tabla: string, id: number) => {
        let usuario = ''
        try { usuario = localStorage.getItem('mr_user_usuario') || '' } catch {}
        return Promise.resolve(dbDelete(tabla, id, usuario))
      },
      bitacoraList: (limite?: number) => Promise.resolve(dbBitacoraList(limite)),
      bitacoraDeleteAll: () => Promise.resolve(dbBitacoraDeleteAll()),
    }
    ;(window as any).db = dbApi
  }

  const electron = (window as any).electron
  if (!electron) {
    ;(window as any).electron = {
      invoke: (channel: string, ...args: any[]) => {
        if (channel === 'consultaservidor' && args[0] === 'executeSQL') {
          return Promise.resolve(dbExecuteSQL(args[1]))
        }
        return handleElectronInvoke(channel, ...args)
      },
      send: () => {},
      on: () => {},
    }
  }

  await initLicencia()

  ;(window as any).__isElectron = false
  ;(window as any).__isCapacitor = true

  solicitarPermisos()

  console.log('[Capacitor] App inicializada correctamente')
}

async function solicitarPermisos() {
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      stream.getTracks().forEach(t => t.stop())
      console.log('[Permisos] Camara concedido')
    } catch {
      console.log('[Permisos] Camara no concedido (se pedira al escanear)')
    }
  }
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(r => console.log('[Permisos] Notificaciones:', r))
  }
}
