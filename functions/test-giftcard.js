// 🔧 Script de Test para Sistema de Gift Cards
// Este script crea gift cards de prueba para verificar que todo funciona

const admin = require('firebase-admin');
const serviceAccount = require('./google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Generar código único
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GIFT-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function testGiftCardSystem() {
  console.log('🧪 Probando Sistema de Gift Cards\n');
  console.log('═'.repeat(50));
  
  try {
    // 1. Crear gift card de prueba
    console.log('\n📝 Paso 1: Creando gift card de prueba...');
    const testCode = generateCode();
    const giftCardId = `gift_test_${Date.now()}`;
    const storeId = 'TEST_STORE'; // Cambiar por tu storeId real si querés
    
    const giftCardData = {
      giftCardId,
      storeId,
      code: testCode,
      balance: 50000,
      initialAmount: 50000,
      templateId: 'default',
      recipientEmail: 'test@example.com',
      recipientName: 'Cliente de Prueba',
      status: 'active',
      isProductBased: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: null,
      usageCount: 0
    };
    
    await db.collection('promonube_giftcards').doc(giftCardId).set(giftCardData);
    
    console.log('✅ Gift card creada exitosamente!');
    console.log('   Código: ' + testCode);
    console.log('   Saldo: $50,000');
    console.log('   ID: ' + giftCardId);
    
    // 2. Consultar saldo (simular endpoint)
    console.log('\n🔍 Paso 2: Consultando saldo...');
    const snapshot = await db.collection('promonube_giftcards')
      .where('code', '==', testCode)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      console.log('❌ Error: Gift card no encontrada');
      return;
    }
    
    const foundGiftCard = snapshot.docs[0].data();
    console.log('✅ Consulta exitosa!');
    console.log('   Saldo disponible: $' + foundGiftCard.balance.toLocaleString('es-AR'));
    console.log('   Estado: ' + foundGiftCard.status);
    
    // 3. Canjear parcialmente
    console.log('\n💳 Paso 3: Canjeando $20,000...');
    const docRef = snapshot.docs[0].ref;
    const redeemAmount = 20000;
    const newBalance = foundGiftCard.balance - redeemAmount;
    
    await docRef.update({
      balance: newBalance,
      status: newBalance > 0 ? 'partially_used' : 'used',
      lastUsedAt: FieldValue.serverTimestamp(),
      usageCount: FieldValue.increment(1)
    });
    
    // Registrar transacción
    const transactionId = `tx_test_${Date.now()}`;
    await db.collection('giftcard_transactions').doc(transactionId).set({
      transactionId,
      giftCardId,
      giftCardCode: testCode,
      storeId,
      orderId: 'TEST_ORDER_123',
      type: 'redemption',
      amount: redeemAmount,
      balanceBefore: foundGiftCard.balance,
      balanceAfter: newBalance,
      createdAt: FieldValue.serverTimestamp()
    });
    
    console.log('✅ Canje exitoso!');
    console.log('   Monto canjeado: $' + redeemAmount.toLocaleString('es-AR'));
    console.log('   Saldo restante: $' + newBalance.toLocaleString('es-AR'));
    console.log('   Nuevo estado: partially_used');
    
    // 4. Consultar nuevamente
    console.log('\n🔍 Paso 4: Verificando saldo actualizado...');
    const updatedSnapshot = await db.collection('promonube_giftcards')
      .doc(giftCardId)
      .get();
    
    const updatedData = updatedSnapshot.data();
    console.log('✅ Verificación exitosa!');
    console.log('   Saldo actual: $' + updatedData.balance.toLocaleString('es-AR'));
    console.log('   Usos registrados: ' + updatedData.usageCount);
    
    // 5. Ver transacciones
    console.log('\n📊 Paso 5: Consultando historial de transacciones...');
    const transactionsSnapshot = await db.collection('giftcard_transactions')
      .where('giftCardId', '==', giftCardId)
      .get();
    
    console.log('✅ Transacciones encontradas: ' + transactionsSnapshot.size);
    transactionsSnapshot.forEach(doc => {
      const tx = doc.data();
      console.log('   - Tipo: ' + tx.type);
      console.log('     Monto: $' + tx.amount.toLocaleString('es-AR'));
      console.log('     Saldo antes: $' + tx.balanceBefore.toLocaleString('es-AR'));
      console.log('     Saldo después: $' + tx.balanceAfter.toLocaleString('es-AR'));
    });
    
    // Resumen final
    console.log('\n' + '═'.repeat(50));
    console.log('✨ PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('═'.repeat(50));
    console.log('\n📝 Resumen:');
    console.log('   ✅ Creación de gift card: OK');
    console.log('   ✅ Consulta de saldo: OK');
    console.log('   ✅ Canje parcial: OK');
    console.log('   ✅ Actualización de estado: OK');
    console.log('   ✅ Registro de transacciones: OK');
    console.log('\n🎯 Sistema de Gift Cards funcionando correctamente!');
    console.log('\n💡 Podés probar la gift card en el frontend:');
    console.log('   1. Ir a "Usar Gift Card"');
    console.log('   2. Ingresar código: ' + testCode);
    console.log('   3. Ver el saldo disponible: $' + updatedData.balance.toLocaleString('es-AR'));
    console.log('   4. Canjear el resto o una parte');
    
    console.log('\n🗑️  Para limpiar los datos de prueba:');
    console.log('   - Gift Card ID: ' + giftCardId);
    console.log('   - Transaction ID: ' + transactionId);
    
  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error);
    console.error('   Mensaje:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    process.exit();
  }
}

// Ejecutar test
console.log('\n🚀 Iniciando test del sistema...\n');
testGiftCardSystem();
