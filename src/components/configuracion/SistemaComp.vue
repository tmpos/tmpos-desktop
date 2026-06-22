<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import InputText from 'primevue/inputtext'
import InputSwitch from 'primevue/inputswitch'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const theme = useThemeStore()
const serverUrl = ref('')
const copiando = ref(false)
const shadeSeleccionada = ref(theme.colorShade || '500')
const shadeTopbar = ref('500')

const config = ref({
  app_nombre: 'TMPOS',
  moneda: 'RD$',
  formato_fecha: 'DD/MM/YYYY',
  zona_horaria: 'America/Santo_Domingo',
  idioma: 'es',
})

const coloresDisponibles = [
  { label: 'Azul', value: 'blue', color: '#3b82f6' },
  { label: 'Indigo', value: 'indigo', color: '#6366f1' },
  { label: 'Violeta', value: 'violet', color: '#8b5cf6' },
  { label: 'Teal', value: 'teal', color: '#14b8a6' },
  { label: 'Esmeralda', value: 'emerald', color: '#10b981' },
  { label: 'Rosa', value: 'rose', color: '#f43f5e' },
  { label: 'Naranja', value: 'orange', color: '#f97316' },
  { label: 'Cielo', value: 'sky', color: '#0ea5e9' },
]

const variantes = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

const monedas = [
  { label: 'RD$ (Peso Dominicano)', value: 'RD$' },
  { label: 'US$ (Dolar)', value: 'US$' },
  { label: 'EUR (Euro)', value: 'EUR' },
]

const formatosFecha = [
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
]

const guardando = ref(false)

async function guardar() {
  guardando.value = true
  toast.add({ severity: 'success', summary: 'Guardado', detail: 'Configuracion del sistema actualizada', life: 2000 })
  guardando.value = false
}

async function cargarServerUrl() {
  try {
    const res = await window.electron.invoke('getServerUrl') as any
    if (res.success && res.url) serverUrl.value = res.url
  } catch (_) {}
}

async function copiarUrl() {
  if (!serverUrl.value) return
  copiando.value = true
  try {
    await navigator.clipboard.writeText(serverUrl.value)
    toast.add({ severity: 'success', summary: 'Copiado', detail: 'URL copiada al portapapeles', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo copiar', life: 2000 })
  }
  copiando.value = false
}

onMounted(cargarServerUrl)
</script>

<template>
  <div>
    <Toast />

    <div class="space-y-6">
      <div class="flex items-center gap-3 pb-2 border-b border-surface-200 dark:border-surface-700">
        <div class="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-desktop text-primary text-lg"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold">Sistema</h2>
          <p class="text-sm text-surface-500">Configuracion general del sistema</p>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="space-y-5">
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 space-y-5">
            <h3 class="font-semibold flex items-center gap-2 text-sm">
              <i class="pi pi-palette text-primary"></i>
              Color Primario
            </h3>

            <div class="grid grid-cols-4 sm:grid-cols-8 gap-3">
              <button
                v-for="c in coloresDisponibles"
                :key="c.value"
                class="w-full aspect-square rounded-xl border-2 transition-all cursor-pointer relative"
                :class="theme.primaryColor === c.value
                  ? 'border-surface-900 dark:border-surface-0 ring-2 ring-offset-2 ring-primary'
                  : 'border-surface-200 dark:border-surface-600 hover:scale-105'"
                :style="{ backgroundColor: c.color }"
                @click="theme.setPrimaryColor(c.value)"
              >
                <div v-if="theme.primaryColor === c.value" class="absolute inset-0 flex items-center justify-center">
                  <i class="pi pi-check text-white text-sm drop-shadow"></i>
                </div>
              </button>
            </div>

            <div v-if="theme.colorPalettes[theme.primaryColor]" class="space-y-3">
              <h4 class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Variantes</h4>
              <div class="grid grid-cols-11 gap-1.5">
                <button
                  v-for="v in variantes"
                  :key="v"
                  class="aspect-square rounded-lg border-2 transition-all cursor-pointer relative"
                  :class="shadeSeleccionada === v ? 'border-surface-900 dark:border-surface-0 ring-2 ring-offset-1 ring-primary' : 'border-transparent hover:scale-110'"
                  :style="{ backgroundColor: theme.colorPalettes[theme.primaryColor][v] }"
                  @click="shadeSeleccionada = v; theme.setColorShade(v)"
                >
                  <div v-if="shadeSeleccionada === v" class="absolute inset-0 flex items-center justify-center">
                    <i class="pi pi-check text-white text-[8px] drop-shadow"></i>
                  </div>
                </button>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="font-medium">{{ shadeSeleccionada }}</span>
                <span class="text-surface-400">seleccionado</span>
                <span class="text-surface-400">|</span>
                <span class="font-mono text-[10px] text-surface-400">{{ theme.colorPalettes[theme.primaryColor][shadeSeleccionada] }}</span>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 space-y-4">
            <h3 class="font-semibold flex items-center gap-2 text-sm">
              <i class="pi pi-sun text-primary"></i>
              Apariencia
            </h3>

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Modo Oscuro</p>
                <p class="text-xs text-surface-400">Cambiar entre modo claro y oscuro</p>
              </div>
              <InputSwitch :modelValue="theme.isDark" @update:modelValue="theme.toggleTheme()" />
            </div>
          </div>

          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 space-y-4">
            <h3 class="font-semibold flex items-center gap-2 text-sm">
              <i class="pi pi-window-maximize text-primary"></i>
              Fondo de la Barra Superior
            </h3>

            <div class="grid grid-cols-4 sm:grid-cols-5 gap-2">
              <button
                v-for="c in [
                  { label: 'Blanco', value: 'white', color: '#ffffff' },
                  { label: 'Primary', value: 'primary', color: '#6366f1' },
                  { label: 'Oscuro', value: 'dark', color: '#0f172a' },
                  { label: 'Pizarra', value: 'slate', color: '#1e293b' },
                  { label: 'Transparente', value: 'transparent', color: 'transparent' },
                  { label: 'Azul', value: 'blue', color: '#2563eb' },
                  { label: 'Violeta', value: 'violet', color: '#7c3aed' },
                  { label: 'Esmeralda', value: 'emerald', color: '#059669' },
                  { label: 'Teal', value: 'teal', color: '#0d9488' },
                  { label: 'Cielo', value: 'sky', color: '#0284c7' },
                ]"
                :key="c.value"
                class="w-full aspect-square rounded-xl border-2 transition-all cursor-pointer relative"
                :class="theme.topbarBg === c.value
                  ? 'border-surface-900 dark:border-surface-0 ring-2 ring-offset-2 ring-primary'
                  : 'border-surface-200 dark:border-surface-600 hover:scale-105'"
                :style="{ backgroundColor: c.color, borderStyle: c.value === 'transparent' ? 'dashed' : 'solid' }"
                @click="theme.setTopbarBg(c.value)"
              >
                <div v-if="theme.topbarBg === c.value" class="absolute inset-0 flex items-center justify-center">
                  <i class="pi pi-check text-sm drop-shadow" :class="c.value === 'white' || c.value === 'transparent' ? 'text-surface-900' : 'text-white'"></i>
                </div>
              </button>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <span class="font-medium">{{ { white: 'Blanco', primary: 'Primary', dark: 'Oscuro', slate: 'Pizarra', transparent: 'Transparente', blue: 'Azul', violet: 'Violeta', emerald: 'Esmeralda', teal: 'Teal', sky: 'Cielo' }[theme.topbarBg] || 'Blanco' }}</span>
              <span class="text-surface-400">seleccionado</span>
            </div>
            <div v-if="theme.colorPalettes[theme.topbarBg]" class="space-y-3">
              <h4 class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Variantes</h4>
              <div class="grid grid-cols-11 gap-1.5">
                <button
                  v-for="v in variantes"
                  :key="v"
                  class="aspect-square rounded-lg border-2 transition-all cursor-pointer relative"
                  :class="shadeTopbar === v ? 'border-surface-900 dark:border-surface-0 ring-2 ring-offset-1 ring-primary' : 'border-transparent hover:scale-110'"
                  :style="{ backgroundColor: theme.colorPalettes[theme.topbarBg][v] }"
                  @click="shadeTopbar = v; theme.setTopbarShade(v)"
                >
                  <div v-if="shadeTopbar === v" class="absolute inset-0 flex items-center justify-center">
                    <i class="pi pi-check text-white text-[8px] drop-shadow"></i>
                  </div>
                </button>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="font-medium">{{ shadeTopbar }}</span>
                <span class="text-surface-400">seleccionado</span>
                <span class="font-mono text-[10px] text-surface-400">{{ theme.colorPalettes[theme.topbarBg][shadeTopbar] }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-5">
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 space-y-4">
            <h3 class="font-semibold flex items-center gap-2 text-sm">
              <i class="pi pi-cog text-primary"></i>
              Preferencias del Sistema
            </h3>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">Nombre de la Aplicacion</label>
              <InputText v-model="config.app_nombre" placeholder="TMPOS" fluid />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium">Moneda</label>
                <Select v-model="config.moneda" :options="monedas" optionLabel="label" optionValue="value" fluid />
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium">Formato de Fecha</label>
                <Select v-model="config.formato_fecha" :options="formatosFecha" optionLabel="label" optionValue="value" fluid />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5 space-y-4">
            <h3 class="font-semibold flex items-center gap-2 text-sm">
              <i class="pi pi-info-circle text-primary"></i>
              Informacion del Sistema
            </h3>

            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-surface-400 text-xs">Version</span>
                <p class="font-medium">1.0.0</p>
              </div>
              <div>
                <span class="text-surface-400 text-xs">Entorno</span>
                <p class="font-medium">Electron + Vue 3</p>
              </div>
              <div>
                <span class="text-surface-400 text-xs">Base de Datos</span>
                <p class="font-medium">SQLite</p>
              </div>
              <div>
                <span class="text-surface-400 text-xs">Tema Actual</span>
                <p class="font-medium capitalize">{{ theme.isDark ? 'Oscuro' : 'Claro' }}</p>
              </div>
            </div>
          </div>

          <div v-if="serverUrl" class="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-5 space-y-3">
            <h3 class="font-semibold flex items-center gap-2 text-sm text-primary">
              <i class="pi pi-globe text-primary"></i>
              Acceso por Red Local
            </h3>
            <p class="text-xs text-surface-500">Escanea el codigo QR o abre esta URL desde otro dispositivo en la misma red:</p>
            <div class="flex items-center gap-2">
              <InputText :value="serverUrl" readonly fluid class="font-mono text-xs" />
              <Button icon="pi pi-copy" severity="primary" text rounded size="small" :loading="copiando" @click="copiarUrl" v-tooltip="'Copiar URL'" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
