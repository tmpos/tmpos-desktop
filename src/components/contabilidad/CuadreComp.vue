<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Cuadres de Caja</h1>
        <p class="text-sm text-surface-500">Historial de cuadres realizados</p>
      </div>
      <button @click="abrirNuevoCuadre" class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90" :style="{ background: 'var(--p-primary-500)' }">
        <i class="pi pi-plus"></i>Nuevo Cuadre
      </button>
    </div>

    <div v-if="loading" class="text-center py-16 text-surface-500"><i class="pi pi-spin pi-spinner text-2xl mb-2 block"></i>Cargando...</div>

    <template v-else>
      <DataTable :value="cuadres" stripedRows paginator :rows="10" dataKey="id" sortField="created_at" :sortOrder="-1">
        <Column field="fecha" header="Fecha" sortable style="width:7rem" />
        <Column field="turno_usuario" header="Cajero" sortable />
        <Column header="Ventas" style="width:7rem">
          <template #body="{ data }">${{ formatCurrency(data.total_ventas) }}</template>
        </Column>
        <Column header="Efectivo" style="width:7rem">
          <template #body="{ data }">${{ formatCurrency(data.efectivo) }}</template>
        </Column>
        <Column header="Tarjeta" style="width:7rem">
          <template #body="{ data }">${{ formatCurrency(data.tarjeta) }}</template>
        </Column>
        <Column header="Transferencia" style="width:7rem">
          <template #body="{ data }">${{ formatCurrency(data.transferencia) }}</template>
        </Column>
        <Column header="Gastos" style="width:7rem">
          <template #body="{ data }">${{ formatCurrency(data.total_gastos) }}</template>
        </Column>
        <Column header="Saldo Final" style="width:7rem">
          <template #body="{ data }"><span class="font-bold text-green-600">${{ formatCurrency(data.saldo_final || data.total_ventas - data.total_gastos) }}</span></template>
        </Column>
        <Column field="monto_inicial" header="Monto Inicial" style="width:6rem">
          <template #body="{ data }">${{ formatCurrency(data.monto_inicial) }}</template>
        </Column>
        <Column field="observacion" header="Nota" style="width:10rem" />
        <Column header="Acciones" style="width:10rem">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-print" severity="secondary" text rounded size="small" :loading="accionandoId === data.id" :disabled="accionandoId !== null" v-tooltip.left="'Reimprimir'" @click="reimprimirCuadre(data)" />
              <Button icon="pi pi-envelope" severity="secondary" text rounded size="small" :loading="accionandoId === data.id" :disabled="accionandoId !== null" v-tooltip.left="'Enviar al correo'" @click="enviarCuadreCorreo(data)" />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="text-center py-10 text-surface-400">No hay cuadres registrados.</div>
        </template>
      </DataTable>
    </template>

    <Dialog v-model:visible="dialogVisible" header="Nuevo Cuadre de Caja" modal :style="{ width: 'min(36rem, 95vw)' }" :draggable="false">
      <div v-if="!turnoActivo" class="text-center py-8 text-amber-500 text-sm">
        <i class="pi pi-exclamation-triangle text-2xl block mb-2"></i>
        No hay un turno de caja abierto. Abre un turno en Contabilidad &gt; Caja primero.
      </div>
      <div v-else class="space-y-4 pt-2">
        <div class="grid grid-cols-2 gap-3 text-sm p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
          <div><span class="text-surface-400">Turno:</span> #{{ turnoActivo.id }}</div>
          <div><span class="text-surface-400">Cajero:</span> {{ turnoActivo.usuario_nombre }}</div>
          <div><span class="text-surface-400">Inicio:</span> {{ new Date(turnoActivo.created_at).toLocaleString('es-DO') }}</div>
          <div><span class="text-surface-400">Monto inicial:</span> <strong>${{ formatCurrency(turnoActivo.monto_inicial || 0) }}</strong></div>
        </div>
        <div v-if="resumenCargando" class="text-center text-sm text-surface-400 py-4"><i class="pi pi-spin pi-spinner mr-2"></i>Calculando resumen...</div>
        <div v-else class="grid grid-cols-2 gap-3 text-sm">
          <div class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p class="text-xs text-green-600">Ventas del turno</p>
            <p class="text-lg font-bold text-green-700">${{ formatCurrency(resumenVentas.total) }}</p>
            <p class="text-xs text-green-500">Efectivo: ${{ formatCurrency(resumenVentas.efectivo) }} | Tarjeta: ${{ formatCurrency(resumenVentas.tarjeta) }} | Transf: ${{ formatCurrency(resumenVentas.transferencia) }}</p>
          </div>
          <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p class="text-xs text-red-600">Gastos del turno</p>
            <p class="text-lg font-bold text-red-700">${{ formatCurrency(resumenGastos) }}</p>
          </div>
        </div>
        <div class="border-t border-surface-200 dark:border-surface-700 pt-3">
          <div class="flex justify-between text-base font-bold">
            <span>Saldo final estimado</span>
            <span class="text-green-600">${{ formatCurrency(resumenVentas.total - resumenGastos + (turnoActivo.monto_inicial || 0)) }}</span>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold mb-1 block">Observacion</label>
          <InputText v-model="observacion" placeholder="Notas del cuadre" fluid />
        </div>
        <p v-if="error" class="text-red-500 text-xs">{{ error }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogVisible = false" />
        <Button label="Realizar Cuadre" icon="pi pi-check-circle" :loading="guardando" :disabled="!turnoActivo" @click="realizarCuadre" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const loading = ref(true)
const cuadres = ref<any[]>([])
const dialogVisible = ref(false)
const guardando = ref(false)
const error = ref('')
const observacion = ref('')
const turnoActivo = ref<any>(null)
const resumenCargando = ref(false)
const resumenVentas = ref({ total: 0, efectivo: 0, tarjeta: 0, transferencia: 0 })
const resumenGastos = ref(0)
const accionandoId = ref<number | null>(null)

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function cargar() {
  loading.value = true
  try {
    const res = await (window as any).electron.invoke('cuadre:listar')
    if (res.success) cuadres.value = res.data || []
  } catch {} finally { loading.value = false }
}

async function abrirNuevoCuadre() {
  error.value = ''
  observacion.value = ''
  resumenVentas.value = { total: 0, efectivo: 0, tarjeta: 0, transferencia: 0 }
  resumenGastos.value = 0
  resumenCargando.value = true
  dialogVisible.value = true
  try {
    const [resTurno, resVentas, resGastos] = await Promise.all([
      (window as any).electron.invoke('caja:getTurnoActivo'),
      (window as any).electron.invoke('cuadre:ventasTurno'),
      (window as any).electron.invoke('cuadre:gastosTurno'),
    ])
    if (resTurno.success) turnoActivo.value = resTurno.data
    else turnoActivo.value = null
    if (resVentas.success) resumenVentas.value = resVentas.data
    if (resGastos.success) resumenGastos.value = resGastos.data?.total || 0
  } catch { turnoActivo.value = null }
  finally { resumenCargando.value = false }
}

async function realizarCuadre() {
  if (!turnoActivo.value) { error.value = 'No hay turno activo'; return }
  guardando.value = true; error.value = ''
  try {
    const res = await (window as any).electron.invoke('cuadre:realizar', {
      turno_id: turnoActivo.value.id,
      turno_usuario: turnoActivo.value.usuario_nombre || '',
      monto_inicial: turnoActivo.value.monto_inicial || 0,
      total_ventas: resumenVentas.value.total,
      efectivo: resumenVentas.value.efectivo,
      tarjeta: resumenVentas.value.tarjeta,
      transferencia: resumenVentas.value.transferencia,
      total_gastos: resumenGastos.value,
      saldo_final: resumenVentas.value.total - resumenGastos.value + (turnoActivo.value.monto_inicial || 0),
      observacion: observacion.value,
    })
    if (!res.success) throw new Error(res.error)
    dialogVisible.value = false
    toast.add({ severity: 'success', summary: 'Cuadre realizado', detail: 'Cuadre de caja guardado exitosamente', life: 3000 })
    await cargar()
  } catch (e: any) { error.value = e.message || 'Error al realizar cuadre' }
  finally { guardando.value = false }
}

function escapeHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function moneyHtml(n: number): string {
  return `RD$${Number(n || 0).toFixed(2)}`
}

function dateHtml(d: any): string {
  if (!d) return '-'
  const date = new Date(String(d).replace(' ', 'T'))
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function reimprimirCuadre(cuadre: any) {
  accionandoId.value = cuadre.id
  try {
    const [empresaRes, impresoraRes] = await Promise.all([
      window.db.getAll('empresa'),
      window.db.getAll('impresoras_config'),
    ])
    const empresa = empresaRes.success ? empresaRes.data?.[0] || {} : {}
    const impresora = impresoraRes.success ? impresoraRes.data?.[0] || {} : {}

    const ticket = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page{size:80mm auto;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;width:76mm;margin:0;padding:3mm;color:#111;font-size:10px}
    h1{font-size:17px;margin:0;text-align:center}h2{font-size:12px;margin:10px 0 4px;padding-bottom:3px;border-bottom:1px dashed #555}
    .center{text-align:center}.muted{color:#555}.row{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
    .total{font-size:14px;font-weight:700;border-top:2px solid #111;border-bottom:2px solid #111;margin-top:4px;padding:6px 0}
    .footer{text-align:center;margin-top:12px;border-top:1px dashed #555;padding-top:8px;font-size:9px}
  </style></head><body>
    <h1>${escapeHtml(empresa.nombre || empresa.legal || 'TMPOS SRL')}</h1>
    <div class="center muted">${escapeHtml(empresa.legal || '')}</div>
    <h2>CUADRE DE CAJA</h2>
    <div class="row"><span>Cuadre</span><strong>#${escapeHtml(cuadre.id)}</strong></div>
    <div class="row"><span>Cajero</span><strong>${escapeHtml(cuadre.turno_usuario || '')}</strong></div>
    <div class="row"><span>Fecha</span><span>${dateHtml(cuadre.created_at)}</span></div>
    <h2>RESUMEN</h2>
    <div class="row"><span>Fondo inicial</span><span>${moneyHtml(cuadre.monto_inicial)}</span></div>
    <div class="row"><span>Ventas</span><span>${moneyHtml(cuadre.total_ventas)}</span></div>
    <div class="row"><span>Efectivo</span><span>${moneyHtml(cuadre.efectivo)}</span></div>
    <div class="row"><span>Tarjeta</span><span>${moneyHtml(cuadre.tarjeta)}</span></div>
    <div class="row"><span>Transferencia</span><span>${moneyHtml(cuadre.transferencia)}</span></div>
    <div class="row"><span>Gastos</span><span>-${moneyHtml(cuadre.total_gastos)}</span></div>
    <div class="row total"><span>SALDO FINAL</span><span>${moneyHtml(cuadre.saldo_final)}</span></div>
    ${cuadre.observacion ? `<h2>OBSERVACION</h2><div>${escapeHtml(cuadre.observacion)}</div>` : ''}
    <div class="footer">Documento generado por TMPOS SRL</div>
  </body></html>`

    const res = await (window as any).electron.invoke('print:ticket', ticket, impresora.printer_name || undefined)
    if (res?.success) {
      toast.add({ severity: 'success', summary: 'Impreso', detail: 'Ticket enviado a la impresora', life: 3000 })
    } else {
      toast.add({ severity: 'warn', summary: 'Atencion', detail: res?.error || 'No se pudo imprimir', life: 5000 })
    }
  } finally {
    accionandoId.value = null
  }
}

async function enviarCuadreCorreo(cuadre: any) {
  accionandoId.value = cuadre.id
  try {
    const [empresaRes] = await Promise.all([
      window.db.getAll('empresa'),
    ])
    const empresa = empresaRes.success ? empresaRes.data?.[0] || {} : {}
    const empresaNombre = escapeHtml(empresa.nombre || empresa.legal || 'TMPOS SRL')

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
    <div style="max-width:760px;margin:0 auto;padding:24px">
      <div style="background:#064e3b;color:#fff;padding:28px;border-radius:14px 14px 0 0">
        <div style="font-size:13px;opacity:.8;letter-spacing:1px">REPORTE OFICIAL</div>
        <h1 style="margin:6px 0 4px;font-size:28px">Cuadre de caja #${escapeHtml(cuadre.id)}</h1>
        <div>${empresaNombre}</div>
      </div>
      <div style="background:#fff;padding:26px;border-radius:0 0 14px 14px;box-shadow:0 8px 25px rgba(0,0,0,.08)">
        <table style="width:100%;margin-bottom:20px"><tr>
          <td><div style="color:#6b7280;font-size:12px">CAJERO</div><strong>${escapeHtml(cuadre.turno_usuario || '')}</strong></td>
          <td><div style="color:#6b7280;font-size:12px">FECHA</div><strong>${dateHtml(cuadre.created_at)}</strong></td>
        </tr></table>
        <table style="width:100%;border-spacing:8px"><tr>
          <td style="background:#ecfdf5;padding:16px;border-radius:10px"><div style="font-size:12px;color:#047857">VENTAS</div><strong style="font-size:20px">${moneyHtml(cuadre.total_ventas)}</strong></div></td>
          <td style="background:#eff6ff;padding:16px;border-radius:10px"><div style="font-size:12px;color:#1d4ed8">SALDO FINAL</div><strong style="font-size:20px">${moneyHtml(cuadre.saldo_final)}</strong></td>
        </tr></table>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:7px">Fondo inicial</td><td style="text-align:right">${moneyHtml(cuadre.monto_inicial)}</td></tr>
          <tr><td style="padding:7px">Ventas efectivo</td><td style="text-align:right">${moneyHtml(cuadre.efectivo)}</td></tr>
          <tr><td style="padding:7px">Tarjeta</td><td style="text-align:right">${moneyHtml(cuadre.tarjeta)}</td></tr>
          <tr><td style="padding:7px">Transferencia</td><td style="text-align:right">${moneyHtml(cuadre.transferencia)}</td></tr>
          <tr><td style="padding:7px">Gastos</td><td style="text-align:right;color:#b91c1c">-${moneyHtml(cuadre.total_gastos)}</td></tr>
          <tr><td style="padding:7px;font-weight:bold;border-top:2px solid #111">Saldo final</td><td style="text-align:right;font-weight:bold;border-top:2px solid #111">${moneyHtml(cuadre.saldo_final)}</td></tr>
        </table>
        ${cuadre.observacion ? `<div style="margin-top:20px;padding:14px;background:#fffbeb;border-left:4px solid #f59e0b"><strong>Observacion:</strong> ${escapeHtml(cuadre.observacion)}</div>` : ''}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">Reporte generado automaticamente por TMPOS SRL.</div>
      </div>
    </div>
  </body></html>`

    const res = await (window as any).electron.invoke('enviar:cierreCaja', {
      subject: `Cuadre de caja #${cuadre.id} - ${empresaNombre}`,
      html: emailHtml,
    })
    if (res?.success) {
      toast.add({ severity: 'success', summary: 'Enviado', detail: `Reporte enviado a ${res.toEmail || 'la empresa'}`, life: 4000 })
    } else {
      toast.add({ severity: 'warn', summary: 'Atencion', detail: res?.error || 'No se pudo enviar el correo', life: 5000 })
    }
  } finally {
    accionandoId.value = null
  }
}

onMounted(cargar)
</script>
