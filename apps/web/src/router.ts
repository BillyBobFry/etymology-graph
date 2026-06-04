import { createRouter, createWebHistory, type RouteLocationNormalizedLoaded, type RouteRecordRaw } from "vue-router";

import AncestorLanguageSearchView from "./views/AncestorLanguageSearchView.vue";
import DoubletsSearchView from "./views/DoubletsSearchView.vue";
import DoubletsView from "./views/DoubletsView.vue";
import EtymologySearchView from "./views/EtymologySearchView.vue";
import { findSoundChangeArticle } from "./features/soundChanges/soundChanges";
import EtymologyView from "./views/EtymologyView.vue";
import HomeView from "./views/HomeView.vue";
import LanguageDetailView from "./views/LanguageDetailView.vue";
import LanguageTermsView from "./views/LanguageTermsView.vue";
import LogoStudyView from "./views/LogoStudyView.vue";
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
    path: "/logo",
    name: "logo-study",
    component: LogoStudyView,
    meta: {
      title: "Logo Study"
    }
  },
  {
    path: "/etymology",
    name: "etymology-search",
    component: EtymologySearchView,
    meta: {
      title: "Word Lineages"
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
    path: "/word-lineages",
    name: "ancestor-language-search",
    component: AncestorLanguageSearchView,
    meta: {
      title: "Word Lineages"
    }
  },
  {
    path: "/word-lineages/:langCode/:ancestorLangCode",
    name: "ancestor-language-results",
    component: AncestorLanguageSearchView,
    meta: {
      title: ancestorLanguageResultsRouteTitle
    }
  },
  {
    path: "/ancestor-languages",
    redirect: { name: "ancestor-language-search" }
  },
  {
    path: "/ancestor-languages/:langCode/:ancestorLangCode",
    redirect: (to) => ({
      name: "ancestor-language-results",
      params: to.params
    })
  },
  {
    path: "/languages/:langCode",
    name: "language-detail",
    component: LanguageDetailView,
    meta: {
      title: languageDetailRouteTitle
    }
  },
  {
    path: "/languages/:langCode/terms",
    name: "language-terms",
    component: LanguageTermsView,
    meta: {
      title: languageTermsRouteTitle
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
  /** Restores browser history positions and only resets scroll when changing atlas sections. */
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }

    return routeTopLevelPath(to.path) === routeTopLevelPath(from.path) ? false : { left: 0, top: 0 };
  }
});

/** Groups path-param changes under the same top-level route so in-page selections do not jump. */
function routeTopLevelPath(path: string): string {
  return path.split("/").find(Boolean) ?? "/";
}

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

/** Names word-lineage result tabs after the selected language pair. */
function ancestorLanguageResultsRouteTitle(
  route: RouteLocationNormalizedLoaded,
  context: RouteDocumentTitleContext
): string {
  const langCode = firstRouteParam(route.params.langCode);
  const ancestorLangCode = firstRouteParam(route.params.ancestorLangCode);

  return langCode && ancestorLangCode
    ? `${context.languageNameForCode(langCode)} from ${context.languageNameForCode(ancestorLangCode)}`
    : "Word Lineages";
}

/** Names language detail tabs after the selected language code. */
function languageDetailRouteTitle(route: RouteLocationNormalizedLoaded, context: RouteDocumentTitleContext): string {
  const langCode = firstRouteParam(route.params.langCode);

  return langCode ? `${context.languageNameForCode(langCode)} Language` : "Language";
}

/** Names language term index tabs after the selected language. */
function languageTermsRouteTitle(route: RouteLocationNormalizedLoaded, context: RouteDocumentTitleContext): string {
  const langCode = firstRouteParam(route.params.langCode);

  return langCode ? `${context.languageNameForCode(langCode)} Terms` : "Language Terms";
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
