"use client";

import { Printer } from "lucide-react";

export default function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-[#0D0D0F] text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors active:scale-95 print:hidden"
    >
      <Printer className="w-4 h-4 text-[#D4AF37]" />
      Imprimir / Guardar como PDF
    </button>
  );
}
