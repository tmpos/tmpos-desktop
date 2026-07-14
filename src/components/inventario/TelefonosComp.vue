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
import Chip from 'primevue/chip'
import SelectButton from 'primevue/selectbutton'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

import { envioElectron, encryptarPassword } from '@/funciones/funciones.js'
import { isOnline, pushLocalRowToCloud } from '@/services/tmCloudSyncService'
import { uploadImage, getImageUrl, deleteImage, isConnected as tmCloudConnected } from '@/services/tmCloudClient'
import { useAlmacenFilter } from '@/composables/useAlmacenFilter'

const toast = useToast()
const { filterByAlmacen, addAlmacenId } = useAlmacenFilter()
const telefonos = ref<any[]>([])
const loading = ref(false)
const viewMode = ref<'table' | 'cards'>('cards')
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const detalleDialogVisible = ref(false)
const imeiDialogVisible = ref(false)
const isEditing = ref(false)
const selectedTelefono = ref<any>(null)
const busqueda = ref('')
const busquedaImeiTelefono = ref('')
const imeisDelTelefono = ref<any[]>([])
const imeisDisponibles = ref<any[]>([])
const flippedTelId = ref<number | null>(null)
const imeiSearch = ref('')
const proveedores = ref<any[]>([])
const dialogNuevoProveedor = ref(false)
const nuevoProveedorForm = ref({ nombre: '', telefono: '', direccion: '' })
const link = ref('')
const api = ref('')
const token = ref('')
const patronTelefono = ref('')
const linkImpresora = ref('')
const patroncedula = ref('')
const tokenCorto = ref('')
const form = ref({ nombre: '', imagen: '' })
const fileInput = ref<HTMLInputElement | null>(null)
const subiendoImagen = ref(false)
const modoImei = ref<'individual' | 'lote'>('individual')
const modosImei = [
  { label: 'Individual', value: 'individual' },
  { label: 'Por Lote', value: 'lote' },
]
const guardandoLote = ref(false)
const batchImeis = ref<string[]>([])
const batchImeiInput = ref('')
const imeiForm = ref({
  nombre: '', costo: 0, precio_venta: 0, precio_min: 0, precio_xmayor: 0,
  color: '', capacidad: '', bateria: '', estado: 'DISPONIBLE',
  fecha_venta: null as Date | null, comprador: '', proveedor: '', no_compra: '',
  precio_vendido: 0, hora_venta: '', no_factura: '', nota: '',
})

const telefonosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return telefonos.value
  return telefonos.value.filter(t =>
    t.nombre?.toLowerCase().includes(texto)
  )
})

const imeisDelTelefonoFiltrados = computed(() => {
  const texto = busquedaImeiTelefono.value.toLowerCase().trim()
  if (!texto) return imeisDelTelefono.value
  return imeisDelTelefono.value.filter(i =>
    i.nombre?.toLowerCase().includes(texto) ||
    i.color?.toLowerCase().includes(texto) ||
    i.capacidad?.toLowerCase().includes(texto) ||
    i.proveedor?.toLowerCase().includes(texto)
  )
})

const camposArray = ['nombre']
const imeiCamposArray = [
  'nombre',
  'id_equi',
  'estado',
  'costo',
  'precio_venta',
  'precio_min',
  'precio_xmayor',
  'proveedor',
  'color',
  'capacidad',
  'bateria',
  'fecha_venta',
  'hora_venta',
  'comprador',
  'no_compra',
  'precio_vendido',
  'no_factura',
  'nota',
]

function imeiCount(telefonoId: number) {
  return imeisDisponibles.value.filter((i: any) => Number(i.id_equi) === telefonoId && i.estado === 'DISPONIBLE').length
}

function imeisDelTel(telefonoId: number) {
  const texto = imeiSearch.value.toLowerCase().trim()
  let list = imeisDisponibles.value.filter((i: any) => Number(i.id_equi) === telefonoId && i.estado === 'DISPONIBLE')
  if (texto) list = list.filter((i: any) => i.nombre?.toLowerCase().includes(texto))
  return list
}

function formatCurrency(val: any) {
  return Number(val || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function cargarTelefonos() {
  try {
    const [res, imeiRes] = await Promise.all([
      window.db.getAll('telefonos'),
      window.db.getAll('imei'),
    ])
    if (res.success) telefonos.value = filterByAlmacen(res.data || [])
    if (imeiRes.success) imeisDisponibles.value = filterByAlmacen(imeiRes.data || [])
  } catch (_) {}
}

function abrirDetalle(tel: any) {
  selectedTelefono.value = tel
  detalleDialogVisible.value = true
  imeiSearch.value = ''
  cargarImeisDelTelefono(tel.id)
}

async function abrirCrear() {
  isEditing.value = false
  selectedTelefono.value = null
  form.value.nombre = ''
  form.value.imagen = ''
  detalleDialogVisible.value = false
  dialogVisible.value = true
}

function abrirEditar(tel?: any) {
  const telefono = tel || selectedTelefono.value
  if (!telefono) return
  selectedTelefono.value = telefono
  form.value.nombre = telefono.nombre || ''
  form.value.imagen = telefono.imagen || ''
  isEditing.value = true
  dialogVisible.value = true
}

function confirmarBorrar(tel?: any) {
  if (tel) selectedTelefono.value = tel
  deleteDialogVisible.value = true
}

async function borrarTelefono() {
  try {
    const res = await window.db.delete('telefonos', selectedTelefono.value.id)
    if (!res.success) {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'Error al eliminar', life: 4000 })
      return
    }
    deleteDialogVisible.value = false
    await cargarTelefonos()
    toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Telefono eliminado', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message || 'Error al eliminar', life: 4000 })
  }
}

async function guardarTelefono() {
  const nombre = ((form.value?.nombre || '') as string).trim().toUpperCase()
  if (!nombre) return
  const data: any = { nombre }
  if (form.value.imagen) data.imagen = form.value.imagen
  try {
    let res
    const telefonoId = isEditing.value ? selectedTelefono.value.id : null
    if (isEditing.value) res = await window.db.update('telefonos', telefonoId, data)
    else res = await window.db.insert('telefonos', addAlmacenId(data))
    if (!res.success) {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'Error al guardar', life: 4000 })
      return
    }
    const idSincronizar = telefonoId || res.data?.id
    if (idSincronizar && isOnline()) {
      const syncResult = await pushLocalRowToCloud('telefonos', idSincronizar)
      if (!syncResult.success) {
        toast.add({ severity: 'warn', summary: 'Guardado local', detail: syncResult.error || 'No se pudo sincronizar el telefono con la nube', life: 6000 })
      }
    }
    form.value.nombre = ''
    dialogVisible.value = false
    await cargarTelefonos()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message || 'Error al guardar', life: 4000 })
  }
}

async function cargarImeisDelTelefono(telefonoId: number) {
  const res = await window.db.getAll('imei')
    if (res.success) imeisDelTelefono.value = filterByAlmacen(res.data || []).filter((i: any) => i.id_equi === telefonoId && i.estado === 'DISPONIBLE')
}

function abrirAgregarImei() {
  imeiForm.value = {
    nombre: '', costo: 0, precio_venta: 0, precio_min: 0, precio_xmayor: 0,
    color: '', capacidad: '', bateria: '', estado: 'DISPONIBLE',
    fecha_venta: null, comprador: '', proveedor: '', no_compra: '',
    precio_vendido: 0, hora_venta: '', no_factura: '', nota: '',
  }
  imeiDialogVisible.value = true
}

function onBatchInput(e: Event) {
  const target = e.target as HTMLInputElement
  let raw = String(target?.value || '').replace(/\D/g, '')
  let added = 0
  while (raw.length >= 15 && added < 10) {
    const imei = raw.substring(0, 15)
    if (!batchImeis.value.includes(imei)) batchImeis.value = [...batchImeis.value, imei]
    raw = raw.substring(15)
    added++
  }
  if (added > 0 && target) target.value = ''
}

async function crearProveedorTel() {
  if (!nuevoProveedorForm.value.nombre.trim()) return
  const data = {
    nombre: nuevoProveedorForm.value.nombre.trim().toUpperCase(),
    telefono: nuevoProveedorForm.value.telefono.trim(),
    direccion: nuevoProveedorForm.value.direccion.trim().toUpperCase(),
  }
  const res = await window.db.insert('proveedores', addAlmacenId(data))
  if (res.success) {
    const newProv = { id: res.data?.id || 0, ...data }
    proveedores.value.push(newProv)
    imeiForm.value.proveedor = data.nombre
    dialogNuevoProveedor.value = false
    toast.add({ severity: 'success', summary: 'Creado', detail: data.nombre, life: 2000 })
  }
}

async function guardarImei() {
  if (!selectedTelefono.value?.id) return
  if (!imeiForm.value.nombre.trim() || imeiForm.value.nombre.length !== 15) { toast.add({ severity: 'warn', summary: 'IMEI invalido', detail: '15 digitos requeridos', life: 3000 }); return }
  try {
    const existe = await window.db.getAll('imei')
    if (existe.success && (existe.data || []).find((i: any) => i.nombre === imeiForm.value.nombre.trim())) { toast.add({ severity: 'warn', summary: 'Duplicado', detail: 'El IMEI ya existe', life: 3000 }); return }
    await window.db.insert('imei', addAlmacenId({ nombre: imeiForm.value.nombre.trim(), id_equi: selectedTelefono.value.id, costo: imeiForm.value.costo || 0, precio_venta: imeiForm.value.precio_venta || 0, precio_min: imeiForm.value.precio_min || 0, precio_xmayor: imeiForm.value.precio_xmayor || 0, color: imeiForm.value.color.toUpperCase(), capacidad: imeiForm.value.capacidad.toUpperCase(), bateria: '', estado: 'DISPONIBLE', fecha_venta: null, comprador: '', proveedor: imeiForm.value.proveedor.toUpperCase(), no_compra: '', precio_vendido: 0, hora_venta: '', no_factura: '', nota: '' }))
    toast.add({ severity: 'success', summary: 'Creado', detail: 'IMEI creado', life: 3000 })
    imeiDialogVisible.value = false
    await cargarImeisDelTelefono(selectedTelefono.value.id)
    sincronizarImeiServidor({ nombre: imeiForm.value.nombre.trim(), costo: imeiForm.value.costo, precio_venta: imeiForm.value.precio_venta, proveedor: imeiForm.value.proveedor })
  } catch (_) { toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 }) }
}

async function agregarImeiEnLote() {
  if (!selectedTelefono.value?.id) return
  const imeis = [...batchImeis.value]
  if (imeis.length === 0) { toast.add({ severity: 'warn', summary: 'Vacio', detail: 'No hay IMEIs', life: 3000 }); return }
  guardandoLote.value = true
  try {
    const existentes = new Set(((await window.db.getAll('imei')).data || []).map((i: any) => i.nombre))
    let insertados = 0, errores = 0, duplicados = 0
    for (const imei of imeis) {
      if (existentes.has(imei)) { duplicados++; continue }
      try {
        await window.db.insert('imei', addAlmacenId({ nombre: imei, id_equi: selectedTelefono.value.id, costo: imeiForm.value.costo || 0, precio_venta: imeiForm.value.precio_venta || 0, precio_min: imeiForm.value.precio_min || 0, precio_xmayor: imeiForm.value.precio_xmayor || 0, color: imeiForm.value.color.toUpperCase(), capacidad: imeiForm.value.capacidad.toUpperCase(), bateria: '', estado: 'DISPONIBLE', fecha_venta: null, comprador: '', proveedor: imeiForm.value.proveedor.toUpperCase(), no_compra: '', precio_vendido: 0, hora_venta: '', no_factura: '', nota: '' }))
        insertados++
        sincronizarImeiServidor({ nombre: imei, costo: imeiForm.value.costo, precio_venta: imeiForm.value.precio_venta, proveedor: imeiForm.value.proveedor })
      } catch { errores++ }
    }
    let msg = `${insertados} insertados`
    if (duplicados > 0) msg += `, ${duplicados} duplicados`
    if (errores > 0) msg += `, ${errores} errores`
    toast.add({ severity: insertados > 0 ? 'success' : 'warn', summary: 'Lote procesado', detail: msg, life: 3000 })
    imeiDialogVisible.value = false
    await cargarImeisDelTelefono(selectedTelefono.value.id)
  } catch (_) {} finally { guardandoLote.value = false }
}

async function sincronizarImeiServidor(datos: any) {
  try {
    const cfgRes = await window.db.getAll('servidor_sync_config')
    const cfg = cfgRes.success && cfgRes.data?.length > 0 ? cfgRes.data[0] : null
    if (!cfg || !cfg.activo) return
    const tablasSync: string[] = cfg.tablas_sync ? JSON.parse(cfg.tablas_sync) : []
    if (!tablasSync.includes('imei')) return
    const baseUrl = String(cfg.servidor_url || '').replace(/\/+$/, '') + (String(cfg.api_path || '/api2')).replace(/\/+$/, '')
    const tokenRaw = cfg.token_hash || '1234567890abc'
    const token = tokenRaw.startsWith('$2b$') ? tokenRaw : await encryptarPassword(tokenRaw, 10)
    const empresaRes = await window.db.getAll('empresa')
    const almacen = (empresaRes.success && empresaRes.data?.[0]?.nombre) || ''
    const campos = ['id','almacen','imei','estado','fecha','equipo','proveedor','id_equi','costo','precio_venta','factura','no_compra','fecha_venta','hora_venta','comprador','detalles','usuario','created_at','updated_at','identificadordb','marca','modelo','preciocompra','precioventa','vendedor','cedula','telefono','direccion','nota','precio_compra','precio_min','precio_xmayor','ganancia','no_factura','bateria','capacidad']
    const enviar: Record<string, any> = {
      almacen, imei: String(datos.nombre || ''), estado: 'DISPONIBLE',
      fecha: new Date().toLocaleDateString('es-DO'), equipo: '', proveedor: String(datos.proveedor || ''),
      id_equi: String(selectedTelefono.value?.id || ''), costo: String(datos.costo || '0'),
      precio_venta: String(datos.precio_venta || '0'), factura: '', no_compra: '',
      fecha_venta: '', hora_venta: '', comprador: '', detalles: '', usuario: '',
      marca: '', modelo: '', preciocompra: String(datos.costo || '0'), precioventa: String(datos.precio_venta || '0'),
      vendedor: '', cedula: '', telefono: '', direccion: '', nota: '',
      precio_compra: String(datos.costo || '0'), precio_min: '0', precio_xmayor: '0', ganancia: '',
      no_factura: '', bateria: '', capacidad: '',
    }
    for (const key of Object.keys(enviar)) { if (!campos.includes(key)) delete enviar[key] }
    if (Object.keys(enviar).length === 0) return
    const existeRes = await fetch(`${baseUrl}/datoscampo/imei/imei/${encodeURIComponent(datos.nombre || '')}`, { method: 'GET', headers: { 'Accept': '*/*', 'Authorization': token } })
    let servidorId: string | null = null
    if (existeRes.ok) {
      try { const d = await existeRes.json(); const e = Array.isArray(d) ? d[0] : d?.data || d; if (e?.id) servidorId = String(e.id) } catch {}
    }
    if (servidorId) { enviar.id = servidorId; await fetch(`${baseUrl}/actualizarcampos/imei`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token }, body: JSON.stringify(enviar) }) }
    else { await fetch(`${baseUrl}/insertar/imei`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token }, body: JSON.stringify(enviar) }) }
  } catch {}
}

async function subirImagen() {
  const input = fileInput.value
  if (!input?.files?.length) return
  const file = input.files[0]
  if (!file.type.startsWith('image/')) {
    toast.add({ severity: 'warn', summary: 'Solo imagenes', detail: 'Selecciona un archivo de imagen', life: 3000 })
    return
  }
  if (!tmCloudConnected()) {
    toast.add({ severity: 'warn', summary: 'TM Cloud no configurado', detail: 'Configura TM Cloud para subir imagenes', life: 3000 })
    return
  }
  subiendoImagen.value = true
  try {
    const uid = await uploadImage(file, 'telefonos')
    form.value.imagen = uid
    if (isEditing.value && selectedTelefono.value?.id) {
      const actualizado = await window.db.update('telefonos', selectedTelefono.value.id, { imagen: uid })
      if (!actualizado.success) throw new Error(actualizado.error || 'No se pudo guardar la imagen')
      selectedTelefono.value.imagen = uid
      const local = telefonos.value.find((telefono: any) => telefono.id === selectedTelefono.value.id)
      if (local) local.imagen = uid
      if (isOnline()) await pushLocalRowToCloud('telefonos', selectedTelefono.value.id)
    }
    toast.add({ severity: 'success', summary: 'Imagen subida', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message || 'No se pudo subir la imagen', life: 4000 })
  } finally {
    subiendoImagen.value = false
    input.value = ''
  }
}

async function eliminarImagen() {
  if (!form.value.imagen) return
  try {
    await deleteImage(form.value.imagen)
  } catch {}
  form.value.imagen = ''
  if (isEditing.value && selectedTelefono.value?.id) {
    await window.db.update('telefonos', selectedTelefono.value.id, { imagen: '' })
    if (isOnline()) await pushLocalRowToCloud('telefonos', selectedTelefono.value.id)
  }
}

function imagenUrl(uid: string | null | undefined): string | null {
  return uid ? getImageUrl(uid) : null
}

onMounted(async () => {
  try {
    const datosJSON = await envioElectron('datosarchivo');
    if (datosJSON) {
      link.value = datosJSON.VITE_LINKURL || '';
      api.value = datosJSON.VITE_LINK_API || '';
      token.value = datosJSON.VITE_TOKEN || '';
      patronTelefono.value = datosJSON.VITE_PATRON_TELEFONO || '';
      linkImpresora.value = datosJSON.VITE_IMPRESORA_LOCAL || '';
      patroncedula.value = datosJSON.VITE_PATRON_CEDULA || '';
      tokenCorto.value = datosJSON.VITE_TOKEN_CORTO || '';
    }
  } catch (error) {
    console.error("Error cargando configuracion:", error);
  }

  await cargarTelefonos()
  const resProv = await window.db.getAll('proveedores')
  if (resProv.success) proveedores.value = resProv.data || []
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Telefonos">
      <div class="toolbar-mobile">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar telefono..." />
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
          <Button label="Nuevo Telefono" icon="pi pi-plus" @click="abrirCrear" />
        </div>
      </div>

      <div v-if="viewMode === 'table'" class="telefonos-table-wrap">
        <DataTable
          :value="telefonosFiltrados"
          :loading="loading"
          stripedRows
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 25, 50]"
          dataKey="id"
          responsiveLayout="scroll"
          class="telefonos-table"
          @row-click="(e) => abrirDetalle(e.data)"
        >
          <Column field="id" header="ID" style="width: 4rem" headerClass="hide-on-mobile" bodyClass="hide-on-mobile" />
          <Column field="nombre" header="Nombre" sortable style="min-width: 12rem" />
          <Column header="Acciones" style="width: 7rem">
            <template #body="{ data }">
              <div class="flex gap-1 justify-end">
                <Button
                  icon="pi pi-pencil"
                  severity="info"
                  text
                  rounded
                  @click.stop="abrirEditar(data)"
                  v-tooltip="'Editar'"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  @click.stop="confirmarBorrar(data)"
                  v-tooltip="'Eliminar'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="text-center py-6 text-surface-500">No hay telefonos registrados.</div>
          </template>
        </DataTable>
      </div>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="telefonosFiltrados.length === 0" class="text-center py-10 text-surface-500">No hay telefonos registrados.</div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div
            v-for="tel in telefonosFiltrados"
            :key="tel.id"
            class="flip-card perspective-[1000px]"
          >
            <div
              class="flip-inner relative transition-transform duration-500 cursor-pointer"
              :class="flippedTelId === tel.id ? '[transform:rotateY(180deg)]' : ''"
              style="transform-style: preserve-3d; min-height: 130px;"
            >
              <!-- FRONT -->
              <div
                class="absolute inset-0 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 flex flex-col gap-3 transition-shadow backface-hidden"
                @click="abrirDetalle(tel)"
                @contextmenu.prevent="() => { flippedTelId = flippedTelId === tel.id ? null : tel.id; imeiSearch = '' }"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-mono text-surface-400">#{{ tel.id }}</span>
                  <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                    {{ imeiCount(tel.id) }} IMEI{{ imeiCount(tel.id) === 1 ? '' : 's' }}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <div v-if="imagenUrl(tel.imagen)" class="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-surface-200 dark:border-surface-700">
                    <img :src="imagenUrl(tel.imagen)" class="w-full h-full object-cover" alt="" />
                  </div>
                  <div v-else class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                    <i class="pi pi-mobile text-primary-600 dark:text-primary-300 text-xl"></i>
                  </div>
                  <div>
                    <h4 class="font-bold text-lg leading-tight uppercase">{{ tel.nombre }}</h4>
                    <p class="text-sm text-surface-500 dark:text-surface-400">Ver opciones</p>
                  </div>
                </div>
              </div>

              <!-- BACK: IMEIs -->
              <div
                class="absolute inset-0 rounded-xl border border-primary-300 dark:border-primary-600 bg-surface-0 dark:bg-surface-800 p-3 flex flex-col gap-2 backface-hidden overflow-y-auto [transform:rotateY(180deg)]"
                @contextmenu.prevent="flippedTelId = null"
              >
                <div class="flex items-center justify-between gap-2 shrink-0">
                  <h4 class="font-semibold text-xs truncate">{{ tel.nombre }}</h4>
                  <Button icon="pi pi-times" severity="secondary" text rounded size="small" class="!w-6 !h-6 !text-[10px] shrink-0" @click="flippedTelId = null" />
                </div>
                <IconField class="shrink-0">
                  <InputIcon class="pi pi-search text-xs" />
                  <InputText v-model="imeiSearch" placeholder="Buscar IMEI..." fluid class="!h-7 !text-xs" @click.stop />
                </IconField>
                <div v-if="imeisDelTel(tel.id).length === 0" class="text-[11px] text-surface-400 text-center py-4">No hay IMEIs disponibles</div>
                <div
                  v-for="imei in imeisDelTel(tel.id)"
                  :key="imei.id"
                  class="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-50 dark:bg-surface-700/50 text-xs"
                  @contextmenu.prevent="flippedTelId = null"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="font-mono font-medium truncate">{{ imei.nombre }}</span>
                    <span v-if="imei.color || imei.capacidad" class="text-[10px] text-surface-400 truncate">{{ [imei.color, imei.capacidad].filter(Boolean).join(' / ') }}</span>
                  </div>
                  <span v-if="imei.precio_venta" class="font-semibold text-primary shrink-0 ml-2">${{ formatCurrency(imei.precio_venta) }}</span>
                </div>
                <p class="text-[9px] text-surface-400 text-center mt-auto shrink-0">Click derecho para volver</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <!-- Dialog Detalle Telefono -->
    <Dialog
      v-model:visible="detalleDialogVisible"
      :header="selectedTelefono?.nombre"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3 rounded-lg bg-surface-50 dark:bg-surface-700/30 p-3">
          <div v-if="imagenUrl(selectedTelefono?.imagen)" class="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-surface-200 dark:border-surface-700">
            <img :src="imagenUrl(selectedTelefono?.imagen)" class="w-full h-full object-cover" :alt="`Imagen de ${selectedTelefono?.nombre || 'teléfono'}`" />
          </div>
          <div v-else class="w-16 h-16 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
            <i class="pi pi-mobile text-primary-600 dark:text-primary-300 text-2xl"></i>
          </div>
          <div class="min-w-0">
            <p class="font-semibold truncate">{{ selectedTelefono?.nombre }}</p>
            <p class="text-xs text-surface-500">{{ imeisDelTelefonoFiltrados.length }} IMEI(s) disponibles</p>
          </div>
        </div>
        <Button
          label="Editar"
          icon="pi pi-pencil"
          severity="info"
          outlined
          class="w-full justify-start"
          @click="abrirEditar()"
        />
        <Button
          label="Agregar IMEI"
          icon="pi pi-plus"
          severity="success"
          outlined
          class="w-full justify-start"
          @click="abrirAgregarImei"
        />
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-sm">Lista de IMEI</span>
            <span class="text-xs text-surface-500">{{ imeisDelTelefonoFiltrados.length }} encontrados</span>
          </div>

          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="busquedaImeiTelefono" placeholder="Buscar IMEI..." fluid />
          </IconField>

          <DataTable
            :value="imeisDelTelefonoFiltrados"
            size="small"
            paginator
            :rows="5"
            :rowsPerPageOptions="[5, 10, 20]"
            dataKey="id"
            scrollable
            scrollHeight="14rem"
            responsiveLayout="scroll"
          >
            <Column field="nombre" header="IMEI" style="min-width: 10rem">
              <template #body="{ data }">
                <span class="font-mono text-sm">{{ data.nombre }}</span>
              </template>
            </Column>
            <Column field="capacidad" header="Cap." style="min-width: 5rem" />
            <Column field="color" header="Color" style="min-width: 6rem" />
            <Column field="estado" header="Estado" style="min-width: 7rem">
              <template #body="{ data }">
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="data.estado === 'DISPONIBLE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
                >
                  {{ data.estado }}
                </span>
              </template>
            </Column>

            <template #empty>
              <div class="text-center py-4 text-surface-500 text-sm">No hay IMEI asociados.</div>
            </template>
          </DataTable>
        </div>
        <Button
          label="Eliminar Telefono"
          icon="pi pi-trash"
          severity="danger"
          outlined
          class="w-full justify-start mt-2"
          @click="confirmarBorrar()"
        />
      </div>
    </Dialog>

    <!-- Dialog Crear/Editar -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? 'Editar Telefono' : 'Nuevo Telefono'"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Nombre</label>
          <InputText v-model="form.nombre" placeholder="Nombre del telefono" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm">Imagen</label>
          <div v-if="form.imagen" class="relative w-32 h-32 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
            <img :src="imagenUrl(form.imagen)" class="w-full h-full object-cover" alt="Imagen del telefono" />
            <Button icon="pi pi-times" severity="danger" text rounded size="small" class="absolute top-1 right-1 !w-6 !h-6 !text-xs bg-white/80 dark:bg-surface-800/80" @click="eliminarImagen" />
          </div>
          <div class="flex gap-2">
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="subirImagen" />
            <Button :label="(form.imagen ? 'Cambiar ' : 'Subir ') + 'Imagen'" icon="pi pi-upload" severity="secondary" outlined :loading="subiendoImagen" @click="fileInput?.click()" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarTelefono" />
      </template>
    </Dialog>

    <!-- Dialog Agregar IMEI -->
    <Dialog
      v-model:visible="imeiDialogVisible"
      :header="`Agregar IMEI - ${selectedTelefono?.nombre || ''}`"
      modal
      :style="{ width: '34rem' }"
    >
      <div class="flex items-center gap-3 mb-3 rounded-lg bg-surface-50 dark:bg-surface-700/30 p-3">
        <div v-if="imagenUrl(selectedTelefono?.imagen)" class="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-surface-200 dark:border-surface-700">
          <img :src="imagenUrl(selectedTelefono?.imagen)" class="w-full h-full object-cover" :alt="`Imagen de ${selectedTelefono?.nombre || 'teléfono'}`" />
        </div>
        <div v-else class="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0"><i class="pi pi-mobile text-primary-600 dark:text-primary-300 text-lg"></i></div>
        <div><p class="font-semibold text-sm">{{ selectedTelefono?.nombre }}</p><p class="text-xs text-surface-500">Equipo para el nuevo IMEI</p></div>
      </div>
      <SelectButton v-model="modoImei" :options="modosImei" optionLabel="label" optionValue="value" :allowEmpty="false" class="w-full mb-3" fluid />

      <div v-if="modoImei === 'individual'" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">IMEI</label>
          <InputText
            v-model="imeiForm.nombre"
            placeholder="IMEI"
            fluid
            inputmode="numeric"
            maxlength="15"
            @keydown="bloquearImeiNoNumerico"
            @input="normalizarImei"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Costo</label>
          <InputNumber v-model="imeiForm.costo" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio Venta</label>
          <InputNumber v-model="imeiForm.precio_venta" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio Min</label>
          <InputNumber v-model="imeiForm.precio_min" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio Mayor</label>
          <InputNumber v-model="imeiForm.precio_xmayor" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Capacidad</label>
          <InputText v-model="imeiForm.capacidad" placeholder="Ej: 128GB" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Color</label>
          <InputText v-model="imeiForm.color" placeholder="Color" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>

        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">Proveedor</label>
          <div class="flex gap-2">
            <Select v-model="imeiForm.proveedor" :options="proveedores.map(p => p.nombre)" placeholder="Seleccionar proveedor" class="flex-1" fluid />
            <Button icon="pi pi-plus" severity="info" text rounded size="small" @click="dialogNuevoProveedor = true" v-tooltip="'Nuevo proveedor'" />
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">IMEIs (escribe o pega, se agregan automaticamente)</label>
          <input
            placeholder="356307044521235"
            inputmode="numeric"
            class="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-700 text-sm font-mono outline-none focus:ring-2 focus:ring-primary-500"
            @input="onBatchInput"
          />
          <div v-if="batchImeis.length > 0" class="flex flex-wrap gap-1 mt-2">
            <Chip
              v-for="imei in batchImeis"
              :key="imei"
              :label="imei"
              removable
              @remove="removerImeiBatch(imei)"
              class="text-xs"
            />
          </div>
          <p v-else class="text-xs text-surface-400">Cada vez que escribas 15 digitos se agregara automaticamente como chip.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Costo</label>
            <InputNumber v-model="imeiForm.costo" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Precio Venta</label>
            <InputNumber v-model="imeiForm.precio_venta" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Precio Min</label>
            <InputNumber v-model="imeiForm.precio_min" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Precio Mayor</label>
            <InputNumber v-model="imeiForm.precio_xmayor" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Capacidad</label>
            <InputText v-model="imeiForm.capacidad" placeholder="Ej: 128GB" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Color</label>
            <InputText v-model="imeiForm.color" placeholder="Color" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Proveedor</label>
          <div class="flex gap-2">
            <Select v-model="imeiForm.proveedor" :options="proveedores.map(p => p.nombre)" placeholder="Seleccionar proveedor" class="flex-1" fluid />
            <Button icon="pi pi-plus" severity="info" text rounded size="small" @click="dialogNuevoProveedor = true" v-tooltip="'Nuevo proveedor'" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="imeiDialogVisible = false" />
        <Button v-if="modoImei === 'individual'" label="Guardar" icon="pi pi-check" @click="guardarImei" />
        <Button v-else label="Guardar Lote" icon="pi pi-check" :loading="guardandoLote" @click="agregarImeiEnLote" />
      </template>
    </Dialog>

    <!-- Dialog Confirmar Borrar -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Confirmar"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>Seguro que deseas eliminar <strong>{{ selectedTelefono?.nombre }}</strong>?</span>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="borrarTelefono" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogNuevoProveedor" header="Nuevo Proveedor" modal :style="{ width: '26rem' }">
      <div class="flex flex-col gap-3 pt-2">
        <div class="space-y-1">
          <label class="text-sm font-medium">Nombre <span class="text-red-400">*</span></label>
          <InputText v-model="nuevoProveedorForm.nombre" placeholder="Nombre del proveedor" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-sm font-medium">Telefono</label>
            <InputText v-model="nuevoProveedorForm.telefono" placeholder="Telefono" fluid />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Direccion</label>
            <InputText v-model="nuevoProveedorForm.direccion" placeholder="Direccion" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogNuevoProveedor = false" />
        <Button label="Crear y Seleccionar" icon="pi pi-check" :disabled="!nuevoProveedorForm.nombre.trim()" @click="crearProveedorTel" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.telefonos-table-wrap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.telefonos-table {
  min-width: 0;
  max-width: 100%;
}

:deep(.telefonos-table .p-datatable-wrapper) {
  max-width: 100%;
  overflow-x: auto;
}

:deep(.telefonos-table .p-datatable-table) {
  min-width: 22rem !important;
}

:deep(.telefonos-table .p-paginator) {
  flex-wrap: wrap;
  row-gap: 0.35rem;
}

@media (max-width: 480px) {
  :deep(.telefonos-table .p-datatable-thead > tr > th),
  :deep(.telefonos-table .p-datatable-tbody > tr > td) {
    padding-left: 0.55rem;
    padding-right: 0.55rem;
  }
}
</style>
