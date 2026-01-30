// Script de diagnóstico para verificar script tags de TiendaNube
const admin = require('firebase-admin');
const serviceAccount = require('./google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSpinWheelScripts() {
  console.log('🔍 Verificando ruletas y script tags...\n');
  
  try {
    // Obtener todas las ruletas activas
    const wheelsSnapshot = await db.collection('promonube_spin_wheels')
      .where('enabled', '==', true)
      .get();
    
    if (wheelsSnapshot.empty) {
      console.log('⚠️ No hay ruletas activas');
      return;
    }
    
    console.log(`✅ Ruletas activas encontradas: ${wheelsSnapshot.size}\n`);
    
    for (const wheelDoc of wheelsSnapshot.docs) {
      const wheelData = wheelDoc.data();
      const wheelId = wheelDoc.id;
      
      console.log(`📊 Ruleta: ${wheelData.name || 'Sin nombre'}`);
      console.log(`   ID: ${wheelId}`);
      console.log(`   Store ID: ${wheelData.storeId}`);
      console.log(`   Activada: ${wheelData.enabled}`);
      console.log(`   Script Tag ID: ${wheelData.scriptTagId || 'NO REGISTRADO'}`);
      
      if (!wheelData.scriptTagId) {
        console.log('   ❌ PROBLEMA: No hay script tag registrado');
      } else {
        console.log('   ✅ Script tag registrado correctamente');
      }
      
      // Verificar si existe la tienda
      const storeSnapshot = await db.collection('promonube_stores')
        .where('storeId', '==', wheelData.storeId)
        .limit(1)
        .get();
      
      if (!storeSnapshot.empty) {
        const storeData = storeSnapshot.docs[0].data();
        console.log(`   🏪 Tienda: ${storeData.storeName}`);
        console.log(`   TN User ID: ${storeData.tiendanubeUserId}`);
        
        // URL del script
        const scriptUrl = `https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel/script.js?storeId=${wheelData.storeId}`;
        console.log(`   📄 Script URL: ${scriptUrl}`);
      } else {
        console.log('   ❌ PROBLEMA: Tienda no encontrada en Firestore');
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkSpinWheelScripts();
