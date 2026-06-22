import { uuidv4 } from './util'

function obtenerMacAddress(): string {
  return uuidv4().replace(/-/g, '').toUpperCase().slice(0, 12)
}

function cifrarBase64(valor: string): string {
  return btoa(String(valor || '').trim().toUpperCase())
}

function calcularDiasRestantes(fechaVencimiento?: string): number | null {
  if (!fechaVencimiento) return null
  return Math.ceil((new Date(fechaVencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

let _macAddress = obtenerMacAddress()
let _licenciaCifrada = cifrarBase64(_macAddress)
let _estadoLicencia = 'sin_verificar'
let _nombreEmpresa = ''
let _fechaVencimiento = ''

export async function initLicencia() {
  try {
    const res = await (window as any).db.getAll('licencia')
    if (res.success && res.data && res.data.length > 0) {
      const lic = res.data[0]
      _estadoLicencia = lic.estado || 'sin_verificar'
      _nombreEmpresa = lic.nombre_empresa || ''
      _fechaVencimiento = lic.fecha_vencimiento || ''
    }
  } catch {}
}

export async function handleElectronInvoke(channel: string, ...args: any[]): Promise<any> {
  switch (channel) {
    case 'getServerUrl':
      return { success: true, url: window.location.origin }

    case 'licencia:getMacAddress':
      return { success: true, data: { mac: _macAddress, cifrada: _licenciaCifrada } }

    case 'licencia:getInfo':
      return {
        success: true,
        data: {
          licencia_equipo: _macAddress,
          licencia_cifrada: _licenciaCifrada,
          estado: _estadoLicencia,
          estado_display: _estadoLicencia === 'activo' ? 'Activa' : _estadoLicencia === 'pendiente' ? 'Pendiente' : 'Sin verificar',
          nombre_empresa: _nombreEmpresa,
          dias_restantes: calcularDiasRestantes(_fechaVencimiento),
          ultima_verificacion: new Date().toISOString(),
          fecha_vencimiento: _fechaVencimiento,
        },
      }

    case 'licencia:setApiKey':
      try {
        await (window as any).db.getAll('licencia').then(async (res: any) => {
          if (res.success && res.data && res.data.length > 0) {
            await (window as any).db.update('licencia', res.data[0].id, { api_key: args[0] || '' })
          }
        })
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e.message }
      }

    case 'licencia:getApiKey':
      try {
        const res = await (window as any).db.getAll('licencia')
        const apiKey = res.success && res.data && res.data.length > 0 ? res.data[0].api_key : null
        return { success: true, data: { configurada: !!apiKey } }
      } catch {
        return { success: true, data: { configurada: false } }
      }

    case 'licencia:registrar':
      try {
        const payload = args[0] || {}
        const mac = _macAddress
        const now = new Date().toISOString()
        const fechaVenc = payload.proximopago || new Date(Date.now() + 7 * 86400000).toISOString()
        await (window as any).db.getAll('licencia').then(async (res: any) => {
          if (res.success && res.data && res.data.length > 0) {
            await (window as any).db.update('licencia', res.data[0].id, {
              licencia_equipo: mac,
              licencia_cifrada: _licenciaCifrada,
              estado: 'PENDIENTE',
              nombre_empresa: payload.nombre || '',
              fecha_inicio_prueba: now,
              fecha_vencimiento: fechaVenc,
              ultima_verificacion: now,
            })
          }
        })
        _estadoLicencia = 'PENDIENTE'
        _nombreEmpresa = payload.nombre || ''
        _fechaVencimiento = fechaVenc
        return { success: true, data: { mensaje: 'Licencia registrada correctamente' } }
      } catch (e: any) {
        return { success: false, error: e.message }
      }

    case 'licencia:verificar': {
      const offlineMode = true
      const diasRestantes = calcularDiasRestantes(_fechaVencimiento) || 365
      const success = _estadoLicencia === 'activo' || _estadoLicencia === 'pendiente' || _estadoLicencia === 'sin_verificar'
      const effectiveDias = _estadoLicencia === 'sin_verificar' ? 7 : diasRestantes
      return {
        success,
        estado: success ? 'activo' : 'vencida',
        data: {
          estado: success ? 'activo' : 'vencida',
          mensaje: success ? `Licencia activa - ${effectiveDias} dia(s) restantes` : 'Licencia vencida',
          diasRestantes: effectiveDias,
        },
        verificadoOnline: false,
      }
    }

    case 'enviar:testEmail':
      return { success: true, message: 'Correo de prueba enviado (simulado)' }

    case 'enviar:cierreCaja':
      return { success: false, error: 'El envio SMTP del cierre esta disponible en la aplicacion de escritorio' }

    case 'consultaservidor':
      return handleConsultaservidor(args[0], args.slice(1))

    case 'print:ticket': {
      const html = args[0] || ''
      try {
        const printWindow = window.open('', '_blank', 'width=480,height=800')
        if (printWindow) {
          printWindow.document.write(html)
          printWindow.document.close()
          printWindow.focus()
          setTimeout(() => {
            printWindow.print()
            setTimeout(() => printWindow.close(), 500)
          }, 500)
        }
      } catch {}
      return { success: true }
    }

    case 'generate:pdf':
      return { success: true, dataUrl: '' }

    case 'pdf:generateToFile':
      return { success: true, filePath: '' }

    case 'save:pdf':
      return { success: true }

    case 'backup:create':
      return { success: true }

    case 'backup:list':
      return { success: true, data: [] }

    case 'backup:download':
      return { success: false, error: 'No disponible en Android' }

    case 'backup:delete':
      return { success: true }

    case 'backup:restore':
      return { success: false, error: 'No disponible en Android' }

    case 'getPrinters':
      return { success: true, data: [] }

    case 'scan:bluetooth':
      return { success: true, data: [] }

    case 'print:bluetooth-raw':
      return { success: true }

    case 'app:getVersion':
      return '2.7.0'

    case 'app:getName':
      return 'MR Cutti Technology'

    case 'app:getConfig':
      return { success: false, error: 'No disponible en Android' }

    case 'update:check':
      return { success: false, error: 'No disponible en Android' }

    case 'update:download':
      return { success: false, error: 'No disponible en Android' }

    case 'update:downloadAuto':
      return { success: false, error: 'No disponible en Android' }

    case 'update:install':
      return { success: false, error: 'No disponible en Android' }

    case 'imei:consultar':
      try {
        const response = await fetch('https://demo.tmposrd.com/api2/consultaimei', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args[0] || {}),
        })
        const data = await response.json()
        return { success: true, data }
      } catch (e: any) {
        return { success: false, error: e.message }
      }

    case 'open:devtools':
      return { success: true }

    case 'clipboard:copyFile':
      return { success: true }

    default:
      console.warn('[CapacitorElectron] Unhandled channel:', channel, args)
      return { success: false, error: 'No disponible en Android' }
  }
}

async function handleConsultaservidor(action: string, args: any[]): Promise<any> {
  switch (action) {
    case 'getAllConfig':
      return {
        VITE_LINKURL: '',
        VITE_LINK_API: '',
        VITE_TOKEN: '',
        VITE_PATRON_TELEFONO: '^[0-9]{10}$',
        VITE_IMPRESORA_LOCAL: '',
        VITE_PATRON_CEDULA: '^[0-9]{11}$',
        VITE_TOKEN_CORTO: '',
      }

    case 'tableExists':
      return (window as any).db?.getAll(args[0]).then((r: any) =>
        r.success && r.data && r.data.length > 0 ? ['ok'] : ['error']
      )

    case 'getTableColumns':
      return (window as any).db?.getAll(args[0]).then((r: any) => {
        if (r.success && r.data && r.data.length > 0) {
          return Object.keys(r.data[0]).map((name: string) => ({ name, type: 'TEXT' }))
        }
        return []
      })

    case 'getAllTables':
      return { data: [] }

    case 'rawQuery':
      return { success: false, error: 'No disponible directamente' }

    case 'executeSQL':
      return { success: false, error: 'Usar db API en su lugar' }

    case 'vaciarTabla':
      return { success: false, error: 'No disponible directamente' }

    case 'eliminarTabla':
      return { success: false, error: 'No disponible directamente' }

    case 'getCreateTableSQL':
      return { success: true, sql: '' }

    case 'getTableRowCount':
      return { success: true, count: 0 }

    case 'crearTabla':
      return { success: false, error: 'No disponible directamente' }

    case 'addColumnToTable':
      return ['ok']

    default:
      return null
  }
}
