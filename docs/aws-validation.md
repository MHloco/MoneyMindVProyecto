# Validación del paquete AWS — 11 de octubre de 2026

Preparación y pruebas locales, sin crear recursos en una cuenta AWS.

| Comprobación | Resultado |
| --- | --- |
| Docker Compose | Configuración válida; cinco contenedores sanos |
| Imágenes Linux | Angular/nginx, Node y FastAPI construidos correctamente desde lockfiles |
| Base nueva PostgreSQL 18 | Esquema completo, extensiones, restricciones y catálogos importados |
| Pruebas Angular | 59 aprobadas |
| Pruebas Node | 27 aprobadas; 6 integraciones optativas omitidas en ese comando |
| Pruebas Python | 17 aprobadas |
| Prueba HTTP con contenedores | Rutas SPA, registro, login, catálogos, acceso administrativo denegado a usuario normal, análisis de cinco agentes y aislamiento de conversaciones aprobados |

Se corrigió un mock de AuthService desactualizado en la prueba de Obligaciones. El límite de estilos por componente se ajustó a 8 kB de aviso y 12 kB de error para admitir la portada actual de 9,04 kB; el límite del bundle inicial no cambió. Se mantiene un aviso de tamaño de la portada y un aviso de deprecación de TestClient en Python.

La prueba Docker usa una base y claves propias, sin datos del entorno habitual. No configura Gemini ni Gmail: valida el análisis local, pero el chat y los correos deben comprobarse con las credenciales del despliegue final. No se enviaron correos.

La conexión real a RDS, los permisos IAM, la resolución DNS, el certificado HTTPS, la facturación y la disponibilidad del modelo Gemini se deben comprobar en la cuenta de destino. El paquete incluye soporte TLS verificado y la CA pública oficial, pero una prueba local sin TLS no sustituye esa comprobación con RDS.

El generador de ZIP verifica integridad, rutas permitidas, patrones de claves y ausencia de secretos locales conocidos. Genera además un manifiesto SHA-256 de su contenido y un SHA-256 del ZIP. El alcance no equivale a una auditoría completa de seguridad o carga.
