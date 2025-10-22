import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener todos los productos con su categoría y estado de venta
router.get("/", async (req, res) => {
  try {
    const { data: productos, error } = await supabase
      .from("producto")
      .select(`
        *,
        categoria:id_categoria (
          id_categoria,
          nombre,
          descripcion
        )
      `)
      .order("fecha_creacion", { ascending: false });

    if (error) throw error;

    // Para cada producto, verificar si ha sido vendido
    const productosConEstado = await Promise.all(
      productos.map(async (producto) => {
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

    res.json(productosConEstado);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener producto por id con estado de venta
router.get("/:id", async (req, res) => {
  try {
    const { data: producto, error } = await supabase
      .from("producto")
      .select(`
        *,
        categoria:id_categoria (
          id_categoria,
          nombre,
          descripcion
        )
      `)
      .eq("id_producto", req.params.id)
      .single();

    if (error) throw error;

    // Verificar si ha sido vendido
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", producto.id_producto);

    res.json({
      ...producto,
      vendido: vendido > 0,
      disponible: vendido === 0
    });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de productos
router.get("/stats/resumen", async (req, res) => {
  try {
    // Total de productos
    const { count: total } = await supabase
      .from("producto")
      .select("*", { count: "exact", head: true });

    // Productos vendidos
    const { data: vendidos } = await supabase
      .from("detalle_pedido")
      .select("id_producto");

    const totalVendidos = new Set(vendidos?.map(d => d.id_producto)).size;
    const disponibles = total - totalVendidos;

    // Productos por categoría
    const { data: categorias } = await supabase
      .from("producto")
      .select(`
        id_categoria,
        categoria:id_categoria (
          nombre
        )
      `);

    const porCategoria = {};
    categorias?.forEach(p => {
      const catNombre = p.categoria?.nombre || 'Sin categoría';
      porCategoria[catNombre] = (porCategoria[catNombre] || 0) + 1;
    });

    res.json({
      total: total || 0,
      vendidos: totalVendidos,
      disponibles: disponibles,
      porCategoria: porCategoria
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: error.message });
  }
});

// Crear producto único
router.post("/", async (req, res) => {
  try {
    const { nombre, descripcion, precio, id_categoria, imagen_url } = req.body;

    // Validar que no exista un producto idéntico
    const { data: existente } = await supabase
      .from("producto")
      .select("id_producto")
      .eq("nombre", nombre)
      .eq("precio", precio)
      .maybeSingle();

    if (existente) {
      return res.status(400).json({ 
        error: "Ya existe un producto con el mismo nombre y precio" 
      });
    }

    const { data, error } = await supabase
      .from("producto")
      .insert([{ 
        nombre, 
        descripcion, 
        precio, 
        id_categoria, 
        imagen_url 
      }])
      .select(`
        *,
        categoria:id_categoria (
          id_categoria,
          nombre,
          descripcion
        )
      `)
      .single();

    if (error) throw error;

    res.json({
      ...data,
      vendido: false,
      disponible: true
    });
  } catch (error) {
    console.error("Error al crear producto:", error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar producto
router.put("/:id", async (req, res) => {
  try {
    const { nombre, descripcion, precio, id_categoria, imagen_url } = req.body;

    // Verificar si el producto ha sido vendido
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", req.params.id);

    if (vendido > 0) {
      return res.status(400).json({ 
        error: "No se puede editar un producto que ya ha sido vendido" 
      });
    }

    const { data, error } = await supabase
      .from("producto")
      .update({ nombre, descripcion, precio, id_categoria, imagen_url })
      .eq("id_producto", req.params.id)
      .select(`
        *,
        categoria:id_categoria (
          id_categoria,
          nombre,
          descripcion
        )
      `)
      .single();

    if (error) throw error;

    res.json({
      ...data,
      vendido: false,
      disponible: true
    });
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar producto
router.delete("/:id", async (req, res) => {
  try {
    // Verificar si el producto ha sido vendido
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", req.params.id);

    if (vendido > 0) {
      return res.status(400).json({ 
        error: "No se puede eliminar un producto que ya ha sido vendido" 
      });
    }

    const { error } = await supabase
      .from("producto")
      .delete()
      .eq("id_producto", req.params.id);

    if (error) throw error;

    res.json({ message: "Producto eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;