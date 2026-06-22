<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
import Tag from 'primevue/tag'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import FacturaPdfPrint from './FacturaPdfPrint.vue'

const toast = useToast()
const cotizaciones = ref<any[]>([])
const loading = ref(false)
const busqueda = ref('')
const filtroEstado = ref('')
const dialogDetalle = ref(false)
const selectedCot = ref<any>(null)
const selectedCotizaciones = ref<any[]>([])
const facturaPdfRef = ref<any>(null)
const deleteDialogVisible = ref(false)
const deleteOtpEnviado = ref(false)
const deleteOtpLoading = ref(false)
const deleteOtpConfirmando = ref(false)
const deleteOtp = ref('')
const deleteOtpEmail = ref('')
const deleteOtpError = ref('')

const dialogConvertir = ref(false)
const metodoPagoConvertir = ref('EFECTIVO')
const convirtiendo = ref(false)

const metodosPago = [
  { label: 'Efectivo', value: 'EFECTIVO' },
  { label: 'Tarjeta', value: 'TARJETA' },
  { label: 'Transferencia', value: 'TRANSFERENCIA' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Credito', value: 'CREDITO' },
  { label: 'Mixto', value: 'MIXTO' },
]

const estados = [
  { label: 'Todas', value: '' },
  { label: 'Cotizacion', value: 'COTIZACION' },
  { label: 'Aprobada', value: 'APROBADA' },
  { label: 'Vencida', value: 'VENCIDA' },
  { label: 'Convertida', value: 'CONVERTIDA' },
  { label: 'Rechazada', value: 'RECHAZADA' },
]

const cotizacionesFiltradas = computed(() => {
  let data = cotizaciones.value
  const texto = busqueda.value.toLowerCase().trim()
  if (texto) {
    data = data.filter(c =>
      c.no_factura?.toLowerCase().includes(texto) ||
      c.nombre_cliente?.toLowerCase().includes(texto) ||
      c.telefono_cliente?.toLowerCase().includes(texto)
    )
  }
  if (filtroEstado.value) {
    data = data.filter(c => c.estado_factura === filtroEstado.value)
  }
  return data
})

const cotizacionesParaEliminar = computed(() => {
  if (selectedCot.value && deleteDialogVisible.value) return [selectedCot.value]
  return selectedCotizaciones.value || []
})

const totalSeleccionadoEliminar = computed(() =>
  cotizacionesParaEliminar.value.reduce((sum, cot) => sum + Number(cot?.total || 0), 0)
)

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFecha(fechaStr: string): string {
  if (!fechaStr) return ''
  const d = new Date(fechaStr)
  if (isNaN(d.getTime())) return fechaStr
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined {
  switch (estado) {
    case 'COTIZACION': return 'info'
    case 'APROBADA': return 'success'
    case 'VENCIDA': return 'danger'
    case 'CONVERTIDA': return 'warn'
    case 'RECHAZADA': return 'secondary'
    default: return 'info'
  }
}

async function cargarCotizaciones() {
  loading.value = true
  try {
    const res = await window.db.getAll('facturas')
    if (res.success) {
      cotizaciones.value = (res.data || []).filter((f: any) =>
        f.tipo_factura === 'COTIZACION' || f.estado_factura === 'COTIZACION'
      )
    }
  } catch (_) {}
  loading.value = false
}

function abrirDetalle(cot: any) {
  selectedCot.value = cot
  dialogDetalle.value = true
}

function resetDeleteOtp() {
  deleteOtpEnviado.value = false
  deleteOtp.value = ''
  deleteOtpEmail.value = ''
  deleteOtpError.value = ''
}

function confirmarBorrar(cot: any) {
  selectedCot.value = cot
  resetDeleteOtp()
  deleteDialogVisible.value = true
}

function confirmarBorrarSeleccionadas() {
  if (!selectedCotizaciones.value.length) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona al menos una cotizacion', life: 2500 })
    return
  }
  selectedCot.value = null
  resetDeleteOtp()
  deleteDialogVisible.value = true
}

async function solicitarOtpEliminarCotizacion() {
  const cotizaciones = cotizacionesParaEliminar.value
  if (!cotizaciones.length) return
  deleteOtpError.value = ''
  deleteOtp.value = ''
  deleteOtpLoading.value = true
  try {
    const res = await window.electron.invoke('facturas:solicitarOtpEliminar', {
      id: cotizaciones[0]?.id,
      facturaIds: cotizaciones.map(c => c.id),
      no_factura: cotizaciones.length === 1 ? cotizaciones[0]?.no_factura : '',
      nombre_cliente: cotizaciones.length === 1 ? cotizaciones[0]?.nombre_cliente : '',
      cantidad: cotizaciones.length,
      total: totalSeleccionadoEliminar.value,
      entidad: 'cotizacion',
      entidadPlural: 'cotizaciones',
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

async function borrarCotizaciones() {
  const cotizaciones = cotizacionesParaEliminar.value
  if (!cotizaciones.length) return
  deleteOtpError.value = ''
  const codigo = String(deleteOtp.value || '').replace(/\D/g, '')
  if (!/^\d{4}$/.test(codigo)) {
    deleteOtpError.value = 'Introduce el codigo de 4 digitos'
    return
  }

  deleteOtpConfirmando.value = true
  try {
    const otpRes = await window.electron.invoke('facturas:confirmarOtpEliminar', {
      facturaId: cotizaciones[0]?.id,
      facturaIds: cotizaciones.map(c => c.id),
      codigo,
    }) as any
    if (!otpRes.success) {
      deleteOtpError.value = otpRes.error || 'Codigo no valido'
      return
    }

    let eliminadas = 0
    for (const cotizacion of cotizaciones) {
      const res = await window.db.delete('facturas', cotizacion.id)
      if (res.success) eliminadas++
      else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || `No se pudo eliminar ${cotizacion.no_factura || cotizacion.id}`, life: 3000 })
        return
      }
    }
    toast.add({ severity: 'success', summary: 'Exito', detail: `${eliminadas} cotizacion(es) eliminada(s)`, life: 3000 })
    deleteDialogVisible.value = false
    dialogDetalle.value = false
    selectedCot.value = null
    selectedCotizaciones.value = []
    await cargarCotizaciones()
  } catch (_) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
  } finally {
    deleteOtpConfirmando.value = false
  }
}

const productosCotizacion = computed(() => {
  if (!selectedCot.value?.productos) return []
  try {
    const data = JSON.parse(selectedCot.value.productos)
    return Array.isArray(data) ? data : []
  } catch { return [] }
})

function abrirConvertir() {
  metodoPagoConvertir.value = 'EFECTIVO'
  dialogConvertir.value = true
}

async function confirmarConvertir() {
  if (!selectedCot.value) return
  convirtiendo.value = true
  try {
    const now = new Date()
    const fechaStr = now.toISOString().split('T')[0]
    const horaStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    const newInvoiceNo = `F-${y}${m}${d}-${h}${min}${s}`

    await window.db.update('facturas', selectedCot.value.id, {
      estado_factura: 'CONVERTIDA',
    })

    await window.db.insert('facturas', {
      ...selectedCot.value,
      id: undefined,
      no_factura: newInvoiceNo,
      tipo_factura: 'FACTURA_VENTA',
      estado_factura: metodoPagoConvertir.value === 'CREDITO' ? 'CREDITO' : 'PAGADA',
      metodo_pago: metodoPagoConvertir.value,
      efectivo: metodoPagoConvertir.value === 'EFECTIVO' || metodoPagoConvertir.value === 'MIXTO' ? selectedCot.value.total : 0,
      tarjeta: metodoPagoConvertir.value === 'TARJETA' ? selectedCot.value.total : 0,
      transferencia: metodoPagoConvertir.value === 'TRANSFERENCIA' ? selectedCot.value.total : 0,
      cheque: metodoPagoConvertir.value === 'CHEQUE' ? selectedCot.value.total : 0,
      hora: horaStr,
      fecha_emision: fechaStr,
    })
    if (metodoPagoConvertir.value === 'CREDITO') {
      await window.db.insert('cuentas_cobrar', {
        no_factura: newInvoiceNo,
        nombre_cliente: selectedCot.value.nombre_cliente || 'CONSUMIDOR FINAL',
        telefono_cliente: selectedCot.value.telefono_cliente || '',
        total: selectedCot.value.total,
        abonado: 0,
        saldo: selectedCot.value.total,
        fecha_venta: fechaStr,
        estado: 'ACTIVA',
      })
    }
    toast.add({ severity: 'success', summary: 'Convertida', detail: 'Cotizacion convertida a factura', life: 3000 })
    dialogConvertir.value = false
    dialogDetalle.value = false
    await cargarCotizaciones()
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  } finally {
    convirtiendo.value = false
  }
}

async function cambiarEstado(cotizacion: any, estado: string) {
  await window.db.update('facturas', cotizacion.id, { estado_factura: estado })
  cotizacion.estado_factura = estado
  toast.add({ severity: 'success', summary: 'Estado actualizado', detail: estado, life: 2000 })
}

function verPdf() {
  facturaPdfRef.value?.printFactura(selectedCot.value)
}

onMounted(cargarCotizaciones)
</script>

<template>
  <div>
    <Toast />
    <FacturaPdfPrint ref="facturaPdfRef" />

    <Fieldset legend="Cotizaciones">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="busqueda" placeholder="Buscar cotizacion..." />
          </IconField>
          <Select v-model="filtroEstado" :options="estados" optionLabel="label" optionValue="value" placeholder="Estado" class="w-36" fluid />
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="selectedCotizaciones.length"
            :label="`Eliminar (${selectedCotizaciones.length})`"
            icon="pi pi-trash"
            severity="danger"
            @click="confirmarBorrarSeleccionadas"
          />
          <Button label="Actualizar" icon="pi pi-refresh" severity="secondary" @click="cargarCotizaciones" />
        </div>
      </div>

      <DataTable
        v-model:selection="selectedCotizaciones"
        :value="cotizacionesFiltradas"
        :loading="loading"
        stripedRows
        paginator
        :rows="15"
        :rowsPerPageOptions="[15, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
        @row-click="abrirDetalle($event.data)"
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem" />
        <Column header="Acciones" style="width: 5rem">
          <template #body="{ data }">
            <Button icon="pi pi-trash" severity="danger" text rounded @click.stop="confirmarBorrar(data)" v-tooltip="'Eliminar'" />
          </template>
        </Column>
        <Column field="no_factura" header="No." sortable style="width: 8rem" />
        <Column field="nombre_cliente" header="Cliente" sortable />
        <Column field="total" header="Total" sortable style="width: 8rem">
          <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
        </Column>
        <Column field="fecha_emision" header="Fecha" sortable style="width: 7rem">
          <template #body="{ data }">{{ formatFecha(data.fecha_emision) }}</template>
        </Column>
        <Column field="estado_factura" header="Estado" sortable style="width: 8rem">
          <template #body="{ data }">
            <Tag :value="data.estado_factura || 'COTIZACION'" :severity="getEstadoSeverity(data.estado_factura)" />
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay cotizaciones.</div>
        </template>
      </DataTable>
    </Fieldset>

    <Dialog v-model:visible="dialogDetalle" :header="`Cotizacion: ${selectedCot?.no_factura || ''}`" modal :style="{ width: '90%', maxWidth: '700px' }">
      <div v-if="selectedCot" class="space-y-4 pt-2">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-surface-400 text-xs">No.</span>
            <p class="font-semibold">{{ selectedCot.no_factura || '—' }}</p>
          </div>
          <div>
            <span class="text-surface-400 text-xs">Estado</span>
            <Tag :value="selectedCot.estado_factura || 'COTIZACION'" :severity="getEstadoSeverity(selectedCot.estado_factura)" />
          </div>
          <div class="col-span-2">
            <span class="text-surface-400 text-xs">Cliente</span>
            <p class="font-medium">{{ selectedCot.nombre_cliente || 'CONSUMIDOR FINAL' }}</p>
          </div>
          <div>
            <span class="text-surface-400 text-xs">Total</span>
            <p class="font-bold text-primary">${{ formatCurrency(selectedCot.total) }}</p>
          </div>
          <div>
            <span class="text-surface-400 text-xs">Metodo Pago</span>
            <p>{{ selectedCot.metodo_pago || '—' }}</p>
          </div>
        </div>

        <div v-if="productosCotizacion.length" class="text-sm">
          <span class="text-surface-400 text-xs font-semibold mb-1 block">Productos</span>
          <DataTable :value="productosCotizacion" stripedRows class="p-datatable-sm" responsiveLayout="scroll">
            <Column field="cantidad" header="Cant" style="width: 4rem">
              <template #body="{ data }">{{ data.cantidad || data.quantity || 1 }}</template>
            </Column>
            <Column field="nombre" header="Producto">
              <template #body="{ data }">{{ data.nombre || data.descripcion || data.producto || '—' }}</template>
            </Column>
            <Column field="precio" header="Precio" style="width: 7rem">
              <template #body="{ data }">${{ formatCurrency(data.precio || data.precio_venta || 0) }}</template>
            </Column>
            <Column header="Total" style="width: 7rem">
              <template #body="{ data }">${{ formatCurrency((data.precio || data.precio_venta || 0) * (data.cantidad || data.quantity || 1)) }}</template>
            </Column>
          </DataTable>
        </div>

        <div class="border-t border-surface-200 dark:border-surface-700 pt-3 flex flex-wrap gap-2">
          <Button label="Aprobar" icon="pi pi-check" severity="success" size="small" @click="abrirConvertir" />
          <Button label="Vencida" icon="pi pi-clock" severity="danger" size="small" @click="cambiarEstado(selectedCot, 'VENCIDA')" />
          <Button label="Rechazar" icon="pi pi-times" severity="secondary" size="small" @click="cambiarEstado(selectedCot, 'RECHAZADA')" />
          <Button label="Eliminar" icon="pi pi-trash" severity="danger" size="small" outlined @click="confirmarBorrar(selectedCot)" />
        </div>
      </div>

      <template #footer>
        <Button label="Ver PDF" icon="pi pi-file-pdf" severity="danger" @click="verPdf" />
        <Button label="Cerrar" severity="secondary" text @click="dialogDetalle = false" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogConvertir" header="Convertir a Factura" modal :style="{ width: '90%', maxWidth: '450px' }">
      <div class="space-y-4 pt-2">
        <p class="text-sm text-surface-500">Selecciona el metodo de pago para la factura:</p>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Metodo de Pago</label>
          <Select v-model="metodoPagoConvertir" :options="metodosPago" optionLabel="label" optionValue="value" fluid />
        </div>
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-surface-500">Total</span>
            <span class="font-bold">${{ formatCurrency(selectedCot?.total || 0) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Cliente</span>
            <span>{{ selectedCot?.nombre_cliente || 'CONSUMIDOR FINAL' }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogConvertir = false" />
        <Button label="Convertir" icon="pi pi-check" :loading="convirtiendo" @click="confirmarConvertir" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Eliminar cotizacion"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
          <span v-if="cotizacionesParaEliminar.length === 1">Seguro que deseas eliminar la cotizacion <strong>{{ cotizacionesParaEliminar[0]?.no_factura }}</strong>?</span>
          <span v-else>Seguro que deseas eliminar <strong>{{ cotizacionesParaEliminar.length }}</strong> cotizaciones seleccionadas?</span>
        </div>
        <div v-if="cotizacionesParaEliminar.length > 1" class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
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
          @click="solicitarOtpEliminarCotizacion"
        />
        <Button
          v-else
          label="Eliminar"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleteOtpConfirmando"
          @click="borrarCotizaciones"
        />
      </template>
    </Dialog>
  </div>
</template>
