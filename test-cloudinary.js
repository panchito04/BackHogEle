import cloudinary from './cloudinary.js';

console.log('Cloudinary configurado:');
console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Configurado' : '❌ Falta');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Configurado' : '❌ Falta');

// Probar conexión
cloudinary.api.ping()
  .then(result => console.log('✅ Cloudinary conectado:', result))
  .catch(error => console.error('❌ Error:', error));