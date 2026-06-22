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
      const almacenId = almacenStore.activeId || 0
      const res = (window as any).config ? await (window as any).config.get('empresa_id') : null
      let empresaId = 0
      if (res?.success) empresaId = Number(res.data) || 0

      let emp = null
      if (empresaId) {
        const r = await (window as any).electron.invoke('db:getById', 'empresa', empresaId)
        if (r.success) emp = r.data
      }
      if (!emp) {
        const r = await (window as any).electron.invoke('db:getWhere', 'empresa', 'almacen_id = ?', [almacenId])
        if (r.success && r.data?.length > 0) {
          emp = r.data[0]
          await (window as any).config.set('empresa_id', String(emp.id))
        }
      }
      if (!emp && almacenId > 0) {
        const r = await (window as any).electron.invoke('db:insert', 'empresa', {
          nombre: 'MI EMPRESA',
          almacen_id: almacenId,
        })
        if (r.success) {
          const r2 = await (window as any).electron.invoke('db:getById', 'empresa', r.data.id)
          if (r2.success) emp = r2.data
          await (window as any).config.set('empresa_id', String(r.data.id))
        }
      }
      if (!emp) {
        const r = await (window as any).electron.invoke('db:getWhere', 'empresa', 'almacen_id = ?', [0])
        if (r.success && r.data?.length > 0) emp = r.data[0]
      }
      if (emp) empresa.value = emp
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
