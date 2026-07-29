import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import {
  leerJson,
  responderError,
  respuestaJson,
} from "../compartido/respuestas.js";
import { repositorioAcceso } from "../acceso/repositorio.js";
import { validarAdminDesdeEvento } from "../compartido/seguridad.js";
import { ingresarAdmin } from "./servicio.js";

interface IngresoAdminEntrada {
  clave: string;
}

export async function manejador(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const ruta = event.requestContext.http.path;
    const metodo = event.requestContext.http.method;

    if (ruta === "/api/admin/ingresar" && metodo === "POST") {
      const ip = event.requestContext.http.sourceIp || "desconocida";
      const entrada = leerJson<IngresoAdminEntrada>(event);
      return respuestaJson(
        200,
        await ingresarAdmin(String(entrada.clave || ""), ip, repositorioAcceso),
      );
    }

    const contextoAdmin = validarAdminDesdeEvento(event);

    if (ruta === "/api/admin/perfil" && metodo === "GET") {
      return respuestaJson(200, {
        ok: true,
        rol: contextoAdmin.rol,
        adminId: contextoAdmin.adminId,
      });
    }

    return respuestaJson(404, { ok: false, error: "Ruta no encontrada" });
  } catch (error) {
    return responderError(error);
  }
}
