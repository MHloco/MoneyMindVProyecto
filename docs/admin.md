# Administración

Aplicar la migración antes de reiniciar la API:

```powershell
node api/scripts/migrate-admin.js
node api/scripts/set-superuser.js correo@ejemplo.com
```

El segundo comando habilita una cuenta existente, activa y no eliminada. No crea ni cambia contraseñas. Se conserva para la configuración inicial. No hay registro público de administradores.

Desde `/admin`, **Crear superusuario** permite a un superusuario activo crear otra cuenta con nombre, correo y contraseña de al menos 12 caracteres (máximo 72 bytes UTF-8). El nuevo titular ingresa en `/admin/login`. La operación no reemplaza ni promueve cuentas existentes: devuelve conflicto si el correo ya está registrado.

`POST /api/admin/superusers` recibe `{fullName, email, password}`, verifica permisos en el servidor y al insertar, guarda un hash bcrypt y devuelve solo identificador, nombre, correo y rol. El registro público rechaza el campo `role` y siempre inserta `USER`. Crear una cuenta desde el panel no cambia la sesión del administrador actual.

Iniciar sesión en `http://localhost:4200/admin/login` con el correo habilitado y su contraseña habitual. El login normal también dirige a los superusuarios al panel `/admin`. La barra lateral incluye el acceso a Administración.

El panel muestra métricas de cuentas, búsqueda literal por nombre/correo, filtros por estado/rol, páginas de 20 usuarios y detalles de preferencias. No devuelve contraseñas, tokens ni movimientos financieros. Las cuentas eliminadas están disponibles en el filtro, pero se excluyen de las métricas generales.

Todos los endpoints `/api/admin/*` verifican el JWT y consultan el rol, estado activo y eliminación en PostgreSQL en cada solicitud. Revocar el rol bloquea también sesiones existentes. Cambiar `localStorage` no concede permisos. Login limitado a 10 intentos por IP cada 15 minutos, compartido entre ambos accesos, en memoria de una instancia Node. Para varias instancias se debe usar un contador compartido.

Para revocar acceso, un operador puede ejecutar una consulta parametrizada equivalente a:

```sql
UPDATE users SET role = 'USER', updated_at = now() WHERE email = 'correo@ejemplo.com';
```

Pruebas:

```powershell
cd api
node --test services/admin.test.js
# Integración SQL con datos sintéticos y ROLLBACK:
$env:RUN_DB_TESTS='1'
node --env-file=.env --test services/admin.integration.test.js
```
