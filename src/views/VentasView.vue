<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import SubMenu from '@/components/SubMenu.vue'
import type { SubMenuItem } from '@/components/SubMenu.vue'
import { useAuthStore } from '@/stores/auth.store'
import FacturasComp from '@/components/ventas/FacturasComp.vue'
import CotizacionesComp from '@/components/ventas/CotizacionesComp.vue'
import ApartadosComp from '@/components/ventas/ApartadosComp.vue'
import RecibidosComp from '@/components/ventas/RecibidosComp.vue'
import NotasCreditoComp from '@/components/ventas/NotasCreditoComp.vue'
import NotasAdminComp from '@/components/ventas/NotasAdminComp.vue'
import GarantiasComp from '@/components/ventas/GarantiasComp.vue'

const auth = useAuthStore()

const allItems: SubMenuItem[] = [
  { label: 'Facturas', icon: 'pi pi-file', key: 'facturas' },
  { label: 'Cotizaciones', icon: 'pi pi-file-edit', key: 'cotizaciones' },
  { label: 'Apartados', icon: 'pi pi-bookmark', key: 'apartados' },
  { label: 'Recibidos', icon: 'pi pi-download', key: 'recibidos' },
  { label: 'Notas de Credito', icon: 'pi pi-file-minus', key: 'notas-credito' },
  { label: 'Notas', icon: 'pi pi-pencil', key: 'notas' },
  { label: 'Garantias', icon: 'pi pi-shield', key: 'garantias' },
]

const items = computed(() => allItems.filter(item => auth.tienePermiso(item.key)))

const components: Record<string, any> = {
  facturas: FacturasComp,
  cotizaciones: CotizacionesComp,
  apartados: ApartadosComp,
  recibidos: RecibidosComp,
  'notas-credito': NotasCreditoComp,
  notas: NotasAdminComp,
  garantias: GarantiasComp,
}

const active = shallowRef('')

function onSelect(key: string) {
  active.value = key
}

active.value = items.value.length > 0 ? items.value[0].key : ''
</script>

<template>
  <div>
    <SubMenu :items="items" :active="active" @select="onSelect" />
    <component :is="components[active]" />
  </div>
</template>
