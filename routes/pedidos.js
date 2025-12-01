// routes/pedidos.js - BACKEND CORREGIDO
import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// =============================================
// OBTENER TODOS LOS PEDIDOS CON DETALLES Y PAGOS
// =============================================
// GET PEDIDOS (Se mantiene igual)
router.get("/", async (req, res) => {
  try {
    const { data: pedidos, error } = await supabase
      .from("pedido")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) throw error;

    // Traer detalles y pagos
    const pedidosCompletos = await Promise.all(
      pedidos.map(async (pedido) => {
        const { data: detalles } = await supabase.from("detalle_pedido").select("*").eq("id_pedido", pedido.id_pedido);
        const { data: pagos } = await supabase.from("pago").select("*").eq("id_pedido", pedido.id_pedido);
        return { ...pedido, detalles: detalles || [], pagos: pagos || [] };
      })
    );

    res.json({ success: true, data: pedidosCompletos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST CREAR PEDIDO (MODIFICADO PARA DIAGNÓSTICO)
router.post("/", async (req, res) => {
  const { id_cliente, detalles, es_venta_directa, pago, observaciones } = req.body;

  console.log("📍 [POST] Iniciando creación de pedido...");
  console.log("📦 Datos recibidos:", JSON.stringify({ id_cliente, total_detalles: detalles?.length }));

  try {
    if (!detalles || detalles.length === 0) throw new Error("Sin detalles");

    // 1. VALIDACIÓN DE PRODUCTOS
    for (const d of detalles) {
      const idBuscado = parseInt(d.id_producto);
      console.log(`🔍 Buscando ID: ${idBuscado} (Tipo: ${typeof idBuscado})`);

      // Intentamos buscar el producto específico
      const { data: producto, error } = await supabase
        .from("producto")
        .select("id_producto, nombre, cantidad")
        .eq("id_producto", idBuscado)
        .maybeSingle();

      if (error) {
        console.error("❌ Error de Supabase:", error);
        return res.status(500).json({ success: false, message: "Error DB", error: error.message });
      }

      // === BLOQUE DE DIAGNÓSTICO ===
      if (!producto) {
        console.error(`❌ NO ENCONTRADO: El ID ${idBuscado} no existe para este Backend.`);
        
        // Vamos a ver qué IDs SÍ existen para probar si es la misma base de datos
        const { data: muestra } = await supabase
          .from("producto")
          .select("id_producto, nombre")
          .limit(5);
        
        console.log("👀 Muestra de productos que SÍ veo en esta DB:", muestra);
        
        return res.status(404).json({ 
          success: false, 
          // Enviamos la prueba al frontend
          message: `Producto ${idBuscado} no encontrado. El servidor ve estos IDs: ${muestra.map(m=>m.id_producto).join(', ')}...` 
        });
      }
      // ==============================

      console.log(`✅ Producto encontrado: ${producto.nombre}`);
    }

    // 2. CREAR PEDIDO SI TODO ESTÁ BIEN
    const estado = es_venta_directa ? 'pagado' : 'pendiente';
    const { data: nuevoPedido, error: errorPedido } = await supabase
      .from("pedido")
      .insert([{ id_cliente, observaciones, estado }])
      .select()
      .single();

    if (errorPedido) throw errorPedido;

    // Insertar detalles
    const detallesFormat = detalles.map(d => ({
      id_pedido: nuevoPedido.id_pedido,
      id_producto: d.id_producto,
      cantidad: 1,
      precio_unitario: d.precio_unitario
    }));

    await supabase.from("detalle_pedido").insert(detallesFormat);

    // Insertar Pago
    if (es_venta_directa && pago) {
      await supabase.from("pago").insert([{
        id_pedido: nuevoPedido.id_pedido,
        monto: pago.monto,
        metodo: pago.metodo
      }]);
    }

    res.json({ success: true, message: "Pedido creado", data: nuevoPedido });

  } catch (error) {
    console.error("🔥 Error General:", error);
    res.status(500).json({ success: false, message: error.message });
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

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ Error al obtener detalles:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// =============================================
// ACTUALIZAR PEDIDO (ESTADO)
// =============================================
router.put("/:id", async (req, res) => {
  const { estado } = req.body;

  try {
    if (!estado) {
      return res.status(400).json({ 
        success: false,
        message: "El campo estado es requerido" 
      });
    }

    const estadosValidos = ['pendiente', 'pagado', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        success: false,
        message: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}` 
      });
    }

    const { data, error } = await supabase
      .from("pedido")
      .update({ estado })
      .eq("id_pedido", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      message: "Estado actualizado exitosamente", 
      data 
    });
  } catch (error) {
    console.error("❌ Error al actualizar pedido:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
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
        success: false,
        message: "No se puede eliminar un pedido pagado o entregado" 
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
      success: true,
      message: "🗑️ Pedido eliminado exitosamente. Productos disponibles nuevamente." 
    });
  } catch (error) {
    console.error("❌ Error al eliminar pedido:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
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
        success: false,
        message: "Faltan datos requeridos: monto y metodo son obligatorios" 
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
        success: false,
        message: `No se puede registrar pago. El pedido está en estado: ${pedido.estado}` 
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
      success: true,
      message: "💰 Pago registrado exitosamente y pedido marcado como pagado",
      data: pago 
    });
  } catch (error) {
    console.error("❌ Error al registrar pago:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

export default router;