import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener todas las categorías
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("categoria").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Obtener categoría por id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("categoria")
    .select("*")
    .eq("id_categoria", req.params.id)
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Crear categoría
router.post("/", async (req, res) => {
  const { nombre, descripcion } = req.body;
  const { data, error } = await supabase
    .from("categoria")
    .insert([{ nombre, descripcion }])
    .select()
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;