// backend/server.js
import dotenv from "dotenv";
dotenv.config(); // ⚠️ ESTO DEBE IR PRIMERO

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";

// Importar rutas
import productosRoutes from "./routes/productos.js";
import clientesRoutes from "./routes/clientes.js";
import pedidosRoutes from "./routes/pedidos.js";
import pagosRoutes from "./routes/pagos.js";
import usuariosRoutes from "./routes/usuarios.js";
import categoriasRoutes from "./routes/categorias.js";
import homeRoutes from "./routes/home.js";
import cajasRoutes from "./routes/cajas.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Supabase
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Configurar CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://front-hog-ele.vercel.app',
        process.env.FRONTEND_URL
      ].filter(Boolean) // Filtrar valores null/undefined
    : [
        'http://localhost:5173',
        'http://localhost:3000'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Middleware para logging en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Rutas
app.use("/api/usuarios", usuariosRoutes); // ⚠️ Esta debe ir PRIMERO (contiene login y registro)
app.use("/api/productos", productosRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/cajas", cajasRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API de Hogar Elegante',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      usuarios: '/api/usuarios',
      productos: '/api/productos',
      clientes: '/api/clientes',
      pedidos: '/api/pedidos',
      pagos: '/api/pagos',
      categorias: '/api/categorias',
      cajas: '/api/cajas',
      home: '/api/home'
    }
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}` 
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message
  });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 CORS habilitado para:`, corsOptions.origin);
});