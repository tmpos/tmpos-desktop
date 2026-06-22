import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = ref(false)
  const loading = ref(false)

  const nivel = computed(() => user.value?.nivel_seguridad?.toLowerCase() || '')
  const isAdmin = computed(() => user.value?.rol === 'administrador' || nivel.value === 'administrador')
  const isGerente = computed(() => user.value?.rol === 'gerente' || nivel.value === 'gerente')
  const isVendedor = computed(() => user.value?.rol === 'vendedor' || nivel.value === 'vendedor' || nivel.value === 'usuario')
  const isCajero = computed(() => user.value?.rol === 'cajero' || nivel.value === 'cajero')
  const isTaller = computed(() => user.value?.rol === 'taller' || nivel.value === 'taller')
  const isSoporte = computed(() => user.value?.rol === 'soporte' || nivel.value === 'soporte')

  async function login(usuario, password) {
    loading.value = true
    try {
      const res = await window.db.getAll('usuarios')
      if (!res.success) throw new Error(res.error)
      const found = (res.data || []).find(u =>
        (String(u.usuario).toLowerCase() === String(usuario).toLowerCase() || String(u.email).toLowerCase() === String(usuario).toLowerCase() || String(u.nombre).toLowerCase() === String(usuario).toLowerCase()) &&
        (String(u.password) === String(password) || String(u.pin) === String(password)) &&
        u.estado === 'ACTIVADO'
      )
      if (!found) {
        throw new Error('Usuario o contrasena incorrectos')
      }
      if (!found.rol && found.nivel_seguridad) {
        const rolMap = { Administrador: 'administrador', Usuario: 'vendedor', Vendedor: 'vendedor', Cajero: 'cajero', Soporte: 'soporte', Taller: 'taller', Gerente: 'gerente' }
        found.rol = rolMap[found.nivel_seguridad] || 'vendedor'
        await window.db.update('usuarios', found.id, { rol: found.rol })
      }
      user.value = found
      isAuthenticated.value = true
      localStorage.setItem('mr_user_id', found.id)
      localStorage.setItem('mr_user_usuario', found.usuario || found.email || '')
      await window.db.update('usuarios', found.id, {
        ultimo_acceso: new Date().toISOString().replace('T', ' ').split('.')[0],
      })
      return { success: true, user: found }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      loading.value = false
    }
  }

  async function loginWithPin(pin) {
    loading.value = true
    try {
      const res = await window.db.getAll('usuarios')
      if (!res.success) throw new Error(res.error)
      const found = (res.data || []).find(
        u => String(u.pin) === String(pin) && u.estado === 'ACTIVADO'
      )
      if (!found) {
        throw new Error('PIN incorrecto')
      }
      if (!found.rol && found.nivel_seguridad) {
        const rolMap = { Administrador: 'administrador', Usuario: 'vendedor', Vendedor: 'vendedor', Cajero: 'cajero', Soporte: 'soporte', Taller: 'taller', Gerente: 'gerente' }
        found.rol = rolMap[found.nivel_seguridad] || 'vendedor'
        await window.db.update('usuarios', found.id, { rol: found.rol })
      }
      user.value = found
      isAuthenticated.value = true
      localStorage.setItem('mr_user_id', found.id)
      localStorage.setItem('mr_user_usuario', found.usuario || found.email || '')
      await window.db.update('usuarios', found.id, {
        ultimo_acceso: new Date().toISOString().replace('T', ' ').split('.')[0],
      })
      return { success: true, user: found }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      loading.value = false
    }
  }

  async function checkAuth() {
    const userId = localStorage.getItem('mr_user_id')
    if (!userId) return
    try {
      const res = await window.db.getById('usuarios', parseInt(userId))
      if (res.success && res.data && res.data.estado === 'ACTIVADO') {
        if (!res.data.rol && res.data.nivel_seguridad) {
          const rolMap = { Administrador: 'administrador', Usuario: 'vendedor', Vendedor: 'vendedor', Cajero: 'cajero', Soporte: 'soporte', Taller: 'taller', Gerente: 'gerente' }
          res.data.rol = rolMap[res.data.nivel_seguridad] || 'vendedor'
        }
        user.value = res.data
        isAuthenticated.value = true
        localStorage.setItem('mr_user_usuario', res.data.usuario || res.data.email || '')
      } else {
        localStorage.removeItem('mr_user_id')
        localStorage.removeItem('mr_user_usuario')
      }
    } catch (_) {
      localStorage.removeItem('mr_user_id')
      localStorage.removeItem('mr_user_usuario')
    }
  }

  const subPermisos = {
    inventario: ['telefonos', 'accesorios', 'electrodomesticos', 'imei', 'serial', 'categorias', 'marcas', 'etiquetas', 'cambiazo', 'reporte'],
    taller: ['ordenes', 'orden-express', 'piezas', 'tecnicos', 'reporte'],
    contactos: ['clientes', 'usuarios', 'proveedores'],
    ventas: ['facturas', 'cotizaciones', 'apartados', 'recibidos', 'notas-credito', 'notas'],
    reportes: ['general', '606', '607', 'gastos', 'ventas', 'ganancias'],
    contabilidad: ['caja', 'comprar', 'cuadre', 'cxc', 'cxp', 'bancos', 'gastos', 'gastos-fijos', 'utilidades', 'catalogo', 'balance', 'comprobantes'],
  }

  function tienePermiso(key) {
    if (!user.value) return false
    if (user.value.nivel_seguridad?.toLowerCase() === 'soporte' || user.value.rol?.toLowerCase() === 'soporte') return true
    if (!user.value.permisos) return true
    try {
      const permisos = JSON.parse(user.value.permisos)
      if (!Array.isArray(permisos) || !permisos.length) return true
      if (permisos.includes(key)) return true
      const subs = subPermisos[key]
      if (subs && subs.some(s => permisos.includes(s))) return true
      return false
    } catch {
      return true
    }
  }

  function logout() {
    user.value = null
    isAuthenticated.value = false
    localStorage.removeItem('mr_user_id')
    localStorage.removeItem('mr_user_usuario')
  }

  return {
    user, isAuthenticated, loading,
    isAdmin, isGerente, isVendedor, isCajero, isTaller, isSoporte,
    login, loginWithPin, checkAuth, logout, tienePermiso,
  }
})
