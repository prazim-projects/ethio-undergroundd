import { createApp } from "vue";
import App from "./app.vue";
import "./styles.css";

createApp(App).mount("#app");

if (import.meta.env.MODE === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
