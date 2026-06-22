<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Calendar from 'primevue/calendar'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const dialogNuevoProveedor = ref(false)
const nuevoProveedor = ref({ nombre: '', telefono: '', email: '', direccion: '' })


const proveedores = ref<any[]>([])
const telefonos = ref<any[]>([])
const accesorios = ref<any[]>([])
const marcas = ref<any[]>([])
const categorias = ref<any[]>([])

const form = ref({
  fecha: new Date(),
  proveedor_id: null as number | null,
  proveedor_nombre: '',
  no_factura: '',
  nota: '',
})

const busqueda = ref('')
const imeiData = ref({ nombre: '', color: '', capacidad: '', costo: 0, precio_venta: 0, precio_min: 0, precio_xmayor: 0 })
const accSearch = ref('')
const accCantidad = ref(1)
const accNuevo = ref({ nombre: '', costo: 0, precio_venta: 0, cantidad: 1, marca: null as number | null, categoria: null as number | null })

const cart = ref<any[]>([])
const cargando = ref(false)

const productosFiltrados = computed(() => {
  const texto = busqueda.value.toLowerCase().trim()
  if (!texto) return telefonos.value
  return telefonos.value.filter((t: any) => t.nombre?.toLowerCase().includes(texto))
})

const accFiltrados = computed(() => {
  const texto = accSearch.value.toLowerCase().trim()
  if (!texto) return accesorios.value
  return accesorios.value.filter((a: any) =>
    a.nombre?.toLowerCase().includes(texto) ||
    a.marca_nombre?.toLowerCase().includes(texto)
  )
})

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function cargarDatos() {
  const [resProv, resTel, resAcc, resMar, resCat] = await Promise.all([
    window.db.getAll('proveedores'),
    window.db.getAll('telefonos'),
    window.db.getAll('accesorios'),
    window.db.getAll('marcas'),
    window.db.getAll('categorias'),
  ])
  if (resProv.success) {
    proveedores.value = resProv.data || []
    const defProv = proveedores.value.find((p: any) => p.id === form.value.proveedor_id)
    if (!defProv) form.value.proveedor_id = null
  }
  if (resTel.success) telefonos.value = resTel.data || []
  if (resAcc.success) accesorios.value = resAcc.data || []
  if (resMar.success) marcas.value = resMar.data || []
  if (resCat.success) categorias.value = resCat.data || []

  const marcasMap = new Map(marcas.value.map((m: any) => [m.id, m.nombre]))
  const catsMap = new Map(categorias.value.map((c: any) => [c.id, c.nombre]))
  accesorios.value = accesorios.value.map((a: any) => ({
    ...a,
    marca_nombre: marcasMap.get(a.marca) || '',
    categoria_nombre: catsMap.get(a.categoria) || '',
  }))
}

function agregarImeiAlCarrito() {
  if (!imeiData.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'IMEI requerido', detail: 'Ingresa el numero IMEI', life: 2000 })
    return
  }
  cart.value.push({
    tipo: 'imei',
    imei: imeiData.value.nombre.trim(),
    telefono_nombre: busqueda.value.trim().toUpperCase() || 'SIN MODELO',
    color: imeiData.value.color.trim().toUpperCase(),
    capacidad: imeiData.value.capacidad.trim().toUpperCase(),
    costo: imeiData.value.costo,
    precio_venta: imeiData.value.precio_venta,
    precio_min: imeiData.value.precio_min,
    precio_xmayor: imeiData.value.precio_xmayor,
    proveedor: form.value.proveedor_nombre || '',
    no_compra: form.value.no_factura || '',
  })
  imeiData.value = { nombre: '', color: '', capacidad: '', costo: 0, precio_venta: 0, precio_min: 0, precio_xmayor: 0 }
  toast.add({ severity: 'success', summary: 'Agregado', detail: 'IMEI agregado a la compra', life: 2000 })
}

function agregarAccAlCarrito(acc: any) {
  const existente = cart.value.find((item: any) => item.tipo === 'accesorio' && item.accesorio_id === acc.id)
  if (existente) {
    existente.cantidad += accCantidad.value
  } else {
    cart.value.push({
      tipo: 'accesorio',
      accesorio_id: acc.id,
      nombre: acc.nombre,
      costo: acc.costo || 0,
      precio_venta: acc.precio_venta || 0,
      stock_actual: acc.cantidad || 0,
      cantidad: accCantidad.value,
    })
  }
  toast.add({ severity: 'success', summary: 'Agregado', detail: `${acc.nombre} x${accCantidad.value}`, life: 2000 })
}

function agregarAccNuevoAlCarrito() {
  if (!accNuevo.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Nombre requerido', detail: 'Ingresa el nombre del accesorio', life: 2000 })
    return
  }
  cart.value.push({
    tipo: 'accesorio_nuevo',
    nombre: accNuevo.value.nombre.trim().toUpperCase(),
    costo: accNuevo.value.costo,
    precio_venta: accNuevo.value.precio_venta,
    cantidad: accNuevo.value.cantidad,
    marca: accNuevo.value.marca,
    categoria: accNuevo.value.categoria,
  })
  accNuevo.value = { nombre: '', costo: 0, precio_venta: 0, cantidad: 1, marca: null, categoria: null }
  toast.add({ severity: 'success', summary: 'Agregado', detail: 'Nuevo accesorio agregado a la compra', life: 2000 })
}

function quitarDelCarrito(index: number) {
  cart.value.splice(index, 1)
}

const totalCompra = computed(() =>
  cart.value.reduce((sum, item) => {
    if (item.tipo === 'imei') return sum + (item.costo || 0)
    return sum + ((item.costo || 0) * (item.cantidad || 1))
  }, 0)
)

async function completarCompra() {
  if (cart.value.length === 0) {
    toast.add({ severity: 'warn', summary: 'Carrito vacio', detail: 'Agrega productos a la compra', life: 3000 })
    return
  }
  cargando.value = true
  let ok = 0
  let errors: string[] = []
  try {
    for (const item of cart.value) {
      if (item.tipo === 'imei') {
        const res = await window.db.insert('imei', {
          nombre: item.imei,
          id_equi: null,
          costo: item.costo,
          precio_venta: item.precio_venta,
          precio_min: item.precio_min,
          precio_xmayor: item.precio_xmayor,
          color: item.color,
          capacidad: item.capacidad,
          estado: 'DISPONIBLE',
          proveedor: item.proveedor,
          no_compra: item.no_compra,
        })
        if (res.success) ok++
        else errors.push(`IMEI ${item.imei}: ${res.error}`)
      } else if (item.tipo === 'accesorio') {
        const acc = accesorios.value.find((a: any) => a.id === item.accesorio_id)
        if (acc) {
          const nuevoStock = (acc.cantidad || 0) + item.cantidad
          const res = await window.db.update('accesorios', item.accesorio_id, { cantidad: nuevoStock })
          if (res.success) { acc.cantidad = nuevoStock; ok++ }
          else errors.push(`Stock ${item.nombre}: ${res.error}`)
        }
      } else if (item.tipo === 'accesorio_nuevo') {
        const res = await window.db.insert('accesorios', {
          nombre: item.nombre,
          costo: item.costo,
          precio_venta: item.precio_venta,
          cantidad: item.cantidad,
          alerta: 10,
          marca: item.marca,
          categoria: item.categoria,
        })
        if (res.success) ok++
        else errors.push(`Accesorio ${item.nombre}: ${res.error}`)
      }
    }
    if (ok > 0) {
      toast.add({ severity: 'success', summary: 'Compra registrada', detail: `${ok} producto(s) procesados`, life: 3000 })
  cart.value = []
  await cargarDatos()
}

async function guardarNuevoProveedor() {
  if (!nuevoProveedor.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Nombre requerido', detail: 'El nombre del proveedor es obligatorio', life: 2000 })
    return
  }
  try {
    const data = {
      nombre: nuevoProveedor.value.nombre.trim().toUpperCase(),
      telefono: nuevoProveedor.value.telefono.trim(),
      email: nuevoProveedor.value.email.trim().toLowerCase(),
      direccion: nuevoProveedor.value.direccion.trim().toUpperCase(),
    }
    const res = await window.db.insert('proveedores', data)
    if (res.success) {
      const nuevo = { id: res.data.id, ...data }
      proveedores.value.unshift(nuevo)
      form.value.proveedor_id = res.data.id
      dialogNuevoProveedor.value = false
      toast.add({ severity: 'success', summary: 'Proveedor creado', detail: data.nombre, life: 2000 })
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  }
}
    for (const e of errors.slice(0, 3)) toast.add({ severity: 'error', summary: 'Error', detail: e, life: 4000 })
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDatos)
</script>

<template>
  <div>
    <Toast />

    <div class="space-y-5">
      <div class="flex items-center gap-3 pb-2 border-b border-surface-200/50 dark:border-surface-700/30">
        <div class="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-shopping-bag text-primary text-lg"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold">Compras</h2>
          <p class="text-sm text-surface-500">Registro de compras a suplidores</p>
        </div>
      </div>

      <div class="rounded-xl border border-surface-200/50 dark:border-surface-700/30 bg-surface-0 dark:bg-surface-800 p-4 space-y-3">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-surface-500">Fecha</label>
            <Calendar v-model="form.fecha" dateFormat="dd/mm/yy" fluid showIcon />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-semibold text-surface-500">Proveedor</label>
            <div class="flex gap-2">
              <Select v-model="form.proveedor_id" :options="proveedores" optionLabel="nombre" optionValue="id" placeholder="Seleccionar..." class="flex-1" fluid />
              <Button icon="pi pi-plus" severity="success" text rounded size="small" @click="dialogNuevoProveedor = true" v-tooltip="'Nuevo proveedor'" />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-semibold text-surface-500">No. Factura</label>
            <InputText v-model="form.no_factura" placeholder="Factura del proveedor" fluid class="text-sm" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-semibold text-surface-500">Nota</label>
            <InputText v-model="form.nota" placeholder="Opcional" fluid class="text-sm" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        <div class="rounded-xl border border-surface-200/50 dark:border-surface-700/30 bg-surface-0 dark:bg-surface-800 p-4">
          <TabView>
            <TabPanel header="Celulares (IMEI)">
              <div class="space-y-3">
                <div class="relative">
                  <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs"></i>
                  <InputText v-model="busqueda" placeholder="Buscar modelo de telefono..." fluid class="!pl-8 h-9 text-sm" />
                </div>
                <div v-if="busqueda && productosFiltrados.length > 0" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  <button
                    v-for="t in productosFiltrados" :key="t.id"
                    class="text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer"
                    :class="busqueda.trim().toUpperCase() === t.nombre ? 'bg-primary text-primary-contrast border-primary' : 'border-surface-200 dark:border-surface-600 hover:border-primary-300'"
                    @click="busqueda = t.nombre"
                  >{{ t.nombre }}</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-xs font-medium">IMEI <span class="text-red-400">*</span></label>
                    <InputText v-model="imeiData.nombre" placeholder="Numero IMEI" fluid class="text-sm" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium">Color</label>
                    <InputText v-model="imeiData.color" placeholder="Color" fluid class="text-sm" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium">Capacidad</label>
                    <InputText v-model="imeiData.capacidad" placeholder="Ej: 128GB" fluid class="text-sm" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium">Costo (RD$)</label>
                    <InputNumber v-model="imeiData.costo" :min="0" fluid class="text-sm" @focus="(e) => e.target.select()" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium">Precio Venta</label>
                    <InputNumber v-model="imeiData.precio_venta" :min="0" fluid class="text-sm" @focus="(e) => e.target.select()" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium">Precio Min</label>
                    <InputNumber v-model="imeiData.precio_min" :min="0" fluid class="text-sm" @focus="(e) => e.target.select()" />
                  </div>
                </div>
                <Button label="Agregar IMEI a la Compra" icon="pi pi-plus" class="w-full" size="small" @click="agregarImeiAlCarrito" />
              </div>
            </TabPanel>

            <TabPanel header="Accesorios">
              <div class="space-y-3">
                <div class="relative">
                  <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs"></i>
                  <InputText v-model="accSearch" placeholder="Buscar accesorio existente..." fluid class="!pl-8 h-9 text-sm" />
                </div>
                <div v-if="accSearch && accFiltrados.length > 0" class="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  <div
                    v-for="acc in accFiltrados" :key="acc.id"
                    class="flex items-center justify-between p-2 rounded-lg border border-surface-200 dark:border-surface-600 hover:border-primary-300 cursor-pointer transition-colors"
                    @click="agregarAccAlCarrito(acc)"
                  >
                    <div class="min-w-0 text-sm">
                      <p class="font-medium truncate">{{ acc.nombre }}</p>
                      <p class="text-xs text-surface-400 truncate">{{ acc.marca_nombre }} | Stock: {{ acc.cantidad || 0 }} | Costo: ${{ formatCurrency(acc.costo) }}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <InputNumber v-model="accCantidad" :min="1" class="w-16 text-xs" fluid @click.stop @focus="(e) => e.target.select()" />
                      <i class="pi pi-plus-circle text-primary text-lg cursor-pointer" @click.stop="agregarAccAlCarrito(acc)"></i>
                    </div>
                  </div>
                </div>
                <div class="border-t border-surface-200/50 dark:border-surface-700/30 pt-3">
                  <p class="text-xs font-semibold text-surface-500 mb-2">O crear nuevo accesorio:</p>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1 col-span-2">
                      <InputText v-model="accNuevo.nombre" placeholder="Nombre del nuevo accesorio" fluid class="text-sm uppercase" style="text-transform: uppercase;" />
                    </div>
                    <div class="space-y-1">
                      <InputNumber v-model="accNuevo.costo" :min="0" placeholder="Costo" fluid class="text-sm" @focus="(e) => e.target.select()" />
                    </div>
                    <div class="space-y-1">
                      <InputNumber v-model="accNuevo.precio_venta" :min="0" placeholder="Precio venta" fluid class="text-sm" @focus="(e) => e.target.select()" />
                    </div>
                    <div class="space-y-1">
                      <InputNumber v-model="accNuevo.cantidad" :min="1" placeholder="Cantidad" fluid class="text-sm" @focus="(e) => e.target.select()" />
                    </div>
                    <div class="space-y-1">
                      <Select v-model="accNuevo.marca" :options="marcas" optionLabel="nombre" optionValue="id" placeholder="Marca" fluid class="text-sm" />
                    </div>
                  </div>
                  <Button label="Agregar Nuevo Accesorio" icon="pi pi-plus" class="w-full mt-2" size="small" severity="info" @click="agregarAccNuevoAlCarrito" />
                </div>
              </div>
            </TabPanel>
          </TabView>
        </div>

        <div class="rounded-xl border border-surface-200/50 dark:border-surface-700/30 bg-surface-0 dark:bg-surface-800 flex flex-col">
          <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200/50 dark:border-surface-700/30">
            <div class="flex items-center gap-2">
              <i class="pi pi-shopping-cart text-primary text-sm"></i>
              <span class="font-bold text-sm">Carrito</span>
              <span class="text-xs text-surface-400">({{ cart.length }})</span>
            </div>
            <Button icon="pi pi-trash" severity="danger" text rounded size="small" :disabled="cart.length === 0" @click="cart = []" v-tooltip="'Limpiar'" />
          </div>
          <div v-if="cart.length === 0" class="flex flex-col items-center justify-center py-10 text-surface-300 gap-2">
            <i class="pi pi-shopping-cart text-2xl"></i>
            <span class="text-xs">Carrito vacio</span>
          </div>
          <div v-else class="flex flex-col gap-1.5 px-3 py-3 max-h-64 overflow-y-auto">
            <div v-for="(item, idx) in cart" :key="idx" class="flex items-start gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-700/30 text-xs">
              <i :class="item.tipo === 'imei' ? 'pi pi-mobile' : 'pi pi-box'" class="mt-0.5 text-primary text-xs"></i>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ item.tipo === 'imei' ? item.imei : item.nombre }}</p>
                <p v-if="item.tipo === 'imei'" class="text-[10px] text-surface-400 truncate">{{ item.telefono_nombre }} {{ item.color }} {{ item.capacidad }}</p>
                <div class="flex justify-between mt-0.5">
                  <span class="text-[10px] text-surface-400">${{ formatCurrency(item.costo) }}{{ item.cantidad ? ' x' + item.cantidad : '' }}</span>
                  <span class="font-semibold text-[10px]">${{ formatCurrency(item.tipo === 'imei' ? item.costo : (item.costo || 0) * (item.cantidad || 1)) }}</span>
                </div>
              </div>
              <button class="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0 mt-0.5" @click="quitarDelCarrito(idx)"><i class="pi pi-times text-[9px]"></i></button>
            </div>
          </div>
          <div class="mt-auto border-t border-surface-200/50 dark:border-surface-700/30 p-4 space-y-2">
            <div class="flex justify-between text-sm font-bold">
              <span>Total Compra</span>
              <span class="text-primary">${{ formatCurrency(totalCompra) }}</span>
            </div>
            <Button label="Completar Compra" icon="pi pi-check" class="w-full" :loading="cargando" :disabled="cart.length === 0" @click="completarCompra" />
          </div>
        </div>
      </div>
    </div>
    <Dialog v-model:visible="dialogNuevoProveedor" header="Nuevo Proveedor" modal :style="{ width: '28rem' }">
      <div class="flex flex-col gap-4 pt-2">
        <div class="space-y-1">
          <label class="text-sm font-medium">Nombre <span class="text-red-400">*</span></label>
          <InputText v-model="nuevoProveedor.nombre" placeholder="Nombre del proveedor" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-sm font-medium">Telefono</label>
            <InputText v-model="nuevoProveedor.telefono" placeholder="Telefono" fluid />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Email</label>
            <InputText v-model="nuevoProveedor.email" placeholder="Email" fluid />
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium">Direccion</label>
          <InputText v-model="nuevoProveedor.direccion" placeholder="Direccion" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogNuevoProveedor = false" />
        <Button label="Guardar y Seleccionar" icon="pi pi-check" @click="guardarNuevoProveedor" />
      </template>
    </Dialog>
  </div>
</template>
