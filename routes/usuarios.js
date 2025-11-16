import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Roles válidos
const ROLES_VALIDOS = ['admin', 'vendedor', 'entregas'];

// Crear usuario
router.post("/", async (req, res) => {
  const { nombre, email, contrasena, rol } = req.body;

  // Validación básica
  if (!nombre || !email || !contrasena) {
    return res.status(400).json({ 
      message: 'Nombre, email y contraseña son requeridos' 
    });
  }

  // Validar que el rol sea uno de los permitidos
  if (!rol || !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ 
      message: `Rol inválido. Los roles permitidos son: ${ROLES_VALIDOS.join(', ')}` 
    });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      message: 'Correo electrónico inválido' 
    });
  }

  // Validar longitud de contraseña
  if (contrasena.length < 6) {
    return res.status(400).json({ 
      message: 'La contraseña debe tener al menos 6 caracteres' 
    });
  }

  try {
    // Verificar si el email ya existe
    const { data: usuarioExistente, error: errorBusqueda } = await supabase
      .from("usuario")
      .select("id")
      .eq('email', email)
      .single();

    if (usuarioExistente) {
      return res.status(400).json({ 
        message: 'Este correo electrónico ya está registrado' 
      });
    }

    // Si no hay error pero tampoco usuario, es normal (no existe)
    // Si hay error por "no rows", también es normal

    // Crear el nuevo usuario
    const { data, error } = await supabase
      .from("usuario")
      .insert([{ 
        nombre, 
        email, 
        contrasena, 
        rol,
        fecha_creacion: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error en Supabase:', error);
      return res.status(500).json({ message: 'Error al crear usuario en la base de datos' });
    }

    // Retornar solo datos seguros (no la contraseña)
    const { contrasena: _, ...usuarioSeguro } = data;
    res.status(201).json(usuarioSeguro);

  } catch (error) {
    console.error('Error en servidor:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});

// Obtener usuarios (login)
router.get("/", async (req, res) => {
  const { email, contrasena } = req.query;
  
  if (!email || !contrasena) {
    return res.status(400).json({ 
      message: 'Email y contraseña son requeridos' 
    });
  }

  try {
    let query = supabase.from("usuario").select("*");

    if (email && contrasena) {
      query = query.eq('email', email).eq('contrasena', contrasena);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(401).json({ 
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    // Retornar solo datos seguros
    const usuariosSeguro = data.map(({ contrasena: _, ...user }) => user);
    res.json(usuariosSeguro);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});


export default router;