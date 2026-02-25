import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "[Startup] Missing required env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY. The app will not function correctly."
  );
}

createRoot(document.getElementById("root")!).render(<App />);
