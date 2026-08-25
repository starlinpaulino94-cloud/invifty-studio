# Roles y permisos del equipo

Hasta la Etapa C, ser del equipo era todo o nada: quien entraba al panel
podía anular pagos y publicar invitaciones. Ahora cada miembro tiene un rol
en `equipo.rol`, y las acciones sensibles lo comprueban **en el servidor**
(`exigirPermiso`, en `src/lib/auditoria.ts`). Esconder un botón no es
autorización; por eso la interfaz casi no cambió y la barrera está donde
debe.

## Las dos murallas

1. **RLS + lista blanca `equipo`** (desde siempre): sin estar en la lista,
   no se lee una sola fila, tenga el rol que tenga. Es la muralla exterior.
2. **El rol** (desde la Etapa C): reparte lo de dentro. La matriz vive en
   `src/lib/roles.ts` — es código a propósito: cambiarla es un commit
   revisable, no una fila que alguien tocó sin que nadie viera.

## La matriz

| Permiso | propietario | admin | ventas | operaciones | disenador | lectura |
|---|---|---|---|---|---|---|
| Gestionar equipo | ✅ | ✅ | — | — | — | — |
| Crear pedidos | ✅ | ✅ | ✅ | ✅ | — | — |
| Cambiar estados | ✅ | ✅ | ✅ | ✅ | — | — |
| Registrar pagos | ✅ | ✅ | ✅ | ✅ | — | — |
| **Anular pagos** | ✅ | ✅ | — | — | — | — |
| Editar invitaciones | ✅ | ✅ | — | ✅ | ✅ | — |
| Publicar / despublicar | ✅ | ✅ | — | ✅ | — | — |
| Convertir leads | ✅ | ✅ | ✅ | ✅ | — | — |
| Marcar demos | ✅ | ✅ | — | ✅ | — | — |
| Mantenimiento | ✅ | ✅ | — | — | — | — |
| Gestionar cuentas del portal | ✅ | ✅ | — | — | — | — |
| Editar fichas (cliente y pedido) | ✅ | ✅ | ✅ | ✅ | — | — |
| **Eliminar datos (pedidos y clientes)** | ✅ | — | — | — | — | — |

Decisiones deliberadas:

- **Eliminar es SOLO del propietario del negocio.** Borrar un pedido
  arrastra pagos, invitación, invitados y fotos, y no tiene vuelta
  atrás; corregir (editar) es trabajo diario, destruir no. Además exige
  escribir la confirmación y deja rastro en auditoría ANTES de borrar.

- **Anular pagos es de propietario/admin.** Registrar dinero es trabajo
  diario; hacerlo desaparecer del balance es otra categoría.
- **Diseñador no publica.** Publicar entrega y arranca el vencimiento del
  plan: es una decisión operativa, no de diseño. Si un diseñador de
  confianza debe publicar, se le da `operaciones`.
- **`lectura` existe para prestarle el panel a alguien** (un contador, una
  demo) sin que pueda tocar nada.

## Cómo se asigna un rol

En Supabase → SQL Editor (todavía no hay pantalla de equipo; llega con la
gestión de equipo de una etapa posterior):

```sql
update public.equipo set rol = 'ventas'
where email = 'persona@ejemplo.com';
```

Al correr la migración de operaciones, si el equipo era una sola persona,
esa persona quedó como `propietario` automáticamente. Miembros nuevos
entran como `admin` por defecto — **bájalo al darles de alta** si no les
toca todo.

## Qué queda escrito y dónde

| Registro | Tabla | Qué guarda |
|---|---|---|
| Cambios de estado | `historial_estados` | pedido/invitación/lead: de qué, a qué, quién, motivo |
| Acciones sensibles | `auditoria` | pagos, anulaciones, publicaciones, cambios de dirección, conversiones, demos |

Ambas son **inmutables**: sin políticas de update/delete y con un trigger
que rechaza cualquier corrección — un historial corregible no es historial.
El historial del pedido se ve en su ficha, bajo el selector de estado.

A la auditoría van datos técnicos (montos, estados, slugs). **Nunca** listas
de invitados, notas personales ni tokens.

## Si la migración aún no corrió

El código no se cae: `firmante()` asume el reparto de siempre (todos
`admin`) y lo anota en el log del servidor. Las tablas de historial ausentes
hacen que el registro se pierda con nota en el log, sin tumbar la operación.
Corre `supabase/migrations/20260805150000_operaciones.sql` cuanto antes.
