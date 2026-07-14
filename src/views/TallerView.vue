<script setup lang="ts">
import { ref, shallowRef, computed, nextTick } from 'vue'
import SubMenu from '@/components/SubMenu.vue'
import type { SubMenuItem } from '@/components/SubMenu.vue'
import { useAuthStore } from '@/stores/auth.store'
import OrdenesComp from '@/components/taller/OrdenesComp.vue'
import TecnicosComp from '@/components/taller/TecnicosComp.vue'
import PiezasComp from '@/components/taller/PiezasComp.vue'
import GarantiasComp from '@/components/ventas/GarantiasComp.vue'
import ReporteTallerComp from '@/components/taller/ReporteTallerComp.vue'
import Toast from 'primevue/toast'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'

const auth = useAuthStore()
const toast = useToast()

const expressVisible = ref(false)
const expressForm = ref({ pieza_usada: '', total_reparacion: 0, costo_pieza: 0 })
const ordenesRef = ref<any>(null)
const gananciaExpress = computed(() => (expressForm.value.total_reparacion || 0) - (expressForm.value.costo_pieza || 0))

const allItems: SubMenuItem[] = [
  { label: 'Ordenes', icon: 'pi pi-list', key: 'ordenes' },
  { label: 'Orden Express', icon: 'pi pi-bolt', key: 'orden-express' },
  { label: 'Piezas', icon: 'pi pi-objects-column', key: 'piezas' },
  { label: 'Tecnicos', icon: 'pi pi-users', key: 'tecnicos' },
  { label: 'Garantias', icon: 'pi pi-shield', key: 'garantias' },
  { label: 'Reporte de Taller', icon: 'pi pi-file-export', key: 'reporte' },
]

const items = computed(() => allItems.filter(item => auth.tienePermiso(item.key)))

const components: Record<string, any> = {
  ordenes: OrdenesComp,
  piezas: PiezasComp,
  tecnicos: TecnicosComp,
  garantias: GarantiasComp,
  reporte: ReporteTallerComp,
}

const active = shallowRef('')

function onSelect(key: string) {
  if (key === 'orden-express') {
    expressForm.value = { pieza_usada: '', total_reparacion: 0, costo_pieza: 0 }
    expressVisible.value = true
    return
  }
  active.value = key
}

active.value = items.value.find(i => i.key !== 'orden-express')?.key || items.value[0]?.key || ''

function formatearNumeroOrdenExpress(id: number) {
  return `EXP-${String(id).padStart(6, '0')}`
}

function setActiveComponentRef(el: any) {
  if (active.value === 'ordenes') ordenesRef.value = el
}

async function guardarExpress() {
  try {
    const data: any = {
      nombre: 'REPARACION EXPRESS',
      piezas: expressForm.value.pieza_usada.trim().toUpperCase(),
      total: expressForm.value.total_reparacion || 0,
      precio_pieza: expressForm.value.costo_pieza || 0,
      beneficio_empresa: gananciaExpress.value,
      estado: 'COMPLETADO',
      fecha_entrada: new Date().toISOString().split('T')[0],
    }

    const res = await window.db.insert('ordenes_taller', data)
    if (res.success) {
      const ordenId = Number(res.data?.id || 0)
      const noOrden = ordenId ? formatearNumeroOrdenExpress(ordenId) : ''
      if (ordenId && noOrden) {
        await window.db.update('ordenes_taller', ordenId, { no_orden: noOrden })
      }
      toast.add({ severity: 'success', summary: 'Exito', detail: `Orden express creada${noOrden ? ` #${noOrden}` : ''}`, life: 3000 })
      expressVisible.value = false
      active.value = 'ordenes'
      await nextTick()
      await ordenesRef.value?.cargarOrdenes?.()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear la orden', life: 3000 })
  }
}
</script>

<template>
  <div>
    <Toast />
    <SubMenu :items="items" :active="active" @select="onSelect" />
    <component v-if="active && components[active]" :is="components[active]" :ref="setActiveComponentRef" />
    <div v-else class="text-center py-16 text-surface-400">
      <i class="pi pi-wrench text-3xl mb-2 block"></i>
      <p>No hay modulos disponibles para este usuario</p>
    </div>

    <!-- Modal Orden Express -->
    <Dialog
      v-model:visible="expressVisible"
      header="Orden Express"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="font-semibold text-sm">Pieza Usada</label>
          <InputText v-model="expressForm.pieza_usada" placeholder="Pieza utilizada" fluid class="uppercase" style="text-transform: uppercase;" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Total Reparacion</label>
            <InputNumber v-model="expressForm.total_reparacion" mode="currency" currency="USD" locale="en-US" fluid @focus="($event: any) => $event.target.select()" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-sm">Costo Pieza</label>
            <InputNumber v-model="expressForm.costo_pieza" mode="currency" currency="USD" locale="en-US" fluid @focus="($event: any) => $event.target.select()" />
          </div>
        </div>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <i class="pi pi-dollar text-green-600 dark:text-green-400"></i>
          <span class="font-semibold text-sm text-green-700 dark:text-green-300">Ganancia:</span>
          <span class="font-bold text-green-700 dark:text-green-300">{{ `$${gananciaExpress.toFixed(2)}` }}</span>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="expressVisible = false" />
        <Button label="Guardar" icon="pi pi-check" @click="guardarExpress" />
      </template>
    </Dialog>
  </div>
</template>
