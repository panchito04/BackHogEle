import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener todos los clientes
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("cliente").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Obtener cliente por id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("cliente")
    .select("*")
    .eq("id_cliente", req.params.id)
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Crear cliente
router.post("/", async (req, res) => {
  const { nombre, tiktok_usuario, telefono, direccion } = req.body;
  const { data, error } = await supabase
    .from("cliente")
    .insert([{ nombre, tiktok_usuario, telefono, direccion }])
    .select()
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;
