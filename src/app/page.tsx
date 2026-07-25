import { redirect } from "next/navigation";

// La raíz del sistema interno lleva directo al panel
// (el proxy redirige a /login si no hay sesión).
export default function Inicio() {
  redirect("/panel");
}
