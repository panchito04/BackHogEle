import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener todas las cajas con conteo de productos
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
    
    // Formatear respuesta con conteo de productos
    const cajasConConteo = cajas.map(caja => ({
      ...caja,
      total_productos: caja.productos[0]?.count || 0
    }));
    
    res.json(cajasConConteo);
  } catch (error) {
    console.error("Error al obtener cajas:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener una caja específica con sus productos
router.get("/:id", async (req, res) => {
  try {
    const { data: caja, error } = await supabase
      .from("caja")
      .select(`
        *,
        productos:producto(
          id_producto,
          nombre,
          precio,
          imagen_url,
          categoria:id_categoria(nombre)
        )
      `)
      .eq("id_caja", req.params.id)
      .single();
    
    if (error) throw error;
    
    // Verificar qué productos están vendidos
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
      productos: productosConEstado,
      total_productos: productosConEstado.length,
      productos_disponibles: productosConEstado.filter(p => p.disponible).length,
      productos_vendidos: productosConEstado.filter(p => p.vendido).length
    });
  } catch (error) {
    console.error("Error al obtener caja:", error);
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva caja
router.post("/", async (req, res) => {
  try {
    const { codigo, descripcion, fecha_llegada, proveedor, costo_total, observaciones } = req.body;
    
    // Verificar que el código no exista
    const { data: existe } = await supabase
      .from("caja")
      .select("id_caja")
      .eq("codigo", codigo)
      .maybeSingle();
    
    if (existe) {
      return res.status(400).json({ error: "Ya existe una caja con ese código" });
    }
    
    const { data, error } = await supabase
      .from("caja")
      .insert([{
        codigo,
        descripcion,
        fecha_llegada,
        proveedor,
        costo_total,
        observaciones,
        estado: 'en_proceso'
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      ...data,
      total_productos: 0
    });
  } catch (error) {
    console.error("Error al crear caja:", error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar caja
router.put("/:id", async (req, res) => {
  try {
    const { codigo, descripcion, fecha_llegada, proveedor, costo_total, observaciones, estado } = req.body;
    
    // Verificar que el código no esté duplicado (excepto la misma caja)
    if (codigo) {
      const { data: existe } = await supabase
        .from("caja")
        .select("id_caja")
        .eq("codigo", codigo)
        .neq("id_caja", req.params.id)
        .maybeSingle();
      
      if (existe) {
        return res.status(400).json({ error: "Ya existe otra caja con ese código" });
      }
    }
    
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

// Eliminar caja (solo si no tiene productos)
router.delete("/:id", async (req, res) => {
  try {
    // Verificar si tiene productos
    const { count: tieneProductos } = await supabase
      .from("producto")
      .select("*", { count: "exact", head: true })
      .eq("id_caja", req.params.id);
    
    if (tieneProductos > 0) {
      return res.status(400).json({ 
        error: "No se puede eliminar una caja que tiene productos asignados. Primero elimina o reasigna los productos." 
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

// Obtener estadísticas de cajas
router.get("/stats/resumen", async (req, res) => {
  try {
    // Total de cajas
    const { count: total } = await supabase
      .from("caja")
      .select("*", { count: "exact", head: true });
    
    // Cajas por estado
    const { data: cajas } = await supabase
      .from("caja")
      .select("estado");
    
    const porEstado = {
      en_proceso: 0,
      completada: 0,
      archivada: 0
    };
    
    cajas?.forEach(c => {
      porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
    });
    
    // Costo total invertido
    const { data: costos } = await supabase
      .from("caja")
      .select("costo_total");
    
    const inversionTotal = costos?.reduce((sum, c) => sum + (parseFloat(c.costo_total) || 0), 0) || 0;
    
    res.json({
      total: total || 0,
      porEstado,
      inversionTotal: inversionTotal.toFixed(2)
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;