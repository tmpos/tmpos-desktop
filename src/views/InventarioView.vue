<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import SubMenu from '@/components/SubMenu.vue'
import type { SubMenuItem } from '@/components/SubMenu.vue'
import { useAuthStore } from '@/stores/auth.store'
import CategoriasComp from '@/components/inventario/CategoriasComp.vue'
import MarcasComp from '@/components/inventario/MarcasComp.vue'
import TelefonosComp from '@/components/inventario/TelefonosComp.vue'
import AccesoriosComp from '@/components/inventario/AccesoriosComp.vue'
import ElectrodomesticosComp from '@/components/inventario/ElectrodomesticosComp.vue'
import CambiazoComp from '@/components/inventario/CambiazoComp.vue'
import ImeiComp from '@/components/inventario/ImeiComp.vue'
import SerialComp from '@/components/inventario/SerialComp.vue'
import ReporteInventarioComp from '@/components/inventario/ReporteInventarioComp.vue'
import AjustesComp from '@/components/inventario/AjustesComp.vue'
import HistorialPreciosComp from '@/components/inventario/HistorialPreciosComp.vue'
import EtiquetasComp from '@/components/inventario/EtiquetasComp.vue'

const auth = useAuthStore()

const allItems: SubMenuItem[] = [
  { label: 'Telefonos', icon: 'pi pi-mobile', key: 'telefonos' },
  { label: 'Accesorios', icon: 'pi pi-headphones', key: 'accesorios' },
  { label: 'Electrodomesticos', icon: 'pi pi-sitemap', key: 'electrodomesticos' },
  { label: 'IMEI', icon: 'pi pi-barcode', key: 'imei' },
  { label: 'Serial', icon: 'pi pi-qrcode', key: 'serial' },
  { label: 'Categorias', icon: 'pi pi-tags', key: 'categorias' },
  { label: 'Marcas', icon: 'pi pi-bookmark', key: 'marcas' },
  { label: 'Etiquetas', icon: 'pi pi-qrcode', key: 'etiquetas' },
  { label: 'Cambiazo', icon: 'pi pi-sync', key: 'cambiazo' },
  { label: 'Reporte de Inventario', icon: 'pi pi-file-export', key: 'reporte' },
  { label: 'Ajustes', icon: 'pi pi-pencil', key: 'ajustes' },
  { label: 'Historial Precios', icon: 'pi pi-history', key: 'historial-precios' },
]

const items = computed(() => allItems.filter(item => auth.tienePermiso(item.key)))

const components: Record<string, any> = {
  categorias: CategoriasComp,
  marcas: MarcasComp,
  telefonos: TelefonosComp,
  accesorios: AccesoriosComp,
  electrodomesticos: ElectrodomesticosComp,
  imei: ImeiComp,
  serial: SerialComp,
  etiquetas: EtiquetasComp,
  cambiazo: CambiazoComp,
  ajustes: AjustesComp,
  'historial-precios': HistorialPreciosComp,
  reporte: ReporteInventarioComp,
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
