import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./app.vue";
import "./styles.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/:pathMatch(.*)*", component: App }],
});
createApp(App).use(router).mount("#app");
