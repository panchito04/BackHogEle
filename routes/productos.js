import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../cloudinary.js";
import { supabase } from "../server.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// OBTENER TODOS LOS PRODUCTOS
// =====================
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
        )
      `)
      .order("fecha_creacion", { ascending: false });

    if (error) throw error;

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

// =====================
// OBTENER PRODUCTO POR ID
// =====================
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
      ...producto,
      vendido: vendido > 0,
      disponible: vendido === 0
    });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// ESTADÍSTICAS DE PRODUCTOS
// =====================
router.get("/stats/resumen", async (req, res) => {
  try {
    const { count: total } = await supabase
      .from("producto")
      .select("*", { count: "exact", head: true });

    const { data: vendidos } = await supabase
      .from("detalle_pedido")
      .select("id_producto");

    const totalVendidos = new Set(vendidos?.map(d => d.id_producto)).size;
    const disponibles = total - totalVendidos;

    const { data: categorias } = await supabase
      .from("producto")
      .select(`
        id_categoria,
        categoria:id_categoria (nombre)
      `);

    const porCategoria = {};
    categorias?.forEach(p => {
      const catNombre = p.categoria?.nombre || 'Sin categoría';
      porCategoria[catNombre] = (porCategoria[catNombre] || 0) + 1;
    });

    const { data: cajas } = await supabase
      .from("producto")
      .select(`
        id_caja,
        caja:id_caja (codigo)
      `);

    const porCaja = {};
    cajas?.forEach(p => {
      const cajaCodigo = p.caja?.codigo || 'Sin caja';
      porCaja[cajaCodigo] = (porCaja[cajaCodigo] || 0) + 1;
    });

    res.json({
      total: total || 0,
      vendidos: totalVendidos,
      disponibles: disponibles,
      porCategoria: porCategoria,
      porCaja: porCaja
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// CREAR PRODUCTO
// =====================
router.post("/", upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, descripcion, precio, id_categoria, id_caja } = req.body;
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
                { width: 800, height: 800, crop: "limit" },
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

    const { data: existente } = await supabase
      .from("producto")
      .select("id_producto")
      .eq("nombre", nombre)
      .eq("precio", precio)
      .eq("id_caja", id_caja || null)
      .maybeSingle();

    if (existente) {
      return res.status(400).json({ 
        error: "Ya existe un producto con el mismo nombre y precio en esta caja" 
      });
    }

    const { data, error } = await supabase
      .from("producto")
      .insert([{ 
        nombre, 
        descripcion, 
        precio, 
        id_categoria, 
        id_caja: id_caja || null,
        imagen_url 
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

// =====================
// ACTUALIZAR PRODUCTO
// =====================
router.put("/:id", upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, descripcion, precio, id_categoria, id_caja } = req.body;

    // Verificar si el producto fue vendido
    const { count: vendido } = await supabase
      .from("detalle_pedido")
      .select("*", { count: "exact", head: true })
      .eq("id_producto", req.params.id);

    if (vendido > 0) {
      return res.status(400).json({ 
        error: "No se puede editar un producto que ya ha sido vendido" 
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
        id_categoria, 
        id_caja: id_caja || null,
        imagen_url 
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
      ...data,
      vendido: false,
      disponible: true
    });
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// ELIMINAR PRODUCTO
// =====================
router.delete("/:id", async (req, res) => {
  try {
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