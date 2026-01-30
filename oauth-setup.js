// Script de configuración OAuth para PromoNube
// ESTE ARCHIVO ES TEMPORAL - Solo para obtener el primer token

const CLIENT_ID = '23137';
const CLIENT_SECRET = '4aa553dd36bcad0848bfbe73f2b7894299b38226beab859d';
const REDIRECT_URI = 'http://localhost:5173/';

console.log('\n🔐 SETUP OAUTH - PROMONUBE\n');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📋 PASO 1: Configurar Redirect URL en TiendaNube');
console.log('   Ve a: https://partners.tiendanube.com/applications/23137');
console.log('   Redirect URL: http://localhost:5173/\n');

console.log('📋 PASO 2: Abre esta URL en tu navegador:\n');

const authUrl = `https://www.tiendanube.com/apps/authorize/token?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log(authUrl);
console.log('\n');

console.log('📋 PASO 3: Autoriza la app en tu tienda de prueba');
console.log('   Te va a redirigir a: http://localhost:5173/?code=XXXXXX\n');

console.log('📋 PASO 4: Copia el CODE de la URL y ejecuta:\n');
console.log('   node get-token.js TU_CODE_AQUI\n');

console.log('═══════════════════════════════════════════════════════════\n');
