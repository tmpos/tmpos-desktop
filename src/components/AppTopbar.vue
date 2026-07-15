<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth.store'
import { useAlmacenStore } from '@/stores/almacen.store'
import { useAlertas } from '@/composables/useAlertas'
import { ensureConfigLoaded, getImageUrl } from '@/services/tmCloudClient'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const auth = useAuthStore()
const almacenStore = useAlmacenStore()
const cambiandoAlmacen = ref(false)

const { alertas, verificarAlertas, descartarAlerta, descartarTodas } = useAlertas()
const alertasPanelVisible = ref(false)

function cambiarAlmacen() {
  localStorage.setItem('almacen_id', String(almacenStore.activeId))
  cambiandoAlmacen.value = true
  setTimeout(() => window.location.reload(), 300)
}

const empresaNombre = ref('')
const empresaLogo = ref('')

async function cargarEmpresa() {
  try {
    await ensureConfigLoaded()
    const res = await window.db.getAll('empresa')
    if (res.success && res.data?.length > 0) {
      // Empresa siempre corresponde al primer registro, no al último ni al almacén activo.
      const e = res.data[0]
      empresaNombre.value = e.nombre || ''
      empresaLogo.value = getImageUrl(e.logo || '') || e.logo || ''
      ;(window as any).__empresaNombre = e.nombre || 'MI EMPRESA'
      ;(window as any).__empresaDireccion = e.direccion || ''
      ;(window as any).__empresaTelefono = e.telefono || ''
    }
  } catch (_) {}
}

function ocultarLogo() {
  empresaLogo.value = ''
}

function refrescarEmpresa() {
  cargarEmpresa()
}
let licenciaInterval: ReturnType<typeof setInterval> | null = null
let updateInterval: ReturnType<typeof setInterval> | null = null
let licenciaVerificando = false
const updateDescargando = ref(false)
const updateEstado = ref('')
const updateVersionInfo = ref<any>(null)
const updateDialogVisible = ref(false)
const updateUrl = ref('')

function licenciaAceptada(res: any): boolean {
  const estado = String(res?.data?.estado || res?.estado || '').toLowerCase()
  return res?.success === true && (estado === 'activo' || estado === 'pendiente')
}

function licenciaDebeCerrarSesion(res: any): boolean {
  const estado = String(res?.data?.estado || res?.estado || '').toLowerCase()
  return ['vencida', 'invalida', 'bloqueada', 'cancelada'].includes(estado)
}

async function verificarLicenciaPeriodicamente() {
  if (licenciaVerificando) return
  if (!(window as any).electron?.invoke) return
  licenciaVerificando = true
  try {
    console.log('[AppTopbar] Verificando licencia...')
    const offlineOnly = navigator.onLine === false
    const res = await (window as any).electron.invoke('licencia:verificar', { offlineOnly })
    console.log('[AppTopbar] Resultado licencia:', JSON.stringify(res))
    if (licenciaAceptada(res)) return
    if (licenciaDebeCerrarSesion(res)) {
      console.log('[AppTopbar] Licencia no valida confirmada, cerrando sesion...')
      auth.logout()
      router.push('/login')
      return
    }
    console.log('[AppTopbar] No se cerro sesion por resultado no concluyente:', res?.error || res?.data?.mensaje || res?.estado)
  } catch (e) {
    console.log('[AppTopbar] Error verificando licencia:', e)
  } finally {
    licenciaVerificando = false
  }
}

async function revisarActualizacion() {
  if (!(window as any).electron?.invoke) return
  let autoCheck = true
  try {
    const res = await (window as any).config.get('update_autoCheck')
    if (res.success) autoCheck = res.data !== 'false'
  } catch {}
  if (!autoCheck) return
  try {
    const res = await (window as any).electron.invoke('update:check')
    if (!res.success) return
    let versionActual = '0.0.0'
    try { versionActual = await (window as any).electron.invoke('app:getVersion') || '0.0.0' } catch {}
    if (res.data?.version && res.data.version !== versionActual) {
      updateVersionInfo.value = res.data
      updateUrl.value = res.data.url || ''
      let autoInstall = false
      try {
        const ri = await (window as any).config.get('update_autoInstall')
        if (ri.success) autoInstall = ri.data === 'true'
      } catch {}
      if (autoInstall && updateUrl.value) {
        updateDescargando.value = true
        updateEstado.value = 'Nueva version detectada. Descargando...'
        const dl = await (window as any).electron.invoke('update:downloadAuto', updateUrl.value)
        if (dl.success) {
          updateEstado.value = 'Instalando nueva version...'
          await (window as any).electron.invoke('update:install', dl.path)
        } else {
          updateDescargando.value = false
        }
      } else {
        updateDialogVisible.value = true
      }
    }
  } catch (_) {}
}

async function descargarAhora() {
  updateDialogVisible.value = false
  updateDescargando.value = true
  updateEstado.value = 'Descargando actualizacion...'
  try {
    const dl = await (window as any).electron.invoke('update:downloadAuto', updateUrl.value)
    if (dl.success) {
      updateEstado.value = 'Instalando nueva version...'
      await (window as any).electron.invoke('update:install', dl.path)
    } else {
      updateDescargando.value = false
    }
  } catch {
    updateDescargando.value = false
  }
}

onMounted(() => {
  cargarEmpresa()
  window.addEventListener('empresa:actualizada', refrescarEmpresa)
  almacenStore.load()
  verificarAlertas()
  setInterval(verificarAlertas, 600000)
  verificarLicenciaPeriodicamente()
  licenciaInterval = setInterval(verificarLicenciaPeriodicamente, 300000)
  revisarActualizacion()
  updateInterval = setInterval(revisarActualizacion, 1800000)
})

function applyTopbarBg(color: string) {
  const map: Record<string, string> = {
    white: 'rgba(255, 255, 255, 0.85)',
    primary: 'var(--p-primary-600)',
    dark: 'rgba(15, 23, 42, 1)',
    slate: 'rgba(30, 41, 59, 0.95)',
    transparent: 'transparent',
    blue: 'rgba(37, 99, 235, 0.9)',
    violet: 'rgba(124, 58, 237, 0.9)',
    emerald: 'rgba(5, 150, 105, 0.9)',
    teal: 'rgba(13, 148, 136, 0.9)',
    sky: 'rgba(2, 132, 199, 0.9)',
  }
  document.documentElement.style.setProperty('--topbar-bg', map[color] || map.white)
}

applyTopbarBg(themeStore.topbarBg)

watch(() => themeStore.topbarBg, (val) => {
  applyTopbarBg(val)
})

const navMenu = ref<HTMLElement | null>(null)
const showLabels = ref(true)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('empresa:actualizada', refrescarEmpresa)
  window.removeEventListener('keydown', handleKeyDown)
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'F12') {
    e.preventDefault()
    if ((window as any).electron?.invoke) {
      ;(window as any).electron.invoke('open:devtools').catch(() => {})
    }
  }
}

const navItems: { label: string; icon: string; to: string; permiso: string }[] = [
  { label: 'Home', icon: 'pi pi-home', to: '/', permiso: 'home' },
  { label: 'Inventario', icon: 'pi pi-box', to: '/inventario', permiso: 'inventario' },
  { label: 'Taller', icon: 'pi pi-wrench', to: '/taller', permiso: 'taller' },
  { label: 'Contactos', icon: 'pi pi-users', to: '/contactos', permiso: 'contactos' },
  { label: 'Contabilidad', icon: 'pi pi-calculator', to: '/contabilidad', permiso: 'contabilidad' },
  { label: 'Ventas', icon: 'pi pi-file', to: '/ventas', permiso: 'ventas' },
  { label: 'Reportes', icon: 'pi pi-chart-bar', to: '/reportes', permiso: 'reportes' },
  { label: 'Configuracion', icon: 'pi pi-cog', to: '/configuracion', permiso: 'configuracion' },
  { label: 'Vender', icon: 'pi pi-shopping-cart', to: '/vender', permiso: 'vender' },
  { label: 'Soporte', icon: 'pi pi-headset', to: '/soporte', permiso: 'soporte' },
]

const navItemsFiltrados = computed(() => navItems.filter(item => auth.tienePermiso(item.permiso)))

function navigate(path: string) {
  router.push(path)
}

async function cerrarSesion() {
  try {
    await window.electron.invoke('backup:create')
  } catch (error) {
    console.error('Error creando backup al cerrar sesion:', error)
  } finally {
    auth.logout()
    router.push('/login')
  }
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function checkWidth() {
  if (!navMenu.value) return
  const navWidth = navMenu.value.offsetWidth
  const minWidth = 130
  const maxItems = Math.floor((navWidth - 200) / minWidth)
  showLabels.value = navItems.length <= maxItems + 2
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  checkWidth()
  
  if (navMenu.value) {
    resizeObserver = new ResizeObserver(() => {
      checkWidth()
    })
    resizeObserver.observe(navMenu.value)
  }
  
  window.addEventListener('resize', checkWidth)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', checkWidth)
  if (licenciaInterval) { clearInterval(licenciaInterval); licenciaInterval = null }
  if (updateInterval) { clearInterval(updateInterval); updateInterval = null }
})
</script>

<template>
  <header class="app-topbar">
    <div class="app-topbar-inner">
      <div class="topbar-row topbar-brand-row">
        <div class="branding">
          <div class="logo cursor-pointer" @click="router.push('/')">
            <img v-if="empresaLogo" :src="empresaLogo" class="w-full h-full object-contain p-1" alt="Logo de empresa" @error="ocultarLogo" />
            <span v-else-if="empresaNombre" class="text-lg font-bold" style="color:var(--p-primary-500)">{{ empresaNombre.charAt(0) }}</span>
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="brand-text cursor-pointer" v-if="empresaNombre" @click="router.push('/')">
            <span class="brand-name">{{ empresaNombre }}</span>
          </div>
        </div>

        <div class="topbar-row topbar-nav-row">
          <nav class="nav-menu" ref="navMenu">
            <button
              v-for="item in navItemsFiltrados"
              :key="item.to"
              class="nav-item"
              :class="{ 'nav-item-active': isActive(item.to) }"
              v-tooltip="item.label"
              @click="navigate(item.to)"
            >
              <i :class="item.icon" class="nav-icon"></i>
              <span class="nav-label" :class="{ 'nav-label-hidden': !showLabels }">{{ item.label }}</span>
            </button>
          </nav>
        </div>

        <div class="topbar-end">
          <div class="relative">
            <button class="action-btn" @click="alertasPanelVisible = !alertasPanelVisible" title="Alertas">
              <i class="pi pi-bell action-icon" :class="alertas.length > 0 ? 'text-amber-400' : ''"></i>
              <span v-if="alertas.length > 0" class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{{ alertas.length > 9 ? '9+' : alertas.length }}</span>
            </button>
            <div v-if="alertasPanelVisible" class="alertas-panel absolute right-0 top-full mt-1 w-72 rounded-xl border border-surface-200 dark:border-surface-700 shadow-xl z-50 overflow-hidden" :style="{ backgroundColor: themeStore.isDark ? '#0f172a' : '#ffffff', color: themeStore.isDark ? '#f8fafc' : '#1e293b' }" @click.stop>
              <div class="alertas-panel-header px-3 py-2 border-b border-surface-100 dark:border-surface-700 text-xs font-semibold flex items-center justify-between">
                <span>Alertas ({{ alertas.length }})</span>
                <div class="flex items-center gap-2">
                  <button v-if="alertas.length" @click="descartarTodas" class="text-primary hover:underline">Limpiar</button>
                  <button @click="alertasPanelVisible = false" class="text-surface-400 hover:text-surface-600"><i class="pi pi-times text-xs"></i></button>
                </div>
              </div>
              <div v-if="alertas.length === 0" class="alertas-panel-empty px-3 py-6 text-center text-xs">Sin alertas</div>
              <div v-else class="max-h-64 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-700">
                <div v-for="(a, i) in alertas" :key="i" class="px-3 py-2.5 flex items-start gap-2.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer" @click="alertasPanelVisible = false; a.ruta ? router.push(a.ruta) : null">
                  <i class="pi mt-0.5 text-xs" :class="a.severidad === 'danger' ? 'pi-exclamation-circle text-red-500' : a.severidad === 'warning' ? 'pi-exclamation-triangle text-amber-500' : 'pi-info-circle text-blue-500'"></i>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-xs">{{ a.tipo === 'stock' ? 'Stock Bajo' : a.tipo === 'turno' ? 'Turno' : 'Alerta' }}</div>
                    <div class="alertas-panel-message text-xs">{{ a.mensaje }}</div>
                  </div>
                  <button class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200" @click.stop="descartarAlerta(a)" v-tooltip="'Descartar alerta'"><i class="pi pi-times text-xs"></i></button>
                </div>
              </div>
            </div>
          </div>
          <button class="action-btn" @click="themeStore.toggleTheme()" :title="themeStore.isDark ? 'Modo claro' : 'Modo oscuro'">
            <i :class="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" class="action-icon"></i>
          </button>
          <div v-if="almacenStore.hasMultiple && (auth.isAdmin || auth.isSoporte)" class="relative flex items-center">
            <select v-model="almacenStore.activeId" @change="cambiarAlmacen" class="appearance-none bg-transparent text-xs font-medium text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-600 rounded-lg px-2 py-1.5 pr-6 cursor-pointer hover:border-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option v-for="a in almacenStore.almacenes" :key="a.id" :value="a.id">{{ a.nombre }}</option>
            </select>
            <i class="pi pi-chevron-down absolute right-2 pointer-events-none text-xs text-surface-400"></i>
          </div>
          <button class="action-btn action-btn-exit" @click="cerrarSesion" title="Cerrar sesion">
            <i class="pi pi-sign-out action-icon"></i>
            <span class="action-label">Salir</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Overlay de cambio de almacen -->
  <div v-if="cambiandoAlmacen" class="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4" style="background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)">
    <i class="pi pi-spin pi-spinner text-4xl text-white"></i>
    <p class="text-white text-sm font-medium">Cambiando de almacen...</p>
  </div>

  <!-- Modal de actualizacion disponible -->
  <Dialog v-model:visible="updateDialogVisible" header="Actualizacion disponible" modal :style="{ width: 'min(24rem, 90vw)' }" :closable="true">
    <div class="space-y-3">
      <p class="text-sm">Hay una nueva version disponible: <strong>{{ updateVersionInfo?.version }}</strong></p>
      <p v-if="updateVersionInfo?.notas" class="text-xs text-surface-500">{{ updateVersionInfo.notas }}</p>
    </div>
    <template #footer>
      <Button label="Despues" severity="secondary" text @click="updateDialogVisible = false" />
      <Button label="Descargar e Instalar" icon="pi pi-download" @click="descargarAhora" />
    </template>
  </Dialog>

  <!-- Overlay de descarga/instalacion -->
  <div
    v-if="updateDescargando"
    class="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
    style="background: rgba(0,0,0,0.7)"
  >
    <div class="w-16 h-16 rounded-2xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-2xl mb-4">
      <i class="pi pi-spin pi-spinner text-3xl text-primary"></i>
    </div>
    <p class="text-white text-lg font-semibold">{{ updateEstado }}</p>
    <p class="text-white/60 text-sm mt-1">No cierres la aplicacion...</p>
  </div>
</template>

<style scoped>
.app-topbar {
  background: var(--topbar-bg, rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(203, 213, 225, 0.9);
  box-shadow:
    0 14px 34px -28px rgba(15, 23, 42, 0.58),
    0 3px 12px -9px rgba(15, 23, 42, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
  position: relative;
  z-index: 100;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.app-topbar-inner {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.55rem 1rem;
  max-width: 100%;
  margin: 0 auto;
}

.topbar-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.topbar-brand-row {
  flex-wrap: wrap;
  justify-content: space-between;
}

.topbar-nav-row {
  justify-content: center;
}

@media (min-width: 1024px) {
  .app-topbar-inner {
    flex-direction: row;
    align-items: center;
    gap: 0;
    padding: 0.65rem 1.25rem;
  }

  .topbar-row {
    width: auto;
  }

  .topbar-brand-row {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap;
  }

  .branding {
    flex-shrink: 0;
  }

  .topbar-nav-row {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .topbar-end {
    flex-shrink: 0;
  }
}

@media (max-width: 1023px) {
  .topbar-nav-row {
    order: 3;
    width: 100%;
    margin-top: 0.25rem;
  }

  .topbar-end {
    margin-left: auto;
  }

  .nav-menu {
    width: 100%;
    justify-content: flex-start;
  }

  .nav-item {
    flex-shrink: 0;
  }
}

.branding {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.logo {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-500);
  box-shadow: 0 8px 18px -14px rgba(15, 23, 42, 0.65);
}

.brand-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--p-slate-800);
  letter-spacing: 0;
}

.brand-divider {
  width: 1px;
  height: 1.25rem;
  background: var(--p-slate-300);
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  justify-content: center;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.nav-menu::-webkit-scrollbar { display: none; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  padding: 0.45rem 0.8rem;
  border-radius: 0.6rem;
  border: 1px solid transparent;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  color: var(--p-slate-600);
  background: transparent;
}

.nav-item:hover {
  background: rgba(248, 250, 252, 0.84);
  border-color: rgba(203, 213, 225, 0.88);
  color: var(--p-slate-700);
  box-shadow: 0 8px 18px -18px rgba(15, 23, 42, 0.5);
}



.nav-item-active {
  background: rgba(239, 246, 255, 0.95);
  border-color: rgba(147, 197, 253, 0.75);
  color: var(--p-blue-700);
  box-shadow:
    0 10px 22px -18px rgba(37, 99, 235, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.nav-item-active:hover {
  background: rgba(219, 234, 254, 0.95);
  border-color: rgba(96, 165, 250, 0.8);
}

.nav-icon {
  font-size: 1rem;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.nav-item:hover .nav-icon {
  transform: scale(1.1);
}

.nav-label {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  transition: opacity 0.2s, width 0.2s;
}

.nav-label-hidden {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.topbar-end {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  padding: 0.45rem 0.7rem;
  border-radius: 0.6rem;
  border: 1px solid transparent;
  color: var(--p-slate-500);
  background: transparent;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.action-btn:hover {
  background: rgba(248, 250, 252, 0.84);
  border-color: rgba(203, 213, 225, 0.88);
  color: var(--p-slate-700);
  box-shadow: 0 8px 18px -18px rgba(15, 23, 42, 0.5);
}



.action-btn-exit {
  color: var(--p-red-500);
}

.action-btn-exit:hover {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(252, 165, 165, 0.8);
  color: var(--p-red-600);
}

.action-icon {
  font-size: 1rem;
}

.action-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.alertas-panel {
  background: #ffffff;
  color: #1e293b;
}

.alertas-panel-header,
.alertas-panel-message,
.alertas-panel-empty {
  color: #64748b;
}

:global(.dark) .alertas-panel {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #f8fafc;
}

:global(.dark) .alertas-panel-header,
:global(.dark) .alertas-panel-message,
:global(.dark) .alertas-panel-empty {
  color: #cbd5e1 !important;
}

</style>

<style>
.dark .app-topbar {
  background: rgba(15, 23, 42, 0.94) !important;
  border-bottom-color: rgba(51, 65, 85, 0.95) !important;
  box-shadow:
    0 16px 38px -26px rgba(0, 0, 0, 0.82),
    0 4px 14px -10px rgba(0, 0, 0, 0.72),
    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}
.dark .app-topbar .brand-name { color: #ffffff !important; }
.dark .app-topbar .logo { background: rgba(15, 23, 42, 0.72) !important; border-color: rgba(71, 85, 105, 0.85) !important; box-shadow: 0 10px 22px -16px rgba(0, 0, 0, 0.85) !important; }
.dark .app-topbar .nav-item { color: rgba(255, 255, 255, 0.65) !important; }
.dark .app-topbar .nav-item:hover { color: #ffffff !important; background: rgba(255, 255, 255, 0.07) !important; border-color: rgba(148, 163, 184, 0.2) !important; box-shadow: 0 10px 22px -18px rgba(0, 0, 0, 0.85) !important; }
.dark .app-topbar .nav-item-active { color: #ffffff !important; background: rgba(37, 99, 235, 0.34) !important; border-color: rgba(96, 165, 250, 0.52) !important; box-shadow: 0 10px 22px -18px rgba(37, 99, 235, 0.78) !important; }
.dark .app-topbar .nav-item-active:hover { background: rgba(59, 130, 246, 0.35) !important; }
.dark .app-topbar .action-btn { color: rgba(255, 255, 255, 0.6) !important; }
.dark .app-topbar .action-btn:hover { color: #ffffff !important; background: rgba(255, 255, 255, 0.07) !important; border-color: rgba(148, 163, 184, 0.2) !important; box-shadow: 0 10px 22px -18px rgba(0, 0, 0, 0.85) !important; }
.dark .app-topbar .action-btn-exit { color: rgba(248, 113, 113, 0.7) !important; }
.dark .app-topbar .action-btn-exit:hover { color: #fca5a5 !important; background: rgba(127, 29, 29, 0.3) !important; border-color: rgba(239, 68, 68, 0.5) !important; }
</style>
