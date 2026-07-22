import { ref, computed } from 'vue'
import { useAlmacenStore } from '@/stores/almacen.store'

const empresa = ref<any>(null)
const loaded = ref(false)

export function useEmpresa() {
  const almacenStore = useAlmacenStore()

  const nombre = computed(() => empresa.value?.nombre || 'MI EMPRESA')
  const logo = computed(() => empresa.value?.logo || '')
  const rnc = computed(() => empresa.value?.legal || '')
  const telefono = computed(() => empresa.value?.telefono || '')
  const email = computed(() => empresa.value?.email || '')
  const direccion = computed(() => empresa.value?.direccion || '')
  const moneda = computed(() => empresa.value?.moneda || 'RD$')
  const impuesto = computed(() => empresa.value?.impuesto ?? 18)
  const impuestoIncluido = computed(() => empresa.value?.impuesto_incluido === 1 || empresa.value?.impuesto_incluido === true)

  async function cargar() {
    try {
      let emp = null
      await almacenStore.load()
      const empresas = await (window as any).electron.invoke('db:getAll', 'empresa')
      if (empresas?.success && Array.isArray(empresas.data) && empresas.data.length > 0) {
        emp = empresas.data.find((item: any) =>
          (almacenStore.activeUid && String(item.uid || item.almacen_uid) === String(almacenStore.activeUid)) ||
          Number(item.almacen_id || item.id) === Number(almacenStore.activeId)
        ) || empresas.data[0]
      }

      if (!emp) {
        const almacenId = almacenStore.activeId || 0
        const r = await (window as any).electron.invoke('db:insert', 'empresa', {
          nombre: 'MI EMPRESA',
          almacen_id: almacenId,
          almacen_uid: almacenStore.activeUid || '',
        })
        if (r.success) {
          const r2 = await (window as any).electron.invoke('db:getById', 'empresa', r.data.id)
          if (r2.success) emp = r2.data
        }
      }
      if (emp) {
        empresa.value = emp
        await (window as any).config?.set?.('empresa_id', String(emp.id))
        ;(window as any).__empresaNombre = emp.nombre || 'MI EMPRESA'
        ;(window as any).__empresaDireccion = emp.direccion || ''
        ;(window as any).__empresaTelefono = emp.telefono || ''
      }
    } catch (_) {}
    loaded.value = true
  }

  async function guardar(data: Record<string, any>) {
    try {
      if (empresa.value?.id) {
        await (window as any).electron.invoke('db:update', 'empresa', empresa.value.id, data)
        empresa.value = { ...empresa.value, ...data }
      } else {
        const r = await (window as any).electron.invoke('db:insert', 'empresa', data)
        if (r.success) {
          empresa.value = { id: r.data.id, ...data }
          await (window as any).config.set('empresa_id', String(r.data.id))
        }
      }
    } catch (_) {}
  }

  return { empresa, loaded, nombre, logo, rnc, telefono, email, direccion, moneda, impuesto, impuestoIncluido, cargar, guardar }
}
