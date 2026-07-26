"use client";

import { useState } from "react";
import Renderizador from "@/components/invitacion/Renderizador";
import { ProveedorInvitacion } from "@/components/invitacion/base/Contexto";
import { conVideoDePortada, ordenarFotos } from "@/lib/fotos";
import { urlFuentes } from "@/config/diseno";
import { esInvitacionDeCodigo } from "@/lib/codigo";
import CodigoPropio from "@/components/invitacion/CodigoPropio";
import { EFECTOS_POR_DEFECTO } from "@/lib/tipos";
import type { DatosInvitacion, FotoInvitacion } from "@/lib/tipos";
import { Smartphone, Monitor, RotateCcw, MousePointerClick, Pencil } from "lucide-react";

/**
 * VISTA PREVIA EN VIVO
 * =====================
 * La invitación real, dibujada con lo que hay ahora mismo en el editor.
 * Antes había que guardar, abrir otra pestaña, mirar, volver y repetir.
 *
 * Tres cosas la hacen fiel:
 *
 *  · El `transform: scale` del marco hace que los elementos con
 *    position:fixed —el sobre, la textura, la viñeta, el botón de música—
 *    se posicionen contra el marco y no contra la ventana del panel, que
 *    es lo que pasaría sin él.
 *  · `--alto-previa` le dice a las reglas de globals.css contra qué medir
 *    la portada, que en las plantillas ocupa el alto de la pantalla.
 *  · Se cargan las fuentes reales de la pareja tipográfica elegida: sin
 *    esto se elegiría la tipografía sin verla.
 *
 * Las confirmaciones que se envíen desde aquí NO se guardan: el proveedor
 * la marca como borrador, igual que la vista previa pública.
 */

const ANCHO_CELULAR = 390;
const ANCHO_ESCRITORIO = 1000;
const ALTO = 760;

export default function VistaPreviaEnVivo({
  plantilla,
  datos,
  fotos,
  video,
  codigoHtml,
  onSenalarCampo,
  onEditarTexto,
}: {
  plantilla: string;
  datos: DatosInvitacion;
  /** Fotos del pedido sin ordenar; aquí se aplica el orden en vivo. */
  fotos: FotoInvitacion[];
  /** Video del cliente, si subió uno. */
  video?: FotoInvitacion;
  /** HTML pegado, cuando la invitación se hizo fuera del sistema. */
  codigoHtml?: string | null;
  /** Se llama al señalar un bloque, con el campo del editor que lo controla. */
  onSenalarCampo?: (campo: string) => void;
  /** Se llama al cambiar un texto encima del diseño, con su ruta en los datos. */
  onEditarTexto?: (ruta: string, valor: string) => void;
}) {
  const [ancho, setAncho] = useState(ANCHO_CELULAR);
  const [senalando, setSenalando] = useState(false);
  const [editando, setEditando] = useState(false);
  // Cambiar esta clave vuelve a montar la invitación: sirve para volver a
  // ver la apertura del sobre después de haberla abierto.
  const [reinicio, setReinicio] = useState(0);

  // Escribir encima pide tamaño real: a 0,72 el texto se lee mal y el cursor
  // cae donde no es. El marco de escritorio (0,5) directamente no vale.
  const esCelular = editando || ancho === ANCHO_CELULAR;
  const anchoMarco = editando ? ANCHO_CELULAR : ancho;
  // El marco de escritorio se ve más ancho y más bajo, como una ventana real.
  // No busca que se lea el texto, sino comprobar que la composición aguanta.
  const escala = editando ? 1 : esCelular ? 0.72 : 0.5;

  /**
   * Los dos modos se pisan: señalar se traga el clic para llevar al campo, y
   * editar lo necesita para poner el cursor en el texto. Encender uno apaga
   * el otro en vez de dejar un estado en el que nada responde como se espera.
   */
  const cambiarModo = (modo: "senalar" | "editar") => {
    if (modo === "senalar") {
      setEditando(false);
      setSenalando((v) => !v);
    } else {
      setSenalando(false);
      setEditando((v) => !v);
    }
  };

  /**
   * Con el modo editar encendido el sobre no se dibuja: si no, habría que
   * abrirlo para llegar al texto, y en este modo el clic no lo abre. Al
   * apagarlo vuelve tal cual estaba.
   */
  const datosPrevia: DatosInvitacion = editando
    ? { ...datos, efectos: { ...EFECTOS_POR_DEFECTO, ...(datos.efectos ?? {}), sobre: false } }
    : datos;

  // Se compone igual que la página pública para que la vista previa no
  // mienta: mismo orden y el video de portada por delante si está activo.
  const medios = conVideoDePortada(
    ordenarFotos(fotos, datos.ordenFotos, datos.fotosOcultas),
    video,
    datosPrevia.efectos?.videoPortada !== false
  );

  /**
   * En modo señalar, el clic lleva al campo que controla ese bloque en vez
   * de activar lo que haya debajo. Se intercepta en fase de captura para
   * que no se abra el sobre, ni un mapa, ni se envíe una confirmación.
   *
   * Los bloques del cuerpo se marcan con data-campo en Secciones.tsx, que
   * es común a las diez plantillas. Lo que no está marcado es la portada:
   * es la única parte que cada plantilla compone a su manera.
   */
  const senalar = (e: React.MouseEvent) => {
    if (!senalando) return;
    e.preventDefault();
    e.stopPropagation();
    const bloque = (e.target as HTMLElement).closest<HTMLElement>("[data-campo]");
    onSenalarCampo?.(bloque?.dataset.campo || "portada");
  };

  return (
    <div className="xl:sticky xl:top-4 shrink-0">
      {/* Las familias tipográficas reales de esta invitación. React las
          sube solo al <head> del documento. */}
      <link rel="stylesheet" href={urlFuentes(datos.tipografia)} />

      <div className="flex items-center justify-between mb-2.5 gap-2">
        <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
          Vista previa en vivo
        </span>
        <div className="flex items-center gap-1">
          <BotonMarco
            activo={esCelular}
            desactivado={editando}
            onClick={() => setAncho(ANCHO_CELULAR)}
            titulo="Ver como celular"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </BotonMarco>
          <BotonMarco
            activo={!esCelular}
            desactivado={editando}
            onClick={() => setAncho(ANCHO_ESCRITORIO)}
            titulo={
              editando
                ? "Para escribir encima hace falta el marco de celular a tamaño real"
                : "Ver como computadora"
            }
          >
            <Monitor className="w-3.5 h-3.5" />
          </BotonMarco>
          <BotonMarco
            activo={senalando}
            onClick={() => cambiarModo("senalar")}
            titulo="Señalar: toca una parte de la invitación para ir a su campo"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
          </BotonMarco>
          {onEditarTexto && (
            <BotonMarco
              activo={editando}
              onClick={() => cambiarModo("editar")}
              titulo="Editar: escribe los textos encima del diseño"
            >
              <Pencil className="w-3.5 h-3.5" />
            </BotonMarco>
          )}
          <BotonMarco
            activo={false}
            onClick={() => setReinicio((n) => n + 1)}
            titulo="Volver a empezar (ver la apertura del sobre)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </BotonMarco>
        </div>
      </div>

      <div
        className={`overflow-hidden bg-black shadow-xl ${
          esCelular ? "rounded-[28px] border-[6px] border-gray-900" : "rounded-xl border border-gray-300"
        }`}
        style={{ width: anchoMarco * escala, height: ALTO * escala }}
      >
        <div
          // El modo editar entra en la clave porque quita el sobre, y el
          // sobre solo se decide al montar.
          key={`${reinicio}-${editando}`}
          onClickCapture={senalar}
          className={`vista-previa origin-top-left overflow-y-auto ${
            senalando ? "vista-previa--senalando" : ""
          } ${editando ? "vista-previa--editando" : ""}`}
          style={{
            width: anchoMarco,
            height: ALTO,
            transform: `scale(${escala})`,
            ["--alto-previa" as string]: `${ALTO}px`,
          }}
        >
          <ProveedorInvitacion
            slug=""
            esBorrador
            onEditarTexto={editando ? onEditarTexto : undefined}
          >
            {esInvitacionDeCodigo(plantilla) ? (
              <CodigoPropio html={codigoHtml ?? ""} datos={datosPrevia} fotos={medios} />
            ) : (
              <Renderizador plantilla={plantilla} datos={datosPrevia} fotos={medios} />
            )}
          </ProveedorInvitacion>
        </div>
      </div>

      <p
        className="text-[10px] text-gray-400 mt-2 leading-relaxed"
        style={{ width: anchoMarco * escala }}
      >
        {editando
          ? "Toca un texto subrayado y escríbelo. Se guarda al salir de él; Escape deshace. Lo que el sistema arma solo —horas, fechas, la etiqueta del código de vestimenta— se edita en su tarjeta."
          : senalando
            ? "Toca cualquier parte de la invitación y el editor salta a su campo."
            : "Se actualiza mientras editas. Las confirmaciones enviadas desde aquí no se guardan."}
      </p>
    </div>
  );
}

function BotonMarco({
  activo,
  desactivado = false,
  onClick,
  titulo,
  children,
}: {
  activo: boolean;
  desactivado?: boolean;
  onClick: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      title={titulo}
      aria-label={titulo}
      className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        activo
          ? "bg-[#0D0D0F] text-white border-[#0D0D0F]"
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}
