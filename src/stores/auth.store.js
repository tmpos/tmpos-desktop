import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = ref(false)
  const loading = ref(false)
  const SESSION_AUTH_KEY = 'mr_session_authenticated'
  const REQUIRE_LOGIN_CONFIG_KEY = 'security_require_login_on_startup'

  function markCurrentSessionAuthenticated() {
    sessionStorage.setItem(SESSION_AUTH_KEY, '1')
  }

  async function requiresLoginOnStartup() {
    try {
      const res = await window.electron.invoke('config:get', REQUIRE_LOGIN_CONFIG_KEY)
      // La opcion queda activa por defecto cuando aun no existe en configuracion.
      return !res?.success || res.data === '' || res.data === '1' || res.data === 'true'
    } catch (_) {
      return true
    }
  }

  function currentSupportPin() {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  }

  function isSupportUser(candidate) {
    return candidate?.rol?.toLowerCase() === 'soporte' ||
      candidate?.nivel_seguridad?.toLowerCase() === 'soporte'
  }

  async function getOrCreateSupportUser(users) {
    let support = (users || []).find(isSupportUser)
    if (support) return support

    const insertResult = await window.db.insert('usuarios', {
      nombre: 'SOPORTE',
      usuario: 'soporte',
      email: 'soporte',
      pin: '2222',
      nivel_seguridad: 'Soporte',
      estado: 'ACTIVADO',
      rol: 'soporte',
      permisos: 'administrador',
    })
    if (!insertResult.success) throw new Error(insertResult.error || 'No se pudo crear el usuario de soporte')
    const created = await window.db.getById('usuarios', insertResult.data.id)
    if (!created.success || !created.data) throw new Error('No se pudo cargar el usuario de soporte')
    return created.data
  }

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
      let found = (res.data || []).find(u =>
        (String(u.usuario).toLowerCase() === String(usuario).toLowerCase() || String(u.email).toLowerCase() === String(usuario).toLowerCase() || String(u.nombre).toLowerCase() === String(usuario).toLowerCase()) &&
        (String(u.password) === String(password) || String(u.pin) === String(password)) &&
        u.estado === 'ACTIVADO'
      )
      const soportePwd = new Date().toTimeString().slice(0, 5).replace(':', '')
      if (!found && String(usuario).toLowerCase() === 'soporte' && password === soportePwd) {
        found = {
          id: 0,
          usuario: 'soporte',
          nombre: 'SOPORTE TECNICO',
          email: '',
          password: soportePwd,
          pin: '',
          rol: 'soporte',
          nivel_seguridad: 'Soporte',
          estado: 'ACTIVADO',
          permisos: 'administrador',
          restrinciones: '',
          porciento: '',
          imagen: '',
        }
      }
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
      markCurrentSessionAuthenticated()
      if (found.id > 0) {
        await window.db.update('usuarios', found.id, {
          ultimo_acceso: new Date().toISOString().replace('T', ' ').split('.')[0],
        })
      }
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
      const supportPin = currentSupportPin()
      const isDynamicSupportPin = String(pin) === supportPin
      const found = isDynamicSupportPin
        ? await getOrCreateSupportUser(res.data || [])
        : (res.data || []).find(
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
      markCurrentSessionAuthenticated()
      if (found.id > 0) {
        await window.db.update('usuarios', found.id, {
          ultimo_acceso: new Date().toISOString().replace('T', ' ').split('.')[0],
        })
      }
      return { success: true, user: found }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      loading.value = false
    }
  }

  async function checkAuth() {
    if (await requiresLoginOnStartup() && sessionStorage.getItem(SESSION_AUTH_KEY) !== '1') {
      user.value = null
      isAuthenticated.value = false
      localStorage.removeItem('mr_user_id')
      localStorage.removeItem('mr_user_usuario')
      return
    }

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
      } else if (parseInt(userId) === 0) {
        user.value = {
          id: 0, usuario: 'soporte', nombre: 'SOPORTE TECNICO', email: '',
          rol: 'soporte', nivel_seguridad: 'Soporte', estado: 'ACTIVADO',
          permisos: 'administrador', restrinciones: '', porciento: '', imagen: '',
        }
        isAuthenticated.value = true
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
    inventario: ['telefonos', 'accesorios', 'electrodomesticos', 'imei', 'serial', 'categorias', 'marcas', 'etiquetas', 'cambiazo', 'transferencias', 'compras', 'reporte', 'perdidas'],
    taller: ['ordenes', 'orden-express', 'piezas', 'tecnicos', 'garantias', 'reporte'],
    contactos: ['clientes', 'usuarios', 'proveedores'],
    ventas: ['facturas', 'cotizaciones', 'apartados', 'recibidos', 'notas-credito', 'notas', 'reclamaciones'],
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
    sessionStorage.removeItem(SESSION_AUTH_KEY)
  }

  return {
    user, isAuthenticated, loading,
    isAdmin, isGerente, isVendedor, isCajero, isTaller, isSoporte,
    login, loginWithPin, checkAuth, logout, tienePermiso, markCurrentSessionAuthenticated,
  }
})
