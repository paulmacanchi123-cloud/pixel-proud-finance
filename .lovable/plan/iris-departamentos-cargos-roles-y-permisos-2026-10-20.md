# IRIS — Departamentos, cargos, roles y permisos

## Situación actual

- IRIS ya tiene inicio de sesión, perfiles, un único CEO, 6 departamentos, permisos por departamento y excepciones por usuario, aprobaciones con separación entre solicitante y aprobador, y un registro de auditoría protegido.
- Las pantallas de Usuarios y Departamentos existen pero están vacías.
- Las reglas de seguridad ya se comprueban en el servidor y en la base de datos, no solo en pantalla.
- Las 4 pruebas automáticas pasan antes de cualquier cambio.
- La versión de prueba y la publicada usan la misma base de datos. Cualquier cambio en ella afecta también a la app publicada, aunque solo añadiremos cosas y no borraremos datos.

## Qué se construirá

1. **Cargos**: CEO, Director, Gerente, Subgerente, Socio, Inversionista y Vendedor. El cargo es informativo y nunca da acceso por sí mismo.
2. **Departamentos configurables**: crear, editar, activar/desactivar, describir objetivos y funciones, elegir responsable, departamento superior (sin ciclos) e integrantes. Dirección Ejecutiva queda reservada al CEO. Los departamentos desactivados conservan su historial, pero no conceden permisos.
3. **Roles editables**: el CEO crea roles (por ejemplo "Gerente comercial"), elige sus permisos y el alcance de cada permiso: global, solo su departamento o solo sus propios registros.
4. **Catálogo de permisos** con formato recurso.acción: usuarios, departamentos, roles, permisos, finanzas, ventas, informes, auditoría y ajustes. Los permisos actuales se conservan y se traducen a este catálogo, así no hay dos sistemas paralelos.
5. **Permisos efectivos por usuario**: muestra de dónde viene cada permiso (departamento, rol o excepción), su alcance y avisos de permisos excesivos o conflictivos.
6. **Pantallas**:
   - Departamentos: lista, filtros, ficha, integrantes, jerarquía y permisos.
   - Usuarios: tabla con cargo, departamento y estado, alta de usuarios, suspensión y permisos efectivos.
   - Roles: editor y tabla visual de roles y permisos.
   - Todas tendrán confirmación antes de acciones delicadas, avisos de carga, error y éxito, y mensajes de "sin autorización". Funcionarán en ordenador y en móvil.
7. **Auditoría ampliada**: registrará cambios de departamentos, integrantes, roles, permisos, cargos e intentos rechazados, con quién, cuándo, qué y resultado.

## Reglas de seguridad

- Nadie puede cambiar sus propios permisos, roles, cargo, departamento ni estado.
- Crear usuarios, asignar roles y conceder permisos sigue siendo exclusivo del CEO, como está acordado hoy.
- Directores y gerentes con alcance departamental solo verán su departamento y, si se les autoriza, solo podrán gestionar sus integrantes. No podrán dar privilegios.
- Socios e inversionistas no tendrán acceso financiero por su cargo. Los vendedores, por defecto, solo verán sus propios registros.
- Las aprobaciones mantienen la regla de que nadie aprueba su propia solicitud.

## Límites que conviene conocer

- IRIS todavía no tiene un módulo de ventas. Se crearán sus permisos, pero no hay registros de ventas que proteger.
- Las Finanzas actuales se guardan como un único bloque. "Solo mi departamento" o "solo mis registros" no pueden limitar partes de ese bloque sin rediseñar Finanzas. Por ahora, el acceso a Finanzas será completo o nulo, sin cambiar sus fórmulas.
- Se corregirá la fuga ya detectada: quien vea Finanzas sin permiso de patrimonio dejará de recibir ese valor. Esto cambia una regla de seguridad en la app publicada.

## Pruebas

- Pruebas automáticas de las reglas: sin autoelevación, cargo sin acceso, alcance por departamento y registros propios, departamento desactivado, y bloqueo de Dirección Ejecutiva.
- Comprobación con la cuenta del CEO de crear un departamento, asignar integrantes, crear un rol y ver los permisos efectivos.

## Detalles técnicos

- Solo se añadirán columnas y tablas; no se borrará ni renombrará nada. Habrá columnas nuevas en departamentos y perfiles, más tablas para catálogo, roles, permisos por rol y asignaciones con alcance.
- Todas las tablas nuevas tendrán RLS, permisos de acceso explícitos y la prueba de privilegios centralizada en funciones seguras sin recursión.
- `has_permission` se mantiene compatible con las pantallas actuales y consultará también el nuevo catálogo.
- Las escrituras privilegiadas pasarán por funciones del servidor con comprobación de identidad y auditoría.