import { onActivated, onDeactivated } from 'vue'
import { useToast } from 'primevue/usetoast'

// Se dispara desde tmCloudSyncService cuando una sincronizacion (o un evento
// realtime) trae cambios (nuevos, actualizados o borrados) para una tabla.
// Los componentes que muestran datos de esa tabla pueden suscribirse con
// useCloudRefresh para recargar solo sus propios datos, sin recargar toda
// la app ni depender de que el usuario cambie de pantalla.
export interface TableChangedDetail {
  table: string
  updated: number
  deleted: number
}

/**
 * Vuelve a cargar los datos del componente cuando llegan cambios de
 * sincronizacion para alguna de las tablas indicadas, y muestra un toast
 * avisando que hay datos nuevos. Usa onActivated/onDeactivated (no
 * onMounted/onBeforeUnmount) para que, con los componentes en cache dentro
 * de un <KeepAlive>, solo reaccione la pestana que esta realmente visible
 * y no las que quedaron en segundo plano.
 */
export function useCloudRefresh(tablas: string[], onNuevosDatos: () => void | Promise<void>) {
  const toast = useToast()
  const tablasSet = new Set(tablas)

  async function handler(event: Event) {
    const detail = (event as CustomEvent<TableChangedDetail>).detail
    if (!detail || !tablasSet.has(detail.table)) return
    try {
      await onNuevosDatos()
    } catch { /* la recarga puede reintentarse en el proximo cambio */ }
    const partes: string[] = []
    if (detail.updated > 0) partes.push(`${detail.updated} nuevo(s)/actualizado(s)`)
    if (detail.deleted > 0) partes.push(`${detail.deleted} eliminado(s)`)
    toast.add({
      severity: 'info',
      summary: 'Datos actualizados',
      detail: partes.length ? `${detail.table}: ${partes.join(', ')}` : `Hay datos nuevos de ${detail.table}`,
      life: 3500,
    })
  }

  onActivated(() => window.addEventListener('tmcloud:table-changed', handler))
  onDeactivated(() => window.removeEventListener('tmcloud:table-changed', handler))
}
