<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Gestion de Garantias</h1>
        <p class="text-sm text-surface-500">Registra y da seguimiento a las garantias de productos</p>
      </div>
      <div class="flex gap-2">
        <button @click="abrirRegistroRapido" class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90" style="background:#10b981">
          <i class="pi pi-plus"></i>Registrar Garantia
        </button>
        <button @click="abrirReclamo" class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90" :style="{ background: 'var(--p-primary-500)' }">
          <i class="pi pi-exclamation-triangle"></i>Reclamo
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-16 text-surface-500"><i class="pi pi-spin pi-spinner text-2xl mb-2 block"></i>Cargando...</div>

    <template v-else>
      <DataTable :value="garantias" stripedRows paginator :rows="15" dataKey="id" sortField="created_at" :sortOrder="-1">
        <Column field="producto_nombre" header="Producto" sortable />
        <Column field="imei" header="IMEI/Serial" sortable style="width:9rem" />
        <Column field="cliente_nombre" header="Cliente" sortable />
        <Column field="fecha_venta" header="Venta" sortable style="width:7rem" />
        <Column field="fecha_vencimiento" header="Vence" sortable style="width:7rem" />
        <Column header="Dias Rest." style="width:6rem">
          <template #body="{ data }">
            <span class="font-semibold" :class="diasRestantes(data) <= 0 ? 'text-red-500' : diasRestantes(data) <= 7 ? 'text-amber-500' : 'text-green-500'">{{ diasRestantes(data) }}</span>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width:7rem">
          <template #body="{ data }">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="data.estado === 'ACTIVA' ? 'bg-green-100 text-green-700' : data.estado === 'VENCIDA' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'"
            >{{ data.estado }}</span>
          </template>
        </Column>
        <Column header="Reclamos" style="width:5rem">
          <template #body="{ data }">
            <button v-if="data.reclamos_count > 0" class="text-xs text-primary underline" @click="verReclamos(data)">{{ data.reclamos_count }} reclamo(s)</button>
            <span v-else class="text-xs text-surface-400">0</span>
          </template>
        </Column>
        <template #empty>
          <div class="text-center py-10 text-surface-400">No hay garantias registradas.</div>
        </template>
      </DataTable>
    </template>

    <Dialog v-model:visible="dialogGarantia" header="Registrar Garantia" modal :style="{ width: 'min(36rem, 95vw)' }" :draggable="false">
      <div class="flex flex-col gap-3 pt-2">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold mb-1 block">Tipo de producto</label>
            <Select v-model="form.tipo_producto" :options="['IMEI', 'SERIAL', 'ACCESORIO', 'ELECTRODOMESTICO', 'PIEZA']" placeholder="Tipo" fluid @change="cargarProductos" />
          </div>
          <div>
            <label class="text-xs font-semibold mb-1 block">Producto</label>
            <Select v-model="form.producto_id" :options="productosDisponibles" optionLabel="nombre" optionValue="id" placeholder="Seleccionar" fluid @change="onProductoSelect" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold mb-1 block">Cliente</label>
            <Select v-model="form.cliente_id" :options="clientes" optionLabel="nombre" optionValue="id" placeholder="Cliente" fluid filter @change="onClienteSelect" />
          </div>
          <div>
            <label class="text-xs font-semibold mb-1 block">Dias de garantia</label>
            <InputNumber v-model="form.dias_garantia" :min="1" class="w-full" fluid />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold mb-1 block">Fecha de venta</label>
            <Calendar v-model="form.fecha_venta" dateFormat="yy-mm-dd" fluid />
          </div>
          <div>
            <label class="text-xs font-semibold mb-1 block">No. Factura</label>
            <InputText v-model="form.no_factura" placeholder="Opcional" fluid />
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1 block">Nota</label>
          <InputText v-model="form.nota" placeholder="Observaciones" fluid />
        </div>
        <p v-if="errorGarantia" class="text-red-500 text-xs">{{ errorGarantia }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogGarantia = false" />
        <Button label="Registrar" icon="pi pi-check" :loading="guardando" @click="registrarGarantia" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogReclamo" header="Registrar Reclamo de Garantia" modal :style="{ width: 'min(36rem, 95vw)' }">
      <div class="flex flex-col gap-3 pt-2">
        <div>
          <label class="text-xs font-semibold mb-1 block">Buscar garantia por IMEI/Serial o Cliente</label>
          <InputText v-model="busquedaReclamo" placeholder="IMEI, Serial o nombre de cliente..." fluid @input="buscarGarantiasReclamo" />
        </div>
        <div v-if="garantiasEncontradas.length > 0" class="max-h-32 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg divide-y divide-surface-100">
          <button v-for="g in garantiasEncontradas" :key="g.id" class="w-full text-left px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-800" :class="g.id === reclamoForm.garantia_id ? 'bg-primary-50 dark:bg-primary-900/20' : ''" @click="seleccionarGarantiaReclamo(g)">
            <strong>{{ g.producto_nombre }}</strong> - {{ g.imei || g.serial || '' }} - {{ g.cliente_nombre }}
          </button>
        </div>
        <div v-if="reclamoForm.garantia_id && garantiaSeleccionada">
          <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3 text-sm">
            <p><strong>{{ garantiaSeleccionada.producto_nombre }}</strong> (Vence: {{ garantiaSeleccionada.fecha_vencimiento }})</p>
            <p class="text-xs text-surface-500">{{ garantiaSeleccionada.cliente_nombre }} - {{ garantiaSeleccionada.imei || garantiaSeleccionada.serial }}</p>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1 block">Descripcion del problema</label>
          <Textarea v-model="reclamoForm.descripcion" placeholder="Describe el fallo o problema del producto..." rows="3" fluid />
        </div>
        <p v-if="errorReclamo" class="text-red-500 text-xs">{{ errorReclamo }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogReclamo = false" />
        <Button label="Registrar Reclamo" icon="pi pi-save" :loading="guardando" @click="registrarReclamo" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogVerReclamos" :header="'Reclamos - ' + (garantiaReclamos?.producto_nombre || '')" modal :style="{ width: 'min(36rem, 95vw)' }">
      <div v-if="reclamosLista.length === 0" class="text-center py-8 text-surface-400 text-sm">Sin reclamos para esta garantia.</div>
      <div v-else class="space-y-3 pt-2">
        <div v-for="r in reclamosLista" :key="r.id" class="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
          <div class="flex justify-between items-start">
            <span class="text-xs text-surface-400">{{ new Date(r.created_at).toLocaleString('es-DO') }}</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
              :class="r.estado === 'RESUELTO' ? 'bg-green-100 text-green-700' : r.estado === 'EN_PROCESO' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
            >{{ r.estado }}</span>
          </div>
          <p class="text-sm mt-1">{{ r.descripcion }}</p>
          <p v-if="r.solucion" class="text-sm text-green-600 mt-1"><strong>Solucion:</strong> {{ r.solucion }}</p>
        </div>
      </div>
      <template #footer>
        <Button label="Cerrar" severity="secondary" text @click="dialogVerReclamos = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Calendar from 'primevue/calendar'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { useAlmacenStore } from '@/stores/almacen.store'

const toast = useToast()
const almacenStore = useAlmacenStore()

const loading = ref(true)
const garantias = ref<any[]>([])
const clientes = ref<any[]>([])
const productosDisponibles = ref<any[]>([])
const dialogGarantia = ref(false)
const dialogReclamo = ref(false)
const dialogVerReclamos = ref(false)
const guardando = ref(false)
const errorGarantia = ref('')
const errorReclamo = ref('')
const busquedaReclamo = ref('')
const garantiasEncontradas = ref<any[]>([])
const garantiaSeleccionada = ref<any>(null)
const garantiaReclamos = ref<any>(null)
const reclamosLista = ref<any[]>([])

const form = ref({
  tipo_producto: '', producto_id: null as number | null,
  cliente_id: null as number | null, cliente_nombre: '', cliente_telefono: '',
  dias_garantia: 30, fecha_venta: new Date(), no_factura: '', nota: '',
  imei: '', serial: '',
})

const reclamoForm = ref({ garantia_id: 0, descripcion: '' })

function diasRestantes(g: any): number {
  if (!g.fecha_vencimiento) return 0
  const venc = new Date(g.fecha_vencimiento)
  const diff = venc.getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

async function cargar() {
  loading.value = true
  try {
    const [resGar, resCli] = await Promise.all([
      (window as any).electron.invoke('db:getAll', 'garantias'),
      (window as any).electron.invoke('db:getAll', 'clientes'),
    ])
    if (resGar.success) {
      const ids = (resGar.data || []).map((g: any) => g.id)
      if (ids.length > 0) {
        const resRec = await (window as any).electron.invoke('db:getWhere', 'reclamos_garantia', `garantia_id IN (${ids.join(',')})`)
        if (resRec.success) {
          const counts = new Map<number, number>()
          for (const r of resRec.data || []) counts.set(r.garantia_id, (counts.get(r.garantia_id) || 0) + 1)
          garantias.value = (resGar.data || []).map((g: any) => ({ ...g, reclamos_count: counts.get(g.id) || 0 }))
        }
      } else {
        garantias.value = resGar.data || []
      }
    }
    if (resCli.success) clientes.value = resCli.data || []
  } catch {} finally { loading.value = false }
}

async function cargarProductos() {
  if (!form.value.tipo_producto) { productosDisponibles.value = []; return }
  const tablaMap: Record<string, string> = { IMEI: 'imei', SERIAL: 'serial', ACCESORIO: 'accesorios', ELECTRODOMESTICO: 'electrodomesticos', PIEZA: 'piezas' }
  const tabla = tablaMap[form.value.tipo_producto]
  if (!tabla) return
  const res = await (window as any).electron.invoke('db:getAll', tabla)
  if (res.success) productosDisponibles.value = res.data || []
}

function onProductoSelect() {
  const p = productosDisponibles.value.find((x: any) => x.id === form.value.producto_id)
  if (p) { form.value.imei = p.nombre || ''; form.value.serial = p.nombre || '' }
}

function onClienteSelect() {
  const c = clientes.value.find((x: any) => x.id === form.value.cliente_id)
  if (c) { form.value.cliente_nombre = c.nombre || ''; form.value.cliente_telefono = c.telefono || '' }
}

function abrirRegistroRapido() {
  form.value = { tipo_producto: '', producto_id: null, cliente_id: null, cliente_nombre: '', cliente_telefono: '', dias_garantia: 30, fecha_venta: new Date(), no_factura: '', nota: '', imei: '', serial: '' }
  errorGarantia.value = ''
  dialogGarantia.value = true
}

async function registrarGarantia() {
  if (!form.value.tipo_producto || !form.value.producto_id || !form.value.cliente_id) { errorGarantia.value = 'Completa tipo, producto y cliente'; return }
  guardando.value = true; errorGarantia.value = ''
  try {
    const fechaVenta = form.value.fecha_venta instanceof Date ? form.value.fecha_venta.toISOString().split('T')[0] : form.value.fecha_venta
    const fechaVenc = new Date(fechaVenta)
    fechaVenc.setDate(fechaVenc.getDate() + (form.value.dias_garantia || 30))
    const data = {
      no_factura: form.value.no_factura, tipo_producto: form.value.tipo_producto,
      producto_id: form.value.producto_id, producto_nombre: productosDisponibles.value.find((x: any) => x.id === form.value.producto_id)?.nombre || '',
      imei: form.value.imei, serial: form.value.serial,
      cliente_nombre: form.value.cliente_nombre, cliente_telefono: form.value.cliente_telefono,
      fecha_venta: fechaVenta, fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
      dias_garantia: form.value.dias_garantia, estado: 'ACTIVA', nota: form.value.nota,
      usuario: '', almacen_id: almacenStore.activeId || 0,
    }
    const res = await (window as any).electron.invoke('db:insert', 'garantias', data)
    if (!res.success) throw new Error(res.error)
    dialogGarantia.value = false
    toast.add({ severity: 'success', summary: 'Garantia registrada', detail: data.producto_nombre, life: 3000 })
    await cargar()
  } catch (e: any) { errorGarantia.value = e.message || 'Error al registrar' }
  finally { guardando.value = false }
}

function abrirReclamo() {
  reclamoForm.value = { garantia_id: 0, descripcion: '' }
  busquedaReclamo.value = ''
  garantiasEncontradas.value = []
  garantiaSeleccionada.value = null
  errorReclamo.value = ''
  dialogReclamo.value = true
}

async function buscarGarantiasReclamo() {
  const texto = busquedaReclamo.value.toLowerCase().trim()
  if (!texto) { garantiasEncontradas.value = []; return }
  garantiasEncontradas.value = garantias.value.filter((g: any) =>
    g.estado === 'ACTIVA' && (
      (g.imei || '').toLowerCase().includes(texto) ||
      (g.serial || '').toLowerCase().includes(texto) ||
      (g.cliente_nombre || '').toLowerCase().includes(texto) ||
      (g.producto_nombre || '').toLowerCase().includes(texto)
    )
  ).slice(0, 10)
}

function seleccionarGarantiaReclamo(g: any) {
  reclamoForm.value.garantia_id = g.id
  garantiaSeleccionada.value = g
  garantiasEncontradas.value = []
  busquedaReclamo.value = ''
}

async function registrarReclamo() {
  if (!reclamoForm.value.garantia_id || !reclamoForm.value.descripcion.trim()) { errorReclamo.value = 'Selecciona una garantia y describe el problema'; return }
  guardando.value = true; errorReclamo.value = ''
  try {
    const data = { garantia_id: reclamoForm.value.garantia_id, descripcion: reclamoForm.value.descripcion.trim(), estado: 'PENDIENTE', fecha_ingreso: new Date().toISOString().split('T')[0], usuario: '' }
    const res = await (window as any).electron.invoke('db:insert', 'reclamos_garantia', data)
    if (!res.success) throw new Error(res.error)
    dialogReclamo.value = false
    toast.add({ severity: 'success', summary: 'Reclamo registrado', life: 3000 })
    await cargar()
  } catch (e: any) { errorReclamo.value = e.message || 'Error al registrar reclamo' }
  finally { guardando.value = false }
}

async function verReclamos(g: any) {
  garantiaReclamos.value = g
  const res = await (window as any).electron.invoke('db:getWhere', 'reclamos_garantia', 'garantia_id = ?', [g.id])
  reclamosLista.value = res.success ? (res.data || []) : []
  dialogVerReclamos.value = true
}

onMounted(cargar)
</script>
