<script setup lang="ts">
import { ref, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { useEmpresa } from '@/composables/useEmpresa'
import { useAlmacenStore } from '@/stores/almacen.store'
import { useAuthStore } from '@/stores/auth.store'
import { uploadImage, getImageUrl, deleteImage } from '@/services/tmCloudClient'
import { isOnline, pushLocalRowToCloud } from '@/services/tmCloudSyncService'

const toast = useToast()
const almacenStore = useAlmacenStore()
const auth = useAuthStore()
const { empresa, cargar: cargarEmpresa, guardar: guardarEmpresa, nombre } = useEmpresa()
const loading = ref(false)
const guardando = ref(false)
const cambiandoTienda = ref(false)
const tiendaSeleccionada = ref<number | null>(null)
const deleteDialogVisible = ref(false)
const eliminandoEmpresa = ref(false)

const logoInput = ref<HTMLInputElement | null>(null)
const logoPreview = ref('')
const subiendoLogo = ref(false)

const form = ref({
  nombre: '',
  legal: '',
  encargado: '',
  telefono: '',
  email: '',
  direccion: '',
  logo: '',
})

async function cargar() {
  loading.value = true
  try {
    await cargarEmpresa()
    tiendaSeleccionada.value = almacenStore.activeId || null
    if (empresa.value) {
      form.value = {
        nombre: empresa.value.nombre || '',
        legal: empresa.value.legal || '',
        encargado: empresa.value.encargado || '',
        telefono: empresa.value.telefono || '',
        email: empresa.value.email || '',
        direccion: empresa.value.direccion || '',
        logo: empresa.value.logo || '',
      }
      logoPreview.value = getImageUrl(empresa.value.logo || '') || empresa.value.logo || ''
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function cambiarTienda() {
  if ((!auth.isAdmin && !auth.isSoporte) || !tiendaSeleccionada.value || tiendaSeleccionada.value === almacenStore.activeId) return
  cambiandoTienda.value = true
  try {
    const seleccionada = almacenStore.almacenes.find((item: any) => item.id === tiendaSeleccionada.value)
    if (!seleccionada || !almacenStore.setDefault(tiendaSeleccionada.value)) return
    await (window as any).config.set('empresa_id', String(seleccionada.empresa_id || seleccionada.id))
    toast.add({ severity: 'success', summary: 'Tienda cambiada', detail: seleccionada.nombre, life: 2000 })
    setTimeout(() => window.location.reload(), 400)
  } finally {
    setTimeout(() => { cambiandoTienda.value = false }, 500)
  }
}

function confirmarEliminarEmpresa() {
  if ((!auth.isAdmin && !auth.isSoporte) || !empresa.value?.id) return
  if (almacenStore.almacenes.length <= 1) {
    toast.add({ severity: 'warn', summary: 'No se puede eliminar', detail: 'Debe existir al menos una empresa en el sistema', life: 3500 })
    return
  }
  deleteDialogVisible.value = true
}

async function eliminarEmpresa() {
  if ((!auth.isAdmin && !auth.isSoporte) || !empresa.value?.id || almacenStore.almacenes.length <= 1) return
  eliminandoEmpresa.value = true
  try {
    const empresaId = Number(empresa.value.id)
    const siguiente = almacenStore.almacenes.find((item: any) => Number(item.empresa_id || item.id) !== empresaId)
    if (!siguiente) throw new Error('No hay otra empresa disponible')

    const res = await window.db.delete('empresa', empresaId)
    if (!res.success) throw new Error(res.error || 'No se pudo eliminar la empresa')

    almacenStore.setDefault(Number(siguiente.id))
    await (window as any).config.set('empresa_id', String(siguiente.empresa_id || siguiente.id))
    deleteDialogVisible.value = false
    toast.add({ severity: 'success', summary: 'Empresa eliminada', detail: 'Se activará la siguiente empresa disponible', life: 2500 })
    setTimeout(() => window.location.reload(), 500)
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error?.message || 'No se pudo eliminar la empresa', life: 4000 })
  } finally {
    eliminandoEmpresa.value = false
  }
}

function seleccionarLogo() {
  logoInput.value?.click()
}

async function guardarLogoInmediatamente(logo: string) {
  if (!empresa.value?.id) return
  await guardarEmpresa({ logo, almacen_id: almacenStore.activeId || 0, almacen_uid: almacenStore.activeUid || empresa.value?.uid || '' })
  if (isOnline()) {
    const syncResult = await pushLocalRowToCloud('empresa', empresa.value.id)
    if (!syncResult.success) throw new Error(syncResult.error || 'No se pudo sincronizar el logo con TM Cloud')
  }
  window.dispatchEvent(new CustomEvent('empresa:actualizada', { detail: { logo } }))
}

async function procesarLogo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona una imagen valida', life: 3000 })
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'La imagen no debe superar 2MB', life: 3000 })
    return
  }

  subiendoLogo.value = true
  try {
    const uid = await uploadImage(file, 'company/logo')
    form.value.logo = uid
    logoPreview.value = getImageUrl(uid) || ''
    await guardarLogoInmediatamente(uid)
    toast.add({ severity: 'success', summary: 'Logo subido', detail: 'El logo se guardo en TM Cloud', life: 2500 })
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error al subir', detail: error?.message || 'Configura TM Cloud antes de subir el logo', life: 4000 })
  } finally {
    subiendoLogo.value = false
    if (logoInput.value) logoInput.value.value = ''
  }
}

async function quitarLogo() {
  const logoAnterior = form.value.logo
  if (logoAnterior) {
    try { await deleteImage(logoAnterior) } catch {}
  }
  logoPreview.value = ''
  form.value.logo = ''
  try { await guardarLogoInmediatamente('') } catch (error: any) {
    toast.add({ severity: 'warn', summary: 'Logo removido localmente', detail: error?.message || 'No se pudo sincronizar el cambio', life: 4000 })
  }
  if (logoInput.value) logoInput.value.value = ''
}

async function guardar() {
  if (!form.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre de la empresa es requerido', life: 3000 })
    return
  }

  guardando.value = true
  try {
    const data: Record<string, any> = {
      nombre: form.value.nombre.trim().toUpperCase(),
      legal: form.value.legal.trim().toUpperCase(),
      encargado: form.value.encargado.trim().toUpperCase(),
      telefono: form.value.telefono.trim(),
      email: form.value.email.trim().toLowerCase(),
      direccion: form.value.direccion.trim().toUpperCase(),
      logo: form.value.logo || '',
      almacen_id: almacenStore.activeId || 0,
      almacen_uid: almacenStore.activeUid || empresa.value?.uid || '',
    }

    await guardarEmpresa(data)
    if (empresa.value?.id && isOnline()) {
      const syncResult = await pushLocalRowToCloud('empresa', empresa.value.id)
      if (!syncResult.success) {
        toast.add({ severity: 'warn', summary: 'Guardado local', detail: syncResult.error || 'No se pudo sincronizar la empresa con TM Cloud', life: 5000 })
      }
    }
    window.dispatchEvent(new CustomEvent('empresa:actualizada', { detail: data }))
    toast.add({ severity: 'success', summary: 'Exito', detail: 'Empresa actualizada', life: 3000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar', life: 3000 })
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  await cargar()
})
</script>

<template>
  <div>
    <Toast />

    <div v-if="loading" class="flex items-center justify-center py-20 text-surface-400 gap-3">
      <i class="pi pi-spin pi-spinner text-2xl"></i>
      <span>Cargando datos de la empresa...</span>
    </div>

    <div v-else class="max-w-3xl mx-auto space-y-6">
      <div v-if="almacenStore.hasMultiple" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4">
        <div>
          <p class="font-semibold text-sm">Empresa / tienda activa</p>
          <p class="text-xs text-surface-500">Los registros de Empresa se utilizan como almacenes del sistema.</p>
        </div>
        <Select
          v-model="tiendaSeleccionada"
          :options="almacenStore.almacenes"
          optionLabel="nombre"
          optionValue="id"
          class="w-full sm:w-64"
          :disabled="(!auth.isAdmin && !auth.isSoporte) || cambiandoTienda"
          @change="cambiarTienda"
        />
        <small v-if="!auth.isAdmin && !auth.isSoporte" class="text-amber-600">Solo Administrador o Soporte pueden cambiarla.</small>
      </div>

      <div class="flex items-center gap-3 pb-2 border-b border-surface-200 dark:border-surface-700">
        <div class="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-building text-primary text-lg"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold">Datos de la Empresa</h2>
          <p class="text-sm text-surface-500">Informacion general del negocio</p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-8">
        <div class="flex-shrink-0 flex flex-col items-center sm:items-start">
          <div
            class="relative w-40 h-40 rounded-2xl border-2 border-dashed border-surface-300 dark:border-surface-600 flex items-center justify-center overflow-hidden bg-surface-50 dark:bg-surface-800 group cursor-pointer transition-colors hover:border-primary-300 dark:hover:border-primary-600"
            @click="seleccionarLogo"
          >
            <img v-if="logoPreview" :src="logoPreview" class="w-full h-full object-contain p-3" alt="Logo" />
            <div v-else class="flex flex-col items-center gap-2 text-surface-400">
              <i class="pi pi-image text-4xl"></i>
              <span class="text-xs font-medium">Click para subir</span>
            </div>
            <div class="absolute inset-0 bg-surface-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
              <i class="pi pi-camera text-white text-2xl"></i>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <Button icon="pi pi-upload" size="small" severity="secondary" outlined :loading="subiendoLogo" @click="seleccionarLogo">Subir</Button>
            <Button v-if="logoPreview" icon="pi pi-trash" size="small" severity="danger" text @click="quitarLogo">Quitar</Button>
          </div>
          <p class="text-[11px] text-surface-400 mt-1.5">PNG, JPG. Max 2MB.</p>
          <input ref="logoInput" type="file" accept="image/*" class="hidden" @change="procesarLogo" />
        </div>

        <div class="flex-1 space-y-5">
          <div class="space-y-1.5">
            <label class="text-sm font-semibold flex items-center gap-1.5">
              <i class="pi pi-building text-surface-400 text-xs"></i>
              Nombre <span class="text-red-400">*</span>
            </label>
            <InputText v-model="form.nombre" placeholder="Nombre de la empresa" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-semibold flex items-center gap-1.5">
                <i class="pi pi-id-card text-surface-400 text-xs"></i>
                RNC / Legal
              </label>
              <InputText v-model="form.legal" placeholder="RNC" fluid class="uppercase" style="text-transform: uppercase;" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-semibold flex items-center gap-1.5">
                <i class="pi pi-phone text-surface-400 text-xs"></i>
                Telefono
              </label>
              <InputText v-model="form.telefono" placeholder="Telefono" fluid />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-semibold flex items-center gap-1.5">
              <i class="pi pi-user text-surface-400 text-xs"></i>
              Encargado
            </label>
            <InputText v-model="form.encargado" placeholder="Nombre del encargado" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-semibold flex items-center gap-1.5">
              <i class="pi pi-envelope text-surface-400 text-xs"></i>
              Email
            </label>
            <InputText v-model="form.email" placeholder="correo@dominio.com" fluid />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-semibold flex items-center gap-1.5">
              <i class="pi pi-map-marker text-surface-400 text-xs"></i>
              Direccion
            </label>
            <InputText v-model="form.direccion" placeholder="Direccion de la empresa" fluid class="uppercase" style="text-transform: uppercase;" />
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
        <Button
          v-if="auth.isAdmin || auth.isSoporte"
          label="Eliminar Empresa"
          icon="pi pi-trash"
          severity="danger"
          text
          :disabled="almacenStore.almacenes.length <= 1"
          @click="confirmarEliminarEmpresa"
        />
        <Button label="Guardar Cambios" icon="pi pi-check" :loading="guardando" @click="guardar" />
      </div>
    </div>

    <Dialog v-model:visible="deleteDialogVisible" header="Eliminar Empresa" modal :style="{ width: 'min(26rem, 92vw)' }">
      <div class="flex items-start gap-3">
        <i class="pi pi-exclamation-triangle text-red-500 text-2xl mt-1"></i>
        <div>
          <p class="font-semibold">¿Eliminar {{ empresa?.nombre }}?</p>
          <p class="text-sm text-surface-500 mt-1">Esta acción eliminará el registro de empresa. Otra empresa quedará activa automáticamente.</p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text :disabled="eliminandoEmpresa" @click="deleteDialogVisible = false" />
        <Button label="Sí, eliminar" icon="pi pi-trash" severity="danger" :loading="eliminandoEmpresa" @click="eliminarEmpresa" />
      </template>
    </Dialog>
  </div>
</template>
