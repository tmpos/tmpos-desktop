<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { useToast } from 'primevue/usetoast'

function formatearMetodoPago(factura: any): string {
  if (String(factura.metodo_pago || '').toLowerCase() !== 'mixto') return factura.metodo_pago || ''
  const partes: string[] = []
  const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
  if (Number(factura.efectivo) > 0) partes.push(`Efectivo: $${fmt(factura.efectivo)}`)
  if (Number(factura.tarjeta) > 0) partes.push(`Tarjeta: $${fmt(factura.tarjeta)}`)
  if (Number(factura.transferencia) > 0) partes.push(`Transferencia: $${fmt(factura.transferencia)}`)
  if (Number(factura.cheque) > 0) partes.push(`Cheque: $${fmt(factura.cheque)}`)
  return `MIXTO (${partes.join(', ')})`
}
import Toast from 'primevue/toast'

const toast = useToast()
const printerName = ref('')

const DEFAULT_TICKET_CONFIG = {
  printer_name: '',
  paper_width: 80,
  show_logo: 1,
  show_company_name: 1,
  show_legal: 1,
  show_phone: 1,
  show_address: 1,
  show_email: 1,
  show_cliente: 1,
  show_items: 1,
  show_totals: 1,
  show_barcode: 1,
  show_footer: 1,
  show_qr: 0,
  show_nota: 1,
  footer_text: 'Gracias por su compra',
}

function isOn(value: any): boolean {
  return value === true || value === 1 || value === '1'
}

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

function formatCurrency(value: any): string {
  return toNumber(value).toFixed(2)
}

function getProductPrice(producto: any): number {
  return toNumber(producto.precio_venta ?? producto.precio_unitario ?? producto.precio ?? producto.price)
}

function getProductTotal(producto: any): number {
  const cantidad = toNumber(producto.cantidad ?? producto.quantity, 1)
  const precioFinal = toNumber(
    producto.precio_final ?? producto.precio_venta ?? producto.precio_unitario ?? producto.precio ?? producto.price
  )
  return toNumber(producto.total, precioFinal * cantidad)
}

function resolveLogo(empresa: any): string {
  return String(empresa?.logoprinter || empresa?.logo || '').trim()
}

function normalizarAlanubeData(factura: any, ecf: any = {}) {
  const otro = parseJson(factura?.otro, {})
  const response = otro?.alanube_response || factura?.alanube_response || {}
  return {
    documentStampUrl: ecf?.document_stamp_url || factura?.document_stamp_url || factura?.documentStampUrl || otro?.documentStampUrl || otro?.document_stamp_url || response?.documentStampUrl || response?.document_stamp_url || '',
    securityCode: ecf?.security_code || factura?.codigo_seguridad || factura?.securityCode || otro?.securityCode || otro?.security_code || response?.securityCode || response?.security_code || '',
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

function tieneComprobanteElectronico(factura: any): boolean {
  return /^E\d{2}/i.test(String(factura?.ncf || factura?.comprobante || factura?.tipo_comprobante || ''))
}

async function generarQR(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, { width: 200, margin: 1 })
  } catch {
    return ''
  }
}

function generarBarcodeSVG(data: string): string {
  if (!data) return ''
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, data, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 2,
    })
    return new XMLSerializer()
      .serializeToString(svg)
      .replace(/width="[^"]*"/, 'width="180"')
      .replace(/height="[^"]*"/, 'height="55"')
  } catch {
    return ''
  }
}

function buildProductosHTML(productos: any[], simbolo: string, mostrarDescuento: boolean): string {
  return productos.map((producto: any) => {
    const cantidad = toNumber(producto.cantidad ?? producto.quantity, 1)
    const precioVenta = getProductPrice(producto)
    const totalProducto = getProductTotal(producto)
    const descuento = toNumber(producto.descuento)
    const nombre = producto.nombre || producto.descripcion || producto.producto || ''
    const imei = producto.imei ? `<br><span style="font-size:8px;color:#555;">IMEI: ${producto.imei}</span>` : ''

    return `
      <tr>
        <td colspan="${mostrarDescuento ? 5 : 4}" style="overflow-wrap: break-word; font-weight: bold; white-space: normal; word-break: break-word;">
          ${nombre}${imei}
        </td>
      </tr>
      <tr>
        <td style="padding-left:20px;">${cantidad} x</td>
        <td>${producto.empaque || ''}</td>
        <td>${simbolo}${formatCurrency(precioVenta)}</td>
        ${mostrarDescuento ? `<td class="precio centrado">${simbolo}${formatCurrency(descuento)}</td>` : ''}
        <td class="precio centrado" style="text-align:right;">
          <b>${simbolo}${formatCurrency(totalProducto)}</b>
        </td>
      </tr>
    `
  }).join('')
}

function buildTicketHtml({
  factura,
  empresa,
  productos,
  qrCodeData,
  alanubeData,
  ticketConfig,
}: {
  factura: any
  empresa: any
  productos: any[]
  qrCodeData: string
  alanubeData: any
  ticketConfig: any
}) {
  const simbolo = 'RD$'
  const logoEmpresa = resolveLogo(empresa)
  const paperWidth = toNumber(ticketConfig.paper_width, 80)
  const pageWidth = paperWidth === 58 ? 230 : 300
  const bodyWidth = paperWidth === 58 ? 210 : 250
  const ticketWidth = paperWidth === 58 ? 200 : 240
  const descuentoFactura = toNumber(factura.descuento)
  const impuestoFactura = toNumber(factura.impuesto ?? factura.impuestos)
  const totalFactura = toNumber(factura.total)
  const subtotal = toNumber(
    factura.subtotal,
    totalFactura + descuentoFactura - impuestoFactura
  )
  const mostrarDescuento = descuentoFactura > 0 || productos.some((p) => toNumber(p.descuento) > 0)
  const productosHTML = buildProductosHTML(productos, simbolo, mostrarDescuento)
  const otro = parseJson(factura.otro, [])
  const otroPago = Array.isArray(otro) ? otro[0] : {}
  const pagocon = toNumber(otroPago?.pagocon)
  const sucambio = toNumber(otroPago?.sucambio)
  const delivery = otroPago?.delivery || ''
  const rncCliente = factura.rnc_cliente || factura.cedula_cliente || factura.rnc || ''
  const barcodeSvg = generarBarcodeSVG(factura.no_factura || factura.id || '')
  const mostrarQrFiscal = Boolean(qrCodeData && (alanubeData?.documentStampUrl || tieneComprobanteElectronico(factura)))

  const infoParts: string[] = []
  if (isOn(ticketConfig.show_address) && empresa.direccion) infoParts.push(empresa.direccion)
  const pe: string[] = []
  if (isOn(ticketConfig.show_phone) && empresa.telefono) pe.push(empresa.telefono)
  if (isOn(ticketConfig.show_email) && empresa.email) pe.push(empresa.email)
  if (pe.length) infoParts.push(pe.join(' / '))
  if (isOn(ticketConfig.show_legal) && (empresa.legal || empresa.rnc)) infoParts.push(`RNC: ${empresa.legal || empresa.rnc}`)
  const empresaInfoHtml = infoParts.length ? `<div class="info"><p style="width:100%;text-align:center;">${infoParts.join('<br>')}</p></div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket - ${factura.no_factura || ''}</title>
  <style>
    * { font-size: 10px; font-family: Arial, Helvetica, sans-serif; }
    @page { size: ${pageWidth}px auto; margin: 5px; }
    html, body { background-color: #ffffff; }
    body { width: ${bodyWidth}px; margin: 5px; padding: 5px; background-color: #ffffff; color: #000; }
    th { text-align: left; padding: 5px; border-bottom: 1px solid #000; }
    th.centrado { text-align: center; }
    th.precio { text-align: right; }
    .ticket { width: ${ticketWidth}px; padding-top: 10px; padding-bottom: 10px; }
    thead { border-bottom: 2px solid #000; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; }
    td, th { width: ${ticketWidth}px; }
    .bordeado2 { border: 1px solid #000000; border-radius: 5px; padding: 3px; max-width: 150px; margin-top: 5px; }
    .centrado { text-align: center; align-content: center; }
    .derecha { text-align: right; }
    .linea { width: 100%; border-top: 1px solid #000; padding-top: 5px; padding-bottom: 5px; margin-bottom: 5px; padding-right: 10px; }
    .bordeado { border: 1px solid #000000; border-radius: 5px; padding-left: 5px; }
    .info { display: flex; justify-content: space-between; align-items: flex-start; }
    .left-column { flex: 1; padding-right: 10px; }
    .right-column { text-align: left; flex: 0 0 auto; }
    .logos img { display: block; margin-left: auto; margin-right: auto; }
  </style>
</head>
<body>
  <div class="ticket">
    <center id="top">
      <div class="logos" style="text-align: center;">
        ${isOn(ticketConfig.show_logo) && logoEmpresa
          ? `<img src="${logoEmpresa}" alt="Logo" style="max-width: 100px">`
          : ''
        }
        ${isOn(ticketConfig.show_company_name)
          ? `<div style="font-size:18px !important;font-weight:bold">${empresa.nombre || 'MI EMPRESA'}</div>`
          : ''
        }
      </div>
      ${empresaInfoHtml}
    </center>

    <div id="mid" class="bordeado">
      <div class="info">
        <div class="left-column1">
          <p>
            ${factura.fecha_emision ? `Fecha: ${factura.fecha_emision || ''} ${factura.hora || ''}<br>` : ''}
            DOC: <b style="font-size:16px">#${factura.no_factura || ''}</b><br>
            ${factura.ncf || factura.comprobante ? `NCF: ${factura.ncf || factura.comprobante}<br>` : ''}
            ${isOn(ticketConfig.show_cliente) ? `CLIENTE: ${factura.nombre_cliente || 'SIN REGISTRO'}<br>` : ''}
            ${isOn(ticketConfig.show_cliente) && rncCliente ? `CEDULA/RNC: ${rncCliente}<br>` : ''}
            ${isOn(ticketConfig.show_cliente) && factura.telefono_cliente ? `TELEFONO: ${factura.telefono_cliente}<br>` : ''}
            ${isOn(ticketConfig.show_cliente) && factura.direccion_cliente ? `DIRECCION: ${factura.direccion_cliente}<br>` : ''}
            ${factura.vendedor ? `VENDEDOR: ${factura.vendedor}<br>` : ''}
            ${factura.cajero ? `CAJERO: ${factura.cajero}<br>` : ''}
            ${delivery ? `DELIVERY: ${delivery}<br>` : ''}
            ${factura.metodo_pago ? `METODO DE PAGO: ${formatearMetodoPago(factura)}` : ''}
          </p>
        </div>
      </div>
    </div>

    <div class="bordeado" style="text-align:center;padding:3px">
      ${factura.tipo_factura || 'FACTURA DE VENTA'}
    </div>

    ${isOn(ticketConfig.show_items) ? `<table cellspacing="0" cellpadding="0">
      <thead class="linea">
        <tr>
          <th style="text-align:left;padding-top:5px;padding-bottom:5px;">CANT.</th>
          <th class="precio" style="text-align:left;padding-top:5px;padding-bottom:5px;">EMPAQ.</th>
          <th class="precio" style="text-align:left;padding-top:5px;padding-bottom:5px;">PRECIO</th>
          ${mostrarDescuento ? `<th class="precio" style="text-align:left;padding-top:5px;padding-bottom:5px;">DESC</th>` : ''}
          <th class="precio centrado" style="text-align:right;padding-top:5px;padding-bottom:5px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${productosHTML}
      </tbody>
    </table>` : ''}

    ${isOn(ticketConfig.show_totals) ? `<div class="linea" style="margin-top: 30px;"></div>

    <div style="font-weight: bold;">
      <table>
        <tr>
          <td>SUBTOTAL:</td>
          <td style="text-align:right;"><span style="font-size: 1.5em !important;margin-top: 5px;margin-bottom: 5px;">${simbolo}${formatCurrency(subtotal)}</span></td>
        </tr>
      </table>
    </div>` : ''}

    ${isOn(ticketConfig.show_totals) && descuentoFactura > 0 ? `<div style="font-weight: bold;">
      <table>
        <tr>
          <td>DESCUENTO:</td>
          <td style="text-align:right;"><span style="font-size: 1.5em !important;margin-top: 5px;margin-bottom: 5px;">${simbolo}${formatCurrency(descuentoFactura)}</span></td>
        </tr>
      </table>
    </div>` : ''}

    ${isOn(ticketConfig.show_totals) && impuestoFactura > 0 ? `<div style="font-weight: bold;">
      <table>
        <tr>
          <td>ITBIS:</td>
          <td style="text-align:right;"><span style="font-size: 1.5em !important;margin-top: 5px;margin-bottom: 5px;">${simbolo}${formatCurrency(impuestoFactura)}</span></td>
        </tr>
      </table>
    </div>` : ''}

    ${isOn(ticketConfig.show_totals) ? `<div style="font-weight: bold;">
      <table>
        <tr>
          <td>TOTAL:</td>
          <td style="text-align:right;"><span style="font-size: 1.5em !important;margin-top: 5px;margin-bottom: 5px;">${simbolo}${formatCurrency(totalFactura)}</span></td>
        </tr>
      </table>
    </div>` : ''}

    ${isOn(ticketConfig.show_totals) && pagocon > 0 ? `<div style="font-weight: bold;">
      <table>
        <tr>
          <td>PAGO CON:</td>
          <td style="text-align:right;"><span style="font-size: 1.5em !important;margin-top: 5px;margin-bottom: 5px;">${simbolo}${formatCurrency(pagocon)}</span></td>
        </tr>
      </table>
    </div>` : ''}

    ${isOn(ticketConfig.show_totals) && pagocon > 0 ? `<div style="font-weight: bold;">
      <table>
        <tr>
          <td>SU CAMBIO:</td>
          <td style="text-align:right;"><span style="font-size: 1.5em !important;margin-top: 5px;margin-bottom: 5px;">${simbolo}${formatCurrency(sucambio)}</span></td>
        </tr>
      </table>
    </div>` : ''}

    ${isOn(ticketConfig.show_nota) && factura.nota ? `<div class="bordeado" style="min-height:50px"><p>${String(factura.nota).replace(/\n/g, '<br>')}</p></div>` : ''}

    ${isOn(ticketConfig.show_barcode) ? `<div class="barcode">
      <center>
        <div class="bordeado2" style="overflow:hidden;">
          ${barcodeSvg}
        </div>
      </center>
    </div>` : ''}

    ${(isOn(ticketConfig.show_qr) || mostrarQrFiscal) ? `<div id="qrcode" class="qr-code">
      <center>
        <div class="bordeado2">
          <img src="${qrCodeData}" alt="Codigo QR" width="150" height="150"/>
        </div>
        ${alanubeData?.securityCode ? `<div style="font-size:9px;font-weight:bold;margin-top:3px">Codigo Seguridad: ${alanubeData.securityCode}</div>` : ''}
      </center>
    </div>` : ''}

    ${isOn(ticketConfig.show_footer) ? `<div class="linea" style="margin-top: 8px;"></div><div style="text-align:center;">${ticketConfig.footer_text || ''}</div>` : ''}
  </div>
</body>
</html>`
}

async function printTicket(factura: any) {
  let ticketConfig = { ...DEFAULT_TICKET_CONFIG }
  try {
    const resConfig = await window.db.getAll('impresoras_config')
    if (resConfig.success && resConfig.data?.length > 0) {
      ticketConfig = { ...ticketConfig, ...resConfig.data[0] }
      printerName.value = ticketConfig.printer_name || ''
    }
  } catch (_) {}

  const saved = localStorage.getItem('etiquetas_printer')
  if (saved && !ticketConfig.printer_name) printerName.value = saved

  const productos = parseJson(factura.productos, [])

  let empresa: any = {}
  try {
    const res = await window.db.getAll('empresa')
    if (res.success && res.data?.length > 0) empresa = res.data[0]
  } catch (_) {}

  const alanubeData = await obtenerAlanubeData(factura)
  const qrUrl = alanubeData.documentStampUrl || `https://tmposrd.com/factura/${factura.no_factura}`
  const qrCodeData = await generarQR(qrUrl)
  const html = buildTicketHtml({
    factura,
    empresa,
    productos: Array.isArray(productos) ? productos : [],
    qrCodeData,
    alanubeData,
    ticketConfig,
  })

  try {
    const res = await window.electron.invoke('print:ticket', html, printerName.value || undefined)
    if (res.success) toast.add({ severity: 'success', summary: 'Imprimiendo...', life: 2000 })
    else toast.add({ severity: 'error', summary: 'Error', detail: res.error, life: 3000 })
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 })
  }
}

defineExpose({ printTicket })
</script>

<template>
  <div style="display:none">
    <Toast />
  </div>
</template>
