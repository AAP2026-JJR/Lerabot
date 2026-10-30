import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/nucleo/layouts/MainLayout.vue'
import { sesionDemo } from '@/modulos/login/sesionDemo'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/registro', component: () => import('../../modulos/login/RegistroSuscriptorView.vue') },
    { path: '/login', name: 'login', component: () => import('@/modulos/login/LoginDemoView.vue') },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'componentes', name: 'componentes', component: () => import('@/modulos/dashboard/GaleriaComponentesView.vue'), meta: { titulo: 'Galería de componentes' } },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/modulos/dashboard/DashboardView.vue'), meta: { titulo: 'Dashboard' } },
        { path: 'mercado', name: 'mercado', component: () => import('@/modulos/mercado/MercadoView.vue'), meta: { titulo: 'Mercado' } },
        { path: 'exchanges', name: 'exchanges', component: () => import('@/modulos/exchanges/ExchangesView.vue'), meta: { titulo: 'Exchanges' } },
        { path: 'portafolio', name: 'portafolio', component: () => import('@/modulos/portafolio/PortafolioView.vue'), meta: { titulo: 'Portafolio' } },
        { path: 'operaciones', name: 'operaciones', component: () => import('@/modulos/operaciones/OperacionesView.vue'), meta: { titulo: 'Operaciones' } },
        { path: 'reportes', name: 'reportes', component: () => import('@/modulos/reportes/ReportesView.vue'), meta: { titulo: 'Reportes' } },
        { path: 'auditoria', name: 'auditoria', component: () => import('@/modulos/auditoria/AuditoriaView.vue'), meta: { titulo: 'Auditoría' } },
        { path: 'configuracion', name: 'configuracion', component: () => import('@/modulos/configuracion/ConfiguracionView.vue'), meta: { titulo: 'Configuración' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  if (to.path === '/registro') return true
  if (to.path === '/login') return sesionDemo() ? '/dashboard' : true
  if (!sesionDemo()) return '/login'
  return true
})

export default router
