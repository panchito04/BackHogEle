import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener resumen de ventas
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("vw_resumen_ventas").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;
