<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import SubMenu from '@/components/SubMenu.vue'
import type { SubMenuItem } from '@/components/SubMenu.vue'
import { useAuthStore } from '@/stores/auth.store'
import ClientesComp from '@/components/contactos/ClientesComp.vue'
import UsuariosComp from '@/components/contactos/UsuariosComp.vue'
import ProveedoresComp from '@/components/contactos/ProveedoresComp.vue'

const auth = useAuthStore()

const allItems: SubMenuItem[] = [
  { label: 'Clientes', icon: 'pi pi-user', key: 'clientes' },
  { label: 'Usuarios', icon: 'pi pi-id-card', key: 'usuarios' },
  { label: 'Proveedores', icon: 'pi pi-truck', key: 'proveedores' },
]

const items = computed(() => allItems.filter(item => auth.tienePermiso(item.key)))

const components: Record<string, any> = {
  clientes: ClientesComp,
  usuarios: UsuariosComp,
  proveedores: ProveedoresComp,
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
