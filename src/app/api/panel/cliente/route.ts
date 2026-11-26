import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { haySesion } from "@/lib/sesion";
import { normalizarTelefono, telefonoValido } from "@/lib/telefono";
import { avisoClienteExistente, mismaPersona } from "@/lib/clientes";

/**
 * ¿DE QUIÉN ES ESTE WHATSAPP? — /api/panel/cliente?telefono=…&nombre=…
 * =====================================================================
 * Lo consulta el formulario de "Crear pedido" mientras se escribe, para
 * avisar ANTES de guardar que ese número ya tiene ficha. Es solo un aviso:
 * quien decide de verdad es el servidor en `crearPedido`.
 *
 * Va con el cliente de SESIÓN, así que la RLS responde por él: quien no
 * sea del equipo no recibe ni un nombre. Y devuelve un único cliente
 * buscado por número exacto — nunca una lista que se pueda pasear.
 */
export async function GET(req: NextRequest) {
  if (!(await haySesion())) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const telefono = normalizarTelefono(req.nextUrl.searchParams.get("telefono") ?? "");
  const nombre = (req.nextUrl.searchParams.get("nombre") ?? "").trim();
  if (!telefonoValido(telefono)) {
    return NextResponse.json({ existe: false });
  }

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("telefono", telefono)
    .maybeSingle();

  if (!data) return NextResponse.json({ existe: false });

  return NextResponse.json({
    existe: true,
    id: data.id,
    nombre: data.nombre,
    // Si el nombre tecleado ya coincide, el aviso sobra: reutilizar la
    // ficha de "Camila Rodríguez" cuando escribiste "Camila" es lo que
    // esperas, no una sorpresa.
    coincide: nombre ? mismaPersona(nombre, data.nombre) : false,
    aviso: avisoClienteExistente(data.nombre),
  });
}
