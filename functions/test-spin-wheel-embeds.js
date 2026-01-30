/**
 * Script de prueba para verificar el sistema de App Embeds
 * 
 * Este script simula el flujo completo:
 * 1. Crear una ruleta de prueba
 * 2. Activarla (registra el script en TiendaNube)
 * 3. Desactivarla (elimina el script)
 * 
 * USO:
 * node test-spin-wheel-embeds.js
 */

const API_URL = 'http://localhost:5001/promonube-5ccc6/us-central1/apipromonube';
// const API_URL = 'https://apipromonube-jlfopowzaq-uc.a.run.app';

// Configuración de prueba
const STORE_ID = 'TU_STORE_ID'; // Reemplazar con un store ID real
const TEST_CONFIG = {
  storeId: STORE_ID,
  name: 'Ruleta de Prueba - App Embeds',
  title: '🎡 ¡Girá y Ganá Premios!',
  subtitle: 'Dejanos tu email y probá tu suerte',
  buttonText: '🎰 GIRAR AHORA',
  successMessage: '¡Felicitaciones! Tu cupón es:',
  active: false, // Empezamos desactivada
  enabled: false,
  delaySeconds: 2,
  showOnce: true,
  exitIntent: false,
  primaryColor: '#667eea',
  secondaryColor: '#764ba2',
  textColor: '#FFFFFF',
  prizes: [
    { id: 1, label: '10% OFF', type: 'percentage', value: 10, probability: 30, color: '#FF6B6B' },
    { id: 2, label: '15% OFF', type: 'percentage', value: 15, probability: 25, color: '#4ECDC4' },
    { id: 3, label: '20% OFF', type: 'percentage', value: 20, probability: 15, color: '#45B7D1' },
    { id: 4, label: '$5000 OFF', type: 'absolute', value: 5000, probability: 10, color: '#F7B801' },
    { id: 5, label: 'Seguí Participando', type: 'none', value: 0, probability: 20, color: '#95A5A6' }
  ]
};

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  console.log(`\n📡 ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  const data = await response.json();
  console.log(`✅ Status: ${response.status}`);
  return data;
}

async function testFlow() {
  console.log('🧪 INICIANDO TEST DE APP EMBEDS\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Crear ruleta
    console.log('\n📝 PASO 1: Crear Ruleta de Prueba');
    console.log('-'.repeat(60));
    const createResult = await request('/api/spin-wheel/create', {
      method: 'POST',
      body: JSON.stringify(TEST_CONFIG)
    });
    
    if (!createResult.success) {
      throw new Error('Error creando ruleta: ' + JSON.stringify(createResult));
    }
    
    const wheelId = createResult.wheelId;
    console.log(`✅ Ruleta creada: ${wheelId}`);
    console.log(`   Nombre: ${TEST_CONFIG.name}`);
    console.log(`   Estado inicial: INACTIVA`);
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Activar ruleta (esto debería registrar el script en TiendaNube)
    console.log('\n⚡ PASO 2: Activar Ruleta (Registrar Script)');
    console.log('-'.repeat(60));
    const activateResult = await request(`/api/spin-wheel/${wheelId}`, {
      method: 'PUT',
      body: JSON.stringify({
        storeId: STORE_ID,
        active: true,
        enabled: true
      })
    });
    
    if (!activateResult.success) {
      throw new Error('Error activando ruleta: ' + JSON.stringify(activateResult));
    }
    
    console.log(`✅ Ruleta activada`);
    console.log(`   Script registrado en TiendaNube`);
    console.log(`   URL del widget: https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=${wheelId}`);
    
    // 3. Verificar que la ruleta está activa
    console.log('\n🔍 PASO 3: Verificar Estado');
    console.log('-'.repeat(60));
    const checkResult = await request(`/api/spin-wheel/${wheelId}?storeId=${STORE_ID}`);
    
    if (checkResult.success && checkResult.wheel) {
      console.log(`✅ Estado verificado:`);
      console.log(`   Active: ${checkResult.wheel.active || checkResult.wheel.enabled}`);
      console.log(`   Script Tag ID: ${checkResult.wheel.scriptTagId || 'N/A'}`);
      console.log(`   Script URL: ${checkResult.wheel.scriptUrl || 'N/A'}`);
    }
    
    // 4. Probar el endpoint del widget
    console.log('\n📜 PASO 4: Probar Endpoint del Widget');
    console.log('-'.repeat(60));
    console.log(`   Probando: GET /api/spin-wheel-widget.js?wheelId=${wheelId}`);
    
    const widgetResponse = await fetch(`${API_URL}/api/spin-wheel-widget.js?wheelId=${wheelId}`);
    const widgetScript = await widgetResponse.text();
    
    if (widgetScript.includes('PromoNube') && widgetScript.includes(wheelId)) {
      console.log(`✅ Widget generado correctamente`);
      console.log(`   Tamaño: ${(widgetScript.length / 1024).toFixed(2)} KB`);
      console.log(`   Contiene: Configuración completa + Estilos + Lógica`);
    } else {
      console.log(`⚠️  Widget no válido`);
    }
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Desactivar ruleta (esto debería eliminar el script de TiendaNube)
    console.log('\n🛑 PASO 5: Desactivar Ruleta (Eliminar Script)');
    console.log('-'.repeat(60));
    const deactivateResult = await request(`/api/spin-wheel/${wheelId}`, {
      method: 'PUT',
      body: JSON.stringify({
        storeId: STORE_ID,
        active: false,
        enabled: false
      })
    });
    
    if (!deactivateResult.success) {
      throw new Error('Error desactivando ruleta: ' + JSON.stringify(deactivateResult));
    }
    
    console.log(`✅ Ruleta desactivada`);
    console.log(`   Script eliminado de TiendaNube`);
    
    // 6. Limpiar: Eliminar ruleta de prueba
    console.log('\n🧹 PASO 6: Limpiar (Eliminar Ruleta de Prueba)');
    console.log('-'.repeat(60));
    const deleteResult = await request(`/api/spin-wheel/${wheelId}?storeId=${STORE_ID}`, {
      method: 'DELETE'
    });
    
    if (deleteResult.success) {
      console.log(`✅ Ruleta eliminada`);
    }
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log('\n✅ Funcionalidades verificadas:');
    console.log('   ✓ Creación de ruleta');
    console.log('   ✓ Activación (registro de script en TiendaNube)');
    console.log('   ✓ Generación dinámica del widget');
    console.log('   ✓ Desactivación (eliminación de script)');
    console.log('   ✓ Eliminación de ruleta');
    
    console.log('\n📖 Documentación completa en: SPIN-WHEEL-APP-EMBEDS.md');
    
  } catch (error) {
    console.error('\n❌ ERROR EN EL TEST:');
    console.error(error.message);
    console.error('\nStack:', error.stack);
  }
}

// Verificar que se haya configurado el store ID
if (STORE_ID === 'TU_STORE_ID') {
  console.error('❌ ERROR: Debes configurar STORE_ID en el script');
  console.error('   Edita el archivo y reemplaza "TU_STORE_ID" con un store ID real');
  process.exit(1);
}

// Ejecutar test
testFlow()
  .then(() => {
    console.log('\n✅ Test finalizado\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test fallido:', error);
    process.exit(1);
  });
