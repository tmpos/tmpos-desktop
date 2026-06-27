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
import SelectButton from 'primevue/selectbutton'
import Chip from 'primevue/chip'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

import { envioElectron } from '@/funciones/funciones.js'
import { uploadImage, getImageUrl, deleteImage, isConnected as tmCloudConnected } from '@/services/tmCloudClient'
import { useAlmacenFilter } from '@/composables/useAlmacenFilter'

const toast = useToast()
const { filterByAlmacen, addAlmacenId } = useAlmacenFilter()
const electrodomesticos = ref<any[]>([])
const loading = ref(false)
const viewMode = ref<'table' | 'cards'>('cards')
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const detalleDialogVisible = ref(false)
const serialDialogVisible = ref(false)
const isEditing = ref(false)
const selectedElectrodomestico = ref<any>(null)
const busqueda = ref('')
const busquedaSerialElectrodomestico = ref('')
const serialesDelElectrodomestico = ref<any[]>([])
const proveedores = ref<any[]>([])
const dialogNuevoProveedor = ref(false)
const nuevoProveedorForm = ref({ nombre: '', telefono: '', direccion: '' })

const modoSerial = ref<'individual' | 'lote'>('individual')
const modosSerial = ref([
  { label: 'Individual', value: 'individual' },
  { label: 'Por Lote', value: 'lote' },
])
const batchSerialInput = ref('')
const batchSeriales = ref<string[]>([])
const guardandoSerialLote = ref(false)

function onBatchSerialInput(event: Event) {
  const input = (event.target as HTMLInputElement).value
  const partes = input.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
  if (partes.length > 1 || input.endsWith(',') || input.endsWith(';')) {
    const nuevos = partes.filter(p => !batchSeriales.value.includes(p))
    if (nuevos.length > 0) {
      batchSeriales.value = [...batchSeriales.value, ...nuevos]
    }
    batchSerialInput.value = ''
    ;(event.target as HTMLInputElement).value = ''
  } else {
    batchSerialInput.value = input
  }
}

function onBatchSerialKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    const input = (event.target as HTMLInputElement).value.trim()
    if (input && !batchSeriales.value.includes(input)) {
      batchSeriales.value = [...batchSeriales.value, input]
    }
    batchSerialInput.value = ''
    ;(event.target as HTMLInputElement).value = ''
  }
}

function removerSerialBatch(serial: string) {
  batchSeriales.value = batchSeriales.value.filter(s => s !== serial)
}

const electrodomesticosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return electrodomesticos.value
  return electrodomesticos.value.filter(t =>
    t.nombre?.toLowerCase().includes(texto)
  )
})

const serialesDelElectrodomesticoFiltrados = computed(() => {
  const texto = busquedaSerialElectrodomestico.value.toLowerCase().trim()
  if (!texto) return serialesDelElectrodomestico.value
  return serialesDelElectrodomestico.value.filter(i =>
    i.nombre?.toLowerCase().includes(texto) ||
    i.color?.toLowerCase().includes(texto) ||
    i.capacidad?.toLowerCase().includes(texto) ||
    i.proveedor?.toLowerCase().includes(texto)
  )
})

const camposArray = ['nombre']
const serialCamposArray = [
  'nombre',
  'id_equi',
  'costo',
  'precio_venta',
  'precio_min',
  'precio_xmayor',
  'color',
  'capacidad',
  'bateria',
  'estado',
  'fecha_venta',
  'comprador',
  'proveedor',
  'no_compra',
  'precio_vendido',
  'hora_venta',
  'no_factura',
  'nota',
]
const link = ref('')
const api = ref('')
const token = ref('')
const patronTelefono = ref('')
const linkImpresora = ref('')
const patroncedula = ref('')
const tokenCifrado = ref('')
const tokenCorto = ref('')

const form = ref({
  nombre: '',
  imagen: '',
})
const fileInput = ref<HTMLInputElement | null>(null)
const subiendoImagen = ref(false)

const serialForm = ref({
  nombre: '',
  costo: 0,
  precio_venta: 0,
  precio_min: 0,
  precio_xmayor: 0,
  capacidad: '',
  color: '',
  proveedor: '',
})

async function crearProveedorElect() {
  if (!nuevoProveedorForm.value.nombre.trim()) return
  const data = {
    nombre: nuevoProveedorForm.value.nombre.trim().toUpperCase(),
    telefono: nuevoProveedorForm.value.telefono.trim(),
    direccion: nuevoProveedorForm.value.direccion.trim().toUpperCase(),
  }
  const res = await window.db.insert('proveedores', addAlmacenId(data))
  if (res.success) {
    proveedores.value.push({ id: res.data.id, ...addAlmacenId(data) })
    serialForm.value.proveedor = data.nombre
    dialogNuevoProveedor.value = false
    toast.add({ severity: 'success', summary: 'Proveedor creado', detail: data.nombre, life: 2000 })
  }
}

async function cargarElectrodomesticos() {
  loading.value = true
  try {
    const res = await window.db.getAll('electrodomesticos')
    if (res.success) {
      electrodomesticos.value = filterByAlmacen(res.data || [])
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function cargarSerialesDelElectrodomestico(electrodomesticoId: number) {
  try {
    const res = await window.db.getAll('serial')
    if (res.success) {
      serialesDelElectrodomestico.value = filterByAlmacen(res.data || []).filter((i: any) => i.id_equi === electrodomesticoId)
    }
  } catch (error) {
    console.error(error)
  }
}

function abrirDetalle(electrodomestico: any) {
  selectedElectrodomestico.value = electrodomestico
  busquedaSerialElectrodomestico.value = ''
  cargarSerialesDelElectrodomestico(electrodomestico.id)
  detalleDialogVisible.value = true
}

function abrirCrear() {
  isEditing.value = false
  form.value = { nombre: '', imagen: '' }
  dialogVisible.value = true
}

function abrirEditar(electrodomestico = selectedElectrodomestico.value) {
  selectedElectrodomestico.value = electrodomestico
  isEditing.value = true
  form.value = {
    nombre: electrodomestico?.nombre || '',
    imagen: electrodomestico?.imagen || '',
  }
  detalleDialogVisible.value = false
  dialogVisible.value = true
}

function confirmarBorrar(electrodomestico = selectedElectrodomestico.value) {
  selectedElectrodomestico.value = electrodomestico
  deleteDialogVisible.value = true
}

function abrirAgregarSerial() {
  serialForm.value = {
    nombre: '',
    costo: 0,
    precio_venta: 0,
    precio_min: 0,
    precio_xmayor: 0,
    capacidad: '',
    color: '',
    proveedor: '',
  }
  batchSerialInput.value = ''
  batchSeriales.value = []
  modoSerial.value = 'individual'
  serialDialogVisible.value = true
}

async function guardar() {
  if (!form.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre es requerido', life: 3000 })
    return
  }

  const nombreMayus = form.value.nombre.trim().toUpperCase()

  try {
    const data: any = { nombre: nombreMayus }
    if (form.value.imagen) data.imagen = form.value.imagen

    if (isEditing.value) {
      const res = await window.db.update('electrodomesticos', selectedElectrodomestico.value.id, data)
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Exito', detail: 'Electrodomestico actualizado', life: 3000 })
      }
    } else {
      const res = await window.db.insert('electrodomesticos', addAlmacenId(data))
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Exito', detail: 'Electrodomestico creado', life: 3000 })
      }
    }
    dialogVisible.value = false
    await cargarElectrodomesticos()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 })
  }
}

async function guardarSerial() {
  if (!selectedElectrodomestico.value?.id) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona un electrodomestico', life: 3000 })
    return
  }

  if (!serialForm.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El Serial es requerido', life: 3000 })
    return
  }

  try {
    const existe = await window.db.getAll('serial')
    if (existe.success) {
      const dup = (existe.data || []).find((i: any) => i.nombre === serialForm.value.nombre.trim())
      if (dup) {
        toast.add({ severity: 'warn', summary: 'Serial duplicado', detail: 'Este Serial ya esta registrado', life: 4000 })
        return
      }
    }

    const data = {
      nombre: serialForm.value.nombre.trim().toUpperCase(),
      id_equi: selectedElectrodomestico.value.id,
      costo: serialForm.value.costo || 0,
      precio_venta: serialForm.value.precio_venta || 0,
      precio_min: serialForm.value.precio_min || 0,
      precio_xmayor: serialForm.value.precio_xmayor || 0,
      color: serialForm.value.color.trim().toUpperCase(),
      capacidad: serialForm.value.capacidad.trim().toUpperCase(),
      bateria: '',
      estado: 'DISPONIBLE',
      fecha_venta: null,
      comprador: '',
      proveedor: serialForm.value.proveedor.trim().toUpperCase(),
      no_compra: '',
      precio_vendido: 0,
      hora_venta: '',
      no_factura: '',
      nota: '',
    }

    const res = await window.db.insert('serial', addAlmacenId(data))
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Exito', detail: 'Serial creado', life: 3000 })
      serialDialogVisible.value = false
      await cargarSerialesDelElectrodomestico(selectedElectrodomestico.value.id)
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar el Serial', life: 3000 })
  }
}

async function agregarSerialEnLote() {
  if (!selectedElectrodomestico.value?.id) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona un electrodomestico', life: 3000 })
    return
  }

  const seriales = [...batchSeriales.value]
  if (seriales.length === 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Ingresa al menos un Serial', life: 3000 })
    return
  }

  guardandoSerialLote.value = true
  let insertados = 0
  let duplicados = 0
  let errores = 0

  try {
    const res = await window.db.getAll('serial')
    const existentes = new Set((res.data || []).map((i: any) => i.nombre))

    for (const serial of seriales) {
      const nombre = serial.trim().toUpperCase()
      if (existentes.has(nombre)) {
        duplicados++
        continue
      }

      const data = {
        nombre,
        id_equi: selectedElectrodomestico.value.id,
        costo: serialForm.value.costo || 0,
        precio_venta: serialForm.value.precio_venta || 0,
        precio_min: serialForm.value.precio_min || 0,
        precio_xmayor: serialForm.value.precio_xmayor || 0,
        color: serialForm.value.color.trim().toUpperCase(),
        capacidad: serialForm.value.capacidad.trim().toUpperCase(),
        bateria: '',
        estado: 'DISPONIBLE',
        fecha_venta: null,
        comprador: '',
        proveedor: serialForm.value.proveedor.trim().toUpperCase(),
        no_compra: '',
        precio_vendido: 0,
        hora_venta: '',
        no_factura: '',
        nota: '',
      }

      const r = await window.db.insert('serial', addAlmacenId(data))
      if (r.success) {
        insertados++
        existentes.add(nombre)
      } else {
        errores++
      }
    }

    let msg = `${insertados} Serial(es) insertados`
    if (duplicados > 0) msg += `, ${duplicados} duplicados omitidos`
    if (errores > 0) msg += `, ${errores} error(es)`

    toast.add({
      severity: insertados > 0 ? 'success' : 'warn',
      summary: 'Lote procesado',
      detail: msg,
      life: 4000,
    })

    batchSerialInput.value = ''
    batchSeriales.value = []
    await cargarSerialesDelElectrodomestico(selectedElectrodomestico.value.id)
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar lote', life: 3000 })
  } finally {
    guardandoSerialLote.value = false
  }
}

async function borrar() {
  try {
    const res = await window.db.delete('electrodomesticos', selectedElectrodomestico.value.id)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Exito', detail: 'Electrodomestico eliminado', life: 3000 })
    }
    deleteDialogVisible.value = false
    detalleDialogVisible.value = false
    await cargarElectrodomesticos()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
  }
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
    const uid = await uploadImage(file, 'electrodomesticos')
    form.value.imagen = uid
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

  await cargarElectrodomesticos()
  const resProv = await window.db.getAll('proveedores')
  if (resProv.success) proveedores.value = resProv.data || []
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Electrodomesticos">
      <div class="toolbar-mobile">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar electrodomestico..." />
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
          <Button label="Nuevo Electrodomestico" icon="pi pi-plus" @click="abrirCrear" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="electrodomesticosFiltrados"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
        @row-click="(e) => abrirDetalle(e.data)"
      >
        <Column field="id" header="ID" style="width: 5rem" />
        <Column field="nombre" header="Nombre" sortable />
        <Column header="Acciones" style="width: 10rem">
          <template #body="{ data }">
            <div class="flex gap-2">
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
          <div class="text-center py-6 text-surface-500">No hay electrodomesticos registrados.</div>
        </template>
      </DataTable>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="electrodomesticosFiltrados.length === 0" class="text-center py-10 text-surface-500">No hay electrodomesticos registrados.</div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <div
            v-for="elec in electrodomesticosFiltrados"
            :key="elec.id"
            class="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-2 flex flex-col gap-1.5 transition-shadow hover:shadow-sm cursor-pointer"
            @click="abrirDetalle(elec)"
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono text-surface-400">#{{ elec.id }}</span>
              <i class="pi pi-chevron-right text-[10px] text-surface-400"></i>
            </div>
            <div v-if="imagenUrl(elec.imagen)" class="-mx-2 -mt-2 mb-1 h-16 overflow-hidden">
              <img :src="imagenUrl(elec.imagen)" class="w-full h-full object-cover" alt="" />
            </div>
            <div class="flex items-center gap-2">
              <div v-if="!imagenUrl(elec.imagen)" class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                <i class="pi pi-sitemap text-primary-600 dark:text-primary-300 text-sm"></i>
              </div>
              <div class="min-w-0">
                <h4 class="font-semibold text-xs leading-tight uppercase truncate">{{ elec.nombre }}</h4>
                <p class="text-[10px] text-surface-400 truncate">Ver opciones</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <!-- Dialog Detalle Electrodomestico -->
    <Dialog
      v-model:visible="detalleDialogVisible"
      :header="selectedElectrodomestico?.nombre"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="flex flex-col gap-3">
        <Button
          label="Editar"
          icon="pi pi-pencil"
          severity="info"
          outlined
          class="w-full justify-start"
          @click="abrirEditar()"
        />
        <Button
          label="Agregar Serial"
          icon="pi pi-plus"
          severity="success"
          outlined
          class="w-full justify-start"
          @click="abrirAgregarSerial"
        />
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-sm">Lista de Seriales</span>
            <span class="text-xs text-surface-500">{{ serialesDelElectrodomesticoFiltrados.length }} encontrados</span>
          </div>

          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="busquedaSerialElectrodomestico" placeholder="Buscar Serial..." fluid />
          </IconField>

          <DataTable
            :value="serialesDelElectrodomesticoFiltrados"
            size="small"
            paginator
            :rows="5"
            :rowsPerPageOptions="[5, 10, 20]"
            dataKey="id"
            scrollable
            scrollHeight="14rem"
            responsiveLayout="scroll"
          >
            <Column field="nombre" header="Serial" style="min-width: 10rem">
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
              <div class="text-center py-4 text-surface-500 text-sm">No hay Seriales asociados.</div>
            </template>
          </DataTable>
        </div>
        <Button
          label="Eliminar Electrodomestico"
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
      :header="isEditing ? 'Editar Electrodomestico' : 'Nuevo Electrodomestico'"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Nombre</label>
          <InputText v-model="form.nombre" placeholder="Nombre del electrodomestico" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm">Imagen</label>
          <div v-if="form.imagen" class="relative w-32 h-32 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
            <img :src="imagenUrl(form.imagen)" class="w-full h-full object-cover" alt="Imagen del electrodomestico" />
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
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardar" />
      </template>
    </Dialog>

    <!-- Dialog Agregar Serial -->
    <Dialog
      v-model:visible="serialDialogVisible"
      :header="`Agregar Serial - ${selectedElectrodomestico?.nombre || ''}`"
      modal
      :style="{ width: '34rem' }"
    >
      <SelectButton v-model="modoSerial" :options="modosSerial" optionLabel="label" optionValue="value" :allowEmpty="false" fluid class="w-full mb-3" />

      <div v-if="modoSerial === 'individual'" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">Serial</label>
          <InputText
            v-model="serialForm.nombre"
            placeholder="Serial"
            fluid
            class="uppercase"
            style="text-transform: uppercase;"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Costo</label>
          <InputNumber v-model="serialForm.costo" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio Venta</label>
          <InputNumber v-model="serialForm.precio_venta" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio Min</label>
          <InputNumber v-model="serialForm.precio_min" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Precio Mayor</label>
          <InputNumber v-model="serialForm.precio_xmayor" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Capacidad</label>
          <InputText v-model="serialForm.capacidad" placeholder="Ej: 128GB" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Color</label>
          <InputText v-model="serialForm.color" placeholder="Color" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>

        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">Proveedor</label>
          <div class="flex gap-2">
            <Select v-model="serialForm.proveedor" :options="proveedores.map(p => p.nombre)" placeholder="Seleccionar proveedor" class="flex-1" fluid />
            <Button icon="pi pi-plus" severity="info" text rounded size="small" @click="dialogNuevoProveedor = true" v-tooltip="'Nuevo proveedor'" />
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Seriales (separados por coma, espacio o salto de linea)</label>
          <InputText
            :value="batchSerialInput"
            placeholder="SN-001, SN-002, SN-003"
            fluid
            class="font-mono text-sm uppercase"
            style="text-transform: uppercase;"
            @input="onBatchSerialInput"
            @keydown="onBatchSerialKeydown"
          />
          <div v-if="batchSeriales.length > 0" class="flex flex-wrap gap-1 mt-2">
            <Chip
              v-for="serial in batchSeriales"
              :key="serial"
              :label="serial"
              removable
              @remove="removerSerialBatch(serial)"
              class="text-xs"
            />
          </div>
          <p v-else class="text-xs text-surface-400">Escribe o pega los seriales separados por coma, espacio o enter. Cada uno se agregara como chip.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Costo</label>
            <InputNumber v-model="serialForm.costo" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Precio Venta</label>
            <InputNumber v-model="serialForm.precio_venta" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Precio Min</label>
            <InputNumber v-model="serialForm.precio_min" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Precio Mayor</label>
            <InputNumber v-model="serialForm.precio_xmayor" mode="currency" currency="USD" locale="en-US" fluid @focus="(e) => e.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Capacidad</label>
            <InputText v-model="serialForm.capacidad" placeholder="Ej: 128GB" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Color</label>
            <InputText v-model="serialForm.color" placeholder="Color" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Proveedor</label>
          <div class="flex gap-2">
            <Select v-model="serialForm.proveedor" :options="proveedores.map(p => p.nombre)" placeholder="Seleccionar proveedor" class="flex-1" fluid />
            <Button icon="pi pi-plus" severity="info" text rounded size="small" @click="dialogNuevoProveedor = true" v-tooltip="'Nuevo proveedor'" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="serialDialogVisible = false" />
        <Button v-if="modoSerial === 'individual'" label="Guardar" icon="pi pi-check" @click="guardarSerial" />
        <Button v-else label="Guardar Lote" icon="pi pi-check" :loading="guardandoSerialLote" @click="agregarSerialEnLote" />
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
        <span>Seguro que deseas eliminar <strong>{{ selectedElectrodomestico?.nombre }}</strong>?</span>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="borrar" />
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
        <Button label="Crear y Seleccionar" icon="pi pi-check" :disabled="!nuevoProveedorForm.nombre.trim()" @click="crearProveedorElect" />
      </template>
    </Dialog>
  </div>
</template>
