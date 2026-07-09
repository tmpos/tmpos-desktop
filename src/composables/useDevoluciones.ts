import { reactive } from 'vue'

export interface DevolucionItem {
  facturaId: number
  noFactura: string
  producto: any
  cantidad: number
  motivo: string
  fecha: string
}

export function useDevoluciones() {
  const state = reactive({
    dialogDevolucion: false as boolean,
    facturaDevolucion: null as any,
    productosDevolucion: [] as any[],
    devolucionSeleccion: [] as any[],
    motivoDevolucion: '' as string,
    cargandoDevolucion: false as boolean,
    resultadoDevolucion: null as string | null,
    facturasDisponibles: [] as any[],
    busquedaFactura: '' as string,
    cargandoFacturas: false as boolean,
  })

  function facturasFiltradas() {
    const texto = state.busquedaFactura.toLowerCase().trim()
    if (!texto) return state.facturasDisponibles
    return state.facturasDisponibles.filter((f: any) =>
      String(f.no_factura || '').toLowerCase().includes(texto) ||
      String(f.nombre_cliente || '').toLowerCase().includes(texto) ||
      String(f.ncf || '').toLowerCase().includes(texto)
    )
  }

  async function cargarFacturas() {
    state.cargandoFacturas = true
    try {
      const res = await window.db.getAll('facturas')
      if (res.success) {
        state.facturasDisponibles = (res.data || [])
          .filter((f: any) => f.tipo_factura === 'FACTURA_VENTA')
          .sort((a: any, b: any) => {
            const da = new Date(a.fecha_emision || a.created_at || 0).getTime()
            const db = new Date(b.fecha_emision || b.created_at || 0).getTime()
            return db - da
          })
      }
    } catch {} finally {
      state.cargandoFacturas = false
    }
  }

  function seleccionarFactura(factura: any) {
    state.facturaDevolucion = factura
    const productos = typeof factura.productos === 'string'
      ? JSON.parse(factura.productos || '[]')
      : (factura.productos || [])
    state.productosDevolucion = productos.map((p: any) => ({ ...p, _devolver: false }))
    state.devolucionSeleccion = []
    state.busquedaFactura = ''
  }

  function volverALista() {
    state.facturaDevolucion = null
    state.productosDevolucion = []
    state.devolucionSeleccion = []
    state.motivoDevolucion = ''
  }

  async function buscarFacturaParaDevolucion(noFactura: string) {
    state.cargandoDevolucion = true
    state.resultadoDevolucion = null
    try {
      const res = await window.db.getAll('facturas')
      if (res.success) {
        const factura = (res.data || []).find((f: any) =>
          String(f.no_factura || '') === String(noFactura) &&
          f.tipo_factura === 'FACTURA_VENTA'
        )
        if (factura) {
          seleccionarFactura(factura)
        } else {
          state.resultadoDevolucion = 'Factura no encontrada o no es de tipo venta'
        }
      }
    } catch {
      state.resultadoDevolucion = 'Error al buscar factura'
    } finally {
      state.cargandoDevolucion = false
    }
  }

  function toggleDevolucionProducto(producto: any) {
    producto._devolver = !producto._devolver
    state.devolucionSeleccion = state.productosDevolucion.filter((p: any) => p._devolver)
  }

  async function procesarDevolucion(): Promise<boolean> {
    if (!state.facturaDevolucion || state.devolucionSeleccion.length === 0) return false
    if (!state.motivoDevolucion.trim()) return false

    state.cargandoDevolucion = true
    try {
      const factura = state.facturaDevolucion
      const ahora = new Date()
      const fechaStr = ahora.toISOString().split('T')[0]
      const horaStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
      const noNC = `NC-${fechaStr}-${String(ahora.getSeconds()).padStart(2, '0')}`

      const productosDevueltos = state.devolucionSeleccion.map((p: any) => ({
        ...p,
        motivo: state.motivoDevolucion,
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
        nota: `DEVOLUCION: ${factura.no_factura} | ${state.motivoDevolucion}`,
        metodo_pago: 'NOTA_CREDITO',
        almacen_id: factura.almacen_id || 0,
        usuario: 'POS',
      }

      const resNC = await window.db.insert('facturas', notaCreditoData)
      if (!resNC.success) {
        state.resultadoDevolucion = 'Error al crear nota de crédito'
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

      state.resultadoDevolucion = `NC ${noNC} creada por RD$ ${totalDevuelto.toFixed(2)}`
      state.dialogDevolucion = false
      return true
    } catch (e: any) {
      state.resultadoDevolucion = `Error: ${e.message}`
      return false
    } finally {
      state.cargandoDevolucion = false
    }
  }

  function cerrarDevolucion() {
    state.dialogDevolucion = false
    state.facturaDevolucion = null
    state.productosDevolucion = []
    state.devolucionSeleccion = []
    state.motivoDevolucion = ''
    state.resultadoDevolucion = null
    state.busquedaFactura = ''
  }

  return {
    state,
    facturasFiltradas,
    cargarFacturas,
    seleccionarFactura,
    volverALista,
    buscarFacturaParaDevolucion,
    toggleDevolucionProducto,
    procesarDevolucion,
    cerrarDevolucion,
  }
}
