# Revisión de pendientes — 4 de octubre de 2026

Se revisó `chatgpt.md` y se mantuvo la separación Angular → API → servicios → PostgreSQL, con acceso privado por JWT y caché separada por usuario.

| Solicitud | Resultado |
| --- | --- |
| Dashboard con datos de gráficos | Verificado con PostgreSQL y navegador: 12 meses de ingresos/gastos, distribución por categorías, presupuestos, cuotas, recordatorios, alertas y movimientos. No se incluyen importes futuros ni otras monedas en los totales de la moneda del usuario. |
| Logout | Sidebar compartido con botón conectado a `AuthService.logout()`. La prueba confirma borrado local y redirección incluso si falla la petición de cierre. |
| Subtítulos dorados | Corregida la prioridad de estilos para que los títulos internos y subtítulos hereden el dorado. Incluye la pantalla de acceso. |
| Suscripciones | Diseño negro/dorado, sidebar, tarjetas de planes, carga/errores, cambio de plan, cancelación y reactivación. Operaciones verificadas con PostgreSQL y rollback; cambios de plan en modo demostración, sin cobros. |
| Pagar cuota | Botón y modal verificados. Validación de montos, prevención de doble envío durante una solicitud, confirmación visible e invalidación de caché de gastos después del pago. Tarjetas, transferencia y Plin se simulan sin cobro ni modificación del saldo. |
| Planes en Home | FREE y PRO cargados desde el catálogo público de la API, con precios, límites y botones de acceso. Verificados en navegador. |

## Alcance de Yape

Disponible: QR configurado y registro manual de pagos ya realizados. Pendiente: integración con una pasarela para confirmar automáticamente el pago real. No se encontraron credenciales de pasarela configuradas. Ver `pagos-yape.md` para el alcance y referencias oficiales. No se hizo ninguna transferencia real durante las pruebas.

## Correcciones completadas en esta revisión

- Error de tipos en la prueba del Dashboard que impedía ejecutar la suite Angular.
- Estilos de sidebar duplicados en Gastos, Ingresos y Obligaciones.
- Separación de la portada animada y las tarjetas de obligaciones en componentes propios para cumplir el límite de compilación sin elevarlo.
- Prioridad insuficiente de los subtítulos dorados frente a estilos internos.
- Mensaje de pago exitoso que se generaba en TypeScript pero no se mostraba en HTML.
- Caché del gráfico de gastos que no se invalidaba al pagar una cuota; invalidación compartida con altas, ediciones y bajas de gastos.

## Verificación

- `client`: `npm.cmd run build` aprobado. Avisos de estilos mayores de 4 kB; ningún componente supera el límite de error de 8 kB.
- `client`: `npm.cmd test -- --watch=false`: 34 pruebas aprobadas.
- `api`: `$env:RUN_DB_TESTS='1'; node --env-file=.env --test --test-isolation=none services/*.test.js`: 10 pruebas aprobadas. Los registros de integración se revierten al finalizar.
- Navegador: Dashboard con gráficos, planes y sidebar de Suscripciones, apertura de detalle/cuota, QR cargado, simulación de tarjeta aprobada sin cambiar saldo y planes en Home.
- Evidencia visual: `artifacts/pago-simulado-verificado.jpg`.

Esta carpeta no contiene un repositorio Git; los cambios están guardados directamente en los archivos del proyecto.
