<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

import { envioElectron } from '@/funciones/funciones.js'
import { useAlmacenFilter } from '@/composables/useAlmacenFilter'

const toast = useToast()
const { filterByAlmacen, addAlmacenId } = useAlmacenFilter()
const proveedores = ref<any[]>([])
const loading = ref(false)
const viewMode = ref<'table' | 'cards'>('cards')
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const isEditing = ref(false)
const selectedProveedor = ref<any>(null)
const busqueda = ref('')

const camposArray = [
  'nombre',
  'rnc',
  'telefono',
  'email',
  'encargado',
  'cuenta_bancaria',
  'direccion',
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
  nombre: '',
  rnc: '',
  telefono: '',
  email: '',
  encargado: '',
  cuenta_bancaria: '',
  direccion: '',
})

const form = ref(formDefault())

const proveedoresFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return proveedores.value
  return proveedores.value.filter(p =>
    p.nombre?.toLowerCase().includes(texto) ||
    p.rnc?.toLowerCase().includes(texto) ||
    p.telefono?.toLowerCase().includes(texto) ||
    p.email?.toLowerCase().includes(texto) ||
    p.encargado?.toLowerCase().includes(texto)
  )
})

async function cargarProveedores() {
  loading.value = true
  try {
    const res = await window.db.getAll('proveedores')
    if (res.success) {
      proveedores.value = filterByAlmacen(res.data || [])
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

function abrirCrear() {
  isEditing.value = false
  selectedProveedor.value = null
  form.value = formDefault()
  dialogVisible.value = true
}

function abrirEditar(proveedor: any) {
  isEditing.value = true
  selectedProveedor.value = proveedor
  form.value = {
    nombre: proveedor.nombre || '',
    rnc: proveedor.rnc || '',
    telefono: proveedor.telefono || '',
    email: proveedor.email || '',
    encargado: proveedor.encargado || '',
    cuenta_bancaria: proveedor.cuenta_bancaria || '',
    direccion: proveedor.direccion || '',
  }
  dialogVisible.value = true
}

function confirmarBorrar(proveedor: any) {
  selectedProveedor.value = proveedor
  deleteDialogVisible.value = true
}

async function guardar() {
  if (!form.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre es requerido', life: 3000 })
    return
  }

  try {
    const data = {
      nombre: form.value.nombre.trim().toUpperCase(),
      rnc: form.value.rnc.trim(),
      telefono: form.value.telefono.trim(),
      email: form.value.email.trim().toLowerCase(),
      encargado: form.value.encargado.trim().toUpperCase(),
      cuenta_bancaria: form.value.cuenta_bancaria.trim(),
      direccion: form.value.direccion.trim().toUpperCase(),
    }

    if (isEditing.value) {
      const res = await window.db.update('proveedores', selectedProveedor.value.id, data)
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Exito', detail: 'Proveedor actualizado', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo actualizar', life: 3000 })
        return
      }
    } else {
      const res = await window.db.insert('proveedores', addAlmacenId(data))
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Exito', detail: 'Proveedor creado', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo crear', life: 3000 })
        return
      }
    }

    dialogVisible.value = false
    await cargarProveedores()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 })
  }
}

async function borrar() {
  try {
    const res = await window.db.delete('proveedores', selectedProveedor.value.id)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Exito', detail: 'Proveedor eliminado', life: 3000 })
    }
    deleteDialogVisible.value = false
    await cargarProveedores()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
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

  await cargarProveedores()
})
</script>

<template>
  <div>
    <Toast />

    <Fieldset legend="Proveedores">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="busqueda" placeholder="Buscar proveedor..." />
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
          <Button label="Nuevo Proveedor" icon="pi pi-plus" @click="abrirCrear" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="proveedoresFiltrados"
        :loading="loading"
        stripedRows
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
      >
        <Column header="Acciones" style="width: 8rem">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-pencil" severity="info" text rounded @click.stop="abrirEditar(data)" v-tooltip="'Editar'" />
              <Button icon="pi pi-trash" severity="danger" text rounded @click.stop="confirmarBorrar(data)" v-tooltip="'Eliminar'" />
            </div>
          </template>
        </Column>
        <Column field="id" header="ID" style="width: 5rem" />
        <Column field="nombre" header="Nombre" sortable />
        <Column field="rnc" header="RNC" sortable style="width: 8rem" />
        <Column field="telefono" header="Telefono" sortable style="width: 9rem" />
        <Column field="email" header="Email" sortable />
        <Column field="encargado" header="Encargado" sortable />

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay proveedores registrados.</div>
        </template>
      </DataTable>

      <div v-else>
        <div v-if="loading" class="text-center py-10 text-surface-500">Cargando...</div>
        <div v-else-if="proveedoresFiltrados.length === 0" class="text-center py-10 text-surface-500">No hay proveedores registrados.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="proveedor in proveedoresFiltrados"
            :key="proveedor.id"
            class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer"
            @click="abrirEditar(proveedor)"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono text-surface-400">#{{ proveedor.id }}</span>
              <i class="pi pi-truck text-primary-500"></i>
            </div>

            <div class="min-w-0">
              <h4 class="font-bold text-lg leading-tight uppercase truncate">{{ proveedor.nombre }}</h4>
              <p class="text-sm text-surface-500 dark:text-surface-400 truncate">{{ proveedor.encargado || 'Sin encargado' }}</p>
            </div>

            <div class="grid grid-cols-1 gap-1 text-sm">
              <div class="flex items-center gap-2 min-w-0">
                <i class="pi pi-phone text-surface-400"></i>
                <span class="truncate">{{ proveedor.telefono || 'Sin telefono' }}</span>
              </div>
              <div class="flex items-center gap-2 min-w-0">
                <i class="pi pi-envelope text-surface-400"></i>
                <span class="truncate">{{ proveedor.email || 'Sin email' }}</span>
              </div>
              <div class="flex items-center gap-2 min-w-0">
                <i class="pi pi-id-card text-surface-400"></i>
                <span class="truncate">{{ proveedor.rnc || 'Sin RNC' }}</span>
              </div>
            </div>

            <div class="flex gap-2 mt-auto pt-2 border-t border-surface-100 dark:border-surface-700">
              <Button icon="pi pi-pencil" severity="info" text rounded size="small" @click.stop="abrirEditar(proveedor)" v-tooltip="'Editar'" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click.stop="confirmarBorrar(proveedor)" v-tooltip="'Eliminar'" />
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <Dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'"
      modal
      :style="{ width: '34rem' }"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">Nombre</label>
          <InputText v-model="form.nombre" placeholder="Nombre del proveedor" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">RNC</label>
          <InputText v-model="form.rnc" placeholder="RNC" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Telefono</label>
          <InputText v-model="form.telefono" placeholder="Telefono" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Email</label>
          <InputText v-model="form.email" placeholder="correo@dominio.com" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Encargado</label>
          <InputText v-model="form.encargado" placeholder="Persona encargada" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">Cuenta Bancaria</label>
          <InputText v-model="form.cuenta_bancaria" placeholder="Cuenta bancaria" fluid />
        </div>
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label class="font-semibold text-sm">Direccion</label>
          <Textarea v-model="form.direccion" rows="3" placeholder="Direccion" class="uppercase" style="text-transform: uppercase;" />
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardar" />
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
        <span>Seguro que deseas eliminar <strong>{{ selectedProveedor?.nombre }}</strong>?</span>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="borrar" />
      </template>
    </Dialog>
  </div>
</template>
