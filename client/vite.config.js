import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the React app runs on :5173 and proxies socket.io to the Node server on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // lets friends on the same WiFi open http://<your-ip>:5173
    proxy: {
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
