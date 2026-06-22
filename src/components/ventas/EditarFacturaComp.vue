<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Calendar from 'primevue/calendar'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import TicketFacturaPrint from './TicketFacturaPrint.vue'
import FacturaPdfPrint from './FacturaPdfPrint.vue'
import { encryptarPassword } from '@/funciones/funciones.js'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const facturaId = computed(() => Number(route.params.id) || null)
const guardando = ref(false)
const todosIds = ref<number[]>([])
const indiceActual = computed(() => {
  const idx = todosIds.value.indexOf(Number(facturaId.value))
  return idx
})

function navegar(id: number | null) {
  if (id) router.push(`/ventas/editar/${id}`)
}

const ticketPrintRef = ref<any>(null)
const facturaPdfRef = ref<any>(null)

async function sincronizarFactura(datos: any) {
  try {
    const cfgRes = await window.db.getAll('servidor_sync_config')
    const cfg = cfgRes.success && cfgRes.data?.length > 0 ? cfgRes.data[0] : null
    if (!cfg || !cfg.activo) return
    const tablasSync: string[] = cfg.tablas_sync ? JSON.parse(cfg.tablas_sync) : []
    if (!tablasSync.includes('facturas')) return
    const baseUrl = String(cfg.servidor_url || '').replace(/\/+$/, '') + (String(cfg.api_path || '/api2')).replace(/\/+$/, '')
    const tokenRaw = cfg.token_hash || '1234567890abc'
    const token = tokenRaw.startsWith('$2b$') ? tokenRaw : await encryptarPassword(tokenRaw, 10)
    const camposRes = await fetch(`${baseUrl}/campos/facturas`, { method: 'GET', headers: { 'Accept': '*/*', 'Authorization': token } })
    if (!camposRes.ok) return
    const camposArr = await camposRes.json()
    const campos: string[] = (Array.isArray(camposArr) ? camposArr : []).map((c: any) => typeof c === 'string' ? c : (c.nombre || c.field || c.Field || '')).filter(Boolean)
    if (datos.productos && typeof datos.productos === 'string') { try { JSON.parse(datos.productos) } catch { datos.productos = JSON.stringify(datos.productos) } }
    if (datos.otro && typeof datos.otro !== 'string') datos.otro = JSON.stringify(datos.otro)
    const enviar: Record<string, any> = {}
    for (const campo of campos) {
      if (campo === 'id') continue
      if (datos[campo] !== undefined && datos[campo] !== null && datos[campo] !== '') enviar[campo] = String(datos[campo])
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
    if (servidorId) {
      enviar.id = servidorId
      await fetch(`${baseUrl}/actualizarcampos/facturas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token },
        body: JSON.stringify(enviar),
      })
    } else {
      await fetch(`${baseUrl}/insertar/facturas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token },
        body: JSON.stringify(enviar),
      })
    }
  } catch {}
}

function imprimirTicket() {
  ticketPrintRef.value?.printTicket(form.value)
}

function imprimirPdf() {
  facturaPdfRef.value?.printFactura(form.value)
}

const productosParsed = computed(() => {
  try {
    const p = JSON.parse(form.value.productos || '[]')
    return Array.isArray(p) ? p : []
  } catch { return [] }
})

const metodosPago = [
  { label: 'Efectivo', value: 'EFECTIVO' },
  { label: 'Tarjeta', value: 'TARJETA' },
  { label: 'Transferencia', value: 'TRANSFERENCIA' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Mixto', value: 'MIXTO' },
]

const tiposFactura = [
  { label: 'Factura de Venta', value: 'FACTURA_VENTA' },
  { label: 'Factura de Compra', value: 'FACTURA_COMPRA' },
  { label: 'Cotizacion', value: 'COTIZACION' },
  { label: 'Sin Comprobante', value: 'SIN COMPROBANTE' },
]

const estadosFactura = [
  { label: 'Pendiente', value: 'PENDIENTE' },
  { label: 'Pagada', value: 'PAGADA' },
  { label: 'Credito', value: 'CREDITO' },
  { label: 'Anulada', value: 'ANULADA' },
  { label: 'Cotizacion', value: 'COTIZACION' },
  { label: 'Convertida', value: 'CONVERTIDA' },
]

const form = ref({
  no_factura: '', nombre_cliente: '', telefono_cliente: '', cod_cliente: '',
  tipo_factura: 'FACTURA_VENTA', comprobante: '', metodo_pago: 'EFECTIVO',
  efectivo: 0, tarjeta: 0, transferencia: 0, cheque: 0,
  total: 0, subtotal: 0, impuesto: 0, descuento: 0, ganancia: 0,
  estado_factura: 'PENDIENTE', fecha_emision: new Date(), fecha_estado: new Date(),
  hora: '', vendedor: '', cajero: '', usuario: '', canal_venta: 'LOCAL',
  nota: '', productos: '', otro: '', token: '', financiera: '',
  mes: '', year: '', total_institucion: 0, total_cliente: 0, identificadordb: '',
})

function parseDate(val: any): Date {
  if (!val) return new Date()
  const d = new Date(val)
  return isNaN(d.getTime()) ? new Date() : d
}

function dateToStr(d: any): string {
  if (!d) return ''
  if (typeof d === 'string') return d
  if (isNaN(d.getTime?.())) return ''
  return d.toISOString().split('T')[0]
}

async function cargarDatos() {
  const res = await window.db.getAll('facturas')
  if (res.success && res.data) {
    todosIds.value = res.data.map((r: any) => r.id).sort((a: number, b: number) => a - b)
    if (facturaId.value) {
      const f = res.data.find((r: any) => r.id === facturaId.value)
      if (f) {
        form.value = {
          cheque: f.cheque || '', token: f.token || '', cajero: f.cajero || '',
          no_factura: f.no_factura || '', tipo_factura: f.tipo_factura || 'FACTURA_VENTA',
          comprobante: f.comprobante || '', cod_cliente: f.cod_cliente || '',
          nombre_cliente: f.nombre_cliente || '', telefono_cliente: f.telefono_cliente || '',
          productos: f.productos || '', vendedor: f.vendedor || '',
          metodo_pago: f.metodo_pago || 'EFECTIVO', tarjeta: f.tarjeta || 0,
          transferencia: f.transferencia || 0, efectivo: f.efectivo || 0,
          canal_venta: f.canal_venta || 'LOCAL', fecha_emision: parseDate(f.fecha_emision),
          impuesto: f.impuesto || 0, descuento: f.descuento || 0, subtotal: f.subtotal || 0,
          total: f.total || 0, ganancia: f.ganancia || 0, financiera: f.financiera || '',
          estado_factura: f.estado_factura || 'PENDIENTE',
          fecha_estado: parseDate(f.fecha_estado), mes: f.mes || '', year: f.year || '',
          hora: f.hora || '', otro: f.otro || '', nota: f.nota || '', usuario: f.usuario || '',
          identificadordb: f.identificadordb || '', total_institucion: f.total_institucion || 0,
          total_cliente: f.total_cliente || 0,
        }
      }
    }
  }
}

async function guardar() {
  if (!form.value.no_factura.trim() && !form.value.nombre_cliente.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'No. factura o nombre del cliente requerido', life: 3000 })
    return
  }
  guardando.value = true
  try {
    const data = {
      cheque: form.value.cheque.trim(), token: form.value.token.trim(),
      cajero: form.value.cajero.trim().toUpperCase(), no_factura: form.value.no_factura.trim().toUpperCase(),
      tipo_factura: form.value.tipo_factura, comprobante: form.value.comprobante.trim(),
      cod_cliente: form.value.cod_cliente.trim().toUpperCase(),
      nombre_cliente: form.value.nombre_cliente.trim().toUpperCase(),
      telefono_cliente: form.value.telefono_cliente.trim(), productos: form.value.productos,
      vendedor: form.value.vendedor.trim().toUpperCase(), metodo_pago: form.value.metodo_pago,
      tarjeta: form.value.tarjeta || 0, transferencia: form.value.transferencia || 0,
      efectivo: form.value.efectivo || 0, canal_venta: form.value.canal_venta,
      fecha_emision: dateToStr(form.value.fecha_emision), impuesto: form.value.impuesto || 0,
      descuento: form.value.descuento || 0, subtotal: form.value.subtotal || 0,
      total: form.value.total || 0, ganancia: form.value.ganancia || 0,
      financiera: form.value.financiera, estado_factura: form.value.estado_factura,
      fecha_estado: dateToStr(form.value.fecha_estado), mes: form.value.mes, year: form.value.year,
      hora: form.value.hora, otro: form.value.otro, nota: form.value.nota,
      usuario: form.value.usuario, identificadordb: form.value.identificadordb || '',
      total_institucion: form.value.total_institucion || 0, total_cliente: form.value.total_cliente || 0,
    }
    const res = await window.db.update('facturas', facturaId.value!, data)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Actualizada', detail: 'Factura actualizada', life: 3000 })
      await sincronizarFactura(data)
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo actualizar', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    guardando.value = false
  }
}

onMounted(cargarDatos)
</script>

<template>
  <div class="p-4 sm:p-6 max-w-4xl mx-auto">
    <Toast />
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push('/ventas')" />
        <h1 class="text-xl font-bold">Editar Factura</h1>
      </div>
      <div class="flex items-center gap-1">
        <Button icon="pi pi-angle-double-left" severity="secondary" text rounded size="small" :disabled="indiceActual <= 0" @click="navegar(todosIds[0])" v-tooltip="'Primera'" />
        <Button icon="pi pi-angle-left" severity="secondary" text rounded size="small" :disabled="indiceActual <= 0" @click="navegar(todosIds[indiceActual - 1])" v-tooltip="'Anterior'" />
        <span class="text-xs text-surface-500 mx-1">{{ indiceActual + 1 }} / {{ todosIds.length }}</span>
        <Button icon="pi pi-angle-right" severity="secondary" text rounded size="small" :disabled="indiceActual >= todosIds.length - 1" @click="navegar(todosIds[indiceActual + 1])" v-tooltip="'Siguiente'" />
        <Button icon="pi pi-angle-double-right" severity="secondary" text rounded size="small" :disabled="indiceActual >= todosIds.length - 1" @click="navegar(todosIds[todosIds.length - 1])" v-tooltip="'Ultima'" />
        <Button icon="pi pi-print" severity="info" text rounded size="small" @click="imprimirTicket" v-tooltip="'Imprimir ticket'" />
        <Button icon="pi pi-file-pdf" severity="danger" text rounded size="small" @click="imprimirPdf" v-tooltip="'Ver PDF'" />
        <Button label="Actualizar" icon="pi pi-check" :loading="guardando" @click="guardar" class="ml-2" />
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">No. Factura</label>
        <InputText v-model="form.no_factura" placeholder="No. factura" fluid />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Tipo Factura</label>
        <Select v-model="form.tipo_factura" :options="tiposFactura" optionLabel="label" optionValue="value" fluid />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Comprobante</label>
        <InputText v-model="form.comprobante" placeholder="NCF" fluid />
      </div>
      <div class="flex flex-col gap-1 md:col-span-3">
        <label class="font-semibold text-sm">Cliente</label>
        <InputText v-model="form.nombre_cliente" placeholder="Nombre del cliente" fluid class="uppercase" style="text-transform: uppercase;" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Codigo Cliente</label>
        <InputText v-model="form.cod_cliente" placeholder="RNC / Cedula" fluid />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Telefono</label>
        <InputText v-model="form.telefono_cliente" placeholder="Telefono" fluid />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Vendedor</label>
        <InputText v-model="form.vendedor" placeholder="Vendedor" fluid class="uppercase" style="text-transform: uppercase;" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Metodo Pago</label>
        <Select v-model="form.metodo_pago" :options="metodosPago" optionLabel="label" optionValue="value" fluid />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Estado</label>
        <Select v-model="form.estado_factura" :options="estadosFactura" optionLabel="label" optionValue="value" fluid />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Efectivo</label>
        <InputNumber v-model="form.efectivo" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Tarjeta</label>
        <InputNumber v-model="form.tarjeta" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Transferencia</label>
        <InputNumber v-model="form.transferencia" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Cheque</label>
        <InputNumber v-model="form.cheque" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Subtotal</label>
        <InputNumber v-model="form.subtotal" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Total</label>
        <InputNumber v-model="form.total" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Impuesto</label>
        <InputNumber v-model="form.impuesto" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Descuento</label>
        <InputNumber v-model="form.descuento" fluid @focus="(e: any) => e.target.select()" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-sm">Ganancia</label>
        <InputNumber v-model="form.ganancia" fluid @focus="(e: any) => e.target.select()" />
      </div>
    </div>

    <div v-if="productosParsed.length" class="mt-4">
      <h3 class="font-bold text-sm mb-2">Productos ({{ productosParsed.length }})</h3>
      <DataTable :value="productosParsed" stripedRows size="small" responsiveLayout="scroll">
        <Column field="nombre" header="Producto">
          <template #body="{ data }">{{ data.nombre || data.descripcion || data.producto || '—' }}</template>
        </Column>
        <Column field="cantidad" header="Cant" style="width: 4rem" />
        <Column field="precio" header="Precio" style="width: 7rem">
          <template #body="{ data }">${{ Number(data.precio || data.precio_venta || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 }) }}</template>
        </Column>
        <Column field="total" header="Total" style="width: 7rem">
          <template #body="{ data }">${{ Number(data.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 }) }}</template>
        </Column>
      </DataTable>
    </div>

      <div class="flex flex-col gap-1 md:col-span-2">
        <label class="font-semibold text-sm">Nota</label>
        <textarea v-model="form.nota" class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none" rows="2" />
      </div>

    <div class="flex justify-end gap-2 pt-4">
      <Button label="Cancelar" severity="secondary" text @click="router.push('/ventas')" />
    </div>

    <TicketFacturaPrint ref="ticketPrintRef" />
    <FacturaPdfPrint ref="facturaPdfRef" />
  </div>
</template>
