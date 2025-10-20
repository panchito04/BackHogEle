import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Crear pedido
router.post("/", async (req, res) => {
  const { id_cliente, detalles, observaciones } = req.body;

  const { data: pedido, error: errorPedido } = await supabase
    .from("pedido")
    .insert([{ id_cliente, observaciones }])
    .select()
    .single();

  if (errorPedido) return res.status(500).json(errorPedido);

  const detalleData = detalles.map(d => ({
    id_pedido: pedido.id_pedido,
    id_producto: d.id_producto,
    cantidad: d.cantidad,
    precio_unitario: d.precio_unitario
  }));

  const { error: errorDetalle } = await supabase
    .from("detalle_pedido")
    .insert(detalleData);

  if (errorDetalle) return res.status(500).json(errorDetalle);

  res.json({ pedido, detalle: detalleData });
});

// Obtener todos los pedidos
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("pedido").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

router.get("/:id/detalles", async (req, res) => {
  const { data, error } = await supabase
    .from("detalle_pedido")
    .select("*")
    .eq("id_pedido", req.params.id);
  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;
