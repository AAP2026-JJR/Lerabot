# Fase 7 - Login demostrativo (NO AUTENTICACION)

Este paquete instala pantalla de login con demo por correo y roles locales. Los datos y el acceso se resuelven con fixtures en `sesionDemo.ts`, **NO desde DynamoDB**. No se crean roles, usuarios o Lambdas AWS y no se valida propiedad del correo.

**No se debe publicar como control de acceso de produccion**. En particular las API existentes siguen publicas y no filtran por propietario. `X-Subscriber-Id` no es prueba de identidad. No inferir admin de header omitido.

Pendiente: crear identidad verificable, registrar ADMIN/SUBSCRIBER en `ledabot-subscribers`, normalizar `sub_001` frente a `SUB_001`, aplicar autorizacion en backend a todos los endpoints, incorporar login real y validar permisos. No usar datos privados antes de completar estos pasos.

Para probar, usar huamaniledesmajose@gmail.com, suscriptor.demo@ejemplo.com o suscriptor2.demo@ejemplo.com.
