import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Verificar configuración al iniciar
console.log('🔧 Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅ OK' : '❌ MISSING',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅ OK' : '❌ MISSING',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ OK' : '❌ MISSING'
});

export default cloudinary;