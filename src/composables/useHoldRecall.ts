import { ref, type Ref } from 'vue'

export interface VentaHold {
  id: string
  fecha: string
  hora: string
  cart: any[]
  cliente: any | null
  clienteExpress: string
  descuentoFijo: number
  descuentoPorc: number
  descuentoTipo: string
  descuentoValor: number
  metodoPago: string
  nota: string
  total: number
  itemsCount: number
}

const HOLDS_KEY = 'pos_ventas_hold'

export function useHoldRecall() {
  const ventasHold = ref<VentaHold[]>([])
  const dialogHold = ref(false)
  const holdSeleccionado = ref<VentaHold | null>(null)

  function cargarHolds() {
    try {
      const raw = localStorage.getItem(HOLDS_KEY)
      ventasHold.value = raw ? JSON.parse(raw) : []
    } catch {
      ventasHold.value = []
    }
  }

  function guardarHolds() {
    localStorage.setItem(HOLDS_KEY, JSON.stringify(ventasHold.value))
  }

  function holdVenta(
    cart: any[],
    cliente: any | null,
    clienteExpress: string,
    descuentoFijo: number,
    descuentoPorc: number,
    descuentoTipo: string,
    descuentoValor: number,
    metodoPago: string,
    nota: string,
    total: number,
  ) {
    const hold: VentaHold = {
      id: `HOLD-${Date.now()}`,
      fecha: new Date().toLocaleDateString('es-DO'),
      hora: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      cart: JSON.parse(JSON.stringify(cart)),
      cliente,
      clienteExpress,
      descuentoFijo,
      descuentoPorc,
      descuentoTipo,
      descuentoValor,
      metodoPago,
      nota,
      total,
      itemsCount: cart.reduce((s: number, i: any) => s + (i.cantidad || 1), 0),
    }
    ventasHold.value.unshift(hold)
    if (ventasHold.value.length > 50) ventasHold.value = ventasHold.value.slice(0, 50)
    guardarHolds()
    return hold
  }

  function recallVenta(hold: VentaHold) {
    return {
      cart: JSON.parse(JSON.stringify(hold.cart)),
      cliente: hold.cliente,
      clienteExpress: hold.clienteExpress,
      descuentoFijo: hold.descuentoFijo,
      descuentoPorc: hold.descuentoPorc,
      descuentoTipo: hold.descuentoTipo,
      descuentoValor: hold.descuentoValor,
      metodoPago: hold.metodoPago,
      nota: hold.nota,
    }
  }

  function eliminarHold(id: string) {
    ventasHold.value = ventasHold.value.filter(h => h.id !== id)
    guardarHolds()
  }

  function limpiarHolds() {
    ventasHold.value = []
    guardarHolds()
  }

  cargarHolds()

  return {
    ventasHold,
    dialogHold,
    holdSeleccionado,
    cargarHolds,
    holdVenta,
    recallVenta,
    eliminarHold,
    limpiarHolds,
  }
}
