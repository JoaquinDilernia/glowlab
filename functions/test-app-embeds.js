const admin = require("firebase-admin");

// Inicializar Firebase Admin
const serviceAccount = require("./google-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testAppEmbeds() {
  try {
    // Obtener store y access token
    const storeDoc = await db.collection("promonube_stores").doc("6854698").get();
    const store = storeDoc.data();
    
    console.log("🏪 Tienda:", store.storeName);
    
    const accessToken = store.accessToken;
    const storeId = "6854698";
    
    // Según la documentación de TiendaNube, los App Embeds se registran con:
    // POST /v1/{store_id}/scripts con campos específicos
    
    // Test con TODOS los campos posibles
    console.log("\n📝 Test: POST /scripts con todos los campos");
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      },
      body: JSON.stringify({
        src: "https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=wheel_1763735834663",
        event: "onfulfill",  // Probar con diferentes eventos
        where: {
          pages: ["all"]  // O como objeto
        }
      })
    });
    
    const result1 = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", result1);
    
    // Test 2: Intentar como lo hace Shopify
    console.log("\n📝 Test 2: Formato Shopify-like");
    const response2 = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      },
      body: JSON.stringify({
        script_tag: {
          src: "https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=wheel_1763735834663",
          event: "onload",
          display_scope: "all"
        }
      })
    });
    
    const result2 = await response2.text();
    console.log("Status:", response2.status);
    console.log("Response:", result2);
    
    // Test 3: Verificar endpoint de store info
    console.log("\n🔍 Test 3: GET /store");
    const storeInfo = await fetch(`https://api.tiendanube.com/v1/store/${storeId}`, {
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'PromoNube (contacto@promonube.com)'
      }
    });
    
    const storeInfoResult = await storeInfo.text();
    console.log("Status:", storeInfo.status);
    console.log("Response:", storeInfoResult.substring(0, 500));
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

testAppEmbeds();
