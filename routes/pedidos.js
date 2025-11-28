// routes/pedidos.js - BACKEND UNIFICADO CON PAGOS
import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// =============================================
// OBTENER TODOS LOS PEDIDOS CON DETALLES Y PAGOS
// =============================================
router.get("/", async (req, res) => {
  try {
    // Obtener pedidos
    const { data: pedidos, error: errorPedidos } = await supabase
      .from("pedido")
      .select("*")
      .order("fecha", { ascending: false });

    if (errorPedidos) throw errorPedidos;

    // Enriquecer cada pedido con detalles y pagos
    const pedidosCompletos = await Promise.all(
      pedidos.map(async (pedido) => {
        // Obtener detalles
        const { data: detalles } = await supabase
          .from("detalle_pedido")
          .select("*")
          .eq("id_pedido", pedido.id_pedido);

        // Obtener pagos
        const { data: pagos } = await supabase
          .from("pago")
          .select("*")
          .eq("id_pedido", pedido.id_pedido);

        return {
          ...pedido,
          detalles: detalles || [],
          pagos: pagos || []
        };
      })
    );

    res.json(pedidosCompletos);
  } catch (error) {
    console.error("Error al obtener pedidos:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// CREAR PEDIDO (CON O SIN PAGO)
// =============================================
router.post("/", async (req, res) => {
  const { id_cliente, observaciones, detalles, es_venta_directa, pago } = req.body;

  try {
    // Validar datos requeridos
    if (!id_cliente || !detalles || detalles.length === 0) {
      return res.status(400).json({ 
        error: "Faltan datos requeridos: id_cliente y detalles son obligatorios" 
      });
    }

    // Validar productos disponibles
    for (const detalle of detalles) {
      const { data: producto, error } = await supabase
        .from("producto")
        .select("cantidad, cantidad_disponible")
        .eq("id_producto", detalle.id_producto)
        .single();

      if (error || !producto) {
        return res.status(404).json({ 
          error: `Producto ${detalle.id_producto} no encontrado` 
        });
      }

      if (producto.cantidad_disponible < producto.cantidad) {
        return res.status(400).json({ 
          error: `Producto ${detalle.id_producto} no está completamente disponible` 
        });
      }
    }

    // Determinar estado inicial
    const estadoInicial = es_venta_directa ? 'pagado' : 'pendiente';

    // Crear pedido
    const { data: nuevoPedido, error: errorPedido } = await supabase
      .from("pedido")
      .insert([{
        id_cliente,
        observaciones: observaciones || null,
        estado: estadoInicial
      }])
      .select()
      .single();

    if (errorPedido) throw errorPedido;

    // Crear detalles del pedido
    const detallesFormateados = detalles.map(d => ({
      id_pedido: nuevoPedido.id_pedido,
      id_producto: d.id_producto,
      cantidad: 1, // Siempre 1 pack
      precio_unitario: d.precio_unitario
    }));

    const { error: errorDetalles } = await supabase
      .from("detalle_pedido")
      .insert(detallesFormateados);

    if (errorDetalles) {
      // Revertir pedido si falla
      await supabase.from("pedido").delete().eq("id_pedido", nuevoPedido.id_pedido);
      throw errorDetalles;
    }

    // Si es venta directa, registrar pago
    if (es_venta_directa && pago) {
      const { error: errorPago } = await supabase
        .from("pago")
        .insert([{
          id_pedido: nuevoPedido.id_pedido,
          monto: pago.monto,
          metodo: pago.metodo,
          comprobante_url: pago.comprobante_url || null
        }]);

      if (errorPago) {
        // Revertir todo si falla el pago
        await supabase.from("detalle_pedido").delete().eq("id_pedido", nuevoPedido.id_pedido);
        await supabase.from("pedido").delete().eq("id_pedido", nuevoPedido.id_pedido);
        throw errorPago;
      }
    }

    res.json({ 
      message: es_venta_directa 
        ? "Venta registrada exitosamente" 
        : "Pedido creado exitosamente",
      pedido: nuevoPedido 
    });
  } catch (error) {
    console.error("Error al crear pedido:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// OBTENER DETALLES DE UN PEDIDO
// =============================================
router.get("/:id/detalles", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("detalle_pedido")
      .select("*")
      .eq("id_pedido", req.params.id);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error al obtener detalles:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ACTUALIZAR PEDIDO (ESTADO)
// =============================================
router.put("/:id", async (req, res) => {
  const { estado } = req.body;

  try {
    if (!estado) {
      return res.status(400).json({ error: "El campo estado es requerido" });
    }

    // Validar estado
    const estadosValidos = ['pendiente', 'pagado', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        error: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}` 
      });
    }

    const { data, error } = await supabase
      .from("pedido")
      .update({ estado })
      .eq("id_pedido", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Estado actualizado exitosamente", pedido: data });
  } catch (error) {
    console.error("Error al actualizar pedido:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ELIMINAR PEDIDO
// =============================================
router.delete("/:id", async (req, res) => {
  try {
    // Verificar estado del pedido
    const { data: pedido, error: errorPedido } = await supabase
      .from("pedido")
      .select("estado")
      .eq("id_pedido", req.params.id)
      .single();

    if (errorPedido) throw errorPedido;

    if (pedido.estado === 'pagado' || pedido.estado === 'entregado') {
      return res.status(400).json({ 
        error: "No se puede eliminar un pedido pagado o entregado" 
      });
    }

    // Eliminar detalles (CASCADE debería hacerlo, pero por seguridad)
    await supabase
      .from("detalle_pedido")
      .delete()
      .eq("id_pedido", req.params.id);

    // Eliminar pedido
    const { error } = await supabase
      .from("pedido")
      .delete()
      .eq("id_pedido", req.params.id);

    if (error) throw error;

    res.json({ 
      message: "Pedido eliminado exitosamente. Productos disponibles nuevamente." 
    });
  } catch (error) {
    console.error("Error al eliminar pedido:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// REGISTRAR PAGO PARA PEDIDO EXISTENTE
// =============================================
router.post("/:id/pago", async (req, res) => {
  const { monto, metodo, comprobante_url } = req.body;

  try {
    if (!monto || !metodo) {
      return res.status(400).json({ 
        error: "Faltan datos requeridos: monto y metodo son obligatorios" 
      });
    }

    // Verificar que el pedido existe y está pendiente
    const { data: pedido, error: errorPedido } = await supabase
      .from("pedido")
      .select("estado")
      .eq("id_pedido", req.params.id)
      .single();

    if (errorPedido) throw errorPedido;

    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({ 
        error: `No se puede registrar pago. El pedido está en estado: ${pedido.estado}` 
      });
    }

    // Registrar el pago
    const { data: pago, error: errorPago } = await supabase
      .from("pago")
      .insert([{
        id_pedido: parseInt(req.params.id),
        monto: parseFloat(monto),
        metodo,
        comprobante_url: comprobante_url || null
      }])
      .select()
      .single();

    if (errorPago) throw errorPago;

    // Actualizar estado del pedido a 'pagado'
    const { error: errorActualizar } = await supabase
      .from("pedido")
      .update({ estado: 'pagado' })
      .eq("id_pedido", req.params.id);

    if (errorActualizar) {
      // Revertir el pago si no se pudo actualizar el estado
      await supabase.from("pago").delete().eq("id_pago", pago.id_pago);
      throw errorActualizar;
    }

    res.json({ 
      message: "Pago registrado exitosamente y pedido marcado como pagado",
      pago 
    });
  } catch (error) {
    console.error("Error al registrar pago:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;