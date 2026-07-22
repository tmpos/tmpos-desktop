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
import Fieldset from 'primevue/fieldset'
import Calendar from 'primevue/calendar'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { useAlmacenStore } from '@/stores/almacen.store'

import { envioElectron } from '@/funciones/funciones.js'
import TicketGastoPrint from './TicketGastoPrint.vue'

const toast = useToast()
const almacenStore = useAlmacenStore()
const gastos = ref<any[]>([])
const bancos = ref<any[]>([])
const loading = ref(false)
const viewMode = ref<'table' | 'cards'>('cards')
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const isEditing = ref(false)
const selectedGasto = ref<any>(null)
const selectedGastos = ref<any[]>([])
const busqueda = ref('')
const ticketPrintRef = ref<InstanceType<typeof TicketGastoPrint> | null>(null)

const camposArray = [
  'cantidad',
  'fecha',
  'hora',
  'comentario',
  'turno_id',
  'created_at',
  'updated_at',
]

const link = ref('')
const api = ref('')
const token = ref('')
const patronTelefono = ref('')
const linkImpresora = ref('')
const patroncedula = ref('')
const tokenCorto = ref('')

const formDefault = () => ({
  cantidad: 0,
  fecha: new Date(),
  hora: new Date(),
  comentario: '',
  metodo_pago: 'EFECTIVO',
  banco_id: null as number | null,
})

const form = ref(formDefault())

function formatHora(date: Date): string {
  if (!date) return ''
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatFechaDb(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const gastosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return gastos.value
  return gastos.value.filter(g =>
    g.comentario?.toLowerCase().includes(texto) ||
    g.cantidad?.toString().includes(texto) ||
    g.fecha?.includes(texto)
  )
})

function formatCantidad(n: number): string {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function cargarGastos() {
  loading.value = true
  try {
    const res = await window.db.getAll('gastos')
    if (res.success) {
      gastos.value = res.data || []
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudieron cargar los gastos', life: 3000 })
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function cargarBancos() {
  try {
    const res = await window.db.getAll('bancos')
    bancos.value = (res.success ? res.data || [] : []).filter((banco: any) =>
      almacenStore.activeUid && banco.almacen_uid
        ? String(banco.almacen_uid) === almacenStore.activeUid
        : !Number(banco.almacen_id) || Number(banco.almacen_id) === almacenStore.activeId
    )
  } catch {
    bancos.value = []
  }
}

function abrirCrear() {
  isEditing.value = false
  selectedGasto.value = null
  form.value = formDefault()
  dialogVisible.value = true
}

function abrirEditar(gasto: any) {
  isEditing.value = true
  selectedGasto.value = gasto
  form.value = {
    cantidad: gasto.cantidad || 0,
    fecha: gasto.fecha ? new Date(gasto.fecha) : new Date(),
    hora: gasto.hora ? new Date(`2000-01-01T${gasto.hora}`) : new Date(),
    comentario: gasto.comentario || '',
    metodo_pago: String(gasto.metodo_pago || 'EFECTIVO').toUpperCase(),
    banco_id: gasto.banco_id ? Number(gasto.banco_id) : null,
  }
  dialogVisible.value = true
}

function confirmarBorrar(gasto: any) {
  selectedGasto.value = gasto
  selectedGastos.value = []
  deleteDialogVisible.value = true
}

function formatFecha(fechaStr: string): string {
  if (!fechaStr) return ''
  const d = new Date(fechaStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

async function guardar() {
  if (!form.value.cantidad || form.value.cantidad <= 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'La cantidad es requerida', life: 3000 })
    return
  }
  if (form.value.metodo_pago === 'TRANSFERENCIA' && !form.value.banco_id) {
    toast.add({ severity: 'warn', summary: 'Banco requerido', detail: 'Selecciona el banco de donde saldra el dinero', life: 3000 })
    return
  }

  try {
    const fechaStr = form.value.fecha instanceof Date
      ? formatFechaDb(form.value.fecha)
      : form.value.fecha

    const horaStr = form.value.hora instanceof Date
      ? formatHora(form.value.hora)
      : form.value.hora || formatHora(new Date())

    const turnosRes = await window.db.getAll('caja_turnos')
    const turnoAbierto = turnosRes.success
      ? (turnosRes.data || []).find((turno: any) => turno.estado === 'abierto' && (
          almacenStore.activeUid && turno.almacen_uid
            ? String(turno.almacen_uid) === almacenStore.activeUid
            : !Number(turno.almacen_id) || Number(turno.almacen_id) === almacenStore.activeId
        ))
      : null

    const banco = bancos.value.find((item: any) => Number(item.id) === Number(form.value.banco_id || 0))
    const data = {
      cantidad: form.value.cantidad,
      fecha: fechaStr,
      hora: horaStr,
      comentario: form.value.comentario.trim().toUpperCase(),
      metodo_pago: form.value.metodo_pago,
      banco_id: banco?.id || 0,
      banco_uid: banco?.uid || '',
      turno_id: isEditing.value
        ? (selectedGasto.value?.turno_id || 0)
        : (turnoAbierto?.id || 0),
      almacen_id: almacenStore.activeId || 0,
      almacen_uid: almacenStore.activeUid || '',
      usuario: localStorage.getItem('mr_user_usuario') || '',
    }
    const res = await window.electron.invoke('gastos:guardarConPago', {
      ...data,
      id: isEditing.value ? selectedGasto.value?.id : 0,
    }) as any
    if (!res.success) {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo guardar', life: 3500 })
      return
    }
    toast.add({ severity: 'success', summary: 'Exito', detail: isEditing.value ? 'Gasto actualizado' : 'Gasto creado', life: 3000 })

    dialogVisible.value = false
    await cargarGastos()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 })
  }
}

async function borrar() {
  try {
    const res = await window.electron.invoke('gastos:eliminarConPago', selectedGasto.value.id, localStorage.getItem('mr_user_usuario') || '') as any
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Exito', detail: 'Gasto eliminado', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo eliminar', life: 3000 })
      return
    }
    deleteDialogVisible.value = false
    await cargarGastos()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
  }
}

function confirmarBorrarMultiple() {
  if (selectedGastos.value.length === 0) return
  deleteDialogVisible.value = true
}

async function borrarMultiple() {
  const ids = selectedGastos.value.map(g => g.id)
  let errors = 0
  for (const id of ids) {
    try {
      const res = await window.electron.invoke('gastos:eliminarConPago', id, localStorage.getItem('mr_user_usuario') || '') as any
      if (!res.success) errors++
    } catch {
      errors++
    }
  }
  deleteDialogVisible.value = false
  selectedGastos.value = []
  await cargarGastos()
  if (errors === 0) {
    toast.add({ severity: 'success', summary: 'Exito', detail: `${ids.length} gastos eliminados`, life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: 'Error', detail: `${errors} de ${ids.length} no se pudieron eliminar`, life: 3000 })
  }
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

  await cargarGastos()
  await cargarBancos()
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Gastos">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar gasto..." />
        </IconField>

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
          <Button label="Nuevo Gasto" icon="pi pi-plus" @click="abrirCrear" />
        </div>
      </div>

      <div v-if="selectedGastos.length > 0" class="flex items-center gap-2 mb-3 p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
        <span class="text-sm font-medium">{{ selectedGastos.length }} seleccionado(s)</span>
        <Button icon="pi pi-trash" severity="danger" size="small" label="Eliminar seleccionados" @click="confirmarBorrarMultiple" />
        <Button icon="pi pi-times" severity="secondary" text size="small" @click="selectedGastos = []" v-tooltip="'Limpiar seleccion'" />
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="gastosFiltrados"
        v-model:selection="selectedGastos"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
        selectionMode="multiple"
        @row-click="(e: any) => e.originalEvent.stopPropagation()"
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem" />
        <Column header="Acciones" style="width: 8rem">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-print" severity="success" text rounded @click.stop="ticketPrintRef?.printTicket(data)" v-tooltip="'Imprimir'" />
              <Button icon="pi pi-pencil" severity="info" text rounded @click.stop="abrirEditar(data)" v-tooltip="'Editar'" />
              <Button icon="pi pi-trash" severity="danger" text rounded @click.stop="confirmarBorrar(data)" v-tooltip="'Eliminar'" />
            </div>
          </template>
        </Column>
        <Column field="id" header="ID" style="width: 5rem" />
        <Column field="fecha" header="Fecha" sortable style="width: 8rem">
          <template #body="{ data }">{{ formatFecha(data.fecha) }}</template>
        </Column>
        <Column field="hora" header="Hora" sortable style="width: 7rem" />
        <Column field="cantidad" header="Cantidad" sortable style="width: 10rem">
          <template #body="{ data }">${{ formatCantidad(data.cantidad) }}</template>
        </Column>
        <Column field="metodo_pago" header="Metodo" sortable style="width: 10rem">
          <template #body="{ data }">{{ data.metodo_pago || 'EFECTIVO' }}</template>
        </Column>
        <Column field="banco_nombre" header="Banco" sortable style="width: 11rem" />
        <Column field="comentario" header="Comentario" sortable />

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay gastos registrados.</div>
        </template>
      </DataTable>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="gastosFiltrados.length === 0" class="text-center py-10 text-surface-500">No hay gastos registrados.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="gasto in gastosFiltrados"
            :key="gasto.id"
            class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer"
            @click="abrirEditar(gasto)"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono text-surface-400">#{{ gasto.id }}</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                ${{ formatCantidad(gasto.cantidad) }}
              </span>
            </div>

            <div class="min-w-0">
              <h4 class="font-bold text-base leading-tight truncate">{{ gasto.comentario || 'Sin comentario' }}</h4>
              <p class="text-sm text-surface-500 dark:text-surface-400">
                {{ formatFecha(gasto.fecha) }} - {{ gasto.hora || '--:--' }}
              </p>
              <p class="text-xs text-surface-400 mt-1">{{ gasto.metodo_pago || 'EFECTIVO' }}<span v-if="gasto.banco_nombre"> · {{ gasto.banco_nombre }}</span></p>
            </div>

            <div class="flex gap-2 mt-auto pt-2 border-t border-surface-100 dark:border-surface-700">
              <Button icon="pi pi-print" severity="success" text rounded size="small" @click.stop="ticketPrintRef?.printTicket(gasto)" v-tooltip="'Imprimir'" />
              <Button icon="pi pi-pencil" severity="info" text rounded size="small" @click.stop="abrirEditar(gasto)" v-tooltip="'Editar'" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click.stop="confirmarBorrar(gasto)" v-tooltip="'Eliminar'" />
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <Dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? 'Editar Gasto' : 'Nuevo Gasto'"
      modal
      :style="{ width: '30rem' }"
    >
      <div class="grid grid-cols-1 gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Cantidad (RD$)</label>
          <InputNumber v-model="form.cantidad" :min="0" :max="999999999" fluid @focus="(e) => e.target.select()" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Fecha</label>
          <Calendar v-model="form.fecha" dateFormat="dd/mm/yy" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Hora</label>
          <Calendar v-model="form.hora" timeOnly :showSeconds="false" hourFormat="24" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Comentario</label>
          <Textarea v-model="form.comentario" placeholder="Comentario del gasto..." fluid autoResize />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Metodo de pago</label>
          <select v-model="form.metodo_pago" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700" @change="form.banco_id = null">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </div>
        <div v-if="form.metodo_pago === 'TRANSFERENCIA'" class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Banco de origen</label>
          <select v-model="form.banco_id" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700">
            <option :value="null">Seleccionar banco</option>
            <option v-for="banco in bancos" :key="banco.uid || banco.id" :value="banco.id">{{ banco.nombre }} · RD$ {{ formatCantidad(banco.saldo) }}</option>
          </select>
          <small v-if="bancos.length === 0" class="text-amber-500">No hay bancos disponibles en este almacen.</small>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" :disabled="form.metodo_pago === 'TRANSFERENCIA' && !form.banco_id" @click="guardar" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Confirmar"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span v-if="selectedGastos.length > 1">Seguro que deseas eliminar los {{ selectedGastos.length }} gastos seleccionados?</span>
        <span v-else>Seguro que deseas eliminar este gasto?</span>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false; selectedGastos = []" />
        <Button v-if="selectedGastos.length > 1" label="Eliminar todos" icon="pi pi-trash" severity="danger" @click="borrarMultiple" />
        <Button v-else label="Eliminar" icon="pi pi-trash" severity="danger" @click="borrar" />
      </template>
    </Dialog>
    <TicketGastoPrint ref="ticketPrintRef" />
  </div>
</template>
