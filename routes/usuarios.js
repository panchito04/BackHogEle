import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Crear usuario
router.post("/", async (req, res) => {
  const { nombre, email, contrasena, rol } = req.body;
  const { data, error } = await supabase
    .from("usuario")
    .insert([{ nombre, email, contrasena, rol }])
    .select()
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

router.get("/", async (req, res) => {
  const { email, contrasena } = req.query
  let query = supabase.from("usuario").select("*")
  
  if (email && contrasena) {
    query = query.eq('email', email).eq('contrasena', contrasena)
  }

  const { data, error } = await query

  if (error) return res.status(500).json(error)
  res.json(data)
});


export default router;
