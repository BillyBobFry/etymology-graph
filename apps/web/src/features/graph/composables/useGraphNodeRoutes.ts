import type { RouteLocationRaw } from "vue-router";

export type GraphNodeRouteParams = {
  langCode: string;
  term: string;
};

export type AncestorLanguageRouteParams = {
  langCode: string;
  ancestorLangCode: string;
};

type GraphNodeRoutes = {
  getEtymologyRoute: (params: GraphNodeRouteParams) => RouteLocationRaw;
  getDoubletsRoute: (params: GraphNodeRouteParams) => RouteLocationRaw;
  getAncestorLanguageRoute: (params: AncestorLanguageRouteParams) => RouteLocationRaw;
};

/** Builds route objects for graph node actions without coupling callers to route names. */
export const useGraphNodeRoutes = (): GraphNodeRoutes => {
  /** Opens the ancestry graph for a typed language and term pair. */
  const getEtymologyRoute = (params: GraphNodeRouteParams): RouteLocationRaw => ({
    name: "etymology",
    params: {
      langCode: params.langCode,
      term: params.term
    }
  });

  /** Opens same-language doublet candidates for a typed language and term pair. */
  const getDoubletsRoute = (params: GraphNodeRouteParams): RouteLocationRaw => ({
    name: "doublets",
    params: {
      langCode: params.langCode,
      term: params.term
    }
  });

  /** Opens the language-pair search for entries whose ancestry reaches a source language. */
  const getAncestorLanguageRoute = (params: AncestorLanguageRouteParams): RouteLocationRaw => ({
    name: "ancestor-language-results",
    params: {
      langCode: params.langCode,
      ancestorLangCode: params.ancestorLangCode
    }
  });

  return {
    getEtymologyRoute,
    getDoubletsRoute,
    getAncestorLanguageRoute
  };
};
