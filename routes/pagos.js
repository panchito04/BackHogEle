import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Crear pago y actualizar estado del pedido a 'pagado'
router.post("/", async (req, res) => {
  const { id_pedido, monto, metodo, comprobante_url } = req.body;

  try {
    // Validar datos requeridos
    if (!id_pedido || !monto || !metodo) {
      return res.status(400).json({ 
        error: "Faltan datos requeridos: id_pedido, monto y metodo son obligatorios" 
      });
    }

    // Verificar que el pedido existe y está en estado pendiente
    const { data: pedido, error: errorPedido } = await supabase
      .from("pedido")
      .select("estado")
      .eq("id_pedido", id_pedido)
      .single();

    if (errorPedido) {
      console.error("Error al verificar pedido:", errorPedido);
      return res.status(404).json({ error: "Pedido no encontrado", details: errorPedido });
    }

    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({ 
        error: `No se puede registrar pago. El pedido está en estado: ${pedido.estado}` 
      });
    }

    // Registrar el pago
    const { data: pago, error: errorPago } = await supabase
      .from("pago")
      .insert([{
        id_pedido,
        monto: parseFloat(monto),
        metodo,
        comprobante_url: comprobante_url || null
      }])
      .select()
      .single();

    if (errorPago) {
      console.error("Error al registrar pago:", errorPago);
      return res.status(500).json({ error: "Error al registrar pago", details: errorPago });
    }

    // Actualizar el estado del pedido a 'pagado'
    const { error: errorActualizar } = await supabase
      .from("pedido")
      .update({ estado: 'pagado' })
      .eq("id_pedido", id_pedido);

    if (errorActualizar) {
      console.error("Error al actualizar estado del pedido:", errorActualizar);
      // Revertir el pago si no se pudo actualizar el estado
      await supabase.from("pago").delete().eq("id_pago", pago.id_pago);
      return res.status(500).json({ 
        error: "Error al actualizar estado del pedido", 
        details: errorActualizar 
      });
    }

    res.json({ 
      message: "Pago registrado exitosamente y pedido marcado como pagado",
      pago 
    });
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al procesar pago", message: error.message });
  }
});

// Obtener todos los pagos
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pago")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.error("Error al obtener pagos:", error);
      return res.status(500).json({ error: "Error al obtener pagos", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al obtener pagos", message: error.message });
  }
});

// Obtener pagos de un pedido específico
router.get("/pedido/:id_pedido", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pago")
      .select("*")
      .eq("id_pedido", req.params.id_pedido)
      .order("fecha", { ascending: false });

    if (error) {
      console.error("Error al obtener pagos del pedido:", error);
      return res.status(500).json({ error: "Error al obtener pagos", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al obtener pagos", message: error.message });
  }
});

// Obtener un pago específico
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pago")
      .select("*")
      .eq("id_pago", req.params.id)
      .single();

    if (error) {
      console.error("Error al obtener pago:", error);
      return res.status(500).json({ error: "Error al obtener pago", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al obtener pago", message: error.message });
  }
});

// Actualizar pago (por ejemplo, agregar comprobante)
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

    if (error) {
      console.error("Error al actualizar pago:", error);
      return res.status(500).json({ error: "Error al actualizar pago", details: error });
    }

    res.json(data);
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al actualizar pago", message: error.message });
  }
});

// Eliminar pago (también debería cambiar el estado del pedido a pendiente)
router.delete("/:id", async (req, res) => {
  try {
    // Obtener información del pago antes de eliminarlo
    const { data: pago, error: errorPago } = await supabase
      .from("pago")
      .select("id_pedido")
      .eq("id_pago", req.params.id)
      .single();

    if (errorPago) {
      console.error("Error al obtener pago:", errorPago);
      return res.status(404).json({ error: "Pago no encontrado", details: errorPago });
    }

    // Eliminar el pago
    const { error } = await supabase
      .from("pago")
      .delete()
      .eq("id_pago", req.params.id);

    if (error) {
      console.error("Error al eliminar pago:", error);
      return res.status(500).json({ error: "Error al eliminar pago", details: error });
    }

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
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al eliminar pago", message: error.message });
  }
});

export default router;