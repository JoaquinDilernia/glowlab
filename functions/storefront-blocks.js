"use strict";

// Vidriera Shoppable - bloques insertables en el home (Nube SDK, slots en vez de selector CSS).
// Ver plan: docs/superpowers/plans/... (Vidriera Shoppable).
//
// Un doc por store en `promonube_storefront_blocks`, con un array de bloques.
// GET/POST /api/storefront-blocks son para el admin React (todos los bloques).
// GET /api/storefront-blocks/render es público, consumido por el script NubeSDK
// en el storefront: solo bloques enabled:true, sin campos internos de admin,
// y respeta el gate de suscripción activa (igual que los widgets legacy).

const COLLECTION = "promonube_storefront_blocks";

function registerStorefrontBlocksRoutes(app, { db, FieldValue, getCachedDoc, invalidateConfigCache, checkStoreActive }) {
  // GET /api/storefront-blocks?storeId=X - config completa para el admin
  app.get("/api/storefront-blocks", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });

    try {
      const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
      const blocks = doc.exists ? (doc.data().blocks || []) : [];
      res.json({ success: true, blocks });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/storefront-blocks - guardar (reemplaza el array completo de bloques)
  app.post("/api/storefront-blocks", async (req, res) => {
    const { storeId, blocks } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!Array.isArray(blocks)) return res.status(400).json({ success: false, message: "blocks debe ser un array" });

    try {
      await db.collection(COLLECTION).doc(String(storeId)).set({
        blocks,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      invalidateConfigCache(storeId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /api/storefront-blocks/render?storeId=X - público, consumido por el script del storefront
  app.get("/api/storefront-blocks/render", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ success: false, blocks: [] });

    try {
      if (!(await checkStoreActive(storeId))) {
        return res.json({ success: true, blocks: [] });
      }

      const doc = await getCachedDoc(COLLECTION, String(storeId));
      const blocks = doc.exists ? (doc.data().blocks || []) : [];
      const activeBlocks = blocks
        .filter((b) => b && b.enabled)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      res.json({ success: true, blocks: activeBlocks });
    } catch (error) {
      res.status(500).json({ success: false, blocks: [] });
    }
  });
}

module.exports = { registerStorefrontBlocksRoutes };
