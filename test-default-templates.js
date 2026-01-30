/**
 * Test Script: Verificar Templates Predeterminados
 * 
 * Este script verifica que una tienda tenga los 4 templates predeterminados instalados
 * y muestra información sobre cada uno.
 */

const admin = require("firebase-admin");
const serviceAccount = require("./functions/google-service-account.json");

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function testDefaultTemplates(storeId) {
  try {
    console.log(`\n🔍 Verificando templates predeterminados para store: ${storeId}\n`);
    console.log("═".repeat(70));
    
    // Buscar templates de la tienda
    const templatesSnapshot = await db
      .collection("giftcard_templates")
      .where("storeId", "==", storeId)
      .get();

    if (templatesSnapshot.empty) {
      console.log("❌ No se encontraron templates para esta tienda");
      console.log("\n💡 Posibles causas:");
      console.log("   - La tienda aún no ha pasado por el auth callback");
      console.log("   - El storeId es incorrecto");
      console.log("   - La función installDefaultTemplates() falló");
      return;
    }

    console.log(`✅ Encontrados ${templatesSnapshot.size} templates\n`);

    // Listar cada template
    let defaultFound = false;
    let systemTemplatesCount = 0;

    templatesSnapshot.forEach((doc, index) => {
      const data = doc.data();
      
      console.log(`\n📋 Template #${index + 1}: ${data.name}`);
      console.log("─".repeat(70));
      console.log(`   ID: ${data.templateId}`);
      console.log(`   Posición texto: ${data.textPosition}`);
      console.log(`   Color texto: ${data.textColor}`);
      console.log(`   Tamaño fuente: ${data.fontSize}px`);
      console.log(`   Es default: ${data.isDefault ? '✅ SÍ' : '❌ No'}`);
      console.log(`   Template del sistema: ${data.isSystemTemplate ? '✅ SÍ' : '❌ No'}`);
      console.log(`   Preview URL: ${data.imageUrl.substring(0, 60)}...`);
      
      if (data.createdAt) {
        console.log(`   Creado: ${data.createdAt.toDate().toLocaleString('es-AR')}`);
      }

      if (data.isDefault) defaultFound = true;
      if (data.isSystemTemplate) systemTemplatesCount++;
    });

    // Resumen
    console.log("\n" + "═".repeat(70));
    console.log("📊 RESUMEN:");
    console.log("═".repeat(70));
    console.log(`   Total templates: ${templatesSnapshot.size}`);
    console.log(`   Templates del sistema: ${systemTemplatesCount}`);
    console.log(`   Template por defecto: ${defaultFound ? '✅ Configurado' : '❌ NO configurado'}`);
    
    // Verificar que sean exactamente 4 templates del sistema
    if (systemTemplatesCount === 4) {
      console.log("\n✅ CORRECTO: Se instalaron los 4 templates predeterminados");
    } else {
      console.log(`\n⚠️  ADVERTENCIA: Se esperaban 4 templates del sistema, se encontraron ${systemTemplatesCount}`);
    }

    if (!defaultFound) {
      console.log("\n❌ ERROR: Ningún template está marcado como default");
    }

    // Verificar nombres esperados
    console.log("\n" + "═".repeat(70));
    console.log("🎨 VERIFICACIÓN DE NOMBRES:");
    console.log("═".repeat(70));
    
    const expectedNames = [
      "Elegante Morado",
      "Dorado Premium",
      "Rosado Suave",
      "Azul Minimalista"
    ];

    const foundNames = [];
    templatesSnapshot.forEach(doc => {
      foundNames.push(doc.data().name);
    });

    expectedNames.forEach(name => {
      if (foundNames.includes(name)) {
        console.log(`   ✅ ${name}`);
      } else {
        console.log(`   ❌ ${name} (NO ENCONTRADO)`);
      }
    });

    console.log("\n" + "═".repeat(70));
    console.log("✨ Verificación completada");
    console.log("═".repeat(70) + "\n");

  } catch (error) {
    console.error("❌ Error durante la verificación:", error);
  } finally {
    process.exit(0);
  }
}

// Obtener storeId de argumentos
const storeId = process.argv[2];

if (!storeId) {
  console.log("\n❌ Error: Debes proporcionar un storeId\n");
  console.log("Uso:");
  console.log("   node test-default-templates.js <storeId>\n");
  console.log("Ejemplo:");
  console.log("   node test-default-templates.js 123456\n");
  process.exit(1);
}

testDefaultTemplates(storeId);
