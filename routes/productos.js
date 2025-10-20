import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener todos los productos
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("producto").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Obtener producto por id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("producto")
    .select("*")
    .eq("id_producto", req.params.id)
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;
