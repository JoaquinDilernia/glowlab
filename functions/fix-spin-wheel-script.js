// Script para verificar y registrar script tag manualmente
const admin = require('firebase-admin');
const serviceAccount = require('./google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixSpinWheelScript() {
  const storeId = '6854698';
  const wheelId = 'wheel_1763411073845';
  
  try {
    console.log('🔍 Buscando información de la tienda...\n');
    
    // Buscar tienda
    const storeSnapshot = await db.collection('promonube_stores')
      .where('storeId', '==', storeId)
      .limit(1)
      .get();
    
    if (storeSnapshot.empty) {
      console.log('❌ Tienda no encontrada');
      return;
    }
    
    const storeDoc = storeSnapshot.docs[0];
    const storeData = storeDoc.data();
    
    console.log('📊 Datos de la tienda:');
    console.log(JSON.stringify(storeData, null, 2));
    console.log('');
    
    // Verificar que tenga el access token
    const accessToken = storeData.accessToken || storeData.tiendanubeAccessToken;
    if (!accessToken) {
      console.log('❌ No hay access token guardado');
      return;
    }
    
    // Obtener el userId de TiendaNube si no está guardado
    let userId = storeData.tiendanubeUserId;
    
    if (!userId) {
      console.log('⚙️ Obteniendo userId de TiendaNube...');
      
      const response = await fetch('https://api.tiendanube.com/v1/store/', {
        headers: {
          'Authentication': `bearer ${accessToken}`,
          'User-Agent': 'PromoNube (ignacio@techdi.com.ar)'
        }
      });
      
      if (response.ok) {
        const storeInfo = await response.json();
        userId = storeInfo.id;
        
        // Actualizar en Firestore
        await storeDoc.ref.update({
          tiendanubeUserId: userId.toString()
        });
        
        console.log(`✅ userId obtenido y guardado: ${userId}\n`);
      } else {
        const errorText = await response.text();
        console.log('❌ Error obteniendo info de la tienda:', errorText);
        return;
      }
    }
    
    // Ahora registrar el script tag
    console.log('📝 Registrando script tag en TiendaNube...');
    
    const scriptUrl = `https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel/script.js?storeId=${storeId}`;
    
    const scriptResponse = await fetch(`https://api.tiendanube.com/v1/${userId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromoNube (ignacio@techdi.com.ar)'
      },
      body: JSON.stringify({
        src: scriptUrl,
        event: 'onload',
        where: 'store'
      })
    });
    
    if (scriptResponse.ok) {
      const scriptTag = await scriptResponse.json();
      
      console.log('✅ Script tag registrado:');
      console.log(JSON.stringify(scriptTag, null, 2));
      
      // Guardar en la ruleta
      await db.collection('promonube_spin_wheels').doc(wheelId).update({
        scriptTagId: scriptTag.id
      });
      
      console.log('✅ Script tag ID guardado en Firestore');
      console.log('\n🎉 ¡Listo! La ruleta debería aparecer en la tienda ahora');
      
    } else {
      const error = await scriptResponse.text();
      console.log('❌ Error registrando script tag:');
      console.log(error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

fixSpinWheelScript();
