import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Crear pedido
router.post("/", async (req, res) => {
  const { id_cliente, detalles, observaciones } = req.body;

  try {
    // Crear pedido
    const { data: pedido, error: errorPedido } = await supabase
      .from("pedido")
      .insert([{ id_cliente, observaciones }])
      .select()
      .single();

    if (errorPedido) {
      console.error("Error al crear pedido:", errorPedido);
      return res.status(500).json({ error: "Error al crear pedido", details: errorPedido });
    }

    // Insertar detalles
    const detalleData = detalles.map(d => ({
      id_pedido: pedido.id_pedido,
      id_producto: d.id_producto,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario
    }));

    const { error: errorDetalle } = await supabase
      .from("detalle_pedido")
      .insert(detalleData);

    if (errorDetalle) {
      console.error("Error al crear detalles:", errorDetalle);
      return res.status(500).json({ error: "Error al crear detalles", details: errorDetalle });
    }

    res.json({ pedido, detalle: detalleData });
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al crear pedido", message: error.message });
  }
});

// Obtener todos los pedidos
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pedido")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.error("Error al obtener pedidos:", error);
      return res.status(500).json({ error: "Error al obtener pedidos", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al obtener pedidos", message: error.message });
  }
});

// Obtener detalles de un pedido
router.get("/:id/detalles", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("detalle_pedido")
      .select("*")
      .eq("id_pedido", req.params.id);

    if (error) {
      console.error("Error al obtener detalles:", error);
      return res.status(500).json({ error: "Error al obtener detalles", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al obtener detalles", message: error.message });
  }
});

// Obtener un pedido específico
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pedido")
      .select("*")
      .eq("id_pedido", req.params.id)
      .single();

    if (error) {
      console.error("Error al obtener pedido:", error);
      return res.status(500).json({ error: "Error al obtener pedido", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al obtener pedido", message: error.message });
  }
});

// Actualizar estado del pedido
router.put("/:id", async (req, res) => {
  const { estado, observaciones } = req.body;

  try {
    const updateData = {};
    if (estado) updateData.estado = estado;
    if (observaciones !== undefined) updateData.observaciones = observaciones;

    const { data, error } = await supabase
      .from("pedido")
      .update(updateData)
      .eq("id_pedido", req.params.id)
      .select()
      .single();

    if (error) {
      console.error("Error al actualizar pedido:", error);
      return res.status(500).json({ error: "Error al actualizar pedido", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al actualizar pedido", message: error.message });
  }
});

// Eliminar pedido
router.delete("/:id", async (req, res) => {
  try {
    // Primero eliminar detalles (por cascade debería hacerse automático, pero por si acaso)
    const { error: errorDetalles } = await supabase
      .from("detalle_pedido")
      .delete()
      .eq("id_pedido", req.params.id);

    if (errorDetalles) {
      console.error("Error al eliminar detalles:", errorDetalles);
    }

    // Luego eliminar pedido
    const { error } = await supabase
      .from("pedido")
      .delete()
      .eq("id_pedido", req.params.id);

    if (error) {
      console.error("Error al eliminar pedido:", error);
      return res.status(500).json({ error: "Error al eliminar pedido", details: error });
    }

    res.json({ message: "Pedido eliminado exitosamente" });
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al eliminar pedido", message: error.message });
  }
});

export default router;