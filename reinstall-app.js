// URL para reinstalar PromoNube en TiendaNube
const CLIENT_ID = "23137";
const REDIRECT_URI = "http://localhost:5173/callback";

const authUrl = `https://www.tiendanube.com/apps/${CLIENT_ID}/authorize?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n🔐 REINSTALAR PROMONUBE EN TIENDANUBE\n');
console.log('Para que la ruleta funcione sin código, necesitás renovar la instalación de la app.\n');
console.log('📋 PASOS:\n');
console.log('1. Abrí esta URL en tu navegador:');
console.log(`   ${authUrl}\n`);
console.log('2. Hacé clic en "Autorizar aplicación"');
console.log('3. Te redirigirá a localhost:5173/callback');
console.log('4. ¡Listo! La ruleta se instalará automáticamente\n');
console.log('💡 Después de esto, al activar/desactivar la ruleta se aplicará automáticamente sin tocar código.\n');
