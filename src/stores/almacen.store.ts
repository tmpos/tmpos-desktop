import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAlmacenStore = defineStore('almacen', () => {
  const almacenes = ref<any[]>([])
  const activeId = ref(Number(localStorage.getItem('almacen_id')) || 0)

  const activeAlmacen = computed(() => almacenes.value.find(a => a.id === activeId.value) || null)
  const hasMultiple = computed(() => almacenes.value.length > 1)

  async function load() {
    try {
      const res = await (window as any).electron.invoke('db:getAll', 'almacenes')
      if (res.success && res.data) {
        almacenes.value = res.data
        const saved = localStorage.getItem('almacen_id')
        if (saved && res.data.some((a: any) => a.id === Number(saved))) {
          activeId.value = Number(saved)
        } else if (!activeId.value && res.data.length > 0) {
          activeId.value = res.data[0].id
        }
      }
    } catch {}
  }

  function select(id: number) {
    activeId.value = id
    localStorage.setItem('almacen_id', String(id))
  }

  return { almacenes, activeId, activeAlmacen, hasMultiple, load, select }
})
