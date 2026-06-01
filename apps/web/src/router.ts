import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import AncestorLanguageSearchView from "./views/AncestorLanguageSearchView.vue";
import DoubletsSearchView from "./views/DoubletsSearchView.vue";
import DoubletsView from "./views/DoubletsView.vue";
import EtymologySearchView from "./views/EtymologySearchView.vue";
import EtymologyView from "./views/EtymologyView.vue";
import HomeView from "./views/HomeView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import SoundChangeArticleView from "./views/SoundChangeArticleView.vue";
import SoundChangesView from "./views/SoundChangesView.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: HomeView
  },
  {
    path: "/etymology",
    name: "etymology-search",
    component: EtymologySearchView
  },
  {
    path: "/etymology/:langCode/:term",
    name: "etymology",
    component: EtymologyView
  },
  {
    path: "/doublets",
    name: "doublets-search",
    component: DoubletsSearchView
  },
  {
    path: "/doublets/:langCode",
    name: "doublet-groups",
    component: DoubletsSearchView
  },
  {
    path: "/doublets/:langCode/:term",
    name: "doublets",
    component: DoubletsView
  },
  {
    path: "/ancestor-languages",
    name: "ancestor-language-search",
    component: AncestorLanguageSearchView
  },
  {
    path: "/ancestor-languages/:langCode/:ancestorLangCode",
    name: "ancestor-language-results",
    component: AncestorLanguageSearchView
  },
  {
    path: "/sound-changes",
    name: "sound-changes",
    component: SoundChangesView
  },
  {
    path: "/sound-changes/:slug",
    name: "sound-change-article",
    component: SoundChangeArticleView
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundView
  }
];

/** Creates the browser router around user-facing graph exploration surfaces. */
export const router = createRouter({
  history: createWebHistory(),
  routes
});
