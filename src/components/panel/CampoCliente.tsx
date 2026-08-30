"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

/**
 * LOS DATOS DEL CLIENTE, AL CREAR UN PEDIDO
 * ==========================================
 * Existe por un fallo real: se creaba un pedido con un nombre nuevo y la
 * ficha salía a nombre de un cliente de prueba, porque el WhatsApp era el
 * mismo y el sistema reutilizaba la ficha sin decirlo. Aquí se dice: en
 * cuanto el número está completo se pregunta de quién es, y si no cuadra
 * con el nombre tecleado hay que marcar la casilla para seguir.
 *
 * El aviso es cortesía; el freno de verdad está en el servidor
 * (crearPedido, lib/acciones.ts). Esconder un botón no es seguridad, y
 * enseñar un aviso tampoco es una comprobación.
 */

const inputBase =
  "w-full bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none transition-colors";
const labelBase = "block text-xs font-semibold text-gray-600 mb-1.5";

type Hallazgo = {
  existe: boolean;
  id?: string;
  nombre?: string;
  coincide?: boolean;
  aviso?: string;
  /** A qué número respondió: un aviso viejo señalaría a otra ficha. */
  para?: string;
};

export default function CampoCliente() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [hallazgo, setHallazgo] = useState<Hallazgo | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const digitos = telefono.replace(/\D/g, "");

  useEffect(() => {
    // Se espera a que la mano pare de escribir: sin esto, cada tecla del
    // teléfono sería una consulta.
    const control = new AbortController();
    const t = setTimeout(async () => {
      if (digitos.length < 10) {
        setHallazgo(null);
        return;
      }
      try {
        const r = await fetch(
          `/api/panel/cliente?telefono=${encodeURIComponent(digitos)}&nombre=${encodeURIComponent(nombre)}`,
          { signal: control.signal }
        );
        if (!r.ok) return;
        setHallazgo({ ...((await r.json()) as Hallazgo), para: digitos });
      } catch {
        // Si la consulta falla, no se dice nada: el servidor sigue siendo
        // quien decide, y un aviso a medias confunde más que ayudar.
      }
    }, 400);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [digitos, nombre]);

  // El aviso solo vale para el número que se está viendo: si el aviso
  // sobreviviera a un cambio de teléfono, señalaría a la ficha equivocada.
  const repetido = hallazgo?.existe === true && hallazgo.para === digitos;
  const chocan = repetido && hallazgo?.coincide === false;

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
      <h2 className="font-serif text-lg text-gray-900">El cliente</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre completo *</label>
          <input
            id="nombre" name="nombre" required placeholder="Ej. Camila Rodríguez"
            value={nombre} onChange={(e) => setNombre(e.target.value)}
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor="telefono" className={labelBase}>WhatsApp *</label>
          <input
            id="telefono" name="telefono" required placeholder="Ej. 809-555-0101"
            value={telefono} onChange={(e) => setTelefono(e.target.value)}
            className={`${inputBase} ${chocan ? "border-amber-400" : ""}`}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelBase}>Email (opcional)</label>
          <input id="email" name="email" type="email" className={inputBase} />
        </div>
        <div>
          <label htmlFor="como_nos_conocio" className={labelBase}>¿Cómo nos conoció?</label>
          <select id="como_nos_conocio" name="como_nos_conocio" className={inputBase}>
            <option value="">— Seleccionar —</option>
            <option value="instagram">Instagram</option>
            <option value="referido">Referido / Recomendación</option>
            <option value="google">Google / Búsqueda</option>
            <option value="tiktok">TikTok</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      {repetido && !chocan && (
        <p className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-px" />
          <span>
            Ya tienes ficha de <strong className="text-gray-800">{hallazgo?.nombre}</strong> con
            este WhatsApp. El pedido se sumará a esa ficha.
          </span>
        </p>
      )}

      {chocan && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-2.5">
          <p className="flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span>{hallazgo?.aviso}</span>
          </p>
          <label className="flex items-center gap-2 text-xs font-medium text-amber-900 cursor-pointer">
            <input
              type="checkbox" name="misma_persona" value="si"
              checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)}
              className="accent-[#D4AF37]"
            />
            Sí, es la misma persona: usa la ficha de «{hallazgo?.nombre}»
          </label>
          {hallazgo?.id && (
            <a
              href="/panel/clientes"
              className="inline-block text-[11px] text-amber-800 underline underline-offset-2"
            >
              Ver, corregir o eliminar esa ficha en Clientes
            </a>
          )}
        </div>
      )}
    </section>
  );
}
