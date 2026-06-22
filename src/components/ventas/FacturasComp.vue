<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import InputOtp from 'primevue/inputotp'
import Select from 'primevue/select'
import Calendar from 'primevue/calendar'
import Fieldset from 'primevue/fieldset'
import Menu from 'primevue/menu'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import TicketFacturaPrint from './TicketFacturaPrint.vue'
import FacturaPdfPrint from './FacturaPdfPrint.vue'

import { envioElectron } from '@/funciones/funciones.js'

const toast = useToast()
const router = useRouter()
const facturas = ref<any[]>([])
const loading = ref(false)
const viewMode = ref<'table' | 'cards'>('table')
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const deleteOtpEnviado = ref(false)
const deleteOtpLoading = ref(false)
const deleteOtpConfirmando = ref(false)
const deleteOtp = ref('')
const deleteOtpEmail = ref('')
const deleteOtpError = ref('')
const isEditing = ref(false)
const selectedFactura = ref<any>(null)
const selectedFacturas = ref<any[]>([])
const busqueda = ref('')
const rangoActivo = ref<string>('todo')
const rangoPersonalizado = ref<Date[]>([])
const comprobanteFiltro = ref('')

const actionMenu = ref()
const facturaAccion = ref<any>(null)
const actionMenuItems = ref([
  { label: 'Imprimir', icon: 'pi pi-print', command: () => imprimirFactura(facturaAccion.value) },
  { label: 'Ver PDF', icon: 'pi pi-file-pdf', command: () => verFacturaPdf(facturaAccion.value) },
  { label: 'Editar', icon: 'pi pi-pencil', command: () => abrirEditar(facturaAccion.value) },
  { label: 'WhatsApp', icon: 'pi pi-whatsapp', command: () => compartirWhatsAppFactura(facturaAccion.value) },
  { separator: true },
  { label: 'Eliminar', icon: 'pi pi-trash', command: () => confirmarBorrar(facturaAccion.value) },
])

function toggleActionMenu(event: Event, factura: any) {
  facturaAccion.value = factura
  actionMenu.value.toggle(event)
}

async function compartirWhatsAppFactura(factura: any) {
  const telefono = factura.telefono_cliente || ''
  if (!telefono) {
    toast.add({ severity: 'warn', summary: 'WhatsApp', detail: 'El cliente no tiene telefono registrado', life: 3000 })
    return
  }
  const mensaje = encodeURIComponent(
    `Factura ${factura.no_factura}\nTotal: RD$${Number(factura.total).toFixed(2)}\nCliente: ${factura.nombre_cliente}\nFecha: ${factura.fecha_emision}`
  )
  window.open(`https://wa.me/${telefono.replace(/[^0-9]/g, '')}?text=${mensaje}`, '_blank')
}

function getRango(key: string): { inicio: string; fin: string } | null {
  if (key === 'todo') return null
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
    case 'personalizado': {
      if (rangoPersonalizado.value.length === 2 && rangoPersonalizado.value[0] && rangoPersonalizado.value[1])
        return { inicio: y(rangoPersonalizado.value[0]), fin: y(rangoPersonalizado.value[1]) }
      return null
    }
    default: return { inicio: y(now), fin: y(now) }
  }
}

const rango = computed(() => getRango(rangoActivo.value))

const comprobantesLista = ref<string[]>([])

const ticketPrintRef = ref<any>(null)
const facturaPdfRef = ref<any>(null)

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
  { label: 'Nota de Debito', value: 'NOTA_DEBITO' },
  { label: 'Nota de Credito', value: 'NOTA_CREDITO' },
  { label: 'Proforma', value: 'PROFORMA' },
]

const estadosFactura = [
  { label: 'Pendiente', value: 'PENDIENTE' },
  { label: 'Pagada', value: 'PAGADA' },
  { label: 'Anulada', value: 'ANULADA' },
  { label: 'Vencida', value: 'VENCIDA' },
  { label: 'Crediticio', value: 'CREDITICIO' },
]

const canalesVenta = [
  { label: 'Local', value: 'LOCAL' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Telefono', value: 'TELEFONO' },
  { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'Otro', value: 'OTRO' },
]

const link = ref('')
const api = ref('')
const token = ref('')
const patronTelefono = ref('')
const linkImpresora = ref('')
const patroncedula = ref('')
const tokenCorto = ref('')

const formDefault = () => ({
  cheque: '',
  token: '',
  cajero: '',
  no_factura: '',
  tipo_factura: 'FACTURA_VENTA',
  comprobante: '',
  cod_cliente: '',
  nombre_cliente: '',
  telefono_cliente: '',
  productos: '',
  vendedor: '',
  metodo_pago: 'EFECTIVO',
  tarjeta: 0,
  transferencia: 0,
  efectivo: 0,
  canal_venta: 'LOCAL',
  fecha_emision: new Date(),
  impuesto: 0,
  descuento: 0,
  subtotal: 0,
  total: 0,
  ganancia: 0,
  financiera: '',
  estado_factura: 'PENDIENTE',
  fecha_estado: new Date(),
  mes: '',
  year: '',
  hora: '',
  otro: '',
  nota: '',
  usuario: '',
  identificadordb: '',
  total_institucion: 0,
  total_cliente: 0,
})

const form = ref(formDefault())

const facturasFiltradas = computed(() => {
  let items = facturas.value

  if (rango.value) {
    items = items.filter((f: any) =>
      f.fecha_emision >= rango.value!.inicio && f.fecha_emision <= rango.value!.fin
    )
  }

  if (comprobanteFiltro.value) {
    items = items.filter((f: any) => f.comprobante === comprobanteFiltro.value)
  }

  const texto = busqueda.value.toLowerCase().trim()
  if (texto) {
    items = items.filter(f =>
      f.no_factura?.toLowerCase().includes(texto) ||
      f.nombre_cliente?.toLowerCase().includes(texto) ||
      f.telefono_cliente?.toLowerCase().includes(texto) ||
      f.estado_factura?.toLowerCase().includes(texto) ||
      f.total?.toString().includes(texto) ||
      f.comprobante?.toLowerCase().includes(texto)
    )
  }

  return items
})

const facturasParaEliminar = computed(() => {
  if (selectedFactura.value) return [selectedFactura.value]
  return selectedFacturas.value || []
})

const totalSeleccionadoEliminar = computed(() =>
  facturasParaEliminar.value.reduce((sum, factura) => sum + Number(factura?.total || 0), 0)
)

function formatCurrency(n: number): string {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFecha(fechaStr: string): string {
  if (!fechaStr) return ''
  const parts = fechaStr.split('-')
  if (parts.length !== 3) return fechaStr
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  if (isNaN(d.getTime())) return fechaStr
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function getEstadoSeverity(estado: string): string {
  switch (estado) {
    case 'PAGADA': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'ANULADA': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    case 'VENCIDA': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    case 'CREDITICIO': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
  }
}

async function cargarFacturas() {
  loading.value = true
  try {
    const res = await window.db.getAll('facturas')
    if (res.success) {
      facturas.value = res.data || []
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudieron cargar las facturas', life: 3000 })
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

function abrirCrear() {
  isEditing.value = false
  selectedFactura.value = null
  form.value = formDefault()
  dialogVisible.value = true
}

function abrirEditar(factura: any) {
  router.push(`/ventas/editar/${factura.id}`)
}

function confirmarBorrar(factura: any) {
  selectedFactura.value = factura
  deleteOtpEnviado.value = false
  deleteOtp.value = ''
  deleteOtpEmail.value = ''
  deleteOtpError.value = ''
  deleteDialogVisible.value = true
}

function confirmarBorrarSeleccionadas() {
  if (!selectedFacturas.value.length) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona al menos una factura', life: 2500 })
    return
  }
  selectedFactura.value = null
  deleteOtpEnviado.value = false
  deleteOtp.value = ''
  deleteOtpEmail.value = ''
  deleteOtpError.value = ''
  deleteDialogVisible.value = true
}

async function solicitarOtpEliminarFactura() {
  const facturas = facturasParaEliminar.value
  if (!facturas.length) return
  deleteOtpError.value = ''
  deleteOtp.value = ''
  deleteOtpLoading.value = true
  try {
    const res = await window.electron.invoke('facturas:solicitarOtpEliminar', {
      id: facturas[0]?.id,
      facturaIds: facturas.map(f => f.id),
      no_factura: facturas.length === 1 ? facturas[0]?.no_factura : '',
      nombre_cliente: facturas.length === 1 ? facturas[0]?.nombre_cliente : '',
      cantidad: facturas.length,
      total: totalSeleccionadoEliminar.value,
    }) as any
    if (res.success) {
      deleteOtpEmail.value = res.data?.email || ''
      deleteOtpEnviado.value = true
      toast.add({ severity: 'success', summary: 'Codigo enviado', detail: 'Revisa el correo de la empresa', life: 3000 })
    } else {
      deleteOtpError.value = res.error || 'No se pudo enviar el codigo'
    }
  } catch (e: any) {
    deleteOtpError.value = e.message || 'Error solicitando codigo'
  } finally {
    deleteOtpLoading.value = false
  }
}

function dateToStr(d: Date | string): string {
  if (!d) return ''
  if (typeof d === 'string') return d
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

async function guardar() {
  if (!form.value.no_factura.trim() && !form.value.nombre_cliente.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El numero de factura o nombre del cliente es requerido', life: 3000 })
    return
  }

  try {
    const data = {
      cheque: form.value.cheque.trim(),
      token: form.value.token.trim(),
      cajero: form.value.cajero.trim().toUpperCase(),
      no_factura: form.value.no_factura.trim().toUpperCase(),
      tipo_factura: form.value.tipo_factura,
      comprobante: form.value.comprobante.trim(),
      cod_cliente: form.value.cod_cliente.trim().toUpperCase(),
      nombre_cliente: form.value.nombre_cliente.trim().toUpperCase(),
      telefono_cliente: form.value.telefono_cliente.trim(),
      productos: form.value.productos,
      vendedor: form.value.vendedor.trim().toUpperCase(),
      metodo_pago: form.value.metodo_pago,
      tarjeta: form.value.tarjeta || 0,
      transferencia: form.value.transferencia || 0,
      efectivo: form.value.efectivo || 0,
      canal_venta: form.value.canal_venta,
      fecha_emision: dateToStr(form.value.fecha_emision),
      impuesto: form.value.impuesto || 0,
      descuento: form.value.descuento || 0,
      subtotal: form.value.subtotal || 0,
      total: form.value.total || 0,
      ganancia: form.value.ganancia || 0,
      financiera: form.value.financiera,
      estado_factura: form.value.estado_factura,
      fecha_estado: dateToStr(form.value.fecha_estado),
      mes: form.value.mes,
      year: form.value.year,
      hora: form.value.hora,
      otro: form.value.otro.trim().toUpperCase(),
      nota: form.value.nota.trim().toUpperCase(),
      usuario: form.value.usuario.trim().toUpperCase(),
      identificadordb: form.value.identificadordb.trim(),
      total_institucion: form.value.total_institucion || 0,
      total_cliente: form.value.total_cliente || 0,
    }

    if (isEditing.value) {
      const res = await window.db.update('facturas', selectedFactura.value.id, data)
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Exito', detail: 'Factura actualizada', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo actualizar', life: 3000 })
        return
      }
    } else {
      const res = await window.db.insert('facturas', data)
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Exito', detail: 'Factura creada', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear', life: 3000 })
        return
      }
    }

    dialogVisible.value = false
    await cargarFacturas()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 })
  }
}

async function borrar() {
  try {
    const facturas = facturasParaEliminar.value
    if (!facturas.length) return
    deleteOtpError.value = ''
    const codigo = String(deleteOtp.value || '').replace(/\D/g, '')
    if (!/^\d{4}$/.test(codigo)) {
      deleteOtpError.value = 'Introduce el codigo de 4 digitos'
      return
    }
    deleteOtpConfirmando.value = true
    const otpRes = await window.electron.invoke('facturas:confirmarOtpEliminar', {
      facturaId: facturas[0]?.id,
      facturaIds: facturas.map(f => f.id),
      codigo,
    }) as any
    if (!otpRes.success) {
      deleteOtpError.value = otpRes.error || 'Codigo no valido'
      return
    }

    let eliminadas = 0
    for (const factura of facturas) {
      const res = await window.db.delete('facturas', factura.id)
      if (res.success) eliminadas++
      else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || `No se pudo eliminar ${factura.no_factura || factura.id}`, life: 3000 })
        return
      }
    }
    toast.add({ severity: 'success', summary: 'Exito', detail: `${eliminadas} factura(s) eliminada(s)`, life: 3000 })
    deleteDialogVisible.value = false
    selectedFacturas.value = []
    selectedFactura.value = null
    await cargarFacturas()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
  } finally {
    deleteOtpConfirmando.value = false
  }
}

async function imprimirFactura(factura: any) {
  ticketPrintRef.value?.printTicket(factura)
}

async function verFacturaPdf(factura: any) {
  facturaPdfRef.value?.printFactura(factura)
}

onMounted(async () => {
  try {
    const datosJSON = await envioElectron('datosarchivo')
    if (datosJSON) {
      link.value = datosJSON.VITE_LINKURL || ''
      api.value = datosJSON.VITE_LINK_API || ''
      token.value = datosJSON.VITE_TOKEN || ''
      patronTelefono.value = datosJSON.VITE_PATRON_TELEFONO || ''
      linkImpresora.value = datosJSON.VITE_IMPRESORA_LOCAL || ''
      patroncedula.value = datosJSON.VITE_PATRON_CEDULA || ''
      tokenCorto.value = datosJSON.VITE_TOKEN_CORTO || ''
    }
  } catch (error) {
    console.error('Error cargando configuracion:', error)
  }

  await cargarFacturas()

  try {
    const res = await window.db.getAll('comprobantes_fiscales')
    if (res.success) {
      comprobantesLista.value = (res.data || []).map((c: any) => c.tipo).filter(Boolean) as string[]
    }
  } catch (_) {}
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Facturas">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar factura..." />
        </IconField>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex flex-wrap gap-1">
            <Button
              v-for="item in [
                { label: 'Todo', key: 'todo' },
                { label: 'Hoy', key: 'hoy' },
                { label: 'Ayer', key: 'ayer' },
                { label: 'Semana', key: 'semana' },
                { label: 'Mes', key: 'mes' },
                { label: 'Rango', key: 'personalizado' },
              ]"
              :key="item.key"
              :label="item.label"
              size="small"
              :severity="rangoActivo === item.key ? 'primary' : 'secondary'"
              :outlined="rangoActivo !== item.key"
              @click="rangoActivo = item.key"
            />
          </div>

          <Calendar
            v-if="rangoActivo === 'personalizado'"
            v-model="rangoPersonalizado"
            selectionMode="range"
            dateFormat="yy-mm-dd"
            placeholder="Seleccionar rango"
            showIcon
          />

          <Select
            v-model="comprobanteFiltro"
            :options="comprobantesLista"
            placeholder="Comprobante"
            clearable
            class="w-36"
            size="small"
          />
        </div>

        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            <button
              class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
              :class="viewMode === 'table'
                ? 'bg-primary text-primary-contrast'
                : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="viewMode = 'table'"
            >
              <i class="pi pi-list"></i>
            </button>
            <button
              class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border-l border-surface-200 dark:border-surface-700"
              :class="viewMode === 'cards'
                ? 'bg-primary text-primary-contrast'
                : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="viewMode = 'cards'"
            >
              <i class="pi pi-th-large"></i>
            </button>
          </div>
          <Button
            v-if="selectedFacturas.length"
            :label="`Eliminar (${selectedFacturas.length})`"
            icon="pi pi-trash"
            severity="danger"
            @click="confirmarBorrarSeleccionadas"
          />
          <Button label="Nueva Factura" icon="pi pi-plus" @click="abrirCrear" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        v-model:selection="selectedFacturas"
        :value="facturasFiltradas"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem" />
        <Column header="Acciones" style="width: 5rem">
          <template #body="{ data }">
            <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded @click.stop="toggleActionMenu($event, data)" v-tooltip="'Acciones'" />
          </template>
        </Column>
        <Column field="id" header="ID" style="width: 5rem" />
        <Column field="no_factura" header="No. Factura" sortable style="width: 10rem" />
        <Column field="comprobante" header="Comprobante" sortable style="width: 8rem" />
        <Column field="nombre_cliente" header="Cliente" sortable />
        <Column field="fecha_emision" header="Fecha Emision" sortable style="width: 9rem">
          <template #body="{ data }">{{ formatFecha(data.fecha_emision) }}</template>
        </Column>
        <Column field="total" header="Total" sortable style="width: 10rem">
          <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
        </Column>
        <Column field="metodo_pago" header="Pago" sortable style="width: 9rem" />
        <Column field="estado_factura" header="Estado" sortable style="width: 9rem">
          <template #body="{ data }">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="getEstadoSeverity(data.estado_factura)">
              {{ data.estado_factura || 'PENDIENTE' }}
            </span>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay facturas registradas.</div>
        </template>
      </DataTable>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="facturasFiltradas.length === 0" class="text-center py-10 text-surface-500">No hay facturas registradas.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="factura in facturasFiltradas"
            :key="factura.id"
            class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer"
            @click="abrirEditar(factura)"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono text-surface-400">#{{ factura.id }}</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="getEstadoSeverity(factura.estado_factura)">
                {{ factura.estado_factura || 'PENDIENTE' }}
              </span>
            </div>

            <div class="min-w-0">
              <h4 class="font-bold text-base leading-tight truncate">{{ factura.no_factura || 'Sin numero' }}</h4>
              <p class="text-sm text-surface-500 dark:text-surface-400 truncate">{{ factura.nombre_cliente || 'Sin cliente' }}</p>
            </div>

            <div class="grid grid-cols-1 gap-1 text-sm">
              <div class="flex items-center gap-2 min-w-0">
                <i class="pi pi-calendar text-surface-400"></i>
                <span class="truncate">{{ formatFecha(factura.fecha_emision) || '--' }}</span>
              </div>
              <div class="flex items-center gap-2 min-w-0">
                <i class="pi pi-dollar text-surface-400"></i>
                <span class="truncate font-semibold">${{ formatCurrency(factura.total) }}</span>
              </div>
              <div class="flex items-center gap-2 min-w-0">
                <i class="pi pi-credit-card text-surface-400"></i>
                <span class="truncate">{{ factura.metodo_pago || '--' }}</span>
              </div>
            </div>

            <div class="flex gap-2 mt-auto pt-2 border-t border-surface-100 dark:border-surface-700">
              <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small" @click.stop="toggleActionMenu($event, factura)" v-tooltip="'Acciones'" />
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <EditarFacturaComp
      :factura-id="editingFacturaId"
      :visible="dialogEditarVisible"
      @close="dialogEditarVisible = false"
      @saved="dialogEditarVisible = false; cargarFacturas()"
    />

    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Eliminar factura"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
          <span v-if="facturasParaEliminar.length === 1">Seguro que deseas eliminar la factura <strong>{{ facturasParaEliminar[0]?.no_factura }}</strong>?</span>
          <span v-else>Seguro que deseas eliminar <strong>{{ facturasParaEliminar.length }}</strong> facturas seleccionadas?</span>
        </div>
        <div v-if="facturasParaEliminar.length > 1" class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
          Total combinado: <strong>RD$ {{ formatCurrency(totalSeleccionadoEliminar) }}</strong>
        </div>
        <div v-if="deleteOtpEnviado" class="flex flex-col items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
          <p class="text-xs text-surface-500 text-center">
            Enviamos un codigo de 4 digitos al correo {{ deleteOtpEmail || 'de la licencia' }}.
          </p>
          <InputOtp v-model="deleteOtp" :length="4" integerOnly />
        </div>
        <p v-if="deleteOtpError" class="text-red-500 text-xs text-center">{{ deleteOtpError }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button
          v-if="!deleteOtpEnviado"
          label="Enviar OTP"
          icon="pi pi-envelope"
          severity="danger"
          :loading="deleteOtpLoading"
          @click="solicitarOtpEliminarFactura"
        />
        <Button
          v-else
          label="Eliminar"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleteOtpConfirmando"
          @click="borrar"
        />
      </template>
    </Dialog>
    <TicketFacturaPrint ref="ticketPrintRef" />
    <FacturaPdfPrint ref="facturaPdfRef" />
    <Menu ref="actionMenu" :model="actionMenuItems" popup />
  </div>
</template>
