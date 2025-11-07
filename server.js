import dotenv from "dotenv";
dotenv.config(); // ⚠️ ESTO DEBE IR PRIMERO, ANTES DE TODO

import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

import productosRoutes from "./routes/productos.js";
import clientesRoutes from "./routes/clientes.js";
import pedidosRoutes from "./routes/pedidos.js";
import pagosRoutes from "./routes/pagos.js";
import usuariosRoutes from "./routes/usuarios.js";
import categoriasRoutes from "./routes/categorias.js";
import homeRoutes from "./routes/home.js";
import cajasRoutes from "./routes/cajas.js";

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://front-hog-ele.vercel.app'
  ]
}));

app.use(express.json());

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Rutas
app.use("/api/productos", productosRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/cajas", cajasRoutes);

app.post("/api/login", async (req, res) => {
  const { email, contrasena } = req.body;
  try {
    const { data, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("email", email)
      .eq("contrasena", contrasena)
      .single();

    if (error || !data) return res.json({ success: false });

    res.json({ success: true, token: "fake-token" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 CORS habilitado para: http://localhost:5173 y Vercel`);
});