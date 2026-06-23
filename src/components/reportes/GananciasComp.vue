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

function parseProductos(productos: any): any[] {
  if (!productos) return []
  if (Array.isArray(productos)) return productos
  try { return JSON.parse(productos) } catch { return [] }
}

const productosGanancia = computed(() => {
  const mapa = new Map<string, { nombre: string; cantidad: number; total: number; costo: number; ganancia: number }>()
  for (const f of facturas.value) {
    const prods = parseProductos(f.productos)
    for (const p of prods) {
      const key = p.nombre || 'SIN NOMBRE'
      const entry = mapa.get(key) || { nombre: p.nombre || 'SIN NOMBRE', cantidad: 0, total: 0, costo: 0, ganancia: 0 }
      entry.cantidad += Number(p.cantidad) || 0
      entry.total += Number(p.total) || (Number(p.precio) * Number(p.cantidad)) || 0
      entry.costo += (Number(p.costo) * Number(p.cantidad)) || 0
      entry.ganancia = entry.total - entry.costo
      mapa.set(key, entry)
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.ganancia - a.ganancia)
})

const totales = computed(() => {
  let total = 0, ganancia = 0
  for (const f of facturas.value) {
    total += Number(f.total) || 0
    ganancia += Number(f.ganancia) || 0
  }
  return { total, ganancia, count: facturas.value.length }
})

const margen = computed(() => totales.value.total > 0 ? (totales.value.ganancia / totales.value.total) * 100 : 0)

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
        f.fecha_emision >= inicio && f.fecha_emision <= fin &&
        (f.tipo_factura === 'FACTURA_VENTA' || f.tipo_factura === 'FACTURA_CONSUMO')
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
  let csv = 'Producto,Cantidad,Total,Costo,Ganancia\n'
  for (const p of productosGanancia.value) {
    csv += `"${p.nombre}",${p.cantidad},"${p.total}","${p.costo}","${p.ganancia}"\n`
  }
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ganancias_${year.value}_${String(mes.value).padStart(2, '0')}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ severity: 'success', summary: 'Exportado', detail: 'Archivo CSV descargado', life: 3000 })
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
        <InputText v-model="busqueda" placeholder="Buscar producto..." fluid />
      </IconField>
      <Button label="Exportar CSV" icon="pi pi-download" severity="info" @click="exportarCSV" />
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-3 text-white">
        <p class="text-blue-100 text-xs">Ventas Totales</p>
        <p class="text-lg font-bold">RD$ {{ formatCurrency(totales.total) }}</p>
      </div>
      <div class="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-white">
        <p class="text-emerald-100 text-xs">Ganancia</p>
        <p class="text-lg font-bold">RD$ {{ formatCurrency(totales.ganancia) }}</p>
      </div>
      <div class="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-3 text-white">
        <p class="text-teal-100 text-xs">Margen</p>
        <p class="text-lg font-bold">{{ margen.toFixed(1) }}%</p>
      </div>
      <div class="rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 p-3 text-white">
        <p class="text-violet-100 text-xs">Facturas</p>
        <p class="text-lg font-bold">{{ totales.count }}</p>
      </div>
    </div>

    <DataTable
      :value="productosGanancia"
      :loading="loading"
      stripedRows
      paginator
      :rows="25"
      :rowsPerPageOptions="[25, 50, 100]"
      responsiveLayout="scroll"
      sortField="ganancia"
      :sortOrder="-1"
      class="!text-xs"
      scrollable
    >
      <Column field="nombre" header="Producto" sortable />
      <Column field="cantidad" header="Vendidos" sortable style="width: 6rem" />
      <Column field="total" header="Total" sortable style="width: 8rem">
        <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
      </Column>
      <Column field="costo" header="Costo" sortable style="width: 8rem">
        <template #body="{ data }">${{ formatCurrency(data.costo) }}</template>
      </Column>
      <Column field="ganancia" header="Ganancia" sortable style="width: 8rem">
        <template #body="{ data }"><span class="text-emerald-600 font-semibold">${{ formatCurrency(data.ganancia) }}</span></template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">No hay ventas en este periodo.</div>
      </template>
    </DataTable>
  </div>
</template>
