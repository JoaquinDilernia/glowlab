const admin = require("firebase-admin");

// Inicializar Firebase Admin
const serviceAccount = require("./google-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkWheelStatus() {
  try {
    console.log("🔍 Verificando estado de ruletas activas...\n");

    // Obtener todas las ruletas activas
    const wheelsSnapshot = await db.collection("promonube_spin_wheels")
      .where("active", "==", true)
      .get();

    if (wheelsSnapshot.empty) {
      console.log("❌ No hay ruletas activas");
      
      // Buscar ruletas con enabled=true
      const enabledWheels = await db.collection("promonube_spin_wheels")
        .where("enabled", "==", true)
        .get();
      
      if (!enabledWheels.empty) {
        console.log("⚠️ Hay ruletas con enabled=true pero active=false");
        console.log("Migrando...");
        
        for (const doc of enabledWheels.docs) {
          await doc.ref.update({ active: true });
          console.log(`✅ Ruleta ${doc.id} migrada a active=true`);
        }
      }
      
      return;
    }

    console.log(`✅ ${wheelsSnapshot.size} ruleta(s) activa(s) encontrada(s)\n`);

    for (const doc of wheelsSnapshot.docs) {
      const wheel = doc.data();
      const wheelId = doc.id;

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🎡 Ruleta: ${wheel.name || 'Sin nombre'}`);
      console.log(`   ID: ${wheelId}`);
      console.log(`   Store ID: ${wheel.storeId}`);
      console.log(`   Activa: ${wheel.active || wheel.enabled}`);
      console.log(`   Script Tag ID: ${wheel.scriptTagId || 'NO INSTALADO ❌'}`);
      console.log(`   Script URL: ${wheel.scriptUrl || 'No configurado'}`);

      // Verificar la tienda
      const storeDoc = await db.collection("promonube_stores").doc(wheel.storeId).get();
      
      if (!storeDoc.exists) {
        console.log(`   ❌ PROBLEMA: Store ${wheel.storeId} no encontrada`);
        continue;
      }

      const store = storeDoc.data();
      console.log(`   ✅ Tienda: ${store.storeName}`);
      console.log(`   Access Token: ${store.accessToken ? '✅ Presente' : '❌ Faltante'}`);

      // Si no tiene scriptTagId, intentar registrarlo ahora
      if (!wheel.scriptTagId && store.accessToken) {
        console.log(`\n   🔧 Intentando registrar script en TiendaNube...`);
        
        const scriptUrl = `https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=${wheelId}`;
        
        const response = await fetch(`https://api.tiendanube.com/v1/${wheel.storeId}/scripts`, {
          method: 'POST',
          headers: {
            'Authentication': `bearer ${store.accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'PromoNube (contacto@promonube.com)'
          },
          body: JSON.stringify({
            src: scriptUrl,
            event: 'onload',
            where: 'store'
          })
        });

        if (response.ok) {
          const scriptTag = await response.json();
          await doc.ref.update({
            scriptTagId: scriptTag.id,
            scriptUrl: scriptUrl
          });
          console.log(`   ✅ Script registrado con ID: ${scriptTag.id}`);
        } else {
          const error = await response.text();
          console.log(`   ❌ Error registrando script: ${error}`);
        }
      }

      // Verificar scripts instalados en TiendaNube
      if (store.accessToken) {
        console.log(`\n   📋 Verificando scripts en TiendaNube...`);
        
        const scriptsResponse = await fetch(`https://api.tiendanube.com/v1/${wheel.storeId}/scripts`, {
          headers: {
            'Authentication': `bearer ${store.accessToken}`,
            'User-Agent': 'PromoNube (contacto@promonube.com)'
          }
        });

        if (scriptsResponse.ok) {
          const scripts = await scriptsResponse.json();
          console.log(`   📦 Respuesta de TiendaNube:`, JSON.stringify(scripts, null, 2).substring(0, 500));
          
          if (Array.isArray(scripts)) {
            const promoNubeScripts = scripts.filter(s => s.src && s.src.includes('apipromonube'));
            
            if (promoNubeScripts.length > 0) {
              console.log(`   ✅ ${promoNubeScripts.length} script(s) de PromoNube encontrado(s):`);
              promoNubeScripts.forEach(s => {
                console.log(`      - ID: ${s.id}`);
                console.log(`        URL: ${s.src}`);
              });
            } else {
              console.log(`   ⚠️ No hay scripts de PromoNube instalados en TiendaNube`);
            }
          } else {
            console.log(`   ⚠️ Respuesta inesperada (no es un array)`);
          }
        } else {
          const errorText = await scriptsResponse.text();
          console.log(`   ❌ Error obteniendo scripts: ${errorText}`);
        }
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }

    console.log("\n🎯 Para ver la ruleta en tu tienda:");
    console.log("   1. Abrí tu tienda en modo incógnito");
    console.log("   2. Esperá 3-5 segundos");
    console.log("   3. El popup debería aparecer automáticamente");
    console.log("\n💡 Si no aparece, revisá la consola del navegador (F12)");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

checkWheelStatus();
