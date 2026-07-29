import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import {
  leerJson,
  responderError,
  respuestaJson,
} from "../compartido/respuestas.js";
import {
  validarProfesorDesdeEvento,
} from "../compartido/seguridad.js";
import {
  repositorioProfesor,
} from "./repositorio.js";
import {
  crearSesiones,
  ejecutarAccionSesion,
  ingresarProfesor,
  listarSesionesProfesor,
  obtenerControlSesion,
} from "./servicio.js";
import type {
  AccionSesion,
  CrearSesionesEntrada,
} from "./servicio.js";

interface IngresoProfesorEntrada {
  codigo: string;
}

interface AccionEntrada {
  accion: AccionSesion;
}

export async function manejador(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const ruta = event.requestContext.http.path;
    const metodo = event.requestContext.http.method;

    if (
      ruta === "/api/profesor/ingresar" &&
      metodo === "POST"
    ) {
      const entrada =
        leerJson<IngresoProfesorEntrada>(event);

      return respuestaJson(
        200,
        ingresarProfesor(String(entrada.codigo || "")),
      );
    }

    const contextoProfesor = validarProfesorDesdeEvento(event);

    if (
      ruta === "/api/profesor/sesiones" &&
      metodo === "GET"
    ) {
      return respuestaJson(
        200,
        await listarSesionesProfesor(
          contextoProfesor.profesorId,
          repositorioProfesor,
        ),
      );
    }

    if (
      ruta === "/api/profesor/sesiones" &&
      metodo === "POST"
    ) {
      const entrada =
        leerJson<CrearSesionesEntrada>(event);

      return respuestaJson(
        201,
        await crearSesiones(
          contextoProfesor.profesorId,
          entrada,
          repositorioProfesor,
        ),
      );
    }

    const detalle = ruta.match(
      /^\/api\/profesor\/sesiones\/([^/]+)$/,
    );

    const sesionIdDetalle = detalle?.[1];

    if (sesionIdDetalle && metodo === "GET") {
      return respuestaJson(
        200,
        await obtenerControlSesion(
          decodeURIComponent(sesionIdDetalle),
          contextoProfesor.profesorId,
          repositorioProfesor,
        ),
      );
    }

    const acciones = ruta.match(
      /^\/api\/profesor\/sesiones\/([^/]+)\/acciones$/,
    );

    const sesionIdAccion = acciones?.[1];

    if (sesionIdAccion && metodo === "POST") {
      const entrada = leerJson<AccionEntrada>(event);

      return respuestaJson(
        200,
        await ejecutarAccionSesion(
          decodeURIComponent(sesionIdAccion),
          entrada.accion,
          contextoProfesor.profesorId,
          repositorioProfesor,
        ),
      );
    }

    return respuestaJson(404, {
      ok: false,
      error: "Ruta no encontrada",
    });
  } catch (error) {
    return responderError(error);
  }
}
