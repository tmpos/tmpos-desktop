<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputSwitch from 'primevue/inputswitch'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const versionActual = ref('')
const versionInfo = ref<any>(null)
const revisando = ref(false)
const descargando = ref(false)
const estadoDescarga = ref('')
const autoCheck = ref(true)
const autoInstall = ref(false)

async function cargarConfig() {
  try {
    const [resCheck, resInstall] = await Promise.all([
      (window as any).config.get('update_autoCheck'),
      (window as any).config.get('update_autoInstall'),
    ])
    if (resCheck.success) autoCheck.value = resCheck.data !== 'false'
    if (resInstall.success) autoInstall.value = resInstall.data === 'true'
  } catch {}
}

async function guardarAutoCheck(v: boolean) {
  await (window as any).config.set('update_autoCheck', String(v))
  if (!v) {
    autoInstall.value = false
    await (window as any).config.set('update_autoInstall', 'false')
  }
}

async function guardarAutoInstall(v: boolean) {
  await (window as any).config.set('update_autoInstall', String(v))
}

const hayActualizacion = computed(() => {
  if (!versionInfo.value || !versionActual.value) return false
  return versionInfo.value.version !== versionActual.value
})

async function revisar() {
  revisando.value = true
  try {
    const res = await (window as any).electron.invoke('update:check')
    if (res.success) {
      versionInfo.value = res.data
      try {
        const pkg = await (await fetch('/package.json')).json()
        versionActual.value = pkg.version || (window as any).appVersion || '2.5.0'
      } catch {
        versionActual.value = (window as any).appVersion || '2.5.0'
      }
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo verificar', life: 6000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 6000 })
  } finally {
    revisando.value = false
  }
}

async function descargarEInstalar() {
  if (!versionInfo.value?.url) {
    toast.add({ severity: 'warn', summary: 'Sin URL', detail: 'No hay URL de descarga disponible', life: 3000 })
    return
  }
  descargando.value = true
  estadoDescarga.value = 'Descargando actualizacion...'
  try {
    const res = await (window as any).electron.invoke('update:download', versionInfo.value.url)
    if (!res.success) {
      estadoDescarga.value = 'Error: ' + res.error
      setTimeout(() => { descargando.value = false }, 3000)
      return
    }
    estadoDescarga.value = 'Instalando nueva version...'
    await (window as any).electron.invoke('update:install', res.path)
  } catch (e: any) {
    estadoDescarga.value = 'Error: ' + e.message
    setTimeout(() => { descargando.value = false }, 3000)
  }
}

onMounted(async () => {
  await cargarConfig()
  if ((window as any).electron?.invoke) {
    ;(window as any).electron.invoke('app:getVersion').then((v: string) => {
      if (v) versionActual.value = v
    }).catch(() => {})
  }
})
</script>

<template>
  <div>
    <Toast />

    <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 max-w-xl">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
          <i class="pi pi-refresh text-lg"></i>
        </div>
        <div>
          <h3 class="font-bold text-lg">Actualizacion</h3>
          <p class="text-xs text-surface-500">Version actual: <strong>{{ versionActual }}</strong></p>
        </div>
      </div>

      <div v-if="versionInfo" class="space-y-4">
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-surface-500">Version disponible</span>
            <span class="font-bold text-primary">{{ versionInfo.version }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Fecha</span>
            <span>{{ versionInfo.fecha }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Actualizada</span>
            <Tag :value="hayActualizacion ? 'Disponible' : 'Actualizada'" :severity="hayActualizacion ? 'warn' : 'success'" />
          </div>
          <div v-if="versionInfo.notas" class="pt-1">
            <span class="text-surface-500 text-xs">Notas:</span>
            <p class="text-xs mt-0.5">{{ versionInfo.notas }}</p>
          </div>
        </div>

        <div v-if="hayActualizacion" class="flex gap-2">
          <Button label="Descargar e Instalar" icon="pi pi-download" :loading="descargando" @click="descargarEInstalar" />
        </div>
        <div v-else class="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
          <i class="pi pi-check-circle"></i> Tienes la ultima version
        </div>
      </div>

      <div class="mt-4">
        <Button label="Revisar actualizaciones" icon="pi pi-search" severity="secondary" :loading="revisando" @click="revisar" />
      </div>
    </div>

    <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 max-w-xl mt-4">
      <h4 class="font-bold text-sm mb-3 flex items-center gap-2"><i class="pi pi-cog text-primary"></i>Actualizacion automatica</h4>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Buscar actualizaciones</p>
            <p class="text-xs text-surface-400">Revisar automaticamente cada 30 minutos</p>
          </div>
           <InputSwitch v-model="autoCheck" @update:model-value="v => guardarAutoCheck(v)" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Descargar e instalar automaticamente</p>
            <p class="text-xs text-surface-400">Si hay actualizacion, descargar e instalar sin intervencion</p>
          </div>
           <InputSwitch v-model="autoInstall" :disabled="!autoCheck" @update:model-value="v => guardarAutoInstall(v)" />
        </div>
      </div>
    </div>

    <!-- Overlay de carga -->
    <div
      v-if="descargando"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style="background: rgba(0,0,0,0.7)"
    >
      <div class="w-16 h-16 rounded-2xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-2xl mb-4">
        <i class="pi pi-spin pi-spinner text-3xl text-primary"></i>
      </div>
      <p class="text-white text-lg font-semibold">{{ estadoDescarga }}</p>
      <p class="text-white/60 text-sm mt-1">No cierres la aplicacion...</p>
    </div>
  </div>
</template>
