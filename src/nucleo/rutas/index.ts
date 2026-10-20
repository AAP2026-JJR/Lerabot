import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/nucleo/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'componentes', name: 'componentes', component: () => import('@/modulos/dashboard/GaleriaComponentesView.vue'), meta: { titulo: 'Galería de componentes' } },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/modulos/dashboard/DashboardView.vue'), meta: { titulo: 'Dashboard' } },
        { path: 'exchanges', name: 'exchanges', component: () => import('@/modulos/exchanges/ExchangesView.vue'), meta: { titulo: 'Exchanges' } },
        { path: 'portafolio', name: 'portafolio', component: () => import('@/modulos/portafolio/PortafolioView.vue'), meta: { titulo: 'Portafolio' } },
        { path: 'operaciones', name: 'operaciones', component: () => import('@/modulos/operaciones/OperacionesView.vue'), meta: { titulo: 'Operaciones' } },
        { path: 'reportes', name: 'reportes', component: () => import('@/modulos/reportes/ReportesView.vue'), meta: { titulo: 'Reportes' } },
        { path: 'configuracion', name: 'configuracion', component: () => import('@/modulos/configuracion/ConfiguracionView.vue'), meta: { titulo: 'Configuración' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
