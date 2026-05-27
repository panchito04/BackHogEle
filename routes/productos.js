import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../cloudinary.js";
import { supabase } from "../server.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ GET TODOS LOS PRODUCTOS - Formato estandarizado (unido con usuario) - OPTIMIZADO (Sin N+1 consultas)
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
        ),
        caja:id_caja (
          id_caja,
          codigo,
          descripcion,
          fecha_llegada
        ),
        usuario:id_usuario (
          id_usuario,
          nombre
        )
      `)
      .order("fecha_creacion", { ascending: false });
    
    if (error) throw error;
    
    // Obtener todos los detalles de pedido en una única consulta para agrupar en memoria
    const { data: todosVendidos, error: errorVendidos } = await supabase
      .from("detalle_pedido")
      .select("id_producto");

    if (errorVendidos) throw errorVendidos;

    // Agrupar cantidades vendidas por id_producto en memoria (Complejidad O(N))
    const ventasPorProducto = {};
    todosVendidos?.forEach(item => {
      if (item.id_producto) {
        ventasPorProducto[item.id_producto] = (ventasPorProducto[item.id_producto] || 0) + 1;
      }
    });
    
    const productosConEstado = productos.map((producto) => {
      const vendido = ventasPorProducto[producto.id_producto] || 0;
      return {
        ...producto,
        vendido: vendido > 0,
        disponible: (producto.cantidad - vendido) > 0,
        cantidad_disponible: producto.cantidad - vendido,
        cantidad_vendida: vendido
      };
    });
    
    // ✅ CAMBIO: Devolver con formato estándar
    res.json({
      success: true,
      data: productosConEstado,
      message: 'Productos obtenidos correctamente'
    });
  } catch (error) {
    console.error("❌ Error al obtener productos:", error);
    res.status(500).json({ 
      success: false,
      message: error.message,
      data: []
    });
  }
});

// ✅ GET PRODUCTO POR ID (unido con usuario)
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
        ),
        caja:id_caja (
          id_caja,
          codigo,
          descripcion,
          fecha_llegada
        ),
        usuario:id_usuario (
          id_usuario,
          nombre
        )
      `)
      .eq("id_producto", req.params.id)
      .single();
    
    if (error) throw error;
    
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", producto.id_producto);
    
    res.json({
      success: true,
      data: {
        ...producto,
        vendido: vendido > 0,
        disponible: (producto.cantidad - vendido) > 0,
        cantidad_disponible: producto.cantidad - vendido,
        cantidad_vendida: vendido
      }
    });
  } catch (error) {
    console.error("❌ Error al obtener producto:", error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// ✅ GET ESTADÍSTICAS
router.get("/stats/resumen", async (req, res) => {
  try {
    const { data: productosData } = await supabase
      .from("producto")
      .select("cantidad");
    
    const total = productosData?.reduce((sum, p) => sum + (p.cantidad || 0), 0) || 0;
    
    const { data: vendidos } = await supabase
      .from("detalle_pedido")
      .select("id_producto");
    
    const totalVendidos = vendidos?.length || 0;
    const disponibles = total - totalVendidos;
    
    const { data: categorias } = await supabase
      .from("producto")
      .select(`
        id_categoria,
        cantidad,
        categoria:id_categoria (
          nombre
        )
      `);
    
    const porCategoria = {};
    categorias?.forEach(p => {
      const catNombre = p.categoria?.nombre || 'Sin categoría';
      porCategoria[catNombre] = (porCategoria[catNombre] || 0) + (p.cantidad || 0);
    });
    
    res.json({
      success: true,
      data: {
        total: total,
        vendidos: totalVendidos,
        disponibles: disponibles,
        porCategoria: porCategoria
      }
    });
  } catch (error) {
    console.error("❌ Error al obtener estadísticas:", error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// ✅ POST CREAR PRODUCTO
router.post("/", upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, descripcion, precio, id_categoria, id_caja, cantidad, id_usuario } = req.body;
    let imagen_url = req.body.imagen_url || null;
    
    // Validar cantidad
    const cantidadFinal = cantidad ? parseInt(cantidad) : 1;
    if (cantidadFinal < 1) {
      return res.status(400).json({ 
        success: false,
        message: "La cantidad debe ser mayor a 0" 
      });
    }
    
    if (req.file) {
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "productos",
              resource_type: "image",
              format: "jpg",
              transformation: [
                { quality: "auto:eco" },
                { fetch_format: "jpg" }
              ]
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };
      
      const result = await streamUpload(req.file.buffer);
      imagen_url = result.secure_url;
    }
    
    const { data, error } = await supabase
      .from("producto")
      .insert([{ 
        nombre, 
        descripcion, 
        precio, 
        id_categoria: id_categoria || null,
        id_caja: id_caja || null,
        imagen_url,
        cantidad: cantidadFinal,
        id_usuario: id_usuario || null
      }])
      .select(`
        *,
        categoria:id_categoria (
          id_categoria,
          nombre,
          descripcion
        ),
        caja:id_caja (
          id_caja,
          codigo,
          descripcion
        ),
        usuario:id_usuario (
          id_usuario,
          nombre
        )
      `)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: '✨ Producto creado exitosamente',
      data: {
        ...data,
        vendido: false,
        disponible: true,
        cantidad_disponible: data.cantidad,
        cantidad_vendida: 0
      }
    });
  } catch (error) {
    console.error("❌ Error al crear producto:", error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// ✅ PUT ACTUALIZAR PRODUCTO
router.put("/:id", upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, descripcion, precio, id_categoria, id_caja, cantidad } = req.body;
    
    // Verificar cantidad vendida
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", req.params.id);
    
    // Validar que la nueva cantidad no sea menor a lo vendido
    const cantidadFinal = cantidad ? parseInt(cantidad) : 1;
    if (cantidadFinal < vendido) {
      return res.status(400).json({ 
        success: false,
        message: `No puedes reducir la cantidad a menos de ${vendido} (ya vendidos)` 
      });
    }
    
    let imagen_url = req.body.imagen_url || null;
    
    if (req.file) {
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "productos",
              resource_type: "image",
              format: "jpg",
              transformation: [
                { height: 720, crop: "limit" },
                { quality: "auto" }
              ]
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };
      
      const result = await streamUpload(req.file.buffer);
      imagen_url = result.secure_url;
    }
    
    const { data, error } = await supabase
      .from("producto")
      .update({ 
        nombre, 
        descripcion, 
        precio, 
        id_categoria: id_categoria || null,
        id_caja: id_caja || null,
        imagen_url,
        cantidad: cantidadFinal
      })
      .eq("id_producto", req.params.id)
      .select(`
        *,
        categoria:id_categoria (
          id_categoria,
          nombre,
          descripcion
        ),
        caja:id_caja (
          id_caja,
          codigo,
          descripcion
        )
      `)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: '💾 Producto actualizado exitosamente',
      data: {
        ...data,
        vendido: vendido > 0,
        disponible: (data.cantidad - vendido) > 0,
        cantidad_disponible: data.cantidad - vendido,
        cantidad_vendida: vendido
      }
    });
  } catch (error) {
    console.error("❌ Error al actualizar producto:", error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// ✅ DELETE ELIMINAR PRODUCTO
router.delete("/:id", async (req, res) => {
  try {
    // Verificar si está vendido
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", req.params.id);
    
    if (vendido > 0) {
      return res.status(400).json({ 
        success: false,
        message: "No se puede eliminar un producto que ya ha sido vendido" 
      });
    }
    
    const { error } = await supabase
      .from("producto")
      .delete()
      .eq("id_producto", req.params.id);
    
    if (error) throw error;
    
    res.json({ 
      success: true,
      message: "🗑️ Producto eliminado exitosamente" 
    });
  } catch (error) {
    console.error("❌ Error al eliminar producto:", error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

export default router;