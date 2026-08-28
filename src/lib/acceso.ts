/**
 * LOS ERRORES DEL LOGIN, DICHOS CON LA VERDAD
 * ============================================
 * Pasó de verdad: la pantalla decía "Correo o contraseña incorrectos"
 * ante CUALQUIER fallo — incluida una clave de Supabase mal puesta en
 * Vercel. El propietario probó su contraseña diez veces mientras el
 * problema era de configuración. Un error que culpa a la persona por un
 * fallo del sistema hace perder horas: aquí se separan.
 */

export function mensajeErrorAcceso(mensaje: string | null | undefined): string {
  const m = (mensaje ?? "").toLowerCase();

  // Lo ÚNICO que de verdad es culpa de las credenciales.
  if (m.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (m.includes("email not confirmed")) {
    return "Este correo existe pero no está confirmado. Escríbele al equipo técnico.";
  }
  if (m.includes("too many") || m.includes("rate limit")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  }
  // Clave de API inválida o ausente: configuración, no contraseña.
  if (m.includes("api key") || m.includes("apikey") || m.includes("jwt")) {
    return "El sistema no puede conectar (configuración de claves): NO es tu contraseña. Revisa las variables de Supabase en Vercel.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }
  // Cualquier otra cosa: se enseña tal cual, sin culpar a la contraseña.
  return `No se pudo entrar. El sistema respondió: “${mensaje ?? "sin detalle"}”. No es necesariamente tu contraseña.`;
}
