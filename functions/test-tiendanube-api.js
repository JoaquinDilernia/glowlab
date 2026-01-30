const admin = require("firebase-admin");

// Inicializar Firebase Admin
const serviceAccount = require("./google-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testTiendaNubeAPI() {
  try {
    // Obtener store y access token
    const storeDoc = await db.collection("promonube_stores").doc("6854698").get();
    const store = storeDoc.data();
    
    console.log("🏪 Tienda:", store.storeName);
    console.log("🔑 Token presente:", !!store.accessToken);
    
    const accessToken = store.accessToken;
    const storeId = "6854698";
    
    // Test 1: Obtener scripts existentes
    console.log("\n📋 Test 1: GET /scripts");
    const getResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      method: 'GET',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      }
    });
    
    const getResult = await getResponse.text();
    console.log("Status:", getResponse.status);
    console.log("Response:", getResult);
    
    // Test 2: Intentar crear script con diferentes formatos
    console.log("\n📝 Test 2: POST /scripts (formato básico)");
    const postResponse1 = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      },
      body: JSON.stringify({
        src: "https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=wheel_1763735834663",
        event: "onload",
        where: "store"
      })
    });
    
    const postResult1 = await postResponse1.text();
    console.log("Status:", postResponse1.status);
    console.log("Response:", postResult1);
    
    // Test 3: Probar con el endpoint /webcheckout/scripts (alternativo)
    console.log("\n📝 Test 3: POST /webcheckout/scripts");
    const postResponse2 = await fetch(`https://api.tiendanube.com/v1/${storeId}/webcheckout/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      },
      body: JSON.stringify({
        src: "https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=wheel_1763735834663",
        event: "onload",
        where: "checkout_dom_ready"
      })
    });
    
    const postResult2 = await postResponse2.text();
    console.log("Status:", postResponse2.status);
    console.log("Response:", postResult2);
    
    // Test 4: Consultar información de la app
    console.log("\n📱 Test 4: GET /apps (verificar permisos)");
    const appsResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/apps`, {
      method: 'GET',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      }
    });
    
    const appsResult = await appsResponse.text();
    console.log("Status:", appsResponse.status);
    console.log("Response:", appsResult.substring(0, 1000));
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

testTiendaNubeAPI();
