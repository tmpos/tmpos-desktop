<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <i class="pi pi-cloud text-white text-lg"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold text-surface-900 dark:text-surface-0">TM Cloud</h2>
            <p class="text-xs text-surface-400">Sincronizacion privada con TMPBase</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="estado?.connected" class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
          <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Conectado
        </span>
        <span v-else class="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
          <span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Desconectado
        </span>
      </div>
    </div>

    <!-- Config Card -->
    <div class="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800/50 p-5 space-y-4">
      <div class="flex items-center gap-2 mb-1">
        <i class="pi pi-cog text-surface-400 text-sm"></i>
        <span class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Configuracion</span>
      </div>

      <div class="grid grid-cols-1 gap-3">
        <div>
          <label class="text-xs font-medium text-surface-500 mb-1.5 block">URL API del proyecto</label>
          <InputText v-model="form.url" placeholder="https://tu-dominio.com/api/prj_xxx" class="w-full" />
          <small class="text-[11px] text-surface-400">Copiala desde TMPBase. Debe terminar en /api/prj_xxx.</small>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-surface-500 mb-1.5 block flex items-center gap-1">
              Public Key <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Lectura</span>
            </label>
            <Password v-model="form.key" placeholder="tmp_public_..." :feedback="false" toggleMask fluid class="w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-500 mb-1.5 block flex items-center gap-1">
              Secret Key <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Escritura</span>
            </label>
            <Password v-model="form.serviceKey" placeholder="tmp_secret_..." :feedback="false" toggleMask fluid class="w-full" />
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 pt-1">
        <Button label="Guardar" icon="pi pi-check" :loading="guardando" @click="guardar" severity="success" />
        <Button label="Probar conexion" icon="pi pi-plug" severity="secondary" :loading="testLoading" @click="probarConexion" />
        <Button label="Panel Admin" icon="pi pi-external-link" severity="secondary" outlined @click="abrirAdmin" />
      </div>
    </div>

    <!-- Status Card -->
    <div v-if="estado" class="rounded-2xl border p-5 transition-all" 
      :class="estado.connected ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'">
      <div class="flex items-center gap-2 mb-3">
        <i :class="estado.connected ? 'pi pi-check-circle text-emerald-500' : 'pi pi-exclamation-triangle text-red-500'" class="text-lg" />
        <span class="text-sm font-semibold" :class="estado.connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'">
          {{ estado.connected ? 'Conexion exitosa' : estado.error }}
        </span>
      </div>
      <div v-if="estado.connected && estado.stats" class="grid grid-cols-3 gap-3">
        <div class="bg-white/70 dark:bg-surface-800/50 rounded-xl p-3 text-center border border-surface-100 dark:border-surface-700">
          <div class="text-xl font-bold text-accent-500">{{ estado.stats.project_name ?? '-' }}</div>
          <div class="text-[10px] text-surface-400 uppercase tracking-wider mt-0.5">Proyecto</div>
        </div>
        <div class="bg-white/70 dark:bg-surface-800/50 rounded-xl p-3 text-center border border-surface-100 dark:border-surface-700">
          <div class="text-sm font-bold text-emerald-500 truncate">{{ estado.stats.project_uid ?? '-' }}</div>
          <div class="text-[10px] text-surface-400 uppercase tracking-wider mt-0.5">UID</div>
        </div>
        <div class="bg-white/70 dark:bg-surface-800/50 rounded-xl p-3 text-center border border-surface-100 dark:border-surface-700">
          <div class="text-xl font-bold text-amber-500">{{ estado.stats.tables ?? '-' }}</div>
          <div class="text-[10px] text-surface-400 uppercase tracking-wider mt-0.5">Tablas</div>
        </div>
      </div>
    </div>

    <!-- Sync Mode Card -->
    <div class="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800/50 p-5 space-y-4">
      <div class="flex items-center gap-2">
        <i class="pi pi-sync text-surface-400 text-sm"></i>
        <span class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Sincronizacion</span>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-surface-700 dark:text-surface-200">Modo</div>
          <div class="text-xs text-surface-400 mt-0.5">
            <template v-if="form.mode==='offline'">Solo local</template>
            <template v-else-if="form.mode==='online'">Subida a la nube</template>
            <template v-else>Bidireccional</template>
          </div>
        </div>
        <div class="flex bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-0.5">
          <button v-for="m in modos" :key="m.value" @click="form.mode = m.value"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
            :class="form.mode===m.value ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-0 shadow-sm' : 'text-surface-500 hover:text-surface-700'">
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-surface-100 dark:border-surface-700">
        <div>
          <div class="text-sm font-medium text-surface-700 dark:text-surface-200">Auto Sync</div>
          <div class="text-xs text-surface-400 mt-0.5">Cada {{ form.interval }}s</div>
        </div>
        <ToggleSwitch v-model="form.autoSync" />
      </div>

      <div v-if="form.autoSync" class="pt-2 border-t border-surface-100 dark:border-surface-700">
        <label class="text-xs font-medium text-surface-500 mb-1.5 block">Intervalo (segundos)</label>
        <InputNumber v-model="form.interval" :min="10" :max="86400" showButtons class="w-full" />
      </div>
    </div>

    <!-- Actions Card -->
    <div class="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800/50 p-5 space-y-3">
      <div class="flex items-center gap-2 mb-1">
        <i class="pi pi-bolt text-surface-400 text-sm"></i>
        <span class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Acciones</span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <Button label="Crear Tablas" icon="pi pi-database" severity="secondary" :loading="creandoTablas" @click="createTables" class="w-full justify-start" />
        <Button label="Crear Local" icon="pi pi-download" severity="warn" :loading="creandoTablasLocales" @click="createLocalTablesFromServer" class="w-full justify-start" />
        <Button label="Descargar Todo" icon="pi pi-cloud-download" severity="warn" :loading="downloadAllLoading" @click="downloadAll" class="w-full justify-start" />
        <Button label="Enviar Todo" icon="pi pi-cloud-upload" severity="help" :loading="pushAllLoading" @click="pushAllData" class="w-full justify-start" />
        <Button label="Sync Cambios" icon="pi pi-arrow-right-arrow-left" severity="info" :loading="syncChangesLoading" @click="syncChanges" class="w-full justify-start" />
        <Button label="Sync Completo" icon="pi pi-sync" :loading="syncing" @click="syncNow" class="w-full justify-start" />
      </div>
    </div>

    <!-- Sync Status -->
    <div v-if="syncStatus" class="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800/50 p-4">
      <div v-if="syncStatus.running" class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-accent-500 text-sm"></i>
        </div>
        <div>
          <div class="text-sm font-medium text-surface-700 dark:text-surface-200">{{ syncStatus.tabla || 'Sincronizando...' }}</div>
          <div class="text-xs text-surface-400">{{ syncStatus.progreso }}</div>
        </div>
      </div>
      <div v-else-if="syncStatus.result" class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          :class="syncStatus.result.success ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'">
          <i :class="syncStatus.result.success ? 'pi pi-check text-emerald-500' : 'pi pi-times text-red-500'" class="text-sm"></i>
        </div>
        <div>
          <div class="text-sm font-medium text-surface-700 dark:text-surface-200">{{ syncStatus.result.message }}</div>
          <div class="text-[10px] text-surface-400 mt-0.5">
            Ultimo: {{ syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : '--' }}
          </div>
          <div v-if="syncStatus.result.inserts > 0 || syncStatus.result.updates > 0 || syncStatus.result.errors > 0" class="flex gap-3 mt-1.5 text-xs">
            <span class="text-emerald-600 font-medium" v-if="syncStatus.result.inserts">+{{ syncStatus.result.inserts }} nuevos</span>
            <span class="text-amber-600 font-medium" v-if="syncStatus.result.updates">{{ syncStatus.result.updates }} actualizados</span>
            <span class="text-red-500 font-medium" v-if="syncStatus.result.errors">{{ syncStatus.result.errors }} errores</span>
          </div>
          <div v-if="syncStatus.details && syncStatus.details.length > 0" class="mt-2 text-[10px] text-surface-400 space-y-0.5">
            <div v-for="d in syncStatus.details.filter((x:any)=>x.errors > 0)" :key="d.tabla" class="text-red-400">
              {{ d.tabla }}: {{ d.errors }} error(es)
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import * as tmc from '@/services/tmCloudClient'
import * as tmSync from '@/services/tmCloudSyncService'
import Password from 'primevue/password'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'

const form = reactive({
  url: '',
  key: '',
  serviceKey: '',
  mode: 'ambos' as string,
  autoSync: false,
  interval: 30,
})

const modos = [
  { label: 'Offline', value: 'offline' },
  { label: 'Online', value: 'online' },
  { label: 'Ambos', value: 'ambos' },
]

const guardando = ref(false)
const testLoading = ref(false)
const syncing = ref(false)
const creandoTablas = ref(false)
const creandoTablasLocales = ref(false)
const pushAllLoading = ref(false)
const syncChangesLoading = ref(false)
const downloadAllLoading = ref(false)
const estado = ref<{ connected: boolean; error?: string; stats?: any } | null>(null)
const syncStatus = ref<any>(null)

tmSync.setStatusCallback((s) => {
  syncStatus.value = s
})

onMounted(async () => {
  const config = await tmc.loadConfig()
  form.url = config.url
  form.key = config.key
  form.serviceKey = config.serviceKey
  if (config.url && config.key) {
    try {
      tmc.init(config)
      const stats = await tmc.testConnection(config.url, config.key)
      estado.value = { connected: true, stats }
    } catch (e: any) {
      estado.value = { connected: false, error: e.message }
    }
  }

  try {
    const res = await (window as any).db.getAll('configuracion')
    if (res.success && res.data) {
      const getVal = (clave: string) => res.data.find((r: any) => r.clave === clave)?.valor || ''
      form.mode = getVal('tm_sync_mode') || 'ambos'
      form.autoSync = getVal('tm_auto_sync') === '1'
      form.interval = parseInt(getVal('tm_sync_interval') || '30', 10)
    }
  } catch {}
})

async function guardar() {
  guardando.value = true
  try {
    if (!form.serviceKey.trim()) throw new Error('La Secret Key es requerida para sincronizar y crear tablas')
    const stats = await tmc.testConnection(form.url, form.key)
    tmc.init({ url: form.url.trim(), key: form.key.trim(), serviceKey: form.serviceKey.trim() })
    await tmc.saveConfig(form.url, form.key, form.serviceKey)
    const upsert = async (clave: string, valor: string) => {
      const res = await (window as any).db.getAll('configuracion')
      if (res.success && res.data) {
        const row = res.data.find((r: any) => r.clave === clave)
        if (row) await (window as any).db.update('configuracion', row.id, { valor })
        else await (window as any).db.insert('configuracion', { clave, valor, tipo: 'string', categoria: 'tmcloud' })
      }
    }
    await upsert('tm_sync_mode', form.mode)
    await upsert('tm_auto_sync', form.autoSync ? '1' : '0')
    await upsert('tm_sync_interval', String(form.interval))

    tmSync.setSyncMode(form.mode as any)

    if (form.autoSync) {
      await tmSync.startAutoSync(form.interval * 1000)
    } else {
      tmSync.stopAutoSync()
    }
    estado.value = { connected: true, stats }
  } catch (e: any) {
    estado.value = { connected: false, error: e.message }
  } finally {
    guardando.value = false
  }
}

async function probarConexion() {
  testLoading.value = true
  try {
    const stats = await tmc.testConnection(form.url, form.key)
    tmc.init({ url: form.url.trim(), key: form.key.trim(), serviceKey: form.serviceKey.trim() })
    estado.value = { connected: true, stats }
  } catch (e: any) {
    estado.value = { connected: false, error: e.message }
  } finally {
    testLoading.value = false
  }
}

async function syncChanges() {
  syncChangesLoading.value = true
  tmSync.setSyncCompleteCallback((details) => {
    if (details.length > 0) {
      estado.value = {
        connected: true,
        error: `${details.length} tablas con cambios: ${details.map(d => `${d.tabla}(bajados ${d.downloaded}/subidos ${d.uploaded})`).join(', ')}`
      }
    } else {
      estado.value = { connected: true, error: 'Sin cambios detectados' }
    }
  })
  try {
    const result = await tmSync.syncAll(form.mode as any, true)
    syncStatus.value = { running: false, result }
  } catch (e: any) {
    syncStatus.value = { running: false, result: { message: 'Error: ' + e.message, success: false, inserts: 0, updates: 0, errors: 1 } }
  } finally {
    syncChangesLoading.value = false
  }
}

async function pushAllData() {
  pushAllLoading.value = true
  try {
    const result = await tmSync.pushAllTables(form.mode as any)
    syncStatus.value = { running: false, result }
    estado.value = { connected: true, error: result.message }
  } catch (e: any) {
    syncStatus.value = { running: false, result: { message: 'Error: ' + e.message, success: false, inserts: 0, updates: 0, errors: 1 } }
  } finally {
    pushAllLoading.value = false
  }
}

async function downloadAll() {
  downloadAllLoading.value = true
  try {
    const result = await tmSync.downloadAllTables()
    syncStatus.value = { running: false, result }
    estado.value = { connected: true, error: result.message }
  } catch (e: any) {
    syncStatus.value = { running: false, result: { message: 'Error: ' + e.message, success: false, inserts: 0, updates: 0, errors: 1 } }
  } finally {
    downloadAllLoading.value = false
  }
}

async function syncNow() {
  syncing.value = true
  try {
    await tmSync.startAutoSync(0)
    await tmSync.syncAll(form.mode as any)
  } catch (e: any) {
    syncStatus.value = { running: false, result: { message: 'Error: ' + e.message } }
  } finally {
    syncing.value = false
  }
}

function abrirAdmin() {
  const base = form.url.replace(/\/+$/, '')
  const adminUrl = base.replace(/\/api\/prj_[A-Za-z0-9]+$/i, '')
  window.open(adminUrl || base, '_blank')
}

const TABLE_SCHEMAS: Record<string, { name: string; type: string; nullable?: boolean; primary?: boolean }[]> = {
  usuarios: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'usuario', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'password', type: 'TEXT' },
    { name: 'pin', type: 'TEXT' },
    { name: 'patron', type: 'TEXT' },
    { name: 'pregunta_secreta', type: 'TEXT' },
    { name: 'respuesta', type: 'TEXT' },
    { name: 'fecha', type: 'TEXT' },
    { name: 'nivel_seguridad', type: 'TEXT' },
    { name: 'intentos_login', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'permisos', type: 'TEXT' },
    { name: 'restrinciones', type: 'TEXT' },
    { name: 'porciento', type: 'TEXT' },
    { name: 'imagen', type: 'TEXT' },
    { name: 'rol', type: 'TEXT' },
    { name: 'ultimo_acceso', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  empresa: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'legal', type: 'TEXT' },
    { name: 'telefono', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'direccion', type: 'TEXT' },
    { name: 'logo', type: 'TEXT' },
    { name: 'impuesto', type: 'REAL' },
    { name: 'impuesto_incluido', type: 'INTEGER' },
    { name: 'moneda', type: 'TEXT' },
    { name: 'tipo_documento_defecto', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  clientes: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'cedula', type: 'TEXT' },
    { name: 'telefono', type: 'TEXT' },
    { name: 'whatsapp', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'direccion', type: 'TEXT' },
    { name: 'apodo', type: 'TEXT' },
    { name: 'precio_fijado', type: 'TEXT' },
    { name: 'limite_credito', type: 'TEXT' },
    { name: 'empresa', type: 'TEXT' },
    { name: 'cargo', type: 'TEXT' },
    { name: 'telefono_empresa', type: 'TEXT' },
    { name: 'direccion_empresa', type: 'TEXT' },
    { name: 'codigo', type: 'TEXT' },
    { name: 'rnc', type: 'TEXT' },
    { name: 'activo', type: 'TEXT' },
    { name: 'nota', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  proveedores: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'rnc', type: 'TEXT' },
    { name: 'telefono', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'encargado', type: 'TEXT' },
    { name: 'cuenta_bancaria', type: 'TEXT' },
    { name: 'direccion', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  categorias: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'descripcion', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  marcas: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'descripcion', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  accesorios: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'codigo_barra', type: 'TEXT' },
    { name: 'costo', type: 'REAL' },
    { name: 'precio_venta', type: 'REAL' },
    { name: 'precio_min', type: 'REAL' },
    { name: 'precio_xmayor', type: 'REAL' },
    { name: 'cantidad', type: 'INTEGER' },
    { name: 'alerta', type: 'INTEGER' },
    { name: 'marca', type: 'INTEGER' },
    { name: 'categoria', type: 'INTEGER' },
    { name: 'proveedor_id', type: 'INTEGER' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  telefonos: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  imei: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'id_equi', type: 'INTEGER' },
    { name: 'costo', type: 'REAL' },
    { name: 'precio_venta', type: 'REAL' },
    { name: 'precio_min', type: 'REAL' },
    { name: 'precio_xmayor', type: 'REAL' },
    { name: 'color', type: 'TEXT' },
    { name: 'capacidad', type: 'TEXT' },
    { name: 'bateria', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'fecha_venta', type: 'TEXT' },
    { name: 'comprador', type: 'TEXT' },
    { name: 'proveedor', type: 'TEXT' },
    { name: 'no_compra', type: 'TEXT' },
    { name: 'precio_vendido', type: 'REAL' },
    { name: 'hora_venta', type: 'TEXT' },
    { name: 'no_factura', type: 'TEXT' },
    { name: 'nota', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  electrodomesticos: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  serial: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'id_equi', type: 'INTEGER' },
    { name: 'costo', type: 'REAL' },
    { name: 'precio_venta', type: 'REAL' },
    { name: 'precio_min', type: 'REAL' },
    { name: 'precio_xmayor', type: 'REAL' },
    { name: 'color', type: 'TEXT' },
    { name: 'capacidad', type: 'TEXT' },
    { name: 'bateria', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'fecha_venta', type: 'TEXT' },
    { name: 'comprador', type: 'TEXT' },
    { name: 'proveedor', type: 'TEXT' },
    { name: 'no_compra', type: 'TEXT' },
    { name: 'precio_vendido', type: 'REAL' },
    { name: 'hora_venta', type: 'TEXT' },
    { name: 'no_factura', type: 'TEXT' },
    { name: 'nota', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  facturas: [
    { name: 'uid', type: 'TEXT' },
    { name: 'cheque', type: 'TEXT' },
    { name: 'token', type: 'TEXT' },
    { name: 'cajero', type: 'TEXT' },
    { name: 'no_factura', type: 'TEXT' },
    { name: 'tipo_factura', type: 'TEXT' },
    { name: 'comprobante', type: 'TEXT' },
    { name: 'cod_cliente', type: 'TEXT' },
    { name: 'nombre_cliente', type: 'TEXT' },
    { name: 'telefono_cliente', type: 'TEXT' },
    { name: 'productos', type: 'TEXT' },
    { name: 'vendedor', type: 'TEXT' },
    { name: 'metodo_pago', type: 'TEXT' },
    { name: 'tarjeta', type: 'REAL' },
    { name: 'transferencia', type: 'REAL' },
    { name: 'efectivo', type: 'REAL' },
    { name: 'canal_venta', type: 'TEXT' },
    { name: 'fecha_emision', type: 'TEXT' },
    { name: 'impuesto', type: 'REAL' },
    { name: 'descuento', type: 'REAL' },
    { name: 'subtotal', type: 'REAL' },
    { name: 'total', type: 'REAL' },
    { name: 'ganancia', type: 'REAL' },
    { name: 'financiera', type: 'TEXT' },
    { name: 'estado_factura', type: 'TEXT' },
    { name: 'fecha_estado', type: 'TEXT' },
    { name: 'mes', type: 'TEXT' },
    { name: 'year', type: 'TEXT' },
    { name: 'hora', type: 'TEXT' },
    { name: 'otro', type: 'TEXT' },
    { name: 'nota', type: 'TEXT' },
    { name: 'usuario', type: 'TEXT' },
    { name: 'identificadordb', type: 'TEXT' },
    { name: 'total_institucion', type: 'REAL' },
    { name: 'total_cliente', type: 'REAL' },
    { name: 'ncf', type: 'TEXT' },
    { name: 'tipo_comprobante', type: 'TEXT' },
    { name: 'comprobante_id', type: 'INTEGER' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  piezas: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'costo', type: 'REAL' },
    { name: 'precio_venta', type: 'REAL' },
    { name: 'cantidad', type: 'INTEGER' },
    { name: 'alerta', type: 'INTEGER' },
    { name: 'proveedor', type: 'TEXT' },
    { name: 'descripcion', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  tecnicos: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'telefono', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'porcentaje', type: 'REAL' },
    { name: 'estado', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  ordenes_taller: [
    { name: 'uid', type: 'TEXT' },
    { name: 'no_orden', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'cedula', type: 'TEXT' },
    { name: 'telefono', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'equipo', type: 'TEXT' },
    { name: 'imei', type: 'TEXT' },
    { name: 'serial', type: 'TEXT' },
    { name: 'marca_modelo', type: 'TEXT' },
    { name: 'clave', type: 'TEXT' },
    { name: 'accesorios', type: 'TEXT' },
    { name: 'fallas', type: 'TEXT' },
    { name: 'piezas', type: 'TEXT' },
    { name: 'tecnico', type: 'TEXT' },
    { name: 'metodo_pago', type: 'TEXT' },
    { name: 'fecha_entrada', type: 'TEXT' },
    { name: 'fecha_entrega', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'precio_pieza', type: 'REAL' },
    { name: 'mano_obra', type: 'REAL' },
    { name: 'abono', type: 'REAL' },
    { name: 'pendiente', type: 'REAL' },
    { name: 'total', type: 'REAL' },
    { name: 'pagos', type: 'TEXT' },
    { name: 'beneficio_empresa', type: 'REAL' },
    { name: 'beneficio_tecnico', type: 'REAL' },
    { name: 'porcentaje_tecnico', type: 'REAL' },
    { name: 'estado_pago_tecnico', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  correo: [
    { name: 'uid', type: 'TEXT' },
    { name: 'host', type: 'TEXT' },
    { name: 'puerto', type: 'TEXT' },
    { name: 'seguridad', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'password', type: 'TEXT' },
    { name: 'nombre_remitente', type: 'TEXT' },
    { name: 'activo', type: 'INTEGER' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  gastos: [
    { name: 'uid', type: 'TEXT' },
    { name: 'cantidad', type: 'REAL' },
    { name: 'fecha', type: 'TEXT' },
    { name: 'hora', type: 'TEXT' },
    { name: 'comentario', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  gastos_fijos: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'monto', type: 'REAL' },
    { name: 'dia_pago', type: 'INTEGER' },
    { name: 'categoria', type: 'TEXT' },
    { name: 'periodicidad', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'descripcion', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  impresoras_config: [
    { name: 'uid', type: 'TEXT' },
    { name: 'printer_name', type: 'TEXT' },
    { name: 'printer_model', type: 'TEXT' },
    { name: 'paper_width', type: 'INTEGER' },
    { name: 'show_logo', type: 'INTEGER' },
    { name: 'show_company_name', type: 'INTEGER' },
    { name: 'show_legal', type: 'INTEGER' },
    { name: 'show_phone', type: 'INTEGER' },
    { name: 'show_address', type: 'INTEGER' },
    { name: 'show_email', type: 'INTEGER' },
    { name: 'show_cliente', type: 'INTEGER' },
    { name: 'show_items', type: 'INTEGER' },
    { name: 'show_totals', type: 'INTEGER' },
    { name: 'show_barcode', type: 'INTEGER' },
    { name: 'show_footer', type: 'INTEGER' },
    { name: 'show_qr', type: 'INTEGER' },
    { name: 'show_nota', type: 'INTEGER' },
    { name: 'footer_text', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  cuentas_cobrar: [
    { name: 'uid', type: 'TEXT' },
    { name: 'no_factura', type: 'TEXT' },
    { name: 'cod_cliente', type: 'TEXT' },
    { name: 'nombre_cliente', type: 'TEXT' },
    { name: 'telefono_cliente', type: 'TEXT' },
    { name: 'total', type: 'REAL' },
    { name: 'abonado', type: 'REAL' },
    { name: 'saldo', type: 'REAL' },
    { name: 'fecha_venta', type: 'TEXT' },
    { name: 'fecha_vencimiento', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'notas', type: 'TEXT' },
    { name: 'pagos', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  cuentas_pagar: [
    { name: 'uid', type: 'TEXT' },
    { name: 'no_factura', type: 'TEXT' },
    { name: 'cod_proveedor', type: 'TEXT' },
    { name: 'nombre_proveedor', type: 'TEXT' },
    { name: 'telefono_proveedor', type: 'TEXT' },
    { name: 'total', type: 'REAL' },
    { name: 'abonado', type: 'REAL' },
    { name: 'saldo', type: 'REAL' },
    { name: 'fecha_compra', type: 'TEXT' },
    { name: 'fecha_vencimiento', type: 'TEXT' },
    { name: 'estado', type: 'TEXT' },
    { name: 'notas', type: 'TEXT' },
    { name: 'pagos', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  comprobantes_fiscales: [
    { name: 'uid', type: 'TEXT' },
    { name: 'tipo', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'descripcion', type: 'TEXT' },
    { name: 'prefijo', type: 'TEXT' },
    { name: 'secuencia_actual', type: 'INTEGER' },
    { name: 'secuencia_desde', type: 'INTEGER' },
    { name: 'secuencia_hasta', type: 'INTEGER' },
    { name: 'fecha_vencimiento', type: 'TEXT' },
    { name: 'activo', type: 'INTEGER' },
    { name: 'es_default', type: 'INTEGER' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  notas: [
    { name: 'uid', type: 'TEXT' },
    { name: 'titulo', type: 'TEXT' },
    { name: 'contenido', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
  ],
  plantillas_etiquetas: [
    { name: 'uid', type: 'TEXT' },
    { name: 'nombre', type: 'TEXT' },
    { name: 'ancho', type: 'REAL' },
    { name: 'alto', type: 'REAL' },
    { name: 'elementos', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
    { name: 'updated_at', type: 'DATETIME' },
  ],
  bitacora: [
    { name: 'uid', type: 'TEXT' },
    { name: 'tabla', type: 'TEXT' },
    { name: 'registro_id', type: 'TEXT' },
    { name: 'accion', type: 'TEXT' },
    { name: 'usuario', type: 'TEXT' },
    { name: 'datos_nuevos', type: 'TEXT' },
    { name: 'datos_anteriores', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
  ],
  configuracion: [
    { name: 'uid', type: 'TEXT' },
    { name: 'clave', type: 'TEXT' },
    { name: 'valor', type: 'TEXT' },
    { name: 'tipo', type: 'TEXT' },
    { name: 'categoria', type: 'TEXT' },
    { name: 'created_at', type: 'DATETIME' },
  ],
}

async function createTables() {
  if (!form.url || !form.serviceKey) {
    estado.value = { connected: false, error: 'Configura la URL y Secret Key primero' }
    return
  }
  creandoTablas.value = true
  const base = form.url.replace(/\/+$/, '')
  const key = form.serviceKey
  const tableNames = Object.keys(TABLE_SCHEMAS)
  const batch = tableNames.map(name => ({ name, columns: TABLE_SCHEMAS[name] }))

  try {
    const res = await fetch(`${base}/schema/tables/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: batch }),
    })
    if (res.ok) {
      const json = await res.json()
      estado.value = { connected: true, error: json.data?.message || `${json.data?.created || 0} tablas OK` }
    } else {
      const err = await res.json().catch(()=>({}))
      estado.value = { connected: false, error: err.error || 'Error creando tablas' }
    }
  } catch (_e) {
    estado.value = { connected: false, error: 'Error de red' }
  } finally {
    creandoTablas.value = false
  }
}

async function createLocalTablesFromServer() {
  if (!form.url || !form.key) {
    estado.value = { connected: false, error: 'Configura la URL y la Public Key primero' }
    return
  }
  creandoTablasLocales.value = true
  try {
    tmc.init({ url: form.url.trim(), key: form.key.trim(), serviceKey: form.serviceKey.trim() })
    const schema = await tmSync.fetchServerSchema()
    if (!schema || !schema.length) {
      estado.value = { connected: false, error: 'No se pudo obtener el esquema del servidor' }
      return
    }
    let creadas = 0
    for (const table of schema) {
      if (['sync_deletes', 'sync_queue', 'configuracion'].includes(table.name)) continue
      const cols = table.columns || []
      const hasUid = cols.some((c: any) => c.name === 'uid')
      const hasCreatedAt = cols.some((c: any) => c.name === 'created_at')
      const hasUpdatedAt = cols.some((c: any) => c.name === 'updated_at')
      const extraCols = []
      if (!hasUid) extraCols.push('"uid" TEXT DEFAULT \'\'')
      if (!hasCreatedAt) extraCols.push('"created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      if (!hasUpdatedAt) extraCols.push('"updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      extraCols.push('"almacen_id" INTEGER DEFAULT 0')
      const columnDefs = cols.map((c: any) => {
        let type = 'TEXT DEFAULT \'\''
        if (c.type?.toLowerCase().includes('int')) type = 'INTEGER DEFAULT 0'
        else if (c.type?.toLowerCase().includes('real') || c.type?.toLowerCase().includes('float') || c.type?.toLowerCase().includes('double') || c.type?.toLowerCase().includes('decimal')) type = 'REAL DEFAULT 0'
        else if (c.type?.toLowerCase().includes('timestamp') || c.type?.toLowerCase().includes('datetime')) type = 'TEXT DEFAULT \'\''
        return `"${c.name}" ${type}`
      })
      const allCols = [...columnDefs, ...extraCols]
      const sql = `CREATE TABLE IF NOT EXISTS "${table.name}" (id INTEGER PRIMARY KEY AUTOINCREMENT, ${allCols.join(', ')})`
      try {
        await (window as any).electron.invoke('db:exec', sql)
        creadas++
      } catch (e) {
        console.error(`Error creating ${table.name}:`, e)
      }
    }
    estado.value = { connected: true, error: `${creadas} tablas creadas/actualizadas` }
  } catch (e: any) {
    estado.value = { connected: false, error: e.message || 'Error de red' }
  } finally {
    creandoTablasLocales.value = false
  }
}
</script>
