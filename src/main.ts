import { createSSRApp } from "vue";
import * as Pinia from "pinia";
import uviewPlus from "uview-plus";

import App from "./App.vue";

export function createApp() {
  const app = createSSRApp(App);
  app.use(Pinia.createPinia());
  app.use(uviewPlus);
  return {
    app,
    Pinia, // 此处必须将 Pinia 返回
  };
}
