// routes/pagos.js - RUTAS PARA CONSULTAS DE PAGOS
import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// =============================================
// OBTENER TODOS LOS PAGOS
// =============================================
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pago")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// OBTENER PAGOS DE UN PEDIDO ESPECÍFICO
// =============================================
router.get("/pedido/:id_pedido", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pago")
      .select("*")
      .eq("id_pedido", req.params.id_pedido)
      .order("fecha", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error al obtener pagos del pedido:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// OBTENER UN PAGO ESPECÍFICO
// =============================================
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pago")
      .select("*")
      .eq("id_pago", req.params.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error al obtener pago:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ACTUALIZAR PAGO
// =============================================
router.put("/:id", async (req, res) => {
  const { monto, metodo, comprobante_url } = req.body;

  try {
    const updateData = {};
    if (monto) updateData.monto = parseFloat(monto);
    if (metodo) updateData.metodo = metodo;
    if (comprobante_url !== undefined) updateData.comprobante_url = comprobante_url;

    const { data, error } = await supabase
      .from("pago")
      .update(updateData)
      .eq("id_pago", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Pago actualizado exitosamente", pago: data });
  } catch (error) {
    console.error("Error al actualizar pago:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ELIMINAR PAGO
// =============================================
router.delete("/:id", async (req, res) => {
  try {
    // Obtener información del pago antes de eliminarlo
    const { data: pago, error: errorPago } = await supabase
      .from("pago")
      .select("id_pedido")
      .eq("id_pago", req.params.id)
      .single();

    if (errorPago) throw errorPago;

    // Eliminar el pago
    const { error } = await supabase
      .from("pago")
      .delete()
      .eq("id_pago", req.params.id);

    if (error) throw error;

    // Cambiar el estado del pedido a 'pendiente'
    const { error: errorActualizar } = await supabase
      .from("pedido")
      .update({ estado: 'pendiente' })
      .eq("id_pedido", pago.id_pedido);

    if (errorActualizar) {
      console.error("Error al actualizar estado del pedido:", errorActualizar);
    }

    res.json({ 
      message: "Pago eliminado exitosamente. El pedido volvió a estado pendiente." 
    });
  } catch (error) {
    console.error("Error al eliminar pago:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;