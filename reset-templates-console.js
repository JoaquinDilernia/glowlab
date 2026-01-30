// Script simple para resetear templates desde Firebase Firestore Console
// Ejecutar esto en la consola de Firebase Firestore

// 1. Ve a: https://console.firebase.google.com/project/pedidos-lett-2/firestore/databases/-default-/data
// 2. Abre la colección "giftcard_templates"  
// 3. Copia y pega este código en la consola del navegador (F12)

const db = firebase.firestore();

async function resetTemplates() {
  console.log('🗑️ Borrando templates viejos...');
  
  // Obtener todos los templates
  const snapshot = await db.collection('giftcard_templates').get();
  
  // Borrar todos
  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  if (snapshot.size > 0) {
    await batch.commit();
    console.log(`✅ ${snapshot.size} templates eliminados`);
  }
  
  // Crear 4 predeterminados
  const templates = [
    {
      templateId: 'default-elegante-negro',
      name: 'Elegante Negro',
      category: 'Predeterminado',
      backgroundColor: '#1a1a1a',
      textColor: '#FFFFFF',
      textPosition: 'center',
      fontSize: 48,
      isPredefined: true,
      isDefault: false,
      storeId: 'default'
    },
    {
      templateId: 'default-dorado-premium',
      name: 'Dorado Premium',
      category: 'Predeterminado',
      backgroundColor: '#d4af37',
      textColor: '#1a1a1a',
      textPosition: 'center',
      fontSize: 48,
      isPredefined: true,
      isDefault: true,
      storeId: 'default'
    },
    {
      templateId: 'default-azul-moderno',
      name: 'Azul Moderno',
      category: 'Predeterminado',
      backgroundColor: '#0ea5e9',
      textColor: '#FFFFFF',
      textPosition: 'center',
      fontSize: 48,
      isPredefined: true,
      isDefault: false,
      storeId: 'default'
    },
    {
      templateId: 'default-rosa-festivo',
      name: 'Rosa Festivo',
      category: 'Predeterminado',
      backgroundColor: '#ec4899',
      textColor: '#FFFFFF',
      textPosition: 'center',
      fontSize: 48,
      isPredefined: true,
      isDefault: false,
      storeId: 'default'
    }
  ];
  
  console.log('✨ Creando 4 templates predeterminados...');
  const createBatch = db.batch();
  
  for (const template of templates) {
    const ref = db.collection('giftcard_templates').doc(template.templateId);
    createBatch.set(ref, {
      ...template,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  
  await createBatch.commit();
  console.log('✅ 4 templates predeterminados creados!');
  console.log('Templates:', templates.map(t => t.name + ' (' + t.backgroundColor + ')'));
  
  return 'OK!';
}

// Ejecutar
resetTemplates().then(console.log).catch(console.error);
