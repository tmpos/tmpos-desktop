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
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Fieldset from 'primevue/fieldset'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

import { envioElectron } from '@/funciones/funciones.js'

const toast = useToast()
const recibidos = ref<any[]>([])
const telefonos = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const selectedRecibido = ref<any>(null)
const busqueda = ref('')
const viewMode = ref<'table' | 'cards'>('table')
const dialogNuevoTelefono = ref(false)
const nuevoTelefonoForm = ref({ nombre: '' })
const guardandoTelefono = ref(false)
const generandoNC = ref(false)
const enviandoTaller = ref(false)
const publicandoImei = ref(false)

const dialogGenerarNC = ref(false)
const dialogEnviarTaller = ref(false)
const dialogPublicarImei = ref(false)

const tallerForm = ref({
  tecnico: '',
  fallas: '',
  accesorios: '',
})

const imeiPublishForm = ref({
  precio_venta: 0,
  precio_min: 0,
  precio_xmayor: 0,
})

const formDefault = () => ({
  nombre: '',
  id_equi: null as number | null,
  telefono_modelo: '',
  color: '',
  capacidad: '',
  nota_json: JSON.stringify({
    customer_name: '',
    customer_phone: '',
    credit_note_value: 0,
    credit_note_id: null,
    credit_note_no: null,
    credit_note_date: null,
  }),
})

const form = ref(formDefault())

const notaData = computed(() => {
  try {
    const parsed = JSON.parse(form.value.nota_json || '{}')
    return {
      customer_name: parsed.customer_name || '',
      customer_phone: parsed.customer_phone || '',
      credit_note_value: parsed.credit_note_value || 0,
      credit_note_id: parsed.credit_note_id || null,
      credit_note_no: parsed.credit_note_no || null,
      credit_note_date: parsed.credit_note_date || null,
    }
  } catch {
    return { customer_name: '', customer_phone: '', credit_note_value: 0, credit_note_id: null, credit_note_no: null, credit_note_date: null }
  }
})

const busquedaTelefono = ref('')

function getNotaDataFromImei(imei: any) {
  try {
    const parsed = JSON.parse(imei.nota || '{}')
    return {
      customer_name: parsed.customer_name || '',
      customer_phone: parsed.customer_phone || '',
      credit_note_value: parsed.credit_note_value || 0,
      credit_note_id: parsed.credit_note_id || null,
      credit_note_no: parsed.credit_note_no || null,
      credit_note_date: parsed.credit_note_date || null,
    }
  } catch {
    return { customer_name: '', customer_phone: '', credit_note_value: 0, credit_note_id: null, credit_note_no: null, credit_note_date: null }
  }
}

function getNombreTelefono(id_equi: number | null): string {
  if (!id_equi) return ''
  const tel = telefonos.value.find(t => t.id === id_equi)
  return tel?.nombre || ''
}

const recibidosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return recibidos.value
  return recibidos.value.filter(a => {
    const nd = getNotaDataFromImei(a)
    return (
      a.nombre?.toLowerCase().includes(texto) ||
      nd.customer_name?.toLowerCase().includes(texto) ||
      nd.customer_phone?.toLowerCase().includes(texto) ||
      getNombreTelefono(a.id_equi)?.toLowerCase().includes(texto) ||
      a.color?.toLowerCase().includes(texto) ||
      a.capacidad?.toLowerCase().includes(texto)
    )
  })
})

function formatCurrency(n: number): string {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFecha(fechaStr: string): string {
  if (!fechaStr) return ''
  const parts = fechaStr.split('T')[0].split('-')
  if (parts.length !== 3) return fechaStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

async function cargarRecibidos() {
  loading.value = true
  try {
    const res = await window.db.getAll('imei')
    if (res.success) {
      recibidos.value = (res.data || []).filter((i: any) => i.estado === 'APARTADO')
    }
  } catch (_) {}
  loading.value = false
}

async function cargarTelefonos() {
  try {
    const res = await window.db.getAll('telefonos')
    if (res.success) telefonos.value = res.data || []
  } catch (_) {}
}

function abrirRecibir() {
  form.value = formDefault()
  busquedaTelefono.value = ''
  selectedRecibido.value = null
  dialogVisible.value = true
}

function abrirEditar(recibido: any) {
  const nd = getNotaDataFromImei(recibido)
  form.value = {
    nombre: recibido.nombre || '',
    id_equi: recibido.id_equi || null,
    telefono_modelo: getNombreTelefono(recibido.id_equi),
    color: recibido.color || '',
    capacidad: recibido.capacidad || '',
    nota_json: JSON.stringify(nd),
  }
  dialogVisible.value = true
  selectedRecibido.value = recibido
}

function setCreditNoteValue(val: number) {
  try {
    const parsed = JSON.parse(form.value.nota_json || '{}')
    parsed.credit_note_value = val
    form.value.nota_json = JSON.stringify(parsed)
  } catch {}
}

function setCustomerName(val: string) {
  try {
    const parsed = JSON.parse(form.value.nota_json || '{}')
    parsed.customer_name = val.toUpperCase()
    form.value.nota_json = JSON.stringify(parsed)
  } catch {}
}

function setCustomerPhone(val: string) {
  try {
    const parsed = JSON.parse(form.value.nota_json || '{}')
    parsed.customer_phone = val
    form.value.nota_json = JSON.stringify(parsed)
  } catch {}
}

function seleccionarTelefono(telefono: any) {
  form.value.id_equi = telefono.id
  form.value.telefono_modelo = telefono.nombre
  dialogNuevoTelefono.value = false
}

async function crearTelefono() {
  if (!nuevoTelefonoForm.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre del telefono es requerido', life: 3000 })
    return
  }
  guardandoTelefono.value = true
  try {
    const res = await window.db.insert('telefonos', { nombre: nuevoTelefonoForm.value.nombre.trim().toUpperCase() })
    if (res.success) {
      const nuevo = { id: res.data.id, nombre: nuevoTelefonoForm.value.nombre.trim().toUpperCase() }
      telefonos.value.unshift(nuevo)
      form.value.id_equi = nuevo.id
      form.value.telefono_modelo = nuevo.nombre
      dialogNuevoTelefono.value = false
      toast.add({ severity: 'success', summary: 'Telefono creado', detail: nuevo.nombre, life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    guardandoTelefono.value = false
  }
}

async function guardarRecibir() {
  if (!form.value.nombre.trim() && !form.value.id_equi) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El IMEI o modelo del telefono es requerido', life: 3000 })
    return
  }

  try {
    const nd = JSON.parse(form.value.nota_json || '{}')
    const data: any = {
      nombre: form.value.nombre.trim().toUpperCase(),
      id_equi: form.value.id_equi,
      color: form.value.color.trim().toUpperCase(),
      capacidad: form.value.capacidad.trim().toUpperCase(),
      estado: 'APARTADO',
      nota: JSON.stringify(nd),
    }

    if (selectedRecibido.value) {
      const res = await window.db.update('imei', selectedRecibido.value.id, data)
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Recibido actualizado', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo actualizar', life: 3000 })
        return
      }
    } else {
      const res = await window.db.insert('imei', data)
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Recibido', detail: 'Equipo recibido correctamente', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo guardar', life: 3000 })
        return
      }
    }

    dialogVisible.value = false
    selectedRecibido.value = null
    await cargarRecibidos()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  }
}

function confirmarBorrar(recibido: any) {
  selectedRecibido.value = recibido
  deleteDialogVisible.value = true
}

async function borrar() {
  try {
    const res = await window.db.delete('imei', selectedRecibido.value.id)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Registro eliminado', life: 3000 })
    }
    deleteDialogVisible.value = false
    await cargarRecibidos()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  }
}

async function generarNotaCredito(recibido: any) {
  const nd = getNotaDataFromImei(recibido)
  if (nd.credit_note_id) {
    toast.add({ severity: 'warn', summary: 'Ya generada', detail: `Nota de credito ${nd.credit_note_no} ya fue generada`, life: 3000 })
    return
  }
  if (!nd.credit_note_value || nd.credit_note_value <= 0) {
    toast.add({ severity: 'warn', summary: 'Sin valor', detail: 'Establece un valor para la nota de credito', life: 3000 })
    return
  }

  generandoNC.value = true
  try {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    const noCredito = `NC-${y}${m}${d}-${h}${min}${s}`
    const fechaStr = `${y}-${m}-${d}`
    const horaStr = `${h}:${min}`

    const res = await window.db.insert('facturas', {
      no_factura: noCredito,
      tipo_factura: 'NOTA_CREDITO',
      nombre_cliente: (nd.customer_name || 'CONSUMIDOR FINAL').toUpperCase(),
      telefono_cliente: nd.customer_phone || '',
      productos: JSON.stringify([{
        nombre: `RECIBIDO: ${getNombreTelefono(recibido.id_equi) || recibido.nombre}`,
        cantidad: 1,
        precio: nd.credit_note_value,
        total: nd.credit_note_value,
      }]),
      total: nd.credit_note_value,
      subtotal: nd.credit_note_value,
      metodo_pago: 'EFECTIVO',
      estado_factura: 'PAGADA',
      fecha_emision: fechaStr,
      fecha_estado: fechaStr,
      hora: horaStr,
      nota: `NOTA DE CREDITO POR EQUIPO RECIBIDO IMEI: ${recibido.nombre}`,
      mes: m,
      year: String(y),
    })

    if (res.success) {
      nd.credit_note_id = res.data.id
      nd.credit_note_no = noCredito
      nd.credit_note_date = fechaStr
      await window.db.update('imei', recibido.id, { nota: JSON.stringify(nd) })
      toast.add({ severity: 'success', summary: 'Nota de Credito', detail: `${noCredito} por RD$ ${formatCurrency(nd.credit_note_value)}`, life: 4000 })
      await cargarRecibidos()
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo generar la nota de credito', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    generandoNC.value = false
  }
}

function abrirTallerDialog(recibido: any) {
  selectedRecibido.value = recibido
  tallerForm.value = { tecnico: '', fallas: '', accesorios: '' }
  dialogEnviarTaller.value = true
}

async function enviarAlTaller() {
  if (!selectedRecibido.value) return
  enviandoTaller.value = true
  try {
    const now = new Date()
    const fechaStr = now.toISOString().split('T')[0]
    const nd = getNotaDataFromImei(selectedRecibido.value)
    const nombreCliente = nd.customer_name || 'CONSUMIDOR FINAL'

    const res = await window.db.insert('ordenes_taller', {
      nombre: nombreCliente.toUpperCase(),
      telefono: nd.customer_phone || '',
      equipo: getNombreTelefono(selectedRecibido.value.id_equi) || 'TELEFONO',
      imei: selectedRecibido.value.nombre || '',
      marca_modelo: (getNombreTelefono(selectedRecibido.value.id_equi) || '') + ' ' + (selectedRecibido.value.color || '') + ' ' + (selectedRecibido.value.capacidad || ''),
      accesorios: tallerForm.value.accesorios.toUpperCase(),
      fallas: tallerForm.value.fallas.toUpperCase(),
      tecnico: tallerForm.value.tecnico.toUpperCase(),
      estado: 'RECIBIDO',
      fecha_entrada: fechaStr,
      total: nd.credit_note_value || 0,
      metodo_pago: 'EFECTIVO',
    })

    if (res.success) {
      await window.db.update('imei', selectedRecibido.value.id, { estado: 'EN_GARANTIA' })
      toast.add({ severity: 'success', summary: 'Enviado al Taller', detail: 'Orden de taller creada', life: 3000 })
      dialogEnviarTaller.value = false
      await cargarRecibidos()
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear la orden', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    enviandoTaller.value = false
  }
}

function abrirPublicarImei(recibido: any) {
  selectedRecibido.value = recibido
  const nd = getNotaDataFromImei(recibido)
  const ndVal = nd.credit_note_value || 0
  imeiPublishForm.value = {
    precio_venta: ndVal > 0 ? ndVal * 1.3 : 0,
    precio_min: ndVal > 0 ? ndVal * 1.15 : 0,
    precio_xmayor: ndVal > 0 ? ndVal * 1.2 : 0,
  }
  dialogPublicarImei.value = true
}

async function publicarComoImei() {
  if (!selectedRecibido.value) return
  if (!imeiPublishForm.value.precio_venta || imeiPublishForm.value.precio_venta <= 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El precio de venta es requerido', life: 3000 })
    return
  }

  publicandoImei.value = true
  try {
    const data: any = {
      estado: 'DISPONIBLE',
      precio_venta: imeiPublishForm.value.precio_venta,
      precio_min: imeiPublishForm.value.precio_min || 0,
      precio_xmayor: imeiPublishForm.value.precio_xmayor || 0,
    }

    if (!selectedRecibido.value.costo && imeiPublishForm.value.precio_min > 0) {
      data.costo = imeiPublishForm.value.precio_min * 0.7
    }

    const res = await window.db.update('imei', selectedRecibido.value.id, data)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Publicado', detail: 'IMEI disponible en inventario', life: 3000 })
      dialogPublicarImei.value = false
      await cargarRecibidos()
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo publicar', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    publicandoImei.value = false
  }
}

function abrirNotaCreditoDialog(recibido: any) {
  selectedRecibido.value = recibido
  dialogGenerarNC.value = true
}

onMounted(async () => {
  try {
    const datosJSON = await envioElectron('datosarchivo')
    if (datosJSON) {
      // config loaded if needed
    }
  } catch (_) {}

  await Promise.all([cargarRecibidos(), cargarTelefonos()])
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Equipos Recibidos (Trade-in)">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar por IMEI, cliente, modelo..." />
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
          <Button label="Recibir Equipo" icon="pi pi-plus" @click="abrirRecibir" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="recibidosFiltrados"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
      >
        <Column field="id" header="ID" style="width: 4rem" />
        <Column header="Modelo" sortable style="width: 10rem">
          <template #body="{ data }">
            {{ getNombreTelefono(data.id_equi) || 'SIN MODELO' }}
          </template>
        </Column>
        <Column field="nombre" header="IMEI" sortable style="width: 10rem" />
        <Column header="Cliente" sortable style="width: 10rem">
          <template #body="{ data }">
            {{ getNotaDataFromImei(data).customer_name || '—' }}
          </template>
        </Column>
        <Column header="Valor NC" sortable style="width: 8rem">
          <template #body="{ data }">
            ${{ formatCurrency(getNotaDataFromImei(data).credit_note_value) }}
          </template>
        </Column>
        <Column header="Estado NC" style="width: 8rem">
          <template #body="{ data }">
            <span
              v-if="getNotaDataFromImei(data).credit_note_id"
              class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            >
              {{ getNotaDataFromImei(data).credit_note_no }}
            </span>
            <span v-else class="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              PENDIENTE
            </span>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width: 8rem">
          <template #body="{ data }">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              {{ data.estado }}
            </span>
          </template>
        </Column>
        <Column header="Acciones" style="width: 14rem">
          <template #body="{ data }">
            <div class="flex gap-1 flex-wrap">
              <Button icon="pi pi-file-minus" severity="success" text rounded size="small" v-tooltip="'Generar Nota de Credito'" @click.stop="abrirNotaCreditoDialog(data)" />
              <Button icon="pi pi-wrench" severity="info" text rounded size="small" v-tooltip="'Enviar al Taller'" @click.stop="abrirTallerDialog(data)" />
              <Button icon="pi pi-shopping-cart" severity="primary" text rounded size="small" v-tooltip="'Publicar en IMEI'" @click.stop="abrirPublicarImei(data)" />
              <Button icon="pi pi-pencil" severity="info" text rounded size="small" v-tooltip="'Editar'" @click.stop="abrirEditar(data)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" v-tooltip="'Eliminar'" @click.stop="confirmarBorrar(data)" />
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay equipos recibidos.</div>
        </template>
      </DataTable>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="recibidosFiltrados.length === 0" class="text-center py-10 text-surface-500">No hay equipos recibidos.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="recibido in recibidosFiltrados"
            :key="recibido.id"
            class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono text-surface-400">#{{ recibido.id }}</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                {{ recibido.estado }}
              </span>
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-base leading-tight truncate">{{ getNombreTelefono(recibido.id_equi) || 'SIN MODELO' }}</h4>
              <p class="text-sm text-surface-500 dark:text-surface-400 truncate">IMEI: {{ recibido.nombre || '—' }}</p>
              <p class="text-sm text-surface-500 dark:text-surface-400 truncate">{{ getNotaDataFromImei(recibido).customer_name || 'Sin cliente' }}</p>
            </div>
            <div class="grid grid-cols-1 gap-1 text-sm">
              <div class="flex items-center gap-2">
                <i class="pi pi-dollar text-surface-400"></i>
                <span class="font-semibold">${{ formatCurrency(getNotaDataFromImei(recibido).credit_note_value) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="pi pi-tag text-surface-400"></i>
                <span>{{ recibido.color || '—' }} {{ recibido.capacidad || '' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="pi pi-file text-surface-400"></i>
                <span v-if="getNotaDataFromImei(recibido).credit_note_no" class="text-green-600 dark:text-green-400">{{ getNotaDataFromImei(recibido).credit_note_no }}</span>
                <span v-else class="text-surface-400">Sin NC</span>
              </div>
            </div>
            <div class="flex gap-1 mt-auto pt-2 border-t border-surface-100 dark:border-surface-700 flex-wrap">
              <Button icon="pi pi-file-minus" severity="success" text rounded size="small" v-tooltip="'Generar NC'" @click.stop="abrirNotaCreditoDialog(recibido)" />
              <Button icon="pi pi-wrench" severity="info" text rounded size="small" v-tooltip="'Taller'" @click.stop="abrirTallerDialog(recibido)" />
              <Button icon="pi pi-shopping-cart" severity="primary" text rounded size="small" v-tooltip="'IMEI'" @click.stop="abrirPublicarImei(recibido)" />
              <Button icon="pi pi-pencil" severity="info" text rounded size="small" v-tooltip="'Editar'" @click.stop="abrirEditar(recibido)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" v-tooltip="'Eliminar'" @click.stop="confirmarBorrar(recibido)" />
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <Dialog
      v-model:visible="dialogVisible"
      :header="selectedRecibido ? 'Editar Equipo Recibido' : 'Recibir Equipo'"
      modal
      :style="{ width: '90%', maxWidth: '600px' }"
    >
      <TabView>
        <TabPanel header="Equipo">
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Modelo del Telefono</label>
              <div class="flex gap-2">
                <Select v-model="form.id_equi" :options="telefonos" optionLabel="nombre" optionValue="id" placeholder="Seleccionar modelo" filter class="flex-1" @change="form.telefono_modelo = getNombreTelefono(form.id_equi)" />
                <Button icon="pi pi-plus" severity="secondary" @click="dialogNuevoTelefono = true" v-tooltip="'Crear nuevo modelo'" />
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">IMEI / Serial</label>
              <InputText v-model="form.nombre" placeholder="Numero IMEI del equipo" class="uppercase" style="text-transform: uppercase;" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Color</label>
                <InputText v-model="form.color" placeholder="Color" class="uppercase" style="text-transform: uppercase;" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Capacidad</label>
                <InputText v-model="form.capacidad" placeholder="Ej: 128GB" class="uppercase" style="text-transform: uppercase;" />
              </div>
            </div>
          </div>
        </TabPanel>
        <TabPanel header="Cliente / Valor">
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Nombre del Cliente (dueño del equipo)</label>
              <InputText :value="notaData.customer_name" @input="setCustomerName(($event.target as HTMLInputElement).value)" placeholder="Nombre completo" class="uppercase" style="text-transform: uppercase;" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Telefono</label>
              <InputText :value="notaData.customer_phone" @input="setCustomerPhone(($event.target as HTMLInputElement).value)" placeholder="Telefono" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Valor de Nota de Credito (RD$)</label>
              <InputNumber :value="notaData.credit_note_value" @update:modelValue="setCreditNoteValue" mode="currency" currency="DOP" locale="es-DO" fluid />
              <p class="text-xs text-surface-400">Monto que se le ofrecera al cliente como nota de credito</p>
            </div>
          </div>
        </TabPanel>
      </TabView>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="selectedRecibido ? 'Actualizar' : 'Recibir Equipo'" icon="pi pi-check" @click="guardarRecibir" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogNuevoTelefono" header="Nuevo Modelo de Telefono" modal :style="{ width: '24rem' }">
      <div class="flex flex-col gap-3 pt-2">
        <InputText v-model="nuevoTelefonoForm.nombre" placeholder="Ej: iPhone 14 Pro Max" class="uppercase" style="text-transform: uppercase;" @keyup.enter="crearTelefono" />
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogNuevoTelefono = false" />
        <Button label="Crear" icon="pi pi-check" :loading="guardandoTelefono" @click="crearTelefono" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogGenerarNC" header="Generar Nota de Credito" modal :style="{ width: '24rem' }">
      <div v-if="selectedRecibido" class="space-y-4 pt-2">
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-surface-500">Modelo</span>
            <span class="font-semibold">{{ getNombreTelefono(selectedRecibido.id_equi) || 'SIN MODELO' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">IMEI</span>
            <span class="font-semibold">{{ selectedRecibido.nombre || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Cliente</span>
            <span class="font-semibold">{{ getNotaDataFromImei(selectedRecibido).customer_name || 'CONSUMIDOR FINAL' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Valor NC</span>
            <span class="font-bold text-primary">${{ formatCurrency(getNotaDataFromImei(selectedRecibido).credit_note_value) }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogGenerarNC = false" />
        <Button label="Generar Nota de Credito" icon="pi pi-file-minus" :loading="generandoNC" @click="generarNotaCredito(selectedRecibido)" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogEnviarTaller" header="Enviar al Taller" modal :style="{ width: '90%', maxWidth: '450px' }">
      <div v-if="selectedRecibido" class="space-y-4 pt-2">
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm">
          <div class="flex justify-between">
            <span class="text-surface-500">Equipo</span>
            <span class="font-semibold">{{ getNombreTelefono(selectedRecibido.id_equi) || selectedRecibido.nombre }}</span>
          </div>
        </div>
        <InputText v-model="tallerForm.tecnico" placeholder="Nombre del tecnico" class="uppercase w-full" style="text-transform: uppercase;" />
        <Textarea v-model="tallerForm.fallas" placeholder="Describir las fallas del equipo" rows="3" class="uppercase w-full" style="text-transform: uppercase;" />
        <Textarea v-model="tallerForm.accesorios" placeholder="Accesorios que vienen con el equipo" rows="2" class="uppercase w-full" style="text-transform: uppercase;" />
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogEnviarTaller = false" />
        <Button label="Enviar al Taller" icon="pi pi-wrench" :loading="enviandoTaller" @click="enviarAlTaller" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogPublicarImei" header="Publicar en Inventario (IMEI)" modal :style="{ width: '90%', maxWidth: '450px' }">
      <div v-if="selectedRecibido" class="space-y-4 pt-2">
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm">
          <div class="flex justify-between">
            <span class="text-surface-500">Modelo</span>
            <span class="font-semibold">{{ getNombreTelefono(selectedRecibido.id_equi) || 'SIN MODELO' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">IMEI</span>
            <span class="font-semibold">{{ selectedRecibido.nombre || '—' }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Precio de Venta (RD$)</label>
          <InputNumber v-model="imeiPublishForm.precio_venta" mode="currency" currency="DOP" locale="es-DO" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Precio Minimo (RD$)</label>
          <InputNumber v-model="imeiPublishForm.precio_min" mode="currency" currency="DOP" locale="es-DO" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Precio por Mayor (RD$)</label>
          <InputNumber v-model="imeiPublishForm.precio_xmayor" mode="currency" currency="DOP" locale="es-DO" fluid />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogPublicarImei = false" />
        <Button label="Publicar en IMEI" icon="pi pi-check" :loading="publicandoImei" @click="publicarComoImei" />
      </template>
    </Dialog>

    <Dialog v-model:visible="deleteDialogVisible" header="Eliminar" modal :style="{ width: '24rem' }">
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>Seguro que deseas eliminar este registro?</span>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="borrar" />
      </template>
    </Dialog>
  </div>
</template>
