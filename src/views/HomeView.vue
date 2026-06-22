<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useAlmacenStore } from '@/stores/almacen.store'
import QRCode from 'qrcode'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const router = useRouter()
const auth = useAuthStore()
const almacenStore = useAlmacenStore()
const appName = ref('ArgentPOS')
const toast = useToast()

let _loadedAppName = false

const serverUrl = ref('')
const qrDataUrl = ref('')
const dialogRed = ref(false)

const dialogImei = ref(false)
const imeiInput = ref('')
const imeiConsultando = ref(false)
const imeiResultado = ref<any>(null)
const imeiServicio = ref(55)

const hoy = ref(new Date().toISOString().split('T')[0])
const inicioMes = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])

const ventasDia = ref(0)
const cantidadDia = ref(0)
const ventasMes = ref(0)
const gananciaMes = ref(0)
const stockBajo = ref<any[]>([])
const productosTop = ref<any[]>([])
const turnoActivo = ref<any>(null)
const loadingDashboard = ref(true)

function getFechaStr(d: Date) {
  return d.toISOString().replace('T', ' ').split('.')[0]
}

async function cargarDashboard() {
  loadingDashboard.value = true
  try {
    const now = new Date()
    const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)

    const [resFacturas, resTel, resAcc, resElec, resPiezas, resTurno] = await Promise.all([
      window.db.getAll('facturas'),
      window.db.getAll('telefonos'),
      window.db.getAll('accesorios'),
      window.db.getAll('electrodomesticos'),
      window.db.getAll('piezas'),
      (window as any).electron.invoke('caja:getTurnoActivo'),
    ])

    const almacenId = almacenStore.activeId || 0
    const filtrarAlmacen = (items: any[]) => items.filter((i: any) => !almacenId || Number(i.almacen_id) === almacenId || almacenId === 1)

    const facturas = (resFacturas.success ? resFacturas.data || [] : []).filter((f: any) =>
      f.estado_factura === 'PAGADA' && (!almacenId || Number(f.almacen_id) === almacenId)
    )

    ventasDia.value = facturas
      .filter((f: any) => new Date(f.created_at) >= inicioHoy)
      .reduce((s: number, f: any) => s + Number(f.total || 0), 0)

    cantidadDia.value = facturas
      .filter((f: any) => new Date(f.created_at) >= inicioHoy)
      .length

    const mesFacturas = facturas.filter((f: any) => new Date(f.created_at) >= inicioMes)
    ventasMes.value = mesFacturas.reduce((s: number, f: any) => s + Number(f.total || 0), 0)
    gananciaMes.value = mesFacturas.reduce((s: number, f: any) => s + Number(f.ganancia || 0), 0)

    const contarProducto = (items: any[], campoNombre: string, campoPrecio: string) => {
      const map = new Map<string, { nombre: string; total: number; cantidad: number }>()
      for (const f of mesFacturas) {
        try {
          const prods = typeof f.productos === 'string' ? JSON.parse(f.productos) : (f.productos || [])
          if (Array.isArray(prods)) {
            for (const p of prods) {
              const nom = p[campoNombre] || p.nombre || 'Producto'
              map.set(nom, {
                nombre: nom,
                total: (map.get(nom)?.total || 0) + Number(p[campoPrecio] || p.precio || 0) * Number(p.cantidad || 1),
                cantidad: (map.get(nom)?.cantidad || 0) + Number(p.cantidad || 1),
              })
            }
          }
        } catch {}
      }
      return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10)
    }

    productosTop.value = [
      ...contarProducto([], 'nombre', 'precio'),
      ...contarProducto([], 'nombre', 'precio'),
    ].slice(0, 10)

    const parseNombre = (p: any) => {
      if (typeof p === 'string') return p
      if (typeof p === 'object') return p.nombre || p.producto || p.descripcion || ''
      return ''
    }
    const agrupados = new Map<string, { nombre: string; total: number; cantidad: number }>()
    for (const f of mesFacturas) {
      try {
        const prods = typeof f.productos === 'string' ? JSON.parse(f.productos) : (f.productos || [])
        if (Array.isArray(prods)) {
          for (const p of prods) {
            const nom = parseNombre(p)
            if (!nom) continue
            const key = nom.toUpperCase().trim()
            const existente = agrupados.get(key)
            const cant = Number(p.cantidad || 1)
            const precio = Number(p.precio || 0)
            if (existente) {
              existente.cantidad += cant
              existente.total += precio * cant
            } else {
              agrupados.set(key, { nombre: nom, total: precio * cant, cantidad: cant })
            }
          }
        }
      } catch {}
    }
    productosTop.value = Array.from(agrupados.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    const allInv = [
      ...(resTel.success ? resTel.data || [] : []),
      ...(resAcc.success ? resAcc.data || [] : []),
      ...(resElec.success ? resElec.data || [] : []),
      ...(resPiezas.success ? resPiezas.data || [] : []),
    ]
    stockBajo.value = filtrarAlmacen(allInv)
      .filter((i: any) => Number(i.cantidad || 0) <= Number(i.alerta || 0) && Number(i.alerta || 0) > 0)
      .sort((a, b) => {
        const aPct = (a.cantidad || 0) / (a.alerta || 1)
        const bPct = (b.cantidad || 0) / (b.alerta || 1)
        return aPct - bPct
      })
      .slice(0, 10)

    if (resTurno.success && resTurno.data) {
      turnoActivo.value = resTurno.data
    } else {
      turnoActivo.value = null
    }
  } catch (e) {
    console.error('Error cargando dashboard:', e)
  } finally {
    loadingDashboard.value = false
  }
}

async function cargarServerUrl() {
  try {
    const res = await window.electron.invoke('getServerUrl') as any
    if (res.success && res.url) {
      serverUrl.value = res.url
      qrDataUrl.value = await QRCode.toDataURL(res.url, { width: 300, margin: 2 })
    }
  } catch (_) {}
}

async function consultarImei() {
  if (!imeiInput.value.trim() || imeiInput.value.trim().length < 15) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Ingresa un IMEI valido (15 digitos)', life: 3000 })
    return
  }
  imeiConsultando.value = true
  imeiResultado.value = null
  try {
    const res = await window.electron.invoke('imei:consultar', imeiInput.value.trim(), imeiServicio.value) as any
    if (res.success) {
      imeiResultado.value = res.data
      if (res.data?.status === 'error') {
        toast.add({ severity: 'error', summary: 'Error', detail: res.data.message || res.data.error || 'Error en la consulta', life: 5000 })
      }
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo conectar al servidor', life: 5000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 5000 })
  } finally {
    imeiConsultando.value = false
  }
}

async function copiarUrl() {
  try {
    await navigator.clipboard.writeText(serverUrl.value)
    toast.add({ severity: 'success', summary: 'Copiado', detail: 'URL copiada al portapapeles', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo copiar', life: 2000 })
  }
}

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function irA(ruta: string) {
  router.push(ruta)
}

function cerrarSesion() {
  auth.logout()
  router.push('/login')
}

onMounted(() => {
  cargarDashboard()
  cargarServerUrl()
  if ((window as any).electron?.invoke && !_loadedAppName) {
    _loadedAppName = true
    ;(window as any).electron.invoke('app:getName').then((r: any) => {
      if (r) appName.value = r
    }).catch(() => {})
  }
})
</script>

<template>
  <Toast />
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          Bienvenido, <span class="text-primary">{{ auth.user?.nombre || 'Usuario' }}</span>
        </h1>
        <p class="text-surface-500 mt-1">{{ new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</p>
      </div>
      <div class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30">
        <i class="pi pi-mobile text-blue-500 text-lg"></i>
        <span class="text-sm font-medium text-blue-700 dark:text-blue-300">{{ appName }}</span>
      </div>
    </div>

    <div v-if="loadingDashboard" class="flex items-center justify-center py-16 text-surface-400 gap-2">
      <i class="pi pi-spin pi-spinner text-lg"></i><span>Cargando dashboard...</span>
    </div>

    <template v-else>
      <!-- Turno activo alerta -->
      <div v-if="turnoActivo" class="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <i class="pi pi-check-circle text-green-500 text-lg"></i>
        <div class="text-sm"><span class="font-medium">Turno activo</span> &mdash; Abierto por <strong>{{ turnoActivo.usuario_nombre }}</strong> desde {{ new Date(turnoActivo.created_at).toLocaleString('es-DO') }}</div>
      </div>
      <div v-else class="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <i class="pi pi-exclamation-triangle text-amber-500 text-lg"></i>
        <div class="text-sm"><span class="font-medium">Sin turno activo</span> &mdash; <button @click="irA('/contabilidad')" class="text-primary underline">Abrir turno en Caja</button></div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-1">
          <span class="text-xs font-medium text-surface-400 uppercase tracking-wide">Ventas Hoy</span>
          <span class="text-2xl font-bold text-primary">${{ formatCurrency(ventasDia) }}</span>
          <span class="text-xs text-surface-500">{{ cantidadDia }} factura(s)</span>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-1">
          <span class="text-xs font-medium text-surface-400 uppercase tracking-wide">Ventas del Mes</span>
          <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${{ formatCurrency(ventasMes) }}</span>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-1">
          <span class="text-xs font-medium text-surface-400 uppercase tracking-wide">Ganancia del Mes</span>
          <span class="text-2xl font-bold text-violet-600 dark:text-violet-400">${{ formatCurrency(gananciaMes) }}</span>
        </div>
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4 flex flex-col gap-1">
          <span class="text-xs font-medium text-surface-400 uppercase tracking-wide">Stock Bajo</span>
          <span class="text-2xl font-bold" :class="stockBajo.length > 0 ? 'text-red-500' : 'text-green-500'">{{ stockBajo.length }}</span>
          <span class="text-xs text-surface-500">{{ stockBajo.length > 0 ? 'Productos por reabastecer' : 'Sin alertas' }}</span>
        </div>
      </div>

      <!-- Acceso Rapido -->
      <div>
        <h2 class="text-lg font-semibold mb-3">Acceso Rapido</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all cursor-pointer group" @click="irA('/vender')">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-shopping-cart text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Vender</span><span class="text-[10px] text-surface-400 -mt-1">Punto de venta</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all cursor-pointer group" @click="irA('/inventario')">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-box text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Inventario</span><span class="text-[10px] text-surface-400 -mt-1">Productos y stock</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md transition-all cursor-pointer group" @click="irA('/taller')">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-wrench text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Taller</span><span class="text-[10px] text-surface-400 -mt-1">Reparaciones</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-md transition-all cursor-pointer group" @click="irA('/contactos')">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-users text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Clientes</span><span class="text-[10px] text-surface-400 -mt-1">Contactos</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-rose-300 dark:hover:border-rose-600 hover:shadow-md transition-all cursor-pointer group" @click="irA('/contabilidad')">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-calculator text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Contabilidad</span><span class="text-[10px] text-surface-400 -mt-1">Finanzas</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-md transition-all cursor-pointer group" @click="irA('/ventas')">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-file text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Facturas</span><span class="text-[10px] text-surface-400 -mt-1">Historial</span>
          </button>
          <button v-if="serverUrl" class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all cursor-pointer group" @click="dialogRed = true">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-globe text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Red Local</span><span class="text-[10px] text-surface-400 -mt-1">Acceso por QR</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer group" @click="dialogImei = true">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-search text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Consultar IMEI</span><span class="text-[10px] text-surface-400 -mt-1">Busqueda externa</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 hover:border-red-300 dark:hover:border-red-600 hover:shadow-md transition-all cursor-pointer group" @click="cerrarSesion">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"><i class="pi pi-sign-out text-white text-xl"></i></div>
            <span class="text-sm font-semibold">Salir</span><span class="text-[10px] text-surface-400 -mt-1">Cerrar sesion</span>
          </button>
        </div>
      </div>

      <!-- Dos columnas: Productos mas vendidos + Stock bajo -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Productos mas vendidos -->
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
            <h3 class="font-semibold text-sm flex items-center gap-2"><i class="pi pi-chart-bar text-primary"></i> Productos mas vendidos</h3>
            <span class="text-xs text-surface-400">Este mes</span>
          </div>
          <div v-if="productosTop.length === 0" class="text-center py-8 text-surface-400 text-sm">Sin ventas este mes</div>
          <div v-else class="divide-y divide-surface-100 dark:divide-surface-700">
            <div v-for="(p, i) in productosTop" :key="i" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
              <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" :style="{ background: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : 'var(--p-primary-300)' }">
                {{ i + 1 }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ p.nombre }}</div>
                <div class="text-xs text-surface-400">{{ p.cantidad }} vendido(s)</div>
              </div>
              <span class="text-sm font-semibold">${{ formatCurrency(p.total) }}</span>
            </div>
          </div>
        </div>

        <!-- Stock bajo -->
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
            <h3 class="font-semibold text-sm flex items-center gap-2"><i class="pi pi-exclamation-triangle text-red-500"></i> Alertas de Stock</h3>
            <button v-if="stockBajo.length > 0" @click="irA('/inventario')" class="text-xs text-primary hover:underline">Ver inventario</button>
          </div>
          <div v-if="stockBajo.length === 0" class="text-center py-8 text-surface-400 text-sm">No hay alertas de stock bajo</div>
          <div v-else class="divide-y divide-surface-100 dark:divide-surface-700">
            <div v-for="(item, i) in stockBajo" :key="i" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                :class="item.cantidad === 0 ? 'bg-red-500' : 'bg-orange-400'">
                {{ item.cantidad || 0 }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ item.nombre }}</div>
                <div class="text-xs" :class="item.cantidad === 0 ? 'text-red-500' : 'text-orange-500'">
                  {{ item.cantidad || 0 }} / {{ item.alerta || 0 }} unidades
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <Dialog v-model:visible="dialogImei" header="Consultar IMEI" modal :style="{ width: '28rem' }" @after-hide="imeiResultado = null; imeiInput = ''">
      <div class="flex flex-col gap-4 py-2">
        <div class="flex items-center gap-2">
          <InputText v-model="imeiInput" placeholder="IMEI (15 digitos)" class="flex-1" fluid maxlength="15" @keydown.enter="consultarImei" />
          <Button label="Consultar" icon="pi pi-search" :loading="imeiConsultando" @click="consultarImei" />
        </div>
        <div v-if="imeiConsultando" class="flex items-center justify-center py-8 text-surface-400 gap-2"><i class="pi pi-spin pi-spinner"></i><span>Consultando IMEI...</span></div>
        <div v-else-if="imeiResultado" class="space-y-3">
          <div v-if="imeiResultado.response?.object" class="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 divide-y divide-surface-200 dark:divide-surface-700 overflow-hidden">
            <div class="px-4 py-2.5 text-sm flex items-center gap-2" :class="imeiResultado.response.object.blacklistStatus ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'">
              <i :class="imeiResultado.response.object.blacklistStatus ? 'pi pi-times-circle text-red-500' : 'pi pi-check-circle text-green-500'"></i>
              <span class="font-semibold" :class="imeiResultado.response.object.blacklistStatus ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'">{{ imeiResultado.response.object.blacklistStatus ? 'BLACKLISTEADO' : 'LIMPIO' }}</span>
            </div>
            <div v-for="(val, key) in { Modelo: imeiResultado.response.object.model, 'Nombre': imeiResultado.response.object.modelName, Fabricante: imeiResultado.response.object.manufacturer, IMEI: imeiResultado.response.object.imei }" :key="key" class="flex items-start gap-2 px-4 py-2.5 text-sm">
              <span class="text-surface-400 font-medium min-w-[90px]">{{ key }}:</span><span class="font-medium break-all">{{ val }}</span>
            </div>
          </div>
          <div v-else class="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400 text-center">{{ imeiResultado.message || imeiResultado.error || 'Sin resultados' }}</div>
        </div>
      </div>
      <template #footer>
        <Button label="Limpiar" severity="secondary" text :disabled="!imeiResultado && !imeiInput" @click="imeiResultado = null; imeiInput = ''" />
        <Button label="Cerrar" severity="secondary" text @click="dialogImei = false" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogRed" header="Acceso por Red Local" modal :style="{ width: '22rem' }">
      <div class="flex flex-col items-center gap-4 py-4">
        <p class="text-sm text-surface-500 text-center">Escanea este codigo QR desde otro dispositivo en la misma red:</p>
        <div v-if="qrDataUrl" class="bg-white p-3 rounded-xl shadow-md"><img :src="qrDataUrl" alt="QR" class="w-56 h-56" /></div>
        <div class="flex items-center gap-2 w-full">
          <input :value="serverUrl" readonly class="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-center outline-none" />
          <Button icon="pi pi-copy" severity="primary" text rounded size="small" @click="copiarUrl" v-tooltip="'Copiar URL'" />
        </div>
      </div>
      <template #footer><Button label="Cerrar" severity="secondary" text @click="dialogRed = false" /></template>
    </Dialog>
  </div>
</template>
