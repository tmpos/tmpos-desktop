import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import LoginView from '@/views/LoginView.vue'
import HomeView from '@/views/HomeView.vue'
import VenderView from '@/views/VenderView.vue'
import InventarioView from '@/views/InventarioView.vue'
import TallerView from '@/views/TallerView.vue'
import ContabilidadView from '@/views/ContabilidadView.vue'
import VentasView from '@/views/VentasView.vue'
import ReportesView from '@/views/ReportesView.vue'
import ContactosView from '@/views/ContactosView.vue'
import ConfiguracionView from '@/views/ConfiguracionView.vue'
import ComprasView from '@/views/ComprasView.vue'
import TransferenciasView from '@/views/TransferenciasView.vue'
import SoporteView from '@/views/SoporteView.vue'
import ReclamacionesView from '@/views/ReclamacionesView.vue'
import EditarFacturaComp from '@/components/ventas/EditarFacturaComp.vue'

const permisoPorRuta: Record<string, string> = {
  '/': 'home',
  '/inventario': 'inventario',
  '/taller': 'taller',
  '/contactos': 'contactos',
  '/contabilidad': 'contabilidad',
  '/ventas': 'ventas',
  '/reportes': 'reportes',
  '/configuracion': 'configuracion',
  '/vender': 'vender',
  '/compras': 'compras',
  '/transferencias': 'transferencias',
  '/soporte': 'soporte',
  '/reclamaciones': 'reclamaciones',
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/inventario',
      name: 'inventario',
      component: InventarioView,
      meta: { requiresAuth: true },
    },
    {
      path: '/vender',
      name: 'vender',
      component: VenderView,
      meta: { requiresAuth: true },
    },
    {
      path: '/taller',
      name: 'taller',
      component: TallerView,
      meta: { requiresAuth: true },
    },
    {
      path: '/contabilidad',
      name: 'contabilidad',
      component: ContabilidadView,
      meta: { requiresAuth: true },
    },
    {
      path: '/ventas',
      name: 'ventas',
      component: VentasView,
      meta: { requiresAuth: true },
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: ReportesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/reclamaciones',
      name: 'reclamaciones',
      component: ReclamacionesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/soporte',
      name: 'soporte',
      component: SoporteView,
      meta: { requiresAuth: true },
    },
    {
      path: '/transferencias',
      name: 'transferencias',
      component: TransferenciasView,
      meta: { requiresAuth: true },
    },
    {
      path: '/compras',
      name: 'compras',
      component: ComprasView,
      meta: { requiresAuth: true },
    },
    {
      path: '/ventas/editar/:id',
      name: 'editar-factura',
      component: EditarFacturaComp,
      meta: { requiresAuth: true },
    },
    {
      path: '/contactos',
      name: 'contactos',
      component: ContactosView,
      meta: { requiresAuth: true },
    },
    {
      path: '/configuracion',
      name: 'configuracion',
      component: ConfiguracionView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to, _from) => {
  console.log('[Router] Navegando a:', to.fullPath, '| auth:', useAuthStore().isAuthenticated)
  if (to.meta.requiresAuth !== false) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      await auth.checkAuth()
    }
    if (!auth.isAuthenticated) {
      console.log('[Router] Redirigiendo a login')
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    const key = permisoPorRuta[to.path]
    if (key && !auth.tienePermiso(key)) {
      console.log('[Router] Sin permiso para:', to.path)
      return { name: 'home' }
    }
  }
})

router.afterEach((to) => {
  console.log('[Router] Navegacion completada a:', to.fullPath)
})

router.onError((err) => {
  console.error('[Router] Error en navegacion:', err)
})

export default router
