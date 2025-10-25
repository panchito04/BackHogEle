import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Crear pedido
router.post("/", async (req, res) => {
  const { id_cliente, detalles, observaciones } = req.body;

  try {
    // Validar que hay detalles
    if (!detalles || detalles.length === 0) {
      return res.status(400).json({ error: "Debe incluir al menos un producto" });
    }

    // Verificar que los productos estén disponibles (no en otros pedidos activos)
    const productosIds = detalles.map(d => d.id_producto);
    
    const { data: pedidosActivos, error: errorVerificar } = await supabase
      .from("detalle_pedido")
      .select(`
        id_producto,
        pedido:id_pedido (
          estado
        )
      `)
      .in("id_producto", productosIds);

    if (errorVerificar) {
      console.error("Error al verificar productos:", errorVerificar);
      return res.status(500).json({ error: "Error al verificar disponibilidad de productos" });
    }

    // Filtrar productos que están en pedidos NO cancelados
    const productosNoDisponibles = pedidosActivos
      .filter(item => item.pedido && item.pedido.estado !== 'cancelado')
      .map(item => item.id_producto);

    if (productosNoDisponibles.length > 0) {
      return res.status(400).json({ 
        error: "Algunos productos ya están en otros pedidos",
        productos_no_disponibles: productosNoDisponibles
      });
    }

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

    // Insertar detalles (cantidad siempre es 1 porque productos son únicos)
    const detalleData = detalles.map(d => ({
      id_pedido: pedido.id_pedido,
      id_producto: d.id_producto,
      cantidad: 1, // Siempre 1 porque los productos son únicos
      precio_unitario: d.precio_unitario
    }));

    const { error: errorDetalle } = await supabase
      .from("detalle_pedido")
      .insert(detalleData);

    if (errorDetalle) {
      console.error("Error al crear detalles:", errorDetalle);
      // Revertir el pedido si falla la inserción de detalles
      await supabase.from("pedido").delete().eq("id_pedido", pedido.id_pedido);
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
    // Validar que solo se permitan estados válidos desde esta ruta
    // El estado 'pagado' solo debe establecerse desde la ruta de pagos
    if (estado && !['pendiente', 'entregado', 'cancelado', 'pagado'].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }

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
    // Verificar el estado del pedido antes de eliminar
    const { data: pedido, error: errorVerificar } = await supabase
      .from("pedido")
      .select("estado")
      .eq("id_pedido", req.params.id)
      .single();

    if (errorVerificar) {
      console.error("Error al verificar pedido:", errorVerificar);
      return res.status(500).json({ error: "Error al verificar pedido", details: errorVerificar });
    }

    // No permitir eliminar pedidos pagados o entregados
    if (pedido.estado === 'pagado' || pedido.estado === 'entregado') {
      return res.status(400).json({ 
        error: "No se puede eliminar un pedido que está pagado o entregado",
        estado_actual: pedido.estado
      });
    }

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

    res.json({ 
      message: "Pedido eliminado exitosamente. Los productos están nuevamente disponibles." 
    });
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ error: "Error al eliminar pedido", message: error.message });
  }
});

export default router;