import { DatosInvitacion } from "@/lib/tipos";
import { plantillaMeta } from "@/config/plantillas";
import Editorial from "./plantillas/Editorial";
import Botanica from "./plantillas/Botanica";
import Moderna from "./plantillas/Moderna";
import Deco from "./plantillas/Deco";
import Tropical from "./plantillas/Tropical";
import Arco from "./plantillas/Arco";
import Celestial from "./plantillas/Celestial";
import Acuarela from "./plantillas/Acuarela";
import Cinema from "./plantillas/Cinema";
import Boho from "./plantillas/Boho";

type Foto = { nombre: string; url?: string };

interface Props {
  datos: DatosInvitacion;
  fotos: Foto[];
  esBorrador?: boolean;
}

/**
 * Elige la plantilla correspondiente. Las invitaciones creadas antes
 * del catálogo (plantilla "clasica") se muestran con Editorial Luxe.
 */
export default function Renderizador({ plantilla, ...props }: Props & { plantilla?: string }) {
  const meta = plantillaMeta(plantilla);

  switch (meta.id) {
    case "botanica":
      return <Botanica {...props} />;
    case "moderna":
      return <Moderna {...props} />;
    case "deco":
      return <Deco {...props} />;
    case "tropical":
      return <Tropical {...props} />;
    case "arco":
      return <Arco {...props} />;
    case "celestial":
      return <Celestial {...props} />;
    case "acuarela":
      return <Acuarela {...props} />;
    case "cinema":
      return <Cinema {...props} />;
    case "boho":
      return <Boho {...props} />;
    default:
      return <Editorial {...props} />;
  }
}
