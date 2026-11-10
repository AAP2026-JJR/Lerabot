import { defineStore } from 'pinia'
import { ref } from 'vue'
import { leerConfiguracion, type DocumentoConfiguracion } from '../servicios/configuracion'

export const useConfiguracionRemota = defineStore('configuracion-remota', () => {
  const cargando = ref(false)
  const mensaje = ref('No consultado.')
  const configuracion = ref<DocumentoConfiguracion | undefined>(undefined)
  const version = ref(0)
  async function cargar() {
    cargando.value = true
    mensaje.value = ''
    try {
      const documento = await leerConfiguracion()
      configuracion.value = documento
      version.value = documento.version ?? 0
      mensaje.value = 'Configuración consultada en DynamoDB.'
    } catch (error) {
      mensaje.value = error instanceof Error ? error.message : 'Error inesperado.'
    } finally { cargando.value = false }
  }
  return { cargando, mensaje, configuracion, version, cargar }
})
