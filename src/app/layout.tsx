import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { urlBase } from "@/lib/url";

/**
 * Fuentes del panel y del formulario del cliente. next/font las descarga en
 * el build y las sirve desde nuestro propio dominio: antes iban por un
 * <link> a Google Fonts que bloqueaba el pintado de la página.
 *
 * Las invitaciones publicadas son otro caso: su tipografía depende de la
 * pareja que elija el equipo entre diez, así que se cargan en tiempo de
 * ejecución desde /i/[slug] (ver `urlFuentes` en config/diseno.ts).
 */
const serif = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--fuente-serif",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Base para resolver a URL absoluta las imágenes de vista previa de las
  // invitaciones. WhatsApp y Facebook solo aceptan URLs absolutas.
  metadataBase: new URL(urlBase()),
  title: "Invifty Studio",
  description: "Sistema interno de operaciones de Invifty — invitaciones digitales premium.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full antialiased ${serif.variable} ${sans.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
