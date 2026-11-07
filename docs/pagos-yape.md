# Pagos de obligaciones e ingresos

En Obligaciones, abre el detalle y elige **Pagar cuota → Yape**. El formulario está preparado para mostrar automáticamente el QR fijo del destinatario **Piero Alexander Mejia Rivera**, sin pedir que cada usuario cargue una imagen.

La imagen original debe estar en `client/public/payments/yape-qr.jpg`. Angular la publica en `/payments/yape-qr.jpg`. Conserva el archivo original para que el QR siga siendo escaneable; no lo reemplaces por un QR generado. No se utilizan los QR guardados anteriormente en el navegador.

El QR es fijo y no cambia según la obligación. Úsalo únicamente cuando ese destinatario corresponda al acuerdo con el acreedor. La pantalla muestra ambos nombres para comprobarlo. También permite registrar un yapeo ya realizado a tu acreedor sin usar este QR.

Marca que ya realizaste el pago y pulsa **Registrar pago realizado**. El número de operación es opcional. Este flujo registra manualmente un pago; no conecta con Yape ni verifica automáticamente transferencias.

Tarjetas de crédito/débito, transferencias y Plin funcionan como simulaciones. Piden los campos correspondientes y validan datos de prueba; no envían esos datos a la API, no realizan cobros y no modifican el saldo. Para tarjetas se usa `4242 4242 4242 4242`, vencimiento futuro y CVV ficticio.

El registro en efectivo o Yape actualiza la cuota y crea su gasto en una transacción PostgreSQL. También invalida las listas y distribuciones de gastos del usuario. El Dashboard vuelve a consultar directamente PostgreSQL al abrirlo o pulsar **Actualizar datos**.

## Pendiente: Yape con confirmación automática

No hay credenciales de una pasarela de pagos configuradas en el proyecto. El QR actual no sustituye esa integración. Para habilitar cobros confirmados por el proveedor se requiere una cuenta de comercio, llaves de integración/producción y desarrollar y probar la confirmación de cada operación antes de actualizar la cuota.

Referencias oficiales revisadas el 4 de octubre de 2026: [Yape para comercios web](https://www.yape.com.pe/preguntas-frecuentes/compras-por-internet/como-puedo-tener-la-opcion-de-compras-por-internet-codigo-de-aprobacion-yape-en-l), [llaves de integración de Culqi](https://docs.culqi.com/es/documentacion/pagos-online/llaves) y [Checkout con Yape](https://docs.culqi.com/es/documentacion/checkout/v4).

La base de datos utiliza `TRANSFER` para transferencias y `WALLET` para billeteras. La API acepta también `BANK_TRANSFER`, `YAPE` y `PLIN`; registra Yape o Plin en las notas. No necesita migraciones.

## Verificación

Desde `api` (PowerShell), las pruebas de integración usan la conexión configurada en `.env`. Crean datos temporales dentro de una transacción y al terminar deshacen todas las escrituras:

```powershell
$env:RUN_DB_TESTS='1'
node --env-file=.env --test --test-isolation=none services/*.test.js
```

Desde `client`:

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

Verificación del 4 de octubre de 2026: 34 pruebas Angular y 10 pruebas API aprobadas, incluyendo PostgreSQL con rollback. Compilación de producción aprobada conservando el límite de 8 kB por componente. Quedan avisos de tamaño de estilos sobre el umbral informativo de 4 kB.
