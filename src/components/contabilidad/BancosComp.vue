<script setup lang="ts">
import { getSystemLocale } from '@/i18n/localeProfiles'
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { useAlmacenFilter } from '@/composables/useAlmacenFilter'
import { useBulkWarehouseTransfer } from '@/composables/useBulkWarehouseTransfer'

const toast = useToast()
const { filterByAlmacen, addAlmacenId, store: almacenStore } = useAlmacenFilter()
const cuentas = ref<any[]>([])
const selectedCuentas = ref<any[]>([])
const verTodosAlmacenes = ref(false)
const loading = ref(false)

const {
  dialogMoverAlmacen, almacenDestino, almacenesDestino, moviendoAlmacen,
  abrirMoverAlmacen, aplicarMoverAlmacen,
} = useBulkWarehouseTransfer({
  table: 'bancos', entity: 'bancos', label: 'cuenta bancaria',
  selection: selectedCuentas, reload: cargarCuentas,
  reference: (item: any) => item.nombre || item.numero_cuenta || String(item.id || ''),
})

const dialogVisible = ref(false)
const isEditing = ref(false)
const form = ref({ nombre: '', numero_cuenta: '', moneda: 'PESOS', saldo: 0 })
const selectedId = ref<number | null>(null)
const guardando = ref(false)

const monedas = [
  { label: 'PESOS', value: 'PESOS' },
  { label: 'DOLARES', value: 'DOLARES' },
  { label: 'EUROS', value: 'EUROS' },
]

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString(getSystemLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function ensureTable() {
  const execSql = async (sql: string) => {
    try {
      const res = await window.electron.invoke('consultaservidor', 'executeSQL', sql)
      if (res?.success === false) throw new Error(res.error || 'executeSQL fallo')
    } catch {
      try { await window.electron.invoke('consultaservidor', 'rawQuery', sql) } catch {}
    }
  }

  try {
    await execSql(`CREATE TABLE IF NOT EXISTS bancos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, numero_cuenta TEXT DEFAULT '', moneda TEXT DEFAULT 'PESOS', saldo REAL DEFAULT 0, fecha_transaccion TEXT DEFAULT '', uid TEXT DEFAULT '', created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '')`)
    await execSql(`ALTER TABLE bancos ADD COLUMN uid TEXT DEFAULT ''`)
    await execSql(`ALTER TABLE bancos ADD COLUMN created_at TEXT DEFAULT ''`)
    await execSql(`ALTER TABLE bancos ADD COLUMN updated_at TEXT DEFAULT ''`)
    await execSql(`ALTER TABLE bancos ADD COLUMN fecha_transaccion TEXT DEFAULT ''`)
    await execSql(`ALTER TABLE bancos ADD COLUMN almacen_id INTEGER DEFAULT 0`)
    await execSql(`ALTER TABLE bancos ADD COLUMN almacen_uid TEXT DEFAULT ''`)
    await execSql(`UPDATE bancos SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL OR uid = ''`)
  } catch (_) {}
}

async function cargarCuentas() {
  loading.value = true
  try {
    const res = await window.db.getAll('bancos')
    if (res.success) cuentas.value = verTodosAlmacenes.value ? (res.data || []) : filterByAlmacen(res.data || [])
  } catch (_) {}
  loading.value = false
}

watch(verTodosAlmacenes, async () => {
  selectedCuentas.value = []
  await cargarCuentas()
})

function abrirNueva() {
  isEditing.value = false
  selectedId.value = null
  form.value = { nombre: '', numero_cuenta: '', moneda: 'PESOS', saldo: 0 }
  dialogVisible.value = true
}

function abrirEditar(cuenta: any) {
  isEditing.value = true
  selectedId.value = cuenta.id
  form.value = {
    nombre: cuenta.nombre || '',
    numero_cuenta: cuenta.numero_cuenta || '',
    moneda: cuenta.moneda || 'PESOS',
    saldo: cuenta.saldo || 0,
  }
  dialogVisible.value = true
}

async function guardar() {
  if (!form.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre es requerido', life: 3000 })
    return
  }
  guardando.value = true
  try {
    const data = {
      nombre: form.value.nombre.trim().toUpperCase(),
      numero_cuenta: form.value.numero_cuenta.trim(),
      moneda: form.value.moneda,
      saldo: Number(form.value.saldo),
      updated_at: new Date().toISOString(),
    }
    let res
    if (isEditing.value && selectedId.value) {
      res = await window.db.update('bancos', selectedId.value, data)
    } else {
      data.created_at = new Date().toISOString()
      res = await window.db.insert('bancos', addAlmacenId(data))
    }
    if (res.success) {
      toast.add({ severity: 'success', summary: isEditing.value ? 'Actualizada' : 'Creada', detail: 'Cuenta bancaria guardada', life: 3000 })
      dialogVisible.value = false
      await cargarCuentas()
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error, life: 3000 })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    guardando.value = false
  }
}

async function eliminar(cuenta: any) {
  if (!confirm(`Eliminar cuenta "${cuenta.nombre}"?`)) return
  try {
    await window.db.delete('bancos', cuenta.id)
    toast.add({ severity: 'info', summary: 'Eliminada', detail: 'Cuenta bancaria eliminada', life: 3000 })
    await cargarCuentas()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  }
}

onMounted(async () => {
  await ensureTable()
  await almacenStore.load()
  await cargarCuentas()
})
</script>

<template>
  <div>
    <Toast />

    <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-5">
      <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 class="text-xl font-bold">Bancos</h3>
          <p class="text-sm text-surface-500">Cuentas bancarias y saldos</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <label class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300 cursor-pointer">
            <ToggleSwitch v-model="verTodosAlmacenes" />
            <span>Todos los almacenes</span>
          </label>
          <Button
            v-if="selectedCuentas.length"
            :label="`Cambiar almacén (${selectedCuentas.length})`"
            icon="pi pi-warehouse"
            severity="success"
            @click="abrirMoverAlmacen"
          />
          <Button label="Nueva Cuenta" icon="pi pi-plus" @click="abrirNueva" />
        </div>
      </div>

      <DataTable v-model:selection="selectedCuentas" :value="cuentas" :loading="loading" stripedRows paginator :rows="10" dataKey="id" responsiveLayout="scroll">
        <Column selectionMode="multiple" headerStyle="width: 3rem" />
        <Column header="Acciones" style="width: 7rem">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-pencil" severity="info" text rounded size="small" @click="abrirEditar(data)" v-tooltip="'Editar'" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="eliminar(data)" v-tooltip="'Eliminar'" />
            </div>
          </template>
        </Column>
        <Column field="nombre" header="Nombre" sortable />
        <Column field="numero_cuenta" header="No. Cuenta" sortable />
        <Column field="moneda" header="Moneda" sortable style="width: 7rem">
          <template #body="{ data }">
            <Tag :value="data.moneda" :severity="data.moneda === 'PESOS' ? 'info' : data.moneda === 'DOLARES' ? 'success' : 'warn'" />
          </template>
        </Column>
        <Column field="saldo" header="Saldo" sortable style="width: 10rem">
          <template #body="{ data }">
            <span :class="data.saldo >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'">{{ $formatMoney(data.saldo) }}</span>
          </template>
        </Column>
        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay cuentas bancarias.</div>
        </template>
      </DataTable>

      <div v-if="cuentas.length" class="flex justify-end mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
        <div class="text-right">
          <div class="text-xs text-surface-500 uppercase tracking-wider">Saldo Total</div>
          <div class="text-2xl font-bold text-primary-600">{{ $formatMoney(cuentas.reduce((s, c) => s + Number(c.saldo || 0), 0)) }}</div>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="dialogMoverAlmacen" header="Cambiar almacén" modal :style="{ width: '28rem' }">
      <div class="space-y-4 pt-2">
        <p class="text-sm text-surface-600 dark:text-surface-300">
          Se moverán {{ selectedCuentas.length }} cuenta(s) bancaria(s) al almacén seleccionado.
        </p>
        <Select
          v-model="almacenDestino"
          :options="almacenesDestino"
          optionLabel="nombre"
          placeholder="Seleccionar almacén destino"
          fluid
        />
        <p v-if="almacenesDestino.length === 0" class="text-sm text-orange-600">
          No hay otro almacén disponible como destino.
        </p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogMoverAlmacen = false" />
        <Button
          label="Cambiar almacén"
          icon="pi pi-warehouse"
          severity="success"
          :loading="moviendoAlmacen"
          :disabled="!almacenDestino"
          @click="aplicarMoverAlmacen"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogVisible" :header="isEditing ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'" modal :style="{ width: 'min(22rem, calc(100vw - 2rem))' }" :draggable="false">
      <div class="space-y-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Nombre <span class="text-red-500">*</span></label>
          <InputText v-model="form.nombre" placeholder="Nombre del banco" fluid class="uppercase" style="text-transform: uppercase" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">No. Cuenta</label>
          <InputText v-model="form.numero_cuenta" placeholder="Numero de cuenta" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Moneda</label>
          <Select v-model="form.moneda" :options="monedas" optionLabel="label" optionValue="value" fluid />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold">Saldo inicial</label>
          <InputNumber v-model="form.saldo" fluid @focus="(e: any) => e.target.select()" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button label="Guardar" icon="pi pi-check" :loading="guardando" @click="guardar" />
      </template>
    </Dialog>
  </div>
</template>
