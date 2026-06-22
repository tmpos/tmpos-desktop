<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Calendar from 'primevue/calendar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { encryptarPassword } from '@/funciones/funciones.js'

const props = defineProps<{ orderId?: number | null; visible: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const toast = useToast()
const isEditing = computed(() => !!props.orderId)
const guardando = ref(false)
const activeTab = ref('0')

const tecnicos = ref<{ nombre: string; porcentaje: number }[]>([])

const fallasComunes = [
  'NO ENCIENDE', 'NO CARGA', 'PANTALLA ROTA', 'BATERIA DAÑADA',
  'NO TIENE SEÑAL', 'MOJADO', 'TECLAS NO FUNCIONAN', 'AUDIO NO FUNCIONA',
  'SE REINICIA SOLO', 'CAMARA NO FUNCIONA', 'NO LEE SIM',
  'PUERTO DE CARGA DAÑADO', 'HUELLA NO FUNCIONA', 'SE CALIENTA',
]

const form = ref({
  no_orden: '', nombre: '', cedula: '', telefono: '', email: '',
  equipo: '', imei: '', serial: '', marca_modelo: '', clave: '', accesorios: '',
  fallas: '', piezas: '', tecnico: '', metodo_pago: 'EFECTIVO',
  fecha_entrada: new Date(), fecha_entrega: null as Date | null,
  estado: 'RECIBIDO', precio_pieza: 0, mano_obra: 0, abono: 0,
  pagos: '', beneficio_empresa: 0, beneficio_tecnico: 0,
  porcentaje_tecnico: 0, estado_pago_tecnico: 'PENDIENTE',
})

const totalCalculado = computed(() => (form.value.precio_pieza || 0) + (form.value.mano_obra || 0))
const pendienteCalculado = computed(() => totalCalculado.value - (form.value.abono || 0))

function formDefault() {
  return {
    no_orden: '', nombre: '', cedula: '', telefono: '', email: '',
    equipo: '', imei: '', serial: '', marca_modelo: '', clave: '', accesorios: '',
    fallas: '', piezas: '', tecnico: '', metodo_pago: 'EFECTIVO',
    fecha_entrada: new Date(), fecha_entrega: null as Date | null,
    estado: 'RECIBIDO', precio_pieza: 0, mano_obra: 0, abono: 0,
    pagos: '', beneficio_empresa: 0, beneficio_tecnico: 0,
    porcentaje_tecnico: 0, estado_pago_tecnico: 'PENDIENTE',
  }
}

async function generarNoOrden(): Promise<string> {
  try {
    const res = await window.db.getAll('ordenes_taller')
    const max = (res.data || []).reduce((maxId: number, o: any) => Math.max(maxId, o.id || 0), 0)
    return `ORD-${String(max + 1).padStart(4, '0')}`
  } catch { return '' }
}

function resetForm() {
  form.value = formDefault()
  activeTab.value = '0'
}

watch(() => props.orderId, async (newId) => {
  if (newId == null) {
    resetForm()
    form.value.no_orden = await generarNoOrden()
  }
})

watch(() => props.visible, async (v) => {
  if (v && !props.orderId) {
    resetForm()
    form.value.no_orden = await generarNoOrden()
  }
})

watch([() => form.value.precio_pieza, () => form.value.mano_obra, () => form.value.abono], () => {
  form.value.total = totalCalculado.value
  form.value.pendiente = pendienteCalculado.value
}, { deep: true })

watch(() => form.value.tecnico, (nombre) => {
  if (nombre) {
    const encontrado = tecnicos.value.find(t => t.nombre === nombre)
    if (encontrado) form.value.porcentaje_tecnico = encontrado.porcentaje
  }
})

watch(() => form.value.porcentaje_tecnico, (pct) => {
  const mano = form.value.mano_obra || 0
  form.value.beneficio_tecnico = Math.round((mano * (pct || 0) / 100) * 100) / 100
  form.value.beneficio_empresa = Math.round((mano - form.value.beneficio_tecnico) * 100) / 100
})

async function cargarDatos() {
  const [tecnicosRes, ordenRes] = await Promise.all([
    window.db.getAll('tecnicos'),
    props.orderId ? window.db.getAll('ordenes_taller') : Promise.resolve(null),
  ])
  if (tecnicosRes.success) {
    tecnicos.value = (tecnicosRes.data || []).map((t: any) => ({
      nombre: (t.nombre || '').toUpperCase(), porcentaje: t.porcentaje || 0
    })).filter(t => t.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre))
    if (!props.orderId && tecnicos.value.length > 0 && !form.value.tecnico) {
      form.value.tecnico = tecnicos.value[0].nombre
    }
  }
  if (ordenRes?.success && ordenRes.data) {
    const orden = ordenRes.data.find((o: any) => o.id === props.orderId)
    if (orden) {
      form.value = {
        no_orden: orden.no_orden || '', nombre: orden.nombre || '', cedula: orden.cedula || '',
        telefono: orden.telefono || '', email: orden.email || '', equipo: orden.equipo || '',
        imei: orden.imei || '', serial: orden.serial || '', marca_modelo: orden.marca_modelo || '',
        clave: orden.clave || '', accesorios: orden.accesorios || '', fallas: orden.fallas || '',
        piezas: orden.piezas || '', tecnico: orden.tecnico || '', metodo_pago: orden.metodo_pago || 'EFECTIVO',
        fecha_entrada: orden.fecha_entrada ? new Date(orden.fecha_entrada) : new Date(),
        fecha_entrega: orden.fecha_entrega ? new Date(orden.fecha_entrega) : null,
        estado: orden.estado || 'RECIBIDO', precio_pieza: orden.precio_pieza || 0,
        mano_obra: orden.mano_obra || 0, abono: orden.abono || 0, pagos: orden.pagos || '',
        beneficio_empresa: orden.beneficio_empresa || 0, beneficio_tecnico: orden.beneficio_tecnico || 0,
        porcentaje_tecnico: orden.porcentaje_tecnico || 0, estado_pago_tecnico: orden.estado_pago_tecnico || 'PENDIENTE',
      }
    }
  }
}

async function guardar() {
  guardando.value = true
  if (!form.value.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'El nombre del cliente es requerido', life: 3000 })
    activeTab.value = '0'
    guardando.value = false
    return
  }
  try {
    const total = totalCalculado.value
    const pendiente = pendienteCalculado.value
    const data = {
      no_orden: form.value.no_orden.trim(), nombre: form.value.nombre.trim().toUpperCase(),
      cedula: form.value.cedula.trim(), telefono: form.value.telefono.trim(), email: form.value.email.trim(),
      equipo: form.value.equipo.trim().toUpperCase(), imei: form.value.imei.trim(), serial: form.value.serial.trim(),
      marca_modelo: form.value.marca_modelo.trim().toUpperCase(), clave: form.value.clave.trim(),
      accesorios: form.value.accesorios.trim().toUpperCase(), fallas: form.value.fallas.trim().toUpperCase(),
      piezas: form.value.piezas.trim(), tecnico: form.value.tecnico.trim().toUpperCase(),
      metodo_pago: form.value.metodo_pago,
      fecha_entrada: form.value.fecha_entrada instanceof Date ? form.value.fecha_entrada.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      fecha_entrega: form.value.fecha_entrega instanceof Date ? form.value.fecha_entrega.toISOString().split('T')[0] : '',
      estado: form.value.estado, precio_pieza: form.value.precio_pieza || 0, mano_obra: form.value.mano_obra || 0,
      abono: form.value.abono || 0, pendiente, total, pagos: form.value.pagos.trim(),
      beneficio_empresa: form.value.beneficio_empresa || 0, beneficio_tecnico: form.value.beneficio_tecnico || 0,
      porcentaje_tecnico: form.value.porcentaje_tecnico || 0, estado_pago_tecnico: form.value.estado_pago_tecnico,
    }
    let res
    if (isEditing.value && props.orderId) {
      res = await window.db.update('ordenes_taller', props.orderId, data)
    } else {
      res = await window.db.insert('ordenes_taller', data)
    }
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Exito', detail: isEditing.value ? 'Orden actualizada' : 'Orden creada', life: 3000 })
      await sincronizarServidor(data)
      emit('saved')
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 })
  } finally {
    guardando.value = false
  }
}

async function sincronizarServidor(datos: any) {
  try {
    const cfgRes = await window.db.getAll('servidor_sync_config')
    const cfg = cfgRes.success && cfgRes.data?.length > 0 ? cfgRes.data[0] : null
    if (!cfg || !cfg.activo) return
    const tablasSync: string[] = cfg.tablas_sync ? JSON.parse(cfg.tablas_sync) : []
    if (!tablasSync.includes('taller') && !tablasSync.includes('ordenes_taller')) return
    const baseUrl = String(cfg.servidor_url || '').replace(/\/+$/, '') + (String(cfg.api_path || '/api2')).replace(/\/+$/, '')
    const tokenRaw = cfg.token_hash || '1234567890abc'
    const token = tokenRaw.startsWith('$2b$') ? tokenRaw : await encryptarPassword(tokenRaw, 10)
    const campos = ['id','almacen','beneficio_empresa','porcentaje_tecnico','beneficio_tecnico','pago_tecnico','nombre','cedula','direccion','telefono','whatsapp','email','equipo','marca','modelo','serial','imei','clave','accesorios','observaciones','fallas','reparacion','piezas','tecnico','metodopago','fecha_entrada','fecha_entrega','no_factura','estado','preciopiezas','manodeobra','abono','saldo','total','usuario','created_at','updated_at','identificadordb','historial_pagos','historial_orden']
    const empresaRes = await window.db.getAll('empresa')
    const nombreEmpresa = (empresaRes.success && empresaRes.data?.[0]?.nombre) || ''
    const pendiente = Number(datos.total || 0) - Number(datos.abono || 0)
    const marcaModelo = String(datos.marca_modelo || '')
    const marca = marcaModelo.split(' ')[0] || ''
    const modelo = marcaModelo.split(' ').slice(1).join(' ') || marca
    const enviar: Record<string, any> = {
      nombre: String(datos.nombre || ''), cedula: String(datos.cedula || ''), direccion: '',
      telefono: String(datos.telefono || ''), whatsapp: String(datos.telefono || ''),
      email: String(datos.email || ''), equipo: String(datos.equipo || ''), marca, modelo,
      serial: String(datos.serial || ''), imei: String(datos.imei || ''), clave: String(datos.clave || ''),
      accesorios: String(datos.accesorios || ''), observaciones: '', fallas: String(datos.fallas || ''),
      reparacion: String(datos.piezas || ''), piezas: String(datos.piezas || ''),
      tecnico: String(datos.tecnico || ''), metodopago: String(datos.metodo_pago || 'EFECTIVO'),
      fecha_entrada: String(datos.fecha_entrada || ''), fecha_entrega: String(datos.fecha_entrega || ''),
      no_factura: String(datos.no_orden || ''), estado: String(datos.estado || 'RECIBIDO'),
      preciopiezas: String(datos.precio_pieza || '0'), manodeobra: String(datos.mano_obra || '0'),
      abono: String(datos.abono || '0'), saldo: String(Math.max(0, pendiente)),
      total: String(datos.total || '0'), usuario: '', almacen: nombreEmpresa,
      beneficio_empresa: String(datos.beneficio_empresa || '0'),
      beneficio_tecnico: String(datos.beneficio_tecnico || '0'),
      porcentaje_tecnico: String(datos.porcentaje_tecnico || '0'),
      pago_tecnico: String(datos.estado_pago_tecnico || 'PENDIENTE'),
      historial_pagos: String(datos.pagos || ''), historial_orden: '',
    }
    for (const key of Object.keys(enviar)) { if (!campos.includes(key)) delete enviar[key] }
    if (Object.keys(enviar).length === 0) return
    const existeRes = await fetch(`${baseUrl}/datoscampo/taller/no_factura/${encodeURIComponent(datos.no_orden || '')}`, {
      method: 'GET', headers: { 'Accept': '*/*', 'Authorization': token },
    })
    let servidorId: string | null = null
    if (existeRes.ok) {
      try {
        const existeData = await existeRes.json()
        const existente = Array.isArray(existeData) ? existeData[0] : existeData?.data || existeData
        if (existente?.id) servidorId = String(existente.id)
      } catch {}
    }
    if (servidorId) {
      enviar.id = servidorId
      await fetch(`${baseUrl}/actualizarcampos/taller`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token },
        body: JSON.stringify(enviar),
      })
    } else {
      await fetch(`${baseUrl}/insertar/taller`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'Authorization': token },
        body: JSON.stringify(enviar),
      })
    }
  } catch {}
}

onMounted(async () => {
  await cargarDatos()
  if (!props.orderId) {
    form.value.no_orden = await generarNoOrden()
  }
})
</script>

<template>
  <Dialog
    :visible="props.visible"
    :header="isEditing ? `Editar Orden #${props.orderId}` : 'Nueva Orden de Taller'"
    modal
    :style="{ width: 'min(48rem, 95vw)' }"
    @update:visible="$emit('close')"
  >
    <Toast />
    <div class="space-y-4 pt-2">
      <div class="flex justify-end gap-2">
        <Button label="Cancelar" severity="secondary" text @click="$emit('close')" />
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" :loading="guardando" @click="guardar" />
      </div>

      <Tabs v-model:value="activeTab">
        <TabList>
          <Tab value="0"><i class="pi pi-user mr-2"></i>Cliente</Tab>
          <Tab value="1"><i class="pi pi-mobile mr-2"></i>Equipo</Tab>
          <Tab value="2"><i class="pi pi-search mr-2"></i>Diagnostico</Tab>
          <Tab value="3"><i class="pi pi-wrench mr-2"></i>Trabajo</Tab>
          <Tab value="4"><i class="pi pi-credit-card mr-2"></i>Pago</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <div class="flex flex-col gap-4 pt-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="font-semibold text-sm">No. Orden</label>
                  <InputText v-model="form.no_orden" placeholder="No. de orden" fluid readonly />
                </div>
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="font-semibold text-sm">Nombre <span class="text-red-500">*</span></label>
                  <InputText v-model="form.nombre" placeholder="Nombre del cliente" fluid class="uppercase" style="text-transform: uppercase;" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="font-semibold text-sm">Cedula</label>
                  <InputText v-model="form.cedula" placeholder="Cedula" fluid />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="font-semibold text-sm">Telefono</label>
                  <InputText v-model="form.telefono" placeholder="Telefono" fluid />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="font-semibold text-sm">Email</label>
                  <InputText v-model="form.email" placeholder="Email" fluid />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="1">
            <div class="flex flex-col gap-4 pt-3">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="font-semibold text-sm">Equipo</label>
                  <InputText v-model="form.equipo" placeholder="Tipo de equipo" fluid class="uppercase" style="text-transform: uppercase;" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="font-semibold text-sm">IMEI</label>
                  <InputText v-model="form.imei" placeholder="IMEI" fluid />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="font-semibold text-sm">Serial</label>
                  <InputText v-model="form.serial" placeholder="Serial" fluid />
                </div>
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="font-semibold text-sm">Marca / Modelo</label>
                  <InputText v-model="form.marca_modelo" placeholder="Ej: SAMSUNG A50" fluid class="uppercase" style="text-transform: uppercase;" />
                </div>
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="font-semibold text-sm">Clave / Patron</label>
                  <InputText v-model="form.clave" placeholder="Clave o patron de desbloqueo" fluid />
                </div>
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="font-semibold text-sm">Accesorios</label>
                  <InputText v-model="form.accesorios" placeholder="Accesorios recibidos" fluid class="uppercase" style="text-transform: uppercase;" />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="2">
            <div class="flex flex-col gap-4 pt-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Falla Reportada</label>
                <div class="flex flex-wrap gap-1 mb-1">
                  <Button v-for="f in fallasComunes" :key="f" :label="f" size="small" severity="secondary" text class="!text-xs !py-1 !px-2" @click="form.fallas = form.fallas ? form.fallas + '\n' + f : f" />
                </div>
                <Textarea v-model="form.fallas" rows="3" placeholder="Describe la falla reportada por el cliente" fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Piezas a Utilizar</label>
                <Textarea v-model="form.piezas" rows="2" placeholder="Piezas o repuestos necesarios" fluid />
              </div>
            </div>
          </TabPanel>

          <TabPanel value="3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Tecnico</label>
                <div class="flex gap-2">
                  <Select v-model="form.tecnico" :options="tecnicos.map(t => t.nombre)" placeholder="Seleccionar tecnico" fluid class="uppercase" />
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Fecha Entrada</label>
                <Calendar v-model="form.fecha_entrada" dateFormat="dd/mm/yy" fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Fecha Entrega</label>
                <Calendar v-model="form.fecha_entrega" dateFormat="dd/mm/yy" fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Estado</label>
                <Select v-model="form.estado" :options="['RECIBIDO', 'EN_PROCESO', 'REPARADO', 'ENTREGADO', 'PARCIAL', 'CANCELADO']" fluid />
              </div>
            </div>
          </TabPanel>

          <TabPanel value="4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Total Piezas</label>
                <InputNumber v-model="form.precio_pieza" :min="0" fluid @focus="(e: any) => e.target.select()" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Mano de Obra</label>
                <InputNumber v-model="form.mano_obra" :min="0" fluid @focus="(e: any) => e.target.select()" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Total</label>
                <InputNumber :value="totalCalculado" disabled fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Abono</label>
                <InputNumber v-model="form.abono" :min="0" fluid @focus="(e: any) => e.target.select()" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Pendiente</label>
                <InputNumber :value="pendienteCalculado" disabled fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Metodo Pago</label>
                <Select v-model="form.metodo_pago" :options="['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'CREDITO']" fluid />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">% Tecnico</label>
                <InputNumber v-model="form.porcentaje_tecnico" suffix=" %" fluid disabled />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Beneficio Tecnico</label>
                <InputNumber v-model="form.beneficio_tecnico" fluid disabled />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Beneficio Empresa</label>
                <InputNumber v-model="form.beneficio_empresa" fluid disabled />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-sm">Estado Pago Tecnico</label>
                <Select v-model="form.estado_pago_tecnico" :options="['PENDIENTE', 'PAGADO']" fluid />
              </div>
              <div class="flex flex-col gap-1 md:col-span-2">
                <label class="font-semibold text-sm">Notas de Pago</label>
                <Textarea v-model="form.pagos" placeholder="Notas sobre pagos realizados" rows="2" fluid />
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <div class="flex justify-between gap-2 pt-4 border-t border-surface-200 dark:border-surface-700">
        <Button icon="pi pi-chevron-left" label="Anterior" severity="secondary" outlined :disabled="activeTab === '0'" @click="activeTab = String(Number(activeTab) - 1)" />
        <div class="flex gap-2">
          <Button v-if="activeTab !== '4'" label="Siguiente" icon="pi pi-chevron-right" iconPos="right" severity="secondary" outlined @click="activeTab = String(Number(activeTab) + 1)" />
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button label="Cancelar" severity="secondary" text @click="$emit('close')" />
        <Button :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" :loading="guardando" @click="guardar" />
      </div>
    </div>
  </Dialog>
</template>
