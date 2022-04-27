#!/usr/bin/env node
import type { Preset } from "graphile-plugin";
import { loadConfig, resolvePresets } from "graphile-plugin";
import type { IncomingMessage, RequestListener } from "node:http";
import { createServer } from "node:http";
import url from "node:url";
import type { Argv } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { ContextCallback } from "./interfaces.js";
import { postgraphile } from "./middleware/index.js";
import { defaultPreset } from "./preset.js";
import {
  makePgDatabasesAndContextFromConnectionString,
  makeSchema,
} from "./schema.js";

export function options(yargs: Argv) {
  return yargs
    .option("connection", {
      alias: "c",
      type: "string",
      description: "The PostgreSQL connection string to connect to",
    })
    .option("schema", {
      alias: "s",
      type: "string",
      description:
        "The database schema (or comma separated list of schemas) to expose over GraphQL",
      default: "public",
    })
    .option("port", {
      alias: "p",
      type: "number",
      description: "The port number on which to run our HTTP server",
      default: 5678,
    })
    .option("config", {
      alias: "C",
      type: "string",
      description: "The path to the config file",
    })
    .option("allowExplain", {
      alias: "e",
      type: "boolean",
      description:
        "Allow visitors to view the plan/SQL queries/etc related to each GraphQL operation",
    });
}

type PostGraphileArgv = ReturnType<typeof options> extends Argv<infer U>
  ? U
  : never;

export async function run(argv: PostGraphileArgv) {
  const {
    connection: connectionString,
    schema: rawSchema,
    port: rawPort,
    config: configFileLocation,
    allowExplain,
  } = argv;

  // Try and load the preset
  const userPreset = await loadConfig(configFileLocation);
  const preset: Preset = {
    extends: userPreset ? [userPreset] : [defaultPreset],
  };
  let contextCallback: ContextCallback | null = null;

  // Apply CLI options to preset
  if (connectionString || rawSchema) {
    const schemas = rawSchema?.split(",") ?? ["public"];
    const [newPgDatabases, newContextCallback] =
      makePgDatabasesAndContextFromConnectionString(connectionString, schemas);
    contextCallback = newContextCallback;
    preset.gather = preset.gather || { pgDatabases: [] };
    preset.gather!.pgDatabases = newPgDatabases;
  }
  preset.server = preset.server || {};
  if (rawPort != null) {
    preset.server!.port = rawPort;
  }
  if (allowExplain === true) {
    preset.server!.exposePlan = true;
  }

  const config = resolvePresets([preset]);

  if (contextCallback === null) {
    const withPgClient = config.gather?.pgDatabases?.[0]?.withPgClient;
    if (!withPgClient) {
      throw new Error(
        "Please specify `-c` so we know which database to connect to (or populate the configuration with the relevant options)",
      );
    }
    const contextValue = { withPgClient };
    contextCallback = () => contextValue;
  }

  const pgSettings = config.server?.pgSettings;
  if (pgSettings || !contextCallback) {
    const oldContextCallback = contextCallback;
    contextCallback = (req: IncomingMessage): object => {
      return {
        ...oldContextCallback(req),
        ...(pgSettings
          ? {
              pgSettings:
                typeof pgSettings === "function" ? pgSettings(req) : pgSettings,
            }
          : null),
      };
    };
  }

  const schemaResult = await makeSchema(config, contextCallback);
  const middleware = postgraphile(schemaResult);
  const server = createServer(middleware as RequestListener);
  const port = config.server?.port ?? 0;
  server.once("error", (e) => {
    console.error(e);
    process.exit(2);
  });
  server.on("listening", () => {
    const address = server.address();
    if (typeof address === "string") {
      console.log(`Server listening at ${address}`);
    } else if (address) {
      console.log(
        `Server listening on port ${address.port} at http://localhost:${address.port}/graphql`,
      );
    } else {
      console.error(`Could not determine server address`);
    }
  });
  server.listen(port);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  try {
    const argv = await options(yargs(hideBin(process.argv))).argv;
    await run(argv);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
