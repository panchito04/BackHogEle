import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import productosRoutes from "./routes/productos.js";
import clientesRoutes from "./routes/clientes.js";
import pedidosRoutes from "./routes/pedidos.js";
import pagosRoutes from "./routes/pagos.js";
import usuariosRoutes from "./routes/usuarios.js";
import resumenRoutes from "./routes/resumen.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Rutas
app.use("/api/productos", productosRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/resumen", resumenRoutes);

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

    // Podrías generar un token JWT si lo deseas
    res.json({ success: true, token: "fake-token" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
