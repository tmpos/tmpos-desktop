<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import InputText from 'primevue/inputtext'
import InputOtp from 'primevue/inputotp'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const mode = ref<'credentials' | 'pin'>('pin')
const usuario = ref('')
const password = ref('')
const pin = ref('')
const loading = ref(false)
const verficando = ref(true)
const pinContainer = ref<HTMLElement | null>(null)

const verificandoLicencia = ref(true)
const licenciaVencida = ref(false)
const licenciaEquipo = ref('')
const licenciaCifrada = ref('')
const licenciaError = ref('')
const licenciaNoEncontrada = ref(false)
const licenciaEquipoNoAutorizado = ref(false)
const licenciaDias = ref<number | null>(null)
const mostrarDiasLicencia = ref(false)
const companyName = ref('')

const mostrarRegistro = ref(false)
const modoRegistro = ref<'licencia' | 'proyecto'>('licencia')
const regGuardando = ref(false)
const regError = ref('')
const regNombre = ref('')
const regEncargado = ref('')
const regTelefono = ref('')
const regEmail = ref('')
const regCodigoGrupo1 = ref('')
const regCodigoGrupo2 = ref('')
const licenciaManualVisible = ref(false)
const licenciaFullCode = ref('')
const licenciaManualError = ref('')
const licenciaManualLoading = ref(false)
const licenciaInputRef = ref<HTMLInputElement | null>(null)
const licenciaRegistroCodigo = ref('')
const licenciaCleanCode = computed(() => licenciaFullCode.value.replace(/-/g, ''))
const registroEquipoVisible = ref(false)
const registroEquipoLoading = ref(false)
const registroEquipoConfirmando = ref(false)
const registroEquipoOtp = ref('')
const registroEquipoEmail = ref('')
const registroEquipoError = ref('')

const LICENCIA_TIMEOUT_MS = 10000

const registroDialogVisible = ref(false)
const turnoDialogVisible = ref(false)
const turnoAbiertoDialogVisible = ref(false)
const turnoAbiertoData = ref<any>(null)
const turnoMontoInicial = ref<number>(0)
const turnoLoading = ref(false)
const turnoPendienteRouter = ref(false)
const turnoMontoInputRef = ref<HTMLInputElement | null>(null)

watch(turnoDialogVisible, (val) => {
  if (val) nextTick(() => turnoMontoInputRef.value?.focus())
})
const soporteDialogVisible = ref(false)
const soporteClave = ref('')
const soporteError = ref('')
const soporteLoading = ref(false)
function claveSoporteActual() {
  const ahora = new Date()
  const h = String(ahora.getHours()).padStart(2, '0')
  const m = String(ahora.getMinutes()).padStart(2, '0')
  return `SP${h}${m}`
}

function withTimeout(promise: Promise<any>, ms: number, label: string) {
  let timeoutId: any
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} excedio ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

async function verificarLicenciaApp() {
  console.log('[Login] Verificando licencia...')
  if ((window as any).__isElectron === false) {
    console.log('[Login] Modo browser - saltando licencia')
    verificandoLicencia.value = false
    verficando.value = false
    enfocarPin()
    return
  }

  verificandoLicencia.value = true
  licenciaError.value = ''

  try {
    const macResult = await withTimeout(
      window.electron.invoke('licencia:getMacAddress'),
      LICENCIA_TIMEOUT_MS,
      'licencia:getMacAddress'
    ) as any
    console.log('[Login] MAC result:', macResult)

    if (macResult.success) {
      licenciaEquipo.value = macResult.data.mac
      licenciaCifrada.value = macResult.data.cifrada
    }

    const offlineOnly = navigator.onLine === false
    console.log('[Login] Enviando verificar..., offlineOnly:', offlineOnly)
    const result = await withTimeout(
      window.electron.invoke('licencia:verificar', { offlineOnly }),
      LICENCIA_TIMEOUT_MS,
      'licencia:verificar'
    ) as any
    console.log('[Login] Resultado licencia:', JSON.stringify(result))

    licenciaNoEncontrada.value = false
    licenciaEquipoNoAutorizado.value = false
    const data = result.data

    if (result.success && data) {
      if (data.codigoLicencia) licenciaRegistroCodigo.value = data.codigoLicencia
      licenciaDias.value = data.diasRestantes ?? null
      const estado = data.estado || result.estado
      if (estado === 'activo' || estado === 'pendiente') {
        verificandoLicencia.value = false
        licenciaVencida.value = false
      } else {
        verificandoLicencia.value = false
        licenciaVencida.value = true
        licenciaError.value = data.mensaje || 'Licencia no registrada'
        if (estado === 'no_encontrada') licenciaNoEncontrada.value = true
        if (estado === 'equipo_no_autorizado') licenciaEquipoNoAutorizado.value = true
      }
    } else {
      if (data?.codigoLicencia) licenciaRegistroCodigo.value = data.codigoLicencia
      verificandoLicencia.value = false
      licenciaVencida.value = true
      licenciaError.value = data?.mensaje || result.error || 'No se pudo verificar la licencia'
      if (result.estado === 'no_encontrada') licenciaNoEncontrada.value = true
      if (result.estado === 'equipo_no_autorizado' || /no esta (autorizado|permitido)/i.test(licenciaError.value)) licenciaEquipoNoAutorizado.value = true
    }
  } catch (e: any) {
    verificandoLicencia.value = false
    licenciaVencida.value = true
    licenciaError.value = e.message || 'Error validando licencia'
  } finally {
    verificandoLicencia.value = false
  }
}

async function verificarNuevamente() {
  await verificarLicenciaApp()
}

async function solicitarRegistroEquipo() {
  registroEquipoError.value = ''
  registroEquipoLoading.value = true
  try {
    const result = await withTimeout(
      window.electron.invoke('licencia:solicitarRegistroEquipo', { licencia: licenciaRegistroCodigo.value }),
      LICENCIA_TIMEOUT_MS,
      'licencia:solicitarRegistroEquipo'
    ) as any

    if (result.success) {
      if (result.pendiente) {
        toast.add({ severity: 'info', summary: 'Solicitud enviada', detail: result.mensaje || 'Espera a que el administrador active tu equipo', life: 5000 })
      } else if (result.yaRegistrado) {
        toast.add({ severity: 'success', summary: 'Equipo ya registrado', detail: result.mensaje || 'Este equipo ya esta registrado', life: 3000 })
        await verificarLicenciaApp()
      } else {
        toast.add({ severity: 'success', summary: 'Equipo registrado', detail: result.mensaje || 'Equipo registrado correctamente', life: 3000 })
        await verificarLicenciaApp()
      }
    } else {
      registroEquipoError.value = result.error || 'No se pudo registrar el equipo'
    }
  } catch (e: any) {
    registroEquipoError.value = e.message || 'Error registrando equipo'
  } finally {
    registroEquipoLoading.value = false
  }
}

async function confirmarRegistroEquipo() {
  registroEquipoError.value = ''
  const codigo = String(registroEquipoOtp.value || '').replace(/\D/g, '')
  if (!/^\d{4}$/.test(codigo)) {
    registroEquipoError.value = 'Introduce el codigo de 4 digitos'
    return
  }

  registroEquipoConfirmando.value = true
  try {
    const result = await withTimeout(
      window.electron.invoke('licencia:confirmarRegistroEquipo', { licencia: licenciaRegistroCodigo.value, codigo }),
      LICENCIA_TIMEOUT_MS,
      'licencia:confirmarRegistroEquipo'
    ) as any

    if (result.success) {
      registroEquipoVisible.value = false
      toast.add({ severity: 'success', summary: 'Equipo activado', detail: result.data?.mensaje || 'Equipo activado correctamente', life: 3000 })
      await verificarLicenciaApp()
    } else {
      registroEquipoError.value = result.error || 'No se pudo activar este equipo'
    }
  } catch (e: any) {
    registroEquipoError.value = e.message || 'Error activando equipo'
  } finally {
    registroEquipoConfirmando.value = false
  }
}

async function verificarTurnoCajero() {
  const esCajero = auth.isCajero || auth.user?.nivel_seguridad?.toLowerCase() === 'cajero'
  console.log('[Login] Verificar turno cajero, rol:', auth.user?.rol, 'nivel:', auth.user?.nivel_seguridad, 'esCajero:', esCajero)
  if (esCajero) {
    console.log('[Login] Buscando turno abierto...')
    const res = await (window as any).electron.invoke('caja:getTurnoAbierto')
    console.log('[Login] Turno abierto:', JSON.stringify(res))
    if (res.success && res.data) {
      turnoAbiertoData.value = res.data
      turnoAbiertoDialogVisible.value = true
      turnoPendienteRouter.value = true
    } else {
      turnoMontoInicial.value = 0
      turnoPendienteRouter.value = true
      turnoDialogVisible.value = true
    }
  } else {
    router.push('/vender')
  }
}

async function cerrarTurnoAnterior() {
  if (!turnoAbiertoData.value) return
  turnoLoading.value = true
  try {
    await (window as any).electron.invoke('caja:cerrarTurno', turnoAbiertoData.value.id)
    turnoAbiertoDialogVisible.value = false
    turnoAbiertoData.value = null
    turnoMontoInicial.value = 0
    turnoDialogVisible.value = true
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cerrar el turno anterior', life: 3000 })
  } finally {
    turnoLoading.value = false
  }
}

async function continuarTurnoAbierto() {
  turnoAbiertoDialogVisible.value = false
  turnoAbiertoData.value = null
  router.push('/vender')
}

async function abrirNuevoTurno() {
  if (!turnoMontoInicial.value || turnoMontoInicial.value < 0) {
    toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Ingresa un monto inicial valido', life: 3000 })
    return
  }
  turnoLoading.value = true
  try {
    await (window as any).electron.invoke('caja:abrirTurno', {
      monto_inicial: turnoMontoInicial.value,
      usuario_id: auth.user?.id || 0,
      usuario_nombre: auth.user?.nombre || auth.user?.usuario || '',
    })
    turnoDialogVisible.value = false
    router.push('/vender')
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo abrir el turno', life: 3000 })
  } finally {
    turnoLoading.value = false
  }
}

async function iniciarSesion() {
  if (mode.value === 'credentials') {
    if (!usuario.value.trim() || !password.value.trim()) {
      toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Usuario y contrasena requeridos', life: 3000 })
      return
    }
    loading.value = true
    const res = await auth.login(usuario.value.trim(), password.value.trim())
    loading.value = false
    console.log('[Login] Login result:', JSON.stringify(res))
    if (res.success) {
      await verificarTurnoCajero()
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error, life: 3000 })
    }
  } else {
    if (!pin.value || pin.value.length < 4) {
      toast.add({ severity: 'warn', summary: 'Atencion', detail: 'Ingresa tu PIN completo', life: 3000 })
      return
    }
    loading.value = true
    const res = await auth.loginWithPin(pin.value)
    loading.value = false
    console.log('[Login] Login result:', JSON.stringify(res))
    if (res.success) {
      await verificarTurnoCajero()
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: res.error, life: 3000 })
    }
  }
}

function enfocarPin() {
  if (mode.value !== 'pin' || verificandoLicencia.value || licenciaVencida.value) return
  nextTick(() => pinContainer.value?.focus())
}

watch(mode, (val) => {
  if (val === 'pin') enfocarPin()
})

async function validarAccesoSoporte() {
  soporteError.value = ''
  if (!soporteClave.value.trim()) {
    soporteError.value = 'Introduce la clave de soporte'
    return
  }
  if (soporteClave.value.trim() !== claveSoporteActual()) {
    soporteError.value = 'Clave incorrecta'
    return
  }
  soporteLoading.value = true
  try {
    const res = await window.db.getAll('usuarios')
    if (!res.success) throw new Error(res.error)
    let soporte = (res.data || []).find(u =>
      u.nivel_seguridad?.toLowerCase() === 'soporte' || u.rol?.toLowerCase() === 'soporte'
    )
    if (!soporte) {
      const insertRes = await window.db.insert('usuarios', {
        nombre: 'SOPORTE', email: 'soporte', pin: '2222', nivel_seguridad: 'Soporte',
        estado: 'ACTIVADO', rol: 'soporte',
      })
      if (!insertRes.success) throw new Error('No se pudo crear usuario soporte')
      const getRes = await window.db.getById('usuarios', insertRes.data.id)
      if (!getRes.success) throw new Error('Error al obtener usuario soporte')
      soporte = getRes.data
    }
    if (!soporte.rol && soporte.nivel_seguridad) {
      soporte.rol = 'soporte'
      await window.db.update('usuarios', soporte.id, { rol: 'soporte' })
    }
    auth.user = soporte
    auth.isAuthenticated = true
    localStorage.setItem('mr_user_id', soporte.id)
    localStorage.setItem('mr_user_usuario', soporte.usuario || soporte.email || '')
    soporteDialogVisible.value = false
    router.push('/')
  } catch (e: any) {
    soporteError.value = e.message || 'Error al acceder como soporte'
  } finally {
    soporteLoading.value = false
  }
}

function abrirDialogoRegistro(tab?: 'licencia' | 'proyecto') {
  regNombre.value = ''
  regEncargado.value = ''
  regTelefono.value = ''
  regEmail.value = ''
  licenciaFullCode.value = ''
  regError.value = ''
  licenciaManualError.value = ''
  regGuardando.value = false
  licenciaManualLoading.value = false
  modoRegistro.value = tab || 'licencia'
  registroDialogVisible.value = true
  nextTick(() => {
    if (modoRegistro.value === 'licencia') licenciaInputRef.value?.focus()
  })
}

async function guardarEmpresaLocal() {
  regError.value = ''
  regGuardando.value = true
  try {
    const result = await withTimeout(
      (window as any).electron.invoke('proyecto:crear', {
        nombre: regNombre.value.trim(),
        system_name: regNombre.value.trim(),
      }),
      25000,
      'proyecto:crear'
    ) as any
    if (result.success) {
      registroDialogVisible.value = false
      toast.add({ severity: 'success', summary: 'Empresa registrada', detail: 'Proyecto y licencia creados correctamente', life: 4000 })
      await verificarLicenciaApp()
    } else {
      const fallback = await withTimeout(
        (window as any).electron.invoke('empresa:guardar', {
          nombre: regNombre.value.trim(),
          encargado: regEncargado.value.trim(),
          telefono: regTelefono.value.trim(),
          email: regEmail.value.trim(),
        }),
        LICENCIA_TIMEOUT_MS,
        'empresa:guardar'
      ) as any
      if (fallback.success) {
        registroDialogVisible.value = false
        toast.add({ severity: 'success', summary: 'Empresa registrada (local)', detail: 'No se pudo crear el proyecto en el servidor. Los datos se guardaron localmente.', life: 5000 })
      } else {
        regError.value = result.error || 'No se pudo crear el proyecto'
      }
    }
  } catch (e: any) {
    regError.value = e.message || 'Error creando proyecto'
  } finally {
    regGuardando.value = false
  }
}

function formatLicenciaCode(val: string) {
  const clean = String(val || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 15)
  const parts = []
  for (let i = 0; i < clean.length; i += 5) parts.push(clean.slice(i, i + 5))
  licenciaFullCode.value = parts.join('-')
  return licenciaFullCode.value
}

function onLicenciaInput(e: Event) {
  const input = e.target as HTMLInputElement
  const formatted = formatLicenciaCode(input.value)
  if (input.value !== formatted) input.value = formatted
}

function onLicenciaKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && licenciaFullCode.value.length === 17) introducirLicenciaManual()
}

function onLicenciaPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') || ''
  const formatted = formatLicenciaCode(text)
  licenciaFullCode.value = formatted
  e.preventDefault()
}

function abrirLicenciaManual() {
  abrirDialogoRegistro('licencia')
}

async function introducirLicenciaManual() {
  const codigo = licenciaFullCode.value
  if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(codigo)) {
    licenciaManualError.value = 'Introduce un codigo valido de 15 caracteres'
    return
  }
  licenciaManualLoading.value = true
  licenciaManualError.value = ''
  try {
    const result = await withTimeout(
      window.electron.invoke('licencia:fetchConfig', codigo),
      LICENCIA_TIMEOUT_MS,
      'licencia:fetchConfig'
    ) as any
    if (result.success) {
      registroDialogVisible.value = false
      toast.add({ severity: 'success', summary: 'Licencia validada', detail: result.data?.mensaje || 'Licencia configurada correctamente', life: 3000 })
      await verificarLicenciaApp()
    } else {
      licenciaManualError.value = result.error || 'No se pudo validar la licencia'
    }
  } catch (e: any) {
    licenciaManualError.value = e.message || 'Error validando licencia'
  } finally {
    licenciaManualLoading.value = false
  }
}

async function registrarLicencia() {
  regError.value = ''
  if (!regNombre.value.trim()) {
    regError.value = 'El nombre de la empresa es requerido'
    return
  }
  await guardarEmpresaLocal()
}

function abrirDialogoSoporte() {
  soporteClave.value = ''
  soporteError.value = ''
  soporteDialogVisible.value = true
}

function onTeclaGlobal(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
    e.preventDefault()
    if (!soporteDialogVisible.value) abrirDialogoSoporte()
    return
  }
  const target = e.target as HTMLElement | null
  const escribiendoEnCampo = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')
  if (escribiendoEnCampo || turnoDialogVisible.value || turnoAbiertoDialogVisible.value) return
  if (e.key === ' ') {
    e.preventDefault()
    cambiarModo()
    return
  }
  if (soporteDialogVisible.value || mode.value !== 'pin') return
  if (e.key >= '0' && e.key <= '9') {
    pin.value = (pin.value + e.key).slice(0, 4)
    if (pin.value.length === 4) iniciarSesion()
    return
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    pin.value = pin.value.slice(0, -1)
    return
  }
  if (e.key === 'Enter' && pin.value.length === 4) {
    iniciarSesion()
    return
  }
}

function cambiarModo() {
  mode.value = mode.value === 'credentials' ? 'pin' : 'credentials'
  pin.value = ''
  password.value = ''
}

onMounted(async () => {
  window.addEventListener('keydown', onTeclaGlobal)

  await auth.checkAuth()
  if (auth.isAuthenticated) {
    router.push('/')
    return
  }

  try {
    const res = await window.db.getAll('empresa') as any
    if (res.success && res.data?.length > 0) {
      companyName.value = res.data[0].nombre || ''
    }
  } catch (_) {}

  await verificarLicenciaApp()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onTeclaGlobal)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-950">
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10" style="background:var(--p-primary-500);filter:blur(80px)"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-5" style="background:var(--p-primary-500);filter:blur(100px)"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-3" style="background:var(--p-primary-500);filter:blur(120px)"></div>
      <div class="absolute inset-0" style="background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,0.02) 1px,transparent 0);background-size:40px 40px"></div>
      <div class="particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>

    <Toast />

    <div v-if="verificandoLicencia" class="flex flex-col items-center justify-center gap-4 relative z-10">
      <i class="pi pi-spin pi-spinner text-3xl text-white"></i>
      <p class="text-white text-sm">Verificando licencia...</p>
    </div>

    <div v-else-if="licenciaVencida" class="w-full max-w-sm p-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-red-500/20">
          <i class="pi pi-exclamation-triangle text-2xl text-red-400"></i>
        </div>
        <h2 class="text-xl font-bold text-white mb-2">Licencia No Valida</h2>
        <p class="text-sm text-gray-400 mb-4">{{ licenciaError || 'Su licencia no esta vigente.' }}</p>
        <div class="bg-white/5 rounded-lg p-3 mb-4 text-left text-sm">
          <div class="flex justify-between text-gray-400"><span>Codigo de Equipo:</span><span class="text-white font-mono text-xs">{{ licenciaEquipo || 'No disponible' }}</span></div>
        </div>

        <div class="text-sm text-gray-400 mb-4">
          <p>Contactenos para activar su licencia:</p>
          <p class="text-orange-400 font-medium">soporte@tmposystem.com</p>
        </div>

        <div class="flex gap-2">
          <button @click="verificarNuevamente" class="flex-1 py-2.5 rounded-lg text-white text-sm font-medium border border-white/20 hover:bg-white/10 transition-all"><i class="pi pi-refresh mr-1"></i>Verificar nuevamente</button>
          <button v-if="licenciaNoEncontrada" @click="abrirDialogoRegistro()" class="flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-all" :style="{ backgroundColor: 'var(--p-primary-500)' }"><i class="pi pi-plus-circle mr-1"></i>Registrar</button>
          <button v-if="licenciaEquipoNoAutorizado" @click="solicitarRegistroEquipo" :disabled="registroEquipoLoading" class="flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50" :style="{ backgroundColor: 'var(--p-primary-500)' }">
            <i v-if="registroEquipoLoading" class="pi pi-spin pi-spinner mr-1"></i><i v-else class="pi pi-desktop mr-1"></i>{{ registroEquipoLoading ? 'Enviando...' : 'Registrar equipo' }}
          </button>
        </div>
        <p v-if="registroEquipoError && !registroEquipoVisible" class="text-red-400 text-xs mt-3">{{ registroEquipoError }}</p>
        <button
          @click="abrirLicenciaManual"
          class="w-full mt-2 py-2.5 rounded-lg text-white text-sm font-medium border border-white/20 hover:bg-white/10 transition-all"
        >
          <i class="pi pi-key mr-1"></i>Introducir licencia
        </button>
      </div>
    </div>

    <div
      v-else
      class="login-neon-card w-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10 transition-all duration-300"
      :class="mode === 'pin' ? 'max-w-[20rem] p-5' : 'max-w-sm p-8'"
    >
      <div class="login-neon-line absolute top-0 left-0 right-0 h-1 rounded-t-2xl" :style="{ backgroundColor: 'var(--p-primary-500)' }"></div>

      <div class="text-center" :class="mode === 'pin' ? 'mb-4' : 'mb-8'">
        <div
          class="mx-auto rounded-xl flex items-center justify-center bg-white transition-all"
          :class="mode === 'pin' ? 'w-11 h-11 mb-2.5' : 'w-16 h-16 mb-4 rounded-2xl'"
        >
          <i class="pi pi-shield" :class="mode === 'pin' ? 'text-lg' : 'text-2xl'" style="color:var(--p-primary-500)"></i>
        </div>
        <h1 class="font-bold text-white" :class="mode === 'pin' ? 'text-xl' : 'text-2xl'">Iniciar Sesion</h1>
        <p class="text-gray-400 mt-0.5" :class="mode === 'pin' ? 'text-xs' : 'text-sm'">{{ companyName || 'ArgentPOS' }}</p>
        <p class="text-[11px] text-gray-500" :class="mode === 'pin' ? 'mt-1' : 'mt-2'">LICENCIA
          <button @click="mostrarDiasLicencia = !mostrarDiasLicencia" class="ml-1 text-gray-500 hover:text-white transition-colors" title="Ver dias restantes">
            <i :class="mostrarDiasLicencia ? 'pi pi-eye-slash' : 'pi pi-eye'" class="text-xs"></i>
          </button>
          <span v-if="mostrarDiasLicencia && licenciaDias !== null" class="ml-1 text-gray-400">&mdash; {{ licenciaDias }} dia(s) restantes</span>
        </p>
      </div>

      <div class="flex p-1 rounded-lg bg-white/5 border border-white/10" :class="mode === 'pin' ? 'mb-4' : 'mb-6'">
        <button
          v-for="tab in [{ key: 'pin', label: 'PIN', icon: 'pi pi-key' }, { key: 'credentials', label: 'Usuario', icon: 'pi pi-user' }]"
          :key="tab.key"
          @click="mode = tab.key as 'credentials' | 'pin'; pin = ''; password = ''"
          class="flex-1 rounded-md text-sm font-medium transition-all cursor-pointer"
          :class="[mode === tab.key ? 'bg-white/10 shadow-sm text-white' : 'text-gray-400 hover:text-gray-300', mode === 'pin' ? 'py-1.5' : 'py-2']"
        >
          <i :class="tab.icon" class="mr-1.5"></i>{{ tab.label }}
        </button>
      </div>

      <form @submit.prevent="iniciarSesion">
        <div v-if="mode === 'credentials'" class="space-y-4">
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Usuario</label>
            <input v-model="usuario" class="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 transition-all" placeholder="Nombre de usuario" autocomplete="username" />
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Contrasena</label>
            <input v-model="password" type="password" class="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 transition-all" placeholder="Contrasena" autocomplete="current-password" />
          </div>
        </div>

        <div v-else ref="pinContainer" tabindex="-1" class="flex flex-col items-center gap-3 outline-none">
          <p class="text-xs text-gray-400">Ingresa tu PIN de acceso</p>
          <div class="flex gap-2">
            <div v-for="i in 4" :key="i" class="w-8 h-9 rounded-lg border flex items-center justify-center font-bold transition-all"
              :class="pin.length >= i ? 'border-white/60 bg-white/10 text-white' : 'border-white/20 text-gray-500'">
              <span v-if="pin.length >= i" class="text-lg">&#9679;</span><span v-else class="text-lg">&#9675;</span>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 w-48">
            <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" type="button" class="w-full h-10 rounded-lg border border-white/10 bg-white/5 text-base font-semibold hover:bg-white/15 hover:border-white/25 active:scale-95 transition-all text-white cursor-pointer" @click="pin = (pin + String(n)).slice(0, 4)">{{ n }}</button>
            <button type="button" title="Borrar" class="w-full h-10 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-red-500/20 hover:border-red-400/30 active:scale-95 transition-all text-red-400 cursor-pointer" @click="pin = pin.slice(0, -1)"><i class="pi pi-delete-left"></i></button>
            <button type="button" class="w-full h-10 rounded-lg border text-base font-semibold active:scale-95 transition-all cursor-pointer" :class="pin.length === 4 ? 'border-white/50 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'" @click="pin = (pin + '0').slice(0, 4)">0</button>
            <button type="button" title="Limpiar PIN" class="w-full h-10 rounded-lg border border-white/10 bg-white/5 text-xs font-medium hover:bg-white/15 active:scale-95 transition-all text-gray-400 cursor-pointer" @click="pin = ''">Limpiar</button>
          </div>
        </div>

        <p v-if="false" class="text-red-400 text-xs mt-3 flex items-center gap-1"><i class="pi pi-exclamation-circle"></i></p>

        <button type="submit" :disabled="loading" class="w-full rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer" :class="mode === 'pin' ? 'mt-3 py-2' : 'mt-5 py-2.5'" :style="{ backgroundColor: 'var(--p-primary-500)' }">
          <i v-if="loading" class="pi pi-spin pi-spinner"></i><i v-else class="pi pi-sign-in"></i>
          <span>Entrar</span>
        </button>
      </form>
      <button
        @click="abrirDialogoRegistro"
        class="w-full rounded-lg text-white font-medium transition-all border border-white/20 hover:bg-white/10"
        :class="mode === 'pin' ? 'mt-2 py-1.5 text-xs' : 'mt-3 py-2 text-sm'"
      >
        <i class="pi pi-refresh mr-1"></i>Registrar / Actualizar licencia
      </button>
    </div>

    <Dialog
      v-model:visible="licenciaManualVisible"
      header="Introducir licencia"
      modal
      :style="{ width: 'min(42rem, 96vw)' }"
      class="license-dialog"
      styleClass="license-dialog"
      contentClass="license-dialog-content"
      :draggable="false"
    >
      <div class="flex flex-col items-center gap-4 pt-2">
        <p class="text-sm text-surface-500 text-center">Introduce el codigo de 15 caracteres.</p>
        <input
          ref="licenciaInputRef"
          :value="licenciaFullCode"
          class="w-full px-3 py-2.5 rounded-lg border border-white/20 bg-gray-800/80 text-white text-sm font-mono text-center tracking-widest placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
          maxlength="17"
          autocomplete="off"
          placeholder="XXXXX-XXXXX-XXXXX"
          @input="onLicenciaInput"
          @paste="onLicenciaPaste"
          @keydown="onLicenciaKeydown"
        />
        <p v-if="licenciaManualError" class="text-red-500 text-xs text-center">{{ licenciaManualError }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="licenciaManualVisible = false" />
        <Button
          label="Validar"
          icon="pi pi-check"
          :loading="licenciaManualLoading"
          @click="introducirLicenciaManual"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="registroEquipoVisible"
      header="Registrar equipo"
      modal
      :style="{ width: 'min(24rem, 92vw)' }"
      class="license-dialog"
      styleClass="license-dialog"
      contentClass="license-dialog-content"
      :draggable="false"
    >
      <div class="flex flex-col items-center gap-4 pt-2">
        <p class="text-sm text-surface-500 text-center">Enviamos un codigo de 4 digitos al correo {{ registroEquipoEmail || 'de la licencia' }}.</p>
        <div class="license-otp">
          <InputOtp
            v-model="registroEquipoOtp"
            :length="4"
            integerOnly
            inputClass="license-otp-input"
          />
        </div>
        <p v-if="registroEquipoError" class="text-red-500 text-xs text-center">{{ registroEquipoError }}</p>
      </div>
      <template #footer>
        <Button label="Reenviar" severity="secondary" text :loading="registroEquipoLoading" @click="solicitarRegistroEquipo" />
        <Button label="Activar" icon="pi pi-check" :loading="registroEquipoConfirmando" @click="confirmarRegistroEquipo" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="registroDialogVisible"
      header="Registrar / Actualizar"
      modal
      :style="{ width: 'min(42rem, 96vw)' }"
      class="license-dialog"
      styleClass="license-dialog"
      contentClass="license-dialog-content"
      :draggable="false"
    >
      <div class="flex p-0.5 rounded-lg bg-white/5 border border-white/10 mb-4">
        <button
          v-for="t in [{ key: 'licencia', label: 'Introducir licencia', icon: 'pi pi-key' }, { key: 'proyecto', label: 'Registrar proyecto', icon: 'pi pi-plus-circle' }]"
          :key="t.key"
          @click="modoRegistro = t.key as 'licencia' | 'proyecto'; regError = ''; licenciaManualError = ''"
          class="flex-1 rounded-md text-sm font-medium transition-all py-2 cursor-pointer"
          :class="[modoRegistro === t.key ? 'bg-white/10 shadow-sm text-white' : 'text-gray-400 hover:text-gray-300']"
        >
          <i :class="t.icon" class="mr-1.5"></i>{{ t.label }}
        </button>
      </div>

      <div v-if="modoRegistro === 'licencia'" class="flex flex-col items-center gap-4 pt-2">
        <p class="text-sm text-gray-400 text-center">Introduce el codigo de licencia de 15 caracteres.</p>
        <input
          ref="licenciaInputRef"
          :value="licenciaFullCode"
          class="w-full px-3 py-2.5 rounded-lg border border-white/20 bg-gray-800/80 text-white text-sm font-mono text-center tracking-widest placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
          maxlength="17"
          autocomplete="off"
          placeholder="XXXXX-XXXXX-XXXXX"
          @input="onLicenciaInput"
          @paste="onLicenciaPaste"
          @keydown="onLicenciaKeydown"
        />
        <p v-if="licenciaManualError" class="text-red-500 text-xs text-center">{{ licenciaManualError }}</p>
      </div>

      <div v-else class="flex flex-col items-center gap-4 pt-2">
        <p class="text-sm text-gray-400 text-center">Registra los datos de la empresa para crear un nuevo proyecto con licencia de prueba.</p>
        <div class="w-full space-y-3">
          <div>
            <label class="text-xs font-medium text-gray-400 mb-1 block">Nombre de la empresa *</label>
            <InputText v-model="regNombre" placeholder="Mi Empresa SRL" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-400 mb-1 block">Encargado</label>
            <InputText v-model="regEncargado" placeholder="Nombre del encargado" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-400 mb-1 block">Telefono</label>
            <InputText v-model="regTelefono" placeholder="809-000-0000" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-400 mb-1 block">Email</label>
            <InputText v-model="regEmail" placeholder="correo@ejemplo.com" class="w-full" />
          </div>
        </div>
        <p v-if="regError" class="text-red-500 text-xs text-center">{{ regError }}</p>
      </div>

      <template #footer>
        <Button label="Cancelar" class="text-gray-600" text @click="registroDialogVisible = false" />
        <Button
          v-if="modoRegistro === 'licencia'"
          label="Validar"
          icon="pi pi-check"
          :loading="licenciaManualLoading"
          @click="introducirLicenciaManual"
        />
        <Button
          v-else
          label="Registrar"
          icon="pi pi-save"
          :loading="regGuardando"
          @click="registrarLicencia"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="soporteDialogVisible"
      header="Acceso Soporte"
      modal
      :style="{ width: 'min(22rem, 92vw)' }"
      :draggable="false"
      :closable="true"
    >
      <div class="flex flex-col items-center gap-4 pt-2">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background:var(--p-primary-500);">
          <i class="pi pi-shield text-2xl text-white"></i>
        </div>
        <p class="text-sm text-surface-500 text-center">Introduce la clave de soporte</p>
        <input
          v-model="soporteClave"
          type="password"
          placeholder="SPHHMM"
          class="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-surface-0 text-surface-900 text-sm placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
          @keydown.enter="validarAccesoSoporte"
        />
        <p v-if="soporteError" class="text-red-500 text-xs text-center">{{ soporteError }}</p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="soporteDialogVisible = false" />
        <Button label="Acceder" icon="pi pi-sign-in" :loading="soporteLoading" @click="validarAccesoSoporte" />
      </template>
    </Dialog>

    <Dialog v-model:visible="turnoAbiertoDialogVisible" header="Turno Abierto" modal :style="{ width: 'min(24rem, 92vw)' }" :closable="false">
      <div class="flex flex-col items-center gap-4 pt-2">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500/20">
          <i class="pi pi-exclamation-triangle text-2xl text-amber-500"></i>
        </div>
        <p class="text-sm text-surface-500 text-center">Hay un turno de caja abierto por <strong>{{ turnoAbiertoData?.usuario_nombre || 'otro usuario' }}</strong> desde {{ turnoAbiertoData?.created_at ? new Date(turnoAbiertoData.created_at).toLocaleString() : '' }}.</p>
        <p class="text-sm text-surface-500 text-center">Monto inicial: <strong>${{ Number(turnoAbiertoData?.monto_inicial || 0).toFixed(2) }}</strong></p>
      </div>
      <template #footer>
        <Button label="Terminar turno y empezar nuevo" icon="pi pi-refresh" :loading="turnoLoading" @click="cerrarTurnoAnterior" severity="danger" />
        <Button label="Continuar de todos modos" icon="pi pi-arrow-right" @click="continuarTurnoAbierto" />
      </template>
    </Dialog>

    <Dialog v-model:visible="turnoDialogVisible" header="Iniciar Turno de Caja" modal :style="{ width: 'min(24rem, 92vw)' }" :closable="false">
      <div class="flex flex-col items-center gap-4 pt-2">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background:var(--p-primary-500);">
          <i class="pi pi-calculator text-2xl text-white"></i>
        </div>
        <p class="text-sm text-surface-500 text-center">Ingresa el monto inicial de caja para comenzar el turno.</p>
        <div class="w-full">
          <label class="text-xs text-surface-400 mb-1 block">Monto inicial ($)</label>
          <input ref="turnoMontoInputRef" v-model.number="turnoMontoInicial" type="number" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-surface-0 text-surface-900 text-sm placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-lg font-bold" @keydown.stop @keydown.enter.prevent="abrirNuevoTurno" />
        </div>
      </div>
      <template #footer>
        <Button label="Abrir Turno" icon="pi pi-check" :loading="turnoLoading" @click="abrirNuevoTurno" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.particles span {
  position: absolute;
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  box-shadow: 0 0 6px 2px rgba(99, 102, 241, 0.6);
  background: radial-gradient(circle at 30% 30%, #a5b4fc, #6366f1);
  opacity: 0;
  animation: particleFloat var(--d, 10s) ease-in-out infinite alternate;
}
.particles span:nth-child(1) { left: 5%; top: 20%; --d: 8s; animation-delay: 0s; }
.particles span:nth-child(2) { left: 15%; top: 60%; --d: 12s; animation-delay: 1s; width: 6px; height: 6px; }
.particles span:nth-child(3) { left: 25%; top: 10%; --d: 10s; animation-delay: 2s; }
.particles span:nth-child(4) { left: 35%; top: 80%; --d: 14s; animation-delay: 0.5s; width: 3px; height: 3px; }
.particles span:nth-child(5) { left: 45%; top: 40%; --d: 9s; animation-delay: 3s; }
.particles span:nth-child(6) { left: 55%; top: 15%; --d: 11s; animation-delay: 1.5s; width: 5px; height: 5px; }
.particles span:nth-child(7) { left: 65%; top: 70%; --d: 13s; animation-delay: 0.8s; }
.particles span:nth-child(8) { left: 75%; top: 30%; --d: 7s; animation-delay: 2.5s; width: 3px; height: 3px; }
.particles span:nth-child(9) { left: 85%; top: 90%; --d: 15s; animation-delay: 1.2s; }
.particles span:nth-child(10) { left: 92%; top: 50%; --d: 10s; animation-delay: 3.5s; width: 6px; height: 6px; }
.particles span:nth-child(11) { left: 8%; top: 75%; --d: 9s; animation-delay: 0.3s; }
.particles span:nth-child(12) { left: 18%; top: 35%; --d: 11s; animation-delay: 2.2s; width: 4px; height: 4px; }
.particles span:nth-child(13) { left: 28%; top: 55%; --d: 13s; animation-delay: 1.8s; }
.particles span:nth-child(14) { left: 38%; top: 25%; --d: 8s; animation-delay: 0.6s; width: 5px; height: 5px; }
.particles span:nth-child(15) { left: 48%; top: 95%; --d: 12s; animation-delay: 2.8s; }
.particles span:nth-child(16) { left: 58%; top: 5%; --d: 14s; animation-delay: 1.4s; width: 3px; height: 3px; }
.particles span:nth-child(17) { left: 68%; top: 45%; --d: 7s; animation-delay: 3.2s; }
.particles span:nth-child(18) { left: 78%; top: 85%; --d: 10s; animation-delay: 0.1s; width: 5px; height: 5px; }
.particles span:nth-child(19) { left: 88%; top: 15%; --d: 11s; animation-delay: 1.6s; }
.particles span:nth-child(20) { left: 95%; top: 65%; --d: 9s; animation-delay: 2.4s; width: 4px; height: 4px; }

.login-neon-card {
  isolation: isolate;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 22px rgba(59, 130, 246, 0.24),
    0 0 58px rgba(59, 130, 246, 0.16),
    0 24px 70px rgba(0, 0, 0, 0.55);
  animation: neonCardPulse 3.8s ease-in-out infinite;
}

.login-neon-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  z-index: -1;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.55), rgba(59, 130, 246, 0.16), rgba(168, 85, 247, 0.45));
  opacity: 0.55;
  filter: blur(14px);
  animation: neonHaloShift 5.5s ease-in-out infinite alternate;
}

.login-neon-line {
  box-shadow:
    0 0 12px rgba(59, 130, 246, 0.9),
    0 0 28px rgba(59, 130, 246, 0.55);
  animation: neonLineSweep 2.8s ease-in-out infinite;
}

:global(.license-dialog) {
  width: min(42rem, calc(100vw - 1.5rem)) !important;
  max-width: calc(100vw - 1.5rem) !important;
}

:global(.license-dialog .p-dialog-content),
:global(.license-dialog-content) {
  overflow-x: hidden !important;
  max-width: 100%;
}

:global(.license-dialog .p-dialog-footer) {
  overflow: hidden !important;
  flex-wrap: wrap;
}

:global(.license-dialog .license-otp) {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: nowrap;
  min-width: 0;
  margin-inline: auto;
}

:global(.license-dialog .license-otp .p-inputotp) {
  flex-wrap: nowrap;
  justify-content: center;
  gap: 0.22rem;
  min-width: 0;
  width: auto !important;
  flex: 0 0 auto !important;
}

:global(.license-dialog .p-inputotp-input),
:global(.license-dialog .license-otp-input) {
  width: 2rem !important;
  min-width: 2rem !important;
  max-width: 2rem !important;
  height: 2.25rem;
  text-transform: uppercase;
  text-align: center;
  padding-left: 0 !important;
  padding-right: 0 !important;
  font-size: 0.95rem;
}

:global(.license-dialog .license-otp-separator) {
  color: var(--p-surface-500);
  font-weight: 700;
  line-height: 1;
  flex: 0 0 auto;
  margin-inline: -0.15rem;
}

@media (max-width: 380px) {
  :global(.license-dialog .license-otp) {
    width: 100%;
    gap: 0.45rem;
  }

  :global(.license-dialog .license-otp .p-inputotp) {
    gap: 0.12rem;
  }

  :global(.license-dialog .p-inputotp-input),
  :global(.license-dialog .license-otp-input) {
    width: 1.45rem !important;
    min-width: 1.45rem !important;
    max-width: 1.45rem !important;
    height: 2.15rem;
    font-size: 0.85rem;
  }
}

@keyframes particleFloat {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10% { opacity: 0.8; }
  90% { opacity: 0.8; }
  100% { transform: translateY(-80px) translateX(20px) scale(1.2); opacity: 0; }
}

@keyframes neonCardPulse {
  0%, 100% {
    transform: translateY(0);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 0 22px rgba(59, 130, 246, 0.24),
      0 0 58px rgba(59, 130, 246, 0.16),
      0 24px 70px rgba(0, 0, 0, 0.55);
  }
  50% {
    transform: translateY(-3px);
    box-shadow:
      0 0 0 1px rgba(125, 211, 252, 0.2),
      0 0 30px rgba(34, 211, 238, 0.36),
      0 0 76px rgba(168, 85, 247, 0.22),
      0 30px 82px rgba(0, 0, 0, 0.62);
  }
}

@keyframes neonHaloShift {
  0% {
    opacity: 0.35;
    transform: scale(0.985);
  }
  100% {
    opacity: 0.7;
    transform: scale(1.02);
  }
}

@keyframes neonLineSweep {
  0%, 100% {
    opacity: 0.7;
    filter: saturate(1);
  }
  50% {
    opacity: 1;
    filter: saturate(1.6);
  }
}
</style>
