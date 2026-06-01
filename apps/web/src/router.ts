import { createRouter, createWebHistory, type RouteLocationNormalizedLoaded, type RouteRecordRaw } from "vue-router";

import AncestorLanguageSearchView from "./views/AncestorLanguageSearchView.vue";
import DoubletsSearchView from "./views/DoubletsSearchView.vue";
import DoubletsView from "./views/DoubletsView.vue";
import EtymologySearchView from "./views/EtymologySearchView.vue";
import { findSoundChangeArticle } from "./features/soundChanges/soundChanges";
import EtymologyView from "./views/EtymologyView.vue";
import HomeView from "./views/HomeView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import SoundChangeArticleView from "./views/SoundChangeArticleView.vue";
import SoundChangesView from "./views/SoundChangesView.vue";

export type RouteDocumentTitleContext = {
  languageNameForCode: (langCode: string) => string;
};
export type RouteDocumentTitle = string | ((route: RouteLocationNormalizedLoaded, context: RouteDocumentTitleContext) => string);

declare module "vue-router" {
  interface RouteMeta {
    title?: RouteDocumentTitle;
  }
}

export const siteTitle = "Lingraphic";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: HomeView,
    meta: {
      title: siteTitle
    }
  },
  {
    path: "/etymology",
    name: "etymology-search",
    component: EtymologySearchView,
    meta: {
      title: "Etymology Lookup"
    }
  },
  {
    path: "/etymology/:langCode/:term",
    name: "etymology",
    component: EtymologyView,
    meta: {
      title: etymologyRouteTitle
    }
  },
  {
    path: "/doublets",
    name: "doublets-search",
    component: DoubletsSearchView,
    meta: {
      title: "Doublets"
    }
  },
  {
    path: "/doublets/:langCode",
    name: "doublet-groups",
    component: DoubletsSearchView,
    meta: {
      title: doubletGroupsRouteTitle
    }
  },
  {
    path: "/doublets/:langCode/:term",
    name: "doublets",
    component: DoubletsView,
    meta: {
      title: doubletsRouteTitle
    }
  },
  {
    path: "/ancestor-languages",
    name: "ancestor-language-search",
    component: AncestorLanguageSearchView,
    meta: {
      title: "Source Language Lookup"
    }
  },
  {
    path: "/ancestor-languages/:langCode/:ancestorLangCode",
    name: "ancestor-language-results",
    component: AncestorLanguageSearchView,
    meta: {
      title: ancestorLanguageResultsRouteTitle
    }
  },
  {
    path: "/sound-changes",
    name: "sound-changes",
    component: SoundChangesView,
    meta: {
      title: "Sound Changes"
    }
  },
  {
    path: "/sound-changes/:slug",
    name: "sound-change-article",
    component: SoundChangeArticleView,
    meta: {
      title: soundChangeArticleRouteTitle
    }
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundView,
    meta: {
      title: "Not Found"
    }
  }
];

/** Creates the browser router around user-facing graph exploration surfaces. */
export const router = createRouter({
  history: createWebHistory(),
  routes,
  /** Restores browser history positions while starting fresh route clicks at the top. */
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { left: 0, top: 0 }
});

/** Names etymology detail tabs after the selected term. */
function etymologyRouteTitle(route: RouteLocationNormalizedLoaded, context: RouteDocumentTitleContext): string {
  return termRouteTitle(route, context, "Etymology");
}

/** Names doublet detail tabs after the selected term. */
function doubletsRouteTitle(route: RouteLocationNormalizedLoaded, context: RouteDocumentTitleContext): string {
  return termRouteTitle(route, context, "Doublets");
}

/** Names language-filtered doublet lists after their selected result language. */
function doubletGroupsRouteTitle(route: RouteLocationNormalizedLoaded, context: RouteDocumentTitleContext): string {
  const langCode = firstRouteParam(route.params.langCode);

  return langCode ? `${context.languageNameForCode(langCode)} Doublets` : "Doublets";
}

/** Names source-language result tabs after the selected language pair. */
function ancestorLanguageResultsRouteTitle(
  route: RouteLocationNormalizedLoaded,
  context: RouteDocumentTitleContext
): string {
  const langCode = firstRouteParam(route.params.langCode);
  const ancestorLangCode = firstRouteParam(route.params.ancestorLangCode);

  return langCode && ancestorLangCode
    ? `${context.languageNameForCode(langCode)} Words From ${context.languageNameForCode(ancestorLangCode)}`
    : "Source Language Lookup";
}

/** Uses the curated article title instead of exposing the slug in the browser tab. */
function soundChangeArticleRouteTitle(route: RouteLocationNormalizedLoaded): string {
  const slug = firstRouteParam(route.params.slug);

  return findSoundChangeArticle(slug ?? "")?.title ?? "Sound Change Article";
}

/** Builds detail-page titles from route params while preserving a useful page fallback. */
function termRouteTitle(
  route: RouteLocationNormalizedLoaded,
  context: RouteDocumentTitleContext,
  sectionLabel: string
): string {
  const term = firstRouteParam(route.params.term);
  const langCode = firstRouteParam(route.params.langCode);

  if (!term) {
    return sectionLabel;
  }

  return langCode ? `${term} (${context.languageNameForCode(langCode)}) ${sectionLabel}` : `${term} ${sectionLabel}`;
}

/** Extracts one route parameter from Vue Router's array-capable param shape. */
function firstRouteParam(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}
