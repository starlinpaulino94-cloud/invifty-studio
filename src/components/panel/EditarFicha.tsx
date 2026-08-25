"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarCliente,
  actualizarPedido,
  eliminarPedido,
  eliminarCliente,
} from "@/lib/acciones";
import { PLANES, TIPOS_EVENTO, EXTRAS } from "@/lib/planes";
import { CONFIRMACION_ELIMINAR } from "@/lib/eliminar";
import type { Cliente, Pedido } from "@/lib/tipos";
import { Loader2, PenLine, Save, Trash2, X } from "lucide-react";

/**
 * EDITAR Y ELIMINAR desde el panel. Los formularios solo son la parte
 * visible: cada acción revalida el permiso en el servidor
 * (editar_fichas para corregir; eliminar_datos —solo el propietario—
 * para borrar), y borrar exige ESCRIBIR la confirmación: un click se da
 * sin leer, ocho letras no.
 */

function useAccion() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const ejecutar = async (accion: () => Promise<unknown>, alTerminar?: () => void) => {
    setError("");
    setCargando(true);
    try {
      await accion();
      alTerminar?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setCargando(false);
    }
  };
  return { error, cargando, ejecutar };
}

const boton =
  "text-xs font-semibold text-gray-700 border border-gray-200 hover:border-gray-400 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 disabled:opacity-60";
const campo =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]";
const etiqueta = "block text-xs text-gray-500 mb-1 font-medium";

export function EditarCliente({ cliente }: { cliente: Cliente }) {
  const [abierto, setAbierto] = useState(false);
  const { error, cargando, ejecutar } = useAccion();

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    void ejecutar(() => actualizarCliente(cliente.id, datos), () => setAbierto(false));
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={boton}>
        <PenLine className="w-3.5 h-3.5" /> Editar cliente
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 w-full">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={etiqueta}>Nombre</label>
          <input name="nombre" required defaultValue={cliente.nombre} className={campo} />
        </div>
        <div>
          <label className={etiqueta}>Teléfono (WhatsApp)</label>
          <input name="telefono" required defaultValue={cliente.telefono} className={campo} />
        </div>
        <div>
          <label className={etiqueta}>Correo</label>
          <input name="email" type="email" defaultValue={cliente.email ?? ""} className={campo} />
        </div>
        <div>
          <label className={etiqueta}>Cómo nos conoció</label>
          <input name="como_nos_conocio" defaultValue={cliente.como_nos_conocio ?? ""} className={campo} />
        </div>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={cargando} className={boton}>
          {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={boton}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </form>
  );
}

export function EditarPedido({ pedido }: { pedido: Pedido }) {
  const [abierto, setAbierto] = useState(false);
  const { error, cargando, ejecutar } = useAccion();

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    void ejecutar(() => actualizarPedido(pedido.id, datos), () => setAbierto(false));
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={boton}>
        <PenLine className="w-3.5 h-3.5" /> Editar pedido
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 w-full">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={etiqueta}>Tipo de evento</label>
          <select name="tipo_evento" defaultValue={pedido.tipo_evento} className={campo}>
            {Object.entries(TIPOS_EVENTO).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Plan</label>
          <select name="plan" defaultValue={pedido.plan} className={campo}>
            {Object.entries(PLANES).map(([id, p]) => (
              <option key={id} value={id}>{p.nombre}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Cambiar el plan vuelve a congelar el contrato con el catálogo de hoy.
          </p>
        </div>
        <div>
          <label className={etiqueta}>Fecha del evento</label>
          <input name="fecha_evento" type="date" defaultValue={pedido.fecha_evento ?? ""} className={campo} />
        </div>
        <div>
          <label className={etiqueta}>Precio (DOP)</label>
          <input name="precio" type="number" min="0" step="1" required defaultValue={Number(pedido.precio)} className={campo} />
        </div>
      </div>
      <div>
        <label className={etiqueta}>Extras</label>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {EXTRAS.map((extra) => (
            <label key={extra.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                name="extras"
                value={extra.id}
                defaultChecked={pedido.extras.includes(extra.id)}
                className="accent-[#D4AF37]"
              />
              {extra.nombre}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={cargando} className={boton}>
          {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={boton}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </form>
  );
}

/** La zona de peligro genérica: enseña qué se lleva, exige escribirlo. */
function ZonaPeligro({
  titulo,
  detalles,
  accion,
  textoBoton,
}: {
  titulo: string;
  detalles: string[];
  accion: (confirmacion: string) => Promise<unknown>;
  textoBoton: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const { error, cargando, ejecutar } = useAccion();

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-xs font-semibold text-red-600 border border-red-200 hover:border-red-400 rounded-xl px-3 py-2 inline-flex items-center gap-1.5"
      >
        <Trash2 className="w-3.5 h-3.5" /> {titulo}
      </button>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 w-full">
      <p className="text-sm font-semibold text-red-800">{titulo} — esto no tiene vuelta atrás</p>
      {detalles.length > 0 && (
        <ul className="text-xs text-red-700 list-disc pl-4 space-y-0.5">
          {detalles.map((d, i) => (
            <li key={i}>Se borra {d}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          placeholder={`Escribe ${CONFIRMACION_ELIMINAR}`}
          className="border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
        />
        <button
          onClick={() => ejecutar(() => accion(confirmacion))}
          disabled={cargando || confirmacion.trim() !== CONFIRMACION_ELIMINAR}
          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl px-4 py-2.5 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {textoBoton}
        </button>
        <button onClick={() => setAbierto(false)} className={boton}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
      {error && <p className="text-red-700 text-xs">{error}</p>}
    </div>
  );
}

export function EliminarPedido({ pedidoId, detalles }: { pedidoId: string; detalles: string[] }) {
  return (
    <ZonaPeligro
      titulo="Eliminar este pedido"
      detalles={detalles}
      accion={(confirmacion) => eliminarPedido(pedidoId, confirmacion)}
      textoBoton="Eliminar para siempre"
    />
  );
}

export function EliminarCliente({ clienteId, pedidos }: { clienteId: string; pedidos: number }) {
  if (pedidos > 0) {
    // Sin botón fantasma: se explica por qué no se puede todavía.
    return (
      <p className="text-[11px] text-gray-400">
        Para eliminarlo, borra primero sus {pedidos} pedido{pedidos === 1 ? "" : "s"}.
      </p>
    );
  }
  return (
    <ZonaPeligro
      titulo="Eliminar este cliente"
      detalles={["su ficha de contacto", "su cuenta del portal si la tenía"]}
      accion={(confirmacion) => eliminarCliente(clienteId, confirmacion)}
      textoBoton="Eliminar para siempre"
    />
  );
}
