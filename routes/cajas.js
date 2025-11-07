import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// =====================
// OBTENER TODAS LAS CAJAS
// =====================
router.get("/", async (req, res) => {
  try {
    const { data: cajas, error } = await supabase
      .from("caja")
      .select(`
        *,
        productos:producto(count)
      `)
      .order("fecha_llegada", { ascending: false });

    if (error) throw error;

    // Calcular estadísticas por caja
    const cajasConEstadisticas = await Promise.all(
      cajas.map(async (caja) => {
        const { data: productos } = await supabase
          .from("producto")
          .select("id_producto")
          .eq("id_caja", caja.id_caja);

        const totalProductos = productos?.length || 0;

        // Productos vendidos de esta caja
        const { data: vendidos } = await supabase
          .from("detalle_pedido")
          .select("id_producto")
          .in("id_producto", productos?.map(p => p.id_producto) || []);

        const totalVendidos = new Set(vendidos?.map(v => v.id_producto)).size;
        const totalDisponibles = totalProductos - totalVendidos;

        return {
          ...caja,
          total_productos: totalProductos,
          productos_vendidos: totalVendidos,
          productos_disponibles: totalDisponibles
        };
      })
    );

    res.json(cajasConEstadisticas);
  } catch (error) {
    console.error("Error al obtener cajas:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// OBTENER UNA CAJA POR ID
// =====================
router.get("/:id", async (req, res) => {
  try {
    const { data: caja, error } = await supabase
      .from("caja")
      .select(`
        *,
        productos:producto(
          *,
          categoria:id_categoria(*)
        )
      `)
      .eq("id_caja", req.params.id)
      .single();

    if (error) throw error;

    // Verificar estado de cada producto
    const productosConEstado = await Promise.all(
      (caja.productos || []).map(async (producto) => {
        const { count: vendido } = await supabase
          .from("detalle_pedido")
          .select("*", { count: "exact", head: true })
          .eq("id_producto", producto.id_producto);

        return {
          ...producto,
          vendido: vendido > 0,
          disponible: vendido === 0
        };
      })
    );

    res.json({
      ...caja,
      productos: productosConEstado
    });
  } catch (error) {
    console.error("Error al obtener caja:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// CREAR NUEVA CAJA
// =====================
router.post("/", async (req, res) => {
  try {
    const { codigo, descripcion, fecha_llegada, proveedor, costo_total, observaciones } = req.body;

    // Verificar que no exista una caja con el mismo código
    const { data: existente } = await supabase
      .from("caja")
      .select("id_caja")
      .eq("codigo", codigo)
      .maybeSingle();

    if (existente) {
      return res.status(400).json({ error: "Ya existe una caja con este código" });
    }

    const { data, error } = await supabase
      .from("caja")
      .insert([{
        codigo,
        descripcion,
        fecha_llegada,
        proveedor,
        costo_total,
        observaciones
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({
      ...data,
      total_productos: 0,
      productos_vendidos: 0,
      productos_disponibles: 0
    });
  } catch (error) {
    console.error("Error al crear caja:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// ACTUALIZAR CAJA
// =====================
router.put("/:id", async (req, res) => {
  try {
    const { codigo, descripcion, fecha_llegada, proveedor, costo_total, observaciones, estado } = req.body;

    const { data, error } = await supabase
      .from("caja")
      .update({
        codigo,
        descripcion,
        fecha_llegada,
        proveedor,
        costo_total,
        observaciones,
        estado
      })
      .eq("id_caja", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error al actualizar caja:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// ELIMINAR CAJA
// =====================
router.delete("/:id", async (req, res) => {
  try {
    // Verificar que no tenga productos
    const { data: productos } = await supabase
      .from("producto")
      .select("id_producto")
      .eq("id_caja", req.params.id);

    if (productos && productos.length > 0) {
      return res.status(400).json({ 
        error: "No se puede eliminar una caja que tiene productos asignados" 
      });
    }

    const { error } = await supabase
      .from("caja")
      .delete()
      .eq("id_caja", req.params.id);

    if (error) throw error;

    res.json({ message: "Caja eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar caja:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// ESTADÍSTICAS GENERALES DE CAJAS
// =====================
router.get("/stats/resumen", async (req, res) => {
  try {
    const { count: totalCajas } = await supabase
      .from("caja")
      .select("*", { count: "exact", head: true });

    const { count: cajasEnProceso } = await supabase
      .from("caja")
      .select("*", { count: "exact", head: true })
      .eq("estado", "en_proceso");

    const { count: cajasCompletadas } = await supabase
      .from("caja")
      .select("*", { count: "exact", head: true })
      .eq("estado", "completada");

    const { data: productos } = await supabase
      .from("producto")
      .select("id_caja");

    const cajasConProductos = new Set(productos?.map(p => p.id_caja)).size;

    res.json({
      total_cajas: totalCajas || 0,
      cajas_en_proceso: cajasEnProceso || 0,
      cajas_completadas: cajasCompletadas || 0,
      cajas_con_productos: cajasConProductos
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;