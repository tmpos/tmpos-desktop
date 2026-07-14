<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { envioElectron } from '@/funciones/funciones.js'

function formatearMetodoPago(factura: any): string {
  const metodo = String(factura.metodo_pago || '').toUpperCase()
  const otro = parseJson(factura?.otro, {})
  const bancoNombre = factura.banco_nombre || otro?.banco_nombre || ''
  if (metodo !== 'MIXTO') {
    return bancoNombre ? `${factura.metodo_pago || ''} - ${bancoNombre}` : (factura.metodo_pago || '')
  }
  const partes: string[] = []
  const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
  if (Number(factura.efectivo) > 0) partes.push(`Efectivo: $${fmt(factura.efectivo)}`)
  if (Number(factura.tarjeta) > 0) partes.push(`Tarjeta: $${fmt(factura.tarjeta)}`)
  const transferencias = factura.transferencias_mixtas
    ? (Array.isArray(factura.transferencias_mixtas) ? factura.transferencias_mixtas : [])
    : otro?.transferencias_mixtas
      ? (Array.isArray(otro.transferencias_mixtas) ? otro.transferencias_mixtas : [])
      : (Number(factura.transferencia) > 0 ? [{ monto: factura.transferencia, banco_nombre: bancoNombre }] : [])
  for (const t of transferencias) {
    const banco = t.banco_nombre ? ` (${t.banco_nombre})` : ''
    partes.push(`Transferencia${banco}: $${fmt(t.monto)}`)
  }
  if (Number(factura.cheque) > 0) partes.push(`Cheque: $${fmt(factura.cheque)}`)
  return `MIXTO (${partes.join(', ')})`
}

function esCotizacion(factura: any): boolean {
  return String(factura.tipo_factura || '').toLowerCase() === 'cotizacion' || String(factura.estado_factura || '').toLowerCase() === 'cotizacion'
}

const toast = useToast()

const dialogPdf = ref(false)
const generandoPdf = ref(false)
const pdfUrl = ref('')
const pdfNombre = ref('')

function parseJson(value: any, fallback: any) {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function toNumber(value: any, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizarAlanubeData(factura: any, ecf: any = {}) {
  const otro = parseJson(factura?.otro, {})
  const response = otro?.alanube_response || factura?.alanube_response || {}
  return {
    documentStampUrl: ecf?.document_stamp_url || factura?.document_stamp_url || factura?.documentStampUrl || otro?.documentStampUrl || otro?.document_stamp_url || response?.documentStampUrl || response?.document_stamp_url || '',
    securityCode: ecf?.security_code || factura?.codigo_seguridad || factura?.securityCode || otro?.securityCode || otro?.security_code || response?.securityCode || response?.security_code || '',
    legalStatus: ecf?.legal_status || factura?.alanube_legal_status || response?.legalStatus || otro?.legalStatus || '',
    status: ecf?.status || factura?.alanube_status || response?.status || otro?.status || '',
  }
}

async function obtenerAlanubeData(factura: any) {
  if (factura?.id) {
    try {
      const res = await window.db.getWhere('facturas_ecf', 'factura_id = ?', [factura.id])
      const ecf = res?.success && Array.isArray(res.data) ? res.data[0] : null
      if (ecf) return normalizarAlanubeData(factura, ecf)
    } catch (_) {}
  }
  return normalizarAlanubeData(factura)
}

function formatoMoneda(value: any): string {
  return `RD$ ${toNumber(value).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatoFechaFactura(value: any, hora = ''): string {
  const horaTexto = String(hora || '').trim().match(/^(\d{1,2}:\d{2})/)
  const fechaTexto = String(value || '').trim()
  const horaEnFecha = fechaTexto.match(/(?:T|\s)(\d{1,2}:\d{2})/)
  const horaFormateada = horaTexto ? horaTexto[1].padStart(5, '0') : (horaEnFecha ? horaEnFecha[1].padStart(5, '0') : '')
  const fechaSql = fechaTexto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const fechaLatina = fechaTexto.match(/^(\d{2})\/(\d{2})\/(\d{4})/)

  if (fechaSql) return `${fechaSql[3]}/${fechaSql[2]}/${fechaSql[1]}${horaFormateada ? ` ${horaFormateada}` : ''}`
  if (fechaLatina) return `${fechaLatina[1]}/${fechaLatina[2]}/${fechaLatina[3]}${horaFormateada ? ` ${horaFormateada}` : ''}`

  const fecha = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(fecha.getTime())) return horaFormateada
  const fechaFormateada = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`
  const horaDesdeFecha = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
  return `${fechaFormateada} ${horaFormateada || horaDesdeFecha}`
}

function obtenerImeisProducto(producto: any): string[] {
  const valores = [producto?.imei, producto?.lista_imei, producto?.imeis, producto?.serial, producto?.seriales]
  return valores
    .flatMap((valor) => {
      if (Array.isArray(valor)) return valor
      if (typeof valor === 'string') return valor.split(',')
      return valor ? [valor] : []
    })
    .map((valor) => {
      if (typeof valor === 'object') return String(valor.imei || valor.serial || '').trim()
      return String(valor).trim()
    })
    .filter(Boolean)
    .filter((valor, index, lista) => lista.indexOf(valor) === index)
}

function obtenerCodigoProducto(producto: any): string {
  return String(
    producto?.codigo ||
    producto?.codigo_barra ||
    producto?.cod_producto ||
    producto?.sku ||
    producto?.referencia ||
    producto?.barcode ||
    producto?.imei ||
    producto?.serial ||
    producto?.accesorio_id ||
    producto?.telefono_id ||
    producto?.imei_id ||
    producto?.serial_id ||
    ''
  ).trim()
}

function normalizarRutaImagen(ruta: any, baseUrl = ''): string {
  const valor = String(ruta ?? '').trim()
  if (!valor) return ''
  if (/^(data:|https?:\/\/|file:|blob:)/i.test(valor)) return valor
  if (valor.startsWith('/')) return baseUrl ? `${baseUrl.replace(/\/$/, '')}${valor}` : valor
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}/${valor.replace(/^\.\//, '')}` : valor
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function cargarEmpresa() {
  try {
    const res = await window.db.getAll('empresa')
    if (res.success && res.data?.length > 0) return res.data[0]
  } catch (_) {}
  return {}
}

async function cargarCliente(factura: any) {
  try {
    const res = await window.db.getAll('clientes')
    if (!res.success || !Array.isArray(res.data)) return {}
    const codCliente = String(factura.cod_cliente || factura.cliente_id || '').trim()
    const nombreCliente = String(factura.nombre_cliente || factura.cliente || factura.comprador || '').trim().toUpperCase()
    const telefonoCliente = String(factura.telefono_cliente || factura.telefono || factura.whatsapp || '').trim()
    const documentoCliente = String(factura.rnc_cliente || factura.cedula_cliente || factura.rnc || factura.cedula || '').trim()
    return res.data.find((cliente: any) =>
      String(cliente.id || '') === codCliente ||
      String(cliente.codigo || '') === codCliente ||
      String(cliente.nombre || '').trim().toUpperCase() === nombreCliente ||
      String(cliente.telefono || '').trim() === telefonoCliente ||
      String(cliente.whatsapp || '').trim() === telefonoCliente ||
      String(cliente.rnc || '').trim() === documentoCliente ||
      String(cliente.cedula || '').trim() === documentoCliente
    ) || {}
  } catch (_) {
    return {}
  }
}

function normalizarClienteFactura(factura: any, clienteData: any = {}) {
  return {
    nombre: factura.nombre_cliente || factura.cliente || factura.comprador || clienteData?.nombre || 'CONSUMIDOR FINAL',
    telefono: factura.telefono_cliente || factura.telefono || factura.whatsapp || clienteData?.telefono || clienteData?.whatsapp || '',
    documento: factura.rnc_cliente || factura.cedula_cliente || factura.rnc || factura.cedula || clienteData?.rnc || clienteData?.cedula || '',
    direccion: factura.direccion_cliente || factura.direccion || clienteData?.direccion || '',
  }
}

function obtenerNotaFactura(factura: any): string {
  return String(
    factura.nota ||
    factura.observacion ||
    factura.observaciones ||
    factura.nota_factura ||
    factura.comentario ||
    ''
  ).trim()
}

async function cargarConfig() {
  try {
    return await envioElectron('datosarchivo')
  } catch (_) {
    return {}
  }
}

async function generateFacturaHtml({ factura, cliente = null, datosEmpresa = null }: {
  factura: any
  cliente?: any
  datosEmpresa?: any
}) {
  const datosJSON = await cargarConfig()
  const link = datosJSON?.VITE_LINKURL || ''
  const empresa = datosEmpresa?.empresa || datosEmpresa?.datosEmpresa?.empresa || factura.empresa || await cargarEmpresa()
  const clienteData = cliente || await cargarCliente(factura)
  const clienteFactura = normalizarClienteFactura(factura, clienteData)
  const notaFactura = obtenerNotaFactura(factura) || 'Gracias por su compra!'
  const notaFacturaHtml = notaFactura.replace(/\n/g, '<br>')
  const productos = parseJson(factura.productos, Array.isArray(factura.items) ? factura.items : [])
  const logoEmpresa = normalizarRutaImagen(empresa?.logoprinter || empresa?.logo, link)

  const alanubeData = await obtenerAlanubeData(factura)
  const qrValue = alanubeData.documentStampUrl || `${link || 'https://tmposrd.com'}/receipt/factura?factura=${factura.no_factura || ''}`
  let qrCodeData = factura.qr || ''
  try {
    if (!qrCodeData) qrCodeData = await QRCode.toDataURL(qrValue)
  } catch (_) {}

  const productosProcesados = Array.isArray(productos) ? productos.map((producto: any) => {
    const cantidad = toNumber(producto.cantidad ?? producto.quantity, 0)
    const precioUnidad = toNumber(producto.precio_final ?? producto.precio_venta ?? producto.precio_unitario ?? producto.precio, 0)
    const precioNormal = toNumber(producto.precio_normal ?? producto.precio_lista ?? producto.precio_venta_normal, precioUnidad)
    const descuento = toNumber(producto.descuento, 0)
    const impuesto = toNumber(producto.impuesto_venta ?? producto.impuesto, 0)
    const totalProducto = toNumber(producto.total, (precioUnidad * cantidad) - descuento)
    const tieneDescuentoProducto = precioNormal > 0 && precioUnidad >= 0 && precioUnidad < precioNormal
    return {
      ...producto,
      codigoProducto: obtenerCodigoProducto(producto),
      cantidad,
      precioUnidad,
      precioNormal,
      descuento,
      tieneDescuentoProducto,
      impuestoTotal: impuesto * cantidad,
      totalProducto,
      imeis: obtenerImeisProducto(producto),
    }
  }) : []

  const mostrarImpuesto = toNumber(factura.impuesto ?? factura.impuestos) > 0 || productosProcesados.some((p: any) => p.impuestoTotal > 0)
  const mostrarDescuento = toNumber(factura.descuento) > 0 || productosProcesados.some((p: any) => p.descuento > 0)
  const totalImpuesto = productosProcesados.reduce((sum: number, p: any) => sum + p.impuestoTotal, 0) || toNumber(factura.impuesto ?? factura.impuestos)
  const totalFactura = toNumber(factura.total)
  const subtotal = toNumber(factura.subtotal, totalFactura + toNumber(factura.descuento) - totalImpuesto)
  const colCount = 5 + (mostrarImpuesto ? 1 : 0) + (mostrarDescuento ? 1 : 0)
  const fechaFactura = formatoFechaFactura(factura.fecha_emision || factura.fecha || '', factura.hora || '')

  const productosHTML = productosProcesados.map((producto: any) => {
    const imeiHTML = producto.imeis.length ? `<div class="imei-line">IMEI: ${producto.imeis.join(', ')}</div>` : ''
    const ofertaHTML = producto.tieneDescuentoProducto
      ? `<div class="discount-line">Normal: <span class="line-through">${formatoMoneda(producto.precioNormal)}</span> &nbsp; Con descuento: <strong>${formatoMoneda(producto.precioUnidad)}</strong></div>`
      : ''
    return `
      <tr class="invoice-line">
        <td>${producto.codigoProducto || ''}</td>
        <td>
          <div>${producto.nombre || producto.descripcion || ''}</div>
          ${ofertaHTML}
          ${imeiHTML}
        </td>
        <td class="text-center">${producto.cantidad}</td>
        <td class="text-right">${formatoMoneda(producto.precioUnidad)}</td>
        ${mostrarImpuesto ? `<td class="text-right">${formatoMoneda(producto.impuestoTotal)}</td>` : ''}
        ${mostrarDescuento ? `<td class="text-right">${formatoMoneda(producto.descuento)}</td>` : ''}
        <td class="text-right"><strong>${formatoMoneda(producto.totalProducto)}</strong></td>
      </tr>
    `
  }).join('')

  const filasRelleno = Array.from({ length: Math.max(0, 8 - productosProcesados.length) }, () =>
    `<tr class="invoice-line empty-row">${Array.from({ length: colCount }, () => '<td>&nbsp;</td>').join('')}</tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${factura.no_factura || ''}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: letter; margin: 10mm; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .page { width: 100%; max-width: 760px; margin: 0 auto; padding: 16px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .company { flex: 1; line-height: 1.35; }
    .company img { max-width: 150px; max-height: 90px; object-fit: contain; margin-bottom: 8px; }
    .company-name { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .invoice-box { width: 280px; border: 1px solid #111827; border-radius: 8px; overflow: hidden; }
    .invoice-box table { width: 100%; border-collapse: collapse; }
    .invoice-box td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
    .invoice-title { margin: 8px; padding: 8px; text-align: center; background: #175C8A; color: white; border-radius: 6px; font-weight: 700; letter-spacing: .04em; }
    .client-box { margin-top: 16px; border: 1px solid #111827; border-radius: 8px; display: flex; justify-content: space-between; gap: 16px; padding: 10px; }
    .client-box p { margin: 2px 0; }
    .qr img { width: 92px; height: 92px; }
    .products { margin-top: 12px; width: 100%; border-collapse: collapse; border: 1px solid #175C8A; }
    .products th { background: #175C8A; color: #fff; padding: 6px 5px; border: 1px solid #175C8A; font-weight: 700; font-size: 11px; }
    .products td { padding: 5px; border-left: 1px solid #175C8A; border-right: 1px solid #175C8A; vertical-align: top; font-size: 11px; }
    .invoice-line { min-height: 24px; }
    .empty-row td { height: 24px; }
    .imei-line { margin-top: 3px; font-size: 9px; font-weight: 700; color: #374151; }
    .discount-line { margin-top: 3px; font-size: 9px; color: #374151; }
    .line-through { text-decoration: line-through; color: #6b7280; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bottom { display: flex; justify-content: space-between; gap: 32px; margin-top: 14px; }
    .signatures { flex: 1; padding-top: 16px; line-height: 1.5; }
    .totals { width: 300px; border: 1px solid #111827; border-radius: 8px; overflow: hidden; align-self: flex-start; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    .totals tr:last-child td { border-bottom: none; background: #f3f4f6; font-size: 14px; font-weight: 700; }
    .note { margin-top: 10px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 11px; line-height: 1.35; background: #f9fafb; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company">
        ${logoEmpresa ? `<img src="${logoEmpresa}" alt="Logo">` : `<div class="company-name">${empresa.nombre || 'MI EMPRESA'}</div>`}
        <div>
          ${empresa.legal || empresa.rnc ? `${empresa.legal || empresa.rnc}<br>` : ''}
          ${empresa.telefono ? `Tel: ${empresa.telefono}<br>` : ''}
          ${empresa.email ? `Email: ${empresa.email}<br>` : ''}
          ${empresa.direccion || ''}
        </div>
      </div>

      <div class="invoice-box">
        <table>
          <tr><td><strong>Fecha</strong></td><td class="text-right">${fechaFactura}</td></tr>
          <tr><td><strong>${esCotizacion(factura) ? 'Cotizacion #' : 'Factura #'}</strong></td><td class="text-right">${factura.no_factura || ''}</td></tr>
          ${esCotizacion(factura) ? '' : `<tr><td><strong>NCF</strong></td><td class="text-right">${factura.ncf || factura.comprobante || ''}</td></tr>`}
        </table>
        <div class="invoice-title">${(() => {
          if (esCotizacion(factura)) return `COTIZACION #${factura.no_factura || ''}`
          if (String(factura.metodo_pago || '').toLowerCase() === 'mixto') return formatearMetodoPago(factura)
          if (factura.metodo_pago === 'CREDITO') return 'FACTURA A CREDITO'
          return 'FACTURA'
        })()}</div>
        ${esCotizacion(factura) ? '<div style="text-align:center;margin-top:8px;font-size:10px;color:#666;font-style:italic">Esta cotizacion tiene una validez de 30 dias</div>' : ''}
      </div>
    </div>

    <div class="client-box">
      <div>
        <p><strong>CLIENTE:</strong> ${clienteFactura.nombre || 'SIN REGISTRO'}</p>
        <p><strong>TELEFONO:</strong> ${clienteFactura.telefono || 'N/A'}</p>
        <p><strong>RNC/CEDULA:</strong> ${clienteFactura.documento || 'N/A'}</p>
        <p><strong>DIRECCION:</strong> ${clienteFactura.direccion || 'N/A'}</p>
        <p><strong>METODO DE PAGO:</strong> ${formatearMetodoPago(factura)}</p>
      </div>
      <div class="qr">
        ${qrCodeData ? `<img src="${qrCodeData}" alt="QR">` : ''}
        ${alanubeData.securityCode ? `<div style="font-size:9px;font-weight:700;text-align:center;margin-top:4px">Codigo Seguridad: ${alanubeData.securityCode}</div>` : ''}
      </div>
    </div>

    <table class="products">
      <thead>
        <tr>
          <th>COD</th>
          <th>DESCRIPCION</th>
          <th>CANT.</th>
          <th>P.U</th>
          ${mostrarImpuesto ? '<th>ITBIS</th>' : ''}
          ${mostrarDescuento ? '<th>DESC</th>' : ''}
          <th>SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${productosHTML}
        ${filasRelleno}
      </tbody>
    </table>

    <div class="note"><strong>OBSERVACION:</strong><br>${notaFacturaHtml}</div>

    <div class="bottom">
      <div class="signatures">
        ___________________________________________<br>
        <strong>ENTREGADO POR:</strong> ${factura.usuario || factura.cajero || 'Usuario'}<br><br>
        ___________________________________________<br>
        <strong>RECIBIDO POR:</strong> ${clienteFactura.nombre || 'SIN REGISTRO'}
      </div>

      <div class="totals">
        <table>
          <tr><td>SUBTOTAL</td><td class="text-right">${formatoMoneda(subtotal)}</td></tr>
          ${mostrarImpuesto ? `<tr><td>ITBIS</td><td class="text-right">${formatoMoneda(totalImpuesto)}</td></tr>` : ''}
          ${mostrarDescuento ? `<tr><td>DESC.</td><td class="text-right">${formatoMoneda(factura.descuento)}</td></tr>` : ''}
          <tr><td>TOTAL</td><td class="text-right">${formatoMoneda(factura.total)}</td></tr>
        </table>
      </div>
    </div>

  </div>
</body>
</html>`
}

async function abrirPdf(url: string, nombre: string) {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = url
  pdfNombre.value = nombre
  dialogPdf.value = true
}

function cerrarPdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''
  pdfNombre.value = ''
  dialogPdf.value = false
}

async function descargarPDF() {
  if (!pdfUrl.value) return
  const blob = await (await fetch(pdfUrl.value)).blob()
  const buffer = await blob.arrayBuffer()
  const dataUrl = `data:application/pdf;base64,${arrayBufferToBase64(buffer)}`
  const res = await window.electron.invoke('save:pdf', dataUrl, pdfNombre.value) as { success: boolean; error?: string }
  if (res.success) toast.add({ severity: 'success', summary: 'Guardado', detail: 'PDF descargado', life: 2000 })
  else toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo guardar el PDF', life: 3000 })
}

async function printFactura(factura: any) {
  generandoPdf.value = true
  try {
    const html = await generateFacturaHtml({ factura })
    const nombre = `Factura_${factura?.no_factura || 'sin_numero'}.pdf`
    const res = await window.electron.invoke('generate:pdf', html, nombre) as { success: boolean; dataUrl?: string; error?: string }
    if (res.success && res.dataUrl) {
      const blob = await (await fetch(res.dataUrl)).blob()
      await abrirPdf(URL.createObjectURL(blob), nombre)
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error || 'No se pudo generar el PDF', life: 3000 })
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Error al generar PDF', life: 3000 })
  } finally {
    generandoPdf.value = false
  }
}

defineExpose({
  printFactura,
  generateFacturaHtml,
})
</script>

<template>
  <div style="display:none">
    <Toast />
  </div>

  <Dialog
    v-model:visible="dialogPdf"
    header="Vista Previa - Factura PDF"
    modal
    :style="{ width: '80vw', height: '90vh' }"
    :draggable="false"
    @hide="cerrarPdf"
  >
    <div class="flex flex-col h-full gap-3">
      <iframe
        v-if="pdfUrl"
        :src="pdfUrl"
        class="w-full flex-1 border-0 rounded-lg"
        style="min-height: 70vh"
        title="Factura PDF"
      ></iframe>
    </div>
    <template #footer>
      <Button label="Cerrar" severity="secondary" text @click="cerrarPdf" />
      <Button label="Descargar PDF" icon="pi pi-download" @click="descargarPDF" />
    </template>
  </Dialog>
</template>
