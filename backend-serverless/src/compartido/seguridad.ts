import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

import { ErrorAplicacion } from "./respuestas.js";

export interface ContextoGrupo {
  sesionId: string;
  grupoId: string;
  nombreGrupo: string;
}

export interface ContextoProfesor {
  rol: "profesor";
  profesorId: string;
}

interface ContenidoTokenGrupo extends ContextoGrupo {
  tipo: "grupo";
  exp: number;
}

interface ContenidoTokenProfesor extends ContextoProfesor {
  tipo: "profesor";
  exp: number;
}

export interface ContextoAdmin {
  rol: "admin";
  adminId: string;
}

interface ContenidoTokenAdmin extends ContextoAdmin {
  tipo: "admin";
  exp: number;
}

type ContenidoToken =
  | ContenidoTokenGrupo
  | ContenidoTokenProfesor
  | ContenidoTokenAdmin;

type ContenidoTokenSinExp =
  | Omit<ContenidoTokenGrupo, "exp">
  | Omit<ContenidoTokenProfesor, "exp">
  | Omit<ContenidoTokenAdmin, "exp">;

function claveToken(): string {
  const clave = process.env.CLAVE_TOKEN;

  if (!clave) {
    throw new Error("Falta la variable de entorno CLAVE_TOKEN");
  }

  return clave;
}

function firmar(texto: string): string {
  return createHmac("sha256", claveToken())
    .update(texto)
    .digest("base64url");
}

function crearTokenBase(
  contenido: ContenidoTokenSinExp,
): string {
  const duracion = Number(
    process.env.DURACION_TOKEN_SEGUNDOS || 43200,
  );

  const contenidoCompleto = {
    ...contenido,
    exp: Math.floor(Date.now() / 1000) + duracion,
  } as ContenidoToken;

  const cuerpo = Buffer.from(
    JSON.stringify(contenidoCompleto),
  ).toString("base64url");

  return `${cuerpo}.${firmar(cuerpo)}`;
}

/**
 * Se mantiene con el mismo nombre para no romper Acceso y Fase 1.
 */
export function crearToken(
  contexto: ContextoGrupo,
): string {
  return crearTokenBase({
    tipo: "grupo",
    ...contexto,
  });
}

export function crearTokenProfesor(profesorId: string): string {
  return crearTokenBase({
    tipo: "profesor",
    rol: "profesor",
    profesorId,
  });
}

function validarTokenBase(token: string): ContenidoToken {
  const [cuerpo, firmaRecibida] = token.split(".");

  if (!cuerpo || !firmaRecibida) {
    throw new ErrorAplicacion(
      "Token inválido",
      401,
      "TOKEN_INVALIDO",
    );
  }

  const firmaEsperada = firmar(cuerpo);
  const firmaA = Buffer.from(firmaRecibida);
  const firmaB = Buffer.from(firmaEsperada);

  if (
    firmaA.length !== firmaB.length ||
    !timingSafeEqual(firmaA, firmaB)
  ) {
    throw new ErrorAplicacion(
      "Token inválido",
      401,
      "TOKEN_INVALIDO",
    );
  }

  let contenido: ContenidoToken;

  try {
    contenido = JSON.parse(
      Buffer.from(cuerpo, "base64url").toString("utf8"),
    ) as ContenidoToken;
  } catch {
    throw new ErrorAplicacion(
      "Token inválido",
      401,
      "TOKEN_INVALIDO",
    );
  }

  if (
    !contenido.exp ||
    contenido.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new ErrorAplicacion(
      "La sesión expiró",
      401,
      "TOKEN_EXPIRADO",
    );
  }

  return contenido;
}

export function validarToken(
  token: string,
): ContextoGrupo {
  const contenido = validarTokenBase(token);

  if (contenido.tipo !== "grupo") {
    throw new ErrorAplicacion(
      "El token no corresponde a un grupo",
      403,
      "ROL_INVALIDO",
    );
  }

  return {
    sesionId: contenido.sesionId,
    grupoId: contenido.grupoId,
    // Tokens emitidos antes de agregar este campo regresan cadena vacía
    nombreGrupo: (contenido.nombreGrupo as string | undefined) ?? "",
  };
}

function obtenerBearer(
  event: APIGatewayProxyEventV2,
): string {
  const autorizacion =
    event.headers.authorization ||
    event.headers.Authorization;

  if (!autorizacion?.startsWith("Bearer ")) {
    throw new ErrorAplicacion(
      "Falta el token de acceso",
      401,
      "SIN_TOKEN",
    );
  }

  return autorizacion.slice(7);
}

export function contextoDesdeEvento(
  event: APIGatewayProxyEventV2,
): ContextoGrupo {
  return validarToken(obtenerBearer(event));
}

export function crearTokenAdmin(adminId: string): string {
  return crearTokenBase({
    tipo: "admin",
    rol: "admin",
    adminId,
  });
}

export function validarAdminDesdeEvento(
  event: APIGatewayProxyEventV2,
): ContextoAdmin {
  const contenido = validarTokenBase(obtenerBearer(event));

  if (contenido.tipo !== "admin") {
    throw new ErrorAplicacion(
      "El token no corresponde a un administrador",
      403,
      "ROL_INVALIDO",
    );
  }

  const adminId = String(
    (contenido as ContenidoTokenAdmin).adminId || "",
  );

  if (!adminId) {
    throw new ErrorAplicacion(
      "Token sin identidad de administrador",
      401,
      "TOKEN_INVALIDO",
    );
  }

  return {
    rol: "admin",
    adminId,
  };
}

export function validarProfesorDesdeEvento(
  event: APIGatewayProxyEventV2,
): ContextoProfesor {
  const contenido = validarTokenBase(obtenerBearer(event));

  if (contenido.tipo !== "profesor") {
    throw new ErrorAplicacion(
      "El token no corresponde a un profesor",
      403,
      "ROL_INVALIDO",
    );
  }

  const profesorId = String(
    (contenido as ContenidoTokenProfesor).profesorId || "",
  );

  if (!profesorId) {
    throw new ErrorAplicacion(
      "Token sin identidad de profesor",
      401,
      "TOKEN_INVALIDO",
    );
  }

  return {
    rol: "profesor",
    profesorId,
  };
}
