<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Calendar from 'primevue/calendar'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { useAuthStore } from '@/stores/auth.store'

const toast = useToast()
const auth = useAuthStore()
const loading = ref(false)
const generandoPdf = ref(false)
const dialogPdf = ref(false)
const pdfUrl = ref('')
const pdfNombre = ref('')
const ordenes = ref<any[]>([])
const periodo = ref('mes')
const fechaDesde = ref<Date | null>(null)
const fechaHasta = ref<Date | null>(null)
const tecnicoFiltro = ref('')

const resumen = ref({
  total: 0,
  pendientes: 0,
  enProgreso: 0,
  completadas: 0,
  ingresos: 0,
  ganancia: 0,
  costoPiezas: 0,
})

const tecnicos = ref<string[]>([])

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildReporteTallerHtml(emp: any, fechaActual: string, fmtNum: (n: number) => string): string {
  const empNombre = emp.nombre || 'MI EMPRESA'
  const empRnc = emp.legal || ''
  const empTel = emp.telefono || ''
  const empDir = emp.direccion || ''
  const periodoTexto = periodo.value === 'mes'
    ? 'Este mes'
    : periodo.value === 'rango' && fechaDesde.value && fechaHasta.value
      ? `${fechaDesde.value.toLocaleDateString('es-DO')} - ${fechaHasta.value.toLocaleDateString('es-DO')}`
      : 'Todos los registros'

  const estadosHtml = ordenesPorEstado.value.map(e =>
    `<tr><td>${escapeHtml(e.estado)}</td><td class="right"><strong>${e.cantidad}</strong></td></tr>`
  ).join('')

  const ordenesHtml = ordenesFiltradas.value.map((o, index) =>
    `<tr>
      <td>${index + 1}</td>
      <td class="mono">${escapeHtml(o.no_orden || '-')}</td>
      <td><strong>${escapeHtml(o.nombre || '-')}</strong><span>${escapeHtml(o.telefono || '')}</span></td>
      <td>${escapeHtml(o.equipo || '-')}</td>
      <td>${escapeHtml(o.tecnico || '-')}</td>
      <td class="money">RD$ ${fmtNum(o.precio_pieza || 0)}</td>
      <td class="money">RD$ ${fmtNum(o.total || 0)}</td>
      <td><span class="status">${escapeHtml(o.estado || '-')}</span></td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reporte de Taller</title>
  <style>
    @page { margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10.5px; background: #fff; }
    .topbar { height: 8px; background: #0f766e; margin-bottom: 18px; }
    .header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 18px; }
    .brand h1 { margin: 0 0 4px; font-size: 22px; color: #111827; }
    .brand .meta { color: #6b7280; line-height: 1.45; }
    .docbox { min-width: 180px; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
    .docbox .title { background: #0f766e; color: #fff; padding: 8px 10px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
    .docbox .line { padding: 7px 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; gap: 12px; }
    .docbox .line span:first-child { color: #6b7280; }
    .section { margin: 16px 0 8px; font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; border-bottom: 2px solid #0f766e; padding-bottom: 5px; }
    .cards { width: 100%; border-collapse: separate; border-spacing: 8px; margin: 0 -8px 10px; }
    .card { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; background: #f9fafb; }
    .card .label { color: #6b7280; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
    .card .value { font-size: 18px; font-weight: 700; color: #111827; }
    .card.green { background: #ecfdf5; border-color: #a7f3d0; }
    .card.green .value { color: #047857; }
    .card.amber { background: #fffbeb; border-color: #fde68a; }
    .card.amber .value { color: #b45309; }
    .card.blue { background: #eff6ff; border-color: #bfdbfe; }
    .card.blue .value { color: #1d4ed8; }
    table.data { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    table.data th { background: #111827; color: #fff; text-align: left; padding: 7px 8px; font-size: 9px; text-transform: uppercase; }
    table.data td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    table.data tbody tr:nth-child(even) td { background: #f9fafb; }
    td span { display: block; color: #6b7280; font-size: 9px; margin-top: 2px; }
    .money, .right { text-align: right; white-space: nowrap; }
    .mono { font-family: Consolas, Monaco, monospace; }
    .status { display: inline-block; padding: 3px 7px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 8.5px; font-weight: 700; text-transform: uppercase; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; color: #6b7280; font-size: 9px; }
  </style>
</head>
<body>
  <div class="topbar"></div>
  <div class="header">
    <div class="brand">
      <h1>${escapeHtml(empNombre)}</h1>
      <div class="meta">
        ${empRnc ? `RNC: ${escapeHtml(empRnc)}<br>` : ''}
        ${empTel ? `Tel: ${escapeHtml(empTel)}<br>` : ''}
        ${empDir ? `${escapeHtml(empDir)}<br>` : ''}
      </div>
    </div>
    <div class="docbox">
      <div class="title">Reporte de Taller</div>
      <div class="line"><span>Fecha</span><strong>${fechaActual}</strong></div>
      <div class="line"><span>Periodo</span><strong>${escapeHtml(periodoTexto)}</strong></div>
      <div class="line"><span>Usuario</span><strong>${escapeHtml(auth.user?.nombre || '-')}</strong></div>
    </div>
  </div>

  <div class="section">Resumen operativo</div>
  <table class="cards"><tr>
    <td class="card"><div class="label">Ordenes</div><div class="value">${resumen.value.total}</div></td>
    <td class="card amber"><div class="label">Pendientes</div><div class="value">${resumen.value.pendientes}</div></td>
    <td class="card blue"><div class="label">En proceso</div><div class="value">${resumen.value.enProgreso}</div></td>
    <td class="card green"><div class="label">Completadas</div><div class="value">${resumen.value.completadas}</div></td>
  </tr></table>

  <div class="section">Resumen financiero</div>
  <table class="cards"><tr>
    <td class="card"><div class="label">Ingresos</div><div class="value">RD$ ${fmtNum(resumen.value.ingresos)}</div></td>
    <td class="card"><div class="label">Costo piezas</div><div class="value">RD$ ${fmtNum(resumen.value.costoPiezas)}</div></td>
    <td class="card green"><div class="label">Ganancia</div><div class="value">RD$ ${fmtNum(resumen.value.ganancia)}</div></td>
  </tr></table>

  <div class="section">Ordenes por estado</div>
  <table class="data" style="width:55%">
    <thead><tr><th>Estado</th><th class="right">Cantidad</th></tr></thead>
    <tbody>${estadosHtml || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
  </table>

  <div class="section">Detalle de ordenes (${ordenesFiltradas.value.length})</div>
  <table class="data">
    <thead><tr><th>#</th><th>Orden</th><th>Cliente</th><th>Equipo</th><th>Tecnico</th><th class="money">Piezas</th><th class="money">Total</th><th>Estado</th></tr></thead>
    <tbody>${ordenesHtml || '<tr><td colspan="8">Sin ordenes para mostrar</td></tr>'}</tbody>
  </table>

  <div class="footer"><span>MrCuttiTechnology</span><span>Generado el ${fechaActual}</span></div>
</body>
</html>`
}

async function abrirPdfEmbebido(url: string, nombre: string) {
  pdfUrl.value = url
  pdfNombre.value = nombre

  if (window.Swal?.fire) {
    const result = await window.Swal.fire({
      title: 'Vista Previa - Reporte de Taller',
      html: `<iframe src="${url}" style="width:100%;height:75vh;border:0;border-radius:6px;background:#fff"></iframe>`,
      width: '90vw',
      padding: '1rem',
      showCancelButton: true,
      confirmButtonText: 'Descargar PDF',
      cancelButtonText: 'Cerrar',
      focusConfirm: false,
      customClass: {
        popup: 'swal-pdf-popup',
      },
    })

    if (result.isConfirmed) {
      await descargarPDF()
    }
    cerrarPdf()
    return
  }

  dialogPdf.value = true
}

const ordenesFiltradas = computed(() => {
  let data = ordenes.value
  if (tecnicoFiltro.value) {
    data = data.filter(o => o.tecnico === tecnicoFiltro.value)
  }
  return data
})

const ordenesPorEstado = computed(() => {
  const grouped: Record<string, number> = {}
  for (const o of ordenesFiltradas.value) {
    const est = o.estado || 'SIN ESTADO'
    grouped[est] = (grouped[est] || 0) + 1
  }
  return Object.entries(grouped).map(([estado, cantidad]) => ({ estado, cantidad }))
})

function getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
  switch (estado) {
    case 'COMPLETADO': return 'success'
    case 'ENTREGADO': return 'success'
    case 'EN PROCESO': return 'info'
    case 'RECIBIDO': return 'warn'
    case 'CANCELADO': return 'danger'
    case 'PENDIENTE': return 'warn'
    default: return 'info'
  }
}

async function cargarDatos() {
  loading.value = true
  try {
    const res = await window.db.getAll('ordenes_taller')
    if (res.success) {
      ordenes.value = (res.data || []).filter((o: any) => {
        if (periodo.value === 'mes') {
          const ahora = new Date()
          const mes = String(ahora.getMonth() + 1).padStart(2, '0')
          const year = ahora.getFullYear()
          return o.fecha_entrada?.startsWith(`${year}-${mes}`)
        }
        if (periodo.value === 'rango' && fechaDesde.value && fechaHasta.value) {
          const desde = fechaDesde.value.toISOString().split('T')[0]
          const hasta = fechaHasta.value.toISOString().split('T')[0]
          return o.fecha_entrada && o.fecha_entrada >= desde && o.fecha_entrada <= hasta
        }
        return true
      })

      const t = new Set(res.data?.map((o: any) => o.tecnico).filter(Boolean) || [])
      tecnicos.value = Array.from(t) as string[]

      const all = ordenes.value
      const pendientes = all.filter(o => o.estado === 'RECIBIDO' || o.estado === 'PENDIENTE')
      const enProgreso = all.filter(o => o.estado === 'EN PROCESO')
      const completadas = all.filter(o => o.estado === 'COMPLETADO' || o.estado === 'ENTREGADO')

      resumen.value = {
        total: all.length,
        pendientes: pendientes.length,
        enProgreso: enProgreso.length,
        completadas: completadas.length,
        ingresos: all.reduce((s, o) => s + (o.total || 0), 0),
        ganancia: completadas.reduce((s, o) => s + (o.beneficio_empresa || 0), 0),
        costoPiezas: all.reduce((s, o) => s + (o.precio_pieza || 0), 0),
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function generarPDF() {
  generandoPdf.value = true
  try {
    const resEmp = await window.db.getAll('empresa')
    const emp = resEmp.success && resEmp.data?.length > 0 ? resEmp.data[0] : {}
    const empNombre = emp.nombre || 'MI EMPRESA'
    const empRnc = emp.legal || ''
    const empTel = emp.telefono || ''
    const empDir = emp.direccion || ''
    const fechaActual = new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
    const fmtNum = (n: number) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const itemsHtml = ordenesFiltradas.value.map(o =>
      `<tr><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px">${o.no_orden || '—'}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px">${(o.nombre || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px">${(o.equipo || '—').replace(/&/g,'&amp;')}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px">${o.tecnico || '—'}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px;text-align:right">RD$ ${fmtNum(o.total || 0)}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px;text-align:center">${o.estado || '—'}</td></tr>`
    ).join('')

    const estHtml = ordenesPorEstado.value.map(e =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:10px">${e.estado}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:10px;font-weight:bold;text-align:center">${e.cantidad}</td></tr>`
    ).join('')

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Taller</title><style>@page{margin:12mm}body{font-family:Arial,sans-serif;color:#333;font-size:11px}.hdr{text-align:center;border-bottom:3px solid #0d6efd;padding-bottom:12px;margin-bottom:20px}.hdr h1{margin:0;font-size:22px;color:#0d6efd}.hdr p{margin:3px 0 0;font-size:11px;color:#666}table{width:100%;border-collapse:collapse;margin-bottom:15px}th{background:#0d6efd;color:#fff;padding:5px 7px;font-size:10px;text-align:left}td{padding:4px 6px;font-size:10px;border-bottom:1px solid #ddd}.sec{font-size:13px;font-weight:bold;color:#0d6efd;margin:18px 0 8px;border-bottom:2px solid #0d6efd;padding-bottom:3px}.ftr{text-align:center;margin-top:25px;padding-top:12px;border-top:1px solid #ddd;font-size:9px;color:#999}</style></head><body>'
      + '<div class="hdr"><div style="font-size:15px;font-weight:bold">' + empNombre.replace(/&/g,'&amp;') + '</div>'
      + (empRnc ? '<p>RNC: ' + empRnc + '</p>' : '')
      + (empTel ? '<p>Tel: ' + empTel + '</p>' : '')
      + (empDir ? '<p>' + empDir.replace(/&/g,'&amp;') + '</p>' : '')
      + '<h1>Reporte de Taller</h1><p>Generado: ' + fechaActual + '</p>'
      + (auth.user?.nombre ? '<p>Usuario: ' + auth.user.nombre + '</p>' : '')
      + '</div>'
      + '<div class="sec">Resumen General</div>'
      + '<table><tr>'
      + '<td style="background:#f8f9fa;border:1px solid #dee2e6;text-align:center;padding:8px 10px"><div style="font-size:10px;color:#666">Total</div><div style="font-size:18px;font-weight:bold">' + resumen.value.total + '</div></td>'
      + '<td style="background:#fff3cd;border:1px solid #dee2e6;text-align:center;padding:8px 10px"><div style="font-size:10px;color:#666">Pendientes</div><div style="font-size:18px;font-weight:bold;color:#856404">' + resumen.value.pendientes + '</div></td>'
      + '<td style="background:#cce5ff;border:1px solid #dee2e6;text-align:center;padding:8px 10px"><div style="font-size:10px;color:#666">En Proceso</div><div style="font-size:18px;font-weight:bold;color:#004085">' + resumen.value.enProgreso + '</div></td>'
      + '<td style="background:#d4edda;border:1px solid #dee2e6;text-align:center;padding:8px 10px"><div style="font-size:10px;color:#666">Completadas</div><div style="font-size:18px;font-weight:bold;color:#155724">' + resumen.value.completadas + '</div></td>'
      + '</tr></table>'
      + '<table><tr>'
      + '<td style="padding:10px 14px;background:#f8f9fa;border:1px solid #dee2e6"><div style="font-size:10px;color:#666">Ingresos</div><div style="font-size:20px;font-weight:bold">RD$ ' + fmtNum(resumen.value.ingresos) + '</div></td>'
      + '<td style="padding:10px 14px;background:#f8f9fa;border:1px solid #dee2e6"><div style="font-size:10px;color:#666">Costo Piezas</div><div style="font-size:20px;font-weight:bold">RD$ ' + fmtNum(resumen.value.costoPiezas) + '</div></td>'
      + '<td style="padding:10px 14px;background:#d4edda;border:1px solid #c3e6cb"><div style="font-size:10px;color:#666">Ganancia</div><div style="font-size:24px;font-weight:bold;color:#155724">RD$ ' + fmtNum(resumen.value.ganancia) + '</div></td>'
      + '</tr></table>'
      + '<div class="sec">Ordenes por Estado</div>'
      + '<table style="width:50%;margin:0 auto"><thead><tr><th style="text-align:left">Estado</th><th style="text-align:center">Cantidad</th></tr></thead><tbody>' + estHtml + '</tbody></table>'
      + '<div class="sec">Detalle de Ordenes (' + ordenesFiltradas.value.length + ')</div>'
      + '<table><thead><tr><th style="width:8%">No.</th><th style="width:22%">Cliente</th><th style="width:18%">Equipo</th><th style="width:14%">Tecnico</th><th style="width:14%;text-align:right">Total</th><th style="width:14%;text-align:center">Estado</th></tr></thead><tbody>' + itemsHtml + '</tbody></table>'
      + '<div class="ftr">MrCuttiTechnology — ' + fechaActual + '</div>'
      + '</body></html>'

    const nombrePdf = 'Reporte_Taller_' + new Date().toISOString().split('T')[0] + '.pdf'
    const htmlProfesional = buildReporteTallerHtml(emp, fechaActual, fmtNum)
    toast.add({ severity: 'info', summary: 'Generando PDF', detail: 'Espere un momento...', life: 2000 })
    const res = await window.electron.invoke('generate:pdf', htmlProfesional, nombrePdf) as { success: boolean; dataUrl?: string; error?: string }
    if (res.success && res.dataUrl) {
      const resp = await fetch(res.dataUrl)
      const blob = await resp.blob()
      await abrirPdfEmbebido(URL.createObjectURL(blob), nombrePdf)
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo generar el PDF', life: 3000 })
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  } finally {
    generandoPdf.value = false
  }
}

function cerrarPdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''
  dialogPdf.value = false
}

async function descargarPDF() {
  if (!pdfUrl.value) return
  try {
    const response = await fetch(pdfUrl.value)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    const dataUrl = `data:application/pdf;base64,${base64}`
    const res = await window.electron.invoke('save:pdf', dataUrl, pdfNombre.value) as { success: boolean; error?: string }
    if (res.success) {
      toast.add({ severity: 'success', summary: 'Guardado', detail: 'PDF descargado', life: 2000 })
    }
  } catch (_) {}
}

watch(periodo, (val) => {
  if (val !== 'rango') cargarDatos()
})

onMounted(cargarDatos)
</script>

<template>
  <div>
    <Toast />

    <div class="space-y-5">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <i class="pi pi-file-export text-primary text-lg"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold">Reporte de Taller</h2>
            <p class="text-sm text-surface-500">Estadisticas y resumen del taller</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Select v-model="periodo" :options="[{ label: 'Este Mes', value: 'mes' }, { label: 'Rango', value: 'rango' }, { label: 'Todos', value: 'todo' }]" optionLabel="label" optionValue="value" class="w-28" fluid />
          <Calendar v-if="periodo === 'rango'" v-model="fechaDesde" placeholder="Desde" dateFormat="dd/mm/yy" fluid showIcon />
          <Calendar v-if="periodo === 'rango'" v-model="fechaHasta" placeholder="Hasta" dateFormat="dd/mm/yy" fluid showIcon />
          <Button label="PDF" icon="pi pi-file-pdf" severity="danger" :loading="generandoPdf" @click="generarPDF" />
          <Button icon="pi pi-refresh" severity="secondary" @click="cargarDatos" />
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16 text-surface-400 gap-3">
        <i class="pi pi-spin pi-spinner text-2xl"></i>
        <span>Cargando...</span>
      </div>

      <div v-else class="space-y-5">
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <span class="text-xs text-surface-400">Ordenes</span>
            <p class="text-2xl font-bold mt-1">{{ resumen.total }}</p>
          </div>
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <span class="text-xs text-amber-500 font-semibold">Pendientes</span>
            <p class="text-2xl font-bold mt-1">{{ resumen.pendientes }}</p>
          </div>
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <span class="text-xs text-blue-500 font-semibold">En Proceso</span>
            <p class="text-2xl font-bold mt-1">{{ resumen.enProgreso }}</p>
          </div>
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <span class="text-xs text-green-500 font-semibold">Completadas</span>
            <p class="text-2xl font-bold mt-1">{{ resumen.completadas }}</p>
          </div>
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <span class="text-xs text-surface-400">Ingresos</span>
            <p class="text-2xl font-bold mt-1 text-primary">${{ formatCurrency(resumen.ingresos) }}</p>
          </div>
          <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <span class="text-xs text-green-600 font-semibold">Ganancia</span>
            <p class="text-2xl font-bold mt-1 text-green-600">${{ formatCurrency(resumen.ganancia) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div class="xl:col-span-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-sm">Ordenes Recientes</h3>
              <div class="flex items-center gap-2">
                <Select v-model="tecnicoFiltro" :options="['', ...tecnicos]" optionLabel="label" optionValue="value" placeholder="Todos los tecnicos" class="w-40" fluid>
                  <template #value="{ value }">
                    <span class="text-xs">{{ value || 'Todos' }}</span>
                  </template>
                  <template #option="{ option }">
                    <span class="text-xs">{{ option || 'Todos los tecnicos' }}</span>
                  </template>
                </Select>
              </div>
            </div>

            <DataTable
              :value="ordenesFiltradas.slice(0, 20)"
              stripedRows
              paginator
              :rows="10"
              dataKey="id"
              responsiveLayout="scroll"
              class="text-xs"
            >
              <Column field="no_orden" header="No." sortable style="width: 6rem" />
              <Column field="nombre" header="Cliente" sortable />
              <Column field="equipo" header="Equipo" sortable />
              <Column field="tecnico" header="Tecnico" sortable style="width: 8rem" />
              <Column field="total" header="Total" sortable style="width: 7rem">
                <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
              </Column>
              <Column field="estado" header="Estado" sortable style="width: 8rem">
                <template #body="{ data }">
                  <Tag :value="data.estado" :severity="getEstadoSeverity(data.estado)" />
                </template>
              </Column>
              <Column field="fecha_entrada" header="Fecha" sortable style="width: 7rem" />
              <template #empty>
                <div class="text-center py-4 text-surface-400">Sin ordenes</div>
              </template>
            </DataTable>
          </div>

          <div class="space-y-4">
            <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
              <h3 class="font-semibold text-sm mb-3">Por Estado</h3>
              <div class="space-y-2">
                <div v-for="item in ordenesPorEstado" :key="item.estado" class="flex items-center justify-between text-sm">
                  <Tag :value="item.estado" :severity="getEstadoSeverity(item.estado)" />
                  <span class="font-semibold">{{ item.cantidad }}</span>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-4">
              <h3 class="font-semibold text-sm mb-3">Resumen Financiero</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-surface-500">Ingresos</span>
                  <span class="font-semibold">${{ formatCurrency(resumen.ingresos) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-surface-500">Costo Piezas</span>
                  <span class="font-semibold">${{ formatCurrency(resumen.costoPiezas) }}</span>
                </div>
                <div class="flex justify-between border-t border-surface-200 dark:border-surface-700 pt-2 mt-2">
                  <span class="text-green-600 font-semibold">Ganancia</span>
                  <span class="text-green-600 font-bold text-lg">${{ formatCurrency(resumen.ganancia) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <Dialog
      v-model:visible="dialogPdf"
      header="Vista Previa - Reporte de Taller"
      modal
      :style="{ width: '80vw', height: '90vh' }"
      :closable="true"
      :draggable="false"
    >
      <div class="flex flex-col h-full -m-6">
        <iframe
          v-if="pdfUrl"
          :src="pdfUrl"
          class="w-full flex-1 border-0"
          style="min-height: 70vh"
        ></iframe>
      </div>
      <template #footer>
        <Button label="Cerrar" severity="secondary" text @click="cerrarPdf" />
        <Button label="Descargar PDF" icon="pi pi-download" @click="descargarPDF" />
      </template>
    </Dialog>
</template>
