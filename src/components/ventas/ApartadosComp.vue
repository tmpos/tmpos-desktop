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
import Calendar from 'primevue/calendar'
import Textarea from 'primevue/textarea'
import Fieldset from 'primevue/fieldset'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import TicketApartadoPrint from './TicketApartadoPrint.vue'
import ApartadoPdfPrint from './ApartadoPdfPrint.vue'

import { envioElectron } from '@/funciones/funciones.js'

const toast = useToast()
const ticketApartadoRef = ref<any>(null)
const apartadoPdfRef = ref<any>(null)
const apartados = ref<any[]>([])
const imeisDisponibles = ref<any[]>([])
const telefonos = ref<any[]>([])
const clientes = ref<any[]>([])
const loading = ref(false)
const dialogNuevo = ref(false)
const dialogPago = ref(false)
const dialogDetalle = ref(false)
const deleteDialogVisible = ref(false)
const selectedApartado = ref<any>(null)
const selectedApartados = ref<any[]>([])
const busqueda = ref('')
const viewMode = ref<'table' | 'cards'>('table')

const now = new Date()
const form = ref({
  no_apartado: `AP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`,
  cod_cliente: '',
  nombre_cliente: '',
  telefono_cliente: '',
  id_imei: null as number | null,
  imei_nombre: '',
  telefono_modelo: '',
  total: 0,
  inicial: 0,
  saldo: 0,
  fecha_inicio: new Date(),
  nota: '',
  vendedor: '',
})

const pagoForm = ref({
  monto: 0,
  metodo_pago: 'EFECTIVO',
  fecha: new Date(),
  referencia: '',
})

const dialogNuevoCliente = ref(false)
const nuevoClienteForm = ref({ nombre: '', telefono: '' })
const guardandoCliente = ref(false)

const dialogNuevoTelefono = ref(false)
const nuevoTelefonoForm = ref({ nombre: '' })
const guardandoTelefono = ref(false)

const metodosPago = [
  { label: 'Efectivo', value: 'EFECTIVO' },
  { label: 'Tarjeta', value: 'TARJETA' },
  { label: 'Transferencia', value: 'TRANSFERENCIA' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Mixto', value: 'MIXTO' },
]

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

function getEstadoSeverity(estado: string): string {
  switch (estado) {
    case 'ACTIVO': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    case 'COMPLETADO': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'CANCELADO': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getPagos(apartado: any): any[] {
  try {
    return JSON.parse(apartado.pagos || '[]')
  } catch { return [] }
}

function getTotalAbonado(apartado: any): number {
  return getPagos(apartado).reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
}

function getSaldo(apartado: any): number {
  return Math.max(0, (apartado.total || 0) - getTotalAbonado(apartado))
}

function getNombreTelefono(id_equi: number | null): string {
  if (!id_equi) return ''
  const tel = telefonos.value.find(t => t.id === id_equi)
  return tel?.nombre || ''
}

const saldoCalculado = computed(() => {
  return Math.max(0, (form.value.total || 0) - (form.value.inicial || 0))
})

const apartadosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return apartados.value
  return apartados.value.filter(a =>
    a.no_apartado?.toLowerCase().includes(texto) ||
    a.nombre_cliente?.toLowerCase().includes(texto) ||
    a.telefono_cliente?.toLowerCase().includes(texto) ||
    a.imei_nombre?.toLowerCase().includes(texto)
  )
})

async function cargarApartados() {
  loading.value = true
  try {
    const res = await window.db.getAll('cuentas_cobrar')
    if (res.success) {
      apartados.value = (res.data || []).filter((c: any) => c.estado === 'APARTADO' || c.estado === 'ACTIVO')
    }
  } catch (_) {}
  loading.value = false
}

async function cargarImeis() {
  try {
    const res = await window.db.getAll('imei')
    if (res.success) {
      imeisDisponibles.value = (res.data || []).filter((i: any) => i.estado === 'DISPONIBLE')
    }
  } catch (_) {}
}

async function cargarTelefonos() {
  try {
    const res = await window.db.getAll('telefonos')
    if (res.success) telefonos.value = res.data || []
  } catch (_) {}
}

async function cargarClientes() {
  try {
    const res = await window.db.getAll('clientes')
    if (res.success) clientes.value = res.data || []
  } catch (_) {}
}

function abrirNuevo() {
  const n = new Date()
  form.value = {
    no_apartado: `AP-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}-${String(n.getHours()).padStart(2, '0')}${String(n.getMinutes()).padStart(2, '0')}${String(n.getSeconds()).padStart(2, '0')}`,
    cod_cliente: '',
    nombre_cliente: '',
    telefono_cliente: '',
    id_imei: null,
    imei_nombre: '',
    telefono_modelo: '',
    total: 0,
    inicial: 0,
    fecha_inicio: new Date(),
    nota: '',
    vendedor: '',
  }
  dialogNuevo.value = true
}

function onImeiSelect(event: any) {
  const imei = imeisDisponibles.value.find(i => i.id === event.value)
  if (imei) {
    form.value.imei_nombre = imei.nombre
    form.value.telefono_modelo = getNombreTelefono(imei.id_equi)
    if (!form.value.total) {
      form.value.total = imei.precio_venta || 0
      form.value.inicial = Math.round((imei.precio_venta || 0) * 0.3)
    }
  }
}

function seleccionarCliente(cliente: any) {
  form.value.cod_cliente = String(cliente.id || cliente.codigo || '')
  form.value.nombre_cliente = cliente.nombre?.toUpperCase() || ''
  form.value.telefono_cliente = cliente.telefono || ''
  dialogNuevoCliente.value = false
}

function seleccionarTelefono(telefono: any) {
  nuevoTelefonoForm.value.nombre = telefono.nombre
  dialogNuevoTelefono.value = false
}

async function crearCliente() {
  if (!nuevoClienteForm.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre es requerido', life: 3000 })
    return
  }
  guardandoCliente.value = true
  try {
    const res = await window.db.insert('clientes', {
      nombre: nuevoClienteForm.value.nombre.trim().toUpperCase(),
      telefono: nuevoClienteForm.value.telefono.trim(),
      email: '',
      direccion: '',
      rnc: '',
    })
    if (res.success) {
      const nuevo = { id: res.data.id, nombre: nuevoClienteForm.value.nombre.trim().toUpperCase(), telefono: nuevoClienteForm.value.telefono.trim() }
      clientes.value.unshift(nuevo)
      seleccionarCliente(nuevo)
      toast.add({ severity: 'success', summary: 'Cliente creado', detail: nuevo.nombre, life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    guardandoCliente.value = false
  }
}

async function crearTelefono() {
  if (!nuevoTelefonoForm.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre del modelo es requerido', life: 3000 })
    return
  }
  guardandoTelefono.value = true
  try {
    const res = await window.db.insert('telefonos', { nombre: nuevoTelefonoForm.value.nombre.trim().toUpperCase() })
    if (res.success) {
      const nuevo = { id: res.data.id, nombre: nuevoTelefonoForm.value.nombre.trim().toUpperCase() }
      telefonos.value.unshift(nuevo)
      toast.add({ severity: 'success', summary: 'Modelo creado', detail: nuevo.nombre, life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    guardandoTelefono.value = false
  }
}

async function guardarNuevoApartado() {
  if (!form.value.nombre_cliente.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre del cliente es requerido', life: 3000 })
    return
  }
  if (!form.value.id_imei) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona un IMEI del inventario', life: 3000 })
    return
  }
  if (form.value.total <= 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El total debe ser mayor a 0', life: 3000 })
    return
  }

  try {
    const fechaStr = form.value.fecha_inicio.toISOString().split('T')[0]
    const pagosInicial = form.value.inicial > 0 ? JSON.stringify([{
      monto: form.value.inicial,
      metodo_pago: 'EFECTIVO',
      fecha: fechaStr,
      referencia: 'PAGO INICIAL',
    }]) : '[]'

    const res = await window.db.insert('cuentas_cobrar', {
      no_factura: form.value.no_apartado,
      cod_cliente: form.value.cod_cliente,
      nombre_cliente: form.value.nombre_cliente.trim().toUpperCase(),
      telefono_cliente: form.value.telefono_cliente.trim(),
      total: form.value.total,
      abonado: form.value.inicial,
      saldo: saldoCalculado.value,
      fecha_venta: fechaStr,
      estado: 'APARTADO',
      notas: (form.value.nota || '').toUpperCase() + ` | IMEI: ${form.value.imei_nombre} | MODELO: ${form.value.telefono_modelo}`,
      pagos: pagosInicial,
    })

    if (res.success) {
      await window.db.update('imei', form.value.id_imei, { estado: 'APARTADO' })
      toast.add({ severity: 'success', summary: 'Apartado creado', detail: `${form.value.no_apartado} - RD$ ${formatCurrency(form.value.total)}`, life: 4000 })
      dialogNuevo.value = false
      await cargarApartados()
      await cargarImeis()
      const creado = {
        no_factura: form.value.no_apartado,
        nombre_cliente: form.value.nombre_cliente,
        telefono_cliente: form.value.telefono_cliente,
        total: form.value.total,
        abonado: form.value.inicial,
        pagos: pagosInicial,
        notas: (form.value.nota || '').toUpperCase() + ` | IMEI: ${form.value.imei_nombre} | MODELO: ${form.value.telefono_modelo}`,
      }
      ticketApartadoRef.value?.printTicket(creado, 'apartado')
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear el apartado', life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  }
}

function abrirPago(apartado: any) {
  selectedApartado.value = apartado
  pagoForm.value = {
    monto: getSaldo(apartado),
    metodo_pago: 'EFECTIVO',
    fecha: new Date(),
    referencia: '',
  }
  dialogPago.value = true
}

async function registrarPago() {
  if (!selectedApartado.value) return
  if (!pagoForm.value.monto || pagoForm.value.monto <= 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El monto debe ser mayor a 0', life: 3000 })
    return
  }

  try {
    const pagosActuales = getPagos(selectedApartado.value)
    const fechaStr = pagoForm.value.fecha.toISOString().split('T')[0]
    pagosActuales.push({
      monto: pagoForm.value.monto,
      metodo_pago: pagoForm.value.metodo_pago,
      fecha: fechaStr,
      referencia: pagoForm.value.referencia.trim().toUpperCase(),
    })

    const totalAbonado = pagosActuales.reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
    const saldoRestante = Math.max(0, (selectedApartado.value.total || 0) - totalAbonado)
    const completado = saldoRestante <= 0

    await window.db.update('cuentas_cobrar', selectedApartado.value.id, {
      pagos: JSON.stringify(pagosActuales),
      abonado: totalAbonado,
      saldo: saldoRestante,
      estado: completado ? 'COMPLETADO' : 'APARTADO',
    })

    if (completado) {
      const imeiNombre = (selectedApartado.value.notas || '').match(/IMEI:\s*(\S+)/i)?.[1]
      if (imeiNombre) {
        const imeiRes = await window.db.getAll('imei')
        if (imeiRes.success) {
          const imei = (imeiRes.data || []).find((i: any) => i.nombre === imeiNombre)
          if (imei) {
            await window.db.update('imei', imei.id, {
              estado: 'VENDIDO',
              comprador: selectedApartado.value.nombre_cliente,
              fecha_venta: fechaStr,
              no_factura: selectedApartado.value.no_factura,
            })
          }
        }
      }

      toast.add({ severity: 'success', summary: 'Completado', detail: `${selectedApartado.value.no_factura} pagado totalmente`, life: 4000 })
    } else {
      toast.add({ severity: 'success', summary: 'Pago registrado', detail: `RD$ ${formatCurrency(pagoForm.value.monto)} - Saldo: RD$ ${formatCurrency(saldoRestante)}`, life: 3000 })
    }

    const ticketNo = selectedApartado.value.no_factura
    const ticketCliente = selectedApartado.value.nombre_cliente
    const ticketNotas = selectedApartado.value.notas
    dialogPago.value = false
    await cargarApartados()
    await cargarImeis()
    ticketApartadoRef.value?.printTicket({
      ...selectedApartado.value,
      no_factura: ticketNo,
      nombre_cliente: ticketCliente,
      notas: ticketNotas,
      pagos: JSON.stringify(pagosActuales),
      abonado: totalAbonado,
      estado: completado ? 'COMPLETADO' : selectedApartado.value.estado,
    }, 'pago', {
      monto: pagoForm.value.monto,
      metodo_pago: pagoForm.value.metodo_pago,
      referencia: pagoForm.value.referencia,
      fecha: fechaStr,
    })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  }
}

function imprimirApartado(apartado: any) {
  ticketApartadoRef.value?.printTicket(apartado, 'apartado')
}

function verPdfApartado(apartado: any) {
  apartadoPdfRef.value?.verPdf(apartado)
}

function abrirDetalle(apartado: any) {
  selectedApartado.value = apartado
  dialogDetalle.value = true
}

function confirmarBorrar(apartado: any) {
  selectedApartado.value = apartado
  deleteDialogVisible.value = true
}

async function cancelarApartado() {
  if (!selectedApartado.value) return
  try {
    const imeiNombre = (selectedApartado.value.notas || '').match(/IMEI:\s*(\S+)/i)?.[1]
    await window.db.update('cuentas_cobrar', selectedApartado.value.id, { estado: 'CANCELADO' })

    if (imeiNombre) {
      const imeiRes = await window.db.getAll('imei')
      if (imeiRes.success) {
        const imei = (imeiRes.data || []).find((i: any) => i.nombre === imeiNombre)
        if (imei) {
          await window.db.update('imei', imei.id, { estado: 'DISPONIBLE' })
        }
      }
    }

    toast.add({ severity: 'info', summary: 'Cancelado', detail: 'Apartado cancelado y IMEI liberado', life: 3000 })
    deleteDialogVisible.value = false
    dialogDetalle.value = false
    await cargarApartados()
    await cargarImeis()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  }
}

onMounted(async () => {
  try {
    const datosJSON = await envioElectron('datosarchivo')
    if (datosJSON) {
      // config loaded if needed
    }
  } catch (_) {}

  await Promise.all([cargarApartados(), cargarImeis(), cargarTelefonos(), cargarClientes()])
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Apartados (Ventas a Plazos)">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar apartado..." />
        </IconField>

        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            <button
              class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
              :class="viewMode === 'table' ? 'bg-primary text-primary-contrast' : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="viewMode = 'table'"
            ><i class="pi pi-list"></i></button>
            <button
              class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border-l border-surface-200 dark:border-surface-700"
              :class="viewMode === 'cards' ? 'bg-primary text-primary-contrast' : 'bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="viewMode = 'cards'"
            ><i class="pi pi-th-large"></i></button>
          </div>
          <Button label="Nuevo Apartado" icon="pi pi-plus" @click="abrirNuevo" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="apartadosFiltrados"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
      >
        <Column field="no_factura" header="No. Apartado" sortable style="width: 10rem" />
        <Column field="nombre_cliente" header="Cliente" sortable />
        <Column field="total" header="Total" sortable style="width: 8rem">
          <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
        </Column>
        <Column header="Abonado" sortable style="width: 8rem">
          <template #body="{ data }">${{ formatCurrency(data.abonado || 0) }}</template>
        </Column>
        <Column header="Saldo" sortable style="width: 8rem">
          <template #body="{ data }">
            <span :class="getSaldo(data) <= 0 ? 'text-green-600 font-bold' : 'text-orange-600 font-bold'">
              ${{ formatCurrency(getSaldo(data)) }}
            </span>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width: 8rem">
          <template #body="{ data }">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="getEstadoSeverity(data.estado)">
              {{ data.estado === 'APARTADO' ? 'ACTIVO' : data.estado }}
            </span>
          </template>
        </Column>
        <Column field="fecha_venta" header="Fecha" sortable style="width: 7rem">
          <template #body="{ data }">{{ formatFecha(data.fecha_venta) }}</template>
        </Column>
        <Column header="Acciones" style="width: 15rem">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-dollar" severity="success" text rounded size="small" v-tooltip="'Registrar pago'" @click.stop="abrirPago(data)" :disabled="data.estado === 'COMPLETADO' || data.estado === 'CANCELADO'" />
              <Button icon="pi pi-eye" severity="info" text rounded size="small" v-tooltip="'Ver detalle'" @click.stop="abrirDetalle(data)" />
              <Button icon="pi pi-print" severity="secondary" text rounded size="small" v-tooltip="'Imprimir recibo'" @click.stop="imprimirApartado(data)" />
              <Button icon="pi pi-file-pdf" severity="danger" text rounded size="small" v-tooltip="'Ver PDF'" @click.stop="verPdfApartado(data)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" v-tooltip="'Cancelar'" @click.stop="confirmarBorrar(data)" :disabled="data.estado === 'COMPLETADO'" />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay apartados registrados.</div>
        </template>
      </DataTable>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="apartadosFiltrados.length === 0" class="text-center py-10 text-surface-500">No hay apartados registrados.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="apartado in apartadosFiltrados" :key="apartado.id"
            class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono text-surface-400">{{ apartado.no_factura }}</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="getEstadoSeverity(apartado.estado)">{{ apartado.estado === 'APARTADO' ? 'ACTIVO' : apartado.estado }}</span>
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-base leading-tight truncate">{{ apartado.nombre_cliente || 'SIN CLIENTE' }}</h4>
              <p class="text-sm text-surface-500 truncate">Total: ${{ formatCurrency(apartado.total) }}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-surface-400 text-xs">Abonado</span>
                <p class="font-semibold text-green-600">${{ formatCurrency(apartado.abonado || 0) }}</p>
              </div>
              <div>
                <span class="text-surface-400 text-xs">Saldo</span>
                <p class="font-semibold" :class="getSaldo(apartado) <= 0 ? 'text-green-600' : 'text-orange-600'">${{ formatCurrency(getSaldo(apartado)) }}</p>
              </div>
            </div>
            <div class="flex gap-1 mt-auto pt-2 border-t border-surface-100 dark:border-surface-700">
              <Button icon="pi pi-dollar" severity="success" text rounded size="small" v-tooltip="'Pago'" @click.stop="abrirPago(apartado)" :disabled="apartado.estado === 'COMPLETADO' || apartado.estado === 'CANCELADO'" />
              <Button icon="pi pi-eye" severity="info" text rounded size="small" v-tooltip="'Detalle'" @click.stop="abrirDetalle(apartado)" />
              <Button icon="pi pi-print" severity="secondary" text rounded size="small" v-tooltip="'Imprimir recibo'" @click.stop="imprimirApartado(apartado)" />
              <Button icon="pi pi-file-pdf" severity="danger" text rounded size="small" v-tooltip="'Ver PDF'" @click.stop="verPdfApartado(apartado)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" v-tooltip="'Cancelar'" @click.stop="confirmarBorrar(apartado)" :disabled="apartado.estado === 'COMPLETADO'" />
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <Dialog v-model:visible="dialogNuevo" header="Nuevo Apartado" modal :style="{ width: '90%', maxWidth: '650px' }">
      <TabView>
        <TabPanel header="Cliente">
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Cliente</label>
              <div class="flex gap-2">
                <Select
                  v-model="form.cod_cliente"
                  :options="clientes"
                  optionLabel="nombre"
                  optionValue="id"
                  placeholder="Seleccionar cliente"
                  filter
                  class="flex-1"
                  @change="seleccionarCliente(clientes.find(c => c.id === $event.value))"
                />
                <Button icon="pi pi-plus" severity="secondary" @click="nuevoClienteForm = { nombre: '', telefono: '' }; dialogNuevoCliente = true" v-tooltip="'Nuevo cliente'" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Nombre</label>
                <InputText v-model="form.nombre_cliente" placeholder="Nombre del cliente" class="uppercase" style="text-transform: uppercase;" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Telefono</label>
                <InputText v-model="form.telefono_cliente" placeholder="Telefono" />
              </div>
            </div>
          </div>
        </TabPanel>
        <TabPanel header="Equipo">
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">IMEI del Inventario</label>
              <Select
                v-model="form.id_imei"
                :options="imeisDisponibles"
                optionLabel="nombre"
                optionValue="id"
                placeholder="Seleccionar IMEI disponible"
                filter
                fluid
                @change="onImeiSelect"
              />
              <p class="text-xs text-surface-400">Solo se muestran IMEIs en estado DISPONIBLE</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Modelo</label>
                <InputText :value="form.telefono_modelo" placeholder="Modelo del telefono" disabled fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">IMEI No.</label>
                <InputText :value="form.imei_nombre" placeholder="Numero IMEI" disabled fluid />
              </div>
            </div>
          </div>
        </TabPanel>
        <TabPanel header="Pago">
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Total del Apartado (RD$)</label>
              <InputNumber v-model="form.total" mode="currency" currency="DOP" locale="es-DO" fluid />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Pago Inicial (RD$)</label>
                <InputNumber v-model="form.inicial" mode="currency" currency="DOP" locale="es-DO" fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold">Saldo Pendiente (RD$)</label>
                <InputNumber :value="saldoCalculado" mode="currency" currency="DOP" locale="es-DO" disabled fluid />
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Fecha de Inicio</label>
              <Calendar v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon fluid />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Vendedor</label>
              <InputText v-model="form.vendedor" placeholder="Vendedor" class="uppercase" style="text-transform: uppercase;" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-semibold">Nota</label>
              <Textarea v-model="form.nota" placeholder="Nota adicional" rows="2" class="uppercase" style="text-transform: uppercase;" />
            </div>
          </div>
        </TabPanel>
      </TabView>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogNuevo = false" />
        <Button label="Crear Apartado" icon="pi pi-check" @click="guardarNuevoApartado" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogNuevoCliente" header="Nuevo Cliente" modal :style="{ width: '24rem' }">
      <div class="flex flex-col gap-3 pt-2">
        <InputText v-model="nuevoClienteForm.nombre" placeholder="Nombre del cliente" class="uppercase" style="text-transform: uppercase;" />
        <InputText v-model="nuevoClienteForm.telefono" placeholder="Telefono" />
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogNuevoCliente = false" />
        <Button label="Crear" icon="pi pi-check" :loading="guardandoCliente" @click="crearCliente" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogPago" :header="`Registrar Pago - ${selectedApartado?.no_factura || ''}`" modal :style="{ width: '24rem' }">
      <div v-if="selectedApartado" class="space-y-4 pt-2">
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 space-y-1 text-sm">
          <div class="flex justify-between"><span class="text-surface-500">Cliente</span><span class="font-semibold">{{ selectedApartado.nombre_cliente }}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Total</span><span>${{ formatCurrency(selectedApartado.total) }}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Abonado</span><span>${{ formatCurrency(selectedApartado.abonado || 0) }}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Saldo</span><span class="font-bold text-primary">${{ formatCurrency(getSaldo(selectedApartado)) }}</span></div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Monto a pagar (RD$)</label>
          <InputNumber v-model="pagoForm.monto" mode="currency" currency="DOP" locale="es-DO" fluid :min="0" :max="getSaldo(selectedApartado)" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Metodo de Pago</label>
          <Select v-model="pagoForm.metodo_pago" :options="metodosPago" optionLabel="label" optionValue="value" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Fecha</label>
          <Calendar v-model="pagoForm.fecha" dateFormat="yy-mm-dd" showIcon fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Referencia</label>
          <InputText v-model="pagoForm.referencia" placeholder="No. referencia o nota" class="uppercase" style="text-transform: uppercase;" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogPago = false" />
        <Button label="Registrar Pago" icon="pi pi-check" @click="registrarPago" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogDetalle" :header="`Detalle - ${selectedApartado?.no_factura || ''}`" modal :style="{ width: '90%', maxWidth: '550px' }">
      <div v-if="selectedApartado" class="space-y-4 pt-2">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-surface-400 text-xs">Cliente</span><p class="font-semibold">{{ selectedApartado.nombre_cliente }}</p></div>
          <div><span class="text-surface-400 text-xs">Estado</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="getEstadoSeverity(selectedApartado.estado)">{{ selectedApartado.estado === 'APARTADO' ? 'ACTIVO' : selectedApartado.estado }}</span>
          </div>
          <div><span class="text-surface-400 text-xs">Telefono</span><p>{{ selectedApartado.telefono_cliente || '—' }}</p></div>
          <div><span class="text-surface-400 text-xs">Fecha</span><p>{{ formatFecha(selectedApartado.fecha_venta) }}</p></div>
          <div><span class="text-surface-400 text-xs">Total</span><p class="font-bold">${{ formatCurrency(selectedApartado.total) }}</p></div>
          <div><span class="text-surface-400 text-xs">Saldo</span>
            <p class="font-bold" :class="getSaldo(selectedApartado) <= 0 ? 'text-green-600' : 'text-orange-600'">${{ formatCurrency(getSaldo(selectedApartado)) }}</p>
          </div>
        </div>
        <div v-if="selectedApartado.notas" class="text-sm">
          <span class="text-surface-400 text-xs">Notas</span>
          <p class="mt-1">{{ selectedApartado.notas }}</p>
        </div>
        <div>
          <span class="text-surface-400 text-xs font-semibold">Historial de Pagos</span>
          <DataTable :value="getPagos(selectedApartado)" stripedRows class="mt-2 p-datatable-sm" responsiveLayout="scroll">
            <Column field="fecha" header="Fecha" style="width: 7rem">
              <template #body="{ data }">{{ formatFecha(data.fecha) }}</template>
            </Column>
            <Column field="monto" header="Monto" style="width: 7rem">
              <template #body="{ data }">${{ formatCurrency(data.monto) }}</template>
            </Column>
            <Column field="metodo_pago" header="Metodo" style="width: 7rem" />
            <Column field="referencia" header="Referencia" />
          </DataTable>
        </div>
      </div>
      <template #footer>
        <Button label="Ticket" icon="pi pi-print" severity="secondary" outlined @click="imprimirApartado(selectedApartado)" />
        <Button label="PDF" icon="pi pi-file-pdf" severity="danger" outlined @click="verPdfApartado(selectedApartado)" />
        <Button v-if="selectedApartado?.estado !== 'COMPLETADO' && selectedApartado?.estado !== 'CANCELADO'" label="Registrar Pago" icon="pi pi-dollar" severity="success" @click="dialogDetalle = false; abrirPago(selectedApartado)" />
        <Button label="Cerrar" severity="secondary" text @click="dialogDetalle = false" />
      </template>
    </Dialog>

    <Dialog v-model:visible="deleteDialogVisible" header="Cancelar Apartado" modal :style="{ width: '24rem' }">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
          <span>Seguro que deseas cancelar el apartado <strong>{{ selectedApartado?.no_factura }}</strong>? El IMEI volvera a estar disponible.</span>
        </div>
        <div v-if="(selectedApartado?.abonado || 0) > 0" class="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 text-xs text-yellow-700 dark:text-yellow-300">
          El cliente ha abonado <strong>${{ formatCurrency(selectedApartado?.abonado || 0) }}</strong>. Considera emitir una nota de credito.
        </div>
      </div>
      <template #footer>
        <Button label="No, mantener" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Si, cancelar" icon="pi pi-trash" severity="danger" @click="cancelarApartado" />
      </template>
    </Dialog>

    <TicketApartadoPrint ref="ticketApartadoRef" />
    <ApartadoPdfPrint ref="apartadoPdfRef" />
  </div>
</template>
