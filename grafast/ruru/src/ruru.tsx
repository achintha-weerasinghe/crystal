import "graphiql/graphiql.css";

import {
  CopyIcon,
  GraphiQLProvider,
  MergeIcon,
  PrettifyIcon,
  SettingsIcon,
  ToolbarButton,
  ToolbarMenu,
  useCopyQuery,
  useMergeQuery,
} from "@graphiql/react";
import { GraphiQL, GraphiQLInterface } from "graphiql";
import type { FC } from "react";
import { useCallback, useMemo, useState } from "react";

import { ErrorPopup } from "./components/ErrorPopup.js";
import { RuruFooter } from "./components/Footer.js";
import { defaultQuery } from "./defaultQuery.js";
import { ExplainContext, useExplain } from "./hooks/useExplain.js";
import { useFetcher } from "./hooks/useFetcher.js";
import { usePrettify } from "./hooks/usePrettify.js";
import { useSchema } from "./hooks/useSchema.js";
import type { RuruStorage } from "./hooks/useStorage.js";
import { useStorage } from "./hooks/useStorage.js";
import type { RuruProps } from "./interfaces.js";
import { EXPLAIN_PLUGIN } from "./plugins/explain.js";

const checkCss = { width: "1.5rem", display: "inline-block" };
const check = <span style={checkCss}>✔</span>;
const nocheck = <span style={checkCss}></span>;

export const Ruru: FC<RuruProps> = (props) => {
  const storage = useStorage();
  const explain = storage.get("explain") === "true";
  const setExplain = useCallback(
    (newExplain: boolean) => {
      storage.set("explain", newExplain ? "true" : "");
    },
    [storage],
  );
  const { fetcher, explainResults, streamEndpoint } = useFetcher(props, {
    explain,
  });
  const [error, setError] = useState<Error | null>(null);
  const explainHelpers = useExplain(storage);
  const { schema } = useSchema(props, fetcher, setError, streamEndpoint);
  const plugins = useMemo(() => {
    return [EXPLAIN_PLUGIN];
  }, []);
  return (
    <ExplainContext.Provider
      value={{
        explainHelpers,
        explain,
        setExplain,
        explainResults,
      }}
    >
      <GraphiQLProvider
        fetcher={fetcher}
        schema={schema}
        defaultQuery={defaultQuery}
        plugins={plugins}
      >
        <RuruInner
          storage={storage}
          editorTheme={props.editorTheme}
          error={error}
          setError={setError}
        />
      </GraphiQLProvider>
    </ExplainContext.Provider>
  );
};

export const RuruInner: FC<{
  editorTheme?: string;
  storage: RuruStorage;
  error: Error | null;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
}> = (props) => {
  const { storage, editorTheme, error, setError } = props;
  const prettify = usePrettify();
  const mergeQuery = useMergeQuery();
  const copyQuery = useCopyQuery();

  return (
    <div
      className="graphiql-container"
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: "1 1 100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <GraphiQLInterface editorTheme={editorTheme ?? "dracula"}>
          <GraphiQL.Logo>
            <a
              href="https://grafast.org/ruru"
              style={{ textDecoration: "none" }}
              target="_blank"
              rel="noreferrer"
            >
              Ruru
            </a>
          </GraphiQL.Logo>
          <GraphiQL.Toolbar>
            <ToolbarButton
              onClick={prettify}
              label="Prettify Query (Shift-Ctrl-P)"
            >
              <PrettifyIcon
                className="graphiql-toolbar-icon"
                aria-hidden="true"
              />
            </ToolbarButton>
            <ToolbarButton
              onSelect={mergeQuery}
              label="Merge Query (Shift-Ctrl-M)"
            >
              <MergeIcon className="graphiql-toolbar-icon" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              onClick={copyQuery}
              label="Copy query (Shift-Ctrl-C)"
            >
              <CopyIcon className="graphiql-toolbar-icon" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarMenu
              label="Options"
              button={
                <ToolbarButton label="Options">
                  <SettingsIcon
                    className="graphiql-toolbar-icon"
                    aria-hidden="true"
                  />
                </ToolbarButton>
              }
            >
              <ToolbarMenu.Item
                title="View the SQL statements that this query invokes"
                onSelect={() => storage.toggle("explain")}
              >
                <span>
                  {storage.get("explain") === "true" ? check : nocheck}
                  Explain (if supported)
                </span>
              </ToolbarMenu.Item>
              <ToolbarMenu.Item
                title="Should we persist the headers to localStorage? Header editor is next to variable editor at the bottom."
                onSelect={() => storage.toggle("saveHeaders")}
              >
                <span>
                  {storage.get("saveHeaders") === "true" ? check : nocheck}
                  Save headers
                </span>
              </ToolbarMenu.Item>
            </ToolbarMenu>
          </GraphiQL.Toolbar>
          <GraphiQL.Footer>
            <RuruFooter />
          </GraphiQL.Footer>
        </GraphiQLInterface>
      </div>
      {error ? (
        <ErrorPopup error={error} onClose={() => setError(null)} />
      ) : null}
    </div>
  );
};
