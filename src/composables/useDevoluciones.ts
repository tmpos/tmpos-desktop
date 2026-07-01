import { ref } from 'vue'

export interface DevolucionItem {
  facturaId: number
  noFactura: string
  producto: any
  cantidad: number
  motivo: string
  fecha: string
}

export function useDevoluciones() {
  const dialogDevolucion = ref(false)
  const facturaDevolucion = ref<any>(null)
  const productosDevolucion = ref<any[]>([])
  const devolucionSeleccion = ref<any[]>([])
  const motivoDevolucion = ref('')
  const cargandoDevolucion = ref(false)
  const resultadoDevolucion = ref<string | null>(null)

  async function buscarFacturaParaDevolucion(noFactura: string) {
    cargandoDevolucion.value = true
    resultadoDevolucion.value = null
    try {
      const res = await window.db.getAll('facturas')
      if (res.success) {
        const factura = (res.data || []).find((f: any) =>
          String(f.no_factura || '') === String(noFactura) &&
          f.tipo_factura === 'FACTURA_VENTA'
        )
        if (factura) {
          facturaDevolucion.value = factura
          const productos = typeof factura.productos === 'string'
            ? JSON.parse(factura.productos || '[]')
            : (factura.productos || [])
          productosDevolucion.value = productos.map((p: any) => ({ ...p, _devolver: false }))
          devolucionSeleccion.value = productosDevolucion.value.filter((p: any) => p._devolver)
          dialogDevolucion.value = true
        } else {
          resultadoDevolucion.value = 'Factura no encontrada o no es de tipo venta'
        }
      }
    } catch {
      resultadoDevolucion.value = 'Error al buscar factura'
    } finally {
      cargandoDevolucion.value = false
    }
  }

  function toggleDevolucionProducto(producto: any) {
    producto._devolver = !producto._devolver
    devolucionSeleccion.value = productosDevolucion.value.filter((p: any) => p._devolver)
  }

  async function procesarDevolucion(): Promise<boolean> {
    if (!facturaDevolucion.value || devolucionSeleccion.value.length === 0) return false
    if (!motivoDevolucion.value.trim()) return false

    cargandoDevolucion.value = true
    try {
      const factura = facturaDevolucion.value
      const ahora = new Date()
      const fechaStr = ahora.toISOString().split('T')[0]
      const horaStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
      const noNC = `NC-${fechaStr}-${String(ahora.getSeconds()).padStart(2, '0')}`

      const productosDevueltos = devolucionSeleccion.value.map((p: any) => ({
        ...p,
        motivo: motivoDevolucion.value,
        fecha_devolucion: fechaStr,
      }))

      const totalDevuelto = productosDevueltos.reduce(
        (s: number, p: any) => s + (Number(p.precio || 0) * Number(p.cantidad || 1)), 0
      )

      const notaCreditoData = {
        no_factura: noNC,
        tipo_factura: 'NOTA_CREDITO',
        estado_factura: 'PENDIENTE',
        fecha_emision: fechaStr,
        hora: horaStr,
        cod_cliente: factura.cod_cliente || '',
        nombre_cliente: factura.nombre_cliente || 'CONSUMIDOR FINAL',
        telefono_cliente: factura.telefono_cliente || '',
        total: totalDevuelto,
        subtotal: totalDevuelto,
        productos: JSON.stringify(productosDevueltos),
        nota: `DEVOLUCION: ${factura.no_factura} | ${motivoDevolucion.value}`,
        metodo_pago: 'NOTA_CREDITO',
        almacen_id: factura.almacen_id || 0,
        usuario: 'POS',
      }

      const resNC = await window.db.insert('facturas', notaCreditoData)
      if (!resNC.success) {
        resultadoDevolucion.value = 'Error al crear nota de crédito'
        return false
      }

      for (const p of productosDevueltos) {
        if (p.tipo === 'imei' && p.imei_id) {
          await window.db.update('imei', p.imei_id, {
            estado: 'DISPONIBLE', comprador: '', no_factura: '',
            precio_vendido: 0, fecha_venta: '', hora_venta: '',
          })
        } else if (p.tipo === 'serial' && p.serial_id) {
          await window.db.update('serial', p.serial_id, {
            estado: 'DISPONIBLE', comprador: '', no_factura: '',
            precio_vendido: 0, fecha_venta: '', hora_venta: '',
          })
        } else if (p.tipo === 'accesorio' && p.accesorio_id) {
          const accRes = await window.db.getById('accesorios', p.accesorio_id)
          if (accRes.success && accRes.data) {
            const nuevoStock = (Number(accRes.data.cantidad || 0) + Number(p.cantidad || 1))
            await window.db.update('accesorios', p.accesorio_id, { cantidad: nuevoStock })
          }
        }
      }

      resultadoDevolucion.value = `NC ${noNC} creada por RD$ ${totalDevuelto.toFixed(2)}`
      dialogDevolucion.value = false
      return true
    } catch (e: any) {
      resultadoDevolucion.value = `Error: ${e.message}`
      return false
    } finally {
      cargandoDevolucion.value = false
    }
  }

  function cerrarDevolucion() {
    dialogDevolucion.value = false
    facturaDevolucion.value = null
    productosDevolucion.value = []
    devolucionSeleccion.value = []
    motivoDevolucion.value = ''
    resultadoDevolucion.value = null
  }

  return {
    dialogDevolucion,
    facturaDevolucion,
    productosDevolucion,
    devolucionSeleccion,
    motivoDevolucion,
    cargandoDevolucion,
    resultadoDevolucion,
    buscarFacturaParaDevolucion,
    toggleDevolucionProducto,
    procesarDevolucion,
    cerrarDevolucion,
  }
}
