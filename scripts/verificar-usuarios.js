// backend/scripts/verificar-usuarios.js
import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function verificarUsuarios() {
  console.log("🔍 Verificando usuarios en la base de datos...\n");

  // Obtener todos los usuarios
  const { data: usuarios, error } = await supabase
    .from("usuario")
    .select("id, email, contrasena, nombre");

  if (error) {
    console.error("❌ Error al obtener usuarios:", error);
    return;
  }

  if (!usuarios || usuarios.length === 0) {
    console.log("⚠️ No hay usuarios en la base de datos");
    return;
  }

  console.log(`✅ Se encontraron ${usuarios.length} usuario(s):\n`);

  usuarios.forEach((usuario, index) => {
    const esEncriptada = usuario.contrasena.startsWith("$2a$") || 
                         usuario.contrasena.startsWith("$2b$");
    
    console.log(`${index + 1}. Usuario: ${usuario.nombre}`);
    console.log(`   Email: ${usuario.email}`);
    console.log(`   Contraseña ${esEncriptada ? "✅ ENCRIPTADA" : "❌ TEXTO PLANO"}`);
    console.log(`   Primer caracter: ${usuario.contrasena.substring(0, 10)}...`);
    console.log("");
  });

  // Probar contraseña de ejemplo
  console.log("🧪 Probando comparación de contraseña:\n");
  
  const usuarioPrueba = usuarios[0];
  const contrasenasPrueba = ["123", "123456", "admin", "admin123"];

  for (const pwd of contrasenasPrueba) {
    try {
      const coincide = await bcrypt.compare(pwd, usuarioPrueba.contrasena);
      if (coincide) {
        console.log(`✅ La contraseña "${pwd}" coincide con ${usuarioPrueba.email}`);
      }
    } catch (error) {
      // Es texto plano, no encriptado
      if (usuarioPrueba.contrasena === pwd) {
        console.log(`⚠️ La contraseña "${pwd}" coincide (TEXTO PLANO) con ${usuarioPrueba.email}`);
      }
    }
  }
}

verificarUsuarios()
  .then(() => {
    console.log("\n✅ Verificación completada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });