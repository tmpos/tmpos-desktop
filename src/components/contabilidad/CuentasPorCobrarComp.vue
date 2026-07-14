<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import InputOtp from 'primevue/inputotp'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Fieldset from 'primevue/fieldset'
import Menu from 'primevue/menu'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import TicketCuentaCobrarPrint from './TicketCuentaCobrarPrint.vue'
import { useAlmacenFilter } from '@/composables/useAlmacenFilter'
import Swal from 'sweetalert2'

const toast = useToast()
const { filterByAlmacen, addAlmacenId } = useAlmacenFilter()
const cuentas = ref<any[]>([])
const loading = ref(false)
const busqueda = ref('')
const filtroEstado = ref('')

const selectedCuentas = ref<any[]>([])
const deleteDialogVisible = ref(false)
const deleteOtpEnviado = ref(false)
const deleteOtpLoading = ref(false)
const deleteOtpConfirmando = ref(false)
const deleteOtp = ref('')
const deleteOtpEmail = ref('')
const deleteOtpError = ref('')
const cuentaParaEliminar = ref<any>(null)

const dialogPago = ref(false)
const cuentaSelected = ref<any>(null)
const montoPago = ref(0)
const guardando = ref(false)
const productosFactura = ref<any[]>([])
const facturaRelacionada = ref<any>(null)

const dialogTelefono = ref(false)
const telefonoInput = ref('')
const cuentaTelefonoPendiente = ref<any>(null)

const generandoPdf = ref(false)
const actionMenu = ref()
const cuentaAccion = ref<any>(null)
const actionMenuItems = ref([
  { label: 'PDF Estado de Cuenta', icon: 'pi pi-file-pdf', command: () => generarPdfEstadoCuenta(cuentaAccion.value) },
  { label: 'Imprimir Recibo', icon: 'pi pi-print', command: () => imprimirEstadoCuenta(cuentaAccion.value) },
  { label: 'WhatsApp', icon: 'pi pi-whatsapp', command: () => enviarWhatsApp(cuentaAccion.value) },
  { label: 'Notificar Pago', icon: 'pi pi-bell', command: () => notificarCliente(cuentaAccion.value) },
  { separator: true },
  { label: 'Eliminar', icon: 'pi pi-trash', command: () => confirmarBorrar(cuentaAccion.value) },
])

function toggleActionMenu(event: Event, cuenta: any) {
  cuentaAccion.value = cuenta
  actionMenu.value.toggle(event)
}

const ticketRef = ref<InstanceType<typeof TicketCuentaCobrarPrint> | null>(null)

const estados = [
  { label: 'Todas', value: '' },
  { label: 'Activa', value: 'ACTIVA' },
  { label: 'Pagada', value: 'PAGADA' },
  { label: 'Vencida', value: 'VENCIDA' },
]

const cuentasFiltradas = computed(() => {
  let data = cuentas.value
  const texto = busqueda.value.toLowerCase().trim()
  if (texto) {
    data = data.filter(c =>
      c.nombre_cliente?.toLowerCase().includes(texto) ||
      c.no_factura?.toLowerCase().includes(texto) ||
      c.telefono_cliente?.toLowerCase().includes(texto)
    )
  }
  if (filtroEstado.value) {
    data = data.filter(c => c.estado === filtroEstado.value)
  }
  return data
})

const cuentasParaEliminar = computed(() => {
  if (cuentaParaEliminar.value) return [cuentaParaEliminar.value]
  return selectedCuentas.value || []
})

const totalSeleccionadoEliminar = computed(() =>
  cuentasParaEliminar.value.reduce((sum, c) => sum + Number(c?.total || 0), 0)
)

function formatCurrency(n: number): string {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFecha(fechaStr: string): string {
  if (!fechaStr) return ''
  const d = new Date(fechaStr)
  if (isNaN(d.getTime())) return fechaStr
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function buildEstadoCuentaHtml(cuenta: any, empresa: any, pagos: any[]): string {
  const logo = String(empresa?.logoprinter || empresa?.logo || '').trim()
  const ahora = new Date()
  const fecha = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
  const pagosHtml = pagos.map((p: any, i: number) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td class="text-center">${p.fecha || ''} ${p.hora || ''}</td>
      <td class="text-right">RD$ ${formatCurrency(p.cantidad)}</td>
    </tr>
  `).join('')
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Cuenta ${cuenta.no_factura || ''}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: letter; margin: 10mm; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .page { width: 100%; max-width: 680px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 16px; }
    .header img { max-width: 120px; max-height: 70px; object-fit: contain; margin-bottom: 6px; }
    .header h1 { margin: 0; font-size: 22px; color: #175C8A; }
    .header p { margin: 2px 0; font-size: 11px; color: #555; }
    .title { text-align: center; font-size: 16px; font-weight: 700; margin: 16px 0; padding: 8px; background: #175C8A; color: #fff; border-radius: 6px; }
    .info-box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; margin-bottom: 14px; }
    .info-box p { margin: 3px 0; }
    .totals { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
    .total-card { flex: 1; border-radius: 8px; padding: 10px; text-align: center; }
    .total-card .label { font-size: 10px; text-transform: uppercase; color: #666; }
    .total-card .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 6px 8px; border-bottom: 2px solid #d1d5db; font-size: 11px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #999; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${logo ? `<img src="${logo}">` : `<h1>${empresa.nombre || 'MI EMPRESA'}</h1>`}
      <p>${empresa.legal || empresa.rnc ? `RNC: ${empresa.legal || empresa.rnc}` : ''}</p>
      <p>${empresa.telefono ? `Tel: ${empresa.telefono}` : ''} ${empresa.email ? ` | Email: ${empresa.email}` : ''}</p>
      <p>${empresa.direccion || ''}</p>
    </div>

    <div class="title">ESTADO DE CUENTA</div>

    <div class="info-box">
      <p><strong>Cliente:</strong> ${cuenta.nombre_cliente || 'SIN REGISTRO'}</p>
      <p><strong>Telefono:</strong> ${cuenta.telefono_cliente || 'N/A'}</p>
      <p><strong>Factura:</strong> ${cuenta.no_factura || 'N/A'}</p>
      <p><strong>Fecha de venta:</strong> ${formatFecha(cuenta.fecha_venta) || 'N/A'}</p>
      <p><strong>Estado:</strong> ${cuenta.estado || 'ACTIVA'}</p>
    </div>

    <div class="totals">
      <div class="total-card" style="background:#eff6ff;">
        <div class="label">Total</div>
        <div class="value" style="color:#2563eb;">RD$ ${formatCurrency(cuenta.total)}</div>
      </div>
      <div class="total-card" style="background:#f0fdf4;">
        <div class="label">Abonado</div>
        <div class="value" style="color:#16a34a;">RD$ ${formatCurrency(cuenta.abonado)}</div>
      </div>
      <div class="total-card" style="background:#fef2f2;">
        <div class="label">Saldo Pendiente</div>
        <div class="value" style="color:#dc2626;">RD$ ${formatCurrency(cuenta.saldo)}</div>
      </div>
    </div>

    ${pagos.length ? `<table>
      <thead>
        <tr><th class="text-center">#</th><th class="text-center">Fecha</th><th class="text-right">Monto</th></tr>
      </thead>
      <tbody>
        ${pagosHtml}
        <tr style="font-weight:700;background:#f9fafb;">
          <td colspan="2" class="text-right">Total Abonado:</td>
          <td class="text-right">RD$ ${formatCurrency(cuenta.abonado)}</td>
        </tr>
      </tbody>
    </table>` : '<div style="text-align:center;padding:16px;color:#999;font-size:13px;">Sin abonos registrados</div>'}

    <div class="footer">Generado el ${fecha} | TM POS</div>
  </div>
</body>
</html>`
}

async function generarPdfEstadoCuenta(cuenta: any) {
  generandoPdf.value = true
  try {
    let empresa: any = {}
    try {
      const res = await window.db.getAll('empresa')
      if (res.success && res.data?.length) empresa = res.data[0]
    } catch {}
    const pagos: any[] = []
    try {
      const p = JSON.parse(cuenta.pagos || '[]')
      if (Array.isArray(p)) pagos.push(...p)
    } catch {}
    const html = buildEstadoCuentaHtml(cuenta, empresa, pagos)
    const nombre = `Estado_Cuenta_${cuenta.no_factura || cuenta.id}.pdf`
    const res = await window.electron.invoke('generate:pdf', html, nombre) as { success: boolean; dataUrl?: string; error?: string }
    if (res.success && res.dataUrl) {
      const resp = await fetch(res.dataUrl)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const result = await Swal.fire({
        title: `Estado de Cuenta #${cuenta.no_factura || ''}`,
        html: `<iframe src="${url}" style="width:100%;height:75vh;border:0;border-radius:6px;background:#fff"></iframe>`,
        width: '90vw',
        padding: '1rem',
        showCancelButton: true,
        confirmButtonText: 'Descargar PDF',
        cancelButtonText: 'Cerrar',
        focusConfirm: false,
        customClass: { popup: 'swal-pdf-popup' },
      })
      if (result.isConfirmed) {
        const resp2 = await fetch(url)
        const blob2 = await resp2.blob()
        const buffer = await blob2.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        const dataUrl = `data:application/pdf;base64,${btoa(binary)}`
        const saveRes = await window.electron.invoke('save:pdf', dataUrl, nombre) as { success: boolean; error?: string }
        if (saveRes.success) toast.add({ severity: 'success', summary: 'Guardado', detail: 'PDF descargado', life: 2000 })
        else toast.add({ severity: 'error', summary: 'Error', detail: saveRes.error || 'No se pudo guardar', life: 3000 })
      }
      URL.revokeObjectURL(url)
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo generar el PDF', life: 3000 })
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Error al generar PDF', life: 3000 })
  } finally {
    generandoPdf.value = false
  }
}

function getEstadoSeverity(estado: string): 'success' | 'danger' | 'warn' | 'info' | undefined {
  switch (estado) {
    case 'ACTIVA': return 'warn'
    case 'PAGADA': return 'success'
    case 'VENCIDA': return 'danger'
    default: return 'info'
  }
}

async function cargarCuentas() {
  loading.value = true
  try {
    const res = await window.db.getAll('cuentas_cobrar')
    if (res.success) cuentas.value = filterByAlmacen(res.data || [])
  } catch (_) {}
  loading.value = false
}

function confirmarBorrar(cuenta: any) {
  cuentaParaEliminar.value = cuenta
  selectedCuentas.value = []
  deleteOtpEnviado.value = false
  deleteOtp.value = ''
  deleteOtpEmail.value = ''
  deleteOtpError.value = ''
  deleteDialogVisible.value = true
}

async function confirmarBorrarSeleccionadas() {
  if (!selectedCuentas.value.length) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Selecciona al menos una cuenta', life: 2500 })
    return
  }
  cuentaParaEliminar.value = null
  deleteOtpEnviado.value = false
  deleteOtp.value = ''
  deleteOtpEmail.value = ''
  deleteOtpError.value = ''
  deleteDialogVisible.value = true
}

async function solicitarOtpEliminarCuenta() {
  const cuentas = cuentasParaEliminar.value
  if (!cuentas.length) return
  deleteOtpError.value = ''
  deleteOtp.value = ''
  deleteOtpLoading.value = true
  try {
    const res = await window.electron.invoke('facturas:solicitarOtpEliminar', {
      id: cuentas[0]?.id,
      facturaIds: cuentas.map(c => c.id),
      no_factura: cuentas.length === 1 ? cuentas[0]?.no_factura : '',
      nombre_cliente: cuentas.length === 1 ? cuentas[0]?.nombre_cliente : '',
      cantidad: cuentas.length,
      total: totalSeleccionadoEliminar.value,
    }) as any
    if (res.success) {
      deleteOtpEmail.value = res.data?.email || ''
      deleteOtpEnviado.value = true
      toast.add({ severity: 'success', summary: 'Codigo enviado', detail: 'Revisa el correo de la empresa', life: 3000 })
    } else {
      deleteOtpError.value = res.error || 'No se pudo enviar el codigo'
    }
  } catch (e: any) {
    deleteOtpError.value = e.message || 'Error solicitando codigo'
  } finally {
    deleteOtpLoading.value = false
  }
}

async function borrar() {
  try {
    const cuentas = cuentasParaEliminar.value
    if (!cuentas.length) return
    deleteOtpError.value = ''
    const codigo = String(deleteOtp.value || '').replace(/\D/g, '')
    if (!/^\d{4}$/.test(codigo)) {
      deleteOtpError.value = 'Introduce el codigo de 4 digitos'
      return
    }
    deleteOtpConfirmando.value = true
    const otpRes = await window.electron.invoke('facturas:confirmarOtpEliminar', {
      facturaId: cuentas[0]?.id,
      facturaIds: cuentas.map(c => c.id),
      codigo,
    }) as any
    if (!otpRes.success) {
      deleteOtpError.value = otpRes.error || 'Codigo no valido'
      return
    }

    let eliminadas = 0
    for (const cuenta of cuentas) {
      const res = await window.db.delete('cuentas_cobrar', cuenta.id)
      if (res.success) eliminadas++
      else {
        toast.add({ severity: 'error', summary: 'Error', detail: res.error || `No se pudo eliminar ${cuenta.no_factura || cuenta.id}`, life: 3000 })
        return
      }
    }
    toast.add({ severity: 'success', summary: 'Exito', detail: `${eliminadas} cuenta(s) eliminada(s)`, life: 3000 })
    deleteDialogVisible.value = false
    selectedCuentas.value = []
    cuentaParaEliminar.value = null
    await cargarCuentas()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar', life: 3000 })
  } finally {
    deleteOtpConfirmando.value = false
  }
}

const pagosHistorialParsed = computed(() => {
  if (!cuentaSelected.value) return []
  try {
    const p = JSON.parse(cuentaSelected.value.pagos || '[]')
    return Array.isArray(p) ? p : []
  } catch { return [] }
})

async function abrirPago(cuenta: any) {
  cuentaSelected.value = cuenta
  montoPago.value = cuenta.saldo
  productosFactura.value = []
  facturaRelacionada.value = null
  dialogPago.value = true

  // Cargar factura relacionada y sus productos
  try {
    const res = await window.db.getAll('facturas')
    if (res.success && res.data) {
      const factura = res.data.find((f: any) => f.no_factura === cuenta.no_factura)
      if (factura) {
        facturaRelacionada.value = factura
        try {
          const prods = typeof factura.productos === 'string' ? JSON.parse(factura.productos) : factura.productos
          productosFactura.value = Array.isArray(prods) ? prods : []
        } catch { productosFactura.value = [] }
      }
    }
  } catch (_) {}
}

async function pagoCompleto() {
  if (!cuentaSelected.value || cuentaSelected.value.saldo <= 0) return
  montoPago.value = cuentaSelected.value.saldo
  await registrarPago()
}

async function registrarPago() {
  if (!cuentaSelected.value || montoPago.value <= 0) return
  if (montoPago.value > cuentaSelected.value.saldo) {
    toast.add({ severity: 'warn', summary: 'Monto excede el saldo', detail: `Saldo: $${formatCurrency(cuentaSelected.value.saldo)}`, life: 3000 })
    return
  }
  guardando.value = true
  try {
    // Agregar pago al historial primero
    let pagosHistorial: any[] = []
    try {
      pagosHistorial = JSON.parse(cuentaSelected.value.pagos || '[]')
      if (!Array.isArray(pagosHistorial)) pagosHistorial = []
    } catch { pagosHistorial = [] }

    const ahora = new Date()
    pagosHistorial.push({
      nopago: pagosHistorial.length + 1,
      cantidad: montoPago.value,
      fecha: ahora.toLocaleDateString('es-DO'),
      hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
    })

    // Recalcular abonado sumando todos los pagos
    const nuevoAbonado = pagosHistorial.reduce((sum: number, p: any) => sum + (Number(p.cantidad) || 0), 0)
    const nuevoSaldo = (cuentaSelected.value.total || 0) - nuevoAbonado
    const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADA' : 'ACTIVA'

    await window.db.update('cuentas_cobrar', cuentaSelected.value.id, {
      abonado: nuevoAbonado,
      saldo: nuevoSaldo,
      estado: nuevoEstado,
      pagos: JSON.stringify(pagosHistorial),
    })

    // Actualizar el objeto local antes de imprimir para que el ticket tenga los pagos
    cuentaSelected.value.pagos = JSON.stringify(pagosHistorial)

    await ticketRef.value?.printTicket(cuentaSelected.value, montoPago.value, nuevoAbonado, nuevoSaldo)

    toast.add({ severity: 'success', summary: 'Pago registrado', detail: `$${formatCurrency(montoPago.value)} abonados`, life: 3000 })
    dialogPago.value = false
    await cargarCuentas()
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  } finally {
    guardando.value = false
  }
}

async function eliminarPago(index: number) {
  if (!cuentaSelected.value) return
  let pagosHistorial: any[] = []
  try {
    pagosHistorial = JSON.parse(cuentaSelected.value.pagos || '[]')
    if (!Array.isArray(pagosHistorial)) pagosHistorial = []
  } catch { pagosHistorial = [] }

  const pagoEliminado = pagosHistorial[index]
  if (!pagoEliminado) return

  pagosHistorial.splice(index, 1)
  // Renumerar
  pagosHistorial.forEach((p: any, i: number) => { p.nopago = i + 1 })

  // Recalcular abonado sumando todos los pagos restantes
  const nuevoAbonado = pagosHistorial.reduce((sum: number, p: any) => sum + (Number(p.cantidad) || 0), 0)
  const nuevoSaldo = (cuentaSelected.value.total || 0) - nuevoAbonado
  const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADA' : 'ACTIVA'

  try {
    await window.db.update('cuentas_cobrar', cuentaSelected.value.id, {
      abonado: nuevoAbonado,
      saldo: nuevoSaldo,
      estado: nuevoEstado,
      pagos: JSON.stringify(pagosHistorial),
    })
    cuentaSelected.value.abonado = nuevoAbonado
    cuentaSelected.value.saldo = nuevoSaldo
    cuentaSelected.value.estado = nuevoEstado
    cuentaSelected.value.pagos = JSON.stringify(pagosHistorial)
    montoPago.value = nuevoSaldo
    toast.add({ severity: 'info', summary: 'Pago eliminado', detail: `$${formatCurrency(pagoEliminado.cantidad)} removido`, life: 3000 })
    await cargarCuentas()
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  }
}

async function imprimirEstadoCuenta(cuenta: any) {
  await ticketRef.value?.printTicket(cuenta, 0, cuenta.abonado || 0, cuenta.saldo || 0)
}

function enviarWhatsApp(cuenta: any) {
  const telefono = String(cuenta.telefono_cliente || '').replace(/\D/g, '')
  if (!telefono) {
    cuentaTelefonoPendiente.value = cuenta
    telefonoInput.value = ''
    dialogTelefono.value = true
    return
  }
  abrirWhatsApp(cuenta, telefono, '*ESTADO DE CUENTA*')
}

function abrirWhatsApp(cuenta: any, telefono: string, encabezado: string) {
  const abonos = pagosHistorialParsed.value || []
  const historial = abonos.map((p: any, i: number) => `${i + 1}. $${formatCurrency(p.cantidad)} - ${p.fecha || ''} ${p.hora || ''}`).join('\n')
  const msg = [
    encabezado,
    '',
    `Cliente: ${cuenta.nombre_cliente || ''}`,
    `Factura: ${cuenta.no_factura || ''}`,
    `Total: $${formatCurrency(cuenta.total)}`,
    `Abonado: $${formatCurrency(cuenta.abonado)}`,
    `Saldo pendiente: $${formatCurrency(cuenta.saldo)}`,
    '',
    historial ? '*Abonos realizados:*\n' + historial : '',
    '',
    'Gracias por su preferencia.',
  ].filter(Boolean).join('\n')
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`, '_blank')
}

function notificarCliente(cuenta: any) {
  const telefono = String(cuenta.telefono_cliente || '').replace(/\D/g, '')
  if (!telefono) {
    cuentaTelefonoPendiente.value = { ...cuenta, _notificar: true }
    telefonoInput.value = ''
    dialogTelefono.value = true
    return
  }
  const msg = [
    '*RECORDATORIO DE PAGO*',
    '',
    `Hola ${cuenta.nombre_cliente || ''},`,
    `Tienes un saldo pendiente de $${formatCurrency(cuenta.saldo)} en la factura #${cuenta.no_factura || ''}.`,
    '',
    'Te recordamos realizar tu pago lo antes posible.',
    'Gracias.',
  ].filter(Boolean).join('\n')
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`, '_blank')
}

async function confirmarTelefonoEnviar() {
  const tel = telefonoInput.value.replace(/\D/g, '')
  if (!tel || tel.length < 10) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Ingresa un telefono valido (min 10 digitos)', life: 3000 })
    return
  }
  const cuenta = cuentaTelefonoPendiente.value
  if (!cuenta) return
  try {
    await window.db.update('cuentas_cobrar', cuenta.id, { telefono_cliente: tel })
    cuenta.telefono_cliente = tel
  } catch (_) {}
  if (cuenta._notificar) {
    notificarCliente(cuenta)
  } else {
    abrirWhatsApp(cuenta, tel, '*ESTADO DE CUENTA*')
  }
  dialogTelefono.value = false
  cuentaTelefonoPendiente.value = null
}

async function cambiarEstado(cuenta: any, estado: string) {
  await window.db.update('cuentas_cobrar', cuenta.id, { estado })
  cuenta.estado = estado
  toast.add({ severity: 'success', summary: 'Estado actualizado', detail: estado, life: 2000 })
}

onMounted(cargarCuentas)
</script>

<template>
  <div>
    <Toast />
    <TicketCuentaCobrarPrint ref="ticketRef" />

    <Fieldset legend="Cuentas por Cobrar">
      <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <InputText v-model="busqueda" placeholder="Buscar factura o cliente..." />
          </span>
          <Select v-model="filtroEstado" :options="estados" optionLabel="label" optionValue="value" placeholder="Estado" class="w-32" fluid />
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="selectedCuentas.length"
            :label="`Eliminar (${selectedCuentas.length})`"
            icon="pi pi-trash"
            severity="danger"
            @click="confirmarBorrarSeleccionadas"
          />
          <Button label="Actualizar" icon="pi pi-refresh" severity="secondary" @click="cargarCuentas" />
        </div>
      </div>

      <DataTable
        v-model:selection="selectedCuentas"
        :value="cuentasFiltradas"
        :loading="loading"
        stripedRows
        paginator
        :rows="15"
        :rowsPerPageOptions="[15, 25, 50]"
        dataKey="id"
        responsiveLayout="scroll"
        @row-click="abrirPago($event.data)"
      >
        <Column selectionMode="multiple" headerStyle="width: 3rem" />
        <Column header="" style="width: 4rem">
          <template #body="{ data }">
            <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded @click.stop="toggleActionMenu($event, data)" v-tooltip="'Acciones'" />
          </template>
        </Column>
        <Column field="no_factura" header="Factura" sortable style="width: 8rem" />
        <Column field="nombre_cliente" header="Cliente" sortable />
        <Column field="total" header="Total" sortable style="width: 8rem">
          <template #body="{ data }">${{ formatCurrency(data.total) }}</template>
        </Column>
        <Column field="abonado" header="Abonado" sortable style="width: 8rem">
          <template #body="{ data }">${{ formatCurrency(data.abonado) }}</template>
        </Column>
        <Column field="saldo" header="Saldo" sortable style="width: 8rem">
          <template #body="{ data }">
            <span :class="data.saldo > 0 ? 'text-red-600 font-bold' : 'text-green-600'">${{ formatCurrency(data.saldo) }}</span>
          </template>
        </Column>
        <Column field="fecha_venta" header="Fecha" sortable style="width: 7rem">
          <template #body="{ data }">{{ formatFecha(data.fecha_venta) }}</template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width: 7rem">
          <template #body="{ data }">
            <Tag :value="data.estado" :severity="getEstadoSeverity(data.estado)" />
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-6 text-surface-500">No hay cuentas por cobrar.</div>
        </template>
      </DataTable>
    </Fieldset>

    <Dialog v-model:visible="dialogPago" header="Registrar Pago" modal :style="{ width: '50rem' }">
      <div v-if="cuentaSelected" class="space-y-4 pt-2">
        <div class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-surface-500">Factura</span>
            <span class="font-semibold">{{ cuentaSelected.no_factura }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Cliente</span>
            <span class="font-semibold">{{ cuentaSelected.nombre_cliente }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Total</span>
            <span>${{ formatCurrency(cuentaSelected.total) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-surface-500">Abonado</span>
            <span class="text-green-600">${{ formatCurrency(cuentaSelected.abonado) }}</span>
          </div>
          <div class="flex justify-between font-bold border-t border-surface-200 dark:border-surface-700 pt-2">
            <span>Saldo pendiente</span>
            <span class="text-red-600">${{ formatCurrency(cuentaSelected.saldo) }}</span>
          </div>
        </div>

        <!-- Productos de la factura -->
        <div v-if="productosFactura.length > 0" class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm">
          <div class="font-semibold mb-2">Productos (Factura #{{ cuentaSelected.no_factura }})</div>
          <div class="space-y-1 max-h-40 overflow-y-auto">
            <div v-for="(prod, i) in productosFactura" :key="i" class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800 last:border-0">
              <div>
                <span class="font-semibold">{{ prod.nombre || prod.descripcion || prod.producto || 'Producto' }}</span>
                <span class="text-surface-500 ml-2">x{{ prod.cantidad || prod.quantity || 1 }}</span>
              </div>
              <span class="font-semibold">${{ formatCurrency(prod.total || ((prod.precio_venta || prod.precio_unitario || prod.precio || 0) * (prod.cantidad || prod.quantity || 1))) }}</span>
            </div>
          </div>
          <div v-if="facturaRelacionada" class="flex justify-between font-bold border-t border-surface-200 dark:border-surface-700 pt-2 mt-2">
            <span>Total factura</span>
            <span>${{ formatCurrency(facturaRelacionada.total) }}</span>
          </div>
        </div>

        <!-- Historial de abonos -->
        <div v-if="pagosHistorialParsed.length > 0" class="rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm">
          <div class="font-semibold mb-2">Abonos realizados</div>
          <div class="space-y-1 max-h-40 overflow-y-auto">
            <div v-for="(pago, index) in pagosHistorialParsed" :key="pago.nopago" class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800 last:border-0">
              <div>
                <span class="font-semibold">#{{ pago.nopago }}</span>
                <span class="text-surface-500 ml-2">{{ pago.fecha }} {{ pago.hora }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-green-600 font-semibold">${{ formatCurrency(pago.cantidad) }}</span>
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="eliminarPago(index)" v-tooltip="'Eliminar pago'" />
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-surface-400 text-center py-2">Sin abonos registrados</div>

        <!-- Monto a abonar -->
        <div v-if="cuentaSelected.saldo > 0" class="space-y-2">
          <div class="space-y-1">
            <label class="text-sm font-semibold">Monto a abonar (RD$)</label>
            <InputNumber v-model="montoPago" :min="0" :max="cuentaSelected.saldo" fluid @focus="(e: any) => e.target.select()" />
          </div>

          <div class="flex gap-2 pt-1">
            <Button
              v-for="m in [Math.round(cuentaSelected.saldo * 0.25), Math.round(cuentaSelected.saldo / 2), cuentaSelected.saldo]"
              :key="m"
              :label="'$' + formatCurrency(m)"
              severity="secondary"
              text
              size="small"
              @click="montoPago = m"
            />
          </div>
        </div>
        <div v-else class="text-center py-2">
          <Tag value="PAGADA" severity="success" />
        </div>
      </div>
      <template #footer>
        <Button label="Imprimir" icon="pi pi-print" severity="info" text :disabled="!cuentaSelected" @click="imprimirEstadoCuenta(cuentaSelected)" />
        <Button label="WhatsApp" icon="pi pi-whatsapp" severity="success" text @click="enviarWhatsApp(cuentaSelected)" />
        <Button v-if="cuentaSelected?.saldo > 0" label="Pago Completo" icon="pi pi-wallet" severity="warn" :loading="guardando" @click="pagoCompleto" />
        <Button label="Cancelar" severity="secondary" text @click="dialogPago = false" />
        <Button v-if="cuentaSelected?.saldo > 0" label="Registrar Pago" icon="pi pi-check" :loading="guardando" :disabled="montoPago <= 0" @click="registrarPago" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Eliminar cuenta por cobrar"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
          <span v-if="cuentasParaEliminar.length === 1">Seguro que deseas eliminar la cuenta <strong>{{ cuentasParaEliminar[0]?.no_factura }}</strong>?</span>
          <span v-else>Seguro que deseas eliminar <strong>{{ cuentasParaEliminar.length }}</strong> cuentas seleccionadas?</span>
        </div>
        <div v-if="cuentasParaEliminar.length > 1" class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
          Total combinado: <strong>RD$ {{ formatCurrency(totalSeleccionadoEliminar) }}</strong>
        </div>
        <div v-if="deleteOtpEnviado" class="flex flex-col items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
          <p class="text-xs text-surface-500 text-center">
            Enviamos un codigo de 4 digitos al correo {{ deleteOtpEmail || 'de la licencia' }}.
          </p>
          <InputOtp v-model="deleteOtp" :length="4" integerOnly />
        </div>
        <p v-if="deleteOtpError" class="text-red-500 text-xs text-center">{{ deleteOtpError }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button
          v-if="!deleteOtpEnviado"
          label="Enviar OTP"
          icon="pi pi-envelope"
          severity="danger"
          :loading="deleteOtpLoading"
          @click="solicitarOtpEliminarCuenta"
        />
        <Button
          v-else
          label="Eliminar"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleteOtpConfirmando"
          @click="borrar"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogTelefono" header="Telefono del cliente" modal :style="{ width: '90%', maxWidth: '400px' }">
      <div class="space-y-3">
        <p class="text-sm text-surface-500">El cliente no tiene telefono registrado. Ingresa el numero para enviar por WhatsApp:</p>
        <InputText v-model="telefonoInput" placeholder="8095551234" fluid @keydown.enter="confirmarTelefonoEnviar" />
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogTelefono = false" />
        <Button label="Enviar WhatsApp" icon="pi pi-whatsapp" severity="success" @click="confirmarTelefonoEnviar" />
      </template>
    </Dialog>
    <Menu ref="actionMenu" :model="actionMenuItems" popup />
  </div>
</template>
