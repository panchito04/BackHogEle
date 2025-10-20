import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Crear pago
router.post("/", async (req, res) => {
  const { id_pedido, monto, metodo, comprobante_url } = req.body;
  const { data, error } = await supabase
    .from("pago")
    .insert([{ id_pedido, monto, metodo, comprobante_url }])
    .select()
    .single();
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Obtener todos los pagos
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("pago").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;
