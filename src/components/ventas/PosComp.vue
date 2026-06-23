<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import html2canvas from 'html2canvas'

import { envioElectron, peticionesFetch, encryptarPassword } from '@/funciones/funciones.js'
import NotasComp from '@/components/ventas/NotasComp.vue'
import FacturaPdfPrint from '@/components/ventas/FacturaPdfPrint.vue'
import { useAlmacenStore } from '@/stores/almacen.store'
import { useAlmacenFilter } from '@/composables/useAlmacenFilter'
const { filterByAlmacen, addAlmacenId: addAlmacenIdFilter } = useAlmacenFilter()

const toast = useToast()

const activeTab = ref<string>('celulares')
const tabOptions = computed(() => [
  { label: `Celulares (${telefonos.value.length})`, value: 'celulares', icon: 'pi pi-mobile' },
  { label: `Accesorios (${accesorios.value.length})`, value: 'accesorios', icon: 'pi pi-box' },
  { label: `Electro. (${electrodomesticos.value.length})`, value: 'electrodomesticos', icon: 'pi pi-sitemap' },
])
const busquedaProd = ref('')
const ocultarSinStock = ref(true)

const telefonos = ref<any[]>([])
const accesorios = ref<any[]>([])
const electrodomesticos = ref<any[]>([])
const imeisDisponibles = ref<any[]>([])
const serialesDisponibles = ref<any[]>([])
const clientes = ref<any[]>([])
const marcas = ref<any[]>([])
const categorias = ref<any[]>([])

const cart = ref<any[]>([])
const loading = ref(false)
const dialogVariantes = ref(false)
const busquedaImei = ref('')
const selectedTelefono = ref<any>(null)
const selectedElectrodomestico = ref<any>(null)
const variantesImei = ref<any[]>([])
const variantesSerial = ref<any[]>([])
const dialogPrecio = ref(false)
const imeiParaPrecio = ref<any>(null)
const precioSeleccionado = ref<'venta' | 'min' | 'xmayor' | 'manual'>('venta')
const precioManual = ref(0)
const flippedAccId = ref<number | null>(null)
const flippedTelId = ref<number | null>(null)
const flippedElecId = ref<number | null>(null)
const dialogCliente = ref(false)
const busquedaCliente = ref('')
const dialogNuevoCliente = ref(false)
const nuevoClienteForm = ref({ nombre: '', telefono: '', direccion: '', rnc: '' })
const rncTipo = ref<'RNC' | 'CEDULA'>('RNC')
const buscandoClienteApi = ref(false)
const dialogProductoPersonalizado = ref(false)
const dialogCambiarPrecio = ref(false)
const cartItemPrecio = ref<any>(null)
const nuevoPrecioItem = ref(0)
const clienteExpress = ref('')
const esCotizacion = ref(false)
const prodPersonalizado = ref({ nombre: '', precio: 0, costo: 0 })
const dialogDescuento = ref(false)
const descuentoTipo = ref<'fijo' | 'porcentaje' | 'nota_credito'>('fijo')
const descuentoValor = ref(0)
const notasCreditoCliente = ref<any[]>([])
const notaCreditoSeleccionada = ref<any>(null)
const confirmPago = ref(false)
const dialogMixto = ref(false)
const pasoMixto = ref<'elegir' | 'montos'>('elegir')
const metodosMixto = ref({ efectivo: false, tarjeta: false, transferencia: false, cheque: false })
const mixtoEfectivo = ref(0)
const mixtoTarjeta = ref(0)
const mixtoTransferencia = ref(0)
const mixtoCheque = ref(0)
const mixtoError = ref('')
const dialogTicket = ref(false)
const dialogPrintChoice = ref(false)
const facturaPdfRef = ref<any>(null)
const dialogPdf = ref(false)
const pdfUrl = ref('')
const ticketInvoiceNo = ref('')
const ticketData = ref<any>(null)
const printerName = ref('')
const ticketConfig = ref({
  printer_name: '',
  paper_width: 80,
  show_logo: 1,
  show_company_name: 1,
  show_legal: 1,
  show_phone: 1,
  show_address: 1,
  show_email: 1,
  show_cliente: 1,
  show_items: 1,
  show_totals: 1,
  show_barcode: 1,
  show_footer: 1,
  show_qr: 0,
  show_nota: 1,
  footer_text: 'Gracias por su compra',
})
const comprobantes = ref<any[]>([])
const comprobanteSeleccionado = ref<any>(null)
const clienteSeleccionado = ref<any>(null)
const noFactura = ref('')
const metodoPago = ref('EFECTIVO')
const montoRecibido = ref(0)
const descuentoFijo = ref(0)
const descuentoPorc = ref(0)
const nota = ref('')
const guardando = ref(false)

const link = ref('')
const api = ref('')
const token = ref('')

const empresaNombre = ref('MI EMPRESA')
const empresaRnc = ref('')
const empresaTipoDoc = ref('')
const impuestoPorcentaje = ref(18)
const impuestoIncluido = ref(1)
const impuestoPorcentajeOriginal = ref(18)
const impuestoIncluidoOriginal = ref(1)

async function recargarConfigVentas() {
  try {
    const res = await window.db.getAll('empresa')
    if (res.success && res.data?.length > 0) {
      const e = res.data[0]
      impuestoPorcentaje.value = e.impuesto == null || e.impuesto === '' ? 18 : Number(e.impuesto)
      impuestoIncluido.value = e.impuesto_incluido == null || e.impuesto_incluido === '' ? 1 : Number(e.impuesto_incluido)
      impuestoPorcentajeOriginal.value = impuestoPorcentaje.value
      impuestoIncluidoOriginal.value = impuestoIncluido.value
      empresaNombre.value = e.nombre || 'MI EMPRESA'
      empresaRnc.value = e.legal || ''
      empresaTelefono.value = e.telefono || ''
      empresaDireccion.value = e.direccion || ''
      empresaEmail.value = e.email || ''
      empresaLogo.value = e.logo || ''
      empresaTipoDoc.value = e.tipo_documento_defecto || ''
    }
  } catch (_) {}
}
const empresaTelefono = ref('')
const empresaDireccion = ref('')
const empresaEmail = ref('')
const empresaLogo = ref('')

const POS_STORAGE_KEY = 'pos_cart_data'

function isTicketOptionOn(value: any): boolean {
  return value === true || value === 1 || value === '1'
}

function guardarEstado() {
  const data = {
    cart: cart.value,
    cliente: clienteSeleccionado.value,
    descuento_fijo: descuentoFijo.value,
    descuento_porc: descuentoPorc.value,
    descuento_tipo: descuentoTipo.value,
    descuento_valor: descuentoValor.value,
    metodoPago: metodoPago.value,
    nota: nota.value,
    es_cotizacion: esCotizacion.value,
  }
  localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(data))
}

async function cargarEstado() {
  await recargarConfigVentas()
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.cart?.length) cart.value = data.cart
    if (data.cliente) clienteSeleccionado.value = data.cliente
    if (data.descuento_fijo != null) descuentoFijo.value = data.descuento_fijo
    if (data.descuento_porc != null) descuentoPorc.value = data.descuento_porc
    if (data.descuento_tipo) descuentoTipo.value = data.descuento_tipo
    if (data.descuento_valor != null) descuentoValor.value = data.descuento_valor
    if (data.metodoPago) metodoPago.value = data.metodoPago
    if (data.nota) nota.value = data.nota
    if (data.es_cotizacion != null) esCotizacion.value = data.es_cotizacion
  } catch (e) {
    console.error('Error loading POS state:', e)
  }
}

const metodosPagoDB = ref<any[]>([])
const metodosPago = computed(() => {
  const db = metodosPagoDB.value
    .filter((m: any) => m.estado === 'ACTIVO')
    .map((m: any) => ({ label: m.porcentaje ? `${m.nombre} (${m.porcentaje}%)` : m.nombre, value: m.nombre, porcentaje: m.porcentaje }))
  if (!db.some((m: any) => m.value === 'CREDITO')) db.push({ label: 'Credito', value: 'CREDITO' })
  if (!db.some((m: any) => m.value === 'MIXTO')) db.push({ label: 'Mixto', value: 'MIXTO' })
  return db
})
const metodoPagoSelected = computed(() => metodosPagoDB.value.find((m: any) => m.nombre === metodoPago.value))
const comisionPorcentaje = computed(() => {
  if (metodoPago.value === 'CREDITO' || metodoPago.value === 'MIXTO') return 0
  return Number(metodoPagoSelected.value?.porcentaje || 0)
})
const cartConComision = computed(() => {
  const pct = comisionPorcentaje.value
  if (pct <= 0) return cart.value
  return cart.value.map(item => ({
    ...item,
    precio: item.precio * (1 + pct / 100),
    precioOriginal: item.precio,
  }))
})

function pagoBadge(value: string): string {
  const map: Record<string, string> = {
    EFECTIVO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    TARJETA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    TRANSFERENCIA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    CHEQUE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    CREDITO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    MIXTO: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  }
  return map[value] || 'bg-surface-100 text-surface-600'
}

function pagoIcon(value: string): string {
  const map: Record<string, string> = {
    EFECTIVO: 'pi pi-money-bill',
    TARJETA: 'pi pi-credit-card',
    TRANSFERENCIA: 'pi pi-send',
    CHEQUE: 'pi pi-book',
    CREDITO: 'pi pi-clock',
    MIXTO: 'pi pi-sync',
  }
  return map[value] || 'pi pi-circle'
}

function compBadge(tipo: string): string {
  const map: Record<string, string> = {
    SIN: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    E31: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    E32: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    E33: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    E34: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    E41: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  }
  return map[tipo] || 'bg-surface-100 text-surface-600'
}

const productosFiltrados = computed(() => {
  const texto = busquedaProd.value.toLowerCase().trim()

  if (activeTab.value === 'celulares') {
    let data = telefonos.value
    if (ocultarSinStock.value) {
      const conStock = new Set(imeisDisponibles.value.map(i => i.id_equi))
      data = data.filter(t => conStock.has(t.id))
    }
    if (!texto) return data
    const imeiMatch = imeisDisponibles.value.filter(i => i.nombre?.toLowerCase().includes(texto))
    const telIds = new Set(imeiMatch.map(i => i.id_equi))
    return data.filter(t =>
      t.nombre?.toLowerCase().includes(texto) || telIds.has(t.id)
    )
  } else if (activeTab.value === 'electrodomesticos') {
    let data = electrodomesticos.value
    if (ocultarSinStock.value) {
      const conStock = new Set(serialesDisponibles.value.map(i => i.id_equi))
      data = data.filter(t => conStock.has(t.id))
    }
    if (!texto) return data
    const serialMatch = serialesDisponibles.value.filter(i => i.nombre?.toLowerCase().includes(texto))
    const elecIds = new Set(serialMatch.map(i => i.id_equi))
    return data.filter(t =>
      t.nombre?.toLowerCase().includes(texto) || elecIds.has(t.id)
    )
  } else {
    let data = accesorios.value
    if (ocultarSinStock.value) {
      data = data.filter(a => (a.cantidad || 0) > 0)
    }
    if (!texto) return data
    return data.filter(a =>
      a.nombre?.toLowerCase().includes(texto) ||
      a.marca_nombre?.toLowerCase().includes(texto)
    )
  }
})

function buscarImei() {
  const texto = busquedaProd.value.trim()
  if (!texto || texto.length < 3) return
  if (activeTab.value === 'celulares') {
    const imeiExacto = imeisDisponibles.value.find(i => i.nombre?.trim() === texto)
    if (imeiExacto) {
      selectedTelefono.value = telefonos.value.find(t => t.id === imeiExacto.id_equi) || null
      imeiParaPrecio.value = imeiExacto
      precioSeleccionado.value = 'venta'
      precioManual.value = imeiExacto.precio_venta || 0
      busquedaProd.value = ''
      dialogPrecio.value = true
    }
  } else if (activeTab.value === 'electrodomesticos') {
    const serialExacto = serialesDisponibles.value.find(i => i.nombre?.trim() === texto)
    if (serialExacto) {
      selectedElectrodomestico.value = electrodomesticos.value.find(t => t.id === serialExacto.id_equi) || null
      imeiParaPrecio.value = serialExacto
      precioSeleccionado.value = 'venta'
      precioManual.value = serialExacto.precio_venta || 0
      busquedaProd.value = ''
      dialogPrecio.value = true
    }
  }
}

const subtotal = computed(() => {
  return cartConComision.value.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
})

const total = computed(() => {
  const desc = descuentoTipo.value === 'porcentaje'
    ? subtotal.value * (descuentoValor.value / 100)
    : descuentoFijo.value
  const base = Math.max(0, subtotal.value - Math.min(desc, subtotal.value))
  if (impuestoIncluido.value === 0) {
    return base + (base * (impuestoPorcentaje.value / 100))
  }
  return base
})

const impuestoMonto = computed(() => {
  if (impuestoIncluido.value === 0) {
    return subtotal.value * (impuestoPorcentaje.value / 100)
  }
  return 0
})

const descuento = computed(() => {
  if (descuentoTipo.value === 'porcentaje') {
    return subtotal.value * (descuentoValor.value / 100)
  }
  return descuentoFijo.value
})

const cambio = computed(() => 0)

watch([cart, clienteSeleccionado, descuento, metodoPago, nota], guardarEstado, { deep: true })

const clientesFiltrados = computed(() => {
  const texto = busquedaCliente.value.toLowerCase().trim()
  if (!texto) return clientes.value
  return clientes.value.filter(c =>
    c.nombre?.toLowerCase().includes(texto) ||
    c.telefono?.toLowerCase().includes(texto) ||
    c.rnc?.toLowerCase().includes(texto)
  )
})

const gananciaTotal = computed(() => {
  return cartConComision.value.reduce((sum, item) => {
    const costo = item.costo || 0
    return sum + ((item.precio - costo) * item.cantidad)
  }, 0)
})

const cartCount = computed(() => cart.value.reduce((sum, item) => sum + item.cantidad, 0))

const variantesFiltradas = computed(() => {
  const lista = selectedTelefono.value ? variantesImei.value : variantesSerial.value
  const texto = busquedaImei.value.toLowerCase().trim()
  if (!texto) return lista
  return lista.filter(i =>
    i.nombre?.toLowerCase().includes(texto) ||
    i.color?.toLowerCase().includes(texto) ||
    i.capacidad?.toLowerCase().includes(texto)
  )
})

function formatCurrency(n: number): string {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function cargarProductos() {
  try {
    const [resTel, resAcc, resElec, resCli, resMar, resCat] = await Promise.all([
      window.db.getAll('telefonos'),
      window.db.getAll('accesorios'),
      window.db.getAll('electrodomesticos'),
      window.db.getAll('clientes'),
      window.db.getAll('marcas'),
      window.db.getAll('categorias'),
    ])

    if (resTel.success) telefonos.value = resTel.data || []
    if (resAcc.success) accesorios.value = filterByAlmacen(resAcc.data || [])
    if (resElec.success) electrodomesticos.value = filterByAlmacen(resElec.data || [])
    if (resCli.success) clientes.value = resCli.data || []
    if (resMar.success) marcas.value = resMar.data || []
    if (resCat.success) categorias.value = resCat.data || []

    const marcasMap = new Map(marcas.value.map(m => [m.id, m.nombre]))
    const catsMap = new Map(categorias.value.map(c => [c.id, c.nombre]))

    accesorios.value = accesorios.value.filter(a => (a.cantidad || 0) > 0)
    accesorios.value = accesorios.value.map(a => ({
      ...a,
      marca_nombre: marcasMap.get(a.marca) || '',
      categoria_nombre: catsMap.get(a.categoria) || '',
    }))
  } catch (error) {
    console.error(error)
  }
}

async function cargarImeisDisponibles() {
  try {
    const [resImei, resSerial] = await Promise.all([
      window.db.getAll('imei'),
      window.db.getAll('serial'),
    ])
    if (resImei.success) {
      imeisDisponibles.value = filterByAlmacen(resImei.data || []).filter((i: any) => i.estado === 'DISPONIBLE')
    }
    if (resSerial.success) {
      serialesDisponibles.value = filterByAlmacen(resSerial.data || []).filter((i: any) => i.estado === 'DISPONIBLE')
    }
  } catch (error) {
    console.error(error)
  }
}

function abrirVariantes(telefono: any) {
  selectedTelefono.value = telefono
  selectedElectrodomestico.value = null
  variantesImei.value = imeisDisponibles.value.filter((i: any) => i.id_equi === telefono.id)
  variantesSerial.value = []
  busquedaImei.value = ''
  dialogVariantes.value = true
}

function abrirVariantesSerial(electrodomestico: any) {
  selectedElectrodomestico.value = electrodomestico
  selectedTelefono.value = null
  variantesSerial.value = serialesDisponibles.value.filter((i: any) => i.id_equi === electrodomestico.id)
  variantesImei.value = []
  busquedaImei.value = ''
  dialogVariantes.value = true
}

const imeiSearch = ref('')
const elecSearch = ref('')

function imeisDelTel(telefonoId: number) {
  const texto = imeiSearch.value.toLowerCase().trim()
  let list = imeisDisponibles.value.filter((i: any) => i.id_equi === telefonoId)
  if (texto) {
    list = list.filter((i: any) =>
      i.nombre?.toLowerCase().includes(texto) ||
      i.color?.toLowerCase().includes(texto) ||
      i.capacidad?.toLowerCase().includes(texto)
    )
  }
  return list
}

function serialesDelElec(electrodomesticoId: number) {
  const texto = elecSearch.value.toLowerCase().trim()
  let list = serialesDisponibles.value.filter((i: any) => i.id_equi === electrodomesticoId)
  if (texto) {
    list = list.filter((i: any) =>
      i.nombre?.toLowerCase().includes(texto) ||
      i.color?.toLowerCase().includes(texto) ||
      i.capacidad?.toLowerCase().includes(texto)
    )
  }
  return list
}

function seleccionarImeiDirecto(imei: any) {
  const telefono = telefonos.value.find(t => t.id === imei.id_equi)
  if (!telefono) return
  imeiParaPrecio.value = imei
  selectedTelefono.value = telefono
  selectedElectrodomestico.value = null
  precioSeleccionado.value = 'venta'
  precioManual.value = imei.precio_venta || 0
  dialogPrecio.value = true
}

function seleccionarSerialDirecto(serial: any) {
  const elec = electrodomesticos.value.find(t => t.id === serial.id_equi)
  if (!elec) return
  imeiParaPrecio.value = serial
  selectedElectrodomestico.value = elec
  selectedTelefono.value = null
  precioSeleccionado.value = 'venta'
  precioManual.value = serial.precio_venta || 0
  dialogPrecio.value = true
}

function abrirPrecio(imei: any) {
  imeiParaPrecio.value = imei
  precioSeleccionado.value = 'venta'
  precioManual.value = imei.precio_venta || 0
  dialogVariantes.value = false
  dialogPrecio.value = true
}

const variantesFiltradasSerial = computed(() => {
  const texto = busquedaImei.value.toLowerCase().trim()
  if (!texto) return variantesSerial.value
  return variantesSerial.value.filter(i =>
    i.nombre?.toLowerCase().includes(texto) ||
    i.color?.toLowerCase().includes(texto) ||
    i.capacidad?.toLowerCase().includes(texto)
  )
})

function getPrecioActual(): number {
  switch (precioSeleccionado.value) {
    case 'venta': return imeiParaPrecio.value?.precio_venta || 0
    case 'min': return imeiParaPrecio.value?.precio_min || 0
    case 'xmayor': return imeiParaPrecio.value?.precio_xmayor || 0
    case 'manual': return precioManual.value
    default: return 0
  }
}

function getPrecioNormal(item: any): number {
  return Number(item?.precio_normal || item?.precio_venta || 0)
}

function itemTieneDescuento(item: any): boolean {
  const precioNormal = getPrecioNormal(item)
  const precioActual = Number(item?.precio || 0)
  return precioNormal > 0 && precioActual >= 0 && precioActual < precioNormal
}

function agregarImeiAlCarrito() {
  const imei = imeiParaPrecio.value
  if (!imei) return

  if (selectedTelefono.value) {
    const yaExiste = cart.value.find((item: any) => item.tipo === 'imei' && item.imei_id === imei.id)
    if (yaExiste) {
      toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Este IMEI ya esta en el carrito', life: 2000 })
      return
    }
  } else if (selectedElectrodomestico.value) {
    const yaExiste = cart.value.find((item: any) => item.tipo === 'serial' && item.serial_id === imei.id)
    if (yaExiste) {
      toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Este Serial ya esta en el carrito', life: 2000 })
      return
    }
  }

  const precioFinal = getPrecioActual()
  if (precioFinal <= 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El precio debe ser mayor a 0', life: 2000 })
    return
  }

  if (selectedTelefono.value) {
    cart.value.push({
      tipo: 'imei',
      imei_id: imei.id,
      imei: imei.nombre,
      nombre: selectedTelefono.value?.nombre || '',
      color: imei.color || '',
      capacidad: imei.capacidad || '',
      precio: precioFinal,
      precio_normal: imei.precio_venta || precioFinal,
      costo: imei.costo || 0,
      cantidad: 1,
    })
    toast.add({ severity: 'success', summary: 'Agregado', detail: `${selectedTelefono.value?.nombre} agregado`, life: 2000 })
  } else if (selectedElectrodomestico.value) {
    cart.value.push({
      tipo: 'serial',
      serial_id: imei.id,
      serial: imei.nombre,
      nombre: selectedElectrodomestico.value?.nombre || '',
      color: imei.color || '',
      capacidad: imei.capacidad || '',
      precio: precioFinal,
      precio_normal: imei.precio_venta || precioFinal,
      costo: imei.costo || 0,
      cantidad: 1,
    })
    toast.add({ severity: 'success', summary: 'Agregado', detail: `${selectedElectrodomestico.value?.nombre} agregado`, life: 2000 })
  }
  dialogPrecio.value = false
}

function agregarAccesorio(accesorio: any) {
  const yaExiste = cart.value.find((item: any) => item.tipo === 'accesorio' && item.accesorio_id === accesorio.id)
  if (yaExiste) {
    if (yaExiste.cantidad >= (accesorio.cantidad || 0)) {
      toast.add({ severity: 'warn', summary: 'Stock insuficiente', detail: 'No hay suficiente stock', life: 2000 })
      return
    }
    yaExiste.cantidad++
    yaExiste.precio = accesorio.precio_venta || 0
    yaExiste.precio_normal = accesorio.precio_venta || yaExiste.precio
    return
  }
  cart.value.push({
    tipo: 'accesorio',
    accesorio_id: accesorio.id,
    nombre: accesorio.nombre,
    precio: accesorio.precio_venta || 0,
    precio_normal: accesorio.precio_venta || 0,
    costo: accesorio.costo || 0,
    stock: accesorio.cantidad || 0,
    cantidad: 1,
  })
  toast.add({ severity: 'success', summary: 'Agregado', detail: `${accesorio.nombre} agregado`, life: 2000 })
}

function quitarDelCarrito(index: number) {
  cart.value.splice(index, 1)
}

function aumentarCantidad(index: number) {
  const item = cart.value[index]
  if (item.tipo === 'imei' || item.tipo === 'serial') return
  const acc = accesorios.value.find((a: any) => a.id === item.accesorio_id)
  if (acc && item.cantidad >= (acc.cantidad || 0)) {
    toast.add({ severity: 'warn', summary: 'Stock insuficiente', detail: 'No hay mas unidades disponibles', life: 2000 })
    return
  }
  item.cantidad++
}

function disminuirCantidad(index: number) {
  const item = cart.value[index]
  if (item.tipo === 'imei' || item.tipo === 'serial') return
  if (item.cantidad <= 1) {
    quitarDelCarrito(index)
    return
  }
  item.cantidad--
}

const precioCambioSeleccionado = ref<'venta' | 'min' | 'xmayor' | 'manual'>('venta')
const itemParaPrecio = ref<any>(null)

function abrirCambiarPrecio(item: any, index: number) {
  cartItemPrecio.value = { item, index }

  if (item.tipo === 'accesorio') {
    itemParaPrecio.value = accesorios.value.find((a: any) => a.id === item.accesorio_id) || null
  } else if (item.tipo === 'imei') {
    itemParaPrecio.value = imeisDisponibles.value.find((i: any) => i.id === item.imei_id) || null
  } else if (item.tipo === 'serial') {
    itemParaPrecio.value = serialesDisponibles.value.find((s: any) => s.id === item.serial_id) || null
  } else {
    itemParaPrecio.value = null
  }

  nuevoPrecioItem.value = item.precio
  precioCambioSeleccionado.value = 'venta'
  dialogCambiarPrecio.value = true
}

function seleccionarPrecioCambio(tipo: 'venta' | 'min' | 'xmayor' | 'manual') {
  precioCambioSeleccionado.value = tipo
  if (tipo === 'venta') nuevoPrecioItem.value = itemParaPrecio.value?.precio_venta || 0
  else if (tipo === 'min') nuevoPrecioItem.value = itemParaPrecio.value?.precio_min || 0
  else if (tipo === 'xmayor') nuevoPrecioItem.value = itemParaPrecio.value?.precio_xmayor || 0
}

function aplicarCambioPrecio() {
  if (!cartItemPrecio.value) return
  const { index } = cartItemPrecio.value
  if (nuevoPrecioItem.value >= 0) {
    cart.value[index].precio = nuevoPrecioItem.value
    cart.value[index].precio_normal = cart.value[index].precio_normal || itemParaPrecio.value?.precio_venta || nuevoPrecioItem.value
    toast.add({ severity: nuevoPrecioItem.value === 0 ? 'info' : 'success', summary: nuevoPrecioItem.value === 0 ? 'Gratis' : 'Precio actualizado', life: 2000 })
  }
  dialogCambiarPrecio.value = false
  cartItemPrecio.value = null
  itemParaPrecio.value = null
}

function seleccionarCliente(cliente: any) {
  clienteSeleccionado.value = cliente
  dialogCliente.value = false
}

function abrirNuevoCliente() {
  nuevoClienteForm.value = { nombre: '', telefono: '', direccion: '', rnc: '' }
  rncTipo.value = 'RNC'
  dialogNuevoCliente.value = true
}

async function buscarClienteApi() {
  let valor = nuevoClienteForm.value.rnc.trim().replace(/-/g, '')
  if (!valor) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Ingresa un RNC o Cedula', life: 3000 })
    return
  }
  nuevoClienteForm.value.rnc = valor
  buscandoClienteApi.value = true
  try {
    const tokenCifrado = await encryptarPassword('1234567890abc', 10)
    let resultado: any
    if (rncTipo.value === 'CEDULA') {
      resultado = await peticionesFetch('https://demo.tmposrd.com/api2', 'buscarcedula', { cedula: valor }, tokenCifrado, 'POST')
    } else {
      resultado = await peticionesFetch('https://demo.tmposrd.com/api2', `consultarrnc/${valor}`, {}, tokenCifrado, 'GET')
    }
    console.log('[BuscarCliente] Resultado:', resultado)
    if (resultado?.error) {
      toast.add({ severity: 'error', summary: 'Error', detail: resultado.error, life: 4000 })
      return
    }
    let info = resultado?.datos || resultado?.data || resultado
    if (Array.isArray(info)) info = info[0]
    if (!info || (typeof info === 'object' && Object.keys(info).length === 0)) {
      toast.add({ severity: 'info', summary: 'No encontrado', detail: 'No se encontraron datos para ese documento', life: 3000 })
      return
    }
    nuevoClienteForm.value.nombre = (info.name || info.nombre || info.razon_social || info.RazonSocial || '').toUpperCase()
    nuevoClienteForm.value.direccion = (info.direccion || info.Direccion || info.address || info.domicilio || '').toUpperCase()
    toast.add({ severity: 'success', summary: 'Encontrado', detail: `Datos cargados: ${nuevoClienteForm.value.nombre}`, life: 3000 })
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Error al consultar API', life: 4000 })
  } finally {
    buscandoClienteApi.value = false
  }
}

async function guardarNuevoCliente() {
  if (!nuevoClienteForm.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre del cliente es requerido', life: 3000 })
    return
  }
  try {
    const data = {
      nombre: nuevoClienteForm.value.nombre.trim().toUpperCase(),
      telefono: nuevoClienteForm.value.telefono.trim(),
      direccion: nuevoClienteForm.value.direccion.trim().toUpperCase(),
      rnc: nuevoClienteForm.value.rnc.trim().replace(/-/g, ''),
      email: '',
    }
    const res = await window.db.insert('clientes', data)
    if (res.success) {
      const nuevoCliente = { id: res.data.id, ...data }
      clientes.value.unshift(nuevoCliente)
      clienteSeleccionado.value = nuevoCliente
      dialogNuevoCliente.value = false
      dialogCliente.value = false
      toast.add({ severity: 'success', summary: 'Cliente creado', detail: data.nombre, life: 2000 })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear el cliente', life: 3000 })
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear cliente', life: 3000 })
  }
}

function abrirProductoPersonalizado() {
  prodPersonalizado.value = { nombre: '', precio: 0, costo: 0 }
  dialogProductoPersonalizado.value = true
}

function agregarProductoPersonalizado() {
  if (!prodPersonalizado.value.nombre.trim() || prodPersonalizado.value.precio <= 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Nombre y precio requeridos', life: 2000 })
    return
  }
  cart.value.push({
    tipo: 'personalizado',
    nombre: prodPersonalizado.value.nombre.trim().toUpperCase(),
    precio: prodPersonalizado.value.precio,
    costo: prodPersonalizado.value.costo,
    cantidad: 1,
  })
  dialogProductoPersonalizado.value = false
  toast.add({ severity: 'success', summary: 'Agregado', detail: prodPersonalizado.value.nombre, life: 2000 })
}

async function ventaExpress() {
  if (cart.value.length === 0) {
    toast.add({ severity: 'warn', summary: 'Carrito vacio', detail: 'Agrega productos al carrito', life: 3000 })
    return
  }
  metodoPago.value = 'EFECTIVO'
  clienteSeleccionado.value = null
  montoRecibido.value = total.value
  descuentoFijo.value = 0
  descuentoPorc.value = 0
  descuentoValor.value = 0
  descuentoTipo.value = 'fijo'
  montoRecibido.value = 0
  nota.value = ''
  noFactura.value = ''
  metodoPago.value = 'EFECTIVO'
  clienteSeleccionado.value = null
  localStorage.removeItem(POS_STORAGE_KEY)
}

function imprimirPdf() {
  dialogPrintChoice.value = false
  if (ticketData.value) {
    facturaPdfRef.value?.printFactura(ticketData.value)
    setTimeout(() => {
      dialogTicket.value = true
    }, 500)
  }
}

async function soloTicket() {
  dialogPrintChoice.value = false
  await imprimirTicket()
}

async function compartirWhatsApp() {
  const d = ticketData.value
  if (!d) return
  const telefono = d.telefono || ''
  if (!telefono) {
    toast.add({ severity: 'warn', summary: 'WhatsApp', detail: 'El cliente no tiene telefono registrado', life: 3000 })
    return
  }

  try {
    const html = await facturaPdfRef.value?.generateFacturaHtml({ factura: d })
    if (html) {
      const nombre = `Factura_${d.no_factura || 'sin_numero'}.pdf`
      const res = await window.electron.invoke('pdf:generateToFile', html, nombre) as any
      if (res.success) {
        await window.electron.invoke('clipboard:copyFile', res.filePath)
        toast.add({ severity: 'info', summary: 'PDF copiado', detail: 'PDF copiado al portapapeles. Abre WhatsApp y pega (Ctrl+V) para enviarlo.', life: 5000 })
      }
    }
  } catch (_) {}

  const mensaje = encodeURIComponent(
    `Factura ${d.no_factura}\nTotal: RD$${d.total?.toFixed(2)}\nCliente: ${d.cliente}\nFecha: ${d.fecha}`
  )
  window.open(`https://wa.me/${telefono.replace(/[^0-9]/g, '')}?text=${mensaje}`, '_blank')
  dialogPrintChoice.value = false
  cerrarTicket()
}

async function compartirImagen() {
  const d = ticketData.value
  if (!d) return
  dialogPrintChoice.value = false
  let container: HTMLDivElement | null = null

  try {
    const html = generarTicketHTML()

    container = document.createElement('div')
    container.innerHTML = `<div style="display:flex;justify-content:center;background:#fff;padding:12px 16px">${html}</div>`
    container.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;z-index:-1'
    document.body.appendChild(container)

    await new Promise(r => setTimeout(r, 800))

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    container.remove()
    container = null

    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
    const nombreArchivo = `Ticket_${d.no_factura || 'sin_numero'}.png`
    const file = new File([blob], nombreArchivo, { type: 'image/png' })
    const shareData = {
      title: `Factura ${d.no_factura || ''}`.trim(),
      text: `Factura ${d.no_factura || ''}`.trim(),
      files: [file],
    }

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData)
      toast.add({ severity: 'success', summary: 'Compartido', detail: 'Se abrio la ventana de compartir.', life: 3000 })
      cerrarTicket()
      return
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.add({ severity: 'success', summary: 'Copiado', detail: 'Ticket copiado al portapapeles. Pega donde quieras compartirlo.', life: 4000 })
      cerrarTicket()
      return
    } catch {
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = nombreArchivo
      a.click()
      toast.add({ severity: 'success', summary: 'Descargado', detail: 'No se pudo copiar al portapapeles. El ticket se descargo como imagen.', life: 4000 })
      cerrarTicket()
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      toast.add({ severity: 'error', summary: 'Error', detail: e.message || 'Error al generar imagen', life: 3000 })
    }
  } finally {
    container?.remove()
  }
}

function enviarCorreo() {
  const d = ticketData.value
  if (!d) return
  const email = clienteSeleccionado.value?.email || ''
  const asunto = encodeURIComponent(`Factura ${d.no_factura}`)
  const cuerpo = encodeURIComponent(
    `Factura: ${d.no_factura}\nCliente: ${d.cliente}\nTotal: RD$${d.total?.toFixed(2)}\nFecha: ${d.fecha}\n\nGracias por su compra.`
  )
  window.open(`mailto:${email}?subject=${asunto}&body=${cuerpo}`, '_blank')
  dialogPrintChoice.value = false
  cerrarTicket()
}

function cerrarTicket() {
  dialogTicket.value = false
  ticketData.value = null
  limpiarCarrito()
}

function getTicketBody(d: any): string {
  if (!d) return ''
  const cfg = ticketConfig.value
  const fmt = (n: number) =>
    Number(n || 0).toFixed(2)

  const emp = d.empresa || {}

  const parts: string[] = []
  if (isTicketOptionOn(cfg.show_address) && emp.direccion) parts.push(emp.direccion)
  const phoneEmail: string[] = []
  if (isTicketOptionOn(cfg.show_phone) && emp.telefono) phoneEmail.push(emp.telefono)
  if (isTicketOptionOn(cfg.show_email) && emp.email) phoneEmail.push(emp.email)
  if (phoneEmail.length) parts.push(phoneEmail.join(' / '))
  if (isTicketOptionOn(cfg.show_legal) && emp.rnc) parts.push(`RNC: ${emp.rnc}`)
  const companyInfoHtml = parts.length
    ? parts.join('<br>')
    : ''

  const logoHtml = isTicketOptionOn(cfg.show_logo) && emp.logo
    ? `<div class="logos" style="text-align:center;"><img src="${emp.logo}" style="max-width:100px" alt="Logo" /></div>`
    : ''
  const companyNameHtml = isTicketOptionOn(cfg.show_company_name)
    ? `<div style="font-size:18px !important;font-weight:bold">${emp.nombre || 'MI EMPRESA'}</div>`
    : ''

  const itemsHtml = d.items.map((item: any) => {
    const nombre = `${item.nombre || ''}${item.color ? ` ${item.color}` : ''}${item.capacidad ? ` ${item.capacidad}` : ''}`
    const imei = item.imei ? `<br><span style="font-size:8px;color:#555;">IMEI: ${item.imei}</span>` : ''
    const serial = item.serial ? `<br><span style="font-size:8px;color:#555;">Serial: ${item.serial}</span>` : ''
    const precioNormal = getPrecioNormal(item)
    const oferta = itemTieneDescuento(item)
      ? `<br><span style="font-size:8px;font-weight:normal;">Normal: <span style="text-decoration:line-through;">RD$${fmt(precioNormal)}</span> &nbsp; Con descuento: <b>RD$${fmt(item.precio || 0)}</b></span>`
      : ''
    return `
      <tr>
        <td colspan="4" style="overflow-wrap: break-word; font-weight: bold; white-space: normal; word-break: break-word;">
          ${nombre}${oferta}${imei}${serial}
        </td>
      </tr>
      <tr>
        <td style="padding-left:20px;">${item.cantidad || 1} x</td>
        <td>${item.empaque || ''}</td>
        <td>RD$${fmt(item.precio || 0)}</td>
        <td class="precio centrado" style="text-align:right;"><b>RD$${fmt((item.precio || 0) * (item.cantidad || 1))}</b></td>
      </tr>
    `
  }).join('')

  const pagoLabel = {
    EFECTIVO: 'EFECTIVO',
    TARJETA: 'TARJETA',
    TRANSFERENCIA: 'TRANSFERENCIA',
    CHEQUE: 'CHEQUE',
    MIXTO: 'MIXTO',
  }[(d.metodo_pago || 'EFECTIVO')] || d.metodo_pago

  return `
<center id="top">
  ${logoHtml}
  ${companyNameHtml}
  ${companyInfoHtml ? `<div class="info"><p>${companyInfoHtml}</p></div>` : ''}
</center>

<div id="mid" class="bordeado">
  <div class="info">
    <div class="left-column1">
      <p>
        Fecha: ${d.fecha || ''}<br>
        DOC: <b style="font-size:16px">#${d.no_factura || ''}</b><br>
        ${d.ncf ? `NCF: ${d.ncf}<br>` : ''}
        ${isTicketOptionOn(cfg.show_cliente) ? `CLIENTE: ${d.cliente || 'SIN REGISTRO'}<br>` : ''}
        ${isTicketOptionOn(cfg.show_cliente) && d.telefono ? `TELEFONO: ${d.telefono}<br>` : ''}
        CAJERO: POS<br>
        METODO DE PAGO: ${pagoLabel}
      </p>
    </div>
  </div>
</div>

<div class="bordeado" style="text-align:center;padding:3px">
  ${d.tipo_comprobante || 'FACTURA DE VENTA'}
</div>

${isTicketOptionOn(cfg.show_items) ? `<table cellspacing="0" cellpadding="0">
  <thead>
    <tr>
      <th style="text-align:left;padding-top:5px;padding-bottom:5px;">CANT.</th>
      <th class="precio" style="text-align:left;padding-top:5px;padding-bottom:5px;">EMPAQ.</th>
      <th class="precio" style="text-align:left;padding-top:5px;padding-bottom:5px;">PRECIO</th>
      <th class="precio centrado" style="text-align:right;padding-top:5px;padding-bottom:5px;">TOTAL</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>` : ''}

${isTicketOptionOn(cfg.show_totals) ? `<div class="linea" style="margin-top:30px;"></div>

<div style="font-weight:bold;">
  <table style="width:100%;border-collapse:collapse">
    <tr><td>SUBTOTAL:</td><td style="text-align:right;"><span style="font-size:1.5em !important;margin-top:5px;margin-bottom:5px;">RD$${fmt(d.subtotal)}</span></td></tr>
    ${d.descuento > 0 ? `<tr><td>DESCUENTO:</td><td style="text-align:right;"><span style="font-size:1.5em !important;margin-top:5px;margin-bottom:5px;">RD$${fmt(d.descuento)}</span></td></tr>` : ''}
    ${d.impuesto > 0 ? `<tr><td>ITBIS:</td><td style="text-align:right;"><span style="font-size:1.5em !important;margin-top:5px;margin-bottom:5px;">RD$${fmt(d.impuesto)}</span></td></tr>` : `<tr><td style="color:#999">ITBIS:</td><td style="text-align:right;color:#999">${d.impuesto_incluido === 2 ? 'Sin impuesto' : 'Incluido'}</td></tr>`}
  </table>
  <table style="width:100%;border-collapse:collapse">
    <tr><td>TOTAL:</td><td style="text-align:right;"><span style="font-size:1.5em !important;margin-top:5px;margin-bottom:5px;">RD$${fmt(d.total)}</span></td></tr>
  </table>
</div>

<div style="font-weight:bold;">
  <table style="width:100%;border-collapse:collapse">
    <tr><td>PAGO CON:</td><td style="text-align:right;"><span style="font-size:1.5em !important;margin-top:5px;margin-bottom:5px;">RD$${fmt(d.total)}</span></td></tr>
    <tr><td>SU CAMBIO:</td><td style="text-align:right;"><span style="font-size:1.5em !important;margin-top:5px;margin-bottom:5px;">RD$0.00</span></td></tr>
  </table>
</div>` : ''}

${isTicketOptionOn(cfg.show_nota) && d.nota ? `<div class="bordeado" style="min-height:30px;margin:4px 0"><p style="font-size:9px;margin:0">${d.nota.replace(/\n/g, '<br>')}</p></div>` : ''}
${isTicketOptionOn(cfg.show_barcode) ? `<div class="barcode" style="text-align:center;margin:6px 0"><div style="display:inline-block;border:1px solid #000;border-radius:5px;padding:3px;overflow:hidden">${generarBarcodeSVG(d.no_factura || '')}</div></div>` : ''}
${isTicketOptionOn(cfg.show_qr) && d.qr ? `<div id="qrcode" class="qr-code"><center><div class="bordeado2"><img src="${d.qr}" alt="Codigo QR" width="150" height="150"/></div></center></div>` : ''}
${isTicketOptionOn(cfg.show_footer) ? `<div class="linea" style="margin-top:8px;"></div><div style="text-align:center;">${cfg.footer_text || ''}</div>` : ''}`
}

function generarTicketHTML(): string {
  const paperWidth = Number(ticketConfig.value.paper_width || 80)
  const pageWidth = paperWidth === 58 ? 230 : 300
  const bodyWidth = paperWidth === 58 ? 210 : 250
  const ticketWidth = paperWidth === 58 ? 200 : 240
  const ticketStyles = `
    * { font-size: 10px; font-family: Arial, Helvetica, sans-serif; }
    @page { size: ${pageWidth}px auto; margin: 5px; }
    html, body { background-color: #ffffff; }
    body { width: ${bodyWidth}px; margin: 5px; padding: 5px; background-color: #ffffff; color: #000; }
    th { text-align: left; padding: 5px; border-bottom: 1px solid #000; }
    th.centrado { text-align: center; }
    th.precio { text-align: right; }
    .ticket { width: ${ticketWidth}px; padding-top: 10px; padding-bottom: 10px; }
    thead { border-bottom: 2px solid #000; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; }
    td, th { width: ${ticketWidth}px; }
    .bordeado2 { border: 1px solid #000000; border-radius: 5px; padding: 3px; max-width: 150px; margin-top: 5px; }
    .centrado { text-align: center; align-content: center; }
    .derecha { text-align: right; }
    .linea { width: 100%; border-top: 1px solid #000; padding-top: 5px; padding-bottom: 5px; margin-bottom: 5px; padding-right: 10px; }
    .bordeado { border: 1px solid #000000; border-radius: 5px; padding-left: 5px; }
    .info { display: flex; justify-content: space-between; align-items: flex-start; }
    .logos img { display: block; margin-left: auto; margin-right: auto; }
  `

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket</title>
  <style>${ticketStyles}</style>
</head>
<body><div class="ticket">${getTicketBody(ticketData.value)}</div></body></html>`
}

function getTicketPreviewHTML(): string {
  return `<style>
    * { font-size: 10px; font-family: Arial, Helvetica, sans-serif; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; }
    th { text-align: left; padding: 5px; border-bottom: 1px solid #000; }
    td, th { width: 240px; }
    .ticket { width: 240px; padding-top: 10px; padding-bottom: 10px; }
    .bordeado { border: 1px solid #000000; border-radius: 5px; padding-left: 5px; }
    .bordeado2 { border: 1px solid #000000; border-radius: 5px; padding: 3px; max-width: 150px; margin-top: 5px; }
    .centrado { text-align: center; align-content: center; }
    .linea { width: 100%; border-top: 1px solid #000; padding-top: 5px; padding-bottom: 5px; margin-bottom: 5px; padding-right: 10px; }
    .info { display: flex; justify-content: space-between; align-items: flex-start; }
    .logos img { display: block; margin-left: auto; margin-right: auto; }
  </style><div class="ticket">${getTicketBody(ticketData.value)}</div>`
}

async function imprimirTicket() {
  const html = generarTicketHTML()
  try {
    const res = await window.electron.invoke('print:ticket', html, printerName.value || undefined)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Imprimiendo...', detail: 'Ticket enviado a la impresora', life: 2000 })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo imprimir', life: 3000 })
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al imprimir', life: 3000 })
  }
  cerrarTicket()
}

function generarBarcodeSVG(data: string): string {
  if (!data) return ''
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, data, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 2,
    })
    let svgStr = new XMLSerializer().serializeToString(svg)
    svgStr = svgStr.replace(/width="[^"]*"/, 'width="180"').replace(/height="[^"]*"/, 'height="55"')
    return svgStr
  } catch {
    return ''
  }
}

function limpiarCarrito() {
  cart.value = []
  descuentoFijo.value = 0
  descuentoPorc.value = 0
  descuentoValor.value = 0
  descuentoTipo.value = 'fijo'
  montoRecibido.value = 0
  nota.value = ''
  noFactura.value = ''
  esCotizacion.value = false
  metodoPago.value = 'EFECTIVO'
  clienteSeleccionado.value = null
  localStorage.removeItem(POS_STORAGE_KEY)
}

function generarNoFactura() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `F-${y}${m}${d}-${h}${min}${s}`
}

function cerrarPdfDialog() {
  pdfUrl.value = ''
  dialogPdf.value = false
}

async function generarPdfCotizacion(invoiceNo: string, ncf: string, compTipo: string, fechaStr: string, horaStr: string) {
  const fmt = (n: number) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const itemsHtml = cart.value.map((item: any) => {
    const nombre = item.nombre || ''
    const cant = item.cantidad || 1
    const precio = item.precio || 0
    const imei = item.imei ? `<br><span style="font-size:9px;color:#666">IMEI: ${item.imei}</span>` : ''
    const serial = item.serial ? `<br><span style="font-size:9px;color:#666">Serial: ${item.serial}</span>` : ''
    const extra = imei || serial
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd;font-size:10px;text-align:center">${cant}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;font-size:10px">${nombre}${extra ? '' : ''}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;font-size:10px;text-align:right">${fmt(precio)}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;font-size:10px;text-align:right;font-weight:bold">${fmt(precio * cant)}</td></tr>${extra ? `<tr><td colspan="2" style="padding:0 8px 4px 8px;font-size:9px;color:#666">${extra}</td><td></td><td></td></tr>` : ''}`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>COTIZACION ${invoiceNo}</title>
  <style>
    * { font-family: Arial, sans-serif; font-size: 11px; }
    body { padding: 20mm 15mm; color: #333; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; color: #2563eb; }
    .header p { margin: 3px 0; font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #2563eb; color: #fff; padding: 7px 8px; font-size: 10px; text-align: left; }
    td { padding: 5px 8px; font-size: 10px; border-bottom: 1px solid #eee; }
    .info-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; margin: 10px 0; }
    .total-box { background: #f8fafc; border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; margin: 10px 0; }
    .footer { text-align: center; font-size: 9px; color: #999; margin-top: 25px; border-top: 1px solid #ddd; padding-top: 10px; }
    .validez { text-align: center; font-size: 10px; color: #666; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>COTIZACION</h1>
    <p><strong>${empresaNombre.value || 'MI EMPRESA'}</strong></p>
    ${empresaRnc.value ? `<p>RNC: ${empresaRnc.value}</p>` : ''}
    ${empresaDireccion.value ? `<p>${empresaDireccion.value}</p>` : ''}
    ${empresaTelefono.value ? `<p>Tel: ${empresaTelefono.value}</p>` : ''}
  </div>

  <div class="info-box">
    <table>
      <tr><td style="width:25%;font-weight:bold;border:none">No. Cotizacion:</td><td style="border:none">${invoiceNo}</td></tr>
      <tr><td style="font-weight:bold;border:none">Fecha:</td><td style="border:none">${fechaStr} ${horaStr}</td></tr>
      <tr><td style="font-weight:bold;border:none">Cliente:</td><td style="border:none">${(clienteExpress.value || clienteSeleccionado.value?.nombre || 'CONSUMIDOR FINAL').toUpperCase()}</td></tr>
      ${clienteSeleccionado.value?.telefono ? `<tr><td style="font-weight:bold;border:none">Telefono:</td><td style="border:none">${clienteSeleccionado.value.telefono}</td></tr>` : ''}
      ${ncf ? `<tr><td style="font-weight:bold;border:none">NCF:</td><td style="border:none">${ncf}</td></tr>` : ''}
    </table>
  </div>

  <table>
    <thead><tr><th style="text-align:center;width:8%">Cant</th><th>Descripcion</th><th style="text-align:right;width:15%">Precio</th><th style="text-align:right;width:20%">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="total-box">
    <table>
      <tr><td style="border:none;text-align:right;font-size:11px"><strong>Subtotal:</strong></td><td style="border:none;text-align:right;font-size:11px;width:120px">${fmt(subtotal.value)}</td></tr>
      ${descuento.value > 0 ? `<tr><td style="border:none;text-align:right;font-size:11px"><strong>Descuento:</strong></td><td style="border:none;text-align:right;font-size:11px;color:#c00">-${fmt(descuento.value)}</td></tr>` : ''}
      <tr><td style="border:none;text-align:right;font-size:11px"><strong>ITBIS:</strong></td><td style="border:none;text-align:right;font-size:11px">${fmt(impuestoMonto.value)}</td></tr>
      <tr><td style="border-top:2px solid #333;text-align:right;font-size:14px;font-weight:bold">TOTAL</td><td style="border-top:2px solid #333;text-align:right;font-size:14px;font-weight:bold">${fmt(total.value)}</td></tr>
    </table>
  </div>

  <div class="validez">Esta cotizacion tiene una validez de 15 dias</div>

  <div class="footer">
    Cotizacion generada por MrCuttiTechnology - ${fechaStr}
  </div>
</body>
</html>`

  try {
    const res = await window.electron.invoke('generate:pdf', html, `Cotizacion_${invoiceNo}.pdf`)
    if (res.success && res.dataUrl) {
      const resp = await fetch(res.dataUrl)
      const blob = await resp.blob()
      pdfUrl.value = URL.createObjectURL(blob)
      dialogPdf.value = true
    }
  } catch (_) {}
}

async function confirmarVenta() {
  if (cart.value.length === 0) {
    toast.add({ severity: 'warn', summary: 'Carrito vacio', detail: 'Agrega productos al carrito', life: 3000 })
    return
  }
  if (total.value <= 0) {
    toast.add({ severity: 'warn', summary: 'Total invalido', detail: 'El total debe ser mayor a 0', life: 3000 })
    return
  }
  if (!esCotizacion.value && comprobanteSeleccionado.value?.tipo === 'E31' && !clienteSeleccionado.value?.rnc) {
    toast.add({ severity: 'warn', summary: 'Cliente requerido', detail: 'E31 requiere cliente con RNC', life: 3000 })
    return
  }
  montoRecibido.value = total.value
  clienteExpress.value = ''
  confirmPago.value = true
}

watch(comprobanteSeleccionado, (comp) => {
  if (comp?.tipo === 'SIN') {
    impuestoPorcentaje.value = 0
    impuestoIncluido.value = 2
  } else if (comp) {
    impuestoPorcentaje.value = impuestoPorcentajeOriginal.value
    impuestoIncluido.value = impuestoIncluidoOriginal.value
  }
})

watch(metodoPago, (val) => {
  if (String(val).toLowerCase() === 'mixto') {
    metodosMixto.value = { efectivo: false, tarjeta: false, transferencia: false, cheque: false }
    mixtoEfectivo.value = 0
    mixtoTarjeta.value = 0
    mixtoTransferencia.value = 0
    mixtoCheque.value = 0
    mixtoError.value = ''
    pasoMixto.value = 'elegir'
    dialogMixto.value = true
  }
})

function autoCalcularMixto() {
  if (pasoMixto.value !== 'montos') return
  const ef = Number(mixtoEfectivo.value) || 0
  const tj = Number(mixtoTarjeta.value) || 0
  const tr = Number(mixtoTransferencia.value) || 0
  const ch = Number(mixtoCheque.value) || 0
  const suma = ef + tj + tr + ch
  if (suma >= total.value) return
  const restante = total.value - suma
  const orden = ['efectivo', 'tarjeta', 'transferencia', 'cheque']
  const campos: Record<string, any> = { efectivo: mixtoEfectivo, tarjeta: mixtoTarjeta, transferencia: mixtoTransferencia, cheque: mixtoCheque }
  for (const key of orden) {
    if (metodosMixto.value[key] && Number(campos[key].value) === 0) {
      campos[key].value = restante
      break
    }
  }
}

watch([mixtoEfectivo, mixtoTarjeta, mixtoTransferencia, mixtoCheque], () => {
  autoCalcularMixto()
})

function siguientePasoMixto() {
  const seleccionados = Object.values(metodosMixto.value).filter(Boolean).length
  if (seleccionados < 2) {
    mixtoError.value = 'Selecciona al menos dos metodos de pago'
    return
  }
  mixtoError.value = ''
  pasoMixto.value = 'montos'
}

function confirmarMixto() {
  const ef = Number(mixtoEfectivo.value) || 0
  const tj = Number(mixtoTarjeta.value) || 0
  const tr = Number(mixtoTransferencia.value) || 0
  const ch = Number(mixtoCheque.value) || 0
  const suma = ef + tj + tr + ch
  if (suma <= 0) {
    mixtoError.value = 'Debes ingresar al menos un metodo de pago'
    return
  }
  if (Math.abs(suma - total.value) > 0.01) {
    mixtoError.value = `La suma ($${formatCurrency(suma)}) no coincide con el total ($${formatCurrency(total.value)})`
    return
  }
  mixtoError.value = ''
  dialogMixto.value = false
  confirmPago.value = true
}

async function completarVenta() {
  guardando.value = true
  await recargarConfigVentas()
  try {
    const invoiceNo = noFactura.value.trim() || generarNoFactura()
    const now = new Date()
    const fechaStr = now.toISOString().split('T')[0]
    const horaStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')

    const productosJson = JSON.stringify(cart.value.map(item => ({
      tipo: item.tipo,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio,
      precio_normal: item.precio_normal || item.precio,
      costo: item.costo || 0,
      imei: item.imei || '',
      imei_id: item.imei_id || null,
      serial: item.serial || '',
      serial_id: item.serial_id || null,
      color: item.color || '',
      capacidad: item.capacidad || '',
      accesorio_id: item.accesorio_id || null,
      stock: item.stock || 0,
    })))

    const comp = comprobanteSeleccionado.value
    let ncf = ''
    let compId = 0
    let compTipo = ''

    if (comp && comp.tipo !== 'SIN') {
      const sec = String(comp.secuencia_actual || 1).padStart(8, '0')
      ncf = `${comp.prefijo || comp.tipo}${sec}`
      compId = comp.id
      compTipo = comp.tipo
    }

    let turnoId = 0
    try {
      const turnoRes = await (window as any).electron.invoke('caja:getTurnoActivo')
      if (turnoRes.success && turnoRes.data) turnoId = turnoRes.data.id
    } catch {}
    const almacenStore = useAlmacenStore()

    const facturaData = {
      turno_id: turnoId,
      almacen_id: almacenStore.activeId || 0,
      no_factura: invoiceNo,
      tipo_factura: esCotizacion.value ? 'COTIZACION' : 'FACTURA_VENTA',
      cod_cliente: clienteSeleccionado.value?.id?.toString() || '',
      nombre_cliente: (clienteExpress.value || clienteSeleccionado.value?.nombre || 'CONSUMIDOR FINAL').toUpperCase(),
      telefono_cliente: clienteSeleccionado.value?.telefono || '',
      productos: productosJson,
      metodo_pago: metodoPago.value,
      efectivo: metodoPago.value === 'EFECTIVO' ? total.value : String(metodoPago.value).toLowerCase() === 'mixto' ? Number(mixtoEfectivo.value) || 0 : 0,
      tarjeta: metodoPago.value === 'TARJETA' ? total.value : String(metodoPago.value).toLowerCase() === 'mixto' ? Number(mixtoTarjeta.value) || 0 : 0,
      transferencia: metodoPago.value === 'TRANSFERENCIA' ? total.value : String(metodoPago.value).toLowerCase() === 'mixto' ? Number(mixtoTransferencia.value) || 0 : 0,
      cheque: String(metodoPago.value).toLowerCase() === 'mixto' ? Number(mixtoCheque.value) || 0 : 0,
      canal_venta: 'LOCAL',
      fecha_emision: fechaStr,
      hora: horaStr,
      impuesto: impuestoMonto.value,
      descuento: descuento.value,
      financiera: comisionPorcentaje.value ? JSON.stringify({ comision_porcentaje: comisionPorcentaje.value, metodo: metodoPago.value }) : '',
      subtotal: subtotal.value,
      total: total.value,
      ganancia: gananciaTotal.value,
      estado_factura: 'PAGADA',
      fecha_estado: fechaStr,
      mes: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      nota: nota.value.trim().toUpperCase(),
      usuario: 'POS',
      ncf,
      comprobante: compTipo,
      tipo_comprobante: compTipo,
      comprobante_id: compId,
    }

    const resFactura = await window.db.insert('facturas', facturaData)
    if (!resFactura.success) {
      throw new Error(resFactura.error || 'Error al crear factura')
    }

    if (esCotizacion.value) {
      facturaData.estado_factura = 'COTIZACION'
      await window.db.update('facturas', resFactura.data.id, { estado_factura: 'COTIZACION' })
    } else if (metodoPago.value === 'CREDITO') {
      const clienteNombre = (clienteExpress.value || clienteSeleccionado.value?.nombre || 'CONSUMIDOR FINAL').toUpperCase()
      const resCxC = await window.db.insert('cuentas_cobrar', {
        no_factura: invoiceNo,
        cod_cliente: clienteSeleccionado.value?.id?.toString() || '',
        nombre_cliente: clienteNombre,
        telefono_cliente: clienteSeleccionado.value?.telefono || '',
        total: total.value,
        abonado: 0,
        saldo: total.value,
        fecha_venta: fechaStr,
        estado: 'ACTIVA',
        almacen_id: almacenStore.activeId || 0,
      })
      if (resCxC.success) {
        facturaData.estado_factura = 'CREDITO'
        await window.db.update('facturas', resFactura.data.id, { estado_factura: 'CREDITO' })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la cuenta por cobrar: ' + (resCxC.error || ''), life: 4000 })
      }
    }

    if (!esCotizacion.value) {
      if (comp && comp.tipo !== 'SIN') {
        await window.db.update('comprobantes_fiscales', comp.id, {
          secuencia_actual: (comp.secuencia_actual || 1) + 1,
        })
        comp.secuencia_actual = (comp.secuencia_actual || 1) + 1
      }

      for (const item of cart.value) {
        if (item.tipo === 'imei' && item.imei_id) {
          await window.db.update('imei', item.imei_id, {
            estado: 'VENDIDO',
            comprador: clienteSeleccionado.value?.nombre?.toUpperCase() || 'CONSUMIDOR FINAL',
            no_factura: invoiceNo,
            precio_vendido: item.precio,
            fecha_venta: fechaStr,
            hora_venta: horaStr,
          })
          sincronizarImeiVendido(item.imei_id, {
            estado: 'VENDIDO',
            comprador: clienteSeleccionado.value?.nombre?.toUpperCase() || 'CONSUMIDOR FINAL',
            no_factura: invoiceNo,
            precio_vendido: item.precio,
            fecha_venta: fechaStr,
            hora_venta: horaStr,
          })
        }

        if (item.tipo === 'serial' && item.serial_id) {
          await window.db.update('serial', item.serial_id, {
            estado: 'VENDIDO',
            comprador: clienteSeleccionado.value?.nombre?.toUpperCase() || 'CONSUMIDOR FINAL',
            no_factura: invoiceNo,
            precio_vendido: item.precio,
            fecha_venta: fechaStr,
            hora_venta: horaStr,
          })
        }

        if (item.tipo === 'accesorio' && item.accesorio_id) {
          const acc = accesorios.value.find((a: any) => a.id === item.accesorio_id)
          if (acc) {
            const nuevoStock = Math.max(0, (acc.cantidad || 0) - item.cantidad)
            await window.db.update('accesorios', item.accesorio_id, { cantidad: nuevoStock })
            acc.cantidad = nuevoStock
          }
        }
      }
    }

    confirmPago.value = false
    ticketInvoiceNo.value = invoiceNo

    const qrUrl = `https://tmposrd.com/factura/${invoiceNo}`
    let qrDataUrl = ''
    try {
      qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
    } catch (_) {}

    ticketData.value = {
      no_factura: invoiceNo,
      ncf,
      tipo_factura: esCotizacion.value ? 'COTIZACION' : 'FACTURA_VENTA',
      tipo_comprobante: compTipo,
      fecha: `${fechaStr} ${horaStr}`,
      cliente: (clienteExpress.value || clienteSeleccionado.value?.nombre || 'CONSUMIDOR FINAL').toUpperCase(),
      telefono: clienteSeleccionado.value?.telefono || clienteSeleccionado.value?.whatsapp || '',
      items: JSON.parse(JSON.stringify(cartConComision.value.map((item: any) => {
        const i = { ...item }
        delete i.precioOriginal
        return i
      }))),
      subtotal: subtotal.value,
      descuento: descuento.value,
      impuesto: impuestoMonto.value,
      impuesto_incluido: impuestoIncluido.value,
      total: total.value,
      nota: nota.value,
      metodo_pago: metodoPago.value,
      empresa: {
        nombre: empresaNombre.value,
        rnc: empresaRnc.value,
        telefono: empresaTelefono.value,
        direccion: empresaDireccion.value,
        email: empresaEmail.value,
        logo: empresaLogo.value,
      },
      qr: qrDataUrl,
    }

    if (esCotizacion.value) {
      toast.add({ severity: 'success', summary: 'Cotizacion creada', detail: `Cotizacion ${invoiceNo}`, life: 2000 })
      if (ticketData.value) {
        facturaPdfRef.value?.printFactura(ticketData.value)
        setTimeout(() => { dialogTicket.value = true }, 500)
      }
      nota.value = ''
      limpiarCarrito()
      await cargarImeisDisponibles()
      return
    }

    toast.add({ severity: 'success', summary: 'Venta completada', detail: `Factura ${invoiceNo}`, life: 4000 })

    if (!esCotizacion.value) {
      try {
        const totalVenta = Number(totalConComision?.value || total.value)
        if (auth.user?.nombre) {
          await (window as any).electron.invoke('db:insert', 'comisiones', {
            factura_id: resFactura.data.id, no_factura: invoiceNo,
            vendedor: auth.user.nombre, vendedor_id: auth.user.id || 0,
            total_venta: totalVenta, porcentaje: 0, monto: 0,
            estado: 'PENDIENTE', almacen_id: almacenStore.activeId || 0,
          })
        }
      } catch (_) {}
      dialogPrintChoice.value = true
    }
    nota.value = ''
    limpiarCarrito()
    await cargarImeisDisponibles()
    if (!esCotizacion.value) {
      await encolarSync(invoiceNo, ticketData.value)
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Error al completar venta', life: 4000 })
  } finally {
    guardando.value = false
  }
}

async function encolarSync(invoiceNo: string, _data: any) {
  try {
    const configRes = await window.db.getAll('servidor_sync_config')
    const config = configRes.success && configRes.data?.length > 0 ? configRes.data[0] : null
    if (!config || !config.activo) return
    const facturaRes = await window.db.getAll('facturas')
    if (!facturaRes.success || !facturaRes.data) return
    const factura = facturaRes.data.find((f: any) => f.no_factura === invoiceNo)
    if (!factura) return
    const payload = JSON.stringify(factura)
    await window.db.insert('sync_queue', { tipo: 'factura', no_factura: invoiceNo, datos: payload, created_at: new Date().toISOString(), estado: 'pendiente' })
    await sincronizarItem({ no_factura: invoiceNo, datos: payload, tipo: 'factura' }, config)
  } catch (_) {}
}

async function sincronizarImeiVendido(imeiId: number, datos: any) {
  try {
    const cfgRes = await window.db.getAll('servidor_sync_config')
    const cfg = cfgRes.success && cfgRes.data?.length > 0 ? cfgRes.data[0] : null
    if (!cfg || !cfg.activo) return
    const tablasSync: string[] = cfg.tablas_sync ? JSON.parse(cfg.tablas_sync) : []
    if (!tablasSync.includes('imei')) return
    const baseUrl = String(cfg.servidor_url || '').replace(/\/+$/, '') + (String(cfg.api_path || '/api2')).replace(/\/+$/, '')
    const tokenRaw = cfg.token_hash || '1234567890abc'
    const token = tokenRaw.startsWith('$2b$') ? tokenRaw : await encryptarPassword(tokenRaw, 10)
    const imeiRes = await window.db.getById('imei', imeiId)
    if (!imeiRes.success || !imeiRes.data) return
    const imei = imeiRes.data
    const empresaRes = await window.db.getAll('empresa')
    const almacen = (empresaRes.success && empresaRes.data?.[0]?.nombre) || ''
    const campos = ['id','almacen','imei','estado','fecha','equipo','proveedor','id_equi','costo','precio_venta','factura','no_compra','fecha_venta','hora_venta','comprador','detalles','usuario','created_at','updated_at','identificadordb','marca','modelo','preciocompra','precioventa','vendedor','cedula','telefono','direccion','nota','precio_compra','precio_min','precio_xmayor','ganancia','no_factura','bateria','capacidad']
    const enviar: Record<string, any> = {
      almacen, imei: String(imei.nombre || ''), estado: 'VENDIDO',
      fecha: new Date().toLocaleDateString('es-DO'), equipo: '', proveedor: String(imei.proveedor || ''),
      id_equi: String(imei.id_equi || ''), costo: String(imei.costo || '0'),
      precio_venta: String(datos.precio_vendido || imei.precio_venta || '0'),
      factura: String(datos.no_factura || ''), no_compra: String(imei.no_compra || ''),
      fecha_venta: String(datos.fecha_venta || ''), hora_venta: String(datos.hora_venta || ''),
      comprador: String(datos.comprador || ''), detalles: '', usuario: '', marca: '', modelo: '',
      preciocompra: String(imei.costo || '0'), precioventa: String(datos.precio_vendido || imei.precio_venta || '0'),
      vendedor: '', cedula: '', telefono: '', direccion: '', nota: String(imei.nota || ''),
      precio_compra: String(imei.costo || '0'), precio_min: String(imei.precio_min || '0'),
      precio_xmayor: String(imei.precio_xmayor || '0'), ganancia: '',
      no_factura: String(datos.no_factura || ''), bateria: String(imei.bateria || ''),
      capacidad: String(imei.capacidad || ''),
    }
    for (const key of Object.keys(enviar)) { if (!campos.includes(key)) delete enviar[key] }
    if (Object.keys(enviar).length === 0) return
    const existeRes = await fetch(`${baseUrl}/datoscampo/imei/imei/${encodeURIComponent(imei.nombre || '')}`, { method: 'GET', headers: { 'Accept': '*/*', 'Authorization': token } })
    let servidorId: string | null = null
    if (existeRes.ok) {
      try { const d = await existeRes.json(); const e = Array.isArray(d) ? d[0] : d?.data || d; if (e?.id) servidorId = String(e.id) } catch {}
    }
    if (servidorId) { enviar.id = servidorId; await fetch(`${baseUrl}/actualizarcampos/imei`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token }, body: JSON.stringify(enviar) }) }
    else { await fetch(`${baseUrl}/insertar/imei`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token }, body: JSON.stringify(enviar) }) }
  } catch {}
}

async function sincronizarItem(item: any, config: any) {
  try {
    const baseUrl = String(config.servidor_url || '').replace(/\/+$/, '') + (String(config.api_path || '/api2')).replace(/\/+$/, '')
    const tokenRaw = config.token_hash || '1234567890abc'
    const token = tokenRaw.startsWith('$2b$') ? tokenRaw : await encryptarPassword(tokenRaw, 10)

    const camposRes = await fetch(`${baseUrl}/campos/${item.tipo === 'factura' ? 'facturas' : item.tipo}`, {
      method: 'GET', headers: { 'Accept': '*/*', 'Authorization': token },
    })
    if (!camposRes.ok) return
    const camposArr = await camposRes.json()
    const campos: string[] = (Array.isArray(camposArr) ? camposArr : []).map((c: any) => typeof c === 'string' ? c : (c.nombre || c.field || c.Field || ''))

    let datos: any = item.datos
    if (typeof datos === 'string') try { datos = JSON.parse(datos) } catch {}

    if (datos.productos && typeof datos.productos === 'string') {
      try { JSON.parse(datos.productos); } catch { datos.productos = JSON.stringify(datos.productos) }
    } else if (datos.productos && typeof datos.productos !== 'string') {
      datos.productos = JSON.stringify(datos.productos)
    }
    if (datos.otro && typeof datos.otro !== 'string') {
      datos.otro = JSON.stringify(datos.otro)
    }

    const enviar: Record<string, any> = {}
    for (const campo of campos) {
      if (campo === 'id') continue
      if (datos[campo] !== undefined && datos[campo] !== null && datos[campo] !== '') {
        enviar[campo] = String(datos[campo])
      }
    }

    const existeRes = await fetch(`${baseUrl}/datoscampo/facturas/no_factura/${encodeURIComponent(datos.no_factura || '')}`, {
      method: 'GET', headers: { 'Accept': '*/*', 'Authorization': token },
    })
    let servidorId: string | null = null
    if (existeRes.ok) {
      try {
        const existeData = await existeRes.json()
        const existente = Array.isArray(existeData) ? existeData[0] : existeData?.data || existeData
        if (existente?.id) servidorId = String(existente.id)
      } catch {}
    }

    let syncRes: Response
    if (servidorId) {
      enviar.id = servidorId
      syncRes = await fetch(`${baseUrl}/actualizarcampos/facturas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token },
        body: JSON.stringify(enviar),
      })
    } else {
      syncRes = await fetch(`${baseUrl}/insertar/facturas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token },
        body: JSON.stringify(enviar),
      })
    }
    if (syncRes.ok) {
      const queueRes = await window.db.getAll('sync_queue')
      if (queueRes.success && queueRes.data) {
        const pendiente = queueRes.data.find((q: any) => q.no_factura === item.no_factura && q.estado === 'pendiente')
        if (pendiente) await window.db.update('sync_queue', pendiente.id, { estado: 'sincronizado' })
      }
    } else {
      const texto = await syncRes.text().catch(() => '')
      const queueRes = await window.db.getAll('sync_queue')
      if (queueRes.success && queueRes.data) {
        const pendiente = queueRes.data.find((q: any) => q.no_factura === item.no_factura && q.estado === 'pendiente')
        if (pendiente) await window.db.update('sync_queue', pendiente.id, { error: texto.slice(0, 500) })
      }
    }
  } catch (_) {}
}

onMounted(async () => {
  try {
    const datosJSON = await envioElectron('datosarchivo')
    if (datosJSON) {
      link.value = datosJSON.VITE_LINKURL || ''
      api.value = datosJSON.VITE_LINK_API || ''
      token.value = datosJSON.VITE_TOKEN || ''
    }
  } catch (error) {
    console.error('Error cargando configuracion:', error)
  }

  loading.value = true
  await Promise.all([cargarProductos(), cargarImeisDisponibles()])
  await cargarEstado()

  try {
    const res = await window.db.getAll('impresoras_config')
    if (res.success && res.data?.length > 0) {
      ticketConfig.value = { ...ticketConfig.value, ...res.data[0] }
      printerName.value = ticketConfig.value.printer_name || ''
    }
  } catch (_) {}

  try {
    const resEmp = await window.db.getAll('empresa')
    if (resEmp.success && resEmp.data?.length > 0) {
      const e = resEmp.data[0]
      empresaNombre.value = e.nombre || 'MI EMPRESA'
      empresaRnc.value = e.legal || ''
      empresaTelefono.value = e.telefono || ''
      empresaDireccion.value = e.direccion || ''
      empresaEmail.value = e.email || ''
      empresaLogo.value = e.logo || ''
      empresaTipoDoc.value = e.tipo_documento_defecto || ''
    }
  } catch (_) {}

  try {
    const resComp = await window.db.getAll('comprobantes_fiscales')
    if (resComp.success) {
      comprobantes.value = (resComp.data || []).filter((c: any) => c.activo)

      const tipoDocMap: Record<string, string> = {
        SIN_COMPROBANTE: 'SIN',
        FACTURA_CONSUMO: 'E32',
        FACTURA_CREDITO: 'E31',
        NOTA_DEBITO: 'E33',
        NOTA_CREDITO: 'E34',
        PROFORMA: 'SIN',
        TICKET: 'SIN',
      }
      const tipoDefecto = empresaTipoDoc.value || ''
      const compTipoDefecto = tipoDocMap[tipoDefecto]
      const compDefecto = compTipoDefecto
        ? comprobantes.value.find((c: any) => c.tipo === compTipoDefecto)
        : null

      const defaultComp = compDefecto || comprobantes.value.find((c: any) => c.es_default)
      if (defaultComp) comprobanteSeleccionado.value = defaultComp
      else if (comprobantes.value.length > 0) comprobanteSeleccionado.value = comprobantes.value[0]
    }
  } catch (_) {}

  try {
    const resMP = await (window as any).electron.invoke('db:getAll', 'metodos_pago')
    if (resMP.success && resMP.data) metodosPagoDB.value = resMP.data
  } catch (_) {}

  loading.value = false

  if (!noFactura.value) noFactura.value = generarNoFactura()
})

function abrirDialogDescuento() {
  descuentoValor.value = descuentoTipo.value === 'porcentaje' ? descuentoPorc.value : descuentoFijo.value
  notaCreditoSeleccionada.value = null
  cargarNotasCreditoCliente()
  dialogDescuento.value = true
}

async function cargarNotasCreditoCliente() {
  const clienteNombre = (clienteSeleccionado.value?.nombre || '').toUpperCase().trim()
  const clienteId = clienteSeleccionado.value?.id ? String(clienteSeleccionado.value.id) : ''
  if (!clienteNombre && !clienteId) { notasCreditoCliente.value = []; return }
  try {
    const res = await window.db.getAll('facturas')
    if (res.success) {
      notasCreditoCliente.value = (res.data || []).filter((f: any) =>
        f.tipo_factura === 'NOTA_CREDITO' &&
        f.estado_factura === 'PENDIENTE' &&
        (
          (clienteId && String(f.cod_cliente || '') === clienteId) ||
          (clienteNombre && String(f.nombre_cliente || '').toUpperCase() === clienteNombre)
        )
      )
    }
  } catch { notasCreditoCliente.value = [] }
}

function seleccionarNotaCredito(nota: any) {
  notaCreditoSeleccionada.value = nota
  descuentoTipo.value = 'nota_credito'
  descuentoValor.value = Number(nota.total) || 0
}

async function aplicarDescuento() {
  if (descuentoTipo.value === 'nota_credito' && notaCreditoSeleccionada.value) {
    descuentoFijo.value = Math.min(subtotal.value, Math.max(0, descuentoValor.value))
    await window.db.update('facturas', notaCreditoSeleccionada.value.id, { estado_factura: 'UTILIZADA' })
  } else if (descuentoTipo.value === 'porcentaje') {
    descuentoPorc.value = Math.min(100, Math.max(0, descuentoValor.value))
    descuentoFijo.value = 0
  } else {
    descuentoFijo.value = Math.min(subtotal.value, Math.max(0, descuentoValor.value))
    descuentoPorc.value = 0
  }
  dialogDescuento.value = false
}

function quitarDescuento() {
  descuentoFijo.value = 0
  descuentoPorc.value = 0
  descuentoValor.value = 0
  descuentoTipo.value = 'fijo'
  notaCreditoSeleccionada.value = null
  dialogDescuento.value = false
}
</script>

<template>
  <div class="h-full flex flex-col">
    <Toast />

    <div class="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      <div class="flex-1 min-w-0 flex flex-col">
        <div class="rounded-xl border border-surface-200/50 dark:border-surface-700/30 bg-surface-0 dark:bg-surface-800 flex flex-col flex-1 min-h-0">
          <div class="p-4 pb-0">
            <div class="flex items-center gap-2 mb-4">
              <div class="relative flex-1">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm"></i>
                <InputText v-model="busquedaProd" placeholder="Buscar producto o IMEI..." fluid class="!pl-9 h-10 !pr-9" @keyup.enter="buscarImei" />
                <button
                  v-if="busquedaProd"
                  class="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                  @click="busquedaProd = ''"
                >
                  <i class="pi pi-times text-xs"></i>
                </button>
              </div>
              <Button label="Express" icon="pi pi-bolt" severity="warning" text size="small" class="flex-shrink-0 h-10 font-bold" @click="abrirProductoPersonalizado" />
              <Button
                :label="ocultarSinStock ? 'Con Stock' : 'Todo'"
                :icon="ocultarSinStock ? 'pi pi-eye' : 'pi pi-eye-slash'"
                :severity="ocultarSinStock ? 'primary' : 'secondary'"
                text
                size="small"
                class="flex-shrink-0 h-10"
                @click="ocultarSinStock = !ocultarSinStock"
              />
              <span class="text-xs text-surface-400 whitespace-nowrap">{{ productosFiltrados.length }} resultados</span>
            </div>

            <SelectButton v-model="activeTab" :options="tabOptions" optionLabel="label" optionValue="value" :allowEmpty="false" fluid class="mb-4">
              <template #option="{ option }">
                <div class="flex items-center gap-1.5">
                  <i :class="option.icon" class="text-base"></i>
                  <span>{{ option.label }}</span>
                </div>
              </template>
            </SelectButton>
          </div>

          <div class="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
            <div v-if="loading" class="flex items-center justify-center py-20 text-surface-400 gap-2">
              <i class="pi pi-spin pi-spinner text-lg"></i>
              <span>Cargando...</span>
            </div>

            <div v-else-if="activeTab === 'celulares'">
              <div v-if="productosFiltrados.length === 0" class="flex flex-col items-center justify-center py-20 text-surface-300 gap-2">
                <i class="pi pi-mobile text-4xl"></i>
                <span class="text-sm">No se encontraron telefonos</span>
              </div>
              <div v-else class="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                <div
                  v-for="tel in productosFiltrados"
                  :key="tel.id"
                  class="flip-card perspective-[1000px]"
                >
                  <div
                    class="flip-inner relative transition-transform duration-500 cursor-pointer"
                    :class="flippedTelId === tel.id ? '[transform:rotateY(180deg)]' : ''"
                    style="transform-style: preserve-3d; min-height: 170px;"
                  >
                    <!-- FRONT -->
                    <div
                      class="absolute inset-0 rounded-xl border border-surface-200/60 dark:border-surface-700/60 bg-surface-0 dark:bg-surface-800 p-3.5 flex flex-col gap-2 transition-all duration-200 backface-hidden"
                      @click="abrirVariantes(tel)"
                      @contextmenu.prevent="() => { flippedTelId = flippedTelId === tel.id ? null : tel.id; imeiSearch = '' }"
                    >
                      <div class="flex items-start justify-between">
                        <div class="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm">
                          <i class="pi pi-mobile text-white text-lg"></i>
                        </div>
                        <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          {{ imeisDisponibles.filter(i => i.id_equi === tel.id).length }} disp.
                        </span>
                      </div>
                      <h4 class="font-semibold text-sm leading-snug truncate">{{ tel.nombre }}</h4>
                      <div class="flex items-center justify-between mt-auto pt-1">
                        <span class="text-xs text-surface-400">#{{ tel.id }}</span>
                        <Button icon="pi pi-plus" size="small" severity="info" text rounded class="!w-7 !h-7 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop="abrirVariantes(tel)" />
                      </div>
                    </div>

                    <!-- BACK: IMEIs disponibles -->
                    <div
                      class="absolute inset-0 rounded-xl border border-violet-300 dark:border-violet-600 bg-surface-0 dark:bg-surface-800 p-3 flex flex-col gap-2 backface-hidden overflow-y-auto [transform:rotateY(180deg)]"
                      @contextmenu.prevent="flippedTelId = null"
                    >
                      <div class="flex items-center justify-between shrink-0">
                        <h4 class="font-semibold text-xs truncate">{{ tel.nombre }}</h4>
                        <Button icon="pi pi-times" severity="secondary" text rounded size="small" class="!w-6 !h-6 !text-[10px]" @click="flippedTelId = null" />
                      </div>
                      <div class="relative shrink-0">
                        <i class="pi pi-search absolute left-2 top-1/2 -translate-y-1/2 text-surface-400 text-xs"></i>
                        <input v-model="imeiSearch" placeholder="Buscar IMEI..." class="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/50 outline-none focus:border-primary" @click.stop />
                      </div>
                      <div v-if="imeisDelTel(tel.id).length === 0" class="text-[11px] text-surface-400 text-center py-4">No hay IMEIs disponibles</div>
                      <div
                        v-for="imei in imeisDelTel(tel.id)"
                        :key="imei.id"
                        class="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-50 dark:bg-surface-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors text-xs"
                        @click="flippedTelId = null; seleccionarImeiDirecto(imei)"
                      >
                        <span class="font-mono font-medium truncate">{{ imei.nombre }}</span>
                        <span v-if="imei.precio_venta" class="text-primary font-semibold shrink-0 ml-2">${{ formatCurrency(imei.precio_venta) }}</span>
                      </div>
                      <p class="text-[9px] text-surface-400 text-center mt-auto shrink-0">Click derecho para volver</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'electrodomesticos'">
              <div v-if="productosFiltrados.length === 0" class="flex flex-col items-center justify-center py-20 text-surface-300 gap-2">
                <i class="pi pi-sitemap text-4xl"></i>
                <span class="text-sm">No se encontraron electrodomesticos</span>
              </div>
              <div v-else class="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                <div
                  v-for="elec in productosFiltrados"
                  :key="elec.id"
                  class="flip-card perspective-[1000px]"
                >
                  <div
                    class="flip-inner relative transition-transform duration-500 cursor-pointer"
                    :class="flippedElecId === elec.id ? '[transform:rotateY(180deg)]' : ''"
                    style="transform-style: preserve-3d; min-height: 170px;"
                  >
                    <!-- FRONT -->
                    <div
                      class="absolute inset-0 rounded-xl border border-surface-200/60 dark:border-surface-700/60 bg-surface-0 dark:bg-surface-800 p-3.5 flex flex-col gap-2 transition-all duration-200 backface-hidden"
                      @click="abrirVariantesSerial(elec)"
                      @contextmenu.prevent="() => { flippedElecId = flippedElecId === elec.id ? null : elec.id; elecSearch = '' }"
                    >
                      <div class="flex items-start justify-between">
                        <div class="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center shadow-sm">
                          <i class="pi pi-sitemap text-white text-lg"></i>
                        </div>
                        <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          {{ serialesDisponibles.filter(i => i.id_equi === elec.id).length }} disp.
                        </span>
                      </div>
                      <h4 class="font-semibold text-sm leading-snug truncate">{{ elec.nombre }}</h4>
                      <div class="flex items-center justify-between mt-auto pt-1">
                        <span class="text-xs text-surface-400">#{{ elec.id }}</span>
                        <Button icon="pi pi-plus" size="small" severity="info" text rounded class="!w-7 !h-7 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop="abrirVariantesSerial(elec)" />
                      </div>
                    </div>

                    <!-- BACK: seriales disponibles -->
                    <div
                      class="absolute inset-0 rounded-xl border border-cyan-300 dark:border-cyan-600 bg-surface-0 dark:bg-surface-800 p-3 flex flex-col gap-2 backface-hidden overflow-y-auto [transform:rotateY(180deg)]"
                      @contextmenu.prevent="flippedElecId = null"
                    >
                      <div class="flex items-center justify-between shrink-0">
                        <h4 class="font-semibold text-xs truncate">{{ elec.nombre }}</h4>
                        <Button icon="pi pi-times" severity="secondary" text rounded size="small" class="!w-6 !h-6 !text-[10px]" @click="flippedElecId = null" />
                      </div>
                      <div class="relative shrink-0">
                        <i class="pi pi-search absolute left-2 top-1/2 -translate-y-1/2 text-surface-400 text-xs"></i>
                        <input v-model="elecSearch" placeholder="Buscar serial..." class="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/50 outline-none focus:border-primary" @click.stop />
                      </div>
                      <div v-if="serialesDelElec(elec.id).length === 0" class="text-[11px] text-surface-400 text-center py-4">No hay seriales disponibles</div>
                      <div
                        v-for="serial in serialesDelElec(elec.id)"
                        :key="serial.id"
                        class="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-50 dark:bg-surface-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors text-xs"
                        @click="flippedElecId = null; seleccionarSerialDirecto(serial)"
                      >
                        <span class="font-mono font-medium truncate">{{ serial.nombre }}</span>
                        <span v-if="serial.precio_venta" class="text-primary font-semibold shrink-0 ml-2">${{ formatCurrency(serial.precio_venta) }}</span>
                      </div>
                      <p class="text-[9px] text-surface-400 text-center mt-auto shrink-0">Click derecho para volver</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else>
              <div v-if="productosFiltrados.length === 0" class="flex flex-col items-center justify-center py-20 text-surface-300 gap-2">
                <i class="pi pi-box text-4xl"></i>
                <span class="text-sm">No se encontraron accesorios</span>
              </div>
              <div v-else class="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                <div
                  v-for="acc in productosFiltrados"
                  :key="acc.id"
                  class="flip-card perspective-[1000px]"
                  :class="(acc.cantidad || 0) <= 0 ? 'opacity-50' : ''"
                >
                  <div
                    class="flip-inner relative transition-transform duration-500 cursor-pointer"
                    :class="flippedAccId === acc.id ? '[transform:rotateY(180deg)]' : ''"
                    style="transform-style: preserve-3d; min-height: 170px;"
                  >
                    <!-- FRONT -->
                    <div
                      class="absolute inset-0 rounded-xl border border-surface-200/60 dark:border-surface-700/60 bg-surface-0 dark:bg-surface-800 p-3.5 flex flex-col gap-2 transition-all duration-200 backface-hidden"
                      @click="(acc.cantidad || 0) > 0 && agregarAccesorio(acc)"
                      @contextmenu.prevent="() => { flippedAccId = flippedAccId === acc.id ? null : acc.id }"
                    >
                      <div class="flex items-start justify-between">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm">
                          <i class="pi pi-box text-white text-lg"></i>
                        </div>
                        <span class="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                          :class="(acc.cantidad || 0) > 0
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'"
                        >
                          Stock: {{ acc.cantidad || 0 }}
                        </span>
                      </div>
                      <h4 class="font-semibold text-sm leading-snug truncate">{{ acc.nombre }}</h4>
                      <p v-if="acc.marca_nombre" class="text-[11px] text-surface-400 truncate -mt-1">{{ acc.marca_nombre }}</p>
                      <div class="flex items-center justify-between mt-auto pt-1">
                        <span class="font-bold text-sm text-emerald-600 dark:text-emerald-400">${{ formatCurrency(acc.precio_venta || 0) }}</span>
                        <Button
                          icon="pi pi-plus"
                          size="small"
                          severity="info"
                          text
                          rounded
                          class="!w-7 !h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          :disabled="(acc.cantidad || 0) <= 0"
                          @click.stop="agregarAccesorio(acc)"
                        />
                      </div>
                    </div>

                    <!-- BACK -->
                    <div
                      class="absolute inset-0 rounded-xl border border-emerald-300 dark:border-emerald-600 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-3 backface-hidden overflow-y-auto [transform:rotateY(180deg)]"
                      @contextmenu.prevent="flippedAccId = null"
                    >
                      <div class="flex items-center justify-between">
                        <h4 class="font-semibold text-sm truncate">{{ acc.nombre }}</h4>
                        <Button icon="pi pi-times" severity="secondary" text rounded size="small" class="!w-6 !h-6 !text-[10px]" @click="flippedAccId = null" />
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-xs flex-1">
                        <div class="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-50 dark:bg-surface-700/50">
                          <span class="text-[9px] font-semibold text-surface-500 uppercase">Venta</span>
                          <span class="font-bold text-emerald-600">${{ formatCurrency(acc.precio_venta || 0) }}</span>
                        </div>
                        <div class="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-50 dark:bg-surface-700/50">
                          <span class="text-[9px] font-semibold text-surface-500 uppercase">Stock</span>
                          <span class="font-bold" :class="(acc.cantidad || 0) > 0 ? 'text-blue-600' : 'text-red-500'">{{ acc.cantidad || 0 }}</span>
                        </div>
                        <div v-if="acc.precio_min" class="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-50 dark:bg-surface-700/50">
                          <span class="text-[9px] font-semibold text-surface-500 uppercase">Minimo</span>
                          <span class="font-bold text-orange-500">${{ formatCurrency(acc.precio_min) }}</span>
                        </div>
                        <div v-if="acc.precio_xmayor" class="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-50 dark:bg-surface-700/50">
                          <span class="text-[9px] font-semibold text-surface-500 uppercase">x Mayor</span>
                          <span class="font-bold text-green-500">${{ formatCurrency(acc.precio_xmayor) }}</span>
                        </div>

                      </div>
                      <p class="text-[9px] text-surface-400 text-center mt-auto">Click derecho para volver</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col" style="min-height: calc(100vh - 160px)">
        <div class="rounded-xl border border-surface-200/50 dark:border-surface-700/30 bg-surface-0 dark:bg-surface-800 flex flex-col shadow-sm flex-1 min-h-0">
          <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200/50 dark:border-surface-700/30">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <i class="pi pi-shopping-cart text-primary text-sm"></i>
              </div>
              <div>
                <h3 class="font-bold text-sm">Carrito</h3>
                <p v-if="cart.length > 0" class="text-[10px] text-surface-400">{{ cartCount }} producto(s)</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-xs font-bold bg-primary text-primary-contrast min-w-[22px] h-5 flex items-center justify-center rounded-full px-1.5">{{ cartCount }}</span>
              <button class="text-xs font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0" :class="esCotizacion ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-primary text-primary-contrast'" @click="esCotizacion = !esCotizacion" v-tooltip="esCotizacion ? 'Cotizacion' : 'Factura'">{{ esCotizacion ? 'COT' : 'FAC' }}</button>
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" class="!w-7 !h-7" :disabled="cart.length === 0" @click="limpiarCarrito" v-tooltip="'Limpiar carrito'" />
            </div>
          </div>

          <div class="px-4 py-3 border-b border-surface-200/50 dark:border-surface-700/30 bg-surface-50 dark:bg-surface-700/20">
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-wide text-surface-500 block mb-1">Cliente</label>
                <div v-if="clienteSeleccionado" class="flex items-center gap-1">
                  <div class="flex-1 text-[11px] p-1.5 rounded-md bg-surface-0 dark:bg-surface-700 border border-surface-200/50 dark:border-surface-600/30 leading-tight truncate">
                    <p class="font-medium truncate">{{ clienteSeleccionado.nombre }}</p>
                    <p class="text-surface-400 truncate">{{ clienteSeleccionado.telefono || 'Sin telefono' }}</p>
                  </div>
                  <Button icon="pi pi-times" severity="secondary" text rounded size="small" class="!w-6 !h-6 flex-shrink-0" @click="clienteSeleccionado = null; dialogCliente = false" v-tooltip="'Quitar cliente'" />
                  <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" class="!w-6 !h-6 flex-shrink-0" @click="dialogCliente = true" v-tooltip="'Cambiar cliente'" />
                </div>
                <Button
                  v-else
                  label="Cliente"
                  icon="pi pi-user"
                  severity="secondary"
                  outlined
                  size="small"
                  class="w-full h-7 text-[10px]"
                  @click="dialogCliente = true"
                />
              </div>
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-wide text-surface-500 block mb-1">Pago</label>
                <Select v-model="metodoPago" :options="metodosPago" optionLabel="label" optionValue="value" class="!h-8 [&>div]:!py-0 [&>div]:!px-1.5" fluid>
                  <template #value="{ value }">
                    <div class="flex items-center h-full w-full">
                      <span class="inline-flex items-center gap-1 px-1.5 rounded text-[9px] font-semibold leading-tight" :class="pagoBadge(value)">{{ value }}</span>
                    </div>
                  </template>
                  <template #option="{ option }">
                    <div class="flex items-center gap-2 px-1 py-1">
                      <i :class="pagoIcon(option.value)" class="text-sm"></i>
                      <span>{{ option.label }}</span>
                    </div>
                  </template>
                </Select>
              </div>
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-wide text-surface-500 block mb-1">Comp.</label>
                <Select
                  v-model="comprobanteSeleccionado"
                  :options="comprobantes"
                  optionLabel="nombre"
                  placeholder="..."
                  class="!h-8 [&>div]:!py-0 [&>div]:!px-1.5"
                  fluid
                >
                  <template #value="{ value }">
                    <div v-if="value" class="flex items-center h-full w-full gap-1">
                      <span class="text-[8px] font-bold px-1 rounded leading-tight" :class="compBadge(value.tipo)">{{ value.tipo }}</span>
                      <span class="text-[9px] truncate leading-tight">{{ value.nombre }}</span>
                    </div>
                    <span v-else class="text-[9px] text-surface-400 leading-tight">Sel.</span>
                  </template>
                  <template #option="{ option }">
                    <div class="flex items-center gap-2 py-0.5">
                      <span class="text-[8px] font-bold px-1.5 py-0.5 rounded" :class="compBadge(option.tipo)">{{ option.tipo }}</span>
                      <div class="min-w-0">
                        <span class="text-[10px] truncate block">{{ option.nombre }}</span>
                        <span v-if="option.tipo !== 'SIN'" class="text-[8px] text-surface-400 font-mono">{{ option.prefijo || option.tipo }}{{ String(option.secuencia_actual || 1).padStart(8, '0') }}</span>
                      </div>
                    </div>
                  </template>
                </Select>
              </div>
            </div>
          </div>

          <div v-if="cart.length === 0" class="flex flex-col items-center justify-center flex-1 text-surface-300 dark:text-surface-500 gap-2">
            <i class="pi pi-shopping-cart text-3xl"></i>
            <span class="text-xs">Carrito vacio</span>
            <span class="text-[10px] text-surface-400">Selecciona productos para vender</span>
          </div>
          <div v-else class="flex flex-col gap-1 px-4 py-2.5 flex-1 overflow-y-auto min-h-0 bg-surface-0 dark:bg-surface-800">
            <div
              v-for="(item, index) in cartConComision"
              :key="index"
              class="group flex items-start gap-2 p-2 rounded-lg border border-transparent hover:border-surface-200/60 dark:hover:border-surface-600/40 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors"
            >
              <div class="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs"
                :class="item.tipo === 'imei' ? 'bg-violet-500' : item.tipo === 'serial' ? 'bg-cyan-500' : 'bg-emerald-500'">
                <i :class="item.tipo === 'imei' ? 'pi pi-mobile' : item.tipo === 'serial' ? 'pi pi-sitemap' : 'pi pi-box'" class="text-white text-[10px]"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-1">
                  <p class="text-xs font-medium leading-tight truncate text-surface-900 dark:text-surface-50">{{ item.nombre }}</p>
                  <Button icon="pi pi-times" severity="danger" text rounded size="small" class="!w-5 !h-5 !text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -mt-0.5 -mr-1" @click="quitarDelCarrito(index)" />
                </div>
                <div v-if="itemTieneDescuento(item)" class="flex items-center gap-1.5 mt-0.5 text-[10px] leading-tight">
                  <span class="text-surface-400 line-through">${{ formatCurrency(getPrecioNormal(item)) }}</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">${{ formatCurrency(item.precio) }}</span>
                  <span class="rounded bg-emerald-50 px-1 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Con descuento</span>
                </div>
                <p v-if="item.imei" class="text-[10px] text-surface-400 font-mono truncate leading-tight">IMEI: {{ item.imei }}</p>
                <p v-if="item.serial" class="text-[10px] text-surface-400 font-mono truncate leading-tight">Serial: {{ item.serial }}</p>
                <p v-if="item.color || item.capacidad" class="text-[10px] text-surface-400 leading-tight">{{ [item.color, item.capacidad].filter(Boolean).join(' - ') }}</p>
                <div class="flex items-center justify-between mt-1">
                  <div class="flex items-center gap-1">
                    <span v-if="item.tipo === 'accesorio'" class="inline-flex items-center rounded-md border border-surface-200/50 dark:border-surface-600/30 overflow-hidden">
                      <button class="w-6 h-6 flex items-center justify-center text-xs font-bold text-surface-600 dark:text-surface-300 bg-surface-0 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer" @click.stop="disminuirCantidad(index)">−</button>
                      <span class="w-7 h-6 flex items-center justify-center text-[11px] font-bold bg-primary-50 dark:bg-primary-900/20 text-primary border-x border-surface-200/50 dark:border-surface-600/30">{{ item.cantidad }}</span>
                      <button class="w-6 h-6 flex items-center justify-center text-xs font-bold text-surface-600 dark:text-surface-300 bg-surface-0 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer" @click.stop="aumentarCantidad(index)">+</button>
                    </span>
                    <span v-else class="text-[10px] text-surface-400">{{ item.cantidad }} x</span>
                    <span
                      class="text-[10px] text-primary font-semibold cursor-pointer hover:underline"
                      @click.stop="abrirCambiarPrecio(item, index)"
                      v-tooltip="'Click para cambiar precio'"
                    >${{ formatCurrency(item.precio) }}</span>
                  </div>
                  <span class="text-xs font-bold text-surface-900 dark:text-surface-50">${{ formatCurrency(item.precio * item.cantidad) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-surface-200/50 dark:border-surface-700/50 rounded-b-xl">
            <div class="hidden lg:block px-4 py-2.5 space-y-1 bg-surface-50 dark:bg-surface-700/20 border-b border-surface-200/50 dark:border-surface-700/30">
              <div class="flex justify-between text-xs"><span class="text-surface-500">Subtotal</span><span class="font-medium text-surface-800 dark:text-surface-100">${{ formatCurrency(subtotal) }}</span></div>
              <div class="flex items-center justify-between gap-2"><span class="text-xs text-surface-500 flex-shrink-0">Descuento</span><Button :label="descuento > 0 ? '$' + formatCurrency(descuento) : 'Agregar'" :severity="descuento > 0 ? 'warning' : 'secondary'" text size="small" class="!text-xs" @click="abrirDialogDescuento" /></div>
              <div v-if="impuestoIncluido === 0" class="flex justify-between text-xs"><span class="text-surface-500">ITBIS ({{ impuestoPorcentaje }}%)</span><span class="font-medium text-surface-800 dark:text-surface-100">${{ formatCurrency(impuestoMonto) }}</span></div>
              <div v-else-if="impuestoIncluido === 1" class="flex justify-between text-xs"><span class="text-surface-400">ITBIS {{ impuestoPorcentaje }}% incl.</span><span class="text-surface-400">&mdash;</span></div>
              <div v-else class="flex justify-between text-xs"><span class="text-surface-400">ITBIS</span><span class="text-surface-400">Sin impuesto</span></div>
            </div>
            <div class="flex items-center justify-between px-3 py-2 lg:px-4 bg-surface-50/80 dark:bg-surface-800/50 border-b border-surface-200/50 dark:border-surface-700/30">
              <div class="flex items-center gap-3"><span class="text-xs lg:text-sm font-bold text-surface-900 dark:text-surface-50">Total</span><span class="text-sm lg:text-base font-bold text-primary">${{ formatCurrency(total) }}</span></div>
              <Button label="Completar" icon="pi pi-check-circle" class="!py-1.5 !text-xs lg:!py-2.5 lg:!text-sm shadow-md" :disabled="cart.length === 0 || total <= 0" @click="confirmarVenta" />
            </div>
            <div class="lg:hidden flex items-center gap-2 px-3 py-1.5">
              <div class="flex-1 flex items-start gap-1.5">
                <i class="pi pi-pencil text-surface-400 text-[9px] mt-1"></i>
                <div class="flex-1 min-w-0"><NotasComp v-model="nota" /></div>
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="nota = ''" :disabled="!nota" v-tooltip="'Limpiar nota'" class="!w-5 !h-5 !text-[9px]" />
              </div>
              <Button icon="pi pi-tag" severity="secondary" text rounded size="small" class="!w-5 !h-5 !text-[9px]" @click="abrirDialogDescuento" v-tooltip="'Descuento'" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="dialogVariantes"
      :header="selectedTelefono?.nombre || selectedElectrodomestico?.nombre || 'Seleccionar Variante'"
      modal
      :style="{ width: 'min(45rem, 95vw)' }"
    >
      <div class="space-y-3">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busquedaImei" :placeholder="selectedTelefono ? 'Buscar por IMEI, color o capacidad...' : 'Buscar por Serial, color o capacidad...'" fluid />
        </IconField>

        <DataTable
          v-if="variantesFiltradas.length > 0"
          :value="variantesFiltradas"
          stripedRows
          paginator
          :rows="8"
          :rowsPerPageOptions="[8, 15, 25]"
          dataKey="id"
          scrollable
          responsiveLayout="scroll"
          @row-click="abrirPrecio($event.data)"
        >
          <Column field="nombre" :header="selectedTelefono ? 'IMEI' : 'Serial'" sortable>
            <template #body="{ data }">
              <span class="font-mono text-xs">{{ data.nombre }}</span>
            </template>
          </Column>
          <Column field="color" header="Color" sortable />
          <Column field="capacidad" header="Capacidad" sortable />
          <Column header="Precio Venta" sortable>
            <template #body="{ data }">
              <span class="font-semibold">${{ formatCurrency(data.precio_venta || 0) }}</span>
            </template>
          </Column>
          <Column header="Precio Min" sortable>
            <template #body="{ data }">
              <span class="text-surface-500">${{ formatCurrency(data.precio_min || 0) }}</span>
            </template>
          </Column>
          <Column header="Precio xMayor" sortable>
            <template #body="{ data }">
              <span class="text-surface-500">${{ formatCurrency(data.precio_xmayor || 0) }}</span>
            </template>
          </Column>
          <Column header="Costo">
            <template #body="{ data }">
              <span class="text-surface-400 text-xs">${{ formatCurrency(data.costo || 0) }}</span>
            </template>
          </Column>

          <template #empty>
            <div class="text-center py-6 text-surface-400">No hay unidades disponibles de este modelo.</div>
          </template>
        </DataTable>

        <div v-else-if="selectedTelefono ? variantesImei.length === 0 : variantesSerial.length === 0" class="text-center py-6 text-surface-400">No hay unidades disponibles de este modelo.</div>
        <div v-else class="text-center py-6 text-surface-400">No hay resultados para la busqueda.</div>
      </div>

      <template #footer>
        <Button label="Cerrar" severity="secondary" text @click="dialogVariantes = false" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogPrecio"
      header="Seleccionar Precio"
      modal
      :style="{ width: 'min(28rem, 95vw)' }"
    >
      <div class="space-y-4">
        <div class="text-sm bg-surface-50 dark:bg-surface-700/50 p-3 rounded-lg">
          <p class="font-medium">{{ selectedTelefono?.nombre || selectedElectrodomestico?.nombre }}</p>
          <p class="text-surface-400 text-xs font-mono">{{ selectedTelefono ? 'IMEI:' : 'Serial:' }} {{ imeiParaPrecio?.nombre }}</p>
          <p class="text-surface-400 text-xs">{{ imeiParaPrecio?.color }} {{ imeiParaPrecio?.capacidad }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioSeleccionado === 'venta'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="precioSeleccionado = 'venta'; precioManual = imeiParaPrecio?.precio_venta || 0; agregarImeiAlCarrito()"
          >
            <div>
              <p class="font-semibold text-sm">Precio Normal</p>
              <p class="text-xs text-surface-400">Precio de venta regular</p>
            </div>
            <span class="font-bold text-lg text-primary">${{ formatCurrency(imeiParaPrecio?.precio_venta || 0) }}</span>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioSeleccionado === 'min'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="precioSeleccionado = 'min'; precioManual = imeiParaPrecio?.precio_min || 0; agregarImeiAlCarrito()"
          >
            <div>
              <p class="font-semibold text-sm">Precio Minimo</p>
              <p class="text-xs text-surface-400">Precio minimo permitido</p>
            </div>
            <span class="font-bold text-lg text-orange-500">${{ formatCurrency(imeiParaPrecio?.precio_min || 0) }}</span>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioSeleccionado === 'xmayor'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="precioSeleccionado = 'xmayor'; precioManual = imeiParaPrecio?.precio_xmayor || 0; agregarImeiAlCarrito()"
          >
            <div>
              <p class="font-semibold text-sm">Precio por Mayor</p>
              <p class="text-xs text-surface-400">Precio para ventas al por mayor</p>
            </div>
            <span class="font-bold text-lg text-green-500">${{ formatCurrency(imeiParaPrecio?.precio_xmayor || 0) }}</span>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioSeleccionado === 'manual'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="precioSeleccionado = 'manual'"
          >
            <div>
              <p class="font-semibold text-sm">Precio Manual</p>
              <p class="text-xs text-surface-400">Ingresar precio personalizado</p>
            </div>
            <InputNumber
              v-if="precioSeleccionado === 'manual'"
              v-model="precioManual"
              :min="0"
              class="w-32"
              @focus="(e) => e.target.select()"
              @click.stop
              fluid
            />
            <span v-else class="text-sm text-surface-400">Click para personalizar</span>
          </div>
        </div>

        <div class="flex justify-between text-lg font-bold border-t border-surface-200/50 dark:border-surface-700/30 pt-3">
          <span>Precio seleccionado</span>
          <span class="text-primary">${{ formatCurrency(getPrecioActual()) }}</span>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogPrecio = false" />
        <Button label="Agregar al Carrito" icon="pi pi-cart-plus" :disabled="getPrecioActual() <= 0" @click="agregarImeiAlCarrito" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogProductoPersonalizado"
      header="Producto No Registrado"
      modal
      :style="{ width: 'min(24rem, 95vw)' }"
      @keyup.enter="agregarProductoPersonalizado"
    >
      <div class="space-y-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Nombre del producto</label>
          <InputText v-model="prodPersonalizado.nombre" placeholder="Ej: Cargador generico" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio (RD$)</label>
          <InputNumber v-model="prodPersonalizado.precio" :min="0" :minFractionDigits="0" :maxFractionDigits="2" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Costo (RD$) <span class="text-surface-400 font-normal">opcional</span></label>
          <InputNumber v-model="prodPersonalizado.costo" :min="0" :minFractionDigits="0" :maxFractionDigits="2" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogProductoPersonalizado = false" />
        <Button label="Agregar al Carrito" icon="pi pi-cart-plus" @click="agregarProductoPersonalizado" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogCliente"
      header="Seleccionar Cliente"
      modal
      :style="{ width: 'min(30rem, 95vw)' }"
    >
      <div class="space-y-3">
        <InputText v-model="busquedaCliente" placeholder="Buscar por nombre, telefono o RNC..." fluid />

        <div v-if="clientesFiltrados.length === 0" class="text-center py-4 text-surface-400 text-sm">No se encontraron clientes.</div>
        <div v-else class="flex flex-col gap-2 max-h-60 overflow-y-auto">
          <div
            v-for="cliente in clientesFiltrados"
            :key="cliente.id"
            class="flex items-center justify-between p-2.5 rounded-lg border border-surface-200/50 dark:border-surface-700/30 cursor-pointer hover:border-primary-300 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
            @click="seleccionarCliente(cliente)"
          >
            <div>
              <p class="font-medium text-sm">{{ cliente.nombre }}</p>
              <p class="text-xs text-surface-400">{{ cliente.telefono || 'Sin telefono' }}</p>
            </div>
            <i class="pi pi-chevron-right text-surface-400 text-xs"></i>
          </div>
        </div>

        <div class="border-t border-surface-200/50 dark:border-surface-700/30 pt-3">
          <Button label="Nuevo Cliente" icon="pi pi-user-plus" severity="info" text class="w-full" @click="abrirNuevoCliente" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogCliente = false" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogNuevoCliente"
      header="Nuevo Cliente"
      modal
      :style="{ width: 'min(26rem, 95vw)' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Nombre <span class="text-red-400">*</span></label>
          <InputText v-model="nuevoClienteForm.nombre" placeholder="Nombre del cliente" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Telefono</label>
          <InputText v-model="nuevoClienteForm.telefono" placeholder="Telefono" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Documento</label>
          <div class="flex gap-2">
            <SelectButton v-model="rncTipo" :options="['RNC', 'CEDULA']" class="shrink-0" />
            <div class="flex-1 flex gap-1">
              <InputText v-model="nuevoClienteForm.rnc" :placeholder="rncTipo === 'RNC' ? 'RNC' : 'Cedula'" fluid class="flex-1" />
              <Button icon="pi pi-search" severity="info" :loading="buscandoClienteApi" @click="buscarClienteApi" v-tooltip="'Buscar en API'" />
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Direccion</label>
          <InputText v-model="nuevoClienteForm.direccion" placeholder="Direccion" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogNuevoCliente = false" />
        <Button label="Guardar y Seleccionar" icon="pi pi-check" @click="guardarNuevoCliente" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogMixto"
      header="Pago Mixto"
      modal
      :style="{ width: 'min(28rem, 95vw)' }"
    >
      <div v-if="pasoMixto === 'elegir'" class="space-y-4">
        <p class="text-sm text-surface-500">Selecciona los metodos de pago a combinar (minimo 2):</p>

        <div v-if="mixtoError" class="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{{ mixtoError }}</div>

        <div class="space-y-2">
          <label class="flex items-center gap-3 p-3 rounded-lg border border-surface-200 dark:border-surface-700 cursor-pointer hover:border-primary-300 transition-all" :class="metodosMixto.efectivo ? 'bg-primary text-primary-contrast border-primary' : ''">
            <input type="checkbox" v-model="metodosMixto.efectivo" class="w-4 h-4" />
            <i class="pi pi-money-bill"></i>
            <span class="text-sm font-medium">Efectivo</span>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-lg border border-surface-200 dark:border-surface-700 cursor-pointer hover:border-primary-300 transition-all" :class="metodosMixto.tarjeta ? 'bg-primary text-primary-contrast border-primary' : ''">
            <input type="checkbox" v-model="metodosMixto.tarjeta" class="w-4 h-4" />
            <i class="pi pi-credit-card"></i>
            <span class="text-sm font-medium">Tarjeta</span>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-lg border border-surface-200 dark:border-surface-700 cursor-pointer hover:border-primary-300 transition-all" :class="metodosMixto.transferencia ? 'bg-primary text-primary-contrast border-primary' : ''">
            <input type="checkbox" v-model="metodosMixto.transferencia" class="w-4 h-4" />
            <i class="pi pi-send"></i>
            <span class="text-sm font-medium">Transferencia</span>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-lg border border-surface-200 dark:border-surface-700 cursor-pointer hover:border-primary-300 transition-all" :class="metodosMixto.cheque ? 'bg-primary text-primary-contrast border-primary' : ''">
            <input type="checkbox" v-model="metodosMixto.cheque" class="w-4 h-4" />
            <i class="pi pi-check"></i>
            <span class="text-sm font-medium">Cheque</span>
          </label>
        </div>
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-surface-500">Distribuye el total de <strong>${{ formatCurrency(total) }}</strong> entre los metodos seleccionados:</p>

        <div v-if="mixtoError" class="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{{ mixtoError }}</div>

        <div class="space-y-3">
          <div v-if="metodosMixto.efectivo" class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><i class="pi pi-money-bill text-sm"></i></div>
            <span class="text-sm font-medium w-24">Efectivo</span>
            <InputNumber v-model="mixtoEfectivo" :min="0" fluid @focus="(e: any) => e.target.select()" />
          </div>
          <div v-if="metodosMixto.tarjeta" class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><i class="pi pi-credit-card text-sm"></i></div>
            <span class="text-sm font-medium w-24">Tarjeta</span>
            <InputNumber v-model="mixtoTarjeta" :min="0" fluid @focus="(e: any) => e.target.select()" />
          </div>
          <div v-if="metodosMixto.transferencia" class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><i class="pi pi-send text-sm"></i></div>
            <span class="text-sm font-medium w-24">Transferencia</span>
            <InputNumber v-model="mixtoTransferencia" :min="0" fluid @focus="(e: any) => e.target.select()" />
          </div>
          <div v-if="metodosMixto.cheque" class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600"><i class="pi pi-check text-sm"></i></div>
            <span class="text-sm font-medium w-24">Cheque</span>
            <InputNumber v-model="mixtoCheque" :min="0" fluid @focus="(e: any) => e.target.select()" />
          </div>
        </div>

        <div class="flex justify-between text-sm font-bold border-t border-surface-200 dark:border-surface-700 pt-3">
          <span>Total distribuido</span>
          <span :class="(Number(mixtoEfectivo) + Number(mixtoTarjeta) + Number(mixtoTransferencia) + Number(mixtoCheque)) === total.value ? 'text-green-600' : 'text-red-600'">
            ${{ formatCurrency((Number(mixtoEfectivo) || 0) + (Number(mixtoTarjeta) || 0) + (Number(mixtoTransferencia) || 0) + (Number(mixtoCheque) || 0)) }}
          </span>
        </div>
      </div>
      <template #footer>
        <Button v-if="pasoMixto === 'elegir'" label="Cancelar" severity="secondary" text @click="dialogMixto = false" />
        <Button v-if="pasoMixto === 'elegir'" label="Siguiente" icon="pi pi-arrow-right" @click="siguientePasoMixto" />
        <Button v-if="pasoMixto === 'montos'" label="Atras" severity="secondary" text @click="pasoMixto = 'elegir'" />
        <Button v-if="pasoMixto === 'montos'" label="Confirmar" icon="pi pi-check" @click="confirmarMixto" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmPago"
      header="Confirmar Venta"
      modal
      :style="{ width: 'min(28rem, 95vw)' }"
    >
      <div class="space-y-3">
        <div class="flex justify-between text-sm">
          <span>Productos</span>
          <span class="font-semibold">{{ cartCount }} items</span>
        </div>
        <div class="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${{ formatCurrency(subtotal) }}</span>
        </div>
        <div v-if="descuento > 0" class="flex justify-between text-sm">
          <span>Descuento</span>
          <span class="text-red-500">-${{ formatCurrency(descuento) }}</span>
        </div>
        <div v-if="impuestoIncluido === 0" class="flex justify-between text-sm">
          <span>ITBIS ({{ impuestoPorcentaje }}%)</span>
          <span>${{ formatCurrency(impuestoMonto) }}</span>
        </div>
        <div v-else-if="impuestoIncluido === 1" class="flex justify-between text-xs text-surface-400">
          <span>ITBIS {{ impuestoPorcentaje }}% incl.</span>
          <span>—</span>
        </div>
        <div v-else class="flex justify-between text-xs text-surface-400">
          <span>ITBIS</span>
          <span>Sin impuesto</span>
        </div>
        <div v-if="comisionPorcentaje > 0" class="flex justify-between text-xs text-amber-600 dark:text-amber-400 pt-1">
          <span>Recargo {{ metodoPago }} ({{ comisionPorcentaje }}%)</span>
          <span>Incluido en precios</span>
        </div>
        <div class="flex justify-between text-lg font-bold border-t border-surface-200/50 dark:border-surface-700/30 pt-2">
          <span>Total a pagar</span>
          <span class="text-primary">${{ formatCurrency(total) }}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-sm border-t border-surface-100 dark:border-surface-700 pt-2">
          <span>Cliente</span>
          <InputText
            v-if="!clienteSeleccionado"
            v-model="clienteExpress"
            placeholder="Nombre del cliente"
            class="!text-xs w-48"
            fluid
          />
          <span v-else class="font-medium text-right flex items-center gap-1">
            {{ clienteSeleccionado.nombre }}
            <Button icon="pi pi-times" severity="secondary" text rounded size="small" class="!w-5 !h-5" @click="clienteSeleccionado = null" v-tooltip="'Quitar cliente'" />
          </span>
        </div>
        <div class="flex justify-between text-sm">
          <span>Metodo de Pago</span>
          <span>{{ metodoPago }}</span>
        </div>
        <div class="pt-1 border-t border-surface-100 dark:border-surface-700">
          <div class="flex items-start gap-1.5">
            <i class="pi pi-pencil text-surface-400 text-xs mt-1.5"></i>
            <NotasComp v-model="nota" class="flex-1" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="confirmPago = false" />
        <Button label="Completar Venta" icon="pi pi-check" :loading="guardando" @click="completarVenta" />
      </template>
    </Dialog>

    <FacturaPdfPrint ref="facturaPdfRef" />

    <Dialog
      v-model:visible="dialogPrintChoice"
      header="Imprimir"
      modal
      :style="{ width: 'min(24rem, 95vw)' }"
      :closable="true"
    >
      <div class="flex flex-col gap-3 pt-2">
        <p class="text-sm text-surface-500">Selecciona una opcion:</p>
        <Button label="Ticket Termico" icon="pi pi-print" severity="info" outlined class="w-full justify-start" @click="soloTicket" />
        <Button label="PDF" icon="pi pi-file-pdf" severity="danger" outlined class="w-full justify-start" @click="imprimirPdf" />
        <Button label="Enviar por Correo" icon="pi pi-envelope" severity="help" outlined class="w-full justify-start" @click="enviarCorreo" />
        <Button label="Compartir por WhatsApp" icon="pi pi-whatsapp" severity="success" outlined class="w-full justify-start" @click="compartirWhatsApp" />
        <Button label="Compartir" icon="pi pi-share-alt" severity="info" outlined class="w-full justify-start" @click="compartirImagen" />
        <Button label="Ninguno" icon="pi pi-times" severity="secondary" text class="w-full justify-start" @click="dialogPrintChoice = false" />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="dialogTicket"
      header="Venta Completada"
      modal
      :style="{ width: 'min(30rem, 95vw)' }"
      @after-hide="cerrarTicket"
    >
      <div class="space-y-4">
        <div class="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <i class="pi pi-check-circle text-2xl text-green-600"></i>
          <div>
            <p class="font-semibold text-green-700 dark:text-green-300">Factura {{ ticketData?.no_factura }}</p>
            <p class="text-sm text-green-600 dark:text-green-400">Venta completada exitosamente</p>
          </div>
        </div>

        <div class="flex justify-center">
          <div
            class="bg-white text-black font-mono text-xs leading-tight overflow-hidden rounded-lg shadow-lg"
            style="width: 280px; padding: 10px 8px"
            v-html="getTicketPreviewHTML()"
          ></div>
        </div>
      </div>

      <template #footer>
        <Button label="Cerrar" severity="secondary" text @click="dialogTicket = false" />
        <Button label="Imprimir Ticket" icon="pi pi-print" @click="imprimirTicket" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogCambiarPrecio"
      header="Cambiar Precio"
      modal
      :style="{ width: 'min(28rem, 95vw)' }"
    >
      <div class="space-y-4">
        <div class="text-sm bg-surface-50 dark:bg-surface-700/50 p-3 rounded-lg">
          <p class="font-medium">{{ cartItemPrecio?.item?.nombre }}</p>
          <p class="text-xs text-surface-400">{{ cartItemPrecio?.item?.color }} {{ cartItemPrecio?.item?.capacidad }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioCambioSeleccionado === 'venta'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="seleccionarPrecioCambio('venta')"
          >
            <div>
              <p class="font-semibold text-sm">Precio Normal</p>
              <p class="text-xs text-surface-400">Precio de venta regular</p>
            </div>
            <span class="font-bold text-lg text-primary">${{ formatCurrency(itemParaPrecio?.precio_venta || 0) }}</span>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioCambioSeleccionado === 'min'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="seleccionarPrecioCambio('min')"
          >
            <div>
              <p class="font-semibold text-sm">Precio Minimo</p>
              <p class="text-xs text-surface-400">Precio minimo permitido</p>
            </div>
            <span class="font-bold text-lg text-orange-500">${{ formatCurrency(itemParaPrecio?.precio_min || 0) }}</span>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioCambioSeleccionado === 'xmayor'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="seleccionarPrecioCambio('xmayor')"
          >
            <div>
              <p class="font-semibold text-sm">Precio por Mayor</p>
              <p class="text-xs text-surface-400">Precio para ventas al por mayor</p>
            </div>
            <span class="font-bold text-lg text-green-500">${{ formatCurrency(itemParaPrecio?.precio_xmayor || 0) }}</span>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="precioCambioSeleccionado === 'manual'
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200/50 dark:border-surface-700/30 hover:border-primary-300'"
            @click="precioCambioSeleccionado = 'manual'"
          >
            <div>
              <p class="font-semibold text-sm">Precio Manual</p>
              <p class="text-xs text-surface-400">Ingresar precio personalizado</p>
            </div>
            <InputNumber
              v-if="precioCambioSeleccionado === 'manual'"
              v-model="nuevoPrecioItem"
              :min="0"
              class="w-32"
              @focus="(e) => e.target.select()"
              @click.stop
              fluid
            />
            <span v-else class="text-sm text-surface-400">Click para personalizar</span>
          </div>
        </div>

        <Button
          label="Gratis (RD$ 0.00)"
          icon="pi pi-star"
          severity="warning"
          outlined
          class="w-full justify-center"
          :class="nuevoPrecioItem === 0 ? '!bg-amber-100 dark:!bg-amber-900/30 !border-amber-400 !text-amber-700 dark:!text-amber-300' : ''"
          @click="nuevoPrecioItem = 0; precioCambioSeleccionado = 'manual'"
        />

        <div class="flex justify-between text-lg font-bold border-t border-surface-200/50 dark:border-surface-700/30 pt-3">
          <span>Precio seleccionado</span>
          <span class="text-primary">${{ formatCurrency(nuevoPrecioItem) }}</span>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogCambiarPrecio = false; cartItemPrecio = null; itemParaPrecio = null" />
        <Button label="Aplicar" icon="pi pi-check" @click="aplicarCambioPrecio" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogDescuento"
      header="Agregar Descuento"
      modal
      :style="{ width: 'min(26rem, 95vw)' }"
    >
      <div class="space-y-5 pt-2">
        <div class="flex rounded-lg border border-surface-200/50 dark:border-surface-700/30 overflow-hidden">
          <button
            class="flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
            :class="descuentoTipo === 'fijo' ? 'bg-primary text-primary-contrast' : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300'"
            @click="descuentoTipo = 'fijo'; notaCreditoSeleccionada = null"
          >RD$ Fijo</button>
          <button
            class="flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer border-l border-surface-200/50 dark:border-surface-700/30"
            :class="descuentoTipo === 'porcentaje' ? 'bg-primary text-primary-contrast' : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300'"
            @click="descuentoTipo = 'porcentaje'; notaCreditoSeleccionada = null"
          >% Porcentaje</button>
          <button
            class="flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer border-l border-surface-200/50 dark:border-surface-700/30"
            :class="descuentoTipo === 'nota_credito' ? 'bg-primary text-primary-contrast' : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300'"
            @click="descuentoTipo = 'nota_credito'"
          >Nota Créd.</button>
        </div>

        <div v-if="descuentoTipo === 'nota_credito'" class="flex flex-col gap-2">
          <p class="text-xs text-surface-500">Selecciona una nota de credito del cliente</p>
          <div v-if="notasCreditoCliente.length > 0" class="max-h-44 overflow-y-auto flex flex-col gap-1">
            <div
              v-for="nc in notasCreditoCliente"
              :key="nc.id"
              class="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border text-sm"
              :class="notaCreditoSeleccionada?.id === nc.id ? 'border-primary bg-primary-50 dark:bg-primary-900/20' : 'border-surface-200 dark:border-surface-700 hover:border-primary-300'"
              @click="seleccionarNotaCredito(nc)"
            >
              <div>
                <p class="font-medium">{{ nc.no_factura }}</p>
                <p class="text-xs text-surface-500">{{ nc.fecha_emision }}</p>
              </div>
              <span class="font-semibold text-emerald-600">${{ formatCurrency(nc.total) }}</span>
            </div>
          </div>
          <div v-else class="text-center py-3 text-surface-400 text-sm">
            <span v-if="!clienteSeleccionado">Selecciona un cliente primero</span>
            <span v-else>Sin notas de credito disponibles</span>
          </div>
          <div v-if="notaCreditoSeleccionada" class="flex flex-col gap-1">
            <label class="text-sm font-semibold">Valor a descontar</label>
            <InputNumber v-model="descuentoValor" :min="0" :max="notaCreditoSeleccionada?.total || 0" fluid />
          </div>
        </div>

        <div v-else class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Valor del descuento</label>
          <InputNumber
            v-model="descuentoValor"
            :min="0"
            :max="descuentoTipo === 'porcentaje' ? 100 : subtotal"
            fluid
          />
        </div>

        <div class="rounded-lg bg-surface-50 dark:bg-surface-700/30 p-3 text-sm space-y-1">
          <div class="flex justify-between">
            <span class="text-surface-500">Subtotal</span>
            <span>${{ formatCurrency(subtotal) }}</span>
          </div>
          <div v-if="impuestoIncluido === 0" class="flex justify-between text-xs">
            <span class="text-surface-500">ITBIS ({{ impuestoPorcentaje }}%)</span>
            <span>${{ formatCurrency(impuestoMonto) }}</span>
          </div>
          <div v-else-if="impuestoIncluido === 1" class="flex justify-between text-[10px] text-surface-400">
            <span>ITBIS {{ impuestoPorcentaje }}% incl.</span>
            <span>—</span>
          </div>
          <div v-else class="flex justify-between text-[10px] text-surface-400">
            <span>ITBIS</span>
            <span>Sin impuesto</span>
          </div>
          <div class="flex justify-between font-bold text-lg border-t border-surface-200/50 dark:border-surface-700/30 pt-1 mt-1">
            <span>Total</span>
            <span>${{ formatCurrency(total) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Quitar" severity="danger" text @click="quitarDescuento" />
        <Button label="Cancelar" severity="secondary" text @click="dialogDescuento = false" />
        <Button label="Aplicar" icon="pi pi-check" @click="aplicarDescuento" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogPdf" header="Cotizacion" modal :style="{ width: '80vw', height: '90vh' }" :closable="true" :draggable="false" @after-hide="cerrarPdfDialog">
      <div class="flex flex-col h-full -m-6">
        <iframe v-if="pdfUrl" :src="pdfUrl" class="w-full flex-1 border-0" style="min-height: 70vh"></iframe>
      </div>
      <template #footer>
        <Button label="Cerrar" severity="secondary" text @click="cerrarPdfDialog" />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.backface-hidden {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
</style>
