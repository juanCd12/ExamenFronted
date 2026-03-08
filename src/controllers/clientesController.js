const { getPool } = require("../database/connection")
const { handleError } = require("../utils/errorHandler")

// Obtener todos los clientes o uno por ID
const getClientes = async (req, res) => {
  try {
    const { id } = req.params
    const pool = getPool()
    const connection = await pool.getConnection()

    if (id) {
      // Obtener cliente con resumen de pedidos
      const [clienteRows] = await connection.query("SELECT * FROM clientes WHERE id_cliente = ?", [id])
      
      if (clienteRows.length > 0) {
        const cliente = clienteRows[0]
        
        // Obtener resumen de pedidos
        const [pedidosSummary] = await connection.query(`
          SELECT 
            COUNT(*) as total_pedidos,
            COALESCE(SUM(
              (SELECT SUM(dp.precio * dp.cantidad) 
               FROM detalle_pedido dp 
               WHERE dp.id_pedido = p.id) + p.aumento - p.descuento
            ), 0) as total_gastado
          FROM pedido p 
          WHERE p.id_cliente = ?
        `, [id])
        
        cliente.resumen_pedidos = pedidosSummary[0]
        
        connection.release()
        res.json(cliente)
      } else {
        connection.release()
        res.status(404).json({ message: "Cliente no encontrado" })
      }
    } else {
      // Obtener todos los clientes con resumen de pedidos
      const [rows] = await connection.query(`
        SELECT 
          c.*,
          COALESCE(p_summary.total_pedidos, 0) as total_pedidos,
          COALESCE(p_summary.total_gastado, 0) as total_gastado
        FROM clientes c
        LEFT JOIN (
          SELECT 
            p.id_cliente,
            COUNT(*) as total_pedidos,
            SUM(
              (SELECT SUM(dp.precio * dp.cantidad) 
               FROM detalle_pedido dp 
               WHERE dp.id_pedido = p.id) + p.aumento - p.descuento
            ) as total_gastado
          FROM pedido p
          GROUP BY p.id_cliente
        ) p_summary ON c.id_cliente = p_summary.id_cliente
        ORDER BY c.id_cliente DESC
      `)
      connection.release()
      res.json(rows)
    }
  } catch (error) {
    handleError(res, error, "Error al obtener clientes")
  }
}

// Crear cliente
const createCliente = async (req, res) => {
  try {
    const { nombre, apellido, email, celular, direccion, direccion2, descripcion } = req.body

    if (!nombre || !apellido || !email || !celular || !direccion) {
      return res.status(400).json({ message: "Nombre, apellido, email, celular y dirección son requeridos" })
    }

    const pool = getPool()
    const connection = await pool.getConnection()
    try {
      const [result] = await connection.query(
        "INSERT INTO clientes (nombre, apellido, email, celular, direccion, direccion2, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nombre, apellido, email, celular, direccion, direccion2 || "", descripcion || ""],
      )

      res.status(201).json({
        message: "Cliente creado con éxito",
        id: result.insertId,
      })
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        res.status(409).json({ message: "El email ya está registrado" })
      } else {
        throw err
      }
    } finally {
      connection.release()
    }
  } catch (error) {
    handleError(res, error, "Error al crear cliente")
  }
}

// Actualizar cliente
const updateCliente = async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, apellido, email, celular, direccion, direccion2, descripcion } = req.body

    const pool = getPool()
    const connection = await pool.getConnection()
    const [result] = await connection.query(
      "UPDATE clientes SET nombre = ?, apellido = ?, email = ?, celular = ?, direccion = ?, direccion2 = ?, descripcion = ?, updated_at = NOW() WHERE id_cliente = ?",
      [nombre, apellido, email, celular, direccion, direccion2, descripcion, id],
    )
    connection.release()

    if (result.affectedRows > 0) {
      res.json({ message: "Cliente actualizado con éxito" })
    } else {
      res.status(404).json({ message: "Cliente no encontrado" })
    }
  } catch (error) {
    handleError(res, error, "Error al actualizar cliente")
  }
}

// Eliminar cliente
const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params

    const pool = getPool()
    const connection = await pool.getConnection()
    const [result] = await connection.query("DELETE FROM clientes WHERE id_cliente = ?", [id])
    connection.release()

    if (result.affectedRows > 0) {
      res.json({ message: "Cliente eliminado con éxito" })
    } else {
      res.status(404).json({ message: "Cliente no encontrado" })
    }
  } catch (error) {
    handleError(res, error, "Error al eliminar cliente")
  }
}

module.exports = {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
}
