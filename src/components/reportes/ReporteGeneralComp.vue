<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Calendar from 'primevue/calendar'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { Chart, registerables } from 'chart.js'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { useAlmacenStore } from '@/stores/almacen.store'

Chart.register(...registerables)

const toast = useToast()
const almacenStore = useAlmacenStore()

const facturas = ref<any[]>([])
const taller = ref<any[]>([])
const tallerTodas = ref<any[]>([])
const gastos = ref<any[]>([])
const loading = ref(false)
const busqueda = ref('')
const rangoPersonalizado = ref<Date[]>([])
const rangoActivo = ref<string>('hoy')

const rangoLabel = computed(() => {
  const labels: Record<string, string> = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', trimestre: 'Este trimestre', ano: 'Este año' }
  return labels[rangoActivo.value] || 'Rango personalizado'
})

let chartDiario: Chart | null = null
const canvasDiario = ref<HTMLCanvasElement | null>(null)

let chartPago: Chart | null = null
const canvasPago = ref<HTMLCanvasElement | null>(null)

let chartTopClientes: Chart | null = null
const canvasTopClientes = ref<HTMLCanvasElement | null>(null)

let chartTopProductos: Chart | null = null
const canvasTopProductos = ref<HTMLCanvasElement | null>(null)

let chartCategoria: Chart | null = null
const canvasCategoria = ref<HTMLCanvasElement | null>(null)

let chartTaller: Chart | null = null
const canvasTaller = ref<HTMLCanvasElement | null>(null)

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value || '')
    .replace(/RD\$/gi, '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function getTallerFecha(orden: any): string {
  const value = orden.fecha_entrada || orden.fecha_ingreso || orden.fecha || orden.created_at || orden.updated_at || ''
  if (value instanceof Date) return value.toISOString().split('T')[0]
  const text = String(value || '').trim()
  if (!text) return ''
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`
  return text.slice(0, 10)
}

function getTallerTotal(orden: any): number {
  const total = toNumber(orden.total)
  if (total > 0) return total
  return toNumber(orden.precio_pieza ?? orden.preciopiezas) + toNumber(orden.mano_obra ?? orden.manodeobra)
}

function getTallerGanancia(orden: any): number {
  return toNumber(orden.beneficio_empresa ?? orden.ganancia ?? orden.mano_obra ?? orden.manodeobra)
}

function normalizarEstadoTaller(estado: unknown): string {
  const value = String(estado || '').trim().toUpperCase().replace(/\s+/g, '_')
  if (!value) return 'SIN_ESTADO'
  if (value === 'EN PROCESO') return 'EN_PROCESO'
  return value
}

function labelEstadoTaller(estado: string): string {
  const labels: Record<string, string> = {
    RECIBIDO: 'Recibido',
    EN_PROCESO: 'En Proceso',
    COMPLETADO: 'Completado',
    ENTREGADO: 'Entregado',
    PARCIAL: 'Parcial',
    CANCELADO: 'Cancelado',
    SIN_ESTADO: 'Sin Estado',
  }
  return labels[estado] || estado.replace(/_/g, ' ')
}

function getRango(key: string): { inicio: string; fin: string } {
  const now = new Date()
  const y = (d: Date) => d.toISOString().split('T')[0]

  switch (key) {
    case 'hoy': return { inicio: y(now), fin: y(now) }
    case 'ayer': {
      const ayer = new Date(now); ayer.setDate(ayer.getDate() - 1)
      return { inicio: y(ayer), fin: y(ayer) }
    }
    case 'semana': {
      const l = new Date(now); l.setDate(l.getDate() - (l.getDay() || 7) + 1)
      const d = new Date(l); d.setDate(d.getDate() + 6)
      return { inicio: y(l), fin: y(d) }
    }
    case 'mes': {
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
      const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { inicio: y(inicio), fin: y(fin) }
    }
    case 'ano': {
      const inicio = new Date(now.getFullYear(), 0, 1)
      const fin = new Date(now.getFullYear(), 11, 31)
      return { inicio: y(inicio), fin: y(fin) }
    }
    case 'personalizado': {
      if (rangoPersonalizado.value.length === 2)
        return { inicio: y(rangoPersonalizado.value[0]), fin: y(rangoPersonalizado.value[1]) }
      return { inicio: '', fin: '' }
    }
    default: return { inicio: y(now), fin: y(now) }
  }
}

const facturasFiltradas = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return facturas.value
  return facturas.value.filter((f: any) =>
    f.no_factura?.toLowerCase().includes(texto) ||
    f.nombre_cliente?.toLowerCase().includes(texto) ||
    f.metodo_pago?.toLowerCase().includes(texto)
  )
})

const tallerFiltrado = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return taller.value
  return taller.value.filter((t: any) =>
    String(t.no_orden || t.no_factura || '').toLowerCase().includes(texto) ||
    String(t.nombre || t.nombre_cliente || '').toLowerCase().includes(texto) ||
    String(t.tecnico || '').toLowerCase().includes(texto) ||
    String(t.estado || '').toLowerCase().includes(texto) ||
    String(t.metodo_pago || t.metodopago || '').toLowerCase().includes(texto)
  )
})

const totales = computed(() => {
  let total = 0, ganancia = 0, descuento = 0, count = 0, tallerIngresos = 0, tallerGanancia = 0, tallerOrdenes = 0, totalGastos = 0
  for (const f of facturasFiltradas.value) {
    total += toNumber(f.total)
    ganancia += toNumber(f.ganancia)
    descuento += toNumber(f.descuento)
    count++
  }
  for (const t of tallerFiltrado.value) {
    tallerIngresos += getTallerTotal(t)
    tallerGanancia += getTallerGanancia(t)
    tallerOrdenes++
  }
  for (const g of gastos.value) {
    totalGastos += toNumber(g.cantidad)
  }
  let costo = 0, itemsCount = 0
  for (const f of facturasFiltradas.value) {
    costo += calcularCostoFactura(f)
    itemsCount += parseProductos(f.productos).length
  }
  const margen = total > 0 ? ((total - costo) / total) * 100 : 0
  const ticketPromedio = count > 0 ? total / count : 0
  const itemsPorFactura = count > 0 ? itemsCount / count : 0
  const gananciaTotal = ganancia + tallerGanancia
  return { total, ganancia, gananciaTotal, descuento, count, tallerIngresos, tallerGanancia, tallerOrdenes, totalGastos, costo, margen, ticketPromedio, itemsPorFactura, itemsCount }
})

function parseProductos(productos: any): any[] {
  if (!productos) return []
  if (Array.isArray(productos)) return productos
  try {
    return JSON.parse(productos)
  } catch {
    return []
  }
}

function getProductoCantidad(producto: any): number {
  const cantidad = toNumber(producto?.cantidad ?? producto?.quantity)
  return cantidad > 0 ? cantidad : 1
}

function getProductoCostoUnitario(producto: any): number {
  return toNumber(
    producto?.costo ??
    producto?.precio_compra ??
    producto?.preciocompra ??
    producto?.cost
  )
}

function calcularCostoProductos(productos: any[]): number {
  return productos.reduce((sum: number, p: any) => (
    sum + (getProductoCostoUnitario(p) * getProductoCantidad(p))
  ), 0)
}

function calcularCostoFactura(factura: any): number {
  const prods = parseProductos(factura.productos)
  return calcularCostoProductos(prods)
}

const topProductos = computed(() => {
  const mapa = new Map<string, { nombre: string; cantidad: number; total: number; costo: number }>()
  for (const f of facturas.value) {
    const prods = parseProductos(f.productos)
    for (const p of prods) {
      const key = p.codigo || p.nombre || 'SIN NOMBRE'
      const entry = mapa.get(key) || { nombre: p.nombre || 'SIN NOMBRE', cantidad: 0, total: 0, costo: 0 }
      entry.cantidad += toNumber(p.cantidad)
      entry.total += toNumber(p.total) || (toNumber(p.precio) * toNumber(p.cantidad))
      entry.costo += toNumber(p.costo) * toNumber(p.cantidad)
      mapa.set(key, entry)
    }
  }
  return Array.from(mapa.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)
})

const productosVendidos = computed(() => {
  const items: any[] = []
  for (const f of facturas.value) {
    const prods = parseProductos(f.productos)
    for (const p of prods) {
      items.push({
        no_factura: f.no_factura,
        fecha: f.fecha_emision,
        cliente: f.nombre_cliente,
        producto: p.nombre || 'SIN NOMBRE',
        cantidad: toNumber(p.cantidad),
        precio: toNumber(p.precio) || toNumber(p.precio_venta) || 0,
        costo: toNumber(p.costo) || 0,
        total: toNumber(p.total) || ((toNumber(p.precio) || toNumber(p.precio_venta) || 0) * toNumber(p.cantidad)),
      })
    }
  }
  return items.sort((a, b) => {
    if (a.fecha < b.fecha) return 1
    if (a.fecha > b.fecha) return -1
    return 0
  })
})

const ventasPorCategoria = computed(() => {
  const mapa = new Map<string, { categoria: string; cantidad: number; total: number; costo: number }>()
  for (const f of facturas.value) {
    const prods = parseProductos(f.productos)
    for (const p of prods) {
      const cat = p.categoria || p.tipo || 'SIN CATEGORIA'
      const entry = mapa.get(cat) || { categoria: cat, cantidad: 0, total: 0, costo: 0 }
      entry.cantidad += toNumber(p.cantidad)
      entry.total += toNumber(p.total) || ((toNumber(p.precio) || toNumber(p.precio_venta) || 0) * toNumber(p.cantidad))
      entry.costo += (toNumber(p.costo) || 0) * toNumber(p.cantidad)
      mapa.set(cat, entry)
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total)
})

const ventasPorVendedor = computed(() => {
  const mapa = new Map<string, { vendedor: string; total: number; ganancia: number; count: number }>()
  for (const f of facturas.value) {
    const vendedor = f.vendedor || 'SIN VENDEDOR'
    const entry = mapa.get(vendedor) || { vendedor, total: 0, ganancia: 0, count: 0 }
    entry.total += toNumber(f.total)
    entry.ganancia += toNumber(f.ganancia)
    entry.count++
    mapa.set(vendedor, entry)
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total)
})

const datosPorDia = computed(() => {
  const mapa = new Map<string, { ventas: number; ganancia: number }>()
  const rango = getRango(rangoActivo.value)
  if (!rango.inicio || !rango.fin) return []

  let d = new Date(rango.inicio + 'T00:00:00')
  const fin = new Date(rango.fin + 'T00:00:00')
  while (d <= fin) {
    const key = d.toISOString().split('T')[0]
    mapa.set(key, { ventas: 0, ganancia: 0 })
    d.setDate(d.getDate() + 1)
  }

  for (const f of facturas.value) {
    const fecha = f.fecha_emision
    if (mapa.has(fecha)) {
      const existing = mapa.get(fecha)!
      existing.ventas += f.total || 0
      existing.ganancia += f.ganancia || 0
    }
  }

  return Array.from(mapa.entries()).map(([fecha, datos]) => ({ fecha, ...datos }))
})

const datosTallerDiario = computed(() => {
  const mapa = new Map<string, { ingresos: number; ganancia: number; count: number }>()
  const rango = getRango(rangoActivo.value)
  if (!rango.inicio || !rango.fin) return []

  let d = new Date(rango.inicio + 'T00:00:00')
  const fin = new Date(rango.fin + 'T00:00:00')
  while (d <= fin) {
    const key = d.toISOString().split('T')[0]
    mapa.set(key, { ingresos: 0, ganancia: 0, count: 0 })
    d.setDate(d.getDate() + 1)
  }

  for (const t of taller.value) {
    const fecha = getTallerFecha(t)
    if (mapa.has(fecha)) {
      const existing = mapa.get(fecha)!
      existing.ingresos += getTallerTotal(t)
      existing.ganancia += getTallerGanancia(t)
      existing.count++
    }
  }

  return Array.from(mapa.entries()).map(([fecha, datos]) => ({ fecha, ...datos }))
})

const datosTallerEstados = computed(() => {
  const ordenEstados = ['RECIBIDO', 'EN_PROCESO', 'COMPLETADO', 'ENTREGADO', 'PARCIAL', 'CANCELADO']
  const mapa = new Map<string, { estado: string; label: string; count: number; ingresos: number; ganancia: number }>()

  for (const estado of ordenEstados) {
    mapa.set(estado, { estado, label: labelEstadoTaller(estado), count: 0, ingresos: 0, ganancia: 0 })
  }

  for (const orden of tallerTodas.value) {
    const estado = normalizarEstadoTaller(orden.estado)
    const item = mapa.get(estado) || { estado, label: labelEstadoTaller(estado), count: 0, ingresos: 0, ganancia: 0 }
    item.count++
    item.ingresos += getTallerTotal(orden)
    item.ganancia += getTallerGanancia(orden)
    mapa.set(estado, item)
  }

  return Array.from(mapa.values()).filter(item => item.count > 0 || ordenEstados.includes(item.estado))
})

const datosPorMetodoPago = computed(() => {
  const mapa = new Map<string, number>()
  for (const f of facturas.value) {
    const pago = f.metodo_pago || 'OTRO'
    mapa.set(pago, (mapa.get(pago) || 0) + (f.total || 0))
  }
  return Array.from(mapa.entries()).map(([metodo, total]) => ({ metodo, total }))
})

const labels = computed(() => datosPorDia.value.map(d => {
  const parts = d.fecha.split('-')
  return `${parts[2]}/${parts[1]}`
}))

const dataVentas = computed(() => datosPorDia.value.map(d => d.ventas))
const dataGanancia = computed(() => datosPorDia.value.map(d => d.ganancia))
const tallerTieneDatos = computed(() =>
  datosTallerEstados.value.some(d => d.count > 0)
)

const clientesMap = ref<Map<string, string>>(new Map())

const topClientes = computed(() => {
  const mapa = new Map<string, { total: number; ganancia: number; count: number }>()
  for (const f of facturas.value) {
    const cod = f.cod_cliente || ''
    const key = cod || f.nombre_cliente || 'CONSUMIDOR FINAL'
    const entry = mapa.get(key) || { total: 0, ganancia: 0, count: 0 }
    entry.total += f.total || 0
    entry.ganancia += f.ganancia || 0
    entry.count++
    mapa.set(key, entry)
  }
  return Array.from(mapa.entries())
    .map(([key, datos]) => {
      const cliente = clientesMap.value.get(key) || key
      return { cliente, ...datos }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
})

async function cargarDatos() {
  if (rangoActivo.value === 'personalizado' && rangoPersonalizado.value.length !== 2) return

  const rango = getRango(rangoActivo.value)
  if (!rango.inicio || !rango.fin) return

  loading.value = true
  try {
    const [resFact, resTaller, resCli, resGastos] = await Promise.all([
      window.db.getAll('facturas'),
      window.db.getAll('ordenes_taller'),
      window.db.getAll('clientes'),
      window.db.getAll('gastos'),
    ])

    const cm = new Map<string, string>()
    if (resCli.success) {
      for (const c of resCli.data || []) {
        cm.set(String(c.id), c.nombre || '')
      }
    }
    clientesMap.value = cm

    const almacenId = almacenStore.activeId || 0
    if (resFact.success) {
      facturas.value = (resFact.data || []).filter((f: any) =>
        f.fecha_emision >= rango.inicio && f.fecha_emision <= rango.fin &&
        (!almacenId || Number(f.almacen_id) === almacenId)
      )
    }
    if (resTaller.success) {
      tallerTodas.value = resTaller.data || []
      taller.value = tallerTodas.value.filter((t: any) =>
        getTallerFecha(t) >= rango.inicio && getTallerFecha(t) <= rango.fin
      )
    }
    if (resGastos.success) {
      gastos.value = (resGastos.data || []).filter((g: any) =>
        g.fecha >= rango.inicio && g.fecha <= rango.fin
      )
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }

  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  crearCharts()
}

function crearCharts() {
  if (chartDiario) { chartDiario.destroy(); chartDiario = null }
  if (chartPago) { chartPago.destroy(); chartPago = null }
  if (chartTopClientes) { chartTopClientes.destroy(); chartTopClientes = null }
  if (chartTaller) { chartTaller.destroy(); chartTaller = null }
  if (chartTopProductos) { chartTopProductos.destroy(); chartTopProductos = null }
  if (chartCategoria) { chartCategoria.destroy(); chartCategoria = null }

  if (canvasDiario.value) {
    chartDiario = new Chart(canvasDiario.value, {
      type: 'bar',
      data: {
        labels: labels.value,
        datasets: [
          {
            label: 'Ventas',
            data: dataVentas.value,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
          },
          {
            label: 'Ganancia',
            data: dataGanancia.value,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } },
      },
    })
  }

  if (canvasPago.value) {
    const colores: Record<string, string> = {
      EFECTIVO: 'rgba(16, 185, 129, 0.7)',
      TARJETA: 'rgba(59, 130, 246, 0.7)',
      TRANSFERENCIA: 'rgba(139, 92, 246, 0.7)',
      CHEQUE: 'rgba(245, 158, 11, 0.7)',
      MIXTO: 'rgba(236, 72, 153, 0.7)',
    }
    chartPago = new Chart(canvasPago.value, {
      type: 'doughnut',
      data: {
        labels: datosPorMetodoPago.value.map(d => d.metodo),
        datasets: [{
          data: datosPorMetodoPago.value.map(d => d.total),
          backgroundColor: datosPorMetodoPago.value.map(d => colores[d.metodo] || 'rgba(148, 163, 184, 0.7)'),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    })
  }

  if (canvasTopClientes.value && topClientes.value.length > 0) {
    chartTopClientes = new Chart(canvasTopClientes.value, {
      type: 'bar',
      data: {
        labels: topClientes.value.map(c => c.cliente.length > 18 ? c.cliente.slice(0, 16) + '...' : c.cliente),
        datasets: [{
          label: 'Total Comprado',
          data: topClientes.value.map(c => c.total),
          backgroundColor: 'rgba(168, 85, 247, 0.7)',
          borderColor: 'rgb(168, 85, 247)',
          borderWidth: 1,
        }],
      },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } },
        },
      })
    }

  if (canvasTopProductos.value && topProductos.value.length > 0) {
    try {
      chartTopProductos = new Chart(canvasTopProductos.value, {
        type: 'bar',
        data: {
          labels: topProductos.value.map(p => p.nombre.length > 20 ? p.nombre.slice(0, 18) + '...' : p.nombre),
          datasets: [
            {
              label: 'Cantidad',
              data: topProductos.value.map(p => p.cantidad),
              backgroundColor: 'rgba(251, 146, 60, 0.7)',
              borderColor: 'rgb(251, 146, 60)',
              borderWidth: 1,
              xAxisID: 'x',
            },
            {
              label: 'Total Venta',
              data: topProductos.value.map(p => p.total),
              backgroundColor: 'rgba(59, 130, 246, 0.7)',
              borderColor: 'rgb(59, 130, 246)',
              borderWidth: 1,
              xAxisID: 'x1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { position: 'bottom', beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Cantidad' } },
            x1: { position: 'top', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'RD$' } },
            y: { beginAtZero: true, title: { display: true, text: 'Productos' } },
          },
        },
      })
    } catch (_) {}
  }

  if (canvasCategoria.value && ventasPorCategoria.value.length > 0) {
    try {
      chartCategoria = new Chart(canvasCategoria.value, {
        type: 'doughnut',
        data: {
          labels: ventasPorCategoria.value.map(c => c.categoria),
          datasets: [{
            data: ventasPorCategoria.value.map(c => c.total),
            backgroundColor: [
              'rgba(59, 130, 246, 0.7)',
              'rgba(16, 185, 129, 0.7)',
              'rgba(251, 146, 60, 0.7)',
              'rgba(168, 85, 247, 0.7)',
              'rgba(236, 72, 153, 0.7)',
              'rgba(245, 158, 11, 0.7)',
              'rgba(14, 165, 233, 0.7)',
              'rgba(239, 68, 68, 0.7)',
            ],
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      })
    } catch (_) {}
  }

  if (canvasTaller.value && tallerTieneDatos.value) {
    chartTaller = new Chart(canvasTaller.value, {
      type: 'bar',
      data: {
        labels: datosTallerEstados.value.map(d => d.label),
        datasets: [
          {
            label: 'Ordenes',
            data: datosTallerEstados.value.map(d => d.count),
            backgroundColor: [
              'rgba(59, 130, 246, 0.75)',
              'rgba(6, 182, 212, 0.75)',
              'rgba(16, 185, 129, 0.75)',
              'rgba(124, 58, 237, 0.75)',
              'rgba(245, 158, 11, 0.75)',
              'rgba(220, 38, 38, 0.75)',
            ],
            borderColor: [
              'rgb(59, 130, 246)',
              'rgb(6, 182, 212)',
              'rgb(16, 185, 129)',
              'rgb(124, 58, 237)',
              'rgb(245, 158, 11)',
              'rgb(220, 38, 38)',
            ],
            borderWidth: 1,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (context: any) => {
                const item = datosTallerEstados.value[context.dataIndex]
                if (!item) return ''
                return [
                  `Ingresos: RD$ ${formatCurrency(item.ingresos)}`,
                  `Ganancia: RD$ ${formatCurrency(item.ganancia)}`,
                ]
              },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Ordenes' } },
        },
      },
    })
  }
}

function seleccionarRango(key: string) {
  rangoActivo.value = key
  if (key !== 'personalizado') cargarDatos()
}

async function generarReportePDF() {
  Swal.fire({
    title: 'Generando PDF...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  const rango = getRango(rangoActivo.value)
  const filename = `Reporte_General_${rango.inicio}_al_${rango.fin}.pdf`

  const doc = new jsPDF('landscape', 'mm', 'letter')
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 12
  let y = margin

  function addCard(label: string, value: string, color: [number, number, number], x: number, w: number) {
    doc.setFillColor(color[0], color[1], color[2])
    doc.roundedRect(x, y, w, 14, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.text(label, x + 3, y + 5)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(value, x + 3, y + 12)
    doc.setFont('helvetica', 'normal')
  }

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Reporte General', margin, y + 6)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`${rango.inicio} al ${rango.fin}`, margin, y + 12)
  y += 18

  // Summary cards
  const cards = [
    { label: 'Ventas', value: `RD$ ${formatCurrency(totales.value.total)}`, color: [37, 99, 235] as [number, number, number] },
    { label: 'Ganancia Total', value: `RD$ ${formatCurrency(totales.value.gananciaTotal)}`, color: [20, 184, 166] as [number, number, number] },
    { label: 'Ganancia', value: `RD$ ${formatCurrency(totales.value.ganancia)}`, color: [5, 150, 105] as [number, number, number] },
    { label: 'Costo Ventas', value: `RD$ ${formatCurrency(totales.value.costo)}`, color: [251, 146, 60] as [number, number, number] },
    { label: 'Descuentos', value: `RD$ ${formatCurrency(totales.value.descuento)}`, color: [245, 158, 11] as [number, number, number] },
    { label: 'Facturas', value: `${totales.value.count}`, color: [124, 58, 237] as [number, number, number] },
    { label: 'Taller Ingresos', value: `RD$ ${formatCurrency(totales.value.tallerIngresos)}`, color: [6, 182, 212] as [number, number, number] },
    { label: 'Taller Ganancia', value: `RD$ ${formatCurrency(totales.value.tallerGanancia)}`, color: [225, 29, 72] as [number, number, number] },
    { label: 'Ordenes Taller', value: `${totales.value.tallerOrdenes}`, color: [14, 165, 233] as [number, number, number] },
    { label: 'Gastos', value: `RD$ ${formatCurrency(totales.value.totalGastos)}`, color: [220, 38, 38] as [number, number, number] },
    { label: 'Margen %', value: `${totales.value.margen.toFixed(1)}%`, color: [13, 148, 136] as [number, number, number] },
    { label: 'Ticket Prom.', value: `RD$ ${formatCurrency(totales.value.ticketPromedio)}`, color: [79, 70, 229] as [number, number, number] },
    { label: 'Items/Fact.', value: `${totales.value.itemsPorFactura.toFixed(1)}`, color: [190, 24, 93] as [number, number, number] },
  ]

  const cardsPorFila = 6
  const separacionCard = 3
  const altoCard = 14
  const cardW = (pageW - margin * 2 - separacionCard * (cardsPorFila - 1)) / cardsPorFila
  for (let i = 0; i < cards.length; i++) {
    const columna = i % cardsPorFila
    if (columna === 0 && i > 0) y += altoCard + separacionCard
    addCard(cards[i].label, cards[i].value, cards[i].color, margin + columna * (cardW + separacionCard), cardW)
  }
  y += altoCard + 6

  // Charts as images
  const chartCanvases = [
    { ref: canvasDiario.value, label: 'Ingresos Diarios' },
    { ref: canvasPago.value, label: 'Por Metodo de Pago' },
    { ref: canvasTaller.value, label: 'Taller' },
    { ref: canvasTopClientes.value, label: 'Top 10 Clientes' },
    { ref: canvasTopProductos.value, label: 'Top 10 Productos' },
    { ref: canvasCategoria.value, label: 'Ventas por Categoria' },
  ]

  const chartsRow = chartCanvases.filter(c => c.ref)
  if (chartsRow.length > 0) {
    const imgW = (pageW - margin * 2 - 6) / Math.min(chartsRow.length, 2)
    for (let row = 0; row < chartsRow.length; row += 2) {
      for (let col = 0; col < 2 && row + col < chartsRow.length; col++) {
        const c = chartsRow[row + col]
        try {
          const dataUrl = c.ref.toDataURL('image/png')
          doc.addImage(dataUrl, 'PNG', margin + col * (imgW + 2), y, imgW, imgW * 0.5)
          doc.setFontSize(7)
          doc.setTextColor(100, 116, 139)
          doc.text(c.label, margin + col * (imgW + 2) + 2, y + 4)
        } catch (_) {}
      }
      y += imgW * 0.5 + 4
    }
    y += 4
  }

  // Table
  const cols = facturasFiltradas.value.length
  autoTable(doc, {
    startY: y,
    head: [['Factura', 'Fecha', 'Cliente', 'Pago', 'Costo', 'Total', 'Ganancia']],
    body: facturasFiltradas.value.slice(0, cols).map((f: any) => [
      f.no_factura || '',
      f.fecha_emision || '',
      f.nombre_cliente || '',
      f.metodo_pago || '',
      `RD$ ${formatCurrency(calcularCostoFactura(f))}`,
      `RD$ ${formatCurrency(f.total)}`,
      `RD$ ${formatCurrency(f.ganancia)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    styles: { cellPadding: 2 },
  })

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Factura', 'Fecha', 'Cliente', 'Producto', 'Cant.', 'Precio', 'Costo', 'Total']],
    body: productosVendidos.value.slice(0, 500).map((p: any) => [
      p.no_factura || '',
      p.fecha || '',
      p.cliente || '',
      p.producto || '',
      String(p.cantidad),
      `RD$ ${formatCurrency(p.precio)}`,
      `RD$ ${formatCurrency(p.costo)}`,
      `RD$ ${formatCurrency(p.total)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [251, 146, 60], fontSize: 7 },
    bodyStyles: { fontSize: 6 },
    styles: { cellPadding: 1.5 },
  })

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Vendedor', 'Facturas', 'Total', 'Ganancia']],
    body: ventasPorVendedor.value.map((v: any) => [
      v.vendedor,
      String(v.count),
      `RD$ ${formatCurrency(v.total)}`,
      `RD$ ${formatCurrency(v.ganancia)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], fontSize: 7 },
    bodyStyles: { fontSize: 6 },
    styles: { cellPadding: 1.5 },
  })

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Orden', 'Fecha', 'Cliente', 'Tecnico', 'Estado', 'Total', 'Ganancia']],
    body: tallerFiltrado.value.map((t: any) => [
      t.no_orden || t.no_factura || '',
      getTallerFecha(t),
      t.nombre || t.nombre_cliente || '',
      t.tecnico || '',
      t.estado || '',
      `RD$ ${formatCurrency(getTallerTotal(t))}`,
      `RD$ ${formatCurrency(getTallerGanancia(t))}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [6, 182, 212], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    styles: { cellPadding: 2 },
  })

  const pdfBlob = doc.output('blob')
  const url = URL.createObjectURL(pdfBlob)

  const result = await Swal.fire({
    title: 'Reporte General',
    width: '90%',
    showConfirmButton: false,
    showCloseButton: true,
    showDenyButton: true,
    denyButtonText: 'Descargar PDF',
    denyButtonColor: '#dc2626',
    showCancelButton: true,
    cancelButtonText: 'Cerrar',
    html: `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:8px"></iframe>`,
  })

  if (result.isDenied) {
    doc.save(filename)
  }

  URL.revokeObjectURL(url)
}

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(() => cargarDatos())
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Reporte General">
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <Button
          v-for="item in [
            { label: 'Hoy', key: 'hoy', icon: 'pi pi-calendar' },
            { label: 'Ayer', key: 'ayer', icon: 'pi pi-calendar' },
            { label: 'Esta Semana', key: 'semana', icon: 'pi pi-calendar' },
            { label: 'Este Mes', key: 'mes', icon: 'pi pi-calendar' },
            { label: 'Este Año', key: 'ano', icon: 'pi pi-calendar' },
            { label: 'Rango', key: 'personalizado', icon: 'pi pi-sliders-h' },
          ]"
          :key="item.key"
          :label="item.label"
          :icon="item.icon"
          :severity="rangoActivo === item.key ? 'primary' : 'secondary'"
          :outlined="rangoActivo !== item.key"
          size="small"
          @click="seleccionarRango(item.key)"
        />
        <Select v-if="almacenStore.hasMultiple" v-model="almacenStore.activeId" :options="almacenStore.almacenes" optionLabel="nombre" optionValue="id" placeholder="Almacen" class="w-44" size="small" @change="cargarDatos" />
        <Button label="Generar PDF" icon="pi pi-file-pdf" severity="danger" size="small" @click="generarReportePDF" class="ml-auto" />
      </div>

      <div v-if="rangoActivo === 'personalizado'" class="flex items-center gap-3 mb-4">
        <Calendar v-model="rangoPersonalizado" selectionMode="range" dateFormat="yy-mm-dd"
          placeholder="Seleccionar rango" showIcon fluid @update:modelValue="cargarDatos" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
        <div class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white shadow">
          <p class="text-blue-100 text-xs font-semibold">Ventas</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.total) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow">
          <p class="text-emerald-100 text-xs font-semibold">Ganancia</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.ganancia) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 p-4 text-white shadow">
          <p class="text-orange-100 text-xs font-semibold">Costo Ventas</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.costo) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow">
          <p class="text-amber-100 text-xs font-semibold">Descuentos</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.descuento) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 p-4 text-white shadow">
          <p class="text-violet-100 text-xs font-semibold">Facturas</p>
          <p class="text-xl font-bold">{{ totales.count }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow">
          <p class="text-cyan-100 text-xs font-semibold">Taller Ingresos</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.tallerIngresos) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 p-4 text-white shadow">
          <p class="text-rose-100 text-xs font-semibold">Taller Ganancia</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.tallerGanancia) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 p-4 text-white shadow">
          <p class="text-sky-100 text-xs font-semibold">Ordenes Taller</p>
          <p class="text-xl font-bold">{{ totales.tallerOrdenes }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-red-500 to-red-700 p-4 text-white shadow">
          <p class="text-red-100 text-xs font-semibold">Gastos</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.totalGastos) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 text-white shadow">
          <p class="text-teal-100 text-xs font-semibold">Margen %</p>
          <p class="text-xl font-bold">{{ totales.margen.toFixed(1) }}%</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 text-white shadow">
          <p class="text-indigo-100 text-xs font-semibold">Ticket Promedio</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.ticketPromedio) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-pink-500 to-pink-700 p-4 text-white shadow">
          <p class="text-pink-100 text-xs font-semibold">Items / Factura</p>
          <p class="text-xl font-bold">{{ totales.itemsPorFactura.toFixed(1) }}</p>
        </div>
        <div class="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 text-white shadow">
          <p class="text-teal-100 text-xs font-semibold">Ganancia Total</p>
          <p class="text-xl font-bold">RD$ {{ formatCurrency(totales.gananciaTotal) }}</p>
          <p class="text-[10px] text-teal-100 mt-1">Ventas + Taller</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
          <h4 class="text-sm font-semibold mb-3">Ingresos Diarios</h4>
          <div v-if="loading" class="h-48 flex items-center justify-center text-surface-400 text-sm">Cargando...</div>
          <div v-else class="h-48">
            <canvas ref="canvasDiario"></canvas>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
          <h4 class="text-sm font-semibold mb-3">Por Metodo de Pago</h4>
          <div v-if="loading" class="h-48 flex items-center justify-center text-surface-400 text-sm">Cargando...</div>
          <div v-else class="h-48">
            <canvas ref="canvasPago"></canvas>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
          <h4 class="text-sm font-semibold mb-3">Ordenes de Taller por Estado</h4>
          <div v-if="loading" class="h-48 flex items-center justify-center text-surface-400 text-sm">Cargando...</div>
          <div v-else-if="tallerTieneDatos" class="h-48 relative">
            <canvas ref="canvasTaller" class="!w-full !h-full"></canvas>
          </div>
          <div v-else class="h-48 flex flex-col items-center justify-center text-surface-400 text-sm">
            <i class="pi pi-chart-line text-2xl mb-2"></i>
            <span>No hay ordenes de taller en este rango.</span>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
          <h4 class="text-sm font-semibold mb-3">Top 10 Clientes</h4>
          <div v-if="loading" class="h-48 flex items-center justify-center text-surface-400 text-sm">Cargando...</div>
          <div v-else class="h-48">
            <canvas ref="canvasTopClientes"></canvas>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
          <h4 class="text-sm font-semibold mb-3">Top 10 Productos Vendidos</h4>
          <div v-if="loading" class="h-48 flex items-center justify-center text-surface-400 text-sm">Cargando...</div>
          <div v-else-if="topProductos.length > 0" class="h-48">
            <canvas ref="canvasTopProductos"></canvas>
          </div>
          <div v-else class="h-48 flex flex-col items-center justify-center text-surface-400 text-sm">
            <i class="pi pi-chart-bar text-2xl mb-2"></i>
            <span>No hay productos vendidos en este rango.</span>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
          <h4 class="text-sm font-semibold mb-3">Ventas por Categoria</h4>
          <div v-if="loading" class="h-48 flex items-center justify-center text-surface-400 text-sm">Cargando...</div>
          <div v-else-if="ventasPorCategoria.length > 0" class="h-48">
            <canvas ref="canvasCategoria"></canvas>
          </div>
          <div v-else class="h-48 flex flex-col items-center justify-center text-surface-400 text-sm">
            <i class="pi pi-chart-pie text-2xl mb-2"></i>
            <span>Sin datos de categoria.</span>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden col-span-1 sm:col-span-2">
          <div class="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
            <h4 class="font-semibold text-sm flex items-center gap-2"><i class="pi pi-list text-primary"></i> Productos Vendidos</h4>
            <span class="text-xs text-surface-400">{{ rangoLabel }}</span>
          </div>
          <div v-if="loading" class="text-center py-6 text-surface-400 text-sm">Cargando...</div>
          <div v-else-if="topProductos.length === 0" class="text-center py-6 text-surface-400 text-sm">Sin ventas en este rango</div>
          <div v-else class="divide-y divide-surface-100 dark:divide-surface-700">
            <div v-for="(p, i) in topProductos" :key="i" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
              <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                :style="{ background: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : 'var(--p-primary-300)' }">
                {{ i + 1 }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ p.nombre }}</div>
                <div class="text-xs text-surface-400">{{ p.cantidad }} vendido(s)</div>
              </div>
              <span class="text-sm font-semibold">${{ formatCurrency(p.total) }}</span>
            </div>
          </div>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 col-span-1 sm:col-span-2">
          <h4 class="text-sm font-semibold mb-3">Ventas por Vendedor</h4>
          <DataTable
            :value="ventasPorVendedor"
            :loading="loading"
            stripedRows
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            dataKey="vendedor"
            responsiveLayout="scroll"
            sortField="total"
            :sortOrder="-1"
            class="!text-xs"
          >
            <Column field="vendedor" header="Vendedor" sortable />
            <Column field="count" header="Facturas" sortable style="width: 6rem" />
            <Column field="total" header="Total" sortable style="width: 8rem">
              <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
            </Column>
            <Column field="ganancia" header="Ganancia" sortable style="width: 8rem">
              <template #body="{ data }"><span class="text-emerald-600 font-semibold">${{ formatCurrency(data.ganancia) }}</span></template>
            </Column>
            <template #empty>
              <div class="text-center py-6 text-surface-400">Sin datos de vendedor.</div>
            </template>
          </DataTable>
        </div>
      </div>

      <div class="flex items-center gap-2 mb-3">
        <i class="pi pi-search text-surface-400" />
        <InputText v-model="busqueda" placeholder="Buscar factura, orden, cliente, tecnico, metodo pago..." fluid class="!text-sm" />
      </div>

      <h4 class="text-sm font-semibold mb-2">Facturas</h4>
      <DataTable
        :value="facturasFiltradas"
        :loading="loading"
        stripedRows
        paginator
        :rows="15"
        :rowsPerPageOptions="[15, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
        sortField="fecha_emision"
        :sortOrder="-1"
      >
        <Column field="no_factura" header="Factura" sortable style="width: 8rem" />
        <Column field="fecha_emision" header="Fecha" sortable style="width: 7rem" />
        <Column field="nombre_cliente" header="Cliente" sortable />
        <Column field="metodo_pago" header="Pago" sortable style="width: 7rem" />
        <Column field="descuento" header="Desc." sortable style="width: 6rem">
          <template #body="{ data }">
            <span v-if="data.descuento > 0" class="text-amber-600 font-semibold">${{ formatCurrency(data.descuento) }}</span>
            <span v-else class="text-surface-300">-</span>
          </template>
        </Column>
        <Column header="Costo" sortable style="width: 7rem">
          <template #body="{ data }">
            <span class="text-orange-600 font-semibold">${{ formatCurrency(calcularCostoFactura(data)) }}</span>
          </template>
        </Column>
        <Column field="total" header="Total" sortable style="width: 7rem">
          <template #body="{ data }">
            <span class="font-semibold">${{ formatCurrency(getTallerTotal(data)) }}</span>
          </template>
        </Column>
        <Column field="ganancia" header="Ganancia" sortable style="width: 7rem">
          <template #body="{ data }">
            <span :class="data.ganancia >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500'">${{ formatCurrency(data.ganancia) }}</span>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-400">No hay facturas en este rango.</div>
        </template>
      </DataTable>

      <h4 class="text-sm font-semibold mt-6 mb-2">Ordenes de Taller</h4>
      <DataTable
        :value="tallerFiltrado"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
        sortField="fecha_entrada"
        :sortOrder="-1"
      >
        <Column field="no_orden" header="Orden" sortable style="width: 8rem">
          <template #body="{ data }">
            <span class="font-semibold">{{ data.no_orden || data.no_factura || '-' }}</span>
          </template>
        </Column>
        <Column header="Fecha" sortable style="width: 7rem">
          <template #body="{ data }">{{ getTallerFecha(data) || '-' }}</template>
        </Column>
        <Column field="nombre" header="Cliente" sortable />
        <Column field="tecnico" header="Tecnico" sortable style="width: 10rem" />
        <Column field="estado" header="Estado" sortable style="width: 9rem" />
        <Column field="total" header="Total" sortable style="width: 7rem">
          <template #body="{ data }">
            <span class="font-semibold">${{ formatCurrency(data.total) }}</span>
          </template>
        </Column>
        <Column header="Ganancia" sortable style="width: 7rem">
          <template #body="{ data }">
            <span class="text-emerald-600 font-semibold">${{ formatCurrency(getTallerGanancia(data)) }}</span>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-400">No hay ordenes de taller en este rango.</div>
        </template>
      </DataTable>
    </Fieldset>
  </div>
</template>
