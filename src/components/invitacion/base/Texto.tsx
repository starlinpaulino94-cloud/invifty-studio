"use client";

import { useRef, type ReactNode } from "react";
import { useInvitacion } from "./Contexto";

/**
 * TEXTO EDITABLE ENCIMA DEL DISEÑO
 * =================================
 * Envuelve un texto de la invitación y le pone su ruta dentro de los datos
 * ("titulo", "lugares.0.nombre"…). En la invitación publicada **no existe**:
 * devuelve exactamente lo que envuelve, sin etiqueta ni atributos, así que
 * lo que ve el invitado es idéntico a antes de que esto existiera.
 *
 * Solo se vuelve editable cuando la vista previa del panel enciende el modo
 * editar. Entonces el texto se cambia tocándolo, ahí mismo.
 *
 * EL CAMBIO SE GUARDA AL SALIR DEL TEXTO, no en cada tecla. No es un
 * detalle: si React volviera a dibujar mientras se escribe, el cursor
 * saltaría al principio en cada letra. Mientras el texto tiene el foco es
 * el navegador quien manda, y al salir se avisa una sola vez.
 *
 * REGLA: solo lleva ruta lo que se guarda tal cual. Una hora, una fecha
 * larga o la etiqueta de un código de vestimenta las compone el sistema a
 * partir de otro dato — esas se siguen editando en su tarjeta, porque
 * escribir encima no tendría dónde guardarse.
 */

/**
 * El navegador mete espacios duros al escribir dos espacios seguidos o al
 * final de una línea. Guardados así saldrían en la invitación como espacios
 * que nunca rompen de línea.
 */
function limpiar(texto: string): string {
  return texto.replace(/\u00A0/g, " ").replace(/[ \t]+$/gm, "").trim();
}

/**
 * Lee lo que hay escrito, no lo que se ve.
 *
 * Hace falta `innerText` y no `textContent` para que un salto de línea del
 * navegador (que escribe como <br> o como <div>) llegue como "\n". Pero
 * `innerText` devuelve el texto TAL COMO SE PINTA, y varios campos llevan
 * `uppercase` en su diseño — el nombre del lugar, el rol de los padrinos,
 * el título de una nota. Editar "Ceremonia" ahí guardaba "CEREMONIA" y el
 * dato quedaba estropeado para siempre, también en el formulario.
 *
 * Se apaga la transformación el instante justo de leer y se devuelve como
 * estaba. La lectura fuerza el recálculo, así que el valor ya sale limpio.
 */
function leerTexto(elemento: HTMLElement): string {
  const previo = elemento.style.textTransform;
  elemento.style.textTransform = "none";
  const texto = elemento.innerText;
  elemento.style.textTransform = previo;
  return texto;
}

export default function Texto({
  ruta,
  children,
  className,
}: {
  /** Dónde vive este texto dentro de los datos de la invitación. */
  ruta: string;
  children: ReactNode;
  className?: string;
}) {
  const { onEditarTexto } = useInvitacion();
  const marco = useRef<HTMLSpanElement>(null);
  /** Texto tal como estaba al entrar, para poder deshacer con Escape. */
  const original = useRef("");

  // Invitación real: ni una etiqueta de más.
  if (!onEditarTexto) return <>{children}</>;

  return (
    <span
      ref={marco}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={`Editar ${ruta}`}
      data-ruta={ruta}
      className={`texto-editable ${className ?? ""}`}
      onFocus={() => {
        original.current = marco.current ? leerTexto(marco.current) : "";
      }}
      // Pegar desde WhatsApp o Word trae formato y colores que romperían el
      // diseño; aquí entra solo el texto.
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (marco.current) marco.current.innerText = original.current;
          marco.current?.blur();
        }
      }}
      onBlur={() => {
        const valor = limpiar(marco.current ? leerTexto(marco.current) : "");
        if (valor !== limpiar(original.current)) onEditarTexto(ruta, valor);
      }}
    >
      {children}
    </span>
  );
}
