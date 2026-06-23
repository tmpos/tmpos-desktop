<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const facturas = ref<any[]>([])
const loading = ref(false)
const busqueda = ref('')
const mes = ref(new Date().getMonth() + 1)
const year = ref(new Date().getFullYear())

const meses = Array.from({ length: 12 }, (_, i) => ({ label: new Date(2024, i, 1).toLocaleString('es', { month: 'long' }), value: i + 1 }))
const years = Array.from({ length: 5 }, (_, i) => ({ label: String(new Date().getFullYear() - i), value: new Date().getFullYear() - i }))

const facturasFiltradas = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return facturas.value
  return facturas.value.filter((f: any) =>
    (f.nombre_cliente || '').toLowerCase().includes(q) ||
    (f.ncf || '').toLowerCase().includes(q)
  )
})

const totales = computed(() => {
  let total = 0, itbis = 0
  for (const f of facturasFiltradas.value) {
    total += Number(f.total) || 0
    itbis += Number(f.impuesto) || 0
  }
  return { total, itbis, count: facturasFiltradas.value.length }
})

async function cargar() {
  loading.value = true
  try {
    const m = String(mes.value).padStart(2, '0')
    const y = String(year.value)
    const inicio = `${y}-${m}-01`
    const fin = `${y}-${m}-31`
    const res = await (window as any).db.getAll('facturas')
    if (res.success) {
      facturas.value = (res.data || []).filter((f: any) =>
        (f.tipo_factura === 'FACTURA_COMPRA') &&
        f.fecha_emision >= inicio && f.fecha_emision <= fin
      )
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function exportarCSV() {
  let csv = 'RNC/Cedula,Nombre,NCF,Fecha,Monto,ITBIS\n'
  for (const f of facturasFiltradas.value) {
    csv += `"${f.cod_cliente || ''}","${f.nombre_cliente || ''}","${f.ncf || ''}","${f.fecha_emision || ''}","${Number(f.total) || 0}","${Number(f.impuesto) || 0}"\n`
  }
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte_606_${year.value}_${String(mes.value).padStart(2, '0')}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ severity: 'success', summary: 'Exportado', detail: 'Archivo CSV descargado', life: 3000 })
}

async function generarReporte() {
  await cargar()
  exportarCSV()
}

onMounted(cargar)
</script>

<template>
  <div>
    <Toast />
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <Select v-model="mes" :options="meses" optionLabel="label" optionValue="value" class="w-40" @change="cargar" />
      <Select v-model="year" :options="years" optionLabel="label" optionValue="value" class="w-28" @change="cargar" />
      <IconField class="w-64">
        <InputIcon class="pi pi-search" />
        <InputText v-model="busqueda" placeholder="Buscar..." fluid />
      </IconField>
      <Button label="Exportar CSV" icon="pi pi-download" severity="info" @click="exportarCSV" />
      <Button label="Generar 606" icon="pi pi-file" @click="generarReporte" />
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <div class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-3 text-white">
        <p class="text-blue-100 text-xs">Total Compras</p>
        <p class="text-lg font-bold">RD$ {{ formatCurrency(totales.total) }}</p>
      </div>
      <div class="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-white">
        <p class="text-emerald-100 text-xs">ITBIS</p>
        <p class="text-lg font-bold">RD$ {{ formatCurrency(totales.itbis) }}</p>
      </div>
      <div class="rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 p-3 text-white">
        <p class="text-violet-100 text-xs">Comprobantes</p>
        <p class="text-lg font-bold">{{ totales.count }}</p>
      </div>
    </div>

    <DataTable
      :value="facturasFiltradas"
      :loading="loading"
      stripedRows
      paginator
      :rows="25"
      :rowsPerPageOptions="[25, 50, 100]"
      responsiveLayout="scroll"
      sortField="fecha_emision"
      :sortOrder="-1"
      class="!text-xs"
      scrollable
    >
      <Column field="cod_cliente" header="RNC / Cedula" sortable style="width: 8rem" />
      <Column field="nombre_cliente" header="Proveedor" sortable />
      <Column field="ncf" header="NCF" sortable style="width: 9rem" />
      <Column field="fecha_emision" header="Fecha" sortable style="width: 7rem" />
      <Column field="total" header="Monto" sortable style="width: 8rem">
        <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
      </Column>
      <Column field="impuesto" header="ITBIS" sortable style="width: 8rem">
        <template #body="{ data }">${{ formatCurrency(data.impuesto) }}</template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">No hay facturas de compra en este periodo.</div>
      </template>
    </DataTable>
  </div>
</template>
