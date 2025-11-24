// backend/routes/usuarios.js - COMPATIBLE CON TEXTO PLANO Y BCRYPT
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../server.js";
import { verificarToken, verificarRol } from "../middleware/auth.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'hogar_elegante_super_secret_key_2024_production_render';
const ROLES_VALIDOS = ['admin', 'vendedor', 'entregas'];

// Función para generar token
const generarToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.usuario_id || usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Función para verificar contraseña (texto plano O encriptada)
const verificarContrasena = async (contrasenaIngresada, contrasenaDB) => {
  // Si la contraseña en DB está encriptada (empieza con $2a$ o $2b$)
  if (contrasenaDB.startsWith('$2a$') || contrasenaDB.startsWith('$2b$')) {
    return await bcrypt.compare(contrasenaIngresada, contrasenaDB);
  }
  // Si es texto plano, comparar directamente
  return contrasenaIngresada === contrasenaDB;
};

// REGISTRO
router.post("/registro", async (req, res) => {
  const { nombre, email, contrasena, rol } = req.body;

  console.log("📝 Intento de registro:", { nombre, email, rol });

  if (!nombre || !email || !contrasena) {
    return res.status(400).json({ 
      success: false,
      message: 'Nombre, email y contraseña son requeridos' 
    });
  }

  if (!rol || !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ 
      success: false,
      message: `Rol inválido. Los roles permitidos son: ${ROLES_VALIDOS.join(', ')}` 
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false,
      message: 'Correo electrónico inválido' 
    });
  }

  if (contrasena.length < 3) {
    return res.status(400).json({ 
      success: false,
      message: 'La contraseña debe tener al menos 3 caracteres' 
    });
  }

  try {
    // Verificar si el email ya existe
    const { data: usuarioExistente } = await supabase
      .from("usuario")
      .select("*")
      .eq('email', email)
      .maybeSingle();

    if (usuarioExistente) {
      return res.status(400).json({ 
        success: false,
        message: 'Este correo electrónico ya está registrado' 
      });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

    // Crear usuario
    const { data, error } = await supabase
      .from("usuario")
      .insert([{ 
        nombre, 
        email, 
        contrasena: contrasenaEncriptada, 
        rol
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error en Supabase:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al crear usuario en la base de datos',
        error: error.message
      });
    }

    console.log("✅ Usuario creado:", data.email);

    // Generar token
    const token = generarToken(data);

    // Usuario sin contraseña
    const { contrasena: _, ...usuarioSeguro } = data;

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      token,
      usuario: usuarioSeguro
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
});

// LOGIN - Compatible con texto plano Y bcrypt
router.post("/login", async (req, res) => {
  const { email, contrasena } = req.body;
  
  console.log("🔐 Intento de login:", { email });
  
  if (!email || !contrasena) {
    return res.status(400).json({ 
      success: false,
      message: 'Email y contraseña son requeridos' 
    });
  }

  try {
    // Buscar usuario por email
    const { data: usuario, error } = await supabase
      .from("usuario")
      .select("*")
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Error en Supabase:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al buscar usuario' 
      });
    }

    if (!usuario) {
      console.log("❌ Usuario no encontrado:", email);
      return res.status(401).json({ 
        success: false,
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    console.log("✅ Usuario encontrado:", usuario.email);

    // Verificar contraseña (texto plano O encriptada)
    const contrasenaValida = await verificarContrasena(contrasena, usuario.contrasena);

    if (!contrasenaValida) {
      console.log("❌ Contraseña incorrecta para:", email);
      return res.status(401).json({ 
        success: false,
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    console.log("✅ Login exitoso:", email);

    // Generar token
    const token = generarToken(usuario);

    // Usuario sin contraseña
    const { contrasena: _, ...usuarioSeguro } = usuario;

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario: usuarioSeguro
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al iniciar sesión',
      error: error.message
    });
  }
});

// VERIFICAR TOKEN
router.get("/verificar", verificarToken, async (req, res) => {
  try {
    const { data: usuario, error } = await supabase
      .from("usuario")
      .select("*")
      .eq('email', req.usuario.email)
      .maybeSingle();

    if (error || !usuario) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    const { contrasena: _, ...usuarioSeguro } = usuario;

    res.json({
      success: true,
      usuario: usuarioSeguro
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error al verificar usuario' 
    });
  }
});

// OBTENER PERFIL
router.get("/perfil", verificarToken, async (req, res) => {
  try {
    const { data: usuario, error } = await supabase
      .from("usuario")
      .select("*")
      .eq('email', req.usuario.email)
      .maybeSingle();

    if (error || !usuario) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    const { contrasena: _, ...usuarioSeguro } = usuario;

    res.json({
      success: true,
      usuario: usuarioSeguro
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener perfil' 
    });
  }
});

// LISTAR USUARIOS (solo admin)
router.get("/", verificarToken, verificarRol('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuario")
      .select("*")
      .order('email', { ascending: true });

    if (error) {
      return res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }

    // Remover contraseñas de todos los usuarios
    const usuariosSeguro = data.map(({ contrasena, ...usuario }) => usuario);

    res.json({
      success: true,
      usuarios: usuariosSeguro
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener usuarios' 
    });
  }
});

export default router;