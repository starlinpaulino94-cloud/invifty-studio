import { crearPedido } from "@/lib/acciones";
import { PLANES, EXTRAS, TIPOS_EVENTO } from "@/lib/planes";
import { Plan, TipoEvento } from "@/lib/tipos";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const inputBase =
  "w-full bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none transition-colors";
const labelBase = "block text-xs font-semibold text-gray-600 mb-1.5";

export default function CrearPedido() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl text-gray-900 mb-1">Crear pedido</h1>
      <p className="text-sm text-gray-500 mb-8">
        Al guardar, el sistema genera el formulario del cliente y el mensaje de WhatsApp
        listo para copiar.
      </p>

      <form action={crearPedido} className="space-y-8">
        {/* Cliente */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-gray-900">El cliente</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className={labelBase}>Nombre completo *</label>
              <input id="nombre" name="nombre" required placeholder="Ej. Camila Rodríguez" className={inputBase} />
            </div>
            <div>
              <label htmlFor="telefono" className={labelBase}>WhatsApp *</label>
              <input id="telefono" name="telefono" required placeholder="Ej. 809-555-0101" className={inputBase} />
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
        </section>

        {/* Evento y plan */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-gray-900">El evento</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tipo_evento" className={labelBase}>Tipo de evento *</label>
              <select id="tipo_evento" name="tipo_evento" required className={inputBase}>
                {(Object.keys(TIPOS_EVENTO) as TipoEvento[]).map((t) => (
                  <option key={t} value={t}>{TIPOS_EVENTO[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="plan" className={labelBase}>Plan *</label>
              <select id="plan" name="plan" required defaultValue="popular" className={inputBase}>
                {(Object.keys(PLANES) as Plan[]).map((p) => (
                  <option key={p} value={p}>
                    {PLANES[p].nombre} — RD$ {PLANES[p].precioDOP.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fecha_evento" className={labelBase}>Fecha del evento</label>
              <input id="fecha_evento" name="fecha_evento" type="date" className={inputBase} />
            </div>
            <div>
              <label htmlFor="precio" className={labelBase}>Precio acordado (RD$) *</label>
              <input
                id="precio" name="precio" type="number" min="0" step="50" required
                placeholder="Ej. 2500" className={inputBase}
              />
            </div>
          </div>

          <div>
            <span className={labelBase}>Extras contratados</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {EXTRAS.map((extra) => (
                <label
                  key={extra.id}
                  className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 has-checked:border-[#D4AF37] has-checked:bg-[#D4AF37]/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-700 cursor-pointer transition-colors"
                >
                  <input type="checkbox" name="extras" value={extra.id} className="accent-[#D4AF37]" />
                  {extra.nombre}
                  <span className="text-gray-400">+RD$ {extra.precioDOP.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="notas" className={labelBase}>Notas internas (opcional)</label>
            <textarea id="notas" name="notas" rows={2} className={`${inputBase} resize-none`} />
          </div>
        </section>

        <button
          type="submit"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0D0D0F] text-white text-sm font-semibold px-8 py-4 rounded-xl hover:bg-black transition-all active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          Guardar y generar formulario
        </button>
      </form>
    </div>
  );
}
