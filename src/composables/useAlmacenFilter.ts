import { useAlmacenStore } from '@/stores/almacen.store'

export function useAlmacenFilter() {
  const store = useAlmacenStore()

  function whereClause(alias = '') {
    const prefix = alias ? `${alias}.` : ''
    const id = store.activeId || 0
    if (!id) return { clause: '1=1', params: [] }
    return { clause: `${prefix}almacen_id = ?`, params: [id] }
  }

  function filterByAlmacen<T extends Record<string, any>>(items: T[]): T[] {
    const id = store.activeId || 0
    if (!id) return items
    return items.filter(item => Number(item.almacen_id) === id || (!item.almacen_id && id === 1))
  }

  function addAlmacenId(data: Record<string, any>) {
    const id = store.activeId || 0
    if (id) data.almacen_id = id
    return data
  }

  return { store, whereClause, filterByAlmacen, addAlmacenId }
}
