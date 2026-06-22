import { ref } from 'vue'
import { useAlmacenStore } from '@/stores/almacen.store'

export interface Alerta {
  tipo: 'stock' | 'turno' | 'cobro'
  mensaje: string
  severidad: 'danger' | 'warning' | 'info'
  ruta?: string
  cantidad?: number
}

export function useAlertas() {
  const alertas = ref<Alerta[]>([])
  const loadingAlertas = ref(false)

  async function verificarAlertas() {
    loadingAlertas.value = true
    const result: Alerta[] = []
    const almacenId = useAlmacenStore().activeId || 0

    try {
      const [resAcc, resElec, resPiezas] = await Promise.all([
        (window as any).electron.invoke('db:getAll', 'accesorios'),
        (window as any).electron.invoke('db:getAll', 'electrodomesticos'),
        (window as any).electron.invoke('db:getAll', 'piezas'),
      ])

      for (const res of [resAcc, resElec, resPiezas]) {
        if (!res.success) continue
        for (const item of res.data || []) {
          const cant = Number(item.cantidad || 0)
          const alerta = Number(item.alerta || 0)
          if (alerta > 0 && cant <= alerta) {
            result.push({
              tipo: 'stock',
              mensaje: `${item.nombre}: ${cant} / ${alerta} unidades`,
              severidad: cant === 0 ? 'danger' : 'warning',
              ruta: '/inventario',
              cantidad: cant,
            })
          }
        }
      }
    } catch {}

    try {
      const resTurno = await (window as any).electron.invoke('caja:getTurnoActivo')
      if (!resTurno.success || !resTurno.data) {
        result.push({
          tipo: 'turno',
          mensaje: 'No hay turno de caja abierto',
          severidad: 'warning',
          ruta: '/contabilidad',
        })
      }
    } catch {}

    alertas.value = result.slice(0, 20)
    loadingAlertas.value = false
  }

  return { alertas, loadingAlertas, verificarAlertas }
}
