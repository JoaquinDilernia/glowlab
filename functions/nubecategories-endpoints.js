const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const fetch = require('node-fetch');

// Si no está inicializado en index.js, inicializar aquí
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'pedidos-lett-2'
  });
}

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// ==================== HELPERS ====================

async function getStoreToken(storeId) {
  try {
    const doc = await db.collection('nubecategories_stores').doc(storeId.toString()).get();
    if (!doc.exists) {
      throw new Error('Store not found');
    }
    return doc.data().access_token;
  } catch (error) {
    throw new Error(`Failed to get store token: ${error.message}`);
  }
}

async function apiCall(endpoint, storeId, accessToken, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authentication': `bearer ${accessToken}`,
      'User-Agent': 'NubeCategories'
    }
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://api.tiendanube.com/v1/${storeId}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`TiendaNube API error: ${JSON.stringify(data)}`);
  }

  return data;
}

// ==================== RUTAS ====================

// GET: Obtener todas las categorías de TiendaNube
app.get('/api/categories/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const accessToken = await getStoreToken(storeId);

    // Obtener categorías de TiendaNube
    const tiendanubeCategories = await apiCall('/categories', storeId, accessToken);

    // Guardar en caché en Firestore
    await db.collection('CategoriesNube_categories').doc(storeId).set({
      store_id: storeId,
      categories: tiendanubeCategories.results || tiendanubeCategories,
      last_synced: admin.firestore.FieldValue.serverTimestamp(),
      total: tiendanubeCategories.paging?.total || tiendanubeCategories.results?.length || 0
    });

    res.json({
      success: true,
      categories: tiendanubeCategories.results || tiendanubeCategories,
      total: tiendanubeCategories.paging?.total || tiendanubeCategories.results?.length || 0
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Crear nueva categoría
app.post('/api/categories/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { name, parent, description, seo_title, seo_description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const accessToken = await getStoreToken(storeId);

    // Crear en TiendaNube
    const newCategory = await apiCall('/categories', storeId, accessToken, 'POST', {
      name: { es: name },
      parent: parent || 0,
      description: { es: description || '' },
      seo_title: { es: seo_title || '' },
      seo_description: { es: seo_description || '' }
    });

    // Guardar log en Firestore
    await db.collection('CategoriesNube_changes').add({
      store_id: storeId,
      action: 'create',
      category_id: newCategory.id,
      category_name: name,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      category: newCategory,
      message: `Category "${name}" created successfully`
    });
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT: Actualizar categoría
app.put('/api/categories/:storeId/:categoryId', async (req, res) => {
  try {
    const { storeId, categoryId } = req.params;
    const { name, parent, description, seo_title, seo_description, visibility } = req.body;

    const accessToken = await getStoreToken(storeId);

    const updateData = {};
    if (name) updateData.name = { es: name };
    if (parent !== undefined) updateData.parent = parent;
    if (description) updateData.description = { es: description };
    if (seo_title) updateData.seo_title = { es: seo_title };
    if (seo_description) updateData.seo_description = { es: seo_description };
    if (visibility) updateData.visibility = visibility;

    // Actualizar en TiendaNube
    const updatedCategory = await apiCall(`/categories/${categoryId}`, storeId, accessToken, 'PUT', updateData);

    // Guardar log en Firestore
    await db.collection('CategoriesNube_changes').add({
      store_id: storeId,
      action: 'update',
      category_id: categoryId,
      category_name: name || 'Unknown',
      changes: Object.keys(updateData),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      category: updatedCategory,
      message: `Category "${name || 'ID: ' + categoryId}" updated successfully`
    });
  } catch (error) {
    console.error('❌ Error updating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Eliminar categoría
app.delete('/api/categories/:storeId/:categoryId', async (req, res) => {
  try {
    const { storeId, categoryId } = req.params;
    const accessToken = await getStoreToken(storeId);

    // Eliminar de TiendaNube
    await apiCall(`/categories/${categoryId}`, storeId, accessToken, 'DELETE');

    // Guardar log en Firestore
    await db.collection('CategoriesNube_changes').add({
      store_id: storeId,
      action: 'delete',
      category_id: categoryId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: `Category deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Obtener historial de cambios
app.get('/api/categories/:storeId/changes', async (req, res) => {
  try {
    const { storeId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const snapshot = await db.collection('CategoriesNube_changes')
      .where('store_id', '==', storeId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const changes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      changes,
      total: changes.length
    });
  } catch (error) {
    console.error('❌ Error fetching changes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Obtener reglas de automatización
app.get('/api/rules/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    const snapshot = await db.collection('CategoriesNube_rules')
      .where('store_id', '==', storeId)
      .get();

    const rules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      rules,
      total: rules.length
    });
  } catch (error) {
    console.error('❌ Error fetching rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Crear regla de automatización
app.post('/api/rules/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { name, trigger, action, enabled } = req.body;

    if (!name || !trigger || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'name, trigger, and action are required' 
      });
    }

    const docRef = await db.collection('CategoriesNube_rules').add({
      store_id: storeId,
      name,
      trigger,
      action,
      enabled: enabled !== false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      rule_id: docRef.id,
      message: `Rule "${name}" created successfully`
    });
  } catch (error) {
    console.error('❌ Error creating rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT: Actualizar regla
app.put('/api/rules/:storeId/:ruleId', async (req, res) => {
  try {
    const { storeId, ruleId } = req.params;
    const { name, trigger, action, enabled } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (trigger) updateData.trigger = trigger;
    if (action) updateData.action = action;
    if (enabled !== undefined) updateData.enabled = enabled;
    updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('CategoriesNube_rules').doc(ruleId).update(updateData);

    res.json({
      success: true,
      message: `Rule updated successfully`
    });
  } catch (error) {
    console.error('❌ Error updating rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Eliminar regla
app.delete('/api/rules/:storeId/:ruleId', async (req, res) => {
  try {
    const { storeId, ruleId } = req.params;

    await db.collection('CategoriesNube_rules').doc(ruleId).delete();

    res.json({
      success: true,
      message: `Rule deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { categoriesRouter: app };
