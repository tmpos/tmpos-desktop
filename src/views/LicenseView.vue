<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import * as tmc from '@/services/tmCloudClient'
import * as tmSync from '@/services/tmCloudSyncService'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const LICENCIA_TIMEOUT_MS = 10000

const verificando = ref(true)
const macAddress = ref('')

const licenciaFullCode = ref('')
const licenciaError = ref('')
const licenciaLoading = ref(false)
const licenciaInputRef = ref<HTMLInputElement | null>(null)

const syncDialogVisible = ref(false)
const syncOpcion = ref<'descargar' | 'subir' | null>(null)
const syncGuardando = ref(false)

function withTimeout(promise: Promise<any>, ms: number, label: string) {
  let timeoutId: any
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} excedio ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function formatLicenciaCode(val: string) {
  const clean = String(val || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 15)
  const parts = []
  for (let i = 0; i < clean.length; i += 5) parts.push(clean.slice(i, i + 5))
  return parts.join('-')
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const formatted = formatLicenciaCode(input.value)
  licenciaFullCode.value = formatted
  if (input.value !== formatted) input.value = formatted
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') || ''
  const formatted = formatLicenciaCode(text)
  licenciaFullCode.value = formatted
  e.preventDefault()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && licenciaFullCode.value.length === 17) registrarEquipo()
}

async function registrarEquipo() {
  const codigo = licenciaFullCode.value
  if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(codigo)) {
    licenciaError.value = 'Introduce un codigo valido de 15 caracteres'
    return
  }
  console.log('[LicenseView] Codigo ingresado:', codigo)
  licenciaLoading.value = true
  licenciaError.value = ''
  try {
    console.log('[LicenseView] Llamando licencia:fetchConfig...')
    const result = await withTimeout(
      window.electron.invoke('licencia:fetchConfig', codigo),
      LICENCIA_TIMEOUT_MS,
      'licencia:fetchConfig'
    ) as any
    console.log('[LicenseView] Resultado fetchConfig:', JSON.stringify(result))
    if (result.data) {
      console.log('=== DATOS DEL SERVIDOR ===')
      console.log('Campos recibidos:', result.data.serverFields)
      console.log('tieneSecretKey:', result.data.tieneSecretKey)
      console.log('tienePublicKey:', result.data.tienePublicKey)
      console.log('tieneProjectUrl:', result.data.tieneProjectUrl)
      console.log('tieneEmpresa:', result.data.tieneEmpresa)
      console.log('secretKeyPreview:', result.data.secretKeyPreview)
      console.log('publicKeyPreview:', result.data.publicKeyPreview)
      console.log('projectUrl:', result.data.projectUrl)
      console.log('===========================')
    }
    if (!result.success) {
      licenciaError.value = result.error || 'No se pudo validar la licencia'
      return
    }
    toast.add({ severity: 'success', summary: 'Licencia validada', detail: 'Conectando con la nube...', life: 3000 })
    const config = await tmc.ensureConfigLoaded()
    console.log('[LicenseView] TM Cloud config cargada:', { conectada: Boolean(config), url: config?.url?.substring(0, 50), tieneKey: Boolean(config?.key), tieneServiceKey: Boolean(config?.serviceKey) })
    if (config) {
      try {
        const empresaRows = await tmc.fetchTable('empresa')
        console.log('[LicenseView] Empresa desde la nube:', { cantidad: empresaRows.length, filas: empresaRows })
        if (empresaRows.length > 0) {
          let logoLocal = ''
          const localRes = await window.db.getAll('empresa')
          if (localRes.success && localRes.data?.length > 0) {
            logoLocal = localRes.data[0]?.logo || ''
            for (const row of localRes.data) {
              if (row.id) await window.db.delete('empresa', row.id)
            }
            console.log('[LicenseView] Datos locales de empresa eliminados, logoLocal:', logoLocal ? logoLocal.substring(0, 30) + '...' : '(vacio)')
          }
          for (const row of empresaRows) {
            const clean = { ...row }
            delete clean.id
            if (!clean.logo && logoLocal) {
              clean.logo = logoLocal
              console.log('[LicenseView] Logo local preservado en registro de empresa')
            }
            await window.db.insert('empresa', clean)
          }
          console.log('[LicenseView] Datos de empresa insertados desde la nube:', empresaRows.length)
          toast.add({ severity: 'success', summary: 'Empresa sincronizada', detail: `Datos de empresa descargados (${empresaRows.length} registro(s))`, life: 3000 })
        }
      } catch (e: any) {
        console.log('[LicenseView] Error descargando empresa:', e.message)
      }
    }
    console.log('[LicenseView] Llamando licencia:solicitarRegistroEquipo...')
    const reg = await withTimeout(
      window.electron.invoke('licencia:solicitarRegistroEquipo', { licencia: codigo }),
      LICENCIA_TIMEOUT_MS,
      'licencia:solicitarRegistroEquipo'
    ) as any
    console.log('[LicenseView] Resultado solicitarRegistroEquipo:', JSON.stringify(reg))
    if (reg.success) {
      toast.add({ severity: 'success', summary: 'Equipo registrado', detail: reg.mensaje || 'El equipo se ha registrado correctamente', life: 3000 })
      syncDialogVisible.value = true
    } else {
      licenciaError.value = reg.error || 'No se pudo registrar el equipo'
    }
  } catch (e: any) {
    licenciaError.value = e.message || 'Error al registrar'
  } finally {
    licenciaLoading.value = false
  }
}

async function ejecutarSync(opcion: 'descargar' | 'subir') {
  syncOpcion.value = opcion
  syncGuardando.value = true
  syncDialogVisible.value = false
  console.log('[LicenseView] Ejecutando sync opcion:', opcion)
  try {
    if (opcion === 'descargar') {
      toast.add({ severity: 'info', summary: 'Descargando datos', detail: 'Descargando todos los datos desde la nube...', life: 5000 })
      const res = await tmSync.downloadAllTables()
      console.log('[LicenseView] Resultado downloadAllTables:', JSON.stringify(res))
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Datos descargados', detail: res.message || 'Todos los datos se descargaron correctamente', life: 4000 })
      } else {
        toast.add({ severity: 'warn', summary: 'Descarga parcial', detail: res.message || 'Algunos datos no se pudieron descargar', life: 5000 })
      }
    } else {
      toast.add({ severity: 'info', summary: 'Subiendo datos', detail: 'Subiendo todos los datos locales a la nube...', life: 5000 })
      const res = await tmSync.pushAllTables()
      console.log('[LicenseView] Resultado pushAllTables:', JSON.stringify(res))
      if (res.success) {
        toast.add({ severity: 'success', summary: 'Datos subidos', detail: res.message || 'Todos los datos se subieron correctamente', life: 4000 })
      } else {
        toast.add({ severity: 'warn', summary: 'Subida parcial', detail: res.message || 'Algunos datos no se pudieron subir', life: 5000 })
      }
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error de sincronizacion', detail: e.message || 'Error inesperado', life: 5000 })
  } finally {
    syncGuardando.value = false
    router.push('/')
  }
}

function omitirSync() {
  syncDialogVisible.value = false
  router.push('/')
}

async function cerrarSesion() {
  auth.logout()
  router.push('/login')
}

onMounted(async () => {
  if (!(window as any).electron?.invoke) {
    router.push('/')
    return
  }
  try {
    const macResult = await window.electron.invoke('licencia:getMacAddress') as any
    if (macResult.success) {
      macAddress.value = macResult.data.mac
    }
  } catch (_) {}
  verificando.value = false
  nextTick(() => licenciaInputRef.value?.focus())
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-950">
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10" style="background:var(--p-primary-500);filter:blur(80px)"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-5" style="background:var(--p-primary-500);filter:blur(100px)"></div>
      <div class="absolute inset-0" style="background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,0.02) 1px,transparent 0);background-size:40px 40px"></div>
    </div>

    <Toast />

    <div
      v-if="verificando"
      class="flex flex-col items-center justify-center gap-4 relative z-10"
    >
      <i class="pi pi-spin pi-spinner text-3xl text-white"></i>
      <p class="text-white text-sm">Verificando...</p>
    </div>

    <div
      v-else
      class="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10 p-8"
    >
      <div class="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" :style="{ backgroundColor: 'var(--p-primary-500)' }"></div>

      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4">
          <i class="pi pi-shield text-2xl" style="color:var(--p-primary-500)"></i>
        </div>
        <h1 class="text-2xl font-bold text-white">Licencia requerida</h1>
        <p class="text-gray-400 text-sm mt-2">Este equipo no cuenta con una licencia activa.</p>
        <p class="text-gray-500 text-xs mt-1">Introduce el codigo de licencia para registrar este equipo.</p>
      </div>

      <div class="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-500">Codigo de equipo</span>
          <span class="font-mono text-gray-300 tracking-wide">{{ macAddress || '—' }}</span>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 mb-1.5 block text-center">Codigo de licencia</label>
          <input
            ref="licenciaInputRef"
            :value="licenciaFullCode"
            class="w-full px-3 py-3 rounded-lg border border-white/20 bg-white/5 text-white text-sm font-mono text-center tracking-[0.25em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all uppercase"
            maxlength="17"
            autocomplete="off"
            placeholder="XXXXX-XXXXX-XXXXX"
            @input="onInput"
            @paste="onPaste"
            @keydown="onKeydown"
          />
        </div>
        <p v-if="licenciaError" class="text-red-400 text-xs text-center">{{ licenciaError }}</p>
        <Button
          label="Registrar equipo"
          icon="pi pi-check"
          class="w-full"
          :loading="licenciaLoading"
          @click="registrarEquipo"
        />
      </div>

      <div class="mt-6 text-center">
        <button
          class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          @click="cerrarSesion"
        >
          <i class="pi pi-sign-out mr-1"></i>Cerrar sesion
        </button>
      </div>
    </div>

    <!-- Dialogo de sincronizacion -->
    <Dialog
      v-model:visible="syncDialogVisible"
      header="Sincronizar datos"
      modal
      :style="{ width: 'min(26rem, 92vw)' }"
      :closable="false"
      :dismissableMask="false"
    >
      <div class="flex flex-col items-center gap-4 pt-2 text-center">
        <div class="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-sync text-2xl text-primary"></i>
        </div>
        <p class="text-sm text-surface-500">Tus datos estan en la nube. Que deseas hacer?</p>
      </div>
      <template #footer>
        <Button label="Omitir" severity="secondary" text @click="omitirSync" />
        <Button label="Subir datos locales" icon="pi pi-upload" severity="info" :loading="syncGuardando && syncOpcion === 'subir'" @click="ejecutarSync('subir')" />
        <Button label="Descargar de la nube" icon="pi pi-download" :loading="syncGuardando && syncOpcion === 'descargar'" @click="ejecutarSync('descargar')" />
      </template>
    </Dialog>
  </div>
</template>
