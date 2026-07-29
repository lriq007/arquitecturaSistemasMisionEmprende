import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  baseDatos,
  nombreTabla,
} from "../compartido/baseDatos.js";

export interface GrupoAcceso {
  sesionId: string;
  grupoId: string;
  nombreGrupo: string;
  codigoAcceso: string;
}

export interface ContadorIntentos {
  intentosFallidos: number;
  ventanaExpira: number;
}

export interface RepositorioAcceso {
  buscarPorCodigo(codigo: string): Promise<GrupoAcceso | null>;
  actualizarNombre(
    sesionId: string,
    grupoId: string,
    nombreGrupo: string,
  ): Promise<void>;
  obtenerContador(ip: string): Promise<ContadorIntentos | null>;
  incrementarIntentosFallidos(ip: string, ventanaExpira: number): Promise<number>;
  reiniciarContador(ip: string): Promise<void>;
}

export const repositorioAcceso: RepositorioAcceso = {
  async buscarPorCodigo(codigo: string): Promise<GrupoAcceso | null> {
    const resultado = await baseDatos.send(
      new QueryCommand({
        TableName: nombreTabla(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :codigo",
        ExpressionAttributeValues: {
          ":codigo": `CODIGO#${codigo}`,
        },
        Limit: 1,
      }),
    );

    const item = resultado.Items?.[0];

    if (!item) return null;

    return {
      sesionId: String(item.sesionId),
      grupoId: String(item.grupoId),
      nombreGrupo: String(item.nombreGrupo || "Grupo"),
      codigoAcceso: String(item.codigoAcceso),
    };
  },

  async actualizarNombre(
    sesionId: string,
    grupoId: string,
    nombreGrupo: string,
  ): Promise<void> {
    await baseDatos.send(
      new UpdateCommand({
        TableName: nombreTabla(),
        Key: {
          PK: `SESION#${sesionId}`,
          SK: `GRUPO#${grupoId}`,
        },
        UpdateExpression: "SET nombreGrupo = :nombreGrupo",
        ExpressionAttributeValues: {
          ":nombreGrupo": nombreGrupo,
        },
      }),
    );
  },

  async obtenerContador(ip: string): Promise<ContadorIntentos | null> {
    const resultado = await baseDatos.send(
      new GetCommand({
        TableName: nombreTabla(),
        Key: {
          PK: `IP#${ip}`,
          SK: "ACCESO_INTENTOS",
        },
      }),
    );

    if (!resultado.Item) return null;

    return {
      intentosFallidos: Number(resultado.Item.intentosFallidos ?? 0),
      ventanaExpira: Number(resultado.Item.ventanaExpira ?? 0),
    };
  },

  async incrementarIntentosFallidos(ip: string, ventanaExpira: number): Promise<number> {
    const resultado = await baseDatos.send(
      new UpdateCommand({
        TableName: nombreTabla(),
        Key: {
          PK: `IP#${ip}`,
          SK: "ACCESO_INTENTOS",
        },
        UpdateExpression:
          "ADD intentosFallidos :uno SET ventanaExpira = if_not_exists(ventanaExpira, :expira), #ttl = if_not_exists(#ttl, :expira)",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":uno": 1,
          ":expira": ventanaExpira,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return Number(resultado.Attributes?.intentosFallidos ?? 0);
  },

  async reiniciarContador(ip: string): Promise<void> {
    await baseDatos.send(
      new DeleteCommand({
        TableName: nombreTabla(),
        Key: {
          PK: `IP#${ip}`,
          SK: "ACCESO_INTENTOS",
        },
      }),
    );
  },
};
