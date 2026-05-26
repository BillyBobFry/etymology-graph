import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import DoubletsSearchView from "./DoubletsSearchView.vue";
import DoubletsView from "./DoubletsView.vue";
import EtymologySearchView from "./EtymologySearchView.vue";
import EtymologyView from "./EtymologyView.vue";
import HomeView from "./HomeView.vue";
import NotFoundView from "./NotFoundView.vue";

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
    path: "/doublets/:langCode/:term",
    name: "doublets",
    component: DoubletsView
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
