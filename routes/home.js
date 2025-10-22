import express from "express";
import { supabase } from "../server.js";

const router = express.Router();

// Obtener estadísticas generales del dashboard
router.get("/", async (req, res) => {
  try {
    console.log("📊 Iniciando carga de estadísticas...");

    // Total de clientes
    const { count: totalClientes, error: errorClientes } = await supabase
      .from("cliente")
      .select("*", { count: "exact", head: true });

    if (errorClientes) {
      console.error("❌ Error al contar clientes:", errorClientes);
      throw errorClientes;
    }

    // Total de productos únicos
    const { count: totalProductos, error: errorProductos } = await supabase
      .from("producto")
      .select("*", { count: "exact", head: true });

    if (errorProductos) {
      console.error("❌ Error al contar productos:", errorProductos);
      throw errorProductos;
    }

    // Total de pedidos
    const { count: totalPedidos, error: errorPedidos } = await supabase
      .from("pedido")
      .select("*", { count: "exact", head: true });

    if (errorPedidos) {
      console.error("❌ Error al contar pedidos:", errorPedidos);
      throw errorPedidos;
    }

    // Ingresos totales (suma de todos los pagos)
    const { data: pagos, error: errorPagos } = await supabase
      .from("pago")
      .select("monto");
    
    if (errorPagos) {
      console.error("❌ Error al obtener pagos:", errorPagos);
      throw errorPagos;
    }

    const ingresosTotales = pagos?.reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0) || 0;

    // Pedidos por estado
    const { data: pedidosPorEstado, error: errorEstados } = await supabase
      .from("pedido")
      .select("estado");

    if (errorEstados) {
      console.error("❌ Error al obtener estados:", errorEstados);
      throw errorEstados;
    }

    const estadisticasEstados = {
      pendiente: pedidosPorEstado?.filter(p => p.estado === 'pendiente').length || 0,
      pagado: pedidosPorEstado?.filter(p => p.estado === 'pagado').length || 0,
      entregado: pedidosPorEstado?.filter(p => p.estado === 'entregado').length || 0,
      cancelado: pedidosPorEstado?.filter(p => p.estado === 'cancelado').length || 0,
    };

    // Top 5 productos únicos más vendidos (OPTIMIZADO)
    const { data: detallesPedido, error: errorDetalles } = await supabase
      .from("detalle_pedido")
      .select(`
        id_producto,
        producto:id_producto (
          nombre
        ),
        pedido:id_pedido (
          fecha
        )
      `)
      .order("id_detalle", { ascending: false })
      .limit(50);

    if (errorDetalles) {
      console.error("❌ Error al obtener detalles de pedido:", errorDetalles);
    }

    // Agrupar productos vendidos (cada producto único se cuenta una sola vez)
    const productosVendidos = {};
    if (detallesPedido && detallesPedido.length > 0) {
      detallesPedido.forEach(detalle => {
        if (detalle.producto && !productosVendidos[detalle.id_producto]) {
          productosVendidos[detalle.id_producto] = {
            nombre: detalle.producto.nombre,
            cantidad: 1,
            fecha: detalle.pedido?.fecha || new Date()
          };
        }
      });
    }

    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 5)
      .map(({ nombre, cantidad }) => ({ nombre, cantidad }));

    // Últimos 5 pedidos recientes (OPTIMIZADO)
    const { data: pedidosRecientes, error: errorPedidosRecientes } = await supabase
      .from("pedido")
      .select(`
        id_pedido,
        fecha,
        estado,
        cliente:id_cliente (
          nombre
        )
      `)
      .order("fecha", { ascending: false })
      .limit(5);

    if (errorPedidosRecientes) {
      console.error("❌ Error al obtener pedidos recientes:", errorPedidosRecientes);
    }

    // Calcular el total de cada pedido
    const pedidosConTotal = [];
    if (pedidosRecientes && pedidosRecientes.length > 0) {
      for (const pedido of pedidosRecientes) {
        const { data: detalles } = await supabase
          .from("detalle_pedido")
          .select("subtotal")
          .eq("id_pedido", pedido.id_pedido);

        const total = detalles?.reduce((sum, d) => sum + parseFloat(d.subtotal || 0), 0) || 0;

        pedidosConTotal.push({
          ...pedido,
          total: total
        });
      }
    }

    console.log("✅ Estadísticas cargadas exitosamente");

    // Respuesta exitosa
    res.json({
      totales: {
        clientes: totalClientes || 0,
        productos: totalProductos || 0,
        pedidos: totalPedidos || 0,
        ingresos: ingresosTotales
      },
      pedidosPorEstado: estadisticasEstados,
      actividadReciente: [],
      productosBajoStock: [],
      ventasPorMes: [],
      topProductos: topProductos,
      pedidosRecientes: pedidosConTotal || []
    });

  } catch (error) {
    console.error("❌ Error general en resumen:", error);
    res.status(500).json({ 
      error: "Error al obtener resumen",
      message: error.message || "Error desconocido",
      details: error.toString()
    });
  }
});

export default router;