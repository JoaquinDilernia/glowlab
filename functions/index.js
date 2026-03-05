const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createCanvas, loadImage } = require("canvas");
const sgMail = require('@sendgrid/mail');
const Busboy = require('busboy');
const multer = require('multer');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const bucket = admin.storage().bucket();

// Configurar Mercado Pago
let mpClient = null;
let MP_ACCESS_TOKEN = '';

function initMercadoPago() {
  try {
    // Leer desde process.env (funciona con .env files)
    MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
    
    if (MP_ACCESS_TOKEN) {
      mpClient = new MercadoPagoConfig({ 
        accessToken: MP_ACCESS_TOKEN,
        options: { timeout: 5000 }
      });
      console.log('âœ… Mercado Pago configurado correctamente');
      console.log('ðŸ”‘ Token preview:', MP_ACCESS_TOKEN.substring(0, 20) + '...');
    } else {
      console.warn('âš ï¸ MP_ACCESS_TOKEN no encontrado en variables de entorno');
    }
  } catch (error) {
    console.error('âŒ Error configurando Mercado Pago:', error);
  }
}

// Inicializar MP
initMercadoPago();

// Configurar Multer para memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Configurar SendGrid (la API key se configura con Firebase Config)
// Ejecutar: firebase functions:config:set sendgrid.api_key="TU_API_KEY"
let SENDGRID_API_KEY = '';

// FunciÃ³n para inicializar SendGrid
function initSendGrid() {
  try {
    // Intentar desde process.env primero (para desarrollo local)
    SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
    
    // Si no estÃ¡, intentar desde functions.config() (para producciÃ³n)
    if (!SENDGRID_API_KEY && functions.config && functions.config().sendgrid) {
      SENDGRID_API_KEY = functions.config().sendgrid.api_key || '';
    }
    
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
      console.log('âœ… SendGrid configurado correctamente');
    } else {
      console.warn('âš ï¸ SENDGRID_API_KEY no encontrada');
    }
  } catch (error) {
    console.error('âŒ Error configurando SendGrid:', error);
  }
}

// Inicializar SendGrid
initSendGrid();

// Cloud Functions URL
const CLOUD_FUNCTION_URL = 'https://us-central1-pedidos-lett-2.cloudfunctions.net/apipromonube/api';

// ==========================================
// SISTEMA DE SUSCRIPCIONES Y FEATURE FLAGS
// ==========================================

// ============================================
// PLAN ÃšNICO PRO - Todo incluido
// ============================================

// Precios por paÃ­s (mensuales) - PLAN ÃšNICO
const PRICES_BY_COUNTRY = {
  ARS: 30000,  // Argentina (configurado en Partner Panel)
  MXN: 1500,   // MÃ©xico
  COP: 135000, // Colombia
  CLP: 33000   // Chile
};

// FunciÃ³n para obtener precio segÃºn moneda de la tienda
function getPlanPrice(currency = 'ARS') {
  return PRICES_BY_COUNTRY[currency] || PRICES_BY_COUNTRY.ARS;
}

// MÃ³dulos incluidos en el plan PRO (todos activos)
const ALL_MODULES = ['coupons', 'giftcards', 'spinWheel', 'style', 'countdown', 'popups'];

const MODULES = {
  coupons: { name: 'Cupones Inteligentes', included: true },
  giftcards: { name: 'Gift Cards', included: true },
  spinWheel: { name: 'Ruleta de Premios', included: true },
  style: { name: 'Style Pro', included: true },
  countdown: { name: 'Cuenta Regresiva', included: true },
  popups: { name: 'Pop-ups', included: true }
};

// Plan Ãºnico PRO con todo incluido
const PLANS = {
  free: { 
    name: 'Free (Trial)', 
    modules: ['coupons'],
    price: 0
  },
  pro: { 
    name: 'PromoNube Pro',
    modules: ALL_MODULES,
    getPriceFor: (currency) => getPlanPrice(currency),
    description: 'Todas las funcionalidades incluidas'
  }
};

// Alias para compatibilidad (todos mapean a 'pro')
PLANS.unlimited = PLANS.pro;
PLANS.ruleta = PLANS.pro;
PLANS.giftcards = PLANS.pro;
PLANS.countdown = PLANS.pro;
PLANS.style = PLANS.pro;

// Helper: Convertir array de mÃ³dulos a objeto {moduleName: true}
function modulesArrayToObject(modulesArray) {
  const modulesObj = {};
  modulesArray.forEach(mod => {
    modulesObj[mod] = true;
  });
  return modulesObj;
}

// Verificar acceso a un mÃ³dulo
async function checkModuleAccess(storeId, moduleName) {
  try {
    // Cupones siempre gratis
    if (moduleName === 'coupons') {
      return { hasAccess: true, reason: 'free_module' };
    }

    // Consultar suscripciÃ³n del store
    const subscriptionRef = db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      // Sin suscripciÃ³n = solo acceso a cupones
      return { hasAccess: false, reason: 'no_subscription' };
    }

    const subscription = subscriptionDoc.data();

    // âœ… DEMO: Si es cuenta demo Y no ha expirado, dar acceso total
    if (subscription.isDemoAccount) {
      const expiresAt = new Date(subscription.demoExpiresAt);
      const now = new Date();
      
      if (now < expiresAt) {
        return { 
          hasAccess: true, 
          reason: 'demo_account',
          expiresAt: subscription.demoExpiresAt
        };
      } else {
        // Demo expirado - desactivar automÃ¡ticamente
        console.log(`âš ï¸ Demo expirado para store ${storeId}, desactivando...`);
        await subscriptionRef.update({
          status: 'inactive',
          plan: 'free',
          modules: { coupons: true },
          isDemoAccount: false,
          demoExpired: true,
          updatedAt: new Date().toISOString()
        });
        return { hasAccess: false, reason: 'demo_expired' };
      }
    }

    // Verificar estado de la suscripciÃ³n
    if (subscription.status === 'suspended') {
      return { hasAccess: false, reason: 'payment_suspended', message: 'Regulariza el pago en tu panel de TiendaNube' };
    }

    if (subscription.status !== 'active') {
      return { hasAccess: false, reason: 'inactive_subscription', status: subscription.status };
    }

    // Verificar si el mÃ³dulo estÃ¡ activo
    const hasModule = subscription.modules && subscription.modules[moduleName] === true;
    
    return { 
      hasAccess: hasModule, 
      reason: hasModule ? 'active' : 'module_not_included',
      plan: subscription.plan 
    };
  } catch (error) {
    console.error('Error verificando acceso al mÃ³dulo:', error);
    return { hasAccess: false, reason: 'error', error: error.message };
  }
}

// Middleware de Express para verificar acceso
function requireModule(moduleName) {
  return async (req, res, next) => {
    const storeId = req.query.store || req.body.storeId || req.params.storeId;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID requerido' });
    }

    const accessCheck = await checkModuleAccess(storeId, moduleName);

    if (!accessCheck.hasAccess) {
      return res.status(403).json({ 
        error: 'MÃ³dulo no disponible',
        module: moduleName,
        reason: accessCheck.reason,
        message: `El mÃ³dulo ${MODULES[moduleName]?.name || moduleName} no estÃ¡ activo en tu plan.`,
        upgrade_url: `https://pedidos-lett-2.web.app/upgrade?module=${moduleName}`
      });
    }

    // Store tiene acceso, continuar
    req.moduleAccess = accessCheck;
    next();
  };
}

// Inicializar suscripciÃ³n por defecto para nuevos stores
async function initializeStoreSubscription(storeId) {
  try {
    const subscriptionRef = db.collection('promonube_subscription').doc(storeId.toString());
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      await subscriptionRef.set({
        plan: 'free',
        status: 'active',
        modules: {
          coupons: true,
          giftcards: false,
          spinWheel: true,
          style: true,
          countdown: true,
          popups: true
        },
        createdAt: FieldValue.serverTimestamp(),
        trialEndsAt: null,
        nextBillingDate: null,
        mpSubscriptionId: null
      });
      console.log('âœ… SuscripciÃ³n FREE inicializada para store', storeId);
    }
  } catch (error) {
    console.error('Error inicializando suscripciÃ³n:', error);
  }
}

// ==========================================
// INTEGRACIONES DE EMAIL MARKETING
// ==========================================

// Helper: Enviar contacto a Perfit
async function sendToPerfit(store, email, data = {}) {
  try {
    console.log('ðŸ“§ [Perfit] Intentando enviar contacto:', { 
      email, 
      storeId: store.storeId,
      hasApiKey: !!store.perfitApiKey,
      hasAccountId: !!store.perfitAccountId,
      data 
    });

    if (!store.perfitApiKey || !store.perfitAccountId) {
      console.log('âš ï¸ Perfit no configurado para store', store.storeId, {
        perfitApiKey: store.perfitApiKey ? 'configurada' : 'NO configurada',
        perfitAccountId: store.perfitAccountId || 'NO configurado'
      });
      return { success: false, error: 'not_configured' };
    }

    const perfitData = {
      email: email,
      first_name: data.firstName || '',
      last_name: data.lastName || '',
      tags: data.tags || [],
      custom_fields: data.customFields || {},
      lists: data.lists || []
    };

    const response = await fetch(`https://api.perfit.io/v1/accounts/${store.perfitAccountId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${store.perfitApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(perfitData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('âœ… Contacto enviado a Perfit exitosamente:', { 
        email, 
        accountId: store.perfitAccountId,
        lists: perfitData.lists,
        tags: perfitData.tags,
        result 
      });
      return { success: true, data: result };
    } else {
      const error = await response.text();
      console.error('âŒ [PERFIT ERROR] Error enviando a Perfit:', { 
        status: response.status,
        statusText: response.statusText,
        errorBody: error,
        email,
        accountId: store.perfitAccountId,
        apiKey: store.perfitApiKey ? store.perfitApiKey.substring(0, 15) + '...' : 'NO DEFINIDA',
        url: `https://api.perfit.io/v1/accounts/${store.perfitAccountId}/contacts`,
        sentData: perfitData
      });
      return { success: false, error, details: { status: response.status, statusText: response.statusText } };
    }
  } catch (error) {
    console.error('âŒ [PERFIT EXCEPTION] Error en sendToPerfit:', {
      error: error.message,
      stack: error.stack,
      store: store.storeId,
      email
    });
    return { success: false, error: error.message };
  }
}

// Helper: Enviar contacto a Mailchimp
async function sendToMailchimp(store, email, data = {}) {
  try {
    if (!store.mailchimpApiKey || !store.mailchimpListId) {
      console.log('âš ï¸ Mailchimp no configurado para store', store.storeId);
      return { success: false, error: 'not_configured' };
    }

    const dc = store.mailchimpApiKey.split('-')[1];
    const mailchimpData = {
      email_address: email,
      status: 'subscribed',
      merge_fields: {
        FNAME: data.firstName || '',
        LNAME: data.lastName || ''
      },
      tags: data.tags || []
    };

    const response = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${store.mailchimpListId}/members`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${store.mailchimpApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mailchimpData)
      }
    );

    if (response.ok || response.status === 400) {
      // 400 puede significar que ya existe, lo consideramos Ã©xito
      console.log('âœ… Contacto enviado a Mailchimp:', email);
      return { success: true };
    } else {
      const error = await response.text();
      console.error('âŒ Error enviando a Mailchimp:', error);
      return { success: false, error };
    }
  } catch (error) {
    console.error('âŒ Error en sendToMailchimp:', error);
    return { success: false, error: error.message };
  }
}

// Helper: Enviar contacto a todas las integraciones configuradas
async function syncEmailToIntegrations(store, email, eventData = {}) {
  const results = {
    perfit: null,
    mailchimp: null,
    activecampaign: null
  };

  // Perfit
  if (store.perfitApiKey && store.perfitEnabled !== false) {
    results.perfit = await sendToPerfit(store, email, eventData);
  }

  // Mailchimp
  if (store.mailchimpApiKey && store.mailchimpEnabled !== false) {
    results.mailchimp = await sendToMailchimp(store, email, eventData);
  }

  // ActiveCampaign (prÃ³ximamente)
  // if (store.activeCampaignApiKey && store.activeCampaignEnabled !== false) {
  //   results.activecampaign = await sendToActiveCampaign(store, email, eventData);
  // }

  console.log('ðŸ“§ SincronizaciÃ³n de email completada:', { email, results });
  return results;
}

// Helper para hashear contraseÃ±as
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Helper para instalar templates predeterminados
async function installDefaultTemplates(storeId) {
  try {
    console.log(`ðŸŽ¨ Instalando templates predeterminados para store ${storeId}...`);
    
    const templates = [
      {
        name: "ðŸŽ„ Navidad MÃ¡gica",
        category: "Festividades",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJjaHJpc3RtYXMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMxZTQwYWY7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwNTc1MmQ7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50Pjwvl2Vmc48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIGZpbGw9InVybCgjY2hyaXN0bWFzKSIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEwMCIgcj0iNCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iMzAwIiBjeT0iMjAwIiByPSIzIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI5MDAiIGN5PSIxNTAiIHI9IjUiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOSIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjQwMCIgcj0iNCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43Ii8+PGNpcmNsZSBjeD0iMTA1MCIgY3k9IjMwMCIgcj0iMyIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44Ii8+PHBvbHlnb24gcG9pbnRzPSI2MDAsNTAgNjIwLDExMCA1ODAsODAgNjQwLDgwIDYwMCwxMTAiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuOSIvPjxwb2x5Z29uIHBvaW50cz0iMjAwLDMwMCAyMTUsMzUwIDE5MCwzMjUgMjI1LDMyNSAyMDAsMzUwIiBmaWxsPSIjZmZkNzAwIiBvcGFjaXR5PSIwLjgiLz48cG9seWdvbiBwb2ludHM9IjEwMDAsNDAwIDEwMTUsNDUwIDk5MCw0MjUgMTAzMCw0MjUgMTAwMCw0NTAiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuOSIvPjwvc3ZnPg==",
        textPosition: "center",
        textColor: "#FFFFFF",
        fontSize: 56,
        isDefault: true
      },
      {
        name: "ðŸŽ‰ CumpleaÃ±os Festivo",
        category: "Celebraciones",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJiaXJ0aGRheSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2VjNDg5OTtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjU5ZTBiO3N0b3Atb3BhY2l0eToxIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOGI1Y2Y2O3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjI4IiBmaWxsPSJ1cmwoI2JpcnRoZGF5KSIvPjxyZWN0IHg9IjEwMCIgeT0iNTAiIHdpZHRoPSIzMCIgaGVpZ2h0PSI4MCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4zIiB0cmFuc2Zvcm09InJvdGF0ZSgxNSA2MDAgMzAwKSIvPjxyZWN0IHg9IjMwMCIgeT0iNDAwIiB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmZmQiIG9wYWNpdHk9IjAuNCIgdHJhbnNmb3JtPSJyb3RhdGUoLTE1IDYwMCAzMDApIi8+PHJlY3QgeD0iOTAwIiB5PSIxMDAiIHdpZHRoPSIzNSIgaGVpZ2h0PSI3MCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4zNSIgdHJhbnNmb3JtPSJyb3RhdGUoMjUgNjAwIDMwMCkiLz48Y2lyY2xlIGN4PSI0MDAiIGN5PSIxNTAiIHI9IjgiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjgwMCIgY3k9IjUwMCIgcj0iMTAiIGZpbGw9IiMzYjgyZjYiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjgwIiByPSI2IiBmaWxsPSIjZWM0ODk5IiBvcGFjaXR5PSIwLjgiLz48L3N2Zz4=",
        textPosition: "center",
        textColor: "#FFFFFF",
        fontSize: 54,
        isDefault: false
      },
      {
        name: "ðŸ’Ž Lujo Premium",
        category: "Elegante",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJsdXh1cnkiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwZjE3MmE7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMxZTE5MWI7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIGZpbGw9InVybCgjbHV4dXJ5KSIvPjxsaW5lIHgxPSIwIiB5MT0iMTAwIiB4Mj0iMTIwMCIgeTI9IjEwMCIgc3Ryb2tlPSIjZmZkNzAwIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuMyIvPjxsaW5lIHgxPSIwIiB5MT0iNTI4IiB4Mj0iMTIwMCIgeTI9IjUyOCIgc3Ryb2tlPSIjZmZkNzAwIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuMyIvPjxyZWN0IHg9IjgwIiB5PSI1MCIgd2lkdGg9IjMiIGhlaWdodD0iNTI4IiBmaWxsPSIjZmZkNzAwIiBvcGFjaXR5PSIwLjQiLz48cmVjdCB4PSIxMTE3IiB5PSI1MCIgd2lkdGg9IjMiIGhlaWdodD0iNTI4IiBmaWxsPSIjZmZkNzAwIiBvcGFjaXR5PSIwLjQiLz48cG9seWdvbiBwb2ludHM9IjYwMCwxODAgNjIwLDE5MCA2MTAsMjEwIDU5MCwyMTAgNTgwLDE5MCIgZmlsbD0iI2ZmZDcwMCIgb3BhY2l0eT0iMC42Ii8+PHBvbHlnb24gcG9pbnRzPSI2MDAsMzgwIDYyMCwzOTAgNjEwLDQxMCA1OTAsNDEwIDU4MCwzOTAiIGZpbGw9IiNmZmQ3MDAiIG9wYWNpdHk9IjAuNiIvPjwvc3ZnPg==",
        textPosition: "center",
        textColor: "#FFD700",
        fontSize: 52,
        isDefault: false
      },
      {
        name: "ðŸ’ RomÃ¡ntico",
        category: "Amor",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJyb21hbnRpYyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZjZTdmMztzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZkYmZkMjtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjYyOCIgZmlsbD0idXJsKCNyb21hbnRpYykiLz48cGF0aCBkPSJNMzAwLDI1MCBRMzAwLDIwMCAzNTAsMjAwIFE0MDAsMjAwIDQwMCwyNTAgUTQwMCwzMDAgMzAwLDM4MCBRMjAwLDMwMCAyMDAsMjUwIFEyMDAsMjAwIDI1MCwyMDAgUTMwMCwyMDAgMzAwLDI1MCIgZmlsbD0iI2ZiN2E4NSIgb3BhY2l0eT0iMC4yIi8+PHBhdGggZD0iTTkwMCwxNTAgUTkwMCwxMDAgOTUwLDEwMCBRMTAwMCwxMDAgMTAwMCwxNTAgUTEwMDAsMjAwIDkwMCwyODAgUTgwMCwyMDAgODAwLDE1MCBRODAwLDEwMCA4NTAsMTAwIFE5MDAsMTAwIDkwMCwxNTAiIGZpbGw9IiNmYjdhODUiIG9wYWNpdHk9IjAuMTUiLz48Y2lyY2xlIGN4PSI2MDAiIGN5PSI1MDAiIHI9IjgwIiBmaWxsPSIjZmI3YTg1IiBvcGFjaXR5PSIwLjEiLz48Y2lyY2xlIGN4PSI0NTAiIGN5PSI0MDAiIHI9IjUwIiBmaWxsPSIjZjljMmNiIiBvcGFjaXR5PSIwLjIiLz48L3N2Zz4=",
        textPosition: "center",
        textColor: "#EC4899",
        fontSize: 50,
        isDefault: false
      },
      {
        name: "ðŸŒ´ Tropical Verano",
        category: "Estaciones",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJ0cm9waWNhbCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzA4OTFiMjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzA1NzVhMTtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjYyOCIgZmlsbD0idXJsKCN0cm9waWNhbCkiLz48ZWxsaXBzZSBjeD0iMjAwIiBjeT0iMTAwIiByeD0iNDAiIHJ5PSI2MCIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4zIi8+PGVsbGlwc2UgY3g9IjIyMCIgY3k9IjkwIiByeD0iMzUiIHJ5PSI1NSIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4yNSIvPjxlbGxpcHNlIGN4PSIxMDAwIiBjeT0iNDAwIiByeD0iNDUiIHJ5PSI2NSIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4yOCIvPjxlbGxpcHNlIGN4PSIxMDIwIiBjeT0iMzgwIiByeD0iNDAiIHJ5PSI2MCIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC4yMiIvPjxjaXJjbGUgY3g9IjkwMCIgY3k9IjgwIiByPSI1MCIgZmlsbD0iI2ZiZDM4ZCIgb3BhY2l0eT0iMC40Ii8+PGNpcmNsZSBjeD0iNTAwIiBjeT0iNTUwIiByPSI0MCIgZmlsbD0iI2ZiZDM4ZCIgb3BhY2l0eT0iMC4zNSIvPjwvc3ZnPg==",
        textPosition: "center",
        textColor: "#FFFFFF",
        fontSize: 52,
        isDefault: false
      },
      {
        name: "ðŸŽ¨ Moderno GeomÃ©trico",
        category: "Moderno",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnZW9tZXRyaWMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NjdlZWE7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzhiNWNmNjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2VjNDg5OTtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjYyOCIgZmlsbD0idXJsKCNnZW9tZXRyaWMpIi8+PHBvbHlnb24gcG9pbnRzPSIyMDAsMTAwIDMwMCw1MCAzMDAsMTUwIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjEiLz48cG9seWdvbiBwb2ludHM9IjkwMCw0MDAgMTAwMCwzNTAgMTAwMCw0NTAiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMTIiLz48cmVjdCB4PSI0MDAiIHk9IjIwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMDgiIHRyYW5zZm9ybT0icm90YXRlKDQ1IDYwMCAzMDApIi8+PGNpcmNsZSBjeD0iNzAwIiBjeT0iNTAwIiByPSI2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9IjAuMTUiLz48Y2lyY2xlIGN4PSIzMDAiIGN5PSI0MDAiIHI9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgb3BhY2l0eT0iMC4xIi8+PC9zdmc+",
        textPosition: "center",
        textColor: "#FFFFFF",
        fontSize: 54,
        isDefault: false
      },
      {
        name: "ðŸŒ¸ Primavera Floral",
        category: "Estaciones",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJzcHJpbmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmYWY1ZmY7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOWQ1ZmY7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIGZpbGw9InVybCgjc3ByaW5nKSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE1MCIgcj0iMjAiIGZpbGw9IiNmOWExYjgiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjE5MCIgY3k9IjE3MCIgcj0iMTUiIGZpbGw9IiNmYjdhODUiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjIxMCIgY3k9IjE3MCIgcj0iMTUiIGZpbGw9IiNmNmQzYmEiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjkwMCIgY3k9IjQwMCIgcj0iMjUiIGZpbGw9IiNkOGI0ZmUiIG9wYWNpdHk9IjAuNSIvPjxjaXJjbGUgY3g9Ijg4NSIgY3k9IjQyNSIgcj0iMTgiIGZpbGw9IiNjMDg0ZmMiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjkxNSIgY3k9IjQyNSIgcj0iMTgiIGZpbGw9IiNlOWQ1ZmYiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjUwIiByPSIyMiIgZmlsbD0iI2Y5YTFiOCIgb3BhY2l0eT0iMC41NSIvPjxjaXJjbGUgY3g9IjQ1MCIgY3k9IjUwMCIgcj0iMjAiIGZpbGw9IiNmNmQzYmEiIG9wYWNpdHk9IjAuNiIvPjwvc3ZnPg==",
        textPosition: "center",
        textColor: "#7C3AED",
        fontSize: 52,
        isDefault: false
      },
      {
        name: "âœ¨ Minimalista Elegante",
        category: "Minimalista",
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJtaW5pbWFsIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjlmYWZiO3N0b3Atb3BhY2l0eToxIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjNmNGY2O3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjI4IiBmaWxsPSJ1cmwoI21pbmltYWwpIi8+PGxpbmUgeDE9IjEwMCIgeTE9IjEwMCIgeDI9IjExMDAiIHkyPSIxMDAiIHN0cm9rZT0iIzY2N2VlYSIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIwLjMiLz48bGluZSB4MT0iMTAwIiB5MT0iNTI4IiB4Mj0iMTEwMCIgeTI9IjUyOCIgc3Ryb2tlPSIjNjY3ZWVhIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuMyIvPjxyZWN0IHg9IjEwMCIgeT0iMTAwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MjgiIGZpbGw9IiM2NjdlZWEiIG9wYWNpdHk9IjAuMyIvPjxyZWN0IHg9IjEwOTgiIHk9IjEwMCIgd2lkdGg9IjIiIGhlaWdodD0iNDI4IiBmaWxsPSIjNjY3ZWVhIiBvcGFjaXR5PSIwLjMiLz48Y2lyY2xlIGN4PSI2MDAiIGN5PSIzMTQiIHI9IjUiIGZpbGw9IiM2NjdlZWEiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==",
        textPosition: "center",
        textColor: "#1F2937",
        fontSize: 52,
        isDefault: false
      }
    ];

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const templateId = `template_default_${Date.now()}_${i}`;
      
      await db.collection("giftcard_templates").doc(templateId).set({
        templateId,
        storeId,
        name: template.name,
        category: template.category || "General",
        imageUrl: template.imageUrl,
        textPosition: template.textPosition,
        textColor: template.textColor,
        fontSize: template.fontSize,
        isDefault: template.isDefault,
        isSystemTemplate: true,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    console.log(`âœ… ${templates.length} templates predeterminados instalados`);
    return { success: true };
    
  } catch (error) {
    console.error('âŒ Error instalando templates:', error);
    return { success: false, error: error.message };
  }
}

// Helper para registrar webhook de pedidos automÃ¡ticamente
async function registerOrderWebhook(storeId, accessToken) {
  try {
    console.log(`ðŸ”— Registrando webhooks para store ${storeId}...`);
    
    const webhookUrl = "https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/order";
    const webhooks = ['order/created', 'order/paid']; // Ambos eventos
    const results = [];
    
    // Primero verificar webhooks existentes
    const listResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/webhooks`, {
      method: "GET",
      headers: {
        "Authentication": `bearer ${accessToken}`,
        "User-Agent": "GlowLab (info@techdi.com.ar)"
      }
    });

    let existingWebhooks = [];
    if (listResponse.ok) {
      existingWebhooks = await listResponse.json();
    }

    // Crear cada webhook si no existe
    for (const event of webhooks) {
      const alreadyExists = existingWebhooks.some(wh => 
        wh.url === webhookUrl && wh.event === event
      );

      if (alreadyExists) {
        console.log(`âœ… Webhook ${event} ya existe para store ${storeId}`);
        results.push({ event, success: true, message: "Already exists" });
        continue;
      }

      // Crear el webhook
      const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/webhooks`, {
        method: "POST",
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "GlowLab (info@techdi.com.ar)",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: webhookUrl,
          event: event
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`âŒ Error registrando webhook ${event}: ${response.status} - ${errorData}`);
        results.push({ event, success: false, error: errorData });
      } else {
        const webhook = await response.json();
        console.log(`âœ… Webhook ${event} registrado exitosamente:`, webhook.id);
        results.push({ event, success: true, webhookId: webhook.id });
      }
    }
    
    return { success: true, results };
    
  } catch (error) {
    console.error("âŒ Error al registrar webhook:", error);
    return { success: false, error: error.message };
  }
}

// Helper para enviar email de gift card
async function sendGiftCardEmail(recipientEmail, code, amount, storeName, expiresAt) {
  try {
    console.log(`ðŸ“§ Enviando gift card a ${recipientEmail}`);
    
    const expiryText = expiresAt ? 
      `VÃ¡lida hasta: ${new Date(expiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}` : 
      'Sin vencimiento';
    
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 !important; }
      .header h1 { font-size: 24px !important; }
      .code { font-size: 24px !important; }
      .amount { font-size: 32px !important; }
      .button { padding: 12px 25px !important; font-size: 14px !important; }
      .content { padding: 25px 20px !important; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; }
    .wrapper { width: 100%; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 50px 40px; text-align: center; position: relative; }
    .header-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%); }
    .header-content { position: relative; }
    .emoji { font-size: 48px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header p { margin: 15px 0 0; font-size: 18px; opacity: 0.95; }
    .content { padding: 40px; }
    .gift-code { background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%); border: 2px solid #667eea; border-radius: 16px; padding: 30px; margin-bottom: 25px; text-align: center; }
    .code-label { margin: 0 0 12px; color: #4b5563; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
    .code-box { background: white; padding: 18px 25px; border-radius: 12px; margin: 0 auto 20px; display: inline-block; box-shadow: inset 0 2px 8px rgba(0,0,0,0.06); }
    .code { margin: 0; color: #1f2937; font-size: 32px; font-weight: 800; letter-spacing: 3px; font-family: 'Courier New', Courier, monospace; }
    .divider { height: 2px; background: linear-gradient(90deg, transparent, #667eea, transparent); margin: 25px 0; }
    .amount-label { margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 600; }
    .amount { margin: 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 42px; font-weight: 800; }
    .instructions { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 14px; padding: 20px 25px; margin-bottom: 30px; position: relative; overflow: hidden; }
    .instructions-bg { position: absolute; right: -20px; top: -20px; font-size: 80px; opacity: 0.15; }
    .instructions-content { position: relative; }
    .instructions h3 { margin: 0 0 10px; color: #78350f; font-size: 15px; font-weight: 700; }
    .instructions p { margin: 0; color: #92400e; font-size: 14px; line-height: 1.6; }
    .cta-wrapper { text-align: center; margin-bottom: 15px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 45px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); }
    .info { text-align: center; margin: 0; color: #9ca3af; font-size: 13px; }
    .footer { background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 30px 40px; border-top: 2px solid #e5e7eb; text-align: center; }
    .footer p { margin: 0 0 10px; color: #4b5563; font-size: 14px; }
    .footer .store-name { font-weight: 600; }
    .footer .validity { color: #6b7280; font-size: 13px; margin-bottom: 15px; }
    .footer-divider { height: 1px; background: linear-gradient(90deg, transparent, #d1d5db, transparent); margin: 15px 0; }
    .footer .credits { color: #9ca3af; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <table role="presentation" class="wrapper" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td class="header">
              <div class="header-bg"></div>
              <div class="header-content">
                <div class="emoji">🎁</div>
                <h1>Â¡Felicitaciones!</h1>
                <p>Has recibido una Gift Card</p>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <div class="gift-code">
                <p class="code-label">Tu cÃ³digo Ãºnico</p>
                <div class="code-box">
                  <p class="code">${code}</p>
                </div>
                <div class="divider"></div>
                <p class="amount-label">Saldo disponible</p>
                <p class="amount">$${amount.toLocaleString('es-AR')}</p>
              </div>
              
              <div class="instructions">
                <div class="instructions-bg">ðŸ’¡</div>
                <div class="instructions-content">
                  <h3>âœ¨ CÃ³mo usar tu gift card</h3>
                  <p>IngresÃ¡ el cÃ³digo <strong>${code}</strong> al momento de pagar en <strong>${storeName}</strong> y el descuento se aplicarÃ¡ automÃ¡ticamente.</p>
                </div>
              </div>
              
              <div class="cta-wrapper">
                <a href="https://tutienda.mitiendanube.com" class="button">Ir a la tienda â†’</a>
              </div>
              
              <p class="info">ðŸ”’ Este cÃ³digo es Ãºnico y personal</p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p class="store-name">${storeName}</p>
              <p class="validity">${expiryText}</p>
              <div class="footer-divider"></div>
              <p class="credits">
                Â¿Problemas con tu gift card? ContactÃ¡ a la tienda directamente.<br/>
                <span style="color: #6b7280;">Powered by GlowLab âœ¨</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    // Enviar email con SendGrid
    if (!SENDGRID_API_KEY) {
      console.warn('âš ï¸ SendGrid API key no configurada, solo logueando');
      console.log(`âœ… Email preparado para ${recipientEmail}`);
      console.log(`   CÃ³digo: ${code}`);
      console.log(`   Monto: $${amount}`);
      return { success: true, note: 'Email not sent - API key missing' };
    }
    
    try {
      const msg = {
        to: recipientEmail,
        from: {
          email: 'info@techdi.com.ar',
          name: storeName || 'GlowLab'
        },
        subject: `🎁 Tu Gift Card de $${amount.toLocaleString('es-AR')} estÃ¡ lista`,
        html: emailHTML,
        text: `Tu cÃ³digo de Gift Card es: ${code}\n\nMonto: $${amount}\n${expiryText}\n\nUsalo en cualquier compra ingresÃ¡ndolo en el campo de cupÃ³n de descuento.`
      };
      
      await sgMail.send(msg);
      console.log(`âœ… Email enviado exitosamente a ${recipientEmail}`);
      return { success: true, emailSent: true };
      
    } catch (emailError) {
      console.error('âŒ Error enviando email con SendGrid:', emailError);
      // No fallar el proceso por error de email
      return { success: true, emailSent: false, error: emailError.message };
    }
  } catch (error) {
    console.error('âŒ Error enviando email:', error);
    return { success: false, error: error.message };
  }
}

// Helper para generar imagen de gift card con Canvas
async function generateGiftCardImage(templateImageUrl, amount, textPosition = "center", textColor = "#FFFFFF", fontSize = 60) {
  try {
    console.log(`ðŸŽ¨ Generando imagen de gift card con $${amount}...`);
    
    // Cargar imagen del template
    const image = await loadImage(templateImageUrl);
    
    // Crear canvas con las mismas dimensiones
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Dibujar imagen de fondo
    ctx.drawImage(image, 0, 0);
    
    // Configurar texto
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Agregar sombra para mejor legibilidad
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Determinar posiciÃ³n Y segÃºn configuraciÃ³n
    let yPosition;
    if (textPosition === 'top') {
      yPosition = image.height * 0.25;
    } else if (textPosition === 'bottom') {
      yPosition = image.height * 0.75;
    } else {
      yPosition = image.height / 2;
    }
    
    // Dibujar el monto
    const text = `$${amount.toLocaleString('es-AR')}`;
    ctx.fillText(text, image.width / 2, yPosition);
    
    // Convertir a buffer
    const buffer = canvas.toBuffer('image/png');
    
    console.log(`âœ… Imagen generada: ${buffer.length} bytes`);
    return buffer;
    
  } catch (error) {
    console.error('âŒ Error generando imagen:', error);
    throw error;
  }
}

// Helper para subir imagen a Firebase Storage y obtener URL pÃºblica
async function uploadGiftCardImage(imageBuffer, storeId, productId) {
  try {
    const filename = `giftcards/${storeId}/${productId}_${Date.now()}.png`;
    const file = bucket.file(filename);
    
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          storeId,
          productId,
          generatedAt: new Date().toISOString()
        }
      }
    });
    
    // Hacer el archivo pÃºblico
    await file.makePublic();
    
    // Obtener URL pÃºblica
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    console.log(`âœ… Imagen subida: ${publicUrl}`);
    return publicUrl;
    
  } catch (error) {
    console.error('âŒ Error subiendo imagen:', error);
    throw error;
  }
}

// Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ============================================
// CONFIGURACIÃ“N OAUTH TIENDANUBE
// ============================================
const CLIENT_ID = "23137";
const CLIENT_SECRET = "4aa553dd36bcad0848bfbe73f2b7894299b38226beab859d";
const REDIRECT_URI_LOCAL = "http://localhost:5173/callback";
const REDIRECT_URI_PROD = "https://glowlab.techdi.com.ar/callback";

// ============================================
// ENDPOINT: GET /
// ============================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GlowLab API - Running ðŸš€",
    version: "1.0.0",
    endpoints: {
      auth: "/auth/callback",
      store: "/store-info",
      promos: "/promos"
    }
  });
});

// ============================================
// ENDPOINT: GET /auth/callback
// Recibe el CODE de TiendaNube y lo intercambia por access_token
// ============================================
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Missing authorization code"
    });
  }

  try {
    console.log("ðŸ” Intercambiando code por access_token...");

    // Intercambiar code por access_token
    const tokenResponse = await fetch("https://www.tiendanube.com/apps/authorize/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code
      })
    });

    const tokenData = await tokenResponse.json();
    console.log("ðŸ“¦ Respuesta de TiendaNube:", JSON.stringify(tokenData, null, 2));

    if (!tokenData.access_token) {
      console.error("âŒ Error: No se recibiÃ³ access_token. Respuesta completa:", tokenData);
      return res.status(400).json({
        success: false,
        message: "Error during authentication",
        error: "No access_token received",
        details: tokenData
      });
    }

    const { access_token, user_id } = tokenData;
    const storeId = user_id.toString();

    console.log(`âœ… Token obtenido para store: ${storeId}`);

    // Obtener info de la tienda
    const storeResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
      headers: { 
        "Authentication": `bearer ${access_token}`,
        "User-Agent": "GlowLab (info@techdi.com.ar)"
      }
    });

    const storeData = await storeResponse.json();

    // Guardar/actualizar store en Firestore
    await db.collection("promonube_stores").doc(storeId).set({
      storeId,
      storeName: storeData.name?.es || storeData.name || "Sin nombre",
      storeUrl: storeData.url || "",
      email: storeData.email || "",
      accessToken: access_token,
      plan: storeData.plan_name || "free",
      country: storeData.country || "AR",
      currency: storeData.currency || "ARS",
      installedAt: FieldValue.serverTimestamp(),
      lastSync: FieldValue.serverTimestamp(),
      active: true
    }, { merge: true });

    console.log(`âœ… Store guardada: ${storeId}`);

    // Registrar webhook automÃ¡ticamente para recibir notificaciones de pedidos
    await registerOrderWebhook(storeId, access_token);

    // Instalar templates predeterminados para nueva tienda
    await installDefaultTemplates(storeId);

    // Crear suscripciÃ³n trial si no existe
    const subDoc = await db.collection("subscriptions").doc(storeId).get();
    if (!subDoc.exists) {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      await db.collection("subscriptions").doc(storeId).set({
        storeId,
        plan: "trial",
        status: "active",
        price: 0,
        currency: "ARS",
        startDate: FieldValue.serverTimestamp(),
        endDate: admin.firestore.Timestamp.fromDate(trialEndDate),
        trialDays: 30,
        features: {
          maxPromos: 2,
          analytics: false,
          automation: false
        },
        createdAt: FieldValue.serverTimestamp()
      });

      // Crear tambiÃ©n en stores/{storeId}/subscription/current
      // DEMO: Todas las tiendas nuevas tienen acceso completo por 30 dÃ­as
      await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
        plan: 'trial',
        status: "active",
        modules: {
          coupons: true,
          giftCards: true,
          spinWheel: true,
          countdown: true,
          badges: true,
          style: true,
          integrations: true,
          popups: true
        },
        isDemoAccount: true,
        demoStartDate: FieldValue.serverTimestamp(),
        demoEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
        createdAt: FieldValue.serverTimestamp(),
        installedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`âœ… SuscripciÃ³n trial creada para: ${storeId}`);
    }

    // Verificar si ya existe un usuario para esta tienda
    const usersSnapshot = await db.collection("promonube_users")
      .where('storeId', '==', storeId)
      .limit(1)
      .get();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    let redirectUrl;

    if (!usersSnapshot.empty) {
      // Usuario ya existe, redirigir a login
      console.log(`ðŸ‘¤ Usuario ya existe para store ${storeId}, redirigiendo a login`);
      redirectUrl = `${frontendUrl}/#/login?message=${encodeURIComponent('Ya tenÃ©s una cuenta, iniciÃ¡ sesiÃ³n')}`;
    } else {
      // Nueva instalaciÃ³n, redirigir a registro
      console.log(`ðŸ†• Store ${storeId} necesita registro, redirigiendo a register`);
      redirectUrl = `${frontendUrl}/#/?installed=true&store_id=${storeId}`;
    }

    res.redirect(redirectUrl);

  } catch (error) {
    console.error("âŒ Error en OAuth callback:", error);
    res.status(500).json({
      success: false,
      message: "Error during authentication",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /store-info
// Obtiene informaciÃ³n de la tienda
// ============================================
app.get("/store-info", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: "storeId is required"
    });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();

    if (!storeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Store not found"
      });
    }

    const storeData = storeDoc.data();

    // Obtener suscripciÃ³n
    const subDoc = await db.collection("subscriptions").doc(storeId).get();
    const subscription = subDoc.exists ? subDoc.data() : null;

    res.json({
      success: true,
      store: {
        storeId: storeData.storeId,
        storeName: storeData.storeName,
        storeUrl: storeData.storeUrl,
        email: storeData.email,
        plan: storeData.plan,
        country: storeData.country,
        currency: storeData.currency,
        active: storeData.active
      },
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        endDate: subscription.endDate,
        features: subscription.features
      } : null
    });

  } catch (error) {
    console.error("âŒ Error getting store info:", error);
    res.status(500).json({
      success: false,
      message: "Error getting store info",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/auth/register
// Registra un nuevo usuario con email/password
// ============================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, storeId } = req.body;

    if (!email || !password || !name || !storeId) {
      return res.json({ 
        success: false, 
        message: 'Todos los campos son requeridos' 
      });
    }

    // Verificar que la tienda existe
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.json({ 
        success: false, 
        message: 'Tienda no encontrada' 
      });
    }

    // Verificar que no exista otro usuario con ese email
    const existingUser = await db.collection("promonube_users")
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return res.json({ 
        success: false, 
        message: 'El email ya estÃ¡ registrado' 
      });
    }

    // Crear usuario
    const userId = `user_${Date.now()}`;
    const userData = {
      userId,
      storeId,
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp()
    };

    await db.collection("promonube_users").doc(userId).set(userData);

    // Actualizar store con el userId
    await db.collection("promonube_stores").doc(storeId).update({
      userId: userId
    });

    // Obtener datos del store para la respuesta
    const store = storeDoc.data();

    console.log(`âœ… Usuario registrado: ${email} para store ${storeId}`);
    
    res.json({ 
      success: true,
      user: {
        storeId,
        name,
        email: email.toLowerCase()
      },
      store: {
        accessToken: store.accessToken,
        storeName: store.storeName
      },
      message: 'Registro exitoso' 
    });
  } catch (error) {
    console.error('âŒ Register error:', error);
    res.json({ 
      success: false, 
      message: 'Error al registrar usuario' 
    });
  }
});

// ============================================
// ENDPOINT: POST /api/auth/login
// Login con email/password
// ============================================
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ 
        success: false, 
        message: 'Email y contraseÃ±a son requeridos' 
      });
    }

    const usersSnapshot = await db.collection("promonube_users")
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.json({ 
        success: false, 
        message: 'Email o contraseÃ±a incorrectos' 
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.passwordHash !== hashPassword(password)) {
      return res.json({ 
        success: false, 
        message: 'Email o contraseÃ±a incorrectos' 
      });
    }

    // Obtener informaciÃ³n de la tienda
    const storeDoc = await db.collection("promonube_stores").doc(userData.storeId).get();
    const storeData = storeDoc.data();

    // Actualizar Ãºltimo login
    await userDoc.ref.update({ 
      lastLogin: FieldValue.serverTimestamp() 
    });

    console.log(`âœ… Login exitoso: ${email}`);
    
    res.json({ 
      success: true,
      user: {
        storeId: userData.storeId,
        name: userData.name,
        email: userData.email
      },
      store: {
        accessToken: storeData?.accessToken || '',
        storeName: storeData?.storeName || 'Mi Tienda'
      },
      message: 'Login exitoso' 
    });
  } catch (error) {
    console.error('âŒ Login error:', error);
    res.json({ 
      success: false, 
      message: 'Error al iniciar sesiÃ³n' 
    });
  }
});

// ============================================
// ENDPOINT: POST /dev-login
// Login manual para desarrollo local (solo dev)
// ============================================
app.post("/dev-login", async (req, res) => {
  const { accessToken, storeId } = req.body;

  if (!accessToken || !storeId) {
    return res.status(400).json({
      success: false,
      message: "accessToken and storeId are required"
    });
  }

  try {
    console.log("ðŸ” Dev login para store:", storeId);

    // Obtener info de la tienda
    const storeResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
      headers: { 
        "Authentication": `bearer ${accessToken}`,
        "User-Agent": "GlowLab (info@techdi.com.ar)"
      }
    });

    const storeData = await storeResponse.json();

    // Crear/actualizar usuario
    const userId = `user_${Date.now()}`;
    
    await db.collection("promonube_users").doc(userId).set({
      userId,
      email: storeData.email || null,
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`âœ… Usuario creado: ${userId}`);

    // Guardar store
    await db.collection("promonube_stores").doc(storeId).set({
      storeId,
      userId,
      storeName: storeData.name?.es || storeData.name || "Sin nombre",
      storeUrl: storeData.url || "",
      email: storeData.email || "",
      accessToken: accessToken,
      plan: storeData.plan_name || "free",
      country: storeData.country || "AR",
      currency: storeData.currency || "ARS",
      installedAt: FieldValue.serverTimestamp(),
      lastSync: FieldValue.serverTimestamp(),
      active: true
    }, { merge: true });

    console.log(`âœ… Store guardada: ${storeId}`);

    // Crear suscripciÃ³n trial
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    await db.collection("subscriptions").doc(storeId).set({
      storeId,
      userId,
      plan: "trial",
      status: "active",
      price: 0,
      currency: "ARS",
      startDate: FieldValue.serverTimestamp(),
      endDate: admin.firestore.Timestamp.fromDate(trialEndDate),
      trialDays: 30,
      features: {
        maxPromos: 2,
        analytics: false,
        automation: false
      },
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`âœ… SuscripciÃ³n creada: ${storeId}`);

    res.json({
      success: true,
      storeId,
      userId,
      store: {
        storeName: storeData.name?.es || storeData.name,
        storeUrl: storeData.url
      }
    });

  } catch (error) {
    console.error("âŒ Error en dev login:", error);
    res.status(500).json({
      success: false,
      message: "Error during dev login",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/register-missing-webhooks
// Registrar webhooks faltantes manualmente
// ============================================
app.post("/api/register-missing-webhooks", async (req, res) => {
  const { storeId } = req.body;

  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: "storeId is required"
    });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();

    if (!storeDoc.exists) {
      return res.json({
        success: false,
        message: "Store not found"
      });
    }

    const accessToken = storeDoc.data().accessToken;
    const result = await registerOrderWebhook(storeId, accessToken);

    res.json({
      success: true,
      message: "Webhooks registrados",
      result
    });

  } catch (error) {
    console.error("âŒ Error registrando webhooks:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar webhooks",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /validate-token
// Valida que el storeId existe y estÃ¡ activo
// ============================================
app.get("/validate-token", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: "storeId is required"
    });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();

    if (!storeDoc.exists) {
      return res.json({
        success: false,
        valid: false,
        message: "Store not found"
      });
    }

    const storeData = storeDoc.data();

    res.json({
      success: true,
      valid: storeData.active === true,
      store: {
        storeId: storeData.storeId,
        storeName: storeData.storeName
      }
    });

  } catch (error) {
    console.error("âŒ Error validating token:", error);
    res.status(500).json({
      success: false,
      message: "Error validating token"
    });
  }
});

// ============================================
// ENDPOINT: POST /api/install-light-toggle-script
// Instala manualmente el script de Light Toggle en una tienda
// ============================================
app.post("/api/install-light-toggle-script", async (req, res) => {
  const { storeId } = req.body;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    console.log(`ðŸ“¦ Instalando Light Toggle script en tienda ${storeId}...`);

    // Obtener access token
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    const accessToken = storeDoc.data().accessToken;
    const scriptUrl = `${CLOUD_FUNCTION_URL}/style-widget.js?store=${storeId}`;

    // Verificar si ya existe
    const scriptsResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      }
    });

    if (!scriptsResponse.ok) {
      return res.status(500).json({ success: false, message: "Error consultando scripts" });
    }

    const scriptsData = await scriptsResponse.json();
    const scripts = Array.isArray(scriptsData) ? scriptsData : (scriptsData.result || []);
    
    const existingScript = scripts.find(s => 
      s.src && (s.src.includes('style-widget') || s.src.includes('light-toggle'))
    );

    if (existingScript) {
      console.log(`âœ… Script ya existe (ID: ${existingScript.id})`);
      return res.json({ 
        success: true, 
        message: "Script ya instalado",
        scriptId: existingScript.id 
      });
    }

    // Instalar el script usando el archivo estÃ¡tico
    const staticScriptUrl = 'https://pedidos-lett-2.web.app/style-widget-version.js';
    
    const installResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: 'onload',
        src: staticScriptUrl,
        where: 'store'
      })
    });

    if (!installResponse.ok) {
      const errorText = await installResponse.text();
      console.error(`âŒ Error instalando script: ${installResponse.status} - ${errorText}`);
      
      // Si falla, es porque estÃ¡ en modo producciÃ³n
      if (installResponse.status === 422) {
        return res.status(422).json({ 
          success: false, 
          message: "La app estÃ¡ en modo producciÃ³n. Necesitas activar la versiÃ³n v.3 del script desde TiendaNube Partners.",
          instructions: "Ve a https://partners.tiendanube.com â†’ PromoNube â†’ Scripts â†’ Light Toggle â†’ Publicar v.3"
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Error instalando script",
        error: errorText 
      });
    }

    const installedScript = await installResponse.json();
    console.log(`âœ… Script instalado exitosamente: ID ${installedScript.id}`);

    res.json({
      success: true,
      message: "Script instalado correctamente",
      scriptId: installedScript.id
    });

  } catch (error) {
    console.error("âŒ Error en install-light-toggle-script:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ENDPOINT: POST /api/coupons/create
// Crear cupÃ³n individual
// ============================================
app.post("/api/coupons/create", async (req, res) => {
  const { storeId, code, type, value, minAmount, maxDiscount, startDate, endDate, maxUses, description, restrictedEmail, freeProductId, freeProductName } = req.body;

  if (!storeId || !code || !type || !value) {
    return res.json({
      success: false,
      message: "Faltan campos requeridos: storeId, code, type, value"
    });
  }

  try {
    // Verificar que la tienda existe
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.json({ success: false, message: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    // Crear cupÃ³n en TiendaNube
    const couponData = {
      code: code.toUpperCase(),
      type: type, // "percentage" o "absolute"
      value: type === "percentage" ? value : value.toString(),
      valid: true,
      start_date: startDate || null,
      end_date: endDate || null,
      max_uses: maxUses || null,
      min_price: minAmount || null
    };

    const tiendanubeResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/coupons`, {
      method: "POST",
      headers: {
        "Authentication": `bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "GlowLab (info@techdi.com.ar)"
      },
      body: JSON.stringify(couponData)
    });

    const tiendanubeCoupon = await tiendanubeResponse.json();

    if (tiendanubeResponse.status !== 201) {
      console.error("Error creando cupÃ³n en TiendaNube:", tiendanubeCoupon);
      return res.json({
        success: false,
        message: "Error al crear cupÃ³n en TiendaNube",
        error: tiendanubeCoupon
      });
    }

    // Guardar cupÃ³n en Firestore
    const couponId = `coupon_${Date.now()}`;
    await db.collection("promonube_coupons").doc(couponId).set({
      couponId,
      storeId,
      tiendanubeId: tiendanubeCoupon.id,
      code: code.toUpperCase(),
      type,
      value,
      minAmount: minAmount || null,
      maxDiscount: maxDiscount || null,
      startDate: startDate || null,
      endDate: endDate || null,
      maxUses: maxUses || null,
      currentUses: 0,
      description: description || "",
      // Nuevos campos inteligentes
      restrictedEmail: restrictedEmail || null,
      freeProductId: freeProductId || null,
      freeProductName: freeProductName || null,
      active: true,
      createdAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: "CupÃ³n creado exitosamente",
      coupon: {
        couponId,
        code: code.toUpperCase(),
        tiendanubeId: tiendanubeCoupon.id
      }
    });

  } catch (error) {
    console.error("âŒ Error creando cupÃ³n:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear cupÃ³n",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/coupons/create-bulk
// Crear cupones masivos
// ============================================
app.post("/api/coupons/create-bulk", async (req, res) => {
  const { storeId, prefix, quantity, type, value, minAmount, maxDiscount, startDate, endDate, maxUses, description, restrictedEmail, freeProductId, freeProductName } = req.body;

  if (!storeId || !quantity || !type || !value) {
    return res.json({
      success: false,
      message: "Faltan campos requeridos: storeId, quantity, type, value"
    });
  }

  try {
    // Verificar que la tienda existe
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.json({ success: false, message: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    const createdCoupons = [];
    const errors = [];

    // Generar cÃ³digos Ãºnicos
    for (let i = 0; i < quantity; i++) {
      const randomCode = `${prefix || 'PROMO'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      try {
        // Crear en TiendaNube
        const couponData = {
          code: randomCode,
          type: type,
          value: type === "percentage" ? value : value.toString(),
          valid: true,
          start_date: startDate || null,
          end_date: endDate || null,
          max_uses: maxUses || null,
          min_price: minAmount || null
        };

        const tiendanubeResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/coupons`, {
          method: "POST",
          headers: {
            "Authentication": `bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": "GlowLab (info@techdi.com.ar)"
          },
          body: JSON.stringify(couponData)
        });

        const tiendanubeCoupon = await tiendanubeResponse.json();

        if (tiendanubeResponse.status === 201) {
          // Guardar en Firestore
          const couponId = `coupon_${Date.now()}_${i}`;
          await db.collection("promonube_coupons").doc(couponId).set({
            couponId,
            storeId,
            tiendanubeId: tiendanubeCoupon.id,
            code: randomCode,
            type,
            value,
            minAmount: minAmount || null,
            maxDiscount: maxDiscount || null,
            startDate: startDate || null,
            endDate: endDate || null,
            maxUses: maxUses || null,
            currentUses: 0,
            description: description || "",
            // Nuevos campos inteligentes
            restrictedEmail: restrictedEmail || null,
            freeProductId: freeProductId || null,
            freeProductName: freeProductName || null,
            active: true,
            batch: true,
            createdAt: FieldValue.serverTimestamp()
          });

          createdCoupons.push({ code: randomCode, couponId });
        } else {
          errors.push({ code: randomCode, error: tiendanubeCoupon });
        }

        // Pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errors.push({ code: randomCode, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Se crearon ${createdCoupons.length} de ${quantity} cupones`,
      created: createdCoupons.length,
      errors: errors.length,
      coupons: createdCoupons,
      errorDetails: errors
    });

  } catch (error) {
    console.error("âŒ Error creando cupones masivos:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear cupones masivos",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/coupons/import
// Importar cupones desde CSV
// ============================================
app.post("/api/coupons/import", async (req, res) => {
  const { storeId, coupons } = req.body;

  if (!storeId || !coupons || !Array.isArray(coupons)) {
    return res.json({
      success: false,
      message: "Faltan campos requeridos: storeId, coupons (array)"
    });
  }

  try {
    console.log(`ðŸ“¥ Importando ${coupons.length} cupones para store ${storeId}`);

    // Verificar que la tienda existe
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.json({ success: false, message: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    const imported = [];
    const errors = [];

    // Procesar cada cupÃ³n
    for (let i = 0; i < coupons.length; i++) {
      const coupon = coupons[i];

      try {
        // Validar campos
        if (!coupon.code || !coupon.type || !coupon.value) {
          errors.push({ 
            index: i + 1, 
            code: coupon.code || 'N/A', 
            error: 'Faltan campos requeridos' 
          });
          continue;
        }

        // Verificar si el cupÃ³n ya existe en TiendaNube
        const checkResponse = await fetch(
          `https://api.tiendanube.com/v1/${storeId}/coupons?code=${coupon.code}`,
          {
            method: "GET",
            headers: {
              "Authentication": `bearer ${accessToken}`,
              "User-Agent": "GlowLab (info@techdi.com.ar)"
            }
          }
        );

        const existingCoupons = await checkResponse.json();
        
        if (existingCoupons.length > 0) {
          errors.push({ 
            index: i + 1, 
            code: coupon.code, 
            error: 'El cupÃ³n ya existe en TiendaNube' 
          });
          continue;
        }

        // Crear en TiendaNube
        const couponData = {
          code: coupon.code,
          type: coupon.type,
          value: coupon.type === "percentage" ? coupon.value : coupon.value.toString(),
          valid: true,
          start_date: coupon.validFrom || null,
          end_date: coupon.validUntil || null,
          max_uses: coupon.maxUses || null
        };

        const tiendanubeResponse = await fetch(
          `https://api.tiendanube.com/v1/${storeId}/coupons`,
          {
            method: "POST",
            headers: {
              "Authentication": `bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": "GlowLab (info@techdi.com.ar)"
            },
            body: JSON.stringify(couponData)
          }
        );

        const tiendanubeCoupon = await tiendanubeResponse.json();

        if (tiendanubeResponse.status === 201) {
          // Guardar en Firestore
          const couponId = `coupon_import_${Date.now()}_${i}`;
          await db.collection("promonube_coupons").doc(couponId).set({
            couponId,
            storeId,
            tiendanubeId: tiendanubeCoupon.id,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            validFrom: coupon.validFrom || null,
            validUntil: coupon.validUntil || null,
            maxUses: coupon.maxUses || null,
            currentUses: 0,
            description: coupon.description || "",
            active: true,
            imported: true,
            createdAt: FieldValue.serverTimestamp()
          });

          imported.push(coupon.code);
          console.log(`âœ… CupÃ³n importado: ${coupon.code}`);
        } else {
          errors.push({ 
            index: i + 1, 
            code: coupon.code, 
            error: tiendanubeCoupon.description || 'Error en TiendaNube' 
          });
          console.error(`âŒ Error con ${coupon.code}:`, tiendanubeCoupon);
        }

        // Pausa para no saturar la API (300ms entre requests)
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        errors.push({ 
          index: i + 1, 
          code: coupon.code, 
          error: error.message 
        });
        console.error(`âŒ Error procesando ${coupon.code}:`, error);
      }
    }

    console.log(`âœ… ImportaciÃ³n completada: ${imported.length} exitosos, ${errors.length} errores`);

    res.json({
      success: true,
      message: `${imported.length} cupones importados`,
      imported: imported.length,
      errors: errors.length,
      importedCodes: imported,
      errorDetails: errors
    });

  } catch (error) {
    console.error("âŒ Error en importaciÃ³n:", error);
    res.status(500).json({
      success: false,
      message: "Error al importar cupones",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/coupons
// Listar cupones de una tienda
// ============================================
app.get("/api/coupons", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ“‹ Obteniendo cupones para storeId:", storeId);
    
    const couponsSnapshot = await db.collection("promonube_coupons")
      .where("storeId", "==", storeId)
      .get();

    const coupons = [];
    couponsSnapshot.forEach(doc => {
      coupons.push(doc.data());
    });

    console.log("âœ… Cupones encontrados:", coupons.length);

    res.json({
      success: true,
      coupons,
      total: coupons.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo cupones:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener cupones",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/coupons/with-cap
// Obtener solo cupones con tope de descuento (para script de checkout)
// ============================================
app.get("/api/coupons/with-cap", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("âš¡ Obteniendo cupones con tope para storeId:", storeId);
    
    const couponsSnapshot = await db.collection("promonube_coupons")
      .where("storeId", "==", storeId)
      .where("active", "==", true)
      .get();

    const cuponesConTope = [];
    couponsSnapshot.forEach(doc => {
      const data = doc.data();
      // Solo incluir cupones porcentuales con maxDiscount
      if (data.type === "percentage" && data.maxDiscount) {
        cuponesConTope.push({
          code: data.code,
          type: data.type,
          value: data.value,
          maxDiscount: data.maxDiscount,
          minAmount: data.minAmount || 0
        });
      }
    });

    console.log(`âœ… Cupones con tope encontrados: ${cuponesConTope.length}`);

    // Permitir CORS para que el checkout pueda acceder
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.json({
      success: true,
      coupons: cuponesConTope,
      total: cuponesConTope.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo cupones con tope:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener cupones",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: PATCH /api/coupons/:couponId/toggle
// Activar/Desactivar cupÃ³n
// ============================================
app.patch("/api/coupons/:couponId/toggle", async (req, res) => {
  const { couponId } = req.params;
  const { storeId } = req.body;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ”„ Cambiando estado de cupÃ³n:", couponId);

    // Obtener cupÃ³n actual
    const couponDoc = await db.collection("promonube_coupons").doc(couponId).get();
    
    if (!couponDoc.exists) {
      return res.json({
        success: false,
        message: "CupÃ³n no encontrado"
      });
    }

    const couponData = couponDoc.data();
    const newStatus = !couponData.active;

    // Actualizar en TiendaNube
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    const accessToken = storeDoc.data().accessToken;

    const tiendanubeResponse = await fetch(
      `https://api.tiendanube.com/v1/${storeId}/coupons/${couponData.tiendanubeId}`,
      {
        method: "PUT",
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "GlowLab (info@techdi.com.ar)"
        },
        body: JSON.stringify({
          valid: newStatus
        })
      }
    );

    if (!tiendanubeResponse.ok) {
      throw new Error("Error al actualizar en TiendaNube");
    }

    // Actualizar en Firestore
    await db.collection("promonube_coupons").doc(couponId).update({
      active: newStatus,
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log("âœ… Estado actualizado:", newStatus ? "Activo" : "Inactivo");

    res.json({
      success: true,
      message: `CupÃ³n ${newStatus ? 'activado' : 'desactivado'} correctamente`,
      active: newStatus
    });

  } catch (error) {
    console.error("âŒ Error cambiando estado:", error);
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado del cupÃ³n",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: DELETE /api/coupons/:couponId
// Eliminar cupÃ³n
// ============================================
app.delete("/api/coupons/:couponId", async (req, res) => {
  const { couponId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ—‘ï¸ Eliminando cupÃ³n:", couponId);

    // Obtener cupÃ³n
    const couponDoc = await db.collection("promonube_coupons").doc(couponId).get();
    
    if (!couponDoc.exists) {
      return res.json({
        success: false,
        message: "CupÃ³n no encontrado"
      });
    }

    const couponData = couponDoc.data();

    // Eliminar de TiendaNube
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    const accessToken = storeDoc.data().accessToken;

    const tiendanubeResponse = await fetch(
      `https://api.tiendanube.com/v1/${storeId}/coupons/${couponData.tiendanubeId}`,
      {
        method: "DELETE",
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "GlowLab (info@techdi.com.ar)"
        }
      }
    );

    if (!tiendanubeResponse.ok && tiendanubeResponse.status !== 404) {
      throw new Error("Error al eliminar de TiendaNube");
    }

    // Eliminar de Firestore
    await db.collection("promonube_coupons").doc(couponId).delete();

    console.log("âœ… CupÃ³n eliminado correctamente");

    res.json({
      success: true,
      message: "CupÃ³n eliminado correctamente"
    });

  } catch (error) {
    console.error("âŒ Error eliminando cupÃ³n:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar cupÃ³n",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/coupons/:couponId/usage
// Obtener historial de uso de un cupÃ³n
// ============================================
app.get("/api/coupons/:couponId/usage", async (req, res) => {
  const { couponId } = req.params;

  try {
    console.log("ðŸ“Š Obteniendo historial de uso para cupÃ³n:", couponId);

    // Por ahora devolvemos datos simulados hasta implementar el webhook
    // En el futuro, leeremos de la colecciÃ³n "coupon_usage"
    const usageSnapshot = await db.collection("coupon_usage")
      .where("couponId", "==", couponId)
      .orderBy("usedAt", "desc")
      .get();

    const usage = [];
    usageSnapshot.forEach(doc => {
      usage.push(doc.data());
    });

    console.log("âœ… Historial encontrado:", usage.length, "usos");

    res.json({
      success: true,
      usage,
      total: usage.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo historial de uso:", error);
    
    // Si no existe el Ã­ndice aÃºn, devolver array vacÃ­o
    res.json({
      success: true,
      usage: [],
      total: 0
    });
  }
});

// ============================================
// WEBHOOK: POST /webhook/order-paid
// Recibir notificaciones de pedidos pagados (Cupones + Gift Cards)
// ============================================
app.post("/webhook/order-paid", async (req, res) => {
  try {
    console.log("ðŸ”” Webhook de pedido pagado recibido");
    const order = req.body;

    // ==========================================
    // PARTE 1: DETECTAR GIFT CARDS EN EL PEDIDO
    // ==========================================
    if (order.products && order.products.length > 0) {
      for (const product of order.products) {
        const productName = product.name?.toLowerCase() || '';
        
        // Detectar si el producto es una gift card por el nombre
        if (productName.includes('gift card') || productName.includes('tarjeta regalo')) {
          console.log(`🎁 Gift Card detectada en pedido! Producto: ${product.name}`);
          
          // Buscar metadata del producto
          const productMetadata = await db.collection("giftcard_products")
            .doc(product.product_id.toString())
            .get();
          
          const quantity = product.quantity || 1;
          const baseAmount = productMetadata.exists ? productMetadata.data().amount : parseFloat(product.price);
          
          // Calcular el monto REAL pagado por cada gift card (con descuentos)
          const productSubtotal = parseFloat(product.price) * quantity;
          const productTotal = productSubtotal; // TiendaNube ya incluye descuentos en product.price
          const amountPerCard = productTotal / quantity; // Monto real pagado por unidad
          
          // Prorratear si hay descuento global en el pedido
          let finalAmountPerCard = amountPerCard;
          if (order.discount && parseFloat(order.discount) > 0) {
            const orderSubtotal = parseFloat(order.subtotal) || parseFloat(order.total);
            const orderTotal = parseFloat(order.total);
            const discountRatio = orderTotal / orderSubtotal;
            finalAmountPerCard = amountPerCard * discountRatio;
          }
          
          console.log(`ðŸ’° Monto calculado por gift card: $${finalAmountPerCard.toFixed(2)} (base: $${baseAmount})`);
          
          // Generar un cÃ³digo por cada gift card comprada
          for (let i = 0; i < quantity; i++) {
            const newCode = generateGiftCardCode();
            const newGiftCardId = `gift_${Date.now()}_${i}`;
            
            // Calcular fecha de expiraciÃ³n si existe en metadata
            let expiresAt = null;
            if (productMetadata.exists && productMetadata.data().expiresInDays) {
              expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + productMetadata.data().expiresInDays);
            }

            const newGiftCardData = {
              giftCardId: newGiftCardId,
              storeId: order.store_id?.toString(),
              code: newCode,
              balance: parseFloat(finalAmountPerCard.toFixed(2)),
              initialAmount: parseFloat(finalAmountPerCard.toFixed(2)),
              templateId: productMetadata.exists ? productMetadata.data().templateId : 'default',
              recipientEmail: order.customer?.email || null,
              recipientName: order.customer?.name || null,
              senderName: null,
              message: `Â¡Gracias por tu compra! AquÃ­ estÃ¡ tu Gift Card.`,
              status: 'active',
              tiendanubeProductId: product.product_id,
              isProductBased: true,
              orderId: order.id.toString(),
              orderNumber: order.number,
              expiresAt: expiresAt,
              createdAt: FieldValue.serverTimestamp(),
              sentAt: null,
              lastUsedAt: null,
              usageCount: 0
            };

            await db.collection("promonube_giftcards").doc(newGiftCardId).set(newGiftCardData);
            console.log(`âœ… Gift Card generada: ${newCode} para ${order.customer?.email} - Monto: $${finalAmountPerCard.toFixed(2)}`);

            // Enviar email con el cÃ³digo
            if (order.customer?.email) {
              await sendGiftCardEmail(
                order.customer.email, 
                newCode, 
                finalAmountPerCard,
                order.store?.name || 'Tu tienda',
                expiresAt
              );
              
              // Marcar como enviada
              await db.collection("promonube_giftcards").doc(newGiftCardId).update({
                sentAt: FieldValue.serverTimestamp()
              });
            }
          }
        }
      }
    }

    // ==========================================
    // PARTE 2: TRACKING DE CUPONES (EXISTENTE)
    // ==========================================
    
    // Verificar si el pedido tiene cupÃ³n
    if (!order.coupon || !order.coupon.code) {
      return res.json({ success: true, message: "Procesado correctamente" });
    }

    const couponCode = order.coupon.code.toUpperCase();
    const storeId = order.store_id?.toString();

    console.log("ðŸŽŸï¸ Pedido con cupÃ³n:", couponCode, "| Store:", storeId);

    // Buscar el cupÃ³n en Firestore
    const couponsSnapshot = await db.collection("promonube_coupons")
      .where("storeId", "==", storeId)
      .where("code", "==", couponCode)
      .limit(1)
      .get();

    if (couponsSnapshot.empty) {
      console.log("âš ï¸ CupÃ³n no encontrado en PromoNube");
      return res.json({ success: true, message: "CupÃ³n no gestionado por PromoNube" });
    }

    const couponDoc = couponsSnapshot.docs[0];
    const couponData = couponDoc.data();
    const couponId = couponData.couponId;

    // ðŸ” VALIDACIÃ“N: Email restringido
    let emailAutorizado = true;
    let motivoRechazo = null;

    if (couponData.restrictedEmail) {
      const emailCupon = couponData.restrictedEmail.toLowerCase().trim();
      const emailCliente = (order.customer?.email || '').toLowerCase().trim();

      if (emailCliente !== emailCupon) {
        emailAutorizado = false;
        motivoRechazo = `CupÃ³n exclusivo para ${couponData.restrictedEmail}. Usado por: ${emailCliente}`;
        console.log(`âš ï¸ USO NO AUTORIZADO - ${motivoRechazo}`);
      }
    }

    // ðŸŽ¯ VALIDACIÃ“N: Tope de descuento excedido
    let topeExcedido = false;
    let descuentoEsperado = parseFloat(order.coupon.value || 0);

    if (couponData.type === "percentage" && couponData.maxDiscount) {
      const descuentoCalculado = (parseFloat(order.total) * couponData.value) / 100;
      if (descuentoCalculado > couponData.maxDiscount) {
        topeExcedido = true;
        descuentoEsperado = couponData.maxDiscount;
        console.log(`âš ï¸ TOPE EXCEDIDO - Esperado: $${descuentoEsperado}, Aplicado: $${order.coupon.value}`);
      }
    }

    // Registrar el uso (con flags de validaciÃ³n)
    const usageId = `${couponId}_${order.id}`;
    await db.collection("coupon_usage").doc(usageId).set({
      couponId,
      couponCode,
      storeId,
      orderId: order.id.toString(),
      orderNumber: order.number,
      customerEmail: order.customer?.email || null,
      customerName: order.customer?.name || null,
      orderTotal: parseFloat(order.total),
      discountAmount: parseFloat(order.coupon.value || 0),
      // ðŸ†• Campos de validaciÃ³n
      emailAutorizado: emailAutorizado,
      motivoRechazo: motivoRechazo,
      topeExcedido: topeExcedido,
      descuentoEsperado: topeExcedido ? descuentoEsperado : null,
      requiereRevision: !emailAutorizado || topeExcedido,
      usedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    });

    // Actualizar contador de usos
    await db.collection("promonube_coupons").doc(couponDoc.id).update({
      currentUses: FieldValue.increment(1),
      lastUsedAt: FieldValue.serverTimestamp(),
      ...(couponData.source === 'spin_wheel' ? { used: true, usedAt: FieldValue.serverTimestamp() } : {})
    });

    // Si es cupón de ruleta, marcar spin_wheel_results como usado
    if (couponData.source === 'spin_wheel' && couponCode) {
      const spinResultsQuery = await db.collection('spin_wheel_results')
        .where('couponCode', '==', couponCode)
        .limit(1)
        .get();
      if (!spinResultsQuery.empty) {
        await spinResultsQuery.docs[0].ref.update({ couponUsed: true });
      }
    }

    console.log("✅ Uso de cupón registrado:", usageId);

    res.json({
      success: true,
      message: "Procesado correctamente"
    });

  } catch (error) {
    console.error("âŒ Error en webhook de pedido:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/promotions/create
// Crear promociÃ³n avanzada
// ============================================
app.post("/api/promotions/create", async (req, res) => {
  const {
    storeId,
    name,
    type,
    description,
    startDate,
    endDate,
    active,
    // Buy X Pay Y
    buyQuantity,
    payQuantity,
    // Discounts
    discountType,
    discountValue,
    maxDiscount,
    // Progressive
    progressiveRules,
    // Cross Selling
    crossSellingDiscount,
    // Apply To
    applyTo,
    minPurchaseAmount
  } = req.body;

  if (!storeId || !name || !type) {
    return res.json({
      success: false,
      message: "storeId, name y type son requeridos"
    });
  }

  try {
    console.log("🎁 Creando promociÃ³n:", type, "para tienda:", storeId);

    // Obtener access token
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.json({
        success: false,
        message: "Tienda no encontrada"
      });
    }

    const accessToken = storeDoc.data().accessToken;
    const promotionId = `promo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Preparar datos para TiendaNube segÃºn el tipo de promociÃ³n
    let tiendanubeData = {};
    let tiendanubeEndpoint = "";
    let tiendanubePromotionId = null;

    switch(type) {
      case 'buy_x_pay_y':
        // Por ahora guardamos en Firestore
        // TiendaNube puede requerir configuraciÃ³n adicional
        console.log("ðŸ’¾ Guardando promociÃ³n Buy X Pay Y en Firestore");
        break;

      case 'price_discount':
        // Intentar crear como cupÃ³n automÃ¡tico con descuento
        tiendanubeEndpoint = `https://api.tiendanube.com/v1/${storeId}/coupons`;
        const autoCode = `PROMO-${Date.now().toString().slice(-6)}`;
        tiendanubeData = {
          code: autoCode,
          type: discountType === 'percentage' ? 'percentage' : 'absolute',
          value: discountType === 'percentage' ? parseFloat(discountValue) : parseFloat(discountValue).toString(),
          valid: active !== false,
          start_date: startDate || null,
          end_date: endDate || null,
          max_uses: null
        };
        break;

      case 'progressive_discount':
        // Guardar en Firestore - requiere lÃ³gica personalizada
        console.log("ðŸ’¾ Guardando promociÃ³n progresiva en Firestore");
        break;

      case 'cart_discount':
        // Crear como cupÃ³n automÃ¡tico
        tiendanubeEndpoint = `https://api.tiendanube.com/v1/${storeId}/coupons`;
        const cartCode = `AUTO-${Date.now().toString().slice(-6)}`;
        tiendanubeData = {
          code: cartCode,
          type: discountType === 'percentage' ? 'percentage' : 'absolute',
          value: discountType === 'percentage' ? parseFloat(discountValue) : parseFloat(discountValue).toString(),
          valid: active !== false,
          start_date: startDate || null,
          end_date: endDate || null,
          min_price: minPurchaseAmount ? parseFloat(minPurchaseAmount) : null
        };
        break;

      case 'cross_selling':
        // Cross selling - Guardar solo en Firestore
        console.log("ðŸ’¾ Guardando promociÃ³n cross-selling en Firestore");
        break;

      default:
        return res.json({
          success: false,
          message: "Tipo de promociÃ³n no soportado"
        });
    }

    // Crear en TiendaNube (si aplica)
    if (tiendanubeEndpoint && Object.keys(tiendanubeData).length > 0) {
      try {
        console.log("ðŸ“¤ Enviando a TiendaNube:", tiendanubeEndpoint);
        console.log("ðŸ“¦ Datos:", JSON.stringify(tiendanubeData, null, 2));
        
        const tiendanubeResponse = await fetch(tiendanubeEndpoint, {
          method: "POST",
          headers: {
            "Authentication": `bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": "GlowLab (info@techdi.com.ar)"
          },
          body: JSON.stringify(tiendanubeData)
        });

        if (!tiendanubeResponse.ok) {
          const errorText = await tiendanubeResponse.text();
          console.error("âŒ Error de TiendaNube:", tiendanubeResponse.status, errorText);
          // No fallar completamente, solo guardar en Firestore
          console.log("âš ï¸ Guardando solo en PromoNube sin sincronizar con TiendaNube");
        } else {
          const tiendanubePromotion = await tiendanubeResponse.json();
          tiendanubePromotionId = tiendanubePromotion.id;
          console.log("âœ… PromociÃ³n creada en TiendaNube:", tiendanubePromotionId);
        }
      } catch (apiError) {
        console.error("âš ï¸ Error al conectar con TiendaNube:", apiError.message);
        // Continuar guardando en Firestore
      }
    }

    // Guardar en Firestore
    await db.collection("promonube_promotions").doc(promotionId).set({
      promotionId,
      storeId,
      tiendanubeId: tiendanubePromotionId,
      name,
      type,
      description: description || "",
      startDate: startDate || null,
      endDate: endDate || null,
      active: active !== false,
      // ConfiguraciÃ³n especÃ­fica
      buyQuantity: buyQuantity || null,
      payQuantity: payQuantity || null,
      discountType: discountType || null,
      discountValue: discountValue || null,
      maxDiscount: maxDiscount || null,
      progressiveRules: progressiveRules || null,
      crossSellingDiscount: crossSellingDiscount || null,
      applyTo: applyTo || 'all_products',
      minPurchaseAmount: minPurchaseAmount || null,
      // Metadata
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log("âœ… PromociÃ³n guardada en Firestore:", promotionId);

    res.json({
      success: true,
      message: "PromociÃ³n creada exitosamente",
      promotionId,
      tiendanubeId: tiendanubePromotionId
    });

  } catch (error) {
    console.error("âŒ Error creando promociÃ³n:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear promociÃ³n",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/promotions
// Listar promociones de una tienda
// ============================================
app.get("/api/promotions", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ“‹ Obteniendo promociones para storeId:", storeId);

    const promotionsSnapshot = await db.collection("promonube_promotions")
      .where("storeId", "==", storeId)
      .get();

    const promotions = [];
    promotionsSnapshot.forEach(doc => {
      promotions.push(doc.data());
    });

    console.log("âœ… Promociones encontradas:", promotions.length);

    res.json({
      success: true,
      promotions,
      total: promotions.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo promociones:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener promociones",
      error: error.message
    });
  }
});

// ============================================
// GIFT CARDS SYSTEM
// ============================================

// Helper: Generar cÃ³digo Ãºnico de gift card
function generateGiftCardCode() {
  const prefix = "GIFT";
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

// ============================================
// ENDPOINT: POST /api/giftcards/create
// Crear nueva gift card y opcionalmente crear producto en TiendaNube
// ============================================
app.post("/api/giftcards/create", async (req, res) => {
  const {
    storeId,
    amount,
    recipientEmail,
    recipientName,
    senderName,
    message,
    templateId,
    expiresInDays,
    publishAsProduct,
    productName,
    productDescription
  } = req.body;

  if (!storeId || !amount) {
    return res.json({
      success: false,
      message: "storeId y amount son requeridos"
    });
  }

  try {
    console.log("🎁 Creando gift card:", { storeId, amount, publishAsProduct });

    // Si es producto, solo crear el producto en TiendaNube
    // Los cÃ³digos se generan cuando alguien compra (vÃ­a webhook)
    if (publishAsProduct) {
      try {
        const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
        if (!storeDoc.exists) {
          return res.json({ success: false, error: "Tienda no encontrada" });
        }

        const accessToken = storeDoc.data().accessToken;
        
        // Generar descripciÃ³n automÃ¡tica con instrucciones
        const expiryText = expiresInDays ? `VÃ¡lida por ${Math.floor(expiresInDays / 30)} meses desde la compra.` : 'Sin vencimiento';
        const autoDescription = productDescription || `
🎁 GIFT CARD POR $${amount.toLocaleString('es-AR')}

La manera perfecta de regalar! ComprÃ¡ esta Gift Card y recibÃ­ un cÃ³digo Ãºnico por email que podrÃ¡s usar o regalar.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ“– CÃ“MO FUNCIONA - PASO A PASO
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

PASO 1: COMPRAR ðŸ›’
â€¢ AgregÃ¡ esta Gift Card al carrito y completÃ¡ tu compra
â€¢ Asegurate de ingresar un email vÃ¡lido en el checkout
â€¢ PagÃ¡ con cualquier mÃ©todo disponible

PASO 2: RECIBIR EL CÃ“DIGO ðŸ“§
â€¢ Inmediatamente despuÃ©s de confirmar tu compra, recibirÃ¡s un email
â€¢ El email contiene tu cÃ³digo Ãºnico de Gift Card
â€¢ GuardÃ¡ ese cÃ³digo en un lugar seguro

PASO 3: USAR O REGALAR ðŸŽ‰
â€¢ Vos podÃ©s usar el cÃ³digo o regalÃ¡rselo a quien quieras
â€¢ El cÃ³digo no tiene tu nombre, es totalmente transferible
â€¢ Ideal para compartir por WhatsApp, email o imprimirlo

PASO 4: CANJEAR EN CUALQUIER COMPRA ðŸ’³
â€¢ Al momento de hacer una compra, ingresÃ¡ el cÃ³digo en el campo de "CupÃ³n de descuento"
â€¢ El descuento se aplicarÃ¡ automÃ¡ticamente
â€¢ Si el total de tu compra es menor al valor de la Gift Card, el saldo restante queda guardado para futuras compras

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
â“ PREGUNTAS FRECUENTES
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Â¿El cÃ³digo tiene el valor del precio que veo aquÃ­?
No necesariamente. El cÃ³digo tendrÃ¡ el valor del monto REAL que pagaste. Si usÃ¡s un descuento (ejemplo: 15% off con transferencia), tu cÃ³digo tendrÃ¡ ese valor final.

ðŸ”¹ Ejemplo: 
   Precio de la Gift Card: $100.000
   PagÃ¡s con 15% descuento: $85.000
   â†’ CÃ³digo que recibÃ­s: $85.000 âœ…

Â¿Puedo usar la Gift Card mÃ¡s de una vez?
SÃ­! Si tu compra es menor al valor del cÃ³digo, el saldo restante queda disponible para usar en futuras compras.

Â¿CuÃ¡ndo vence?
â€¢ ${expiryText}
â€¢ La fecha de vencimiento cuenta desde el momento de la compra, no desde el primer uso

Â¿A quiÃ©n le llega el cÃ³digo?
Al email que ingreses en el checkout. VerificÃ¡ que estÃ© bien escrito!

Â¿Puedo regalÃ¡rselo a otra persona?
SÃ­, totalmente! El cÃ³digo no tiene restricciones. PodÃ©s compartirlo por WhatsApp, email o imprimirlo.

Â¿Se puede combinar con otras promociones?
SÃ­, el cÃ³digo funciona como un cupÃ³n y se puede usar junto con otros descuentos disponibles en la tienda.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸŽ¯ IDEAL PARA
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

âœ… CumpleaÃ±os y celebraciones
âœ… Regalos corporativos
âœ… Cuando no sabÃ©s quÃ© talle o modelo elegir
âœ… Incentivos y premios
âœ… Sorpresas de Ãºltimo momento

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ’¡ TIPS IMPORTANTES
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

âœ“ VerificÃ¡ tu email antes de finalizar la compra
âœ“ RevisÃ¡ tu carpeta de spam si no recibÃ­s el cÃ³digo en 5 minutos
âœ“ GuardÃ¡ el cÃ³digo en un lugar seguro o compartilo inmediatamente
âœ“ El cÃ³digo se puede usar desde cualquier dispositivo

🎁 Â¡El regalo perfecto que siempre queda bien!
        `.trim();
        
        // Obtener datos del template si se especificÃ³ uno
        let imageUrl = "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&h=600&fit=crop";
        
        if (templateId && templateId !== 'default') {
          try {
            const templateDoc = await db.collection("giftcard_templates").doc(templateId).get();
            if (templateDoc.exists) {
              const templateData = templateDoc.data();
              
              // Generar imagen con Canvas (template + monto)
              const imageBuffer = await generateGiftCardImage(
                templateData.imageUrl,
                amount,
                templateData.textPosition || 'center',
                templateData.textColor || '#FFFFFF',
                templateData.fontSize || 60
              );
              
              // Subir a Firebase Storage
              imageUrl = await uploadGiftCardImage(imageBuffer, storeId, `temp_${Date.now()}`);
              console.log(`âœ… Imagen generada y subida: ${imageUrl}`);
            }
          } catch (imgError) {
            console.error("âš ï¸ Error generando imagen, usando imagen por defecto:", imgError);
            // Continuar con imagen por defecto si falla
          }
        }
        
        // Crear producto en TiendaNube
        const productPayload = {
          name: {
            es: productName || `Gift Card $${amount.toLocaleString('es-AR')}`
          },
          description: {
            es: autoDescription
          },
          price: parseFloat(amount),
          published: true,
          categories: [],
          tags: "gift card, regalo, tarjeta regalo",
          images: [{
            src: imageUrl
          }],
          requires_shipping: false,
          free_shipping: false,
          variants: [{
            price: parseFloat(amount),
            stock_management: false,
            stock: null,
            values: [] // TiendaNube requiere este campo aunque estÃ© vacÃ­o
          }],
          attributes: []
        };

        const tnResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/products`, {
          method: 'POST',
          headers: {
            'Authentication': `bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GlowLab (info@techdi.com.ar)'
          },
          body: JSON.stringify(productPayload)
        });

        if (!tnResponse.ok) {
          console.error("âŒ Error creando producto TN:", await tnResponse.text());
          return res.json({ 
            success: false, 
            error: "Error al crear producto en TiendaNube" 
          });
        } else {
          const tnProduct = await tnResponse.json();
          const tiendanubeProductId = tnProduct.id;
          console.log("âœ… Producto TN creado:", tiendanubeProductId);
          
          // Guardar metadata del producto (NO es un cupÃ³n todavÃ­a)
          const productMetadata = {
            productId: tiendanubeProductId,
            storeId,
            amount: parseFloat(amount),
            expiresInDays: expiresInDays || null,
            templateId: templateId || 'default',
            productType: 'giftcard',
            createdAt: FieldValue.serverTimestamp()
          };
          
          await db.collection("giftcard_products").doc(tiendanubeProductId.toString()).set(productMetadata);
          
          return res.json({
            success: true,
            message: "Producto gift card creado exitosamente",
            productId: tiendanubeProductId,
            note: "Los cÃ³digos se generarÃ¡n automÃ¡ticamente cuando alguien compre este producto"
          });
        }
      } catch (error) {
        console.error("âŒ Error al crear producto:", error);
        return res.json({ 
          success: false, 
          error: error.message 
        });
      }
    }

    // Si NO es producto, crear gift card directa (cupÃ³n)
    const code = generateGiftCardCode();
    const giftCardId = `gift_${Date.now()}`;
    
    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const giftCardData = {
      giftCardId,
      storeId,
      code,
      balance: parseFloat(amount),
      initialAmount: parseFloat(amount),
      templateId: templateId || 'default',
      recipientEmail: recipientEmail || null,
      recipientName: recipientName || null,
      senderName: senderName || null,
      message: message || null,
      status: 'active', // active, partially_used, used, expired
      tiendanubeProductId: null, // No viene de producto
      isProductBased: false, // Creada manualmente
      expiresAt: expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: null,
      lastUsedAt: null,
      usageCount: 0
    };

    await db.collection("promonube_giftcards").doc(giftCardId).set(giftCardData);

    console.log("âœ… Gift card creada:", code);

    res.json({
      success: true,
      message: "Gift card creada exitosamente",
      giftCard: {
        giftCardId,
        code,
        amount: parseFloat(amount),
        recipientEmail,
        expiresAt
      }
    });

  } catch (error) {
    console.error("âŒ Error creando gift card:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear gift card",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/giftcards
// Listar gift cards de una tienda
// ============================================
app.get("/api/giftcards", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ“‹ Obteniendo gift cards para storeId:", storeId);

    const snapshot = await db.collection("promonube_giftcards")
      .where("storeId", "==", storeId)
      .where("isProductBased", "==", false) // Solo gift cards manuales, no las de productos
      .get();

    const giftCards = [];
    snapshot.forEach(doc => {
      giftCards.push(doc.data());
    });

    // Ordenar por fecha de creaciÃ³n (mÃ¡s recientes primero)
    giftCards.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    console.log("âœ… Gift cards encontradas:", giftCards.length);

    res.json({
      success: true,
      giftCards,
      total: giftCards.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo gift cards:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener gift cards",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/giftcard-products
// Listar productos de gift cards (no los cÃ³digos)
// ============================================
app.get("/api/giftcard-products", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ›ï¸ Obteniendo productos gift card para storeId:", storeId);

    const snapshot = await db.collection("giftcard_products")
      .where("storeId", "==", storeId)
      .get();

    const products = [];
    snapshot.forEach(doc => {
      products.push(doc.data());
    });

    // Ordenar por fecha de creaciÃ³n
    products.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    console.log("âœ… Productos gift card encontrados:", products.length);

    res.json({
      success: true,
      products,
      total: products.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo productos:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener productos",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: DELETE /api/giftcard-products/:productId
// Eliminar un producto gift card
// ============================================
app.delete("/api/giftcard-products/:productId", async (req, res) => {
  const { productId } = req.params;
  const { storeId } = req.body;

  if (!productId || !storeId) {
    return res.json({
      success: false,
      message: "productId y storeId son requeridos"
    });
  }

  try {
    console.log(`ðŸ—‘ï¸ Eliminando producto gift card: ${productId}`);

    // Eliminar de Firestore
    await db.collection("giftcard_products").doc(productId).delete();

    console.log("âœ… Producto eliminado");

    res.json({
      success: true,
      message: "Producto eliminado exitosamente"
    });

  } catch (error) {
    console.error("âŒ Error eliminando producto:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar producto",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/giftcards/sold
// Listar gift cards vendidas (generadas por compras)
// ============================================
app.get("/api/giftcards/sold", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({
      success: false,
      message: "storeId es requerido"
    });
  }

  try {
    console.log("ðŸ›’ Obteniendo gift cards vendidas para storeId:", storeId);

    const snapshot = await db.collection("promonube_giftcards")
      .where("storeId", "==", storeId)
      .where("isProductBased", "==", true) // Solo las generadas por compras
      .get();

    const giftCards = [];
    snapshot.forEach(doc => {
      giftCards.push(doc.data());
    });

    // Ordenar por fecha de creaciÃ³n
    giftCards.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    console.log("âœ… Gift cards vendidas encontradas:", giftCards.length);

    res.json({
      success: true,
      giftCards,
      total: giftCards.length
    });

  } catch (error) {
    console.error("âŒ Error obteniendo gift cards vendidas:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener gift cards vendidas",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/giftcards/:giftCardId
// Obtener detalle de una gift card por ID
// ============================================
app.get("/api/giftcards/:giftCardId", async (req, res) => {
  const { giftCardId } = req.params;
  const { storeId } = req.query;

  if (!giftCardId || !storeId) {
    return res.status(400).json({
      success: false,
      message: "giftCardId y storeId son requeridos"
    });
  }

  try {
    const giftCardDoc = await db.collection("promonube_giftcards").doc(giftCardId).get();

    if (!giftCardDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Gift card no encontrada"
      });
    }

    const giftCard = giftCardDoc.data();

    // Verificar que pertenece a la tienda
    if (giftCard.storeId !== storeId) {
      return res.status(403).json({
        success: false,
        message: "No autorizado"
      });
    }

    res.json({
      success: true,
      giftCard
    });

  } catch (error) {
    console.error("âŒ Error obteniendo gift card:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/giftcards/:giftCardId/transactions
// Obtener historial de transacciones de una gift card
// ============================================
app.get("/api/giftcards/:giftCardId/transactions", async (req, res) => {
  const { giftCardId } = req.params;
  const { storeId } = req.query;

  if (!giftCardId || !storeId) {
    return res.status(400).json({
      success: false,
      message: "giftCardId y storeId son requeridos"
    });
  }

  try {
    const snapshot = await db.collection("giftcard_transactions")
      .where("giftCardId", "==", giftCardId)
      .where("storeId", "==", storeId)
      .orderBy("createdAt", "desc")
      .get();

    const transactions = [];
    snapshot.forEach(doc => {
      transactions.push(doc.data());
    });

    res.json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error("âŒ Error obteniendo transacciones:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: PUT /api/giftcards/:giftCardId/update-email
// Actualizar email del destinatario de una gift card
// ============================================
app.put("/api/giftcards/:giftCardId/update-email", async (req, res) => {
  const { giftCardId } = req.params;
  const { storeId, recipientEmail } = req.body;

  if (!giftCardId || !storeId || !recipientEmail) {
    return res.status(400).json({
      success: false,
      message: "giftCardId, storeId y recipientEmail son requeridos"
    });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({
      success: false,
      message: "Email invÃ¡lido"
    });
  }

  try {
    const giftCardDoc = await db.collection("promonube_giftcards").doc(giftCardId).get();

    if (!giftCardDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Gift card no encontrada"
      });
    }

    const giftCard = giftCardDoc.data();

    // Verificar que pertenece a la tienda
    if (giftCard.storeId !== storeId) {
      return res.status(403).json({
        success: false,
        message: "No autorizado"
      });
    }

    // Actualizar email
    await giftCardDoc.ref.update({
      recipientEmail: recipientEmail
    });

    console.log(`âœ… Email actualizado para gift card ${giftCard.code}: ${recipientEmail}`);

    res.json({
      success: true,
      message: "Email actualizado correctamente",
      recipientEmail
    });

  } catch (error) {
    console.error("âŒ Error actualizando email:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: PUT /api/giftcards/:giftCardId/mark-used
// Marcar gift card como usada manualmente (saldo = 0, status = used, desactivar cupÃ³n)
// ============================================
app.put("/api/giftcards/:giftCardId/mark-used", async (req, res) => {
  const { giftCardId } = req.params;
  const { storeId } = req.body;

  if (!giftCardId || !storeId) {
    return res.status(400).json({
      success: false,
      message: "giftCardId y storeId son requeridos"
    });
  }

  try {
    const giftCardDoc = await db.collection("promonube_giftcards").doc(giftCardId).get();

    if (!giftCardDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Gift card no encontrada"
      });
    }

    const giftCard = giftCardDoc.data();

    // Verificar que pertenece a la tienda
    if (giftCard.storeId !== storeId) {
      return res.status(403).json({
        success: false,
        message: "No autorizado"
      });
    }

    // Verificar que no estÃ© ya usada
    if (giftCard.status === 'used') {
      return res.status(400).json({
        success: false,
        message: "Esta gift card ya estÃ¡ marcada como usada"
      });
    }

    const balanceBefore = giftCard.balance;
    const amountToRedeem = balanceBefore;

    // Actualizar gift card a usada con saldo 0
    await giftCardDoc.ref.update({
      balance: 0,
      status: 'used',
      lastUsedAt: FieldValue.serverTimestamp(),
      usageCount: FieldValue.increment(1)
    });

    // Registrar transacciÃ³n de uso manual
    const transactionId = `tx_manual_${Date.now()}`;
    await db.collection("giftcard_transactions").doc(transactionId).set({
      transactionId,
      giftCardId: giftCard.giftCardId,
      giftCardCode: giftCard.code,
      storeId: giftCard.storeId,
      type: 'redeem',
      amount: amountToRedeem,
      balanceBefore: balanceBefore,
      balanceAfter: 0,
      method: 'manual', // Indicar que fue manual
      createdAt: FieldValue.serverTimestamp(),
      notes: 'Marcada como usada manualmente desde el panel'
    });

    console.log(`âœ… Gift card ${giftCard.code} marcada como usada manualmente`);

    // Desactivar cupÃ³n en TiendaNube si existe
    if (giftCard.tiendanubeCouponId) {
      try {
        const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
        if (storeDoc.exists) {
          const accessToken = storeDoc.data().accessToken;
          
          const couponResponse = await fetch(
            `https://api.tiendanube.com/v1/${storeId}/coupons/${giftCard.tiendanubeCouponId}`,
            {
              method: 'PUT',
              headers: {
                'Authentication': `bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'GlowLab (info@techdi.com.ar)'
              },
              body: JSON.stringify({
                valid: false // Desactivar cupÃ³n
              })
            }
          );

          if (couponResponse.ok) {
            console.log(`âœ… CupÃ³n ${giftCard.code} desactivado en TiendaNube`);
            
            // Actualizar en la colecciÃ³n de cupones tambiÃ©n
            const couponSnapshot = await db.collection("promonube_coupons")
              .where("storeId", "==", storeId)
              .where("code", "==", giftCard.code)
              .limit(1)
              .get();

            if (!couponSnapshot.empty) {
              await couponSnapshot.docs[0].ref.update({
                active: false,
                deactivatedAt: FieldValue.serverTimestamp()
              });
            }
          } else {
            console.warn(`âš ï¸ No se pudo desactivar cupÃ³n en TiendaNube: ${couponResponse.status}`);
          }
        }
      } catch (couponError) {
        console.error('âŒ Error desactivando cupÃ³n:', couponError);
        // No fallar la operaciÃ³n principal por esto
      }
    }

    res.json({
      success: true,
      message: "Gift card marcada como usada y cupÃ³n desactivado",
      giftCard: {
        code: giftCard.code,
        previousBalance: balanceBefore,
        newBalance: 0,
        status: 'used'
      }
    });

  } catch (error) {
    console.error("âŒ Error marcando gift card como usada:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: GET /api/giftcards/:code/balance
// Consultar saldo de una gift card
// ============================================
app.get("/api/giftcards/:code/balance", async (req, res) => {
  const { code } = req.params;

  if (!code) {
    return res.json({
      success: false,
      message: "CÃ³digo es requerido"
    });
  }

  try {
    console.log("ðŸ’³ Consultando saldo de gift card:", code);

    const snapshot = await db.collection("promonube_giftcards")
      .where("code", "==", code.toUpperCase())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: false,
        message: "Gift card no encontrada"
      });
    }

    const giftCard = snapshot.docs[0].data();

    // Verificar si está vencida
    if (giftCard.expiresAt && giftCard.expiresAt.toDate() < new Date()) {
      // Actualizar status en Firestore si todavía no fue marcada como expirada
      if (giftCard.status !== 'expired') {
        await snapshot.docs[0].ref.update({ status: 'expired' });
      }
      return res.json({
        success: false,
        message: "Gift card vencida",
        giftCard: {
          code: giftCard.code,
          status: 'expired',
          expiresAt: giftCard.expiresAt
        }
      });
    }

    // Verificar si estÃ¡ usada
    if (giftCard.balance <= 0) {
      return res.json({
        success: false,
        message: "Gift card sin saldo",
        giftCard: {
          code: giftCard.code,
          balance: 0,
          status: 'used'
        }
      });
    }

    console.log("âœ… Saldo consultado:", giftCard.balance);

    res.json({
      success: true,
      giftCard: {
        code: giftCard.code,
        balance: giftCard.balance,
        initialAmount: giftCard.initialAmount,
        status: giftCard.status,
        expiresAt: giftCard.expiresAt
      }
    });

  } catch (error) {
    console.error("âŒ Error consultando saldo:", error);
    res.status(500).json({
      success: false,
      message: "Error al consultar saldo",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/giftcards/redeem
// Canjear/usar gift card
// ============================================
app.post("/api/giftcards/redeem", async (req, res) => {
  const { code, amount, orderId, storeId } = req.body;

  if (!code || !amount) {
    return res.json({
      success: false,
      message: "code y amount son requeridos"
    });
  }

  try {
    console.log("ðŸ’° Canjeando gift card:", { code, amount });

    const snapshot = await db.collection("promonube_giftcards")
      .where("code", "==", code.toUpperCase())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: false,
        message: "Gift card no encontrada"
      });
    }

    const giftCardDoc = snapshot.docs[0];
    const giftCard = giftCardDoc.data();

    // Validar que pertenece a la tienda (si se envía storeId)
    if (storeId && giftCard.storeId !== storeId) {
      return res.json({ success: false, message: "Gift card no pertenece a esta tienda" });
    }

    // Validaciones
    if (giftCard.expiresAt && giftCard.expiresAt.toDate() < new Date()) {
      if (giftCard.status !== 'expired') {
        await giftCardDoc.ref.update({ status: 'expired' });
      }
      return res.json({
        success: false,
        message: "Gift card vencida"
      });
    }

    if (giftCard.balance <= 0) {
      return res.json({
        success: false,
        message: "Gift card sin saldo disponible"
      });
    }

    const redeemAmount = parseFloat(amount);
    if (redeemAmount > giftCard.balance) {
      return res.json({
        success: false,
        message: `Saldo insuficiente. Disponible: $${giftCard.balance}`
      });
    }

    // Actualizar balance con transacción Firestore (evita doble gasto por requests simultáneos)
    let newBalance, newStatus;
    try {
      await db.runTransaction(async (txn) => {
        const freshDoc = await txn.get(giftCardDoc.ref);
        const freshData = freshDoc.data();

        if (redeemAmount > freshData.balance) {
          const err = new Error(`Saldo insuficiente. Disponible: $${freshData.balance}`);
          err.code = 'INSUFFICIENT_BALANCE';
          throw err;
        }

        newBalance = Math.max(0, parseFloat((freshData.balance - redeemAmount).toFixed(2)));
        newStatus = newBalance <= 0 ? 'used' : 'partially_used';

        txn.update(giftCardDoc.ref, {
          balance: newBalance,
          status: newStatus,
          lastUsedAt: FieldValue.serverTimestamp(),
          usageCount: FieldValue.increment(1)
        });
      });
    } catch (txError) {
      if (txError.code === 'INSUFFICIENT_BALANCE') {
        return res.json({ success: false, message: txError.message });
      }
      throw txError;
    }

    // Registrar transacción
    const transactionId = `tx_${Date.now()}`;
    await db.collection("giftcard_transactions").doc(transactionId).set({
      transactionId,
      giftCardId: giftCard.giftCardId,
      giftCardCode: giftCard.code,
      storeId: giftCard.storeId,
      orderId: orderId || null,
      type: 'redemption',
      amount: redeemAmount,
      balanceBefore: giftCard.balance,
      balanceAfter: newBalance,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log("✅ Gift card canjeada. Nuevo saldo:", newBalance);

    res.json({
      success: true,
      message: "Gift card aplicada exitosamente",
      giftCard: {
        code: giftCard.code,
        amountRedeemed: redeemAmount,
        newBalance: newBalance,
        status: newStatus
      }
    });

  } catch (error) {
    console.error("âŒ Error canjeando gift card:", error);
    res.status(500).json({
      success: false,
      message: "Error al canjear gift card",
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT: POST /api/giftcards/:id/reload
// Recargar saldo a una gift card
// ============================================
app.post("/api/giftcards/:id/reload", async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.json({
      success: false,
      message: "amount es requerido y debe ser mayor a 0"
    });
  }

  try {
    console.log("ðŸ’µ Recargando gift card:", { id, amount });

    const giftCardDoc = await db.collection("promonube_giftcards").doc(id).get();

    if (!giftCardDoc.exists) {
      return res.json({
        success: false,
        message: "Gift card no encontrada"
      });
    }

    const giftCard = giftCardDoc.data();
    const reloadAmount = parseFloat(amount);
    const newBalance = giftCard.balance + reloadAmount;

    await giftCardDoc.ref.update({
      balance: newBalance,
      status: 'active'
    });

    // Registrar transacciÃ³n
    const transactionId = `tx_${Date.now()}`;
    await db.collection("giftcard_transactions").doc(transactionId).set({
      transactionId,
      giftCardId: giftCard.giftCardId,
      giftCardCode: giftCard.code,
      storeId: giftCard.storeId,
      type: 'reload',
      amount: reloadAmount,
      balanceBefore: giftCard.balance,
      balanceAfter: newBalance,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log("âœ… Gift card recargada. Nuevo saldo:", newBalance);

    res.json({
      success: true,
      message: "Gift card recargada exitosamente",
      giftCard: {
        code: giftCard.code,
        amountReloaded: reloadAmount,
        newBalance: newBalance
      }
    });

  } catch (error) {
    console.error("âŒ Error recargando gift card:", error);
    res.status(500).json({
      success: false,
      message: "Error al recargar gift card",
      error: error.message
    });
  }
});

// ============================================
// WEBHOOK: POST /api/webhooks/order
// Recibe notificaciones de TiendaNube cuando se crea/paga una orden
// ============================================
app.post("/api/webhooks/order", async (req, res) => {
  try {
    console.log("ðŸ“¦ Webhook recibido de TiendaNube:", JSON.stringify(req.body, null, 2));
    
    const webhookData = req.body;
    const storeId = webhookData.store_id ? webhookData.store_id.toString() : null;
    const orderId = webhookData.id;
    
    if (!storeId || !orderId) {
      console.error("âŒ No se recibiÃ³ store_id u orderId en el webhook");
      return res.status(400).json({ success: false, message: "Missing store_id or orderId" });
    }

    // Obtener access token de la tienda
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      console.error(`âŒ Store ${storeId} no encontrada en Firestore`);
      return res.status(404).json({ success: false, message: "Store not found" });
    }
    
    const accessToken = storeDoc.data().accessToken;
    
    // Consultar detalles completos de la orden desde TiendaNube API
    console.log(`ðŸ” Consultando orden ${orderId} desde TiendaNube...`);
    const orderResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/orders/${orderId}`, {
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      }
    });
    
    if (!orderResponse.ok) {
      console.error(`âŒ Error consultando orden: ${orderResponse.status}`);
      return res.status(500).json({ success: false, message: "Error fetching order" });
    }
    
    const order = await orderResponse.json();
    console.log(`âœ… Orden obtenida: #${order.number}, payment_status: ${order.payment_status}`);

    // ============================================
    // 1. DETECTAR Y GENERAR GIFT CARDS
    // ============================================
    
    // Verificar si hay productos gift card en la orden
    if (order.products && Array.isArray(order.products)) {
      for (const product of order.products) {
        const productId = product.product_id || product.id;
        
        // âœ… IMPORTANTE: Solo procesar si el producto estÃ¡ registrado como gift card en PromoNube
        const giftCardProduct = await db.collection("giftcard_products")
          .doc(productId.toString())
          .get();
        
        const isGiftCard = giftCardProduct.exists;
        
        if (isGiftCard && order.payment_status === 'paid') {
          console.log(`🎁 Gift Card de PromoNube detectada en orden #${order.number} (Producto ID: ${productId})`);
          
          try {
            // Calcular monto REAL pagado por este producto
            // Si hay descuento general, prorratearlo proporcionalmente
            const productSubtotal = parseFloat(product.price) * product.quantity;
            const orderSubtotal = parseFloat(order.subtotal || order.total);
            const orderTotal = parseFloat(order.total);
            
            // Prorrateo del descuento
            const discountRatio = orderTotal / orderSubtotal;
            const giftCardAmount = Math.round(productSubtotal * discountRatio);
            
            console.log(`ðŸ’° Monto calculado: Precio: $${productSubtotal} | Descuento aplicado | Final: $${giftCardAmount}`);
            
            // Generar cÃ³digo Ãºnico
            const code = generateGiftCardCode();
            const giftCardId = `gift_${Date.now()}_${order.id}_${product.id}`;
            
            // Calcular vencimiento (12 meses por defecto)
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 12);
            
            // Crear gift card en Firestore
            const giftCardData = {
              giftCardId,
              storeId: storeId,
              code,
              balance: giftCardAmount,
              initialAmount: giftCardAmount,
              originalProductPrice: productSubtotal,
              actualAmountPaid: giftCardAmount,
              
              // Info del comprador (recipiente)
              recipientEmail: order.customer?.email || order.contact_email || null,
              recipientName: order.customer?.name || order.contact_name || null,
              
              // Info de la orden
              orderId: order.id.toString(),
              orderNumber: order.number || order.id,
              productId: product.product_id || product.id,
              productName: product.name,
              
              // Estado
              status: 'active',
              isProductBased: true,
              templateId: 'auto-generated',
              
              // Fechas
              expiresAt: expiresAt,
              createdAt: FieldValue.serverTimestamp(),
              sentAt: null,
              lastUsedAt: null,
              usageCount: 0
            };
            
            await db.collection("promonube_giftcards").doc(giftCardId).set(giftCardData);
            console.log(`âœ… Gift Card generada: ${code} por $${giftCardAmount}`);
            
            // Crear cupÃ³n en TiendaNube para que funcione en el checkout
            try {
              const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
              if (storeDoc.exists) {
                const accessToken = storeDoc.data().accessToken;
                
                // Calcular fecha de expiraciÃ³n para el cupÃ³n (mismo que la gift card)
                const expiryDate = new Date(expiresAt);
                const expiryString = expiryDate.toISOString().split('T')[0]; // YYYY-MM-DD
                
                const couponResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/coupons`, {
                  method: 'POST',
                  headers: {
                    'Authentication': `bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'GlowLab (info@techdi.com.ar)'
                  },
                  body: JSON.stringify({
                    code: code,
                    type: 'absolute',
                    value: giftCardAmount.toString(),
                    valid: true,
                    max_uses: 1, // Ãšnico uso
                    end_date: expiryString
                  })
                });
                
                if (couponResponse.ok) {
                  const couponData = await couponResponse.json();
                  console.log(`âœ… CupÃ³n creado en TiendaNube: ${code} (ID: ${couponData.id})`);
                  
                  // Guardar referencia del cupÃ³n en la gift card
                  await db.collection("promonube_giftcards").doc(giftCardId).update({
                    tiendanubeCouponId: couponData.id
                  });
                  
                  // TambiÃ©n guardarlo en la colecciÃ³n de cupones para tracking
                  const couponId = `coupon_giftcard_${Date.now()}`;
                  await db.collection("promonube_coupons").doc(couponId).set({
                    couponId,
                    storeId,
                    tiendanubeId: couponData.id,
                    code: code,
                    type: 'absolute',
                    value: giftCardAmount,
                    maxUses: 1,
                    currentUses: 0,
                    active: true,
                    isGiftCard: true,
                    giftCardId: giftCardId,
                    createdAt: FieldValue.serverTimestamp(),
                    endDate: expiryString
                  });
                  
                } else {
                  const errorText = await couponResponse.text();
                  console.error(`âŒ Error creando cupÃ³n en TiendaNube: ${couponResponse.status} - ${errorText}`);
                }
              }
            } catch (couponError) {
              console.error('âŒ Error al crear cupÃ³n:', couponError);
              // No fallar todo el proceso si falla la creaciÃ³n del cupÃ³n
            }
            
            // Enviar email con el cÃ³digo
            const recipientEmail = order.customer?.email || order.contact_email;
            if (recipientEmail) {
              // Obtener nombre de la tienda
              const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
              const storeName = storeDoc.exists ? storeDoc.data().storeName : 'Nuestra Tienda';
              
              await sendGiftCardEmail(recipientEmail, code, giftCardAmount, storeName, expiresAt);
              
              // Marcar como enviada
              await db.collection("promonube_giftcards").doc(giftCardId).update({
                sentAt: FieldValue.serverTimestamp()
              });
            }
            
          } catch (error) {
            console.error(`âŒ Error generando gift card para orden ${order.id}:`, error);
          }
        }
      }
    }

    // ============================================
    // 2. TRACKEAR USO DE CUPONES
    // ============================================
    
    const couponCode = order.coupon?.code || order.discount_coupon?.code || null;
    
    if (couponCode) {
      console.log(`ðŸŽŸï¸ CupÃ³n detectado: ${couponCode}`);
      
      // Buscar el cupÃ³n en Firestore
      const couponSnapshot = await db.collection("promonube_coupons")
        .where("storeId", "==", storeId)
        .where("code", "==", couponCode)
        .limit(1)
        .get();

      if (!couponSnapshot.empty) {
        const couponDoc = couponSnapshot.docs[0];
        const couponData = couponDoc.data();
        
        // Guardar registro de uso
        const usageId = `usage_${Date.now()}_${order.id}`;
        await db.collection("coupon_usage").doc(usageId).set({
          usageId,
          couponId: couponData.couponId,
          couponCode: couponCode,
          storeId: storeId,
          orderId: order.id.toString(),
          orderNumber: order.number || order.id,
          
          // InformaciÃ³n del cliente
          customerEmail: order.customer?.email || order.contact_email || null,
          customerName: order.customer?.name || order.contact_name || null,
          customerId: order.customer?.id ? order.customer.id.toString() : null,
          
          // InformaciÃ³n de la orden
          subtotal: parseFloat(order.subtotal || 0),
          total: parseFloat(order.total || 0),
          discountValue: parseFloat(order.discount_coupon?.value || order.coupon?.value || 0),
          
          // Metadata
          orderStatus: order.status || 'unknown',
          paymentStatus: order.payment_status || 'unknown',
          createdAt: FieldValue.serverTimestamp(),
          orderDate: order.created_at || new Date().toISOString()
        });

        console.log(`âœ… Registro de uso guardado: ${usageId}`);
        
        // Actualizar contador de usos en el cupón (si existe el campo)
        if (typeof couponData.currentUses === 'number') {
          await db.collection("promonube_coupons").doc(couponDoc.id).update({
            currentUses: FieldValue.increment(1),
            lastUsedAt: FieldValue.serverTimestamp(),
            ...(couponData.source === 'spin_wheel' ? { used: true, usedAt: FieldValue.serverTimestamp() } : {})
          });
          console.log(`📊 Contador de usos actualizado para ${couponCode}`);

          // Si es cupón de ruleta, marcar spin_wheel_results como usado
          if (couponData.source === 'spin_wheel' && couponCode) {
            const spinResultsQuery = await db.collection('spin_wheel_results')
              .where('couponCode', '==', couponCode)
              .limit(1)
              .get();
            if (!spinResultsQuery.empty) {
              await spinResultsQuery.docs[0].ref.update({ couponUsed: true });
            }
          }
        }
      } else {
        console.log(`â„¹ï¸ CupÃ³n ${couponCode} no encontrado en PromoNube (puede ser cupÃ³n nativo de TiendaNube)`);
      }
    }

    // Responder OK a TiendaNube
    res.status(200).json({ success: true, message: "Webhook processed" });
    
  } catch (error) {
    console.error("âŒ Error procesando webhook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WEBHOOKS DE PRIVACIDAD (OBLIGATORIOS GDPR)
// ============================================

// WEBHOOK: Store Redact - cuando una tienda desinstala la app
app.post("/api/webhooks/store/redact", async (req, res) => {
  try {
    console.log("ðŸª Webhook store/redact recibido:", JSON.stringify(req.body, null, 2));
    
    const { store_id } = req.body;
    
    if (!store_id) {
      return res.status(400).json({ success: false, message: "Missing store_id" });
    }

    const storeId = store_id.toString();
    console.log(`ðŸ—‘ï¸ Procesando desinstalaciÃ³n de la tienda ${storeId}...`);

    // Obtener datos de la tienda antes de eliminar para registro histÃ³rico
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    const storeData = storeDoc.exists ? storeDoc.data() : {};
    
    // Guardar registro de desinstalaciÃ³n en colecciÃ³n histÃ³rica
    await db.collection("promonube_uninstalls").add({
      storeId: storeId,
      storeName: storeData.name || storeData.storeName || 'Sin nombre',
      country: storeData.country || 'Unknown',
      installedAt: storeData.installedAt || null,
      uninstalledAt: FieldValue.serverTimestamp(),
      reason: req.body.reason || 'No especificado',
      reasonDetail: req.body.reasonDetail || null,
      plan: storeData.plan || 'free',
      isDemoAccount: storeData.isDemoAccount || false
    });
    
    console.log(`ðŸ“ Registro de desinstalaciÃ³n guardado para ${storeId}`);

    // Eliminar todos los datos de la tienda
    await db.collection("promonube_stores").doc(storeId).delete();
    console.log(`âœ… Store ${storeId} eliminada`);

    // Eliminar cupones de la tienda
    const couponsSnapshot = await db.collection("promonube_coupons")
      .where("storeId", "==", storeId)
      .get();
    
    const deletePromises = [];
    couponsSnapshot.forEach(doc => {
      deletePromises.push(doc.ref.delete());
    });

    // Eliminar gift cards de la tienda
    const giftCardsSnapshot = await db.collection("promonube_giftcards")
      .where("storeId", "==", storeId)
      .get();
    
    giftCardsSnapshot.forEach(doc => {
      deletePromises.push(doc.ref.delete());
    });

    // Eliminar configuraciones de estilo
    const styleConfigSnapshot = await db.collection("promonube_style_config")
      .where("storeId", "==", storeId)
      .get();
    
    styleConfigSnapshot.forEach(doc => {
      deletePromises.push(doc.ref.delete());
    });

    await Promise.all(deletePromises);
    console.log(`âœ… ${deletePromises.length} documentos eliminados para store ${storeId}`);

    res.status(200).json({ success: true, message: "Store data deleted" });
    
  } catch (error) {
    console.error("âŒ Error en webhook store/redact:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WEBHOOK: Customers Redact - cuando un cliente solicita eliminaciÃ³n de datos
app.post("/api/webhooks/customers/redact", async (req, res) => {
  try {
    console.log("ðŸ‘¤ Webhook customers/redact recibido:", JSON.stringify(req.body, null, 2));
    
    const { store_id, customer } = req.body;
    
    if (!store_id || !customer) {
      return res.status(400).json({ success: false, message: "Missing store_id or customer" });
    }

    const storeId = store_id.toString();
    const customerEmail = customer.email;
    const customerId = customer.id?.toString();

    console.log(`ðŸ—‘ï¸ Eliminando datos del cliente ${customerEmail} (ID: ${customerId}) de store ${storeId}...`);

    // Buscar y anonimizar gift cards del cliente
    const giftCardsQuery = db.collection("promonube_giftcards")
      .where("storeId", "==", storeId);
    
    const giftCardsSnapshot = await giftCardsQuery.get();
    
    const anonymizePromises = [];
    giftCardsSnapshot.forEach(doc => {
      const giftCard = doc.data();
      
      // Verificar si pertenece al cliente
      if (giftCard.recipientEmail === customerEmail || 
          giftCard.customerId === customerId ||
          giftCard.customerEmail === customerEmail) {
        
        // Anonimizar datos personales pero mantener el cÃ³digo funcional
        anonymizePromises.push(
          doc.ref.update({
            recipientEmail: `deleted-user-${Date.now()}@anonymized.local`,
            recipientName: '[Usuario Eliminado]',
            customerEmail: `deleted-user-${Date.now()}@anonymized.local`,
            customerName: '[Usuario Eliminado]',
            customerId: null,
            anonymized: true,
            anonymizedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
      }
    });

    // Anonimizar historial de uso de cupones
    const couponUsageQuery = db.collection("promonube_coupon_usage")
      .where("storeId", "==", storeId);
    
    const couponUsageSnapshot = await couponUsageQuery.get();
    
    couponUsageSnapshot.forEach(doc => {
      const usage = doc.data();
      
      if (usage.customerEmail === customerEmail || usage.customerId === customerId) {
        anonymizePromises.push(
          doc.ref.update({
            customerEmail: `deleted-user-${Date.now()}@anonymized.local`,
            customerId: null,
            anonymized: true,
            anonymizedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
      }
    });

    await Promise.all(anonymizePromises);
    console.log(`âœ… ${anonymizePromises.length} registros anonimizados para cliente ${customerEmail}`);

    res.status(200).json({ success: true, message: "Customer data anonymized" });
    
  } catch (error) {
    console.error("âŒ Error en webhook customers/redact:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WEBHOOK: Customers Data Request - cuando un cliente solicita sus datos
app.post("/api/webhooks/customers/data-request", async (req, res) => {
  try {
    console.log("ðŸ“‹ Webhook customers/data-request recibido:", JSON.stringify(req.body, null, 2));
    
    const { store_id, customer } = req.body;
    
    if (!store_id || !customer) {
      return res.status(400).json({ success: false, message: "Missing store_id or customer" });
    }

    const storeId = store_id.toString();
    const customerEmail = customer.email;
    const customerId = customer.id?.toString();

    console.log(`ðŸ“Š Recopilando datos del cliente ${customerEmail} (ID: ${customerId}) de store ${storeId}...`);

    const customerData = {
      customer: {
        email: customerEmail,
        id: customerId,
        name: customer.name
      },
      giftCards: [],
      couponUsage: []
    };

    // Buscar gift cards del cliente
    const giftCardsQuery = db.collection("promonube_giftcards")
      .where("storeId", "==", storeId);
    
    const giftCardsSnapshot = await giftCardsQuery.get();
    
    giftCardsSnapshot.forEach(doc => {
      const giftCard = doc.data();
      
      if (giftCard.recipientEmail === customerEmail || 
          giftCard.customerId === customerId ||
          giftCard.customerEmail === customerEmail) {
        
        customerData.giftCards.push({
          code: giftCard.code,
          balance: giftCard.balance,
          initialAmount: giftCard.initialAmount,
          status: giftCard.status,
          createdAt: giftCard.createdAt,
          expiresAt: giftCard.expiresAt,
          recipientEmail: giftCard.recipientEmail,
          recipientName: giftCard.recipientName
        });
      }
    });

    // Buscar historial de uso de cupones
    const couponUsageQuery = db.collection("promonube_coupon_usage")
      .where("storeId", "==", storeId);
    
    const couponUsageSnapshot = await couponUsageQuery.get();
    
    couponUsageSnapshot.forEach(doc => {
      const usage = doc.data();
      
      if (usage.customerEmail === customerEmail || usage.customerId === customerId) {
        customerData.couponUsage.push({
          couponCode: usage.couponCode,
          usedAt: usage.usedAt,
          orderNumber: usage.orderNumber,
          orderTotal: usage.orderTotal
        });
      }
    });

    console.log(`âœ… Datos recopilados: ${customerData.giftCards.length} gift cards, ${customerData.couponUsage.length} usos de cupones`);

    // Responder con los datos del cliente
    res.status(200).json({ 
      success: true, 
      message: "Customer data retrieved",
      data: customerData 
    });
    
  } catch (error) {
    console.error("âŒ Error en webhook customers/data-request:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TIENDANUBE APP CHARGES (Sistema de Cobros)
// ============================================

// POST /api/subscription/:storeId/create-charge
// Crea un cargo en TiendaNube cuando el usuario selecciona un plan
app.post("/api/subscription/:storeId/create-charge", async (req, res) => {
  const { storeId } = req.params;
  const { planId } = req.body;

  if (!planId) {
    return res.json({ success: false, message: "planId es requerido" });
  }

  try {
    console.log(`ðŸ’° Creando cargo para store ${storeId}, plan: ${planId}`);

    // Obtener store y su currency
    const store = await getStoreById(storeId);
    if (!store || !store.accessToken) {
      return res.json({ success: false, message: "Store no encontrado o sin accessToken" });
    }

    const currency = store.currency || 'ARS';
    
    // Plan Ãºnico PRO (todos los planId mapean a 'pro')
    const plan = PLANS.pro;
    const normalizedPlanId = (planId === 'free') ? 'free' : 'pro';

    // Si es plan free, no crear cargo
    if (normalizedPlanId === 'free') {
      return res.json({ 
        success: false, 
        message: "Plan free no requiere cargo" 
      });
    }

    // Obtener precio segÃºn moneda
    const price = getPlanPrice(currency);

    // NOTA: No necesitÃ¡s crear cargo manualmente si ya lo configuraste en Partner Panel
    // TiendaNube crea el cargo automÃ¡ticamente cuando el usuario instala la app
    // Este endpoint es OPCIONAL, solo si querÃ©s cambiar plan manualmente
    
    // Crear el cargo en TiendaNube (OPCIONAL - solo para cambios manuales)
    const chargeData = {
      type: "recurrent",
      name: `PromoNube Pro - Todo Incluido`,
      price: price.toString(),
      currency: currency,
      trial_days: 7,
      return_url: `https://pedidos-lett-2.web.app/dashboard?charge_status={{status}}&charge_id={{id}}`
    };

    console.log(`ðŸ“ Datos del cargo:`, chargeData);

    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/apps/${process.env.TIENDANUBE_APP_ID}/charges`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${store.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromoNube (info@techdi.com.ar)'
      },
      body: JSON.stringify(chargeData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`âŒ Error creando cargo: ${response.status}`, errorText);
      return res.json({ 
        success: false, 
        message: `Error creando cargo: ${response.status}` 
      });
    }

    const charge = await response.json();
    
    console.log(`âœ… Cargo creado:`, { id: charge.id, status: charge.status });

    // Guardar el cargo pendiente en Firestore
    await db.collection("app_charges").doc(charge.id.toString()).set({
      chargeId: charge.id,
      storeId: storeId,
      planId: planId,
      amount: price,
      currency: currency,
      status: charge.status, // "pending"
      confirmationUrl: charge.confirmation_url,
      createdAt: new Date().toISOString(),
      type: "recurrent"
    });

    // Responder con la URL de confirmaciÃ³n para redirigir al usuario
    res.json({ 
      success: true, 
      chargeId: charge.id,
      confirmationUrl: charge.confirmation_url,
      message: "Redirigir al usuario a confirmation_url para aprobar el cargo"
    });

  } catch (error) {
    console.error("âŒ Error en create-charge:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// WEBHOOK: POST /api/webhooks/app-charge
// TiendaNube envÃ­a este webhook cuando el estado de un cargo cambia
app.post("/api/webhooks/app-charge", async (req, res) => {
  try {
    console.log("ðŸ’³ Webhook app-charge recibido:", JSON.stringify(req.body, null, 2));

    const { id, store_id, status, type } = req.body;

    if (!id || !store_id) {
      return res.status(400).json({ success: false, message: "Missing id or store_id" });
    }

    const chargeId = id.toString();
    const storeId = store_id.toString();

    console.log(`ðŸ’³ Procesando cargo ${chargeId} para store ${storeId}, status: ${status}`);

    // Obtener el cargo guardado
    const chargeDoc = await db.collection("app_charges").doc(chargeId).get();
    
    if (!chargeDoc.exists) {
      console.warn(`âš ï¸ Cargo ${chargeId} no encontrado en Firestore`);
      // Guardar de todas formas
      await db.collection("app_charges").doc(chargeId).set({
        chargeId: chargeId,
        storeId: storeId,
        status: status,
        type: type,
        receivedAt: new Date().toISOString()
      });
    } else {
      // Actualizar status
      await db.collection("app_charges").doc(chargeId).update({
        status: status,
        updatedAt: new Date().toISOString()
      });
    }

    const chargeData = chargeDoc.exists ? chargeDoc.data() : {};
    const planId = chargeData.planId;

    // Si el cargo fue aceptado, activar PLAN PRO con TODOS los mÃ³dulos
    if (status === "accepted") {
      console.log(`âœ… Cargo aceptado, activando Plan PRO (todos los mÃ³dulos) para store ${storeId}`);

      // Activar TODOS los mÃ³dulos
      const modules = {};
      ALL_MODULES.forEach(moduleName => {
        modules[moduleName] = true;
      });

      // Actualizar suscripciÃ³n a PRO
      await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
        plan: 'pro',
        status: "active",
        modules: modules,
        chargeId: chargeId,
        updatedAt: new Date().toISOString(),
        activatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`âœ… Plan PRO activado para store ${storeId}:`, modules);
      
    } else if (status === "rejected" || status === "cancelled") {
      console.log(`âŒ Cargo ${status} - Manteniendo plan FREE para store ${storeId}`);
      
      // Desactivar todos excepto cupones
      await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
        plan: 'free',
        status: "inactive",
        modules: { coupons: true },
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    res.status(200).json({ success: true, message: "Webhook procesado" });

  } catch (error) {
    console.error("âŒ Error en webhook app-charge:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WEBHOOK: POST /api/webhooks/app-suspended
// TiendaNube envÃ­a cuando suspenden el acceso por falta de pago
app.post("/api/webhooks/app-suspended", async (req, res) => {
  try {
    console.log("âš ï¸ Webhook app/suspended recibido:", JSON.stringify(req.body, null, 2));

    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({ success: false, message: "Missing store_id" });
    }

    const storeId = store_id.toString();

    console.log(`âš ï¸ Suspendiendo acceso para store ${storeId} por falta de pago`);

    // Desactivar suscripciÃ³n pero mantener datos
    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      status: "suspended",
      suspendedAt: new Date().toISOString(),
      suspendedReason: "payment_failed",
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Marcar la tienda como suspendida
    await db.collection("promonube_stores").doc(storeId).update({
      suspended: true,
      suspendedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`âœ… Store ${storeId} marcado como suspendido`);

    res.status(200).json({ success: true, message: "Store suspendido" });

  } catch (error) {
    console.error("âŒ Error en webhook app-suspended:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WEBHOOK: POST /api/webhooks/app-resumed
// TiendaNube envÃ­a cuando se restablece el acceso despuÃ©s de pagar
app.post("/api/webhooks/app-resumed", async (req, res) => {
  try {
    console.log("âœ… Webhook app/resumed recibido:", JSON.stringify(req.body, null, 2));

    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({ success: false, message: "Missing store_id" });
    }

    const storeId = store_id.toString();

    console.log(`âœ… Restableciendo acceso para store ${storeId}`);

    // Reactivar suscripciÃ³n
    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      status: "active",
      resumedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Desmarcar suspensiÃ³n
    await db.collection("promonube_stores").doc(storeId).update({
      suspended: false,
      resumedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`âœ… Store ${storeId} reactivado`);

    res.status(200).json({ success: true, message: "Store reactivado" });

  } catch (error) {
    console.error("âŒ Error en webhook app-resumed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/activate-demo
// Activa o EXTIENDE una tienda DEMO con plan PRO completo (sin cobro)
app.post("/api/admin/activate-demo", async (req, res) => {
  const { storeId, expirationDays } = req.body;
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey; // Acepta header o body

  // Validar clave de admin
  const ADMIN_KEY = process.env.ADMIN_KEY || 'demo-secret-2026';
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Acceso denegado" });
  }

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    console.log(`ðŸŽ¯ Activando/Extendiendo tienda DEMO: ${storeId}`);

    // Obtener suscripciÃ³n actual para verificar si ya existe demo
    const currentSub = await db.collection("stores").doc(storeId).collection("subscription").doc("current").get();
    let expirationDate;

    if (expirationDays) {
      // Modo DÃAS: Calcular desde hoy O desde fecha de expiraciÃ³n actual si estÃ¡ vigente
      const days = parseInt(expirationDays);
      const now = new Date();
      
      if (currentSub.exists && currentSub.data().demoExpiresAt) {
        const currentExpiration = new Date(currentSub.data().demoExpiresAt);
        
        // Si la demo actual AÃšN NO expirÃ³, EXTENDER desde esa fecha
        if (currentExpiration > now) {
          expirationDate = new Date(currentExpiration.getTime() + days * 24 * 60 * 60 * 1000);
          console.log(`ðŸ“… Extendiendo demo vigente: ${currentExpiration.toISOString()} + ${days} dÃ­as = ${expirationDate.toISOString()}`);
        } else {
          // Si ya expirÃ³, calcular desde HOY
          expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          console.log(`ðŸ“… Demo expirada. Nueva desde HOY + ${days} dÃ­as = ${expirationDate.toISOString()}`);
        }
      } else {
        // No hay demo previa, calcular desde HOY
        expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        console.log(`ðŸ“… Nueva demo desde HOY + ${days} dÃ­as = ${expirationDate.toISOString()}`);
      }
    } else {
      // Default: 30 dÃ­as desde hoy
      expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Activar TODOS los mÃ³dulos
    const modules = {};
    ALL_MODULES.forEach(moduleName => {
      modules[moduleName] = true;
    });

    // Activar plan PRO DEMO
    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      plan: 'pro',
      status: "demo",
      modules: modules,
      isDemoAccount: true,
      demoExpiresAt: expirationDate.toISOString(),
      activatedBy: "admin",
      activatedAt: currentSub.exists && currentSub.data().activatedAt ? currentSub.data().activatedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Marcar tienda como demo
    await db.collection("promonube_stores").doc(storeId).update({
      isDemoAccount: true,
      demoExpiresAt: expirationDate.toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`âœ… Tienda DEMO actualizada: ${storeId} hasta ${expirationDate.toISOString()}`);

    res.json({ 
      success: true, 
      message: "Tienda DEMO activada/extendida",
      storeId,
      expiresAt: expirationDate.toISOString(),
      modules
    });

  } catch (error) {
    console.error("âŒ Error activando demo:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/deactivate-demo
// Desactiva una tienda DEMO y vuelve a FREE
app.post("/api/admin/deactivate-demo", async (req, res) => {
  const { storeId } = req.body;
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey; // Acepta header o body

  const ADMIN_KEY = process.env.ADMIN_KEY || 'demo-secret-2026';
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Acceso denegado" });
  }

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    console.log(`ðŸ”„ Desactivando tienda DEMO: ${storeId}`);

    // Volver a plan FREE
    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      plan: 'free',
      status: "inactive",
      modules: { coupons: true },
      isDemoAccount: false,
      demoExpiresAt: null,
      deactivatedBy: "admin",
      deactivatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Desmarcar como demo
    await db.collection("promonube_stores").doc(storeId).update({
      isDemoAccount: false,
      demoExpiresAt: null,
      updatedAt: new Date().toISOString()
    });

    console.log(`âœ… Tienda DEMO desactivada: ${storeId}`);

    res.json({ 
      success: true, 
      message: "Tienda DEMO desactivada, vuelto a plan FREE"
    });

  } catch (error) {
    console.error("âŒ Error desactivando demo:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/subscription/:storeId/charges
// Consulta todos los cargos de una tienda
app.get("/api/subscription/:storeId/charges", async (req, res) => {
  const { storeId } = req.params;

  try {
    console.log(`ðŸ“Š Consultando cargos para store ${storeId}`);

    const chargesSnapshot = await db.collection("app_charges")
      .where("storeId", "==", storeId)
      .get();

    const charges = [];
    chargesSnapshot.forEach(doc => {
      charges.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Ordenar por fecha (mÃ¡s reciente primero)
    charges.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    res.json({ 
      success: true, 
      charges,
      total: charges.length,
      active: charges.filter(c => c.status === 'accepted').length,
      pending: charges.filter(c => c.status === 'pending').length
    });

  } catch (error) {
    console.error("âŒ Error consultando cargos:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/subscription/:storeId/status
// Consulta el estado completo de la suscripciÃ³n incluyendo Ãºltimo cargo
app.get("/api/subscription/:storeId/status", async (req, res) => {
  const { storeId } = req.params;

  try {
    console.log(`ðŸ“Š Consultando estado completo para store ${storeId}`);

    // Obtener suscripciÃ³n actual
    const subscriptionDoc = await db.collection("stores")
      .doc(storeId)
      .collection("subscription")
      .doc("current")
      .get();

    const subscription = subscriptionDoc.exists
      ? subscriptionDoc.data()
      : { plan: 'free', status: 'inactive', modules: { coupons: true } };

    // Para planes pro/trial, asegurar que los módulos nuevos estén incluidos
    const storedModules = subscription.modules || {};
    if (subscription.plan === 'trial' || subscription.plan === 'pro' || subscription.isDemoAccount) {
      for (const mod of ALL_MODULES) {
        if (storedModules[mod] === undefined) storedModules[mod] = true;
      }
      subscription.modules = storedModules;
    }

    // Obtener Ãºltimo cargo
    const chargesSnapshot = await db.collection("app_charges")
      .where("storeId", "==", storeId)
      .get();

    const charges = [];
    chargesSnapshot.forEach(doc => {
      charges.push({ id: doc.id, ...doc.data() });
    });

    // Ordenar por fecha
    charges.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    const lastCharge = charges.length > 0 ? charges[0] : null;
    const activeCharge = charges.find(c => c.status === 'accepted');

    res.json({ 
      success: true,
      subscription: {
        ...subscription,
        lastCharge: lastCharge,
        activeCharge: activeCharge,
        hasActivePayment: !!activeCharge,
        totalCharges: charges.length
      }
    });

  } catch (error) {
    console.error("âŒ Error consultando estado:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/subscription/:storeId/charge/:chargeId
// Consulta el detalle de un cargo especÃ­fico
app.get("/api/subscription/:storeId/charge/:chargeId", async (req, res) => {
  const { storeId, chargeId } = req.params;

  try {
    console.log(`ðŸ“Š Consultando cargo ${chargeId} para store ${storeId}`);

    const chargeDoc = await db.collection("app_charges").doc(chargeId).get();

    if (!chargeDoc.exists) {
      return res.json({ 
        success: false, 
        message: "Cargo no encontrado" 
      });
    }

    const chargeData = chargeDoc.data();

    // Verificar que pertenece a la tienda
    if (chargeData.storeId !== storeId) {
      return res.status(403).json({ 
        success: false, 
        message: "Acceso denegado" 
      });
    }

    res.json({ 
      success: true,
      charge: {
        id: chargeDoc.id,
        ...chargeData
      }
    });

  } catch (error) {
    console.error("âŒ Error consultando cargo:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ENDPOINT: POST /api/giftcards/resend-email
// ReenvÃ­a el email de una gift card existente
// ============================================
app.post("/api/giftcards/resend-email", async (req, res) => {
  try {
    const { code, recipientEmail, storeId } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "code es requerido" });
    }

    console.log(`ðŸ“§ Reenviando email para gift card: ${code}`);

    // Buscar la gift card
    const giftCardSnapshot = await db.collection("promonube_giftcards")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (giftCardSnapshot.empty) {
      return res.status(404).json({ success: false, message: "Gift card no encontrada" });
    }

    const giftCardDoc = giftCardSnapshot.docs[0];
    const giftCard = giftCardDoc.data();

    // Validar que la gift card pertenece a la tienda solicitante
    if (storeId && giftCard.storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    // Determinar email destino
    const emailTo = recipientEmail || giftCard.recipientEmail;
    if (!emailTo) {
      return res.status(400).json({ success: false, message: "No hay email destino" });
    }

    // Obtener nombre de la tienda
    const storeDoc = await db.collection("promonube_stores").doc(giftCard.storeId).get();
    const storeName = storeDoc.exists ? storeDoc.data().storeName : 'Nuestra Tienda';

    // Enviar email
    const emailResult = await sendGiftCardEmail(
      emailTo,
      giftCard.code,
      giftCard.balance,
      storeName,
      giftCard.expiresAt ? giftCard.expiresAt.toDate() : null
    );

    if (emailResult.emailSent) {
      // Actualizar fecha de envÃ­o
      await giftCardDoc.ref.update({
        sentAt: FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: "Email reenviado exitosamente",
        emailTo: emailTo
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error al enviar email",
        error: emailResult.error
      });
    }

  } catch (error) {
    console.error("âŒ Error reenviando email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ENDPOINT: GET /api/coupons/usage
// Obtiene el historial de uso de cupones con analytics
// ============================================
app.get("/api/coupons/usage", async (req, res) => {
  try {
    const { storeId, couponId } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId es requerido"
      });
    }

    let query = db.collection("coupon_usage").where("storeId", "==", storeId);
    
    if (couponId) {
      query = query.where("couponId", "==", couponId);
    }

    const usageSnapshot = await query.orderBy("createdAt", "desc").get();
    
    const usage = [];
    let totalDiscount = 0;
    let totalOrders = 0;
    let totalRevenue = 0;

    usageSnapshot.forEach(doc => {
      const data = doc.data();
      usage.push(data);
      totalDiscount += data.discountValue || 0;
      totalOrders += 1;
      totalRevenue += data.total || 0;
    });

    // Calcular stats adicionales
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgDiscount = totalOrders > 0 ? totalDiscount / totalOrders : 0;

    res.json({
      success: true,
      usage,
      stats: {
        totalUses: totalOrders,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        avgDiscount: Math.round(avgDiscount * 100) / 100
      }
    });

  } catch (error) {
    console.error("âŒ Error obteniendo uso de cupones:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener historial de cupones",
      error: error.message
    });
  }
});

// ============================================
// GIFT CARD TEMPLATES
// ============================================

// GET /api/giftcard-templates
app.get("/api/giftcard-templates", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId es requerido" });
  }

  try {
    const snapshot = await db.collection("giftcard_templates")
      .where("storeId", "==", storeId)
      .get();

    const templates = [];
    snapshot.forEach(doc => {
      templates.push(doc.data());
    });

    // Ordenar manualmente por createdAt
    templates.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    res.json({
      success: true,
      templates
    });

  } catch (error) {
    console.error("âŒ Error obteniendo templates:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener templates",
      error: error.message
    });
  }
});

// POST /api/giftcard-templates/create
app.post("/api/giftcard-templates/create", async (req, res) => {
  const {
    storeId,
    name,
    imageBase64,
    textPosition,
    textColor,
    fontSize
  } = req.body;

  if (!storeId || !name || !imageBase64) {
    return res.json({
      success: false,
      message: "storeId, name y imageBase64 son requeridos"
    });
  }

  try {
    const templateId = `template_${Date.now()}`;
    
    // Si es el primer template, marcarlo como default
    const existingSnap = await db.collection("giftcard_templates")
      .where("storeId", "==", storeId)
      .limit(1)
      .get();
    
    const isDefault = existingSnap.empty;

    const templateData = {
      templateId,
      storeId,
      name,
      imageUrl: imageBase64, // Base64 data URL
      textPosition: textPosition || 'center',
      textColor: textColor || '#FFFFFF',
      fontSize: fontSize || 48,
      isDefault: isDefault,
      createdAt: FieldValue.serverTimestamp()
    };

    await db.collection("giftcard_templates").doc(templateId).set(templateData);

    console.log("âœ… Template creado:", templateId);

    res.json({
      success: true,
      message: "Template creado exitosamente",
      templateId,
      template: templateData
    });

  } catch (error) {
    console.error("âŒ Error creando template:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear template",
      error: error.message
    });
  }
});

// PUT /api/giftcard-templates/:templateId/set-default
app.put("/api/giftcard-templates/:templateId/set-default", async (req, res) => {
  const { templateId } = req.params;
  const { storeId } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId es requerido" });
  }

  try {
    // Remover default de todos los templates de esta tienda
    const allTemplates = await db.collection("giftcard_templates")
      .where("storeId", "==", storeId)
      .get();

    const batch = db.batch();
    
    allTemplates.forEach(doc => {
      batch.update(doc.ref, { isDefault: false });
    });

    // Marcar el seleccionado como default
    const templateRef = db.collection("giftcard_templates").doc(templateId);
    batch.update(templateRef, { isDefault: true });

    await batch.commit();

    console.log("âœ… Template marcado como default:", templateId);

    res.json({
      success: true,
      message: "Template establecido como predeterminado"
    });

  } catch (error) {
    console.error("âŒ Error estableciendo default:", error);
    res.status(500).json({
      success: false,
      message: "Error al establecer template predeterminado",
      error: error.message
    });
  }
});

// DELETE /api/giftcard-templates/:templateId
app.delete("/api/giftcard-templates/:templateId", async (req, res) => {
  const { templateId } = req.params;
  const { storeId } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId es requerido" });
  }

  try {
    const templateRef = db.collection("giftcard_templates").doc(templateId);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      return res.json({ success: false, message: "Template no encontrado" });
    }

    const templateData = templateDoc.data();

    // No permitir eliminar el default
    if (templateData.isDefault) {
      return res.json({
        success: false,
        message: "No se puede eliminar el template predeterminado. Establece otro como predeterminado primero."
      });
    }

    await templateRef.delete();

    console.log("âœ… Template eliminado:", templateId);

    res.json({
      success: true,
      message: "Template eliminado exitosamente"
    });

  } catch (error) {
    console.error("âŒ Error eliminando template:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar template",
      error: error.message
    });
  }
});

// POST/GET /api/giftcard-templates/reset - Limpiar todos y crear predeterminados
app.all("/api/giftcard-templates/reset", async (req, res) => {
  try {
    console.log("ðŸ—‘ï¸ Iniciando reset de templates...");
    
    // 1. Borrar TODOS los templates
    const snapshot = await db.collection('giftcard_templates').get();
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (snapshot.size > 0) {
      await batch.commit();
      console.log(`âœ… ${snapshot.size} templates eliminados`);
    }
    
    // 2. Crear 4 templates predeterminados
    const DEFAULT_TEMPLATES = [
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
    
    const createBatch = db.batch();
    for (const template of DEFAULT_TEMPLATES) {
      const templateRef = db.collection('giftcard_templates').doc(template.templateId);
      createBatch.set(templateRef, {
        ...template,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    
    await createBatch.commit();
    console.log("âœ… 4 templates predeterminados creados");
    
    res.json({
      success: true,
      message: `Reset exitoso. ${snapshot.size} templates eliminados, 4 predeterminados creados`,
      deletedCount: snapshot.size,
      createdCount: 4,
      templates: DEFAULT_TEMPLATES.map(t => ({ id: t.templateId, name: t.name, color: t.backgroundColor }))
    });
    
  } catch (error) {
    console.error("âŒ Error en reset de templates:", error);
    res.status(500).json({
      success: false,
      message: "Error al resetear templates",
      error: error.message
    });
  }
});

// ============================================
// SPIN WHEEL (RULETA) ENDPOINTS
// ============================================

// Helper: Obtener store por ID
async function getStoreById(storeId) {
  try {
    const storeSnapshot = await db.collection("promonube_stores")
      .where("storeId", "==", storeId)
      .limit(1)
      .get();
    
    if (storeSnapshot.empty) {
      return null;
    }
    
    const storeDoc = storeSnapshot.docs[0];
    return {
      id: storeDoc.id,
      ...storeDoc.data()
    };
  } catch (error) {
    console.error("Error obteniendo store:", error);
    return null;
  }
}

// Helper: Registrar script tag de countdown en TiendaNube
async function registerCountdownScript(store) {
  try {
    console.log(`ðŸ“œ Registrando script de countdown en store ${store.storeId}`);
    
    const scriptUrl = `https://apipromonube-jlfopowzaq-uc.a.run.app/api/countdown-widget.js?store=${store.storeId}`;
    
    const accessToken = store.accessToken;
    
    if (!accessToken) {
      console.error("âŒ No hay access token para el store:", store.storeId);
      return { success: false, error: 'No access token' };
    }
    
    // Verificar si ya existe un script tag de countdown
    const storeDoc = await db.collection("promonube_stores").doc(store.storeId).get();
    const existingScriptTagId = storeDoc.data()?.countdownScriptTagId;

    if (existingScriptTagId) {
      console.log("âœ… Script tag de countdown ya existe:", existingScriptTagId);
      return { success: true, scriptTagId: existingScriptTagId, alreadyExists: true };
    }

    // Crear script tag en TiendaNube
    const response = await fetch(`https://api.tiendanube.com/v1/${store.storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      },
      body: JSON.stringify({
        src: scriptUrl,
        event: 'onload',
        where: 'store'
      })
    });

    const responseText = await response.text();
    console.log(`ðŸ“¦ TiendaNube countdown response: ${response.status}`, responseText);

    if (response.ok || response.status === 201) {
      const scriptTag = JSON.parse(responseText);
      
      // Guardar el script tag ID en el store
      await db.collection("promonube_stores").doc(store.storeId).update({
        countdownScriptTagId: scriptTag.id,
        countdownScriptUrl: scriptUrl,
        countdownInstalledAt: FieldValue.serverTimestamp()
      });

      console.log("âœ… Script tag de countdown registrado:", scriptTag.id);
      return { success: true, scriptTagId: scriptTag.id };
    } else {
      console.error("âŒ Error registrando countdown script:", response.status, responseText);
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.error("âŒ Error en registerCountdownScript:", error);
    return { success: false, error: error.message };
  }
}

// Helper: Eliminar script tag de countdown de TiendaNube
async function unregisterCountdownScript(store) {
  try {
    console.log(`ðŸ—‘ï¸ Eliminando script de countdown del store ${store.storeId}`);
    
    const storeDoc = await db.collection("promonube_stores").doc(store.storeId).get();
    const scriptTagId = storeDoc.data()?.countdownScriptTagId;

    if (!scriptTagId) {
      console.log("âš ï¸ No hay script tag de countdown para eliminar");
      return { success: true, message: 'No script tag to remove' };
    }

    const accessToken = store.accessToken;

    if (!accessToken) {
      console.error("âŒ No hay access token para eliminar script");
      return { success: false, error: 'No access token' };
    }

    // Eliminar de TiendaNube
    const response = await fetch(`https://api.tiendanube.com/v1/${store.storeId}/scripts/${scriptTagId}`, {
      method: 'DELETE',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      }
    });

    if (response.ok || response.status === 404) {
      // Limpiar el script tag ID del store
      await db.collection("promonube_stores").doc(store.storeId).update({
        countdownScriptTagId: FieldValue.delete(),
        countdownScriptUrl: FieldValue.delete(),
        countdownUninstalledAt: FieldValue.serverTimestamp()
      });

      console.log("âœ… Script tag de countdown eliminado:", scriptTagId);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error("âŒ Error eliminando countdown script:", response.status, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error("âŒ Error en unregisterCountdownScript:", error);
    return { success: false, error: error.message };
  }
}

// Helper: Registrar script tag en TiendaNube
async function registerSpinWheelScript(store, wheelId) {
  try {
    console.log(`ðŸ“œ Registrando script para ruleta ${wheelId} en store ${store.storeId}`);
    
    const scriptUrl = `https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=${wheelId}`;
    
    const accessToken = store.accessToken;
    
    if (!accessToken) {
      console.error("âŒ No hay access token para el store:", store.storeId);
      return { success: false, error: 'No access token' };
    }
    
    // Primero verificar si ya existe un script tag
    const wheelDoc = await db.collection("promonube_spin_wheels").doc(wheelId).get();
    const existingScriptTagId = wheelDoc.data()?.scriptTagId;

    if (existingScriptTagId) {
      console.log("âœ… Script tag ya existe:", existingScriptTagId);
      return { success: true, scriptTagId: existingScriptTagId, alreadyExists: true };
    }

    // Crear script tag en TiendaNube usando la API de Scripts
    // IMPORTANTE: No incluir 'id' en el POST, TiendaNube lo genera automÃ¡ticamente
    const response = await fetch(`https://api.tiendanube.com/v1/${store.storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      },
      body: JSON.stringify({
        src: scriptUrl,
        event: 'onload',
        where: 'store' // Se ejecuta en toda la tienda
      })
    });

    const responseText = await response.text();
    console.log(`ðŸ“¦ TiendaNube response: ${response.status}`, responseText);

    if (response.ok || response.status === 201) {
      const scriptTag = JSON.parse(responseText);
      
      // Guardar el script tag ID en la ruleta
      await db.collection("promonube_spin_wheels").doc(wheelId).update({
        scriptTagId: scriptTag.id,
        scriptUrl: scriptUrl,
        installedAt: FieldValue.serverTimestamp()
      });

      console.log("âœ… Script tag registrado exitosamente:", scriptTag.id);
      return { success: true, scriptTagId: scriptTag.id };
    } else {
      console.error("âŒ Error registrando script tag:", response.status, responseText);
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.error("âŒ Error en registerSpinWheelScript:", error);
    return { success: false, error: error.message };
  }
}

// Helper: Eliminar script tag de TiendaNube
async function unregisterSpinWheelScript(store, wheelId) {
  try {
    console.log(`ðŸ—‘ï¸ Eliminando script para ruleta ${wheelId}`);
    
    const wheelDoc = await db.collection("promonube_spin_wheels").doc(wheelId).get();
    const scriptTagId = wheelDoc.data()?.scriptTagId;

    if (!scriptTagId) {
      console.log("âš ï¸ No hay script tag para eliminar");
      return { success: true, message: 'No script tag to remove' };
    }

    const accessToken = store.accessToken;

    if (!accessToken) {
      console.error("âŒ No hay access token para eliminar script");
      return { success: false, error: 'No access token' };
    }

    // Eliminar de TiendaNube
    const response = await fetch(`https://api.tiendanube.com/v1/${store.storeId}/scripts/${scriptTagId}`, {
      method: 'DELETE',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      }
    });

    if (response.ok || response.status === 404) {
      // Limpiar el script tag ID de la ruleta
      await db.collection("promonube_spin_wheels").doc(wheelId).update({
        scriptTagId: FieldValue.delete(),
        scriptUrl: FieldValue.delete(),
        uninstalledAt: FieldValue.serverTimestamp()
      });

      console.log("âœ… Script tag eliminado:", scriptTagId);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error("âŒ Error eliminando script tag:", response.status, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error("âŒ Error en unregisterSpinWheelScript:", error);
    return { success: false, error: error.message };
  }
}

// GET /api/spin-wheels - Lista todas las ruletas de la tienda
app.get("/api/spin-wheels", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const wheelsSnapshot = await db.collection("promonube_spin_wheels")
      .where("storeId", "==", storeId)
      .get();

    const wheels = wheelsSnapshot.docs.map(doc => ({
      wheelId: doc.id,
      ...doc.data()
    }));

    res.json({ success: true, wheels });
  } catch (error) {
    console.error("Error obteniendo ruletas:", error);
    res.status(500).json({ success: false, message: "Error al obtener ruletas" });
  }
});

// GET /api/spin-wheel/:wheelId - Obtiene configuraciÃ³n de una ruleta
app.get("/api/spin-wheel/:wheelId", async (req, res) => {
  const { wheelId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const wheelDoc = await db.collection("promonube_spin_wheels").doc(wheelId).get();

    if (!wheelDoc.exists) {
      return res.json({ success: false, message: "Ruleta no encontrada" });
    }

    const wheelData = wheelDoc.data();

    if (wheelData.storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    res.json({ success: true, wheel: { wheelId: wheelDoc.id, ...wheelData } });
  } catch (error) {
    console.error("Error obteniendo ruleta:", error);
    res.status(500).json({ success: false, message: "Error al obtener ruleta" });
  }
});

// POST /api/spin-wheel/create - Crea una nueva ruleta
app.post("/api/spin-wheel/create", async (req, res) => {
  const { storeId, ...config } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const wheelId = `wheel_${Date.now()}`;
    
    const wheelData = {
      storeId,
      ...config,
      enabled: config.enabled !== undefined ? config.enabled : config.active,
      active: config.active !== undefined ? config.active : config.enabled,
      totalSpins: 0,
      emailsCollected: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection("promonube_spin_wheels").doc(wheelId).set(wheelData);

    // Si estÃ¡ activada, registrar script tag automÃ¡ticamente
    if (config.enabled || config.active) {
      const store = await getStoreById(storeId);
      if (store) {
        await registerSpinWheelScript(store, wheelId);
      }
    }

    console.log("âœ… Ruleta creada:", wheelId);

    res.json({ success: true, wheelId, wheel: wheelData });
  } catch (error) {
    console.error("Error creando ruleta:", error);
    res.status(500).json({ success: false, message: "Error al crear ruleta" });
  }
});

// PUT /api/spin-wheel/:wheelId - Actualiza configuraciÃ³n de ruleta
app.put("/api/spin-wheel/:wheelId", async (req, res) => {
  const { wheelId } = req.params;
  const { storeId, ...config } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const wheelRef = db.collection("promonube_spin_wheels").doc(wheelId);
    const wheelDoc = await wheelRef.get();

    if (!wheelDoc.exists) {
      return res.json({ success: false, message: "Ruleta no encontrada" });
    }

    if (wheelDoc.data().storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    const oldEnabled = wheelDoc.data().enabled || wheelDoc.data().active;
    const newEnabled = config.enabled !== undefined ? config.enabled : config.active;

    await wheelRef.update({
      ...config,
      enabled: newEnabled,
      active: newEnabled,
      updatedAt: new Date().toISOString()
    });

    // Si cambiÃ³ el estado de enabled, gestionar script tag en TiendaNube
    if (oldEnabled !== newEnabled) {
      const store = await getStoreById(storeId);
      if (store) {
        if (newEnabled) {
          // Activar: Registrar script tag
          const result = await registerSpinWheelScript(store, wheelId);
          if (!result.success) {
            console.error('Error activando script:', result.error);
          }
        } else {
          // Desactivar: Eliminar script tag
          const result = await unregisterSpinWheelScript(store, wheelId);
          if (!result.success) {
            console.error('Error desactivando script:', result.error);
          }
        }
      }
    }

    console.log("âœ… Ruleta actualizada:", wheelId);

    res.json({ success: true, message: "Ruleta actualizada" });
  } catch (error) {
    console.error("Error actualizando ruleta:", error);
    res.status(500).json({ success: false, message: "Error al actualizar ruleta" });
  }
});

// DELETE /api/spin-wheel/:wheelId - Elimina una ruleta
app.delete("/api/spin-wheel/:wheelId", async (req, res) => {
  const { wheelId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const wheelRef = db.collection("promonube_spin_wheels").doc(wheelId);
    const wheelDoc = await wheelRef.get();

    if (!wheelDoc.exists) {
      return res.json({ success: false, message: "Ruleta no encontrada" });
    }

    if (wheelDoc.data().storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    await wheelRef.delete();

    console.log("âœ… Ruleta eliminada:", wheelId);

    res.json({ success: true, message: "Ruleta eliminada" });
  } catch (error) {
    console.error("Error eliminando ruleta:", error);
    res.status(500).json({ success: false, message: "Error al eliminar ruleta" });
  }
});

// POST /api/spin-wheel/:wheelId/spin - Procesa un giro de ruleta
app.post("/api/spin-wheel/:wheelId/spin", async (req, res) => {
  const { wheelId } = req.params;
  const { email } = req.body;

  try {
    const wheelRef = db.collection("promonube_spin_wheels").doc(wheelId);
    const wheelDoc = await wheelRef.get();

    if (!wheelDoc.exists) {
      return res.json({ success: false, message: "Ruleta no encontrada" });
    }

    const wheelData = wheelDoc.data();
    
    const isActive = wheelData.enabled || wheelData.active;
    if (!isActive) {
      return res.json({ success: false, message: "Ruleta desactivada" });
    }

    // Verificar si el email es requerido
    const showEmailField = wheelData.showEmailField !== false; // Por defecto true
    const requireEmail = showEmailField && wheelData.requireEmail !== false; // Por defecto true
    if (requireEmail && !email) {
      return res.json({ success: false, message: "Email requerido" });
    }

    // ðŸ” VERIFICAR SI EL EMAIL YA JUGÃ“ EN ESTA RULETA (solo si hay email)
    if (email) {
      const maxSpinsPerEmail = wheelData.maxSpinsPerEmail || 1; // Por defecto 1 vez
      
      const previousSpinsQuery = await db.collection("spin_wheel_results")
        .where("wheelId", "==", wheelId)
        .where("email", "==", email)
        .get();

      const previousSpinsCount = previousSpinsQuery.size;
      
      if (previousSpinsCount >= maxSpinsPerEmail) {
        console.log(`âš ï¸ Email ${email} ya participÃ³ ${previousSpinsCount} veces en ruleta ${wheelId} (mÃ¡ximo: ${maxSpinsPerEmail})`);
        return res.json({ 
          success: false, 
          message: maxSpinsPerEmail === 1 
            ? "Ya participaste en esta ruleta. Solo podÃ©s jugar una vez."
            : `Ya alcanzaste el mÃ¡ximo de ${maxSpinsPerEmail} intentos en esta ruleta.`
        });
      }
    }

    // Seleccionar premio basado en probabilidades (acepta prizes o segments)
    const prizes = wheelData.prizes || wheelData.segments || [];
    
    if (prizes.length === 0) {
      return res.json({ success: false, message: "No hay premios configurados" });
    }
    
    const random = Math.random() * 100;
    let cumulative = 0;
    let selectedPrize = null;
    let selectedPrizeIndex = 0;

    console.log(`ðŸŽ² Iniciando selecciÃ³n de premio. Random: ${random.toFixed(2)}%`);
    console.log(`ðŸ“Š Premios disponibles:`, prizes.map((p, i) => `${i}: ${p.label} (${p.probability}%)`));

    for (let i = 0; i < prizes.length; i++) {
      cumulative += prizes[i].probability;
      console.log(`  [${i}] ${prizes[i].label}: prob=${prizes[i].probability}%, acumulado=${cumulative.toFixed(2)}%`);
      if (random <= cumulative) {
        selectedPrize = prizes[i];
        selectedPrizeIndex = i;
        console.log(`âœ… Premio seleccionado por probabilidad: Ã­ndice ${i} - ${prizes[i].label}`);
        break;
      }
    }

    if (!selectedPrize) {
      selectedPrize = prizes[prizes.length - 1]; // Fallback
      selectedPrizeIndex = prizes.length - 1;
      console.log(`âš ï¸ Fallback al Ãºltimo premio: ${selectedPrize.label}`);
    }
    
    // ðŸŽ¯ Calcular Ã¡ngulo del centro del segmento ganador
    const segmentAngle = 360 / prizes.length;
    const segmentStartAngle = -90 + (selectedPrizeIndex * segmentAngle);
    const targetAngle = segmentStartAngle + (segmentAngle / 2);
    
    console.log(`ðŸŽ¯ Premio seleccionado: [${selectedPrizeIndex}] ${selectedPrize.label} - Ã¡ngulo: ${targetAngle}Â°`);

    // Crear cupÃ³n si el premio no es "none"
    let couponCode = null;
    let couponExpiresAt = null;
    
    console.log(`ðŸ” Verificando tipo de premio: ${selectedPrize.type} (${selectedPrize.type !== 'none' ? 'CREARÃ CUPÃ“N' : 'NO CREARÃ CUPÃ“N'})`);
    
    if (selectedPrize.type !== 'none') {
      console.log(`âœ… Creando cupÃ³n para premio: ${selectedPrize.label}`);
      const store = await getStoreById(wheelData.storeId);
      if (!store) {
        console.error(`âŒ Tienda no encontrada: ${wheelData.storeId}`);
        return res.json({ success: false, message: "Tienda no encontrada" });
      }
      
      console.log(`âœ… Store encontrado: ${store.storeId}, accessToken: ${store.accessToken ? 'SÃ' : 'NO'}`);

      // ðŸŽ¯ GENERAR CUPÃ“N ÃšNICO con prefijo personalizable
      const prefix = wheelData.couponPrefix || 'RULETA';
      const uniqueId = Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 4).toUpperCase();
      couponCode = `${prefix}${uniqueId}`;
      
      // â° CUPÃ“N VÃLIDO POR 15 MINUTOS (configurable)
      const expirationMinutes = wheelData.couponExpirationMinutes || 15;
      const expirationDate = new Date(Date.now() + expirationMinutes * 60 * 1000);
      couponExpiresAt = expirationDate.toISOString();
      
      // Crear cupÃ³n en TiendaNube con fecha de expiraciÃ³n
      const couponData = {
        code: couponCode,
        type: selectedPrize.type,
        value: selectedPrize.value.toString(),
        valid: true,
        max_uses: 1, // Un solo uso
        start_date: new Date().toISOString().split('T')[0],
        end_date: expirationDate.toISOString().split('T')[0]
      };

      console.log(`ðŸ“ Creando cupÃ³n en TiendaNube:`, {
        code: couponCode,
        type: selectedPrize.type,
        value: selectedPrize.value,
        prizeLabel: selectedPrize.label,
        prizeIndex: selectedPrizeIndex
      });

      const tnResponse = await fetch(`https://api.tiendanube.com/v1/${store.storeId}/coupons`, {
        method: 'POST',
        headers: {
          'Authentication': `bearer ${store.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'GlowLab (info@techdi.com.ar)'
        },
        body: JSON.stringify(couponData)
      });

      if (!tnResponse.ok) {
        const errorText = await tnResponse.text();
        console.error("âŒ Error creando cupÃ³n en TiendaNube:", {
          status: tnResponse.status,
          statusText: tnResponse.statusText,
          error: errorText,
          couponData
        });
        // NO retornar error, continuar sin cupÃ³n
        couponCode = null;
        couponExpiresAt = null;
      } else {
        const tnCoupon = await tnResponse.json();
        console.log(`âœ… CupÃ³n creado en TiendaNube exitosamente:`, { 
          code: couponCode, 
          id: tnCoupon.id,
          type: tnCoupon.type,
          value: tnCoupon.value
        });
        
        // Guardar en Firestore con mÃ¡s detalles
        const couponId = `coupon_wheel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.collection("promonube_coupons").doc(couponId).set({
          couponId: couponId,
          storeId: wheelData.storeId,
          code: couponCode,
          type: selectedPrize.type,
          value: selectedPrize.value,
          source: 'spin_wheel',
          wheelId: wheelId,
          email: email,
          createdAt: new Date().toISOString(),
          expiresAt: couponExpiresAt,
          expirationMinutes: expirationMinutes,
          currentUses: 0,
          maxUses: 1,
          used: false,
          usedAt: null,
          orderId: null,
          tiendanubeCouponId: tnCoupon.id
        });
        
        console.log(`âœ… CupÃ³n Ãºnico creado: ${couponCode} (expira en ${expirationMinutes} min)`);
      }
    }

    // Guardar resultado del giro CON EXPIRACION
    await db.collection("spin_wheel_results").add({
      wheelId,
      storeId: wheelData.storeId,
      email,
      prizeId: selectedPrize.id,
      prizeLabel: selectedPrize.label,
      prizeType: selectedPrize.type,
      prizeValue: selectedPrize.value,
      couponCode,
      couponExpiresAt,
      couponUsed: false,
      timestamp: new Date().toISOString()
    });

    // Actualizar estadÃ­sticas
    await wheelRef.update({
      totalSpins: (wheelData.totalSpins || 0) + 1,
      emailsCollected: (wheelData.emailsCollected || 0) + (email ? 1 : 0)
    });

    // ðŸš€ SINCRONIZAR EMAIL CON INTEGRACIONES (Perfit, Mailchimp, etc) - Solo si hay email
    if (email) {
      const store = await getStoreById(wheelData.storeId);
      if (store) {
        // Determinar la lista Perfit: prioridad lista de la ruleta, luego lista por defecto
        // Convertir a número si es un ID numérico (Perfit usa IDs numéricos)
        const rawListId = wheelData.perfitListId || store.perfitDefaultList;
        const parsedListId = rawListId ? (isNaN(rawListId) ? rawListId : parseInt(rawListId)) : null;

        const emailData = {
          tags: [
            'spin_wheel',
            `premio_${selectedPrize.type}`,
            couponCode ? 'con_cupon' : 'sin_cupon'
          ],
          customFields: {
            'ultimo_premio': selectedPrize.label,
            'cupon_codigo': couponCode || '',
            'fecha_giro': new Date().toISOString()
          },
          lists: parsedListId ? [parsedListId] : []
        };

        console.log('ðŸ“§ [Spin Wheel] Sincronizando email con integraciones:', {
          email,
          storeId: wheelData.storeId,
          perfitListId: wheelData.perfitListId,
          perfitDefaultList: store.perfitDefaultList,
          finalLists: emailData.lists,
          tags: emailData.tags
        });

        // Sincronizar en background (no bloquear la respuesta)
        syncEmailToIntegrations(store, email, emailData).catch(err => {
          console.error('âŒ Error sincronizando email:', err);
        });
      } else {
        console.error('âŒ Store no encontrado para wheelData.storeId:', wheelData.storeId);
      }
    }

    console.log("âœ… Giro procesado:", { wheelId, email, prize: selectedPrize.label, couponCode });

    // Responder con TODOS los datos necesarios para el countdown + Ã¡ngulo de la ruleta
    res.json({
      success: true,
      prize: selectedPrize,
      prizeIndex: selectedPrizeIndex,
      targetAngle: targetAngle,
      couponCode,
      couponExpiresAt,
      expirationMinutes: wheelData.couponExpirationMinutes || 15
    });

  } catch (error) {
    console.error("Error procesando giro:", error);
    res.status(500).json({ success: false, message: "Error al procesar giro" });
  }
});

// GET /api/spin-wheel/:wheelId/analytics - Obtiene estadÃ­sticas de una ruleta
app.get("/api/spin-wheel/:wheelId/analytics", async (req, res) => {
  const { wheelId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    // Verificar que la ruleta existe y pertenece a la tienda
    const wheelDoc = await db.collection("promonube_spin_wheels").doc(wheelId).get();
    
    if (!wheelDoc.exists) {
      return res.json({ success: false, message: "Ruleta no encontrada" });
    }

    const wheelData = wheelDoc.data();
    
    if (wheelData.storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    // Obtener todos los resultados de giros (sin orderBy para evitar errores de Ã­ndice)
    const resultsSnapshot = await db.collection("spin_wheel_results")
      .where("wheelId", "==", wheelId)
      .get();

    const results = [];
    const prizeDistribution = {};
    let totalSpins = 0;
    let uniqueEmails = new Set();

    resultsSnapshot.forEach(doc => {
      const data = doc.data();
      results.push({ id: doc.id, ...data });
      totalSpins++;
      if (data.email) {
        uniqueEmails.add(data.email);
      }

      // Contar distribuciÃ³n de premios
      const prizeLabel = data.prizeLabel || data.prizeType || 'Desconocido';
      prizeDistribution[prizeLabel] = (prizeDistribution[prizeLabel] || 0) + 1;
    });

    // Ordenar resultados manualmente por timestamp
    results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Obtener cupones generados y su uso
    const couponsGenerated = results.filter(r => r.couponCode).length;
    
    // Buscar cupones usados (en la colecciÃ³n de uso de cupones)
    const usedCouponsSnapshot = await db.collection("coupon_usage")
      .where("storeId", "==", storeId)
      .get();

    const wheelCouponCodes = results.filter(r => r.couponCode).map(r => r.couponCode);
    let couponsUsed = 0;
    let totalRevenue = 0;
    let totalDiscount = 0;

    usedCouponsSnapshot.forEach(doc => {
      const usage = doc.data();
      // Comparar con couponCode (campo correcto en coupon_usage)
      if (wheelCouponCodes.includes(usage.couponCode)) {
        couponsUsed++;
        totalRevenue += usage.total || usage.orderTotal || 0;
        totalDiscount += usage.discountValue || usage.discountAmount || 0;
      }
    });

    // Calcular mÃ©tricas
    const conversionRate = couponsGenerated > 0 ? (couponsUsed / couponsGenerated * 100).toFixed(2) : 0;
    const avgOrderValue = couponsUsed > 0 ? (totalRevenue / couponsUsed).toFixed(2) : 0;

    // Timeline: agrupar por dÃ­a
    const timeline = {};
    results.forEach(r => {
      const date = new Date(r.timestamp).toISOString().split('T')[0];
      timeline[date] = (timeline[date] || 0) + 1;
    });

    const timelineArray = Object.keys(timeline)
      .sort()
      .map(date => ({ date, spins: timeline[date] }));

    // Ãšltimos 10 giros
    const recentSpins = results.slice(0, 10).map(r => ({
      email: r.email,
      prize: r.prizeLabel,
      couponCode: r.couponCode,
      timestamp: r.timestamp,
      used: r.couponUsed || false
    }));

    res.json({
      success: true,
      analytics: {
        totalSpins,
        uniqueEmails: uniqueEmails.size,
        couponsGenerated,
        couponsUsed,
        conversionRate: parseFloat(conversionRate),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalDiscount: parseFloat(totalDiscount.toFixed(2)),
        avgOrderValue: parseFloat(avgOrderValue),
        prizeDistribution,
        timeline: timelineArray,
        recentSpins
      }
    });

  } catch (error) {
    console.error("Error obteniendo analytics:", error);
    res.status(500).json({ success: false, message: "Error al obtener analytics" });
  }
});

// GET /api/spin-wheel/:wheelId/export - Exportar lista de participantes como CSV
app.get("/api/spin-wheel/:wheelId/export", async (req, res) => {
  const { wheelId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const wheelDoc = await db.collection("promonube_spin_wheels").doc(wheelId).get();
    if (!wheelDoc.exists) {
      return res.json({ success: false, message: "Ruleta no encontrada" });
    }
    const wheelData = wheelDoc.data();
    if (wheelData.storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    const resultsSnapshot = await db.collection("spin_wheel_results")
      .where("wheelId", "==", wheelId)
      .get();

    const results = [];
    resultsSnapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Generar CSV
    const csvHeader = "Email,Premio,Tipo,Valor,Cupon,Fecha,Cupon Usado";
    const csvRows = results.map(r => {
      const email = (r.email || '').replace(/"/g, '""');
      const prize = (r.prizeLabel || '').replace(/"/g, '""');
      const type = r.prizeType || '';
      const value = r.prizeValue || '';
      const coupon = r.couponCode || '';
      const date = r.timestamp ? new Date(r.timestamp).toLocaleString('es-AR') : '';
      const used = r.couponUsed ? 'Si' : 'No';
      return `"${email}","${prize}","${type}","${value}","${coupon}","${date}","${used}"`;
    });

    const csv = [csvHeader, ...csvRows].join('\n');
    const wheelName = (wheelData.name || 'ruleta').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `participantes_${wheelName}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM para que Excel lo abra correctamente
  } catch (error) {
    console.error("Error exportando participantes:", error);
    res.status(500).json({ success: false, message: "Error al exportar" });
  }
});

// GET /api/spin-wheel-widget.js - Script embebible optimizado para TiendaNube
app.get("/api/spin-wheel-widget.js", async (req, res) => {
  const { wheelId, store } = req.query;
  
  // Configurar headers para JavaScript
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800'); // Cache de 30 minutos

  try {
    let wheelData;
    let finalWheelId;

    // Si no hay wheelId, buscar por storeId (parÃ¡metro "store" que TiendaNube pasa automÃ¡ticamente)
    if (!wheelId && store) {
      console.log(`ðŸ” Buscando ruletas activas para store ${store}`);
      
      const wheelsSnapshot = await db.collection("promonube_spin_wheels")
        .where("storeId", "==", store)
        .where("active", "==", true)
        .limit(1)
        .get();

      if (wheelsSnapshot.empty) {
        return res.send("// No hay ruletas activas para esta tienda");
      }

      const wheelDoc = wheelsSnapshot.docs[0];
      wheelData = wheelDoc.data();
      finalWheelId = wheelDoc.id;
      
      console.log(`âœ… Ruleta encontrada: ${finalWheelId} - ${wheelData.name}`);
    } else if (wheelId) {
      // Si hay wheelId especÃ­fico, usarlo
      const wheelDoc = await db.collection("promonube_spin_wheels").doc(wheelId).get();

      if (!wheelDoc.exists) {
        return res.status(404).send("// Error: Ruleta no encontrada");
      }

      wheelData = wheelDoc.data();
      finalWheelId = wheelId;
      
      // Verificar que estÃ© activa
      const isActive = wheelData.active || wheelData.enabled;
      if (!isActive) {
        return res.send("// Ruleta desactivada");
      }
    } else {
      return res.status(400).send("// Error: wheelId o store requerido");
    }

    // Generar script JavaScript optimizado
    const script = `
/**
 * PromoNube - Spin Wheel Widget
 * Ruleta: ${wheelData.name || 'Sin nombre'}
 * Store: ${wheelData.storeId}
 */
(function() {
  'use strict';
  
  // ConfiguraciÃ³n de la ruleta
  const WHEEL_CONFIG = ${JSON.stringify({
    wheelId: finalWheelId,
    storeId: wheelData.storeId,
    name: wheelData.name,
    title: wheelData.title || 'Â¡GirÃ¡ y GanÃ¡!',
    subtitle: wheelData.subtitle || 'Dejanos tu email y ganÃ¡ descuentos exclusivos',
    buttonText: wheelData.buttonText || 'ðŸŽ° GIRAR RULETA',
    successMessage: wheelData.successMessage || 'Â¡Felicitaciones! Ganaste:',
    prizes: wheelData.prizes || wheelData.segments || [],
    primaryColor: wheelData.primaryColor || '#667eea',
    secondaryColor: wheelData.secondaryColor || '#764ba2',
    textColor: wheelData.textColor || '#FFFFFF',
    showOnce: wheelData.showOnce !== false, // Por defecto true (mostrar solo una vez)
    delaySeconds: wheelData.delaySeconds || 3,
    exitIntent: wheelData.exitIntent || false,
    showEmailField: wheelData.showEmailField !== false, // Por defecto true (mostrar campo de email)
    requireEmail: wheelData.requireEmail !== false, // Por defecto true (email obligatorio)
    centerEmoji: wheelData.centerEmoji || '\uD83C\uDF81' // Emoji del centro de la ruleta (🎁)
  }, null, 2)};
  
  const API_URL = "https://apipromonube-jlfopowzaq-uc.a.run.app";
  const STORAGE_KEY = 'promonube_wheel_' + WHEEL_CONFIG.wheelId;
  
  // Verificar si ya participÃ³
  if (WHEEL_CONFIG.showOnce && localStorage.getItem(STORAGE_KEY)) {
    console.log('[PromoNube] Usuario ya participÃ³ en esta ruleta');
    return;
  }
  
  // Inyectar CSS variables
  const cssVars = document.createElement('style');
  cssVars.textContent = \`:root {
    --pn-primary: \${WHEEL_CONFIG.primaryColor};
    --pn-secondary: \${WHEEL_CONFIG.secondaryColor};
    --pn-text: \${WHEEL_CONFIG.textColor};
  }\`;
  document.head.appendChild(cssVars);
  
  // Crear estilos CSS
  const styles = \`
    .pn-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      animation: pnFadeIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    @keyframes pnFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .pn-modal {
      background: linear-gradient(135deg, var(--pn-primary) 0%, var(--pn-secondary) 100%);
      padding: 40px 30px;
      border-radius: 24px;
      max-width: 480px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      color: var(--pn-text);
      text-align: center;
      position: relative;
      animation: pnSlideUp 0.4s ease-out;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    }
    
    @keyframes pnSlideUp {
      from {
        transform: translateY(60px) scale(0.85);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
    
    .pn-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: transparent;
      border: none;
      color: #1a1a1a;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 28px;
      line-height: 1;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
    }
    
    .pn-close:hover {
      background: rgba(0, 0, 0, 0.05);
      transform: scale(1.1);
    }
    
    .pn-title {
      font-size: 32px;
      margin: 0 0 8px;
      font-weight: 800;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      line-height: 1.2;
    }
    
    .pn-subtitle {
      font-size: 16px;
      margin: 0 0 24px;
      opacity: 0.95;
      line-height: 1.4;
    }
    
    .pn-wheel-container {
      position: relative;
      width: 320px;
      height: 320px;
      margin: 0 auto 24px;
    }
    
    .pn-wheel {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      position: relative;
      border: 10px solid rgba(255, 255, 255, 0.95);
      transition: transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99);
      box-shadow: 
        0 0 0 3px rgba(0, 0, 0, 0.1),
        0 0 32px rgba(0, 0, 0, 0.2) inset,
        0 16px 48px rgba(0, 0, 0, 0.3);
      background: white;
    }
    
    .pn-wheel-pointer {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 20px solid transparent;
      border-right: 20px solid transparent;
      border-top: 35px solid #FF0040;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
      z-index: 10;
    }
    
    .pn-wheel-pointer::after {
      content: '';
      position: absolute;
      top: -40px;
      left: -6px;
      width: 12px;
      height: 12px;
      background: #FF0040;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
    
    .pn-wheel-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 
        0 0 0 4px rgba(0, 0, 0, 0.05),
        0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 10;
      font-weight: bold;
      border: 3px solid rgba(255, 255, 255, 0.9);
    }
    
    .pn-input {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      margin-bottom: 12px;
      text-align: center;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      color: #333333;
      font-weight: 500;
    }
    
    .pn-input::placeholder {
      color: #999999;
      opacity: 1;
    }
    
    .pn-input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
    }
    
    .pn-button {
      background: white;
      color: var(--pn-primary);
      border: none;
      padding: 18px 32px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .pn-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    
    .pn-button:active:not(:disabled) {
      transform: translateY(-1px) scale(0.98);
    }
    
    .pn-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }
    
    .pn-result {
      font-size: 22px;
      margin: 20px 0 12px;
      font-weight: 700;
      animation: pnBounce 0.6s;
    }
    
    @keyframes pnBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    .pn-coupon {
      background: rgba(255, 255, 255, 0.15);
      padding: 24px 20px;
      border-radius: 20px;
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 4px;
      margin: 20px 0;
      border: 3px dashed rgba(255, 255, 255, 0.4);
      word-break: break-all;
      backdrop-filter: blur(15px);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    }
    
    .pn-coupon::before {
      content: 'ðŸ“‹';
      position: absolute;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 24px;
      opacity: 0.7;
      transition: all 0.3s;
    }
    
    .pn-coupon:hover {
      background: rgba(255, 255, 255, 0.25);
      border-color: rgba(255, 255, 255, 0.6);
      transform: scale(1.03);
      box-shadow: 
        0 12px 32px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    }
    
    .pn-coupon:hover::before {
      opacity: 1;
      transform: translateY(-50%) scale(1.2);
    }
    
    .pn-hint {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 12px;
      line-height: 1.5;
    }
    
    @media (max-width: 500px) {
      .pn-modal {
        padding: 24px 16px;
        width: 95%;
        max-height: 95vh;
      }
      
      .pn-title {
        font-size: 24px;
        margin-bottom: 6px;
      }
      
      .pn-subtitle {
        font-size: 14px;
        margin-bottom: 16px;
      }
      
      .pn-wheel-container {
        width: 220px;
        height: 220px;
        margin-bottom: 16px;
      }
      
      .pn-wheel-center {
        width: 50px;
        height: 50px;
        font-size: 24px;
      }

      .pn-input {
        font-size: 15px;
        padding: 14px;
        color: #333333;
      }

      .pn-button {
        font-size: 16px;
        padding: 15px 24px;
      }

      .pn-coupon {
        font-size: 20px;
        padding: 12px;
        letter-spacing: 2px;
      }

      .pn-result {
        font-size: 18px;
      }

      #pn-countdown-display {
        font-size: 28px !important;
      }

      .pn-hint {
        font-size: 12px;
      }
    }
    
    @media (max-width: 380px) {
      .pn-wheel-container {
        width: 180px;
        height: 180px;
      }
      
      .pn-title {
        font-size: 22px;
      }
      
      .pn-coupon {
        font-size: 18px;
      }
    }
  \`;
  
  // Inyectar estilos
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
  
  // FunciÃ³n para crear la rueda visual
  function createWheel() {
    const prizes = WHEEL_CONFIG.prizes;
    if (!prizes || prizes.length === 0) {
      return '<div style="padding: 40px; color: white;">No hay premios configurados</div>';
    }
    
    // ðŸ” Guardar premios en variable global para debugging
    window.WHEEL_PRIZES = prizes;
    console.log('ðŸŽ° ===== RUEDA INICIALIZADA =====');
    console.log('ðŸ“Š Premios en orden visual (de arriba en sentido horario):');
    prizes.forEach((p, i) => {
      const angle = (i * (360 / prizes.length)) - 90;
      console.log(\`  [\${i}] \${p.label} - comienza en \${angle}Â°\`);
    });
    console.log('================================');
    
    // Colores vibrantes predeterminados
    const defaultColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#C7CEEA'];

    // Tamaño de texto adaptivo según número de segmentos
    // textRadius: distancia del centro al punto medio del texto (rueda radio=150, hub radio~38)
    // Espacio disponible: desde ~42px hasta ~145px = 103px. Centro ideal ~93px.
    // Usamos valores más conservadores para evitar overflow.
    const numPrizes = prizes.length;
    let fontSize = 13;
    let maxLabelLen = 9;
    let textRadius = 82;
    let maxTextPx = 88;
    if (numPrizes <= 4)      { fontSize = 13; maxLabelLen = 9;  textRadius = 84; maxTextPx = 90; }
    else if (numPrizes <= 6) { fontSize = 12; maxLabelLen = 8;  textRadius = 80; maxTextPx = 82; }
    else if (numPrizes <= 8) { fontSize = 11; maxLabelLen = 7;  textRadius = 76; maxTextPx = 74; }
    else                     { fontSize =  9; maxLabelLen = 6;  textRadius = 72; maxTextPx = 64; }

    // Crear segmentos SVG
    const segmentAngle = 360 / prizes.length;
    let segments = '';

    prizes.forEach((prize, index) => {
      const startAngle = index * segmentAngle - 90; // Empezar desde arriba
      const endAngle = startAngle + segmentAngle;
      const color = prize.color || defaultColors[index % defaultColors.length];

      // Convertir ángulos a coordenadas
      const startRad = startAngle * Math.PI / 180;
      const endRad = endAngle * Math.PI / 180;

      const x1 = 160 + 150 * Math.cos(startRad);
      const y1 = 160 + 150 * Math.sin(startRad);
      const x2 = 160 + 150 * Math.cos(endRad);
      const y2 = 160 + 150 * Math.sin(endRad);

      const largeArc = segmentAngle > 180 ? 1 : 0;

      // Crear path para el segmento
      segments += \`
        <path
          d="M 160 160 L \${x1} \${y1} A 150 150 0 \${largeArc} 1 \${x2} \${y2} Z"
          fill="\${color}"
          stroke="white"
          stroke-width="2"
        />
      \`;

      // Agregar texto
      const textAngle = startAngle + (segmentAngle / 2);
      const textRad = textAngle * Math.PI / 180;
      const textX = 160 + textRadius * Math.cos(textRad);
      const textY = 160 + textRadius * Math.sin(textRad);
      const rawLabel = prize.label || prize.text || \`\${prize.value}%\`;
      const label = rawLabel.length > maxLabelLen ? rawLabel.substring(0, maxLabelLen) + '…' : rawLabel;
      // Limitar textLength al mínimo entre el máx disponible y el ancho estimado real del texto
      const estimatedPx = Math.ceil(label.length * fontSize * 0.62);
      const constrainedLen = Math.min(maxTextPx, estimatedPx);

      segments += \`
        <text
          x="\${textX}"
          y="\${textY}"
          fill="white"
          font-size="\${fontSize}"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(\${textAngle + 90}, \${textX}, \${textY})"
          textLength="\${constrainedLen}"
          lengthAdjust="spacingAndGlyphs"
          style="pointer-events: none;"
        >\${label}</text>
      \`;
    });
    
    return \`
      <div class="pn-wheel-container">
        <div class="pn-wheel-pointer"></div>
        <div style="position: relative;">
          <svg class="pn-wheel" id="pn-wheel" viewBox="0 0 320 320" style="width: 100%; height: 100%;">
            <defs>
              <filter id="pn-text-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.6)" flood-opacity="1"/>
              </filter>
            </defs>
            <g filter="url(#pn-text-shadow)">
              \${segments}
            </g>
          </svg>
          <div class="pn-wheel-center">\${WHEEL_CONFIG.centerEmoji || '\uD83C\uDF81'}</div>
        </div>
      </div>
    \`;
  }
  
  // FunciÃ³n para mostrar la ruleta
  function showWheel() {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'pn-overlay';
    overlay.id = 'pn-wheel-overlay';
    
    overlay.innerHTML = \`
      <div class="pn-modal">
        <button class="pn-close" onclick="document.getElementById('pn-wheel-overlay').remove()"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
        <h1 class="pn-title">\${WHEEL_CONFIG.title}</h1>
        <p class="pn-subtitle">\${WHEEL_CONFIG.subtitle}</p>
        <div id="pn-content">
          \${createWheel()}
          \${WHEEL_CONFIG.showEmailField !== false ? \`
          <input 
            type="email" 
            id="pn-email" 
            class="pn-input" 
            placeholder="\${WHEEL_CONFIG.emailPlaceholder || 'tu@email.com'}" 
            \${WHEEL_CONFIG.requireEmail !== false ? 'required' : ''} 
          />
          \` : ''}
          <button id="pn-spin-btn" class="pn-button">\${WHEEL_CONFIG.buttonText}</button>
        </div>
      </div>
    \`;
    
    document.body.appendChild(overlay);
    
    // Manejar el clic en el botÃ³n de girar
    const spinBtn = document.getElementById('pn-spin-btn');
    const emailInput = document.getElementById('pn-email');
    
    spinBtn.addEventListener('click', handleSpin);
    if (emailInput) {
      emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSpin();
      });
    }
  }
  
  // FunciÃ³n para manejar el giro
  async function handleSpin() {
    const emailInput = document.getElementById('pn-email');
    const spinBtn = document.getElementById('pn-spin-btn');
    const email = emailInput ? emailInput.value.trim() : '';
    
    // Validar email solo si el campo existe y requireEmail es true
    if (WHEEL_CONFIG.showEmailField !== false && WHEEL_CONFIG.requireEmail !== false && emailInput) {
      if (!email || !email.match(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/)) {
        emailInput.style.border = '2px solid #ff4444';
        emailInput.focus();
        setTimeout(() => { emailInput.style.border = 'none'; }, 2000);
        return;
      }
    }
    
    // Deshabilitar controles
    spinBtn.disabled = true;
    if (emailInput) emailInput.disabled = true;
    spinBtn.textContent = 'ðŸŽ° GIRANDO...';
    
    try {
      // Llamar a la API para procesar el giro
      const response = await fetch(\`\${API_URL}/api/spin-wheel/\${WHEEL_CONFIG.wheelId}/spin\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || null })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        alert(data.message || 'OcurriÃ³ un error');
        spinBtn.disabled = false;
        if (emailInput) emailInput.disabled = false;
        spinBtn.textContent = WHEEL_CONFIG.buttonText;
        return;
      }
      
      // ðŸŽ¯ ANIMAR RUEDA hacia el Ã¡ngulo exacto del premio ganado
      const wheel = document.getElementById('pn-wheel');
      const targetAngle = data.targetAngle || 0;
      const prizeIndex = data.prizeIndex;
      const prizeLabel = data.prize.label;
      
      // IMPORTANTE: El puntero estÃ¡ arriba (en la posiciÃ³n de las 12 del reloj)
      // Los segmentos se dibujan empezando desde -90Â° (arriba)
      // targetAngle es el Ã¡ngulo del CENTRO del segmento ganador (ya normalizado 0-360)
      
      // Para que el segmento ganador quede bajo el puntero:
      // 1. El puntero estÃ¡ en la posiciÃ³n 270Â° del cÃ­rculo (arriba = -90Â° = 270Â°)
      // 2. Queremos rotar la rueda para que targetAngle llegue a 270Â°
      // 3. RotaciÃ³n necesaria = 270 - targetAngle
      
      // IMPORTANTE: randomSpins DEBE ser entero para que la posiciÃ³n final sea correcta
      const randomSpins = 5 + Math.floor(Math.random() * 3); // 5, 6 o 7 vueltas completas
      
      // Calcular rotaciÃ³n usando prizeIndex directamente (mÃ¡s robusto)
      const numPrizes = WHEEL_CONFIG.prizes.length;
      const segAngle = 360 / numPrizes;
      // El centro del segmento N estÃ¡ a (N + 0.5) * segAngle grados CW desde el top
      // Para que quede bajo el puntero (top), rotar CW por: 360 - (N + 0.5) * segAngle
      const finalAngle = 360 - ((prizeIndex + 0.5) * segAngle);
      // Agregar pequeÃ±o offset random dentro del segmento para que no caiga siempre en el centro exacto
      const segmentOffset = (Math.random() - 0.5) * (segAngle * 0.6); // Â±30% del segmento
      const totalRotation = (randomSpins * 360) + finalAngle + segmentOffset;
      
      console.log(\`ðŸŽ¯ ============ SPINNING HACIA PREMIO ============\`);
      console.log(\`   ðŸ† Premio: \${prizeLabel}\`);
      console.log(\`   ðŸ“ Ãndice: \${prizeIndex}\`);
      console.log(\`   ðŸŽ¯ Ãngulo del segmento: \${targetAngle}Â°\`);
      console.log(\`   ðŸ”„ Ãngulo final (270 - \${targetAngle}): \${finalAngle}Â°\`);
      console.log(\`   ðŸŒ€ RotaciÃ³n total: \${totalRotation}Â° (\${randomSpins.toFixed(1)} vueltas)\`);
      console.log(\`   âš™ï¸ Segmentos totales: \${window.WHEEL_PRIZES?.length || 'unknown'}\`);
      console.log(\`============================================\`);
      
      wheel.style.transform = \`rotate(\${totalRotation}deg)\`;
      
      // Esperar a que termine la animaciÃ³n (5 segundos)
      setTimeout(() => {
        showResult(data);
      }, 5000);
      
    } catch (error) {
      console.error('[PromoNube] Error:', error);
      spinBtn.disabled = false;
      if (emailInput) emailInput.disabled = false;
      spinBtn.textContent = WHEEL_CONFIG.buttonText;
      alert('OcurriÃ³ un error. Por favor intentÃ¡ de nuevo.');
    }
  }
  
  // FunciÃ³n para mostrar el resultado
  function showResult(data) {
    const overlay = document.getElementById('pn-wheel-overlay');
    
    if (data.success && data.couponCode) {
      // ðŸŽ¯ PREMIO CON CUPÃ“N + COUNTDOWN
      const expiresAt = new Date(data.couponExpiresAt);
      const expirationMinutes = data.expirationMinutes || 15;
      
      // Crear pantalla de felicitaciones
      overlay.innerHTML = \`
        <div class="pn-modal">
          <button class="pn-close" onclick="closeCouponModal()"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
          <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 16px;">ðŸŽ‰</div>
            <h1 class="pn-title" style="font-size: 38px; margin-bottom: 12px;">Â¡FELICITACIONES!</h1>
            <p class="pn-subtitle" style="font-size: 18px; margin-bottom: 8px;">DESBLOQUEASTE</p>
            <div style="font-size: 52px; font-weight: 900; margin: 20px 0; text-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              \${data.prize && data.prize.label ? data.prize.label : '🎁 DESCUENTO'}
            </div>
            
            <p class="pn-subtitle" style="font-size: 16px; margin: 24px 0 12px;">TU CUPÃ“N DE DESCUENTO ES:</p>
            <div class="pn-coupon" onclick="copyCoupon('\${data.couponCode}', this)">
              \${data.couponCode}
            </div>
            
            <div id="pn-countdown-modal" style="
              background: rgba(255,255,255,0.15);
              padding: 16px;
              border-radius: 12px;
              margin: 20px 0;
              backdrop-filter: blur(10px);
            ">
              <div style="font-size: 14px; margin-bottom: 8px; opacity: 0.9;">â° Tiempo restante:</div>
              <div id="pn-countdown-display" style="font-size: 32px; font-weight: 800; letter-spacing: 2px;"></div>
            </div>
            
            <button class="pn-button" style="margin-top: 20px; background: rgba(255,255,255,0.2); color: white;" 
                    onclick="closeCouponModal()">
              USAR MI DESCUENTO
            </button>
            <p class="pn-hint" style="margin-top: 16px; font-size: 13px;">
              ðŸ’¡ HacÃ© clic en el cupÃ³n para copiarlo
            </p>
          </div>
        </div>
      \`;
      
      // ðŸ”¥ CREAR STICKY BAR (barra inferior persistente)
      createStickyBar(data.couponCode, expiresAt);
      
      // Iniciar countdown
      startCountdown(expiresAt, 'pn-countdown-display');
      
      // Guardar cupÃ³n en localStorage para persistir
      localStorage.setItem('pn_active_coupon', JSON.stringify({
        code: data.couponCode,
        expiresAt: data.couponExpiresAt,
        prize: data.prize.label
      }));
      
      // Guardar que ya participÃ³
      if (WHEEL_CONFIG.showOnce) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
      
    } else if (data.success && data.prize) {
      // Premio sin cupÃ³n - verificar si es tipo "none" (no ganÃ³)
      const isNoWin = data.prize.type === 'none' || data.prize.type === 'no_win';
      const emoji = isNoWin ? 'ðŸ˜”' : 'ðŸ˜Š';
      const title = isNoWin ? 'Â¡Ups! Esta vez no ganaste' : (data.prize.label || 'Â¡Gracias por participar!');
      const subtitle = isNoWin ? 'Pero no te preocupes, seguÃ­ atento a nuestras promociones' : (data.prize.message || 'SeguÃ­ atento a nuestras prÃ³ximas promociones');
      
      overlay.innerHTML = \`
        <div class="pn-modal">
          <button class="pn-close" onclick="document.getElementById('pn-wheel-overlay').remove()"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
          <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 16px;">\${emoji}</div>
            <h1 class="pn-title">\${title}</h1>
            <p class="pn-subtitle" style="margin: 20px 0;">\${subtitle}</p>
            <button class="pn-button" onclick="document.getElementById('pn-wheel-overlay').remove()">
              CONTINUAR COMPRANDO
            </button>
          </div>
        </div>
      \`;
      
      if (WHEEL_CONFIG.showOnce) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
      
    } else {
      // Error
      alert(data.message || 'OcurriÃ³ un error. Por favor intentÃ¡ de nuevo.');
      document.getElementById('pn-wheel-overlay').remove();
    }
  }
  
  // â° FunciÃ³n para countdown con animaciones mejoradas
  function startCountdown(expiresAt, elementId) {
    const countdownEl = document.getElementById(elementId);
    if (!countdownEl) return;
    
    function updateCountdown() {
      const now = new Date().getTime();
      const distance = new Date(expiresAt).getTime() - now;
      
      if (distance < 0) {
        countdownEl.innerHTML = 'âŒ› EXPIRADO';
        countdownEl.style.color = '#ff4444';
        countdownEl.style.animation = 'none';
        
        // Remover sticky bar y cupÃ³n del localStorage
        const stickyBar = document.getElementById('pn-sticky-bar');
        if (stickyBar) stickyBar.remove();
        localStorage.removeItem('pn_active_coupon');
        
        return;
      }
      
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      countdownEl.innerHTML = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
      
      // ðŸ”´ Cambiar color y animar cuando quede poco tiempo
      if (minutes < 1) {
        countdownEl.style.color = '#ff3333';
        countdownEl.style.fontSize = '42px';
        countdownEl.style.animation = 'pnPulse 0.8s infinite';
      } else if (minutes < 3) {
        countdownEl.style.color = '#ff6b6b';
        countdownEl.style.fontSize = '38px';
        countdownEl.style.animation = 'pnPulse 1.5s infinite';
      }
      
      setTimeout(updateCountdown, 1000);
    }
    
    // Agregar animaciÃ³n de pulse si no existe
    if (!document.getElementById('pn-pulse-animation')) {
      const pulseStyle = document.createElement('style');
      pulseStyle.id = 'pn-pulse-animation';
      pulseStyle.textContent = \`
        @keyframes pnPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
      \`;
      document.head.appendChild(pulseStyle);
    }
    
    updateCountdown();
  }
  
  // ðŸ“Œ Crear barra sticky inferior
  function createStickyBar(couponCode, expiresAt) {
    // Remover sticky bar existente si hay
    const existing = document.getElementById('pn-sticky-bar');
    if (existing) existing.remove();
    
    const stickyBar = document.createElement('div');
    stickyBar.id = 'pn-sticky-bar';
    stickyBar.innerHTML = \`
      <style>
        #pn-sticky-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, var(--pn-primary) 0%, var(--pn-secondary) 100%);
          color: white;
          padding: 16px 20px;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
          z-index: 999998;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideUp 0.4s ease-out;
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        #pn-sticky-bar .sticky-content {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }
        
        #pn-sticky-bar .sticky-coupon {
          background: rgba(255,255,255,0.2);
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px dashed rgba(255,255,255,0.5);
        }
        
        #pn-sticky-bar .sticky-coupon:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.05);
        }
        
        #pn-sticky-bar .sticky-countdown {
          font-size: 20px;
          font-weight: 700;
          min-width: 80px;
        }
        
        #pn-sticky-bar .sticky-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.2s;
        }
        
        #pn-sticky-bar .sticky-close:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.1);
        }
        
        @media (max-width: 768px) {
          #pn-sticky-bar {
            flex-direction: column;
            padding: 12px 16px;
            gap: 8px;
          }
          
          #pn-sticky-bar .sticky-content {
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }
          
          #pn-sticky-bar .sticky-coupon {
            font-size: 16px;
            width: 100%;
            text-align: center;
          }
        }
      </style>
      
      <div class="sticky-content">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>🎁</span>
          <span style="font-weight: 600;">Tu cupÃ³n:</span>
        </div>
        <div class="sticky-coupon" onclick="copyCoupon('\${couponCode}', this)">
          \${couponCode}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>â°</span>
          <div class="sticky-countdown" id="pn-sticky-countdown"></div>
        </div>
      </div>
      
      <button class="sticky-close" onclick="closeStickyBar()" title="Cerrar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
    \`;
    
    document.body.appendChild(stickyBar);
    
    // Iniciar countdown en sticky bar
    startCountdown(expiresAt, 'pn-sticky-countdown');
  }
  
  // Funciones globales auxiliares
  window.copyCoupon = function(code, element) {
    navigator.clipboard.writeText(code).then(() => {
      const original = element.innerHTML;
      element.innerHTML = 'âœ… COPIADO';
      setTimeout(() => { element.innerHTML = original; }, 2000);
    });
  };
  
  window.closeCouponModal = function() {
    document.getElementById('pn-wheel-overlay').remove();
    // La sticky bar persiste
  };
  
  window.closeStickyBar = function() {
    const stickyBar = document.getElementById('pn-sticky-bar');
    if (stickyBar) {
      stickyBar.style.animation = 'slideDown 0.3s ease-out';
      setTimeout(() => stickyBar.remove(), 300);
    }
  };
  
  // Restaurar sticky bar si hay cupÃ³n activo
  function restoreStickyBar() {
    const savedCoupon = localStorage.getItem('pn_active_coupon');
    if (!savedCoupon) return;
    
    try {
      const couponData = JSON.parse(savedCoupon);
      const expiresAt = new Date(couponData.expiresAt);
      
      // Verificar si no expirÃ³
      if (new Date() < expiresAt) {
        createStickyBar(couponData.code, expiresAt);
      } else {
        // Ya expirÃ³, limpiar
        localStorage.removeItem('pn_active_coupon');
      }
    } catch (e) {
      console.error('[PromoNube] Error restaurando cupÃ³n:', e);
    }
  }
  
  // Determinar cuÃ¡ndo mostrar la ruleta
  function initWheel() {
    // Restaurar sticky bar si hay cupÃ³n activo
    restoreStickyBar();
    
    const delay = (WHEEL_CONFIG.delaySeconds || 0) * 1000;
    
    if (WHEEL_CONFIG.exitIntent) {
      // Mostrar cuando el usuario intenta salir
      document.addEventListener('mouseleave', function onMouseLeave(e) {
        if (e.clientY < 10) {
          setTimeout(showWheel, 300);
          document.removeEventListener('mouseleave', onMouseLeave);
        }
      });
    } else {
      // Mostrar despuÃ©s del delay
      setTimeout(showWheel, delay);
    }
  }
  
  // Iniciar cuando el DOM estÃ© listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWheel);
  } else {
    initWheel();
  }
  
})();
`;

    res.send(script);
    
  } catch (error) {
    console.error("âŒ Error generando script:", error);
    res.status(500).send(`// Error: ${error.message}`);
  }
});

// ============================================
// COUNTDOWN (CUENTA REGRESIVA) ENDPOINTS
// ============================================

// GET /api/countdowns - Lista todas las cuentas regresivas de la tienda
app.get("/api/countdowns", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const countdownsSnapshot = await db.collection("promonube_countdowns")
      .where("storeId", "==", storeId)
      .get();

    const countdowns = [];
    countdownsSnapshot.forEach(doc => {
      countdowns.push({
        countdownId: doc.id,
        ...doc.data()
      });
    });

    // Ordenar por fecha de creaciÃ³n (mÃ¡s recientes primero)
    countdowns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`âœ… ${countdowns.length} cuentas regresivas encontradas`);

    res.json({ success: true, countdowns });
  } catch (error) {
    console.error("Error obteniendo countdowns:", error);
    res.status(500).json({ success: false, message: "Error al obtener countdowns" });
  }
});

// GET /api/countdown/:countdownId - Obtiene configuraciÃ³n de una cuenta regresiva
app.get("/api/countdown/:countdownId", async (req, res) => {
  const { countdownId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const countdownDoc = await db.collection("promonube_countdowns").doc(countdownId).get();

    if (!countdownDoc.exists) {
      return res.json({ success: false, message: "Countdown no encontrado" });
    }

    if (countdownDoc.data().storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    res.json({ 
      success: true, 
      countdown: { id: countdownDoc.id, ...countdownDoc.data() } 
    });
  } catch (error) {
    console.error("Error obteniendo countdown:", error);
    res.status(500).json({ success: false, message: "Error al obtener countdown" });
  }
});

// POST /api/countdowns/create - Crea una nueva cuenta regresiva
app.post("/api/countdowns/create", async (req, res) => {
  const { storeId, ...config } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const countdownId = `countdown_${Date.now()}`;
    
    const countdownData = {
      storeId,
      ...config,
      enabled: config.enabled !== undefined ? config.enabled : true,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection("promonube_countdowns").doc(countdownId).set(countdownData);

    // Registrar script automÃ¡ticamente si el countdown estÃ¡ habilitado
    if (countdownData.enabled) {
      const store = await getStoreById(storeId);
      if (store) {
        await registerCountdownScript(store);
      }
    }

    console.log("âœ… Countdown creado:", countdownId);

    res.json({ success: true, countdownId, countdown: countdownData });
  } catch (error) {
    console.error("Error creando countdown:", error);
    res.status(500).json({ success: false, message: "Error al crear countdown" });
  }
});

// PUT /api/countdowns/:countdownId - Actualiza configuraciÃ³n de countdown
app.put("/api/countdowns/:countdownId", async (req, res) => {
  const { countdownId } = req.params;
  const { storeId, ...config } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const countdownRef = db.collection("promonube_countdowns").doc(countdownId);
    const countdownDoc = await countdownRef.get();

    if (!countdownDoc.exists) {
      return res.json({ success: false, message: "Countdown no encontrado" });
    }

    if (countdownDoc.data().storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    await countdownRef.update({
      ...config,
      updatedAt: new Date().toISOString()
    });

    console.log("âœ… Countdown actualizado:", countdownId);

    res.json({ success: true, message: "Countdown actualizado" });
  } catch (error) {
    console.error("Error actualizando countdown:", error);
    res.status(500).json({ success: false, message: "Error al actualizar countdown" });
  }
});

// DELETE /api/countdowns/:countdownId - Elimina un countdown
app.delete("/api/countdowns/:countdownId", async (req, res) => {
  const { countdownId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const countdownRef = db.collection("promonube_countdowns").doc(countdownId);
    const countdownDoc = await countdownRef.get();

    if (!countdownDoc.exists) {
      return res.json({ success: false, message: "Countdown no encontrado" });
    }

    if (countdownDoc.data().storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    const wasEnabled = countdownDoc.data().enabled;

    await countdownRef.delete();

    // Si era el Ãºltimo countdown activo, remover script
    if (wasEnabled) {
      const remainingCountdownsSnapshot = await db.collection("promonube_countdowns")
        .where("storeId", "==", storeId)
        .where("enabled", "==", true)
        .get();

      if (remainingCountdownsSnapshot.empty) {
        const store = await getStoreById(storeId);
        if (store) {
          await unregisterCountdownScript(store);
        }
      }
    }

    console.log("âœ… Countdown eliminado:", countdownId);

    res.json({ success: true, message: "Countdown eliminado" });
  } catch (error) {
    console.error("Error eliminando countdown:", error);
    res.status(500).json({ success: false, message: "Error al eliminar countdown" });
  }
});

// PATCH /api/countdowns/:countdownId/toggle - Activa/desactiva countdown
app.patch("/api/countdowns/:countdownId/toggle", async (req, res) => {
  const { countdownId } = req.params;
  const { storeId, enabled } = req.body;

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    const countdownRef = db.collection("promonube_countdowns").doc(countdownId);
    const countdownDoc = await countdownRef.get();

    if (!countdownDoc.exists) {
      return res.json({ success: false, message: "Countdown no encontrado" });
    }

    if (countdownDoc.data().storeId !== storeId) {
      return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    // Verificar si hay al menos un countdown activo
    const activeCountdownsSnapshot = await db.collection("promonube_countdowns")
      .where("storeId", "==", storeId)
      .where("enabled", "==", true)
      .get();

    const hasActiveCountdowns = activeCountdownsSnapshot.size > 0;
    const willHaveActiveCountdowns = enabled || (hasActiveCountdowns && activeCountdownsSnapshot.size > 1);

    // Gestionar script tag
    const store = await getStoreById(storeId);
    if (store) {
      if (enabled && !hasActiveCountdowns) {
        // Primer countdown activo: instalar script
        await registerCountdownScript(store);
      } else if (!willHaveActiveCountdowns) {
        // Ãšltimo countdown desactivado: remover script
        await unregisterCountdownScript(store);
      }
    }

    await countdownRef.update({
      enabled: enabled,
      updatedAt: new Date().toISOString()
    });

    console.log(`âœ… Countdown ${enabled ? 'activado' : 'desactivado'}:`, countdownId);

    res.json({ success: true, enabled });
  } catch (error) {
    console.error("Error toggle countdown:", error);
    res.status(500).json({ success: false, message: "Error al cambiar estado" });
  }
});

// POST /api/countdowns/:countdownId/track - Registra impresiones y clicks
app.post("/api/countdowns/:countdownId/track", async (req, res) => {
  const { countdownId } = req.params;
  const { action } = req.body; // 'impression' o 'click'

  try {
    const countdownRef = db.collection("promonube_countdowns").doc(countdownId);
    const countdownDoc = await countdownRef.get();

    if (!countdownDoc.exists) {
      return res.json({ success: false, message: "Countdown no encontrado" });
    }

    const updateData = {};
    
    if (action === 'impression') {
      updateData.impressions = FieldValue.increment(1);
    } else if (action === 'click') {
      updateData.clicks = FieldValue.increment(1);
    }

    if (Object.keys(updateData).length > 0) {
      await countdownRef.update(updateData);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error tracking countdown:", error);
    res.status(500).json({ success: false, message: "Error al registrar evento" });
  }
});

// GET /api/countdown-widget.js - Script embebible para mostrar countdown en tienda
app.get("/api/countdown-widget.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    // Buscar countdowns activos para esta tienda
    const countdownsSnapshot = await db.collection("promonube_countdowns")
      .where("storeId", "==", store)
      .where("enabled", "==", true)
      .get();

    if (countdownsSnapshot.empty) {
      return res.send("// No hay countdowns activos");
    }

    // Obtener todos los countdowns activos
    const countdowns = [];
    countdownsSnapshot.forEach(doc => {
      const data = doc.data();
      const now = new Date();
      const startDate = data.startDate ? new Date(data.startDate) : null;
      const endDate = new Date(data.endDate);

      // Filtrar segÃºn tipo y fechas
      let shouldShow = false;

      if (data.type === 'active') {
        // Flash Sale: mostrar si no ha expirado
        shouldShow = now < endDate;
      } else if (data.type === 'upcoming') {
        // Upcoming: mostrar solo entre startDate y endDate
        shouldShow = startDate && now >= startDate && now < endDate;
      }

      if (shouldShow) {
        countdowns.push({
          id: doc.id,
          ...data
        });
      }
    });

    if (countdowns.length === 0) {
      return res.send("// No hay countdowns activos en este momento");
    }

    // Tomar el primer countdown activo (se puede mejorar con prioridad)
    const countdown = countdowns[0];

    const script = `
(function() {
  'use strict';

  const COUNTDOWN_CONFIG = ${JSON.stringify(countdown)};
  const API_URL = 'https://apipromonube-jlfopowzaq-uc.a.run.app';

  // Prevenir mÃºltiples inicializaciones
  if (window.promonubeCountdownLoaded) return;
  window.promonubeCountdownLoaded = true;

  function initCountdown() {
    // Verificar si ya existe
    if (document.getElementById('pn-countdown-bar')) return;

    // Calcular altura de la barra
    const barHeight = 60; // altura estimada en px

    // Crear barra de countdown
    const bar = document.createElement('div');
    bar.id = 'pn-countdown-bar';
    bar.style.cssText = \`
      position: \${COUNTDOWN_CONFIG.pushContent !== false ? 'relative' : 'fixed'};
      \${COUNTDOWN_CONFIG.position === 'top' && COUNTDOWN_CONFIG.pushContent === false ? 'top: 0;' : ''}
      \${COUNTDOWN_CONFIG.position === 'bottom' && COUNTDOWN_CONFIG.pushContent === false ? 'bottom: 0;' : ''}
      left: 0;
      right: 0;
      background: \${COUNTDOWN_CONFIG.backgroundColor || '#000000'};
      color: \${COUNTDOWN_CONFIG.textColor || '#ffffff'};
      padding: \${COUNTDOWN_CONFIG.padding || '14px 20px'};
      display: flex;
      align-items: center;
      justify-content: center;
      gap: \${COUNTDOWN_CONFIG.gap || '24px'};
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      box-shadow: \${COUNTDOWN_CONFIG.shadow || '0 4px 12px rgba(0,0,0,0.15)'};
      flex-wrap: wrap;
      border-bottom: \${COUNTDOWN_CONFIG.position === 'top' && COUNTDOWN_CONFIG.borderBottom ? COUNTDOWN_CONFIG.borderBottom : 'none'};
      border-top: \${COUNTDOWN_CONFIG.position === 'bottom' && COUNTDOWN_CONFIG.borderTop ? COUNTDOWN_CONFIG.borderTop : 'none'};
      backdrop-filter: \${COUNTDOWN_CONFIG.blur ? 'blur(10px)' : 'none'};
      animation: pnCountdownSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    \`;

    // Agregar animaciÃ³n
    if (!document.getElementById('pn-countdown-styles')) {
      const style = document.createElement('style');
      style.id = 'pn-countdown-styles';
      style.textContent = \`
        @keyframes pnCountdownSlideIn {
          from {
            opacity: 0;
            transform: translateY(\${COUNTDOWN_CONFIG.position === 'top' ? '-100%' : '100%'});
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          #pn-countdown-bar {
            padding: 12px 16px !important;
            gap: 16px !important;
          }
        }
      \`;
      document.head.appendChild(style);
    }

    // Insertar la barra en la posiciÃ³n correcta
    if (COUNTDOWN_CONFIG.position === 'top' && COUNTDOWN_CONFIG.pushContent !== false) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else {
      document.body.appendChild(bar);
    }

    // Mensaje con icono opcional
    const message = document.createElement('div');
    message.style.cssText = \`
      font-size: \${COUNTDOWN_CONFIG.messageFontSize || '16px'};
      font-weight: \${COUNTDOWN_CONFIG.messageFontWeight || '600'};
      color: \${COUNTDOWN_CONFIG.textColor || '#ffffff'};
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: \${COUNTDOWN_CONFIG.letterSpacing || '0.3px'};
    \`;
    if (COUNTDOWN_CONFIG.icon) {
      message.innerHTML = \`\${COUNTDOWN_CONFIG.icon} <span>\${COUNTDOWN_CONFIG.message || ''}</span>\`;
    } else {
      message.textContent = COUNTDOWN_CONFIG.message || '';
    }

    // Timer con estilo mejorado
    const timer = document.createElement('div');
    timer.id = 'pn-countdown-timer';
    timer.style.cssText = \`
      display: flex;
      gap: \${COUNTDOWN_CONFIG.timerGap || '8px'};
      font-weight: \${COUNTDOWN_CONFIG.timerFontWeight || '700'};
      font-size: \${COUNTDOWN_CONFIG.timerFontSize || '18px'};
      color: \${COUNTDOWN_CONFIG.timerColor || '#ffffff'};
      font-variant-numeric: tabular-nums;
      letter-spacing: \${COUNTDOWN_CONFIG.timerLetterSpacing || '1px'};
    \`;

    bar.appendChild(message);
    bar.appendChild(timer);

    // BotÃ³n CTA solo para tipo 'active'
    if (COUNTDOWN_CONFIG.type === 'active' && COUNTDOWN_CONFIG.buttonText && COUNTDOWN_CONFIG.buttonUrl) {
      const button = document.createElement('a');
      button.href = COUNTDOWN_CONFIG.buttonUrl;
      button.textContent = COUNTDOWN_CONFIG.buttonText;
      button.style.cssText = \`
        background: \${COUNTDOWN_CONFIG.buttonColor || '#ffffff'};
        color: \${COUNTDOWN_CONFIG.buttonTextColor || '#000000'};
        padding: \${COUNTDOWN_CONFIG.buttonPadding || '10px 28px'};
        border-radius: \${COUNTDOWN_CONFIG.buttonRadius || '8px'};
        text-decoration: none;
        font-weight: \${COUNTDOWN_CONFIG.buttonFontWeight || '700'};
        font-size: \${COUNTDOWN_CONFIG.buttonFontSize || '14px'};
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        box-shadow: \${COUNTDOWN_CONFIG.buttonShadow || '0 2px 8px rgba(0,0,0,0.15)'};
        letter-spacing: 0.5px;
        text-transform: \${COUNTDOWN_CONFIG.buttonTextTransform || 'uppercase'};
        border: \${COUNTDOWN_CONFIG.buttonBorder || 'none'};
        white-space: nowrap;
      \`;
      button.onmouseenter = () => {
        button.style.transform = 'translateY(-2px) scale(1.02)';
        button.style.boxShadow = COUNTDOWN_CONFIG.buttonHoverShadow || '0 6px 16px rgba(0,0,0,0.25)';
        if (COUNTDOWN_CONFIG.buttonHoverColor) {
          button.style.background = COUNTDOWN_CONFIG.buttonHoverColor;
        }
      };
      button.onmouseleave = () => {
        button.style.transform = 'translateY(0) scale(1)';
        button.style.boxShadow = COUNTDOWN_CONFIG.buttonShadow || '0 2px 8px rgba(0,0,0,0.15)';
        button.style.background = COUNTDOWN_CONFIG.buttonColor || '#ffffff';
      };
      button.onclick = () => {
        trackCountdown('click');
      };
      bar.appendChild(button);
    }

    // BotÃ³n de cerrar opcional
    if (COUNTDOWN_CONFIG.showCloseButton !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
      closeBtn.style.cssText = \`
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: \${COUNTDOWN_CONFIG.textColor || '#ffffff'};
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s;
        padding: 4px 8px;
        font-weight: 300;
      \`;
      closeBtn.onmouseenter = () => closeBtn.style.opacity = '1';
      closeBtn.onmouseleave = () => closeBtn.style.opacity = '0.6';
      closeBtn.onclick = () => {
        bar.style.animation = 'pnCountdownSlideOut 0.3s ease-out forwards';
        setTimeout(() => bar.remove(), 300);
        // Guardar en localStorage para no volver a mostrar en esta sesiÃ³n
        localStorage.setItem('pn_countdown_closed_' + COUNTDOWN_CONFIG.id, Date.now());
      };
      bar.appendChild(closeBtn);

      // Agregar animaciÃ³n de salida
      const style = document.getElementById('pn-countdown-styles');
      if (style && !style.textContent.includes('pnCountdownSlideOut')) {
        style.textContent += \`
          @keyframes pnCountdownSlideOut {
            to {
              opacity: 0;
              transform: translateY(\${COUNTDOWN_CONFIG.position === 'top' ? '-100%' : '100%'});
            }
          }
        \`;
      }
    }

    // Verificar si fue cerrado previamente en esta sesiÃ³n
    const closedTime = localStorage.getItem('pn_countdown_closed_' + COUNTDOWN_CONFIG.id);
    if (closedTime && (Date.now() - closedTime < 3600000)) { // 1 hora
      return;
    }

    // Registrar impresiÃ³n
    trackCountdown('impression');

    // Iniciar countdown
    updateTimer();
  }

  function updateTimer() {
    const timerEl = document.getElementById('pn-countdown-timer');
    if (!timerEl) return;

    const now = new Date().getTime();
    const endTime = new Date(COUNTDOWN_CONFIG.endDate).getTime();
    const distance = endTime - now;

    if (distance < 0) {
      // Expirado
      timerEl.innerHTML = 'âŒ› Expirado';
      const bar = document.getElementById('pn-countdown-bar');
      if (bar) {
        setTimeout(() => bar.remove(), 3000);
      }
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    timerEl.innerHTML = \`
      <span>\${days}d</span>
      <span>:</span>
      <span>\${String(hours).padStart(2, '0')}h</span>
      <span>:</span>
      <span>\${String(minutes).padStart(2, '0')}m</span>
      <span>:</span>
      <span>\${String(seconds).padStart(2, '0')}s</span>
    \`;

    setTimeout(updateTimer, 1000);
  }

  function trackCountdown(action) {
    fetch(\`\${API_URL}/api/countdowns/\${COUNTDOWN_CONFIG.id}/track\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    }).catch(err => console.error('Error tracking:', err));
  }

  // Inicializar cuando el DOM estÃ© listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCountdown);
  } else {
    initCountdown();
  }

})();
`;

    res.send(script);
    
  } catch (error) {
    console.error("Error generando countdown script:", error);
    res.status(500).send(`// Error: ${error.message}`);
  }
});

// ============================================
// ENDPOINTS: NEW PRODUCT BADGE (Badge "Nuevo")
// ============================================

// GET /api/new-badge-config/:storeId - Obtiene configuraciÃ³n del badge
app.get("/api/new-badge-config/:storeId", async (req, res) => {
  const { storeId } = req.params;

  try {
    const configDoc = await db.collection("promonube_new_badge_config").doc(storeId).get();

    if (!configDoc.exists) {
      // Devolver configuraciÃ³n por defecto
      return res.json({
        success: true,
        config: {
          enabled: false,
          daysToShowAsNew: 30,
          badgeText: "NUEVO",
          badgePosition: "top-left",
          badgeShape: "rectangular",
          backgroundColor: "#ff4757",
          textColor: "#ffffff",
          fontSize: "12px",
          fontWeight: "700",
          padding: "6px 12px",
          borderRadius: "4px",
          showOnProductPage: true,
          showOnCategoryPage: true,
          showOnHomePage: true,
          customCSS: ""
        }
      });
    }

    res.json({
      success: true,
      config: configDoc.data()
    });
  } catch (error) {
    console.error("Error obteniendo config badge:", error);
    res.status(500).json({ success: false, message: "Error al obtener configuraciÃ³n" });
  }
});

// POST /api/new-badge-config/:storeId - Guarda o actualiza configuraciÃ³n del badge
app.post("/api/new-badge-config/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const config = req.body;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    const configData = {
      storeId,
      ...config,
      updatedAt: new Date().toISOString()
    };

    await db.collection("promonube_new_badge_config").doc(storeId).set(configData, { merge: true });

    console.log("âœ… ConfiguraciÃ³n de badge guardada para store:", storeId);

    res.json({ success: true, message: "ConfiguraciÃ³n guardada correctamente" });
  } catch (error) {
    console.error("Error guardando config badge:", error);
    res.status(500).json({ success: false, message: "Error al guardar configuraciÃ³n" });
  }
});

// GET /api/product-dates/:storeId - Obtiene fechas de creaciÃ³n de productos
app.get("/api/product-dates/:storeId", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const { storeId } = req.params;

  try {
    console.log(`📅 Obteniendo fechas de productos para store: ${storeId}`);
    
    // Buscar el store en Firestore para obtener el accessToken
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      console.warn(`âš ï¸ Tienda ${storeId} no encontrada en Firestore`);
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    if (!accessToken) {
      console.warn(`âš ï¸ Tienda ${storeId} no tiene accessToken`);
      return res.status(401).json({ success: false, message: "No hay token de acceso" });
    }

    console.log(`ðŸ”‘ AccessToken encontrado para store ${storeId}`);

    // Obtener TODOS los productos usando paginaciÃ³n
    let allProducts = [];
    let page = 1;
    let hasMore = true;
    const perPage = 200;

    while (hasMore) {
      console.log(`ðŸ“„ Obteniendo pÃ¡gina ${page}...`);
      
      const productsResponse = await fetch(
        `https://api.tiendanube.com/v1/${storeId}/products?per_page=${perPage}&page=${page}`,
        {
          headers: {
            "Authentication": `bearer ${accessToken}`,
            "User-Agent": "PromoNube App (contacto@promonube.com)"
          }
        }
      );

      if (!productsResponse.ok) {
        const errorText = await productsResponse.text();
        console.error(`âŒ Error de TiendaNube API: ${productsResponse.status}`, errorText);
        return res.status(productsResponse.status).json({ 
          success: false, 
          message: "Error al obtener productos de TiendaNube" 
        });
      }

      const products = await productsResponse.json();
      console.log(`âœ… PÃ¡gina ${page}: ${products.length} productos`);
      
      if (products.length > 0) {
        allProducts = allProducts.concat(products);
        page++;
        
        // Si recibimos menos de perPage, es la Ãºltima pÃ¡gina
        if (products.length < perPage) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`âœ… Total productos obtenidos: ${allProducts.length}`);

    // Crear mapa de product_id => created_at
    const productDates = {};
    allProducts.forEach(product => {
      productDates[product.id] = product.created_at;
    });

    console.log(`ðŸ“¦ Fechas procesadas: ${Object.keys(productDates).length} productos`);

    res.json({ success: true, productDates });

  } catch (error) {
    console.error("âŒ Error obteniendo fechas de productos:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener productos",
      error: error.message 
    });
  }
});

// GET /api/new-badge-script.js - Script embebible para mostrar badges en productos nuevos
app.get("/api/new-badge-script.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    // Obtener configuraciÃ³n del badge para esta tienda
    const configDoc = await db.collection("promonube_new_badge_config").doc(store).get();

    if (!configDoc.exists || !configDoc.data().enabled) {
      return res.send("// Badge de productos nuevos no estÃ¡ activo");
    }

    const config = configDoc.data();

    const script = `
(function() {
  'use strict';

  const BADGE_CONFIG = ${JSON.stringify(config)};
  const STORE_ID = "${store}";

  // Prevenir mÃºltiples inicializaciones
  if (window.promonubeNewBadgeLoaded) return;
  window.promonubeNewBadgeLoaded = true;

  console.log('ðŸ·ï¸ PromoNube New Badge Script cargado');

  // FunciÃ³n para calcular si un producto es "nuevo"
  function isProductNew(createdAtString) {
    if (!createdAtString) return false;
    
    const createdAt = new Date(createdAtString);
    const now = new Date();
    const daysDiff = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    return daysDiff <= BADGE_CONFIG.daysToShowAsNew;
  }

  // FunciÃ³n para crear el badge
  function createBadge() {
    const badge = document.createElement('div');
    badge.className = 'pn-new-product-badge';
    badge.textContent = BADGE_CONFIG.badgeText || 'NUEVO';
    
    // Posiciones
    const positions = {
      'top-left': 'top: 10px; left: 10px;',
      'top-right': 'top: 10px; right: 10px;',
      'bottom-left': 'bottom: 10px; left: 10px;',
      'bottom-right': 'bottom: 10px; right: 10px;'
    };

    // Formas
    let shapeStyles = '';
    switch(BADGE_CONFIG.badgeShape) {
      case 'circular':
        shapeStyles = 'border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; padding: 0;';
        break;
      case 'ribbon':
        shapeStyles = \`
          border-radius: 0;
          padding: 8px 16px;
          position: relative;
          \${BADGE_CONFIG.badgePosition.includes('right') ? 'padding-right: 20px;' : 'padding-left: 20px;'}
        \`;
        break;
      case 'rounded':
        shapeStyles = 'border-radius: 20px;';
        break;
      default:
        shapeStyles = \`border-radius: \${BADGE_CONFIG.borderRadius || '4px'};\`;
    }

    badge.style.cssText = \`
      position: absolute;
      \${positions[BADGE_CONFIG.badgePosition] || positions['top-left']}
      background: \${BADGE_CONFIG.backgroundColor || '#ff4757'};
      color: \${BADGE_CONFIG.textColor || '#ffffff'};
      font-size: \${BADGE_CONFIG.fontSize || '12px'};
      font-weight: \${BADGE_CONFIG.fontWeight || '700'};
      padding: \${BADGE_CONFIG.padding || '6px 12px'};
      \${shapeStyles}
      z-index: 10;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      animation: pnBadgeFadeIn 0.3s ease-out;
      \${BADGE_CONFIG.customCSS || ''}
    \`;

    // AÃ±adir pseudo-elemento para ribbon si aplica
    if (BADGE_CONFIG.badgeShape === 'ribbon') {
      const style = document.getElementById('pn-badge-ribbon-style') || document.createElement('style');
      if (!document.getElementById('pn-badge-ribbon-style')) {
        style.id = 'pn-badge-ribbon-style';
        style.textContent = \`
          .pn-new-product-badge.ribbon::after {
            content: '';
            position: absolute;
            \${BADGE_CONFIG.badgePosition.includes('right') ? 'right: 0;' : 'left: 0;'}
            bottom: -6px;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 6px 6px 0 0;
            border-color: \${BADGE_CONFIG.backgroundColor}44 transparent transparent transparent;
          }
        \`;
        document.head.appendChild(style);
      }
      badge.classList.add('ribbon');
    }

    return badge;
  }

  // FunciÃ³n para agregar badge a un producto
  function addBadgeToProduct(productElement, createdAt) {
    if (!isProductNew(createdAt)) return;
    
    // Verificar que no tenga ya un badge
    if (productElement.querySelector('.pn-new-product-badge')) return;

    // Buscar el contenedor de imagen del producto
    const imageContainer = productElement.querySelector('.product-image, .item-image, .product__media, [class*="product-img"], [class*="item-img"], img')?.closest('div, a, figure') || productElement.querySelector('a, div');
    
    if (!imageContainer) return;

    // Asegurar que el contenedor tenga posiciÃ³n relativa
    const currentPosition = window.getComputedStyle(imageContainer).position;
    if (currentPosition === 'static') {
      imageContainer.style.position = 'relative';
    }

    const badge = createBadge();
    imageContainer.appendChild(badge);
  }

  // Variable global para almacenar fechas de productos
  let productDatesMap = {};

  // FunciÃ³n para obtener fechas de productos desde la API
  async function loadProductDates() {
    try {
      const response = await fetch(\`https://apipromonube-jlfopowzaq-uc.a.run.app/api/product-dates/\${STORE_ID}\`);
      const data = await response.json();
      
      if (data.success && data.productDates) {
        productDatesMap = data.productDates;
        console.log(\`ðŸ·ï¸ PromoNube: \${Object.keys(productDatesMap).length} fechas de productos cargadas\`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cargando fechas de productos:', error);
      return false;
    }
  }

  // FunciÃ³n para procesar productos en TiendaNube
  function processProducts() {
    // Selectores comunes para productos en TiendaNube
    const productSelectors = [
      '[itemtype="http://schema.org/Product"]',
      '.product-item',
      '.item-product',
      '.product',
      '[data-product-id]',
      '.js-item-product'
    ];

    let productsFound = 0;

    productSelectors.forEach(selector => {
      const products = document.querySelectorAll(selector);
      
      products.forEach(product => {
        // Intentar obtener el product_id del elemento
        let productId = product.getAttribute('data-product-id') || 
                       product.getAttribute('data-id') ||
                       product.querySelector('[data-product-id]')?.getAttribute('data-product-id');
        
        // Si no estÃ¡ en data attributes, buscar en el link del producto
        if (!productId) {
          const productLink = product.querySelector('a[href*="/products/"]');
          if (productLink) {
            const match = productLink.href.match(/\\/products\\/(\\d+)/);
            if (match) productId = match[1];
          }
        }

        // Buscar por href en schema.org
        if (!productId) {
          const schemaUrl = product.querySelector('[itemprop="url"]')?.getAttribute('href');
          if (schemaUrl) {
            const match = schemaUrl.match(/\\/products\\/(\\d+)/);
            if (match) productId = match[1];
          }
        }

        if (productId && productDatesMap[productId]) {
          addBadgeToProduct(product, productDatesMap[productId]);
          productsFound++;
        }
      });
    });

    if (productsFound === 0) {
      console.log('âš ï¸ PromoNube: No se encontraron IDs de productos. Verifica los selectores.');
    } else {
      console.log(\`âœ… PromoNube: \${productsFound} badges de productos nuevos agregados\`);
    }
  }

  // Inyectar estilos CSS
  function injectStyles() {
    if (document.getElementById('pn-new-badge-styles')) return;

    const style = document.createElement('style');
    style.id = 'pn-new-badge-styles';
    style.textContent = \`
      @keyframes pnBadgeFadeIn {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    \`;
    document.head.appendChild(style);
  }

  // Observar cambios en el DOM para productos cargados dinÃ¡micamente
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
        }
      });
      if (shouldProcess) {
        setTimeout(processProducts, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Inicializar cuando el DOM estÃ© listo
  async function init() {
    injectStyles();
    
    // Cargar fechas de productos primero
    const datesLoaded = await loadProductDates();
    
    if (datesLoaded) {
      processProducts();
      observeDOM();

      // Re-procesar despuÃ©s de 1 segundo por si hay lazy loading
      setTimeout(processProducts, 1000);
    } else {
      console.warn('âš ï¸ PromoNube: No se pudieron cargar las fechas de productos');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
`;

    res.send(script);
    
  } catch (error) {
    console.error("Error generando new badge script:", error);
    res.status(500).send(`// Error: ${error.message}`);
  }
});

// ============================================
// BADGES SYSTEM ENDPOINTS (Multi-rule badges)
// ============================================

// GET /api/badges - Obtener todos los badges de una tienda
app.get("/api/badges", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    const badgesSnapshot = await db
      .collection("promonube_badges")
      .where("storeId", "==", storeId)
      .get();

    const badges = [];
    badgesSnapshot.forEach(doc => {
      badges.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Ordenar en el servidor en vez de Firestore
    badges.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA; // MÃ¡s recientes primero
    });

    res.json(badges);
  } catch (error) {
    console.error("Error obteniendo badges:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/badges/:badgeId - Obtener un badge especÃ­fico
app.get("/api/badges/:badgeId", async (req, res) => {
  const { badgeId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    const badgeDoc = await db.collection("promonube_badges").doc(badgeId).get();

    if (!badgeDoc.exists) {
      return res.status(404).json({ error: "Badge no encontrado" });
    }

    const badgeData = badgeDoc.data();

    // Verificar que el badge pertenece a la tienda
    if (badgeData.storeId !== storeId) {
      return res.status(403).json({ error: "No tienes acceso a este badge" });
    }

    res.json({
      id: badgeDoc.id,
      ...badgeData
    });
  } catch (error) {
    console.error("Error obteniendo badge:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/badges - Crear un nuevo badge
app.post("/api/badges", async (req, res) => {
  const {
    storeId,
    badgeName,
    badgeText,
    ruleType,
    ruleConfig,
    isActive,
    design
  } = req.body;

  if (!storeId || !badgeName || !badgeText || !ruleType) {
    return res.status(400).json({ 
      error: "storeId, badgeName, badgeText y ruleType son requeridos" 
    });
  }

  try {
    const newBadge = {
      storeId,
      badgeName,
      badgeText,
      ruleType,
      ruleConfig: ruleConfig || {},
      isActive: isActive ?? true,
      design: design || {
        shape: 'rectangle',
        position: 'top-right',
        backgroundColor: '#FF6B6B',
        textColor: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        animation: 'pulse',
        borderRadius: 4,
        showIcon: false,
        icon: 'â­'
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("promonube_badges").add(newBadge);

    res.json({
      id: docRef.id,
      ...newBadge,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error creando badge:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/badges/:badgeId - Actualizar un badge existente
app.put("/api/badges/:badgeId", async (req, res) => {
  const { badgeId } = req.params;
  const {
    storeId,
    badgeName,
    badgeText,
    ruleType,
    ruleConfig,
    isActive,
    design
  } = req.body;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    const badgeRef = db.collection("promonube_badges").doc(badgeId);
    const badgeDoc = await badgeRef.get();

    if (!badgeDoc.exists) {
      return res.status(404).json({ error: "Badge no encontrado" });
    }

    const existingData = badgeDoc.data();

    // Verificar que el badge pertenece a la tienda
    if (existingData.storeId !== storeId) {
      return res.status(403).json({ error: "No tienes acceso a este badge" });
    }

    const updatedBadge = {
      badgeName,
      badgeText,
      ruleType,
      ruleConfig: ruleConfig || {},
      isActive: isActive ?? true,
      design: design || existingData.design,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await badgeRef.update(updatedBadge);

    res.json({
      id: badgeId,
      storeId: existingData.storeId,
      ...updatedBadge,
      createdAt: existingData.createdAt,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error actualizando badge:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/badges/:badgeId - Eliminar un badge
app.delete("/api/badges/:badgeId", async (req, res) => {
  const { badgeId } = req.params;
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    const badgeRef = db.collection("promonube_badges").doc(badgeId);
    const badgeDoc = await badgeRef.get();

    if (!badgeDoc.exists) {
      return res.status(404).json({ error: "Badge no encontrado" });
    }

    const badgeData = badgeDoc.data();

    // Verificar que el badge pertenece a la tienda
    if (badgeData.storeId !== storeId) {
      return res.status(403).json({ error: "No tienes acceso a este badge" });
    }

    await badgeRef.delete();

    res.json({ 
      success: true, 
      message: "Badge eliminado correctamente" 
    });
  } catch (error) {
    console.error("Error eliminando badge:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/badges/:badgeId/toggle - Activar/desactivar un badge
app.patch("/api/badges/:badgeId/toggle", async (req, res) => {
  const { badgeId } = req.params;
  const storeId = req.body?.storeId || req.query?.storeId;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    const badgeRef = db.collection("promonube_badges").doc(badgeId);
    const badgeDoc = await badgeRef.get();

    if (!badgeDoc.exists) {
      return res.status(404).json({ error: "Badge no encontrado" });
    }

    const badgeData = badgeDoc.data();

    // Verificar que el badge pertenece a la tienda
    if (badgeData.storeId !== storeId) {
      return res.status(403).json({ error: "No tienes acceso a este badge" });
    }

    const newStatus = !badgeData.isActive;

    await badgeRef.update({
      isActive: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      enabled: newStatus,
      isActive: newStatus,
      message: newStatus ? "Badge activado" : "Badge desactivado"
    });
  } catch (error) {
    console.error("Error al cambiar estado del badge:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/badges-script.js - Script embebible para mostrar badges en productos
app.get("/api/badges-script.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    // Obtener todos los badges activos de esta tienda
    const badgesSnapshot = await db
      .collection("promonube_badges")
      .where("storeId", "==", store)
      .where("isActive", "==", true)
      .get();

    if (badgesSnapshot.empty) {
      return res.send("// No hay badges activos");
    }

    const badges = [];
    badgesSnapshot.forEach(doc => {
      badges.push({
        id: doc.id,
        ...doc.data()
      });
    });

    const script = `
(function() {
  'use strict';

  const BADGES_CONFIG = ${JSON.stringify(badges)};
  const STORE_ID = "${store}";

  // Prevenir mÃºltiples inicializaciones
  if (window.promonubeBadgesLoaded) return;
  window.promonubeBadgesLoaded = true;

  console.log('ðŸ·ï¸ PromoNube Badges Script cargado - ${badges.length} badges activos');

  let productDataMap = {};

  // Inyectar estilos CSS
  function injectStyles() {
    if (document.getElementById('pn-badges-styles')) return;

    const style = document.createElement('style');
    style.id = 'pn-badges-styles';
    style.textContent = \`
      .pn-badge {
        position: absolute;
        z-index: 10;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .pn-badge-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
      }

      @keyframes pnBadgePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      @keyframes pnBadgeBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }

      @keyframes pnBadgeShake {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-3deg); }
        75% { transform: rotate(3deg); }
      }

      @keyframes pnBadgeGlow {
        0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        50% { box-shadow: 0 0 20px currentColor; }
      }

      .pn-badge-animation-pulse {
        animation: pnBadgePulse 2s ease-in-out infinite;
      }

      .pn-badge-animation-bounce {
        animation: pnBadgeBounce 1.5s ease-in-out infinite;
      }

      .pn-badge-animation-shake {
        animation: pnBadgeShake 0.5s ease-in-out infinite;
      }

      .pn-badge-animation-glow {
        animation: pnBadgeGlow 2s ease-in-out infinite;
      }

      .pn-badge-flag {
        clip-path: polygon(0 0, 100% 0, 85% 50%, 100% 100%, 0 100%);
        padding-right: 20px;
      }

      .pn-badge-circle {
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
    \`;
    document.head.appendChild(style);
  }

  // Cargar datos de productos desde la API
  async function loadProductData() {
    try {
      const response = await fetch(\`https://apipromonube-jlfopowzaq-uc.a.run.app/api/products/metadata?storeId=\${STORE_ID}\`);
      const data = await response.json();
      productDataMap = data.products || {};
      console.log('ðŸ“¦ Datos de productos cargados:', Object.keys(productDataMap).length);
      return true;
    } catch (error) {
      console.error('Error cargando datos de productos:', error);
      return false;
    }
  }

  // Evaluar si un producto cumple con una regla de badge
  function evaluateBadgeRule(badge, productData) {
    const { ruleType, ruleConfig } = badge;

    switch (ruleType) {
      case 'all_products': {
        // Todos los productos siempre cumplen
        return true;
      }

      case 'new_products': {
        if (!productData.created_at) return false;
        const createdAt = new Date(productData.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        return daysDiff <= (ruleConfig.daysToShowAsNew || 7);
      }

      case 'manual': {
        return ruleConfig.productIds?.includes(productData.id);
      }

      case 'price_min': {
        const price = parseFloat(productData.price);
        return price >= (ruleConfig.minPrice || 0);
      }

      case 'price_max': {
        const price = parseFloat(productData.price);
        return price <= (ruleConfig.maxPrice || Infinity);
      }

      case 'discount': {
        if (!productData.compare_at_price || !productData.price) return false;
        const comparePrice = parseFloat(productData.compare_at_price);
        const price = parseFloat(productData.price);
        const discountPercent = ((comparePrice - price) / comparePrice) * 100;
        return discountPercent >= (ruleConfig.minDiscount || 0);
      }

      case 'stock_low': {
        const stock = parseInt(productData.stock || 0);
        return stock > 0 && stock <= (ruleConfig.maxStock || 5);
      }

      case 'category': {
        if (!productData.categories) return false;
        return ruleConfig.categoryIds?.some(catId =>
          productData.categories.includes(catId)
        );
      }

      case 'tags': {
        if (!productData.tags || !ruleConfig.tags || ruleConfig.tags.length === 0) return false;
        return ruleConfig.tags.some(tag =>
          productData.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
        );
      }

      default:
        return false;
    }
  }

  // Crear elemento de badge
  function createBadgeElement(badge) {
    const badgeEl = document.createElement('div');
    badgeEl.className = 'pn-badge';

    const { design } = badge;
    
    // Posiciones
    const positions = {
      'top-left': 'top: 10px; left: 10px;',
      'top-right': 'top: 10px; right: 10px;',
      'bottom-left': 'bottom: 10px; left: 10px;',
      'bottom-right': 'bottom: 10px; right: 10px;'
    };

    let borderRadius = design.borderRadius || 4;
    if (design.shape === 'circle') {
      badgeEl.classList.add('pn-badge-circle');
      borderRadius = 50;
    } else if (design.shape === 'flag') {
      badgeEl.classList.add('pn-badge-flag');
    }

    if (design.animation && design.animation !== 'none') {
      badgeEl.classList.add(\`pn-badge-animation-\${design.animation}\`);
    }

    badgeEl.style.cssText = \`
      \${positions[design.position] || positions['top-right']}
      background: \${design.backgroundColor || '#FF6B6B'};
      color: \${design.textColor || '#FFFFFF'};
      font-size: \${design.fontSize || 12}px;
      font-weight: \${design.fontWeight || 'bold'};
      padding: \${design.shape === 'circle' ? '0' : '6px 12px'};
      border-radius: \${design.shape === 'circle' ? '50%' : borderRadius + 'px'};
    \`;

    if (design.showIcon && design.icon) {
      const icon = document.createElement('span');
      icon.textContent = design.icon;
      badgeEl.appendChild(icon);
    }

    const text = document.createElement('span');
    text.textContent = badge.badgeText;
    badgeEl.appendChild(text);

    return badgeEl;
  }

  // Agregar badges a un producto
  function addBadgesToProduct(productElement, productId) {
    // Evitar duplicados
    if (productElement.querySelector('.pn-badge-container')) return;

    // OptimizaciÃ³n: Si hay badges de tipo "all_products", agregarlos directamente sin consultar metadata
    const allProductsBadges = BADGES_CONFIG.filter(badge => badge.ruleType === 'all_products');
    const otherBadges = BADGES_CONFIG.filter(badge => badge.ruleType !== 'all_products');

    let matchingBadges = [...allProductsBadges];

    // Solo consultar metadata si hay badges con otras reglas
    if (otherBadges.length > 0) {
      const productData = productDataMap[productId];
      if (productData) {
        const otherMatches = otherBadges.filter(badge => 
          evaluateBadgeRule(badge, productData)
        );
        matchingBadges = [...matchingBadges, ...otherMatches];
      }
    }

    if (matchingBadges.length === 0) return;

    const container = document.createElement('div');
    container.className = 'pn-badge-container';

    // Agregar solo el primer badge que coincida
    // (para evitar superposiciÃ³n, se puede mejorar con lÃ³gica de mÃºltiples badges)
    const badgeEl = createBadgeElement(matchingBadges[0]);
    container.appendChild(badgeEl);

    // Encontrar la imagen del producto
    const imageContainer = productElement.querySelector('.js-item-product, .product-image, .item-image') || 
                          productElement.querySelector('img')?.parentElement;

    if (imageContainer) {
      imageContainer.style.position = 'relative';
      imageContainer.appendChild(container);
    }
  }

  // Procesar todos los productos
  function processProducts() {
    const productSelectors = [
      '[itemtype="http://schema.org/Product"]',
      '.product-item',
      '.item-product',
      '.product',
      '[data-product-id]',
      '.js-item-product'
    ];

    let productsFound = 0;

    productSelectors.forEach(selector => {
      const products = document.querySelectorAll(selector);
      
      products.forEach(product => {
        let productId = product.getAttribute('data-product-id') || 
                       product.getAttribute('data-id') ||
                       product.querySelector('[data-product-id]')?.getAttribute('data-product-id');
        
        if (!productId) {
          const productLink = product.querySelector('a[href*="/products/"]');
          if (productLink) {
            const match = productLink.href.match(/\\/products\\/(\\d+)/);
            if (match) productId = match[1];
          }
        }

        if (!productId) {
          const schemaUrl = product.querySelector('[itemprop="url"]')?.getAttribute('href');
          if (schemaUrl) {
            const match = schemaUrl.match(/\\/products\\/(\\d+)/);
            if (match) productId = match[1];
          }
        }

        if (productId) {
          addBadgesToProduct(product, productId);
          productsFound++;
        }
      });
    });

    console.log(\`âœ… Badges procesados en \${productsFound} productos\`);
  }

  // Observar cambios en el DOM
  function observeDOM() {
    const observer = new MutationObserver(() => {
      processProducts();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Inicializar
  async function init() {
    injectStyles();
    
    // OptimizaciÃ³n: Solo cargar metadata si hay badges que la necesitan
    const needsMetadata = BADGES_CONFIG.some(badge => badge.ruleType !== 'all_products');
    
    if (needsMetadata) {
      console.log('ðŸ“Š Cargando metadata de productos...');
      const dataLoaded = await loadProductData();
      
      if (!dataLoaded) {
        console.warn('âš ï¸ PromoNube: No se pudieron cargar los datos de productos');
      }
    } else {
      console.log('âœ… Modo rÃ¡pido: Todos los badges son "all_products", no se necesita metadata');
    }

    processProducts();
    observeDOM();

    setTimeout(processProducts, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
`;

    res.send(script);
    
  } catch (error) {
    console.error("Error generando badges script:", error);
    res.status(500).send(`// Error: ${error.message}`);
  }
});

// GET /api/products/metadata - Obtener metadata de productos para evaluaciÃ³n de badges
app.get("/api/products/metadata", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    // Obtener el accessToken de la tienda
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: "No hay token de acceso" });
    }

    // Obtener productos de TiendaNube con paginaciÃ³n
    let allProducts = [];
    let page = 1;
    let hasMore = true;
    const perPage = 200;

    while (hasMore) {
      const response = await fetch(
        `https://api.tiendanube.com/v1/${storeId}/products?per_page=${perPage}&page=${page}`,
        {
          headers: {
            "Authentication": `bearer ${accessToken}`,
            "User-Agent": "PromoNube App (contacto@promonube.com)"
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`âŒ Error TiendaNube API (metadata) status ${response.status}:`, errorText);
        // Si falla, devolver lo que tengamos hasta ahora
        break;
      }

      const products = await response.json();
      
      if (products.length > 0) {
        allProducts = allProducts.concat(products);
        page++;
        if (products.length < perPage) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    // Crear mapa de metadata de productos
    const productsMap = {};
    
    allProducts.forEach(product => {
      // Calcular stock total del producto
      const totalStock = product.variants?.reduce((sum, variant) => {
        return sum + (parseInt(variant.stock) || 0);
      }, 0) || 0;

      productsMap[product.id] = {
        id: product.id,
        name: product.name?.es || product.name,
        price: product.variants?.[0]?.price || 0,
        compare_at_price: product.variants?.[0]?.compare_at_price || null,
        created_at: product.created_at,
        categories: product.categories?.map(cat => cat.id) || [],
        tags: product.tags || [],
        stock: totalStock
      };
    });

    console.log(`âœ… Metadata de productos: ${Object.keys(productsMap).length} productos para store ${storeId}`);

    res.json({
      products: productsMap,
      total: allProducts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error obteniendo metadata de productos:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tiendanube/products/search - Buscar productos
app.get("/api/tiendanube/products/search", async (req, res) => {
  const { storeId, q } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  if (!q || !q.trim()) {
    return res.json([]);
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: "No hay token de acceso" });
    }

    const response = await fetch(
      `https://api.tiendanube.com/v1/${storeId}/products?q=${encodeURIComponent(q)}&per_page=10`,
      {
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "PromoNube App (contacto@promonube.com)"
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error TiendaNube search:", response.status, errorText);
      return res.status(response.status).json({ error: "Error buscando productos en TiendaNube" });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Error buscando productos:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tiendanube/categories - Obtener categorÃ­as
app.get("/api/tiendanube/categories", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId requerido" });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: "No hay token de acceso" });
    }

    // Paginar para traer TODAS las categorías
    let allCategories = [];
    let page = 1;
    let hasMore = true;
    const perPage = 200;

    while (hasMore) {
      const response = await fetch(
        `https://api.tiendanube.com/v1/${storeId}/categories?per_page=${perPage}&page=${page}`,
        {
          headers: {
            "Authentication": `bearer ${accessToken}`,
            "User-Agent": "PromoNube App (contacto@promonube.com)"
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error TiendaNube categories:", response.status, errorText);
        return res.status(response.status).json({ error: "Error obteniendo categorías" });
      }

      const data = await response.json();
      if (data.length > 0) {
        allCategories = allCategories.concat(data);
        page++;
        if (data.length < perPage) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    res.json(allCategories);

  } catch (error) {
    console.error("Error obteniendo categorÃ­as:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STYLE CUSTOMIZATION ENDPOINTS
// ============================================

// GET /api/tiendanube/menus - Obtener menÃºs de TiendaNube con sus items
app.get("/api/tiendanube/menus", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    // Buscar el store en Firestore para obtener el accessToken
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      console.log("Tienda no encontrada:", storeId);
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    const storeData = storeDoc.data();
    const accessToken = storeData.accessToken;

    if (!accessToken) {
      console.log("No hay accessToken para store:", storeId);
      return res.status(401).json({ success: false, message: "No hay token de acceso" });
    }

    console.log("Llamando a TiendaNube API para store:", storeId);

    // Llamar a la API de TiendaNube para obtener los menÃºs
    const menusResponse = await axios.get(
      `https://api.tiendanube.com/v1/${storeId}/navigation_menus`,
      {
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "PromoNube App (contacto@promonube.com)"
        }
      }
    );

    console.log("MenÃºs obtenidos:", menusResponse.data.length);

    // Para cada menÃº, obtener sus items
    const menusWithItems = await Promise.all(
      menusResponse.data.map(async (menu) => {
        try {
          const itemsResponse = await axios.get(
            `https://api.tiendanube.com/v1/${storeId}/navigation_menus/${menu.id}/navigation_menu_items`,
            {
              headers: {
                "Authentication": `bearer ${accessToken}`,
                "User-Agent": "PromoNube App (contacto@promonube.com)"
              }
            }
          );
          
          console.log(`MenÃº ${menu.name}: ${itemsResponse.data.length} items`);
          
          return {
            id: menu.id,
            name: menu.name,
            handle: menu.handle,
            items: itemsResponse.data.map(item => ({
              id: item.id,
              name: item.name,
              position: item.position
            }))
          };
        } catch (error) {
          console.error(`Error obteniendo items del menÃº ${menu.id}:`, error.message);
          return {
            id: menu.id,
            name: menu.name,
            handle: menu.handle,
            items: []
          };
        }
      })
    );

    console.log("Enviando respuesta con", menusWithItems.length, "menÃºs");

    res.json({
      success: true,
      menus: menusWithItems
    });
  } catch (error) {
    console.error("Error obteniendo menÃºs de TiendaNube:", error.message);
    console.error("Error completo:", error.response?.data || error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener menÃºs",
      details: error.message,
      apiError: error.response?.data || null
    });
  }
});

// GET /api/style-config - Obtener configuraciÃ³n de personalizaciÃ³n
app.get("/api/style-config", async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    const styleDoc = await db.collection("promonube_style_config").doc(storeId).get();
    
    if (!styleDoc.exists) {
      // Retornar configuraciÃ³n por defecto
      return res.json({
        success: true,
        config: {
          whatsapp: {
            enabled: false,
            backgroundColor: '#25D366',
            hoverColor: '#128C7E'
          },
          menu: {
            enabled: false,
            items: []
          },
          banners: {
            enabled: false,
            slides: []
          },
          lightToggle: {
            enabled: false,
            categoryUrls: [],
            label: 'Light:'
          }
        }
      });
    }

    res.json({
      success: true,
      config: styleDoc.data()
    });
  } catch (error) {
    console.error("Error obteniendo style config:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// ============================================
// HELPER: Asegurar que el script de Style estÃ© instalado
// ============================================
async function ensureStyleScriptInstalled(storeId) {
  try {
    console.log(`ðŸ” Verificando script de Style para store ${storeId}...`);

    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      console.log(`âš ï¸  Store ${storeId} no encontrado en Firestore`);
      return;
    }

    const accessToken = storeDoc.data().accessToken;
    const scriptUrl = `${CLOUD_FUNCTION_URL}/style-widget.js?store=${storeId}`;

    // Listar scripts existentes
    const scriptsResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)'
      }
    });

    if (!scriptsResponse.ok) {
      console.log(`âš ï¸  Error consultando scripts: ${scriptsResponse.status}`);
      return;
    }

    const scriptsData = await scriptsResponse.json();
    const scripts = Array.isArray(scriptsData) ? scriptsData : (scriptsData.result || []);
    
    // Buscar si ya existe un script de style
    const existingScript = scripts.find(s => 
      s.src && s.src.includes('style-widget')
    );

    if (existingScript) {
      console.log(`âœ… Script de Style ya instalado (ID: ${existingScript.id || 'N/A'})`);
      return;
    }

    // Instalar el script
    console.log(`ðŸ“¦ Instalando script de Style...`);
    const installResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/scripts`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'GlowLab (info@techdi.com.ar)',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: 'onload',
        src: scriptUrl,
        where: 'store'
      })
    });

    if (!installResponse.ok) {
      const errorText = await installResponse.text();
      console.log(`âš ï¸  No se pudo instalar script automÃ¡ticamente: ${errorText}`);
      return;
    }

    const installedScript = await installResponse.json();
    console.log(`âœ… Script de Style instalado exitosamente (ID: ${installedScript.id || 'N/A'})`);
  } catch (error) {
    console.error(`âŒ Error en ensureStyleScriptInstalled:`, error.message);
  }
}

// POST /api/style-config - Guardar configuraciÃ³n de personalizaciÃ³n
app.post("/api/style-config", async (req, res) => {
  const { storeId, config } = req.body;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    // Guardar configuraciÃ³n
    await db.collection("promonube_style_config").doc(storeId).set({
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log("âœ… Style config guardada para store:", storeId);

    // Asegurar que el script estÃ© instalado (en background, no bloquea la respuesta)
    ensureStyleScriptInstalled(storeId).catch(err => {
      console.error("âš ï¸  Error asegurando script instalado:", err.message);
    });

    res.json({
      success: true,
      message: "ConfiguraciÃ³n guardada correctamente"
    });
  } catch (error) {
    console.error("Error guardando style config:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// ============================================
// ENHANCED SEARCH ENDPOINTS
// ============================================

// GET /api/enhanced-search-config/:storeId - Obtener configuraciÃ³n del buscador mejorado
app.get("/api/enhanced-search-config/:storeId", async (req, res) => {
  const { storeId } = req.params;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    // Leer desde promonube_style_config donde se guarda todo
    const styleDoc = await db.collection("promonube_style_config").doc(storeId).get();
    
    if (!styleDoc.exists || !styleDoc.data().enhancedSearch) {
      // ConfiguraciÃ³n por defecto
      return res.json({
        success: true,
        config: {
          enabled: false,
          popularSearches: [
            { text: 'sillas', link: '' },
            { text: 'mesas', link: '' },
            { text: 'decoraciÃ³n', link: '' }
          ],
          primaryColor: '#000000',
          textColor: '#1a1a1a',
          backgroundColor: '#ffffff',
          maxResults: 8
        }
      });
    }

    res.json({
      success: true,
      config: styleDoc.data().enhancedSearch
    });
  } catch (error) {
    console.error("Error obteniendo enhanced search config:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// GET /api/enhanced-search-script.js - Servir el script Enhanced Search dinÃ¡micamente (sin cache)
app.get("/api/enhanced-search-script.js", (req, res) => {
  const scriptContent = `// ðŸ” PromoNube Enhanced Search - Script de Buscador Mejorado
// Version: 1.2.0 - Servido dinÃ¡micamente
// Ãšltima actualizaciÃ³n: Enero 13, 2026

(function() {
  'use strict';
  
  console.log('ðŸ” PromoNube Enhanced Search cargando... v1.2');
  
  const API_URL = 'https://apipromonube-jlfopowzaq-uc.a.run.app';
  
  let STORE_ID = null;
  
  if (typeof window.LS !== 'undefined' && window.LS.store) {
    STORE_ID = window.LS.store.id || window.LS.store.storeId;
  }
  
  if (!STORE_ID) {
    const storeIdMeta = document.querySelector('meta[name="store-id"]');
    if (storeIdMeta) {
      STORE_ID = storeIdMeta.getAttribute('content');
    }
  }
  
  if (!STORE_ID) {
    const storeData = document.querySelector('[data-store-id]');
    if (storeData) {
      STORE_ID = storeData.getAttribute('data-store-id');
    }
  }
  
  if (!STORE_ID) {
    console.error('âŒ PromoNube Enhanced Search: No se pudo detectar el storeId');
    return;
  }
  
  console.log('âœ… PromoNube Enhanced Search: Store ID detectado:', STORE_ID);
  
  if (window.promonubeEnhancedSearchLoaded) {
    console.log('âš ï¸ PromoNube Enhanced Search: Ya estÃ¡ cargado');
    return;
  }
  window.promonubeEnhancedSearchLoaded = true;
  
  fetch(\`\${API_URL}/api/enhanced-search-config/\${STORE_ID}\`)
    .then(response => response.json())
    .then(data => {
      if (!data.success || !data.config) {
        console.log('âš ï¸ PromoNube Enhanced Search: No hay configuraciÃ³n');
        return;
      }
      
      const CONFIG = data.config;
      
      if (!CONFIG.enabled) {
        console.log('â„¹ï¸ PromoNube Enhanced Search: Desactivado en configuraciÃ³n');
        return;
      }
      
      console.log('âœ… PromoNube Enhanced Search: ConfiguraciÃ³n cargada', CONFIG);
      initEnhancedSearch(CONFIG);
    })
    .catch(error => {
      console.error('âŒ PromoNube Enhanced Search: Error cargando configuraciÃ³n', error);
    });
  
  function findSearchInput() {
    const selectors = [
      'input[type="search"]',
      'input[name="q"]',
      'input[placeholder*="uscar"]',
      'input[placeholder*="earch"]',
      '.js-search-input',
      '.search-input',
      '#search-input',
      'input[aria-label*="uscar"]',
      'input[aria-label*="earch"]'
    ];
    
    for (const sel of selectors) {
      const input = document.querySelector(sel);
      if (input) {
        console.log('âœ… Input de bÃºsqueda encontrado:', sel);
        return input;
      }
    }
    return null;
  }
  
  function createPopularDropdown(CONFIG) {
    const primaryColor = CONFIG.primaryColor || '#000000';
    const textColor = CONFIG.textColor || '#1a1a1a';
    const bgColor = CONFIG.backgroundColor || '#ffffff';
    
    const dropdown = document.createElement('div');
    dropdown.id = 'pn-search-dropdown';
    dropdown.style.cssText = \`
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: linear-gradient(to bottom, \${bgColor} 0%, \${adjustColorBrightness(bgColor, -5)} 100%);
      border: 2px solid \${primaryColor};
      border-top: none;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      z-index: 99999;
      display: none;
      max-height: 450px;
      overflow-y: auto;
      margin-top: -2px;
    \`;
    
    if (CONFIG.popularSearches && CONFIG.popularSearches.length > 0) {
      const header = document.createElement('div');
      header.style.cssText = \`
        padding: 20px 24px 14px 24px;
        font-weight: 800;
        font-size: 11px;
        color: \${primaryColor};
        text-transform: uppercase;
        letter-spacing: 1.2px;
        border-bottom: 2px solid \${primaryColor}20;
        background: linear-gradient(135deg, \${primaryColor}05 0%, \${primaryColor}10 100%);
      \`;
      header.innerHTML = 'ðŸ”¥ <span style="margin-left: 6px;">BÃºsquedas Populares</span>';
      dropdown.appendChild(header);
      
      CONFIG.popularSearches.forEach(function(search) {
        if (!search.text || search.text.trim() === '') return;
        
        const item = document.createElement('a');
        item.href = search.link || \`/search?q=\${encodeURIComponent(search.text)}\`;
        item.style.cssText = \`
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 24px;
          color: \${textColor};
          text-decoration: none;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-bottom: 1px solid \${adjustColorBrightness(bgColor, -10)};
          background: \${bgColor};
          position: relative;
          overflow: hidden;
        \`;
        
        const iconWrapper = document.createElement('div');
        iconWrapper.style.cssText = \`
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, \${primaryColor}15 0%, \${primaryColor}25 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.25s;
        \`;
        iconWrapper.innerHTML = '<span style="font-size: 18px;">ðŸ”</span>';
        item.appendChild(iconWrapper);
        
        const textWrapper = document.createElement('div');
        textWrapper.style.cssText = 'flex: 1; display: flex; align-items: center; justify-content: space-between;';
        
        const text = document.createElement('span');
        text.textContent = search.text;
        text.style.cssText = \`font-weight: 600; color: \${textColor};\`;
        textWrapper.appendChild(text);
        
        const arrow = document.createElement('span');
        arrow.innerHTML = 'â†’';
        arrow.style.cssText = \`
          font-size: 20px;
          color: \${primaryColor};
          opacity: 0;
          transform: translateX(-10px);
          transition: all 0.25s;
        \`;
        textWrapper.appendChild(arrow);
        
        item.appendChild(textWrapper);
        
        item.addEventListener('mouseenter', function() {
          item.style.background = \`linear-gradient(135deg, \${primaryColor}08 0%, \${primaryColor}12 100%)\`;
          item.style.paddingLeft = '28px';
          item.style.transform = 'scale(1.02)';
          iconWrapper.style.transform = 'rotate(15deg) scale(1.1)';
          iconWrapper.style.background = \`linear-gradient(135deg, \${primaryColor}25 0%, \${primaryColor}35 100%)\`;
          arrow.style.opacity = '1';
          arrow.style.transform = 'translateX(0)';
        });
        
        item.addEventListener('mouseleave', function() {
          item.style.background = bgColor;
          item.style.paddingLeft = '24px';
          item.style.transform = 'scale(1)';
          iconWrapper.style.transform = 'rotate(0) scale(1)';
          iconWrapper.style.background = \`linear-gradient(135deg, \${primaryColor}15 0%, \${primaryColor}25 100%)\`;
          arrow.style.opacity = '0';
          arrow.style.transform = 'translateX(-10px)';
        });
        
        dropdown.appendChild(item);
      });
    }
    
    return dropdown;
  }
  
  function adjustColorBrightness(hex, percent) {
    if (!hex || !hex.match(/^#[0-9A-F]{6}$/i)) {
      return hex;
    }
    
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + percent));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
    const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
    
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  
  function initEnhancedSearch(CONFIG) {
    const searchInput = findSearchInput();
    
    if (!searchInput) {
      console.log('âš ï¸ PromoNube Enhanced Search: Input de bÃºsqueda no encontrado');
      setTimeout(() => initEnhancedSearch(CONFIG), 1000);
      return;
    }
    
    console.log('âœ… PromoNube Enhanced Search: Inicializando...');
    
    const container = searchInput.closest('form, .search-form, .search-container, .header-search') || searchInput.parentElement;
    const currentPosition = window.getComputedStyle(container).position;
    if (currentPosition === 'static') {
      container.style.position = 'relative';
    }
    
    const dropdown = createPopularDropdown(CONFIG);
    container.appendChild(dropdown);
    
    const primaryColor = CONFIG.primaryColor || '#000000';
    const originalBorderRadius = searchInput.style.borderRadius;
    
    searchInput.style.transition = 'all 0.3s ease';
    
    searchInput.addEventListener('focus', function() {
      dropdown.style.display = 'block';
      searchInput.style.borderColor = primaryColor;
      searchInput.style.borderWidth = '2px';
      searchInput.style.borderRadius = '12px 12px 0 0';
      searchInput.style.outline = 'none';
      searchInput.style.boxShadow = \`0 0 0 3px \${primaryColor}20\`;
    });
    
    document.addEventListener('click', function(e) {
      if (!container.contains(e.target)) {
        dropdown.style.display = 'none';
        searchInput.style.borderRadius = originalBorderRadius || '12px';
        searchInput.style.boxShadow = 'none';
      }
    });
    
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        searchInput.blur();
        searchInput.style.borderRadius = originalBorderRadius || '12px';
        searchInput.style.boxShadow = 'none';
      }
    });
    
    dropdown.addEventListener('click', function() {
      dropdown.style.display = 'none';
      searchInput.style.borderRadius = originalBorderRadius || '12px';
      searchInput.style.boxShadow = 'none';
    });
    
    console.log('âœ… PromoNube Enhanced Search: Inicializado correctamente');
  }
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');
  res.send(scriptContent);
});

// POST /api/enhanced-search-config/:storeId - Guardar configuraciÃ³n del buscador mejorado
app.post("/api/enhanced-search-config/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const config = req.body;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    await db.collection("promonube_enhanced_search").doc(storeId).set({
      ...config,
      storeId,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log("âœ… Enhanced Search config guardada para store:", storeId);

    res.json({
      success: true,
      message: "ConfiguraciÃ³n de buscador guardada correctamente"
    });
  } catch (error) {
    console.error("Error guardando enhanced search config:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// GET /api/style-widget.js - Script de personalizaciÃ³n embebible
app.get("/api/style-widget.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    // Cargar configuraciÃ³n desde Firestore
    const styleDoc = await db.collection("promonube_style_config").doc(store).get();
    
    if (!styleDoc.exists) {
      return res.send("// No hay configuraciÃ³n de Style");
    }

    const config = styleDoc.data();

    // Script simplificado - WhatsApp y Banners
    const script = `
(function() {
  'use strict';

  const CONFIG = ${JSON.stringify(config)};

  if (window.promonubeStyleLoaded) return;
  window.promonubeStyleLoaded = true;

  function customizeWhatsApp() {
    if (!CONFIG.whatsapp || !CONFIG.whatsapp.enabled) return;
    
    const wa = CONFIG.whatsapp;
    const selectors = [
      '.whatsapp-button',
      '.js-btn-fixed-bottom',
      'a[href*="wa.me"]',
      'a[href*="api.whatsapp.com"]'
    ];
    
    // Buscar SOLO el botÃ³n flotante de WhatsApp (no links en footer u otras secciones)
    let btn = null;
    for (const sel of selectors) {
      const candidates = document.querySelectorAll(sel);
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        const style = window.getComputedStyle(el);
        // El botÃ³n flotante de WPP tÃ­picamente es fixed/absolute y tiene aspecto de botÃ³n circular
        if (style.position === 'fixed' || style.position === 'absolute' || 
            el.classList.contains('whatsapp-button') || el.classList.contains('js-btn-fixed-bottom')) {
          // Verificar que NO estÃ¡ dentro del footer
          if (!el.closest('footer') && !el.closest('.footer') && !el.closest('#footer')) {
            btn = el;
            break;
          }
        }
      }
      if (btn) break;
    }

    if (!btn) return;

    // Marcar el botÃ³n encontrado con una clase Ãºnica para aplicar estilos solo a Ã©l
    btn.classList.add('pn-wa-customized');

    const styleEl = document.createElement('style');
    styleEl.id = 'pn-wa-style';
    
    const bgColor = wa.backgroundColor || '#25D366';
    const hoverColor = wa.hoverColor || '#128C7E';
    
    let css = '';
    css += '.pn-wa-customized { ';
    css += 'background-color: ' + bgColor + ' !important; ';
    css += 'transition: all 0.3s ease !important; ';
    css += '} ';
    css += '.pn-wa-customized:hover { ';
    css += 'background-color: ' + hoverColor + ' !important; ';
    css += 'transform: scale(1.05) !important; ';
    css += '} ';
    
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    console.log('PromoNube Style: WhatsApp customizado (solo botÃ³n flotante)');
  }

  function customizeBanners() {
    if (!CONFIG.banners || !CONFIG.banners.enabled) {
      console.log('PromoNube: Banners deshabilitado o no configurado');
      return;
    }
    if (!CONFIG.banners.slides || CONFIG.banners.slides.length === 0) {
      console.log('PromoNube: No hay slides configurados');
      return;
    }

    console.log('PromoNube Banners: Iniciando...', CONFIG.banners);

    // Buscar SOLO los slides del carrusel principal del home (NO productos)
    // IMPORTANTE: Excluir explÃ­citamente los slides de productos
    let slides = null;
    
    // Intentar selector mÃ¡s especÃ­fico para el home banner principal
    const homeSlider = document.querySelector('.js-home-main-slider-container:not(.js-product-slider)');
    
    if (homeSlider) {
      slides = homeSlider.querySelectorAll('.swiper-slide .slider-slide');
      console.log('PromoNube: Usando selector con .slider-slide:', slides.length);
      
      if (slides.length === 0) {
        slides = homeSlider.querySelectorAll('.swiper-slide');
        console.log('PromoNube: Usando selector .swiper-slide:', slides.length);
      }
    }
    
    // Filtrar SOLO slides que NO estÃ©n dentro de .js-product-slider o product-detail
    if (slides && slides.length > 0) {
      slides = Array.from(slides).filter(function(slide) {
        const isProductSlide = slide.closest('.js-product-slider') || 
                              slide.closest('.product-detail') ||
                              slide.closest('[class*="product-slider"]') ||
                              slide.closest('[class*="product-detail"]');
        const containerSlide = slide.closest('.swiper-slide');
        const isDuplicate = (slide.classList && slide.classList.contains('swiper-slide-duplicate')) ||
                            (containerSlide && containerSlide.classList.contains('swiper-slide-duplicate'));
        return !isProductSlide && !isDuplicate;
      });
      console.log('PromoNube: Slides despuÃ©s de filtrar productos/duplicados:', slides.length);
    } else {
      slides = [];
    }
    
    console.log('PromoNube: Slides finales encontrados:', slides.length);
    console.log('PromoNube: Slides configurados:', CONFIG.banners.slides.length);

    if (slides.length === 0) {
      console.warn('PromoNube: NO SE ENCONTRARON SLIDES DEL CARRUSEL PRINCIPAL');
      return;
    }

    CONFIG.banners.slides.forEach(function(slide) {
      const slideIndex = slide.slideIndex;
      const slideElement = slides[slideIndex];
      
      console.log('PromoNube: Procesando slide', slideIndex);
      
      if (!slideElement) {
        console.warn('PromoNube: No existe slide en Ã­ndice', slideIndex, '(solo hay', slides.length, 'slides)');
        return;
      }

      if (!slide.buttons || slide.buttons.length === 0) {
        console.log('PromoNube: Slide', slideIndex, 'no tiene botones configurados');
        return;
      }

      console.log('PromoNube: Agregando', slide.buttons.length, 'botones al slide', slideIndex);

      const container = document.createElement('div');
      container.className = 'pn-banner-buttons';
      
      const columns = slide.columns || 'auto';
      let gridCss = '';
      
      if (columns === 'auto') {
        gridCss = 'display: flex; flex-direction: row; align-items: center; flex-wrap: wrap;';
      } else {
        gridCss = 'display: grid; grid-template-columns: repeat(' + columns + ', 1fr); align-items: center;';
      }
      
      container.style.cssText = 'position: absolute; z-index: 9999 !important; ' + gridCss + ' gap: ' + (slide.gap || '12px') + '; justify-content: center; pointer-events: auto; max-width: ' + (slide.maxWidth || '90%') + ';';

      if (slide.position === 'center') {
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
      } else if (slide.position === 'bottom') {
        container.style.bottom = '40px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
      } else if (slide.position === 'top') {
        container.style.top = '40px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
      } else if (slide.position === 'left') {
        container.style.top = '50%';
        container.style.left = '40px';
        container.style.transform = 'translateY(-50%)';
        if (columns === 'auto') container.style.flexDirection = 'column';
      } else if (slide.position === 'right') {
        container.style.top = '50%';
        container.style.right = '40px';
        container.style.transform = 'translateY(-50%)';
        if (columns === 'auto') container.style.flexDirection = 'column';
      } else if (slide.position === 'top-left') {
        container.style.top = '40px';
        container.style.left = '40px';
        container.style.transform = 'none';
        if (columns === 'auto') container.style.flexDirection = 'column';
      } else if (slide.position === 'top-right') {
        container.style.top = '40px';
        container.style.right = '40px';
        container.style.transform = 'none';
        if (columns === 'auto') container.style.flexDirection = 'column';
      } else if (slide.position === 'bottom-left') {
        container.style.bottom = '40px';
        container.style.left = '40px';
        container.style.transform = 'none';
        if (columns === 'auto') container.style.flexDirection = 'column';
      } else if (slide.position === 'bottom-right') {
        container.style.bottom = '40px';
        container.style.right = '40px';
        container.style.transform = 'none';
        if (columns === 'auto') container.style.flexDirection = 'column';
      }

      slide.buttons.forEach(function(btnConfig) {
        // Cargar fuente de Google Fonts si es necesaria
        const btnFont = btnConfig.fontFamily || 'system-ui';
        if (btnFont !== 'system-ui' && btnFont.includes("'")) {
          var fontName = btnFont.split("'")[1];
          if (!document.querySelector('link[href*="' + fontName.replace(' ', '+') + '"]')) {
            var fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=' + fontName.replace(' ', '+') + ':wght@300;400;500;600;700;800;900&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
          }
        }

        const btn = document.createElement('a');
        btn.href = btnConfig.url || '#';
        btn.textContent = btnConfig.text || 'Ver mÃ¡s';
        btn.target = '_blank';
        
        // Manejar borde (retrocompatibilidad con campo 'border' antiguo)
        let border = 'none';
        if (btnConfig.borderWidth && btnConfig.borderWidth !== '0px') {
          const borderWidth = btnConfig.borderWidth || '0px';
          const borderStyle = btnConfig.borderStyle || 'solid';
          const borderColor = btnConfig.borderColor || '#000000';
          border = borderWidth + ' ' + borderStyle + ' ' + borderColor;
        } else if (btnConfig.border && btnConfig.border !== 'none') {
          border = btnConfig.border;
        }
        
        btn.style.cssText = 'position: relative; background: ' + (btnConfig.backgroundColor || 'rgba(0,0,0,1)') + '; color: ' + (btnConfig.textColor || '#ffffff') + '; padding: ' + (btnConfig.padding || '12px 32px') + '; border-radius: ' + (btnConfig.borderRadius || '8px') + '; text-decoration: none; font-weight: ' + (btnConfig.fontWeight || '700') + '; font-size: ' + (btnConfig.fontSize || '16px') + '; font-family: ' + (btnConfig.fontFamily || 'system-ui') + '; transition: all 0.3s ease; box-shadow: ' + (btnConfig.shadow || '0 4px 12px rgba(0,0,0,0.2)') + '; border: ' + border + '; text-transform: none !important; letter-spacing: 0.5px; display: inline-block; white-space: nowrap;' + (btnConfig.width && btnConfig.width !== 'auto' ? ' width: ' + btnConfig.width + '; text-align: center; box-sizing: border-box;' : '');

        btn.onmouseenter = function() {
          btn.style.transform = 'translateY(-2px) scale(1.05)';
          btn.style.boxShadow = btnConfig.hoverShadow || '0 6px 20px rgba(0,0,0,0.3)';
          if (btnConfig.hoverColor) {
            btn.style.backgroundColor = btnConfig.hoverColor;
          }
        };

        btn.onmouseleave = function() {
          btn.style.transform = 'translateY(0) scale(1)';
          btn.style.boxShadow = btnConfig.shadow || '0 4px 12px rgba(0,0,0,0.2)';
          btn.style.backgroundColor = btnConfig.backgroundColor || 'rgba(0,0,0,1)';
        };

        container.appendChild(btn);
        console.log('PromoNube: BotÃ³n agregado:', btnConfig.text);
      });

      if (getComputedStyle(slideElement).position === 'static') {
        slideElement.style.position = 'relative';
      }
      
      // Asegurar que el contenedor del slide tenga overflow visible
      slideElement.style.overflow = 'visible';

      slideElement.appendChild(container);
      console.log('PromoNube: âœ… Container de botones agregado al slide', slideIndex);
    });
    
    // Agregar estilos CSS responsivos para botones en mobile
    // IMPORTANTE: Solo afectar botones dentro del home slider, NO productos
    if (!document.getElementById('pn-banner-responsive-styles')) {
      var responsiveStyles = document.createElement('style');
      responsiveStyles.id = 'pn-banner-responsive-styles';
      responsiveStyles.textContent = 
        '/* Estilos SOLO para botones del banner principal (NO productos) */' +
        '.pn-banner-buttons { ' +
        '  display: flex !important; ' +
        '  visibility: visible !important; ' +
        '  opacity: 1 !important; ' +
        '}' +
        '.pn-banner-buttons a { ' +
        '  display: inline-block !important; ' +
        '  visibility: visible !important; ' +
        '  opacity: 1 !important; ' +
        '  pointer-events: auto !important; ' +
        '}' +
        '/* Tablet y mobile general */' +
        '@media (max-width: 768px) {' +
        '  .pn-banner-buttons { ' +
        '    max-width: 95% !important; ' +
        '    gap: 8px !important; ' +
        '    padding: 0 10px !important; ' +
        '    display: flex !important; ' +
        '    flex-wrap: wrap !important; ' +
        '    justify-content: center !important;' +
        '  }' +
        '  .pn-banner-buttons a { ' +
        '    font-size: 13px !important; ' +
        '    padding: 10px 18px !important; ' +
        '    letter-spacing: 0.3px !important; ' +
        '    white-space: nowrap !important; ' +
        '    text-align: center !important; ' +
        '    min-width: auto !important; ' +
        '    box-shadow: 0 3px 10px rgba(0,0,0,0.2) !important;' +
        '    display: inline-block !important;' +
        '    visibility: visible !important;' +
        '  }' +
        '}' +
        '/* Mobile pequeÃ±o */' +
        '@media (max-width: 480px) {' +
        '  .pn-banner-buttons { ' +
        '    gap: 8px !important; ' +
        '    flex-direction: column !important; ' +
        '    align-items: center !important;' +
        '    width: 90% !important;' +
        '    left: 50% !important;' +
        '    transform: translateX(-50%) !important;' +
        '    bottom: 30px !important;' +
        '    top: auto !important;' +
        '  }' +
        '  .pn-banner-buttons a { ' +
        '    font-size: 12px !important; ' +
        '    padding: 8px 16px !important; ' +
        '    border-radius: 6px !important; ' +
        '    font-weight: 600 !important;' +
        '    min-width: 140px !important;' +
        '    max-width: 220px !important;' +
        '    width: auto !important;' +
        '  }' +
        '}' +
        '/* Mobile muy pequeÃ±o */' +
        '@media (max-width: 360px) {' +
        '  .pn-banner-buttons a { ' +
        '    font-size: 11px !important; ' +
        '    padding: 7px 14px !important;' +
        '    min-width: 120px !important;' +
        '  }' +
        '}';
      document.head.appendChild(responsiveStyles);
      console.log('PromoNube: âœ… Estilos responsivos agregados para botones de banner');
    }
  }

  function customizeMenu() {
    if (!CONFIG.menu || !CONFIG.menu.enabled) {
      console.log('PromoNube: MenÃº deshabilitado o no configurado');
      return;
    }
    if (!CONFIG.menu.items || CONFIG.menu.items.length === 0) {
      console.log('PromoNube: No hay items de menÃº configurados');
      return;
    }

    console.log('PromoNube Menu: Iniciando...', CONFIG.menu);

    // Selector especÃ­fico para MOBILE
    var mobileSelector = '#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a';
    var mobileLinks = document.querySelectorAll(mobileSelector);

    var desktopLinks = [];

    // Buscar DESKTOP - todas las UL en el header
    var headerUls = document.querySelectorAll('header ul');
    console.log('PromoNube: Total de UL encontrados en header:', headerUls.length);
    
    for (var h = 0; h < headerUls.length; h++) {
      var ul = headerUls[h];
      var ulParent = ul.parentElement;
      var ulParentTag = ulParent ? ulParent.tagName.toLowerCase() : 'none';
      
      console.log('PromoNube: UL #' + h, '- Parent:', ulParentTag, '- Classes:', ul.className);
      
      // Solo procesar UL que NO estÃ©n dentro de un LI (no son submenÃºs)
      if (ulParentTag !== 'li') {
        var directChildren = ul.querySelectorAll(':scope > li');
        console.log('PromoNube: Este UL tiene', directChildren.length, 'LI hijos directos');
        
        // Inspeccionar estructura de cada LI del primer UL
        if (h === 0) {
          for (var inspect = 0; inspect < directChildren.length; inspect++) {
            var inspectLi = directChildren[inspect];
            console.log('PromoNube: LI #' + inspect + ' HTML:', inspectLi.innerHTML.substring(0, 200));
            
            // Buscar todos los links dentro de este LI
            var allLinks = inspectLi.querySelectorAll('a');
            console.log('PromoNube: LI #' + inspect + ' tiene', allLinks.length, 'links en total');
            if (allLinks.length > 0) {
              console.log('PromoNube: Primer link texto:', allLinks[0].textContent.trim());
            }
          }
        }
        
        // PRIMERO: Intentar encontrar categorÃ­as con submenÃº
        var categoriesWithSubmenu = [];
        for (var li = 0; li < directChildren.length; li++) {
          var liElement = directChildren[li];
          var link = liElement.querySelector(':scope > a');
          
          if (link) {
            var linkText = link.textContent.trim();
            var hasSubmenu = liElement.querySelector('ul') !== null;
            
            console.log('PromoNube: LI #' + li, '- Link:', linkText, '- Tiene submenÃº:', hasSubmenu);
            
            if (hasSubmenu) {
              categoriesWithSubmenu.push(link);
            }
          }
        }
        
        // Si encontrÃ³ categorÃ­as con submenÃº, usar esas
        if (categoriesWithSubmenu.length > 0) {
          desktopLinks = categoriesWithSubmenu;
          console.log('PromoNube: âœ… Encontradas', desktopLinks.length, 'categorÃ­as con submenÃº');
          break;
        }
        
        // Si NO encontrÃ³ categorÃ­as con submenÃº pero es el PRIMER UL, usar todos sus links
        if (h === 0 && directChildren.length > 0) {
          for (var li2 = 0; li2 < directChildren.length; li2++) {
            // Primero intentar :scope > a (link directo)
            var link2 = directChildren[li2].querySelector(':scope > a');
            
            // Si no existe, buscar dentro de div.nav-item-container
            if (!link2) {
              link2 = directChildren[li2].querySelector('div.nav-item-container > a');
            }
            
            // Si tampoco, buscar cualquier primer link
            if (!link2) {
              link2 = directChildren[li2].querySelector('a');
            }
            
            if (link2) {
              desktopLinks.push(link2);
              console.log('PromoNube: Link agregado desde LI #' + li2 + ':', link2.textContent.trim());
            } else {
              console.log('PromoNube: LI #' + li2 + ' NO tiene ningÃºn link');
            }
          }
          console.log('PromoNube: âœ… Usando primer UL con', desktopLinks.length, 'items');
          break;
        }
      }
    }

    console.log('PromoNube: Desktop links encontrados:', desktopLinks.length);
    for (var i = 0; i < desktopLinks.length; i++) {
      console.log('  - Desktop Item ' + (i+1) + ':', desktopLinks[i].textContent.trim());
    }
    
    console.log('PromoNube: Mobile links encontrados:', mobileLinks.length);
    for (var j = 0; j < mobileLinks.length; j++) {
      console.log('  - Mobile Item ' + (j+1) + ':', mobileLinks[j].textContent.trim());
    }

    if (desktopLinks.length === 0 && mobileLinks.length === 0) {
      console.warn('PromoNube: NO SE ENCONTRÃ“ NINGÃšN MENÃš');
      return;
    }

    console.log('PromoNube: Aplicando estilos a DESKTOP:', desktopLinks.length, 'items y MOBILE:', mobileLinks.length, 'items');
    
    // Combinar ambos menÃºs para aplicar estilos a todos
    var allMenus = [];
    if (desktopLinks.length > 0) {
      allMenus.push({ name: 'DESKTOP', links: desktopLinks });
    }
    if (mobileLinks.length > 0) {
      allMenus.push({ name: 'MOBILE', links: Array.prototype.slice.call(mobileLinks) });
    }
    
    // Aplicar estilos a CADA menÃº encontrado
    for (var m = 0; m < allMenus.length; m++) {
      var currentMenu = allMenus[m];
      console.log('PromoNube: Aplicando a', currentMenu.name, 'con', currentMenu.links.length, 'items');
      
      // Construir mapa de subcategorÃ­as (para posiciones como 1.1, 2.3, etc.)
      var subcategoryMap = {};
      for (var mainIdx = 0; mainIdx < currentMenu.links.length; mainIdx++) {
        var mainLink = currentMenu.links[mainIdx];
        var mainLi = mainLink.closest('li');
        if (mainLi) {
          var submenuUl = mainLi.querySelector('ul');
          if (submenuUl) {
            var subLinks = submenuUl.querySelectorAll(':scope > li > a');
            subcategoryMap[mainIdx + 1] = Array.prototype.slice.call(subLinks);
            console.log('PromoNube: CategorÃ­a', (mainIdx + 1), 'tiene', subLinks.length, 'subcategorÃ­as');
          }
        }
      }
      
      for (var c = 0; c < CONFIG.menu.items.length; c++) {
        var item = CONFIG.menu.items[c];
        var pos = item.position.toString();
        var targetLink = null;
        
        console.log('PromoNube: Procesando item configurado - PosiciÃ³n:', pos, 'Color:', item.color, 'Emoji:', item.emoji);
        
        // Detectar si es subcategorÃ­a (formato "1.2", "2.3")
        if (pos.indexOf('.') !== -1) {
          var parts = pos.split('.');
          var mainPos = parseInt(parts[0]);
          var subPos = parseInt(parts[1]);
          
          if (subcategoryMap[mainPos] && subcategoryMap[mainPos][subPos - 1]) {
            targetLink = subcategoryMap[mainPos][subPos - 1];
            console.log('PromoNube: âœ… SubcategorÃ­a encontrada:', mainPos + '.' + subPos, '- Texto:', targetLink.textContent.trim());
          } else {
            console.warn('PromoNube: SubcategorÃ­a', pos, 'no encontrada');
            continue;
          }
        } else {
          // CategorÃ­a principal
          var mainPosition = parseInt(pos);
          if (mainPosition < 1 || mainPosition > currentMenu.links.length) {
            console.warn('PromoNube: PosiciÃ³n', pos, 'fuera de rango (1-' + currentMenu.links.length + ')');
            continue;
          }
          targetLink = currentMenu.links[mainPosition - 1];
          console.log('PromoNube: âœ… CategorÃ­a principal encontrada:', pos, '- Texto:', targetLink.textContent.trim());
        }
        
        if (!targetLink) {
          console.warn('PromoNube: No se encontrÃ³ link en posiciÃ³n', pos);
          continue;
        }

        console.log('PromoNube: Aplicando estilos a posiciÃ³n', pos);

        // Aplicar estilos directamente al elemento con mÃ¡xima prioridad
        var currentStyle = targetLink.getAttribute('style') || '';
        
        if (item.color) {
          currentStyle += '; color: ' + item.color + ' !important';
        }
        if (item.fontWeight && item.fontWeight !== 'normal') {
          currentStyle += '; font-weight: ' + item.fontWeight + ' !important';
        }
        if (item.fontSize) {
          var fontSize = item.fontSize.toString().trim();
          // Si es solo un nÃºmero (con o sin decimales), agregar 'px' automÃ¡ticamente
          if (!isNaN(parseFloat(fontSize)) && isFinite(fontSize) && !fontSize.match(/px|rem|em|%|pt|pc|vh|vw/i)) {
            fontSize = fontSize + 'px';
          }
          currentStyle += '; font-size: ' + fontSize + ' !important';
          console.log('PromoNube: Font-size aplicado:', fontSize);
        }
        
        if (currentStyle && targetLink) {
          targetLink.setAttribute('style', currentStyle);
          if (item.color) {
            var childNodes = targetLink.querySelectorAll('*');
            for (var childIdx = 0; childIdx < childNodes.length; childIdx++) {
              childNodes[childIdx].style.setProperty('color', item.color, 'important');
            }
          }
          console.log('PromoNube: Estilos aplicados:', currentStyle);
          
          // Re-aplicar estilos cada 100ms durante 2 segundos para asegurar que se mantengan
          var reapplyCount = 0;
          var reapplyInterval = setInterval(function() {
            if (!targetLink || !targetLink.setAttribute) {
              clearInterval(reapplyInterval);
              return;
            }
            targetLink.setAttribute('style', currentStyle);
            if (item.color) {
              var childNodesRe = targetLink.querySelectorAll('*');
              for (var childIdxRe = 0; childIdxRe < childNodesRe.length; childIdxRe++) {
                childNodesRe[childIdxRe].style.setProperty('color', item.color, 'important');
              }
            }
            reapplyCount++;
            if (reapplyCount >= 20) {
              clearInterval(reapplyInterval);
            }
          }, 100);
        }

        // Agregar emoji modificando el innerHTML
        if (item.emoji) {
          var currentText = targetLink.textContent.trim();
          
          // Verificar si ya tiene el emoji
          if (currentText.indexOf(item.emoji) === -1) {
            if (item.emojiPosition === 'before') {
              targetLink.innerHTML = '<span>' + item.emoji + ' </span>' + targetLink.innerHTML;
            } else if (item.emojiPosition === 'after') {
              targetLink.innerHTML = targetLink.innerHTML + '<span> ' + item.emoji + '</span>';
            }
            console.log('PromoNube: Emoji agregado a posiciÃ³n', pos);
          }
        }

        // Agregar imagen en dropdown si estÃ¡ configurada
        if (item.imageUrl && item.imageUrl.trim() !== '') {
          console.log('PromoNube: Procesando imagen para posiciÃ³n', pos);
          
          // Solo para categorÃ­as principales (no subcategorÃ­as)
          if (pos.indexOf('.') === -1) {
            var mainPosition = parseInt(pos);
            if (mainPosition >= 1 && mainPosition <= currentMenu.links.length) {
              var mainLink = currentMenu.links[mainPosition - 1];
              var mainLi = mainLink.closest('li');
              
              if (mainLi) {
                // DIAGNÃ“STICO: Mostrar estructura del LI para debugging
                console.log('PromoNube DEBUG: Estructura del LI para posiciÃ³n', pos);
                console.log('  - LI classes:', mainLi.className);
                console.log('  - LI HTML (primeros 300 chars):', mainLi.innerHTML.substring(0, 300));
                
                // Buscar el dropdown/submenu con mÃºltiples estrategias
                var dropdown = null;
                
                // Estrategia 1: Buscar ul directamente
                dropdown = mainLi.querySelector('ul');
                if (dropdown) console.log('  - âœ… Dropdown encontrado: UL directo');
                
                // Estrategia 2: Buscar por clases comunes de dropdown
                if (!dropdown) {
                  dropdown = mainLi.querySelector('.dropdown-menu, .submenu, .nav-dropdown, .js-desktop-dropdown, .menu-dropdown');
                  if (dropdown) console.log('  - âœ… Dropdown encontrado: Por clase comÃºn');
                }
                
                // Estrategia 3: Buscar cualquier contenedor con links dentro
                if (!dropdown) {
                  var possibleDropdowns = mainLi.querySelectorAll('[class*="dropdown"], [class*="submenu"], [class*="mega"]');
                  console.log('  - Posibles dropdowns encontrados:', possibleDropdowns.length);
                  for (var d = 0; d < possibleDropdowns.length; d++) {
                    console.log('    - Candidato', d, ':', possibleDropdowns[d].className, '- Links:', possibleDropdowns[d].querySelectorAll('a').length);
                    if (possibleDropdowns[d].querySelectorAll('a').length > 0) {
                      dropdown = possibleDropdowns[d];
                      console.log('  - âœ… Dropdown encontrado: Contenedor con links');
                      break;
                    }
                  }
                }
                
                // Estrategia 4: Buscar el siguiente sibling que sea un contenedor
                if (!dropdown) {
                  var nextSibling = mainLi.querySelector('a').nextElementSibling;
                  if (nextSibling && (nextSibling.tagName === 'UL' || nextSibling.tagName === 'DIV')) {
                    dropdown = nextSibling;
                    console.log('  - âœ… Dropdown encontrado: Next sibling');
                  }
                }
                
                // Estrategia 5: Buscar cualquier DIV que contenga links
                if (!dropdown) {
                  var divsWithLinks = mainLi.querySelectorAll('div');
                  for (var divIdx = 0; divIdx < divsWithLinks.length; divIdx++) {
                    var divCandidate = divsWithLinks[divIdx];
                    if (divCandidate.querySelectorAll('a').length > 0 && divCandidate !== mainLi) {
                      dropdown = divCandidate;
                      console.log('  - âœ… Dropdown encontrado: DIV con links');
                      break;
                    }
                  }
                }
                
                if (dropdown) {
                  dropdown.classList.add('pn-menu-dropdown-has-image');
                  // ID Ãºnico para esta imagen
                  var imageId = 'pn-menu-img-' + currentMenu.name + '-pos' + pos;
                  
                  // Verificar si ya existe
                  var existingImage = document.getElementById(imageId);
                  if (existingImage) {
                    // Actualizar la imagen existente
                    var existingImgTag = existingImage.querySelector('img');
                    if (existingImgTag) {
                      existingImgTag.src = item.imageUrl;
                    }
                  } else {
                    // Crear wrapper para mejor control
                    var imageWrapper = document.createElement('li');
                    imageWrapper.id = imageId;
                    imageWrapper.className = 'pn-menu-dropdown-image-wrapper';
                    imageWrapper.style.cssText = 'list-style: none !important; padding: 0 !important; margin: 0 !important;';
                    
                    // Crear contenedor de imagen
                    var imageContainer = document.createElement('div');
                    imageContainer.className = 'pn-menu-dropdown-image';
                    imageContainer.style.cssText = 'padding: 15px; margin: 10px 0; text-align: center;';
                    
                    // Crear imagen
                    var img = document.createElement('img');
                    img.src = item.imageUrl;
                    img.alt = 'Menu Image';
                    img.className = 'pn-menu-dropdown-img';
                    img.style.cssText = 'width: 100%; max-width: 400px; height: auto; border-radius: 8px; display: block; margin: 0 auto; object-fit: cover;';
                    
                    imageContainer.appendChild(img);
                    imageWrapper.appendChild(imageContainer);
                    
                    // Insertar al FINAL del dropdown
                    // Si es UL, insertar como LI
                    if (dropdown.tagName === 'UL') {
                      dropdown.appendChild(imageWrapper);
                    } else {
                      // Si es DIV u otro, insertar directamente el contenedor
                      dropdown.appendChild(imageContainer);
                    }
                    
                    console.log('PromoNube: âœ… Imagen insertada en dropdown de posiciÃ³n', pos, '(tipo:', dropdown.tagName, ')');
                  }
                } else {
                  console.log('PromoNube: âš ï¸ No se encontrÃ³ dropdown para posiciÃ³n', pos, '- Li:', mainLi);
                  
                  // Fallback: crear dropdown si no existe
                  var fallbackDropdown = document.createElement('div');
                  fallbackDropdown.className = 'pn-created-dropdown';
                  fallbackDropdown.style.cssText = 'position: absolute; top: 100%; left: 0; min-width: 250px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 15px; display: none; z-index: 1000;';
                  
                  var imageId = 'pn-menu-img-' + currentMenu.name + '-pos' + pos;
                  var imageContainer = document.createElement('div');
                  imageContainer.id = imageId;
                  imageContainer.className = 'pn-menu-dropdown-image';
                  
                  var img = document.createElement('img');
                  img.src = item.imageUrl;
                  img.alt = 'Menu Image';
                  img.style.cssText = 'width: 100%; max-width: 300px; height: auto; border-radius: 8px; display: block; margin: 0 auto;';
                  
                  imageContainer.appendChild(img);
                  fallbackDropdown.appendChild(imageContainer);
                  mainLi.style.position = 'relative';
                  mainLi.appendChild(fallbackDropdown);
                  
                  // Agregar hover para mostrar
                  mainLi.addEventListener('mouseenter', function() {
                    fallbackDropdown.style.display = 'block';
                  });
                  mainLi.addEventListener('mouseleave', function() {
                    fallbackDropdown.style.display = 'none';
                  });
                  
                  console.log('PromoNube: âœ… Dropdown fallback creado con imagen');
                }
              }
            }
          }
        }
      }
    }

    // Agregar estilos CSS para las imÃ¡genes en mobile y desktop
    var imageStyles = document.createElement('style');
    imageStyles.id = 'pn-menu-image-styles';
    imageStyles.textContent = \`
      /* Estilos base para el contenedor de imagen */
      .pn-menu-dropdown-image-wrapper {
        list-style: none !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }

      /* Layout con imagen a la derecha */
      .pn-menu-dropdown-has-image {
        position: relative !important;
        padding-right: 420px !important;
      }

      .pn-menu-dropdown-has-image > li {
        max-width: calc(100% - 420px) !important;
      }

      .pn-menu-dropdown-has-image .pn-menu-dropdown-image-wrapper,
      .pn-menu-dropdown-has-image .pn-menu-dropdown-image {
        position: absolute !important;
        top: 0 !important;
        right: 0 !important;
        width: 380px !important;
        max-width: 380px !important;
      }
      
      .pn-menu-dropdown-image {
        display: block !important;
        padding: 15px !important;
        margin: 10px auto !important;
        text-align: center !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      
      .pn-menu-dropdown-img {
        width: 100% !important;
        max-width: 400px !important;
        height: auto !important;
        border-radius: 8px !important;
        display: block !important;
        margin: 0 auto !important;
        object-fit: cover !important;
      }
      
      /* Desktop: imagen dentro del dropdown */
      @media (min-width: 769px) {
        .pn-menu-dropdown-image {
          display: block !important;
          padding: 20px 15px !important;
          text-align: center !important;
        }
        
        .pn-menu-dropdown-img {
          max-width: 450px !important;
          margin: 0 auto !important;
        }
        
        /* Para dropdowns con flexbox */
        ul.pn-menu-dropdown-image-wrapper,
        li.pn-menu-dropdown-image-wrapper {
          order: 999 !important;
          flex: 1 1 100% !important;
        }
        
        /* Asegurar visibilidad en diferentes tipos de menÃº */
        .dropdown-menu .pn-menu-dropdown-image,
        .submenu .pn-menu-dropdown-image,
        .nav-dropdown .pn-menu-dropdown-image,
        .js-desktop-dropdown .pn-menu-dropdown-image,
        ul .pn-menu-dropdown-image {
          display: block !important;
        }
      }
      
      /* Mobile: imagen visible y adaptada */
      @media (max-width: 768px) {
        .pn-menu-dropdown-has-image {
          padding-right: 0 !important;
        }

        .pn-menu-dropdown-has-image .pn-menu-dropdown-image-wrapper,
        .pn-menu-dropdown-has-image .pn-menu-dropdown-image {
          position: relative !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        .pn-menu-dropdown-image {
          display: block !important;
          width: 100% !important;
          padding: 15px 10px !important;
          margin: 15px auto !important;
        }
        
        .pn-menu-dropdown-img {
          max-width: 100% !important;
          width: 100% !important;
          height: auto !important;
        }
      }
      
      /* Fallback dropdown creado por PromoNube */
      .pn-created-dropdown {
        position: absolute !important;
        top: 100% !important;
        left: 0 !important;
        min-width: 250px !important;
        background: white !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        padding: 15px !important;
        display: none !important;
        z-index: 1000 !important;
        border-radius: 8px !important;
      }
      
      @media (max-width: 768px) {
        .pn-created-dropdown {
          position: relative !important;
          width: 100% !important;
          box-shadow: none !important;
          padding: 10px !important;
        }
      }
    \`;
    
    if (!document.getElementById('pn-menu-image-styles')) {
      document.head.appendChild(imageStyles);
    }

    console.log('PromoNube Style: MenÃº customizado âœ…');
  }

  function customizeSearchBar() {
    if (!CONFIG.searchBar || !CONFIG.searchBar.enabled) {
      console.log('PromoNube: Buscador mejorado deshabilitado');
      return;
    }

    console.log('PromoNube SearchBar: Iniciando mejora del buscador...');

    // Buscar el icono/botÃ³n de bÃºsqueda Y el input en el header (excluyendo logos)
    var searchTriggers = document.querySelectorAll('header .js-search-btn, header button[class*="search"], header a.js-search-btn, .utilities-item a[href*="search"], .js-utilities a[href*="search"], header input[type="search"], header input[name="q"], header .search-input, header .js-search-input');
    
    // Filtrar para excluir elementos con "logo" en su clase o que sean imÃ¡genes
    searchTriggers = Array.from(searchTriggers).filter(function(el) {
      var className = el.className.toLowerCase();
      var isLogo = className.includes('logo') || el.querySelector('img[alt*="logo"]') || el.closest('.logo');
      return !isLogo;
    });
    
    if (searchTriggers.length === 0) {
      console.warn('PromoNube: No se encontrÃ³ botÃ³n de bÃºsqueda');
      return;
    }

    console.log('PromoNube: Encontrados', searchTriggers.length, 'triggers de bÃºsqueda (botones e inputs)');

    // Crear el modal overlay
    var modalId = 'pn-search-modal';
    if (document.getElementById(modalId)) {
      console.log('PromoNube: Modal de bÃºsqueda ya existe');
      return;
    }

    var searchModal = document.createElement('div');
    searchModal.id = modalId;
    searchModal.className = 'pn-search-modal';
    searchModal.style.zIndex = '999999';
    
    // Variables de configuraciÃ³n
    var showLogo = CONFIG.searchBar.showLogo || false;
    var logoUrl = CONFIG.searchBar.logoUrl || '';
    var logoSize = CONFIG.searchBar.logoSize || 100;
    var titlePosition = CONFIG.searchBar.titlePosition || 'center';
    var suggestions = CONFIG.searchBar.suggestions || [];
    var closeButtonColor = CONFIG.searchBar.closeButtonColor || '#000000';
    
    console.log('PromoNube: ConfiguraciÃ³n del logo:', {
      showLogo: showLogo,
      logoUrl: logoUrl,
      logoSize: logoSize
    });
    console.log('PromoNube: Color botÃ³n cerrar:', closeButtonColor);
    console.log('PromoNube: Sugerencias:', suggestions);
    
    searchModal.innerHTML = \`
      <div class="pn-search-overlay"></div>
      <div class="pn-search-container \${titlePosition === 'top' ? 'pn-search-top-layout' : ''}">
        <button class="pn-search-close" aria-label="Cerrar bÃºsqueda">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="\${closeButtonColor}" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="pn-search-content">
          \${showLogo && logoUrl ? '<img src="' + logoUrl + '" alt="Logo" class="pn-search-logo" style="max-width: ' + logoSize + 'px; height: auto; margin: 0 auto 12px; display: block;" />' : ''}
          <h2 class="pn-search-title">\${CONFIG.searchBar.placeholder || 'Â¿QuÃ© estÃ¡s buscando?'}</h2>
          <form class="pn-search-form" action="/search" method="get">
            <input 
              type="text" 
              name="q" 
              class="pn-search-input" 
              placeholder="\${CONFIG.searchBar.inputPlaceholder || 'Buscar productos...'}"
              autocomplete="off"
              autofocus
            />
            <button type="submit" class="pn-search-submit">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <span>\${CONFIG.searchBar.buttonText || 'Buscar'}</span>
            </button>
          </form>
          \${suggestions.length > 0 ? '<div class="pn-search-suggestions"><h3 class="pn-suggestions-title">Te puede interesar</h3><div class="pn-suggestions-grid">' + suggestions.map(function(s) { return '<a href="' + s.link + '" class="pn-suggestion-item"><img src="' + s.imageUrl + '" alt="Sugerencia" /></a>'; }).join('') + '</div></div>' : ''}
        </div>
      </div>
    \`;

    document.body.appendChild(searchModal);

    // FunciÃ³n para abrir el modal
    function openSearchModal(e) {
      e.preventDefault();
      searchModal.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Focus en el input
      setTimeout(function() {
        var input = searchModal.querySelector('.pn-search-input');
        if (input) input.focus();
      }, 100);
      
      console.log('PromoNube: Modal de bÃºsqueda abierto');
    }

    // FunciÃ³n para cerrar el modal
    function closeSearchModal() {
      searchModal.classList.remove('active');
      document.body.style.overflow = '';
      console.log('PromoNube: Modal de bÃºsqueda cerrado');
    }

    // Agregar event listeners a todos los triggers
    for (var i = 0; i < searchTriggers.length; i++) {
      var trigger = searchTriggers[i];
      
      // Si es un input, tambiÃ©n prevenir el comportamiento por defecto al hacer focus
      if (trigger.tagName === 'INPUT') {
        trigger.addEventListener('focus', openSearchModal);
        trigger.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
        });
        // Hacer readonly para que no se pueda escribir
        trigger.setAttribute('readonly', 'readonly');
        trigger.style.cursor = 'pointer';
      } else {
        trigger.addEventListener('click', openSearchModal);
      }
    }

    // Cerrar con botÃ³n X
    var closeBtn = searchModal.querySelector('.pn-search-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeSearchModal);
    }

    // Cerrar clickeando el overlay
    var overlay = searchModal.querySelector('.pn-search-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeSearchModal);
    }

    // Cerrar con ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchModal.classList.contains('active')) {
        closeSearchModal();
      }
    });

    // Agregar estilos CSS
    var searchStyles = document.createElement('style');
    searchStyles.id = 'pn-search-modal-styles';
    
    // Colores y opciones configurables
    var bgColor = CONFIG.searchBar.backgroundColor || '#000000';
    var bgOpacity = CONFIG.searchBar.backgroundOpacity !== undefined ? CONFIG.searchBar.backgroundOpacity : 0.85;
    var buttonColor = CONFIG.searchBar.buttonColor || '#000000';
    var titleColor = CONFIG.searchBar.titleColor || '#ffffff';
    var titleSize = CONFIG.searchBar.titleSize || 42;
    var titlePosition = CONFIG.searchBar.titlePosition || 'center';
    
    searchStyles.textContent = \`
      /* Modal de bÃºsqueda - Base */
      .pn-search-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2147483647;
        visibility: hidden;
        opacity: 0;
        transition: visibility 0s 0.3s, opacity 0.3s ease;
      }

      .pn-search-modal.active {
        visibility: visible;
        opacity: 1;
        transition: visibility 0s, opacity 0.3s ease;
      }

      /* Overlay oscuro */
      .pn-search-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: \${bgColor};
        opacity: \${bgOpacity};
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      /* Contenedor del modal */
      .pn-search-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* Layout superior (estilo Zara) */
      .pn-search-container.pn-search-top-layout {
        align-items: flex-start;
        padding-top: 80px;
      }

      /* BotÃ³n cerrar */
      .pn-search-close {
        position: absolute;
        top: 30px;
        right: 30px;
        background: transparent;
        border: none;
        color: \${closeButtonColor};
        width: 40px;
        height: 40px;
        cursor: pointer;
        z-index: 10;
        transition: all 0.3s ease;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pn-search-close:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: rotate(90deg);
      }

      /* Contenido central */
      .pn-search-content {
        max-width: 900px;
        width: 100%;
        text-align: center;
        transform: translateY(-50px);
        transition: transform 0.3s ease;
      }

      .pn-search-modal.active .pn-search-content {
        transform: translateY(0);
      }

      .pn-search-top-layout .pn-search-content {
        transform: translateY(0);
      }

      /* Logo */
      .pn-search-logo {
        max-width: 100%;
        height: auto;
        margin: 0 auto 12px;
        display: block;
      }

      /* TÃ­tulo */
      .pn-search-title {
        color: \${titleColor} !important;
        font-size: \${titleSize}px !important;
        font-weight: 300 !important;
        margin-bottom: 40px !important;
        letter-spacing: -0.5px !important;
        line-height: 1.2 !important;
        text-align: \${titlePosition === 'top' ? 'left' : 'center'} !important;
      }

      /* Formulario */
      .pn-search-form {
        display: flex;
        gap: 12px;
        align-items: center;
        background: white;
        padding: 8px;
        border-radius: 50px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      /* Input */
      .pn-search-input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 16px 24px;
        font-size: 18px;
        outline: none;
        color: #333;
      }

      .pn-search-input::placeholder {
        color: #999;
      }

      /* BotÃ³n submit */
      .pn-search-submit {
        background: \${buttonColor} !important;
        color: white !important;
        border: none;
        padding: 14px 32px;
        border-radius: 50px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        white-space: nowrap;
      }

      .pn-search-submit:hover {
        opacity: 0.85;
        transform: translateX(4px);
      }

      .pn-search-submit svg {
        width: 20px;
        height: 20px;
      }

      /* Sugerencias */
      .pn-search-suggestions {
        margin-top: 60px;
      }

      .pn-suggestions-title {
        color: \${titleColor};
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 30px;
        text-align: left;
      }

      .pn-suggestions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 20px;
      }

      .pn-suggestion-item {
        display: block;
        overflow: hidden;
        border-radius: 8px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }

      .pn-suggestion-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      }

      .pn-suggestion-item img {
        width: 100%;
        height: 250px;
        object-fit: cover;
        display: block;
      }
      }

      .pn-search-modal.active .pn-search-content {
        transform: translateY(0);
      }

      /* TÃ­tulo */
      .pn-search-title {
        color: white;
        font-size: 42px;
        font-weight: 300;
        margin-bottom: 40px;
        letter-spacing: -0.5px;
        line-height: 1.2;
      }

      /* Formulario */
      .pn-search-form {
        display: flex;
        gap: 12px;
        align-items: center;
        background: white;
        padding: 8px;
        border-radius: 50px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      /* Input */
      .pn-search-input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 16px 24px;
        font-size: 18px;
        outline: none;
        color: #333;
      }

      .pn-search-input::placeholder {
        color: #999;
      }

      /* BotÃ³n submit */
      .pn-search-submit {
        background: #000;
        color: white;
        border: none;
        padding: 14px 32px;
        border-radius: 50px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        white-space: nowrap;
      }

      .pn-search-submit:hover {
        background: #333;
        transform: translateX(4px);
      }

      .pn-search-submit svg {
        width: 20px;
        height: 20px;
      }

      /* Responsive - Tablet */
      @media (max-width: 768px) {
        .pn-search-container {
          padding: 20px 15px;
          padding-top: 80px;
        }

        .pn-search-container.pn-search-top-layout {
          padding-top: 100px;
        }

        .pn-search-title {
          font-size: 28px !important;
          margin-bottom: 24px !important;
        }

        .pn-search-form {
          flex-direction: column;
          border-radius: 16px;
          padding: 12px;
          gap: 8px;
        }

        .pn-search-input {
          width: 100%;
          padding: 14px 20px;
          font-size: 16px;
        }

        .pn-search-submit {
          width: 100%;
          justify-content: center;
          border-radius: 12px;
          padding: 16px;
        }

        .pn-search-close {
          top: 15px;
          right: 15px;
          width: 36px;
          height: 36px;
        }

        .pn-search-logo {
          max-width: 80px !important;
          margin-bottom: 20px !important;
        }

        .pn-suggestions-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 12px !important;
        }
      }

      /* Mobile */
      @media (max-width: 480px) {
        .pn-search-container {
          padding: 16px 12px;
          padding-top: 100px;
          padding-bottom: 40px;
        }

        .pn-search-container.pn-search-top-layout {
          padding-top: 120px;
        }

        .pn-search-title {
          font-size: 22px !important;
          margin-bottom: 20px !important;
        }

        .pn-search-input {
          font-size: 15px;
          padding: 12px 16px;
        }

        .pn-search-submit {
          font-size: 15px;
          padding: 14px;
        }

        .pn-search-submit span {
          display: none;
        }

        .pn-search-close {
          top: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
        }

        .pn-search-close svg {
          width: 18px;
          height: 18px;
        }

        .pn-search-logo {
          max-width: 60px !important;
          margin-bottom: 16px !important;
        }

        .pn-search-suggestions {
          margin-top: 24px !important;
        }

        .pn-suggestions-title {
          font-size: 14px !important;
        }

        .pn-suggestions-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 8px !important;
        }

        .pn-suggestion-item {
          height: 100px !important;
        }
      }

      /* Animaciones */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .pn-search-modal.active .pn-search-form {
        animation: fadeIn 0.4s ease 0.1s both;
      }
    \`;

    if (!document.getElementById('pn-search-modal-styles')) {
      document.head.appendChild(searchStyles);
    }

    console.log('PromoNube SearchBar: âœ… Buscador mejorado activado');
  }

  function customizeLightToggle() {
    if (!CONFIG.lightToggle || !CONFIG.lightToggle.enabled) {
      console.log('PromoNube: Light Toggle deshabilitado');
      return;
    }

    const categoryUrls = CONFIG.lightToggle.categoryUrls || [];
    const currentUrl = window.location.href;

    console.log('PromoNube Light Toggle: Checking URL...', currentUrl);
    
    // Si categoryUrls estÃ¡ vacÃ­o, aplicar a TODOS los productos (pÃ¡ginas de producto)
    // Si tiene URLs, solo aplicar si la URL actual coincide con alguna de ellas
    if (categoryUrls.length > 0) {
      const matchesAnyUrl = categoryUrls.some(url => url && currentUrl.includes(url));
      if (!matchesAnyUrl) {
        console.log('PromoNube: No estamos en ninguna de las categorÃ­as configuradas:', categoryUrls);
        return;
      }
    }

    console.log('PromoNube: âœ… Activando Cambio de Vista...');

    // Aplicar hover para mostrar la segunda imagen en TODOS los productos
    function applySecondViewHover() {
      const productItems = document.querySelectorAll('.js-item-product, .product-item, [data-component="product-item"]');

      productItems.forEach(function(item) {
        const imageContainer = item.querySelector('a[href*="/productos/"], .item-link, .product-image');
        if (!imageContainer || imageContainer.dataset.pnSecondViewApplied === 'true') return;

        const images = imageContainer.querySelectorAll('img');
        if (images.length < 2) return;

        const imgVista1 = images[0];
        const imgVista2 = images[1];

        if (imgVista1.dataset.src && !imgVista1.src) {
          imgVista1.src = imgVista1.dataset.src;
        }
        if (imgVista2.dataset.src && !imgVista2.src) {
          imgVista2.src = imgVista2.dataset.src;
        }

        imageContainer.classList.add('pn-second-view-container');
        imgVista1.classList.add('pn-view-1');
        imgVista2.classList.add('pn-view-2');

        // Forzar visibilidad para evitar blanco
        imgVista1.style.display = 'block';
        imgVista1.style.visibility = 'visible';
        imgVista2.style.display = 'block';
        imgVista2.style.visibility = 'visible';

        imageContainer.dataset.pnSecondViewApplied = 'true';
      });
    }

    // Inyectar estilos para hover (solo una vez)
    if (!document.getElementById('pn-second-view-styles')) {
      const hoverStyles = document.createElement('style');
      hoverStyles.id = 'pn-second-view-styles';
      hoverStyles.textContent =
        '.pn-second-view-container {\\\\n' +
        '  position: relative !important;\\\\n' +
        '  display: block !important;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-container img {\\\\n' +
        '  transition: opacity 0.3s ease !important;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-container img.pn-view-1 {\\\\n' +
        '  opacity: 1;\\\\n' +
        '  position: relative;\\\\n' +
        '  z-index: 1;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-container img.pn-view-2 {\\\\n' +
        '  opacity: 0;\\\\n' +
        '  position: absolute;\\\\n' +
        '  top: 0;\\\\n' +
        '  left: 0;\\\\n' +
        '  width: 100%;\\\\n' +
        '  height: auto;\\\\n' +
        '  z-index: 2;\\\\n' +
        '  display: block;\\\\n' +
        '  visibility: visible;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-on .pn-second-view-container img.pn-view-1 {\\\\n' +
        '  opacity: 0 !important;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-on .pn-second-view-container img.pn-view-2 {\\\\n' +
        '  opacity: 1 !important;\\\\n' +
        '  display: block !important;\\\\n' +
        '  visibility: visible !important;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-container:hover img.pn-view-1 {\\\\n' +
        '  opacity: 0;\\\\n' +
        '}\\\\n' +
        '.pn-second-view-container:hover img.pn-view-2 {\\\\n' +
        '  opacity: 1;\\\\n' +
        '}\\\\n';
      document.head.appendChild(hoverStyles);
    }

    applySecondViewHover();

    // Reaplicar si hay carga dinÃ¡mica de productos
    const observer = new MutationObserver(() => applySecondViewHover());
    observer.observe(document.body, { childList: true, subtree: true });

    // Buscar el contenedor donde va el toggle (al lado de DESTACADO)
    const filterContainer = document.querySelector('.js-controls-footer, .filters-container, .category-controls, .d-flex.justify-content-between');
    
    if (!filterContainer) {
      // Fallback: insertar antes del grid/listado de productos
      const productsContainer = document.querySelector('.js-products-grid, .products-grid, .product-grid, .js-products-list, .products-list') ||
        document.querySelector('.js-item-product')?.closest('section, .container, .products, .product-list') ||
        document.querySelector('main');
      if (productsContainer) {
        const fallbackWrapper = document.createElement('div');
        fallbackWrapper.className = 'pn-light-toggle-fallback';
        fallbackWrapper.style.cssText = 'margin: 10px 0 20px; display: flex; align-items: center; justify-content: flex-start;';
        productsContainer.insertBefore(fallbackWrapper, productsContainer.firstChild);
        filterContainer = fallbackWrapper;
      } else {
        console.warn('PromoNube: No se encontrÃ³ contenedor de filtros ni fallback');
        return;
      }
    }

    // Crear el toggle si no existe
    if (document.getElementById('pn-light-toggle')) {
      console.log('PromoNube: Toggle ya existe');
      return;
    }

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'pn-light-toggle';
    toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: 20px; margin-bottom: 24px;';

    const prefixLabel = document.createElement('span');
    prefixLabel.textContent = CONFIG.lightToggle.label || 'Ver:';
    prefixLabel.style.cssText = 'font-size: 13px; font-weight: 600; color: #666;';

    const view1Label = document.createElement('span');
    view1Label.id = 'pn-view1-label';
    view1Label.textContent = CONFIG.lightToggle.view1Label || 'Apagada';
    view1Label.style.cssText = 'font-size: 13px; font-weight: 700; color: #333; text-decoration: underline; cursor: pointer;';

    const separator = document.createElement('span');
    separator.textContent = '/';
    separator.style.cssText = 'font-size: 13px; color: #999; margin: 0 4px;';

    const view2Label = document.createElement('span');
    view2Label.id = 'pn-view2-label';
    view2Label.textContent = CONFIG.lightToggle.view2Label || 'Prendida';
    view2Label.style.cssText = 'font-size: 13px; font-weight: 400; color: #999; cursor: pointer;';

    const switchLabel = document.createElement('label');
    switchLabel.style.cssText = 'position: relative; display: inline-block; width: 36px; height: 20px; cursor: pointer; margin: 0;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'pn-light-checkbox';
    checkbox.style.cssText = 'opacity: 0; width: 0; height: 0;';

    // Cargar estado guardado
    const savedState = localStorage.getItem('pn_light_toggle_state');
    if (savedState === 'on') {
      checkbox.checked = true;
    }

    const slider = document.createElement('span');
    slider.style.cssText = 'position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ddd; transition: all 0.25s ease; border-radius: 20px;';
    
    const sliderCircle = document.createElement('span');
    sliderCircle.style.cssText = 'position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background: white; transition: all 0.25s ease; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2);';
    slider.appendChild(sliderCircle);

    switchLabel.appendChild(checkbox);
    switchLabel.appendChild(slider);

    toggleContainer.appendChild(prefixLabel);
    toggleContainer.appendChild(view1Label);
    toggleContainer.appendChild(separator);
    toggleContainer.appendChild(view2Label);
    toggleContainer.appendChild(switchLabel);

    // Insertar al lado de DESTACADO
    filterContainer.appendChild(toggleContainer);

    console.log('PromoNube: Toggle creado âœ…');

    // FunciÃ³n para actualizar apariencia de las etiquetas
    function updateLabels(isOn) {
      if (isOn) {
        view1Label.style.fontWeight = '400';
        view1Label.style.color = '#999';
        view1Label.style.textDecoration = 'none';
        view2Label.style.fontWeight = '700';
        view2Label.style.color = '#333';
        view2Label.style.textDecoration = 'underline';
      } else {
        view1Label.style.fontWeight = '700';
        view1Label.style.color = '#333';
        view1Label.style.textDecoration = 'underline';
        view2Label.style.fontWeight = '400';
        view2Label.style.color = '#999';
        view2Label.style.textDecoration = 'none';
      }
    }

    // Estado inicial
    updateLabels(checkbox.checked);

    // FunciÃ³n para activar/desactivar las luces
    function toggleLights(isOn) {
      console.log('PromoNube: Cambiando luces a:', isOn ? 'ON' : 'OFF');

      document.body.classList.toggle('pn-second-view-on', !!isOn);
      
      const productItems = document.querySelectorAll('.js-item-product, .product-item, [data-component="product-item"]');
      console.log('PromoNube: Productos encontrados:', productItems.length);

      productItems.forEach(function(item) {
        // Buscar el contenedor de imÃ¡genes (puede ser un slide o link)
        const imageContainer = item.querySelector('a[href*="/productos/"], .item-link, .product-image');
        if (!imageContainer) return;
        
        // Configurar contenedor con grid para superponer imÃ¡genes
        imageContainer.style.display = 'grid';
        imageContainer.style.position = 'relative';
        
        // Buscar todas las imÃ¡genes dentro del contenedor
        const images = imageContainer.querySelectorAll('img');
        console.log('PromoNube: ImÃ¡genes en producto:', images.length);
        
        if (images.length >= 2) {
          // Alternar entre la primera (vista 1) y segunda imagen (vista 2)
          const imgVista1 = images[0];
          const imgVista2 = images[1];
          
          // Forzar carga de imÃ¡genes lazy loading
          if (imgVista1.dataset.src && !imgVista1.src) {
            imgVista1.src = imgVista1.dataset.src;
          }
          if (imgVista2.dataset.src && !imgVista2.src) {
            imgVista2.src = imgVista2.dataset.src;
          }
          
          // Ambas imÃ¡genes en la misma celda del grid
          imgVista1.style.gridArea = '1 / 1';
          imgVista1.style.width = '100%';
          imgVista1.style.height = 'auto';
          imgVista1.style.transition = 'opacity 0.3s ease';
          
          imgVista2.style.gridArea = '1 / 1';
          imgVista2.style.width = '100%';
          imgVista2.style.height = 'auto';
          imgVista2.style.transition = 'opacity 0.3s ease';
          
          if (isOn) {
            // Mostrar vista 2, ocultar vista 1
            imgVista1.style.opacity = '0';
            imgVista2.style.opacity = '1';
            imgVista2.style.display = 'block';
            imgVista2.style.visibility = 'visible';
            console.log('PromoNube: Vista 2 ACTIVADA');
          } else {
            // Mostrar vista 1, ocultar vista 2
            imgVista1.style.opacity = '1';
            imgVista2.style.opacity = '0';
            imgVista1.style.display = 'block';
            imgVista1.style.visibility = 'visible';
            console.log('PromoNube: Vista 1 ACTIVADA');
          }
        }
      });

      // Actualizar apariencia del toggle y etiquetas
      if (isOn) {
        slider.style.background = '#353434';
        sliderCircle.style.transform = 'translateX(16px)';
      } else {
        slider.style.background = '#ddd';
        sliderCircle.style.transform = 'translateX(0)';
      }
      
      updateLabels(isOn);

      // Guardar estado
      localStorage.setItem('pn_light_toggle_state', isOn ? 'on' : 'off');
    }

    // Event listeners
    checkbox.addEventListener('change', function() {
      toggleLights(this.checked);
    });

    // Click en las etiquetas para cambiar el estado
    view1Label.addEventListener('click', function() {
      checkbox.checked = false;
      toggleLights(false);
    });

    view2Label.addEventListener('click', function() {
      checkbox.checked = true;
      toggleLights(true);
    });

    // Aplicar estado inicial
    if (checkbox.checked) {
      toggleLights(true);
    }

    // Inyectar CSS para forzar hover
    const style = document.createElement('style');
    style.textContent = '.pn-force-hover img { opacity: 0 !important; } .pn-force-hover img:nth-child(2) { opacity: 1 !important; }';
    document.head.appendChild(style);

    console.log('PromoNube Light Toggle: âœ… Completado');
  }

  function customizeTheme() {
    if (!CONFIG.themeSwitch || !CONFIG.themeSwitch.enabled) {
      console.log('PromoNube: Theme Switcher deshabilitado');
      return;
    }

    const urls = CONFIG.themeSwitch.urls || [];
    const currentUrl = window.location.href;

    console.log('PromoNube Theme Switcher: Verificando URL actual...', currentUrl);
    console.log('PromoNube Theme Switcher: URLs configuradas:', urls);

    // Verificar si la URL actual coincide con alguna configurada
    const matchedUrl = urls.find(url => currentUrl.includes(url));
    
    if (!matchedUrl) {
      console.log('PromoNube: URL no coincide con ninguna configurada para Theme Switcher');
      return;
    }

    console.log('PromoNube: âœ… URL coincide! Aplicando tema personalizado...');

    // Obtener configuraciÃ³n de colores
    const bgColor = CONFIG.themeSwitch.backgroundColor || '#000000';
    const textColor = CONFIG.themeSwitch.textColor || '#ffffff';
    const accentColor = CONFIG.themeSwitch.accentColor || '#f59e0b';
    const invertColors = CONFIG.themeSwitch.invertColors || false;

    // Crear e inyectar estilos CSS
    const styleId = 'pn-theme-switcher-styles';
    
    // Remover estilos previos si existen
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    
    let cssRules = \`
      /* PromoNube Theme Switcher - Black Friday Mode */
      body {
        background-color: \${bgColor} !important;
        color: \${textColor} !important;
      }
      
      /* Headers y tÃ­tulos */
      h1, h2, h3, h4, h5, h6,
      .page-title,
      .product-name,
      .category-title,
      .h1, .h2, .h3, .h4, .h5, .h6 {
        color: \${textColor} !important;
      }
      
      /* Contenedores principales */
      .main-content,
      .container,
      .page-wrapper,
      .content-wrapper,
      section,
      main {
        background-color: \${bgColor} !important;
      }
      
      /* Header y Footer */
      header,
      footer,
      .header,
      .footer,
      .site-header,
      .site-footer {
        background-color: \${bgColor} !important;
        border-color: \${accentColor}40 !important;
      }
      
      /* Ocultar iconos del header */
      header svg,
      .header svg,
      .utilities svg,
      .js-utilities svg,
      .js-utilities-item svg,
      .utilities-item svg,
      .user-dropdown svg,
      .cart-widget svg {
        fill: \${textColor} !important;
        color: \${textColor} !important;
      }
      
      /* Iconos del header con color del tema */
      .js-utilities .badge,
      .utilities .badge,
      .cart-widget .badge {
        background-color: \${accentColor} !important;
        color: #000 !important;
      }
      
      /* NavegaciÃ³n */
      nav,
      .nav,
      .navbar,
      .menu,
      .navigation {
        background-color: \${bgColor} !important;
      }
      
      .nav-link,
      .menu-item a,
      .navbar a {
        color: \${textColor} !important;
      }
      
      .nav-link:hover,
      .menu-item a:hover {
        color: \${accentColor} !important;
      }
      
      /* MenÃºs desplegables y submenÃºs */
      .dropdown-menu,
      .submenu,
      .nav-dropdown,
      .js-desktop-dropdown,
      ul[style*="display"],
      .menu-item ul {
        background-color: \${bgColor} !important;
        border: 1px solid \${accentColor}40 !important;
      }
      
      .dropdown-menu a,
      .submenu a,
      .nav-dropdown a {
        color: \${textColor} !important;
      }
      
      .dropdown-menu a:hover,
      .submenu a:hover {
        background-color: \${accentColor}20 !important;
        color: \${accentColor} !important;
      }
      
      /* Cards y productos */
      .product-item,
      .card,
      .item-product,
      .js-item-product,
      .product-card {
        background-color: \${bgColor} !important;
        border: 1px solid \${accentColor}40 !important;
      }
      
      /* Contenedor de filtros y categorÃ­a */
      .category-controls,
      .filters-container,
      .js-controls-footer,
      .breadcrumbs,
      .breadcrumb {
        background-color: \${bgColor} !important;
        color: \${textColor} !important;
      }
      
      /* Textos generales */
      p, span, div, a, li,
      .price,
      .product-price,
      .description,
      .text {
        color: \${textColor} !important;
      }
      
      /* Links */
      a {
        color: \${textColor} !important;
      }
      
      a:hover {
        color: \${accentColor} !important;
      }
      
      /* Botones y CTAs */
      .btn,
      .button,
      .js-addtocart,
      .btn-primary,
      button[type="submit"] {
        background-color: \${accentColor} !important;
        border-color: \${accentColor} !important;
        color: #000 !important;
        font-weight: 600 !important;
      }
      
      .btn:hover,
      .button:hover,
      .js-addtocart:hover {
        background-color: \${accentColor}dd !important;
        transform: translateY(-2px);
        box-shadow: 0 4px 16px \${accentColor}80 !important;
      }
      
      /* Inputs y forms */
      input,
      select,
      textarea,
      .form-control,
      .input {
        background-color: \${bgColor} !important;
        border: 1px solid \${accentColor}60 !important;
        color: \${textColor} !important;
      }
      
      input::placeholder {
        color: \${textColor}80 !important;
      }
      
      /* Precios */
      .price,
      .product-price,
      .price-compare {
        color: \${textColor} !important;
      }
      
      .price-compare,
      .compare-price {
        text-decoration: line-through;
        opacity: 0.6;
      }
      
      /* Badges y etiquetas */
      .badge,
      .label,
      .tag,
      .discount-badge {
        background-color: \${accentColor} !important;
        color: #000 !important;
        font-weight: 600 !important;
      }
      
      /* Newsletter y footer forms */
      .newsletter,
      .footer-newsletter {
        background-color: \${bgColor} !important;
      }
      
      .newsletter button,
      .newsletter .btn {
        background-color: \${accentColor} !important;
        color: #000 !important;
      }
      
      /* Evitar fondos blancos */
      .bg-white,
      .white-bg {
        background-color: \${bgColor} !important;
      }
      
      /* Separadores y bordes */
      hr,
      .divider,
      .separator {
        border-color: \${accentColor}40 !important;
      }
    \`;

    // Si invertColors estÃ¡ activado, agregar filtro de inversiÃ³n
    if (invertColors) {
      cssRules += \`
        /* Invertir imÃ¡genes para que se vean bien en fondo oscuro */
        img:not(.no-invert) {
          filter: brightness(0.9) contrast(1.1);
        }
      \`;
    }

    style.textContent = cssRules;
    document.head.appendChild(style);

    // Agregar badge visual indicando el tema activo
    const badge = document.createElement('div');
    badge.id = 'pn-theme-badge';
    badge.style.cssText = \`
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: \${accentColor};
      color: #000;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      cursor: pointer;
      opacity: 0.9;
      transition: opacity 0.3s ease;
    \`;
    badge.textContent = 'ðŸ”¥ BLACK FRIDAY';
    
    // Hover para mostrar/ocultar
    badge.addEventListener('mouseenter', function() {
      badge.style.opacity = '1';
    });
    
    badge.addEventListener('mouseleave', function() {
      badge.style.opacity = '0.9';
    });
    
    // Click para ocultar el badge
    badge.addEventListener('click', function() {
      badge.style.display = 'none';
    });
    
    document.body.appendChild(badge);

    console.log('PromoNube Theme Switcher: âœ… Tema aplicado correctamente');
    console.log('PromoNube Theme Switcher: Background:', bgColor);
    console.log('PromoNube Theme Switcher: Text:', textColor);
    console.log('PromoNube Theme Switcher: Accent:', accentColor);
  }

  function injectBadgesScript() {
    if (window.promonubeBadgesScriptLoaded) return;
    window.promonubeBadgesScriptLoaded = true;

    const badgesScript = document.createElement('script');
    badgesScript.src = 'https://apipromonube-jlfopowzaq-uc.a.run.app/api/badges-script.js?store=${store}';
    badgesScript.async = true;
    document.head.appendChild(badgesScript);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      customizeWhatsApp();
      customizeBanners();
      setTimeout(customizeMenu, 500); // Dar tiempo al menÃº para renderizar
      setTimeout(customizeSearchBar, 600); // Buscador mejorado
      setTimeout(customizeLightToggle, 1000); // Dar tiempo a la pÃ¡gina para cargar
      setTimeout(customizeTheme, 500); // Aplicar tema lo antes posible
      setTimeout(injectBadgesScript, 800);
    });
  } else {
    customizeWhatsApp();
    customizeBanners();
    setTimeout(customizeMenu, 500); // Dar tiempo al menÃº para renderizar
    setTimeout(customizeSearchBar, 600); // Buscador mejorado
    setTimeout(customizeLightToggle, 1000); // Dar tiempo a la pÃ¡gina para cargar
    setTimeout(customizeTheme, 500); // Aplicar tema lo antes posible
    setTimeout(injectBadgesScript, 800);
  }

})();
`;

    res.send(script);
  } catch (error) {
    console.error("Error generando style-widget:", error);
    res.status(500).send("// Error interno: " + error.message);
  }
});

// GET /api/top-header-widget.js - Header superior personalizado
app.get("/api/top-header-widget.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    const styleDoc = await db.collection("promonube_style_config").doc(store).get();
    
    if (!styleDoc.exists) {
      return res.send("// No hay configuraciÃ³n");
    }

    const config = styleDoc.data();

    if (!config.topHeader || !config.topHeader.enabled) {
      return res.send("// Top Header disabled");
    }

    const headerConfig = config.topHeader;

    const script = `
(function() {
  'use strict';

  const CONFIG = ${JSON.stringify(headerConfig)};

  if (window.pnTopHeaderLoaded) return;
  window.pnTopHeaderLoaded = true;

  function createTopHeader() {
    console.log('[PromoNube] Creando Top Header...');

    // Verificar si ya existe
    if (document.getElementById('pn-top-header')) {
      console.log('[PromoNube] Top Header ya existe');
      return;
    }
    
    // Buscar el header de TiendaNube
    const tiendanubeHeader = document.querySelector('header');
    
    if (!tiendanubeHeader) {
      console.warn('[PromoNube] No se encontrÃ³ header de TiendaNube');
      return;
    }

    // Cargar fuente de Google Fonts si es necesaria
    const fontFamily = CONFIG.fontFamily || 'system-ui';
    if (fontFamily !== 'system-ui' && fontFamily.includes("'")) {
      const fontName = fontFamily.split("'")[1];
      if (!document.querySelector(\`link[href*="\${fontName.replace(' ', '+')}"]\`)) {
        const link = document.createElement('link');
        link.href = \`https://fonts.googleapis.com/css2?family=\${fontName.replace(' ', '+')}:wght@300;400;500;600;700&display=swap\`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }

    // Crear el container del header - SIN position fixed, solo relative
    const header = document.createElement('div');
    header.id = 'pn-top-header';
    header.style.cssText = \`
      background-color: \${CONFIG.backgroundColor || '#f5f5f5'};
      color: \${CONFIG.textColor || '#333333'};
      padding: 8px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      line-height: 1.4;
      font-family: \${fontFamily};
      border-bottom: 1px solid rgba(0,0,0,0.1);
      position: relative;
      z-index: 50;
      width: 100%;
      box-sizing: border-box;
    \`;

    // Separar items por posiciÃ³n
    const leftItems = CONFIG.items.filter(item => (!item.position || item.position === 'left'));
    const rightItems = CONFIG.items.filter(item => item.position === 'right');

    // Crear contenedor principal con alineaciÃ³n configurada
    const mainContainer = document.createElement('div');
    const alignment = CONFIG.alignment || 'center';
    mainContainer.style.cssText = \`
      display: flex;
      align-items: center;
      justify-content: \${alignment === 'space-between' ? 'space-between' : alignment};
      width: 100%;
      gap: \${alignment === 'space-between' ? '0' : '20px'};
    \`;

    // FunciÃ³n para crear grupo de items con separadores
    function createItemGroup(items) {
      const container = document.createElement('div');
      container.style.cssText = 'display: flex; align-items: center; gap: 0;';

      items.forEach(function(item, index) {
        // No saltar items - mostrar todos (el campo active solo afecta el estilo)

        // Agregar separador antes de cada item (excepto el primero)
        if (container.children.length > 0) {
          const separator = document.createElement('span');
          separator.textContent = '|';
          separator.style.cssText = \`
            margin: 0 12px;
            color: \${CONFIG.textColor || '#333333'};
            opacity: 0.4;
            font-weight: 300;
          \`;
          container.appendChild(separator);
        }

        // Contenedor del item
        const itemEl = document.createElement('div');
        itemEl.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;';

        // Crear elemento de contenido (puede ser link o span)
        let contentEl;
        
        // Si tiene link, hacer clickeable todo el item
        if (item.link && item.link.trim() !== '') {
          contentEl = document.createElement('a');
          contentEl.href = item.link;
          contentEl.style.cssText = \`
            color: \${CONFIG.textColor || '#333333'};
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            font-weight: \${item.active ? '600' : '400'};
            cursor: pointer;
            position: relative;
            z-index: 1;
          \`;
          contentEl.addEventListener('mouseenter', function() {
            contentEl.style.opacity = '0.7';
            contentEl.style.textDecoration = 'underline';
          });
          contentEl.addEventListener('mouseleave', function() {
            contentEl.style.opacity = '1';
            contentEl.style.textDecoration = 'none';
          });
        } else {
          contentEl = document.createElement('span');
          contentEl.style.cssText = \`
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: \${item.active ? '600' : '400'};
          \`;
        }

        // Ãcono
        if (item.icon) {
          const icon = document.createElement('span');
          icon.textContent = item.icon;
          icon.style.cssText = 'font-size: 15px;';
          contentEl.appendChild(icon);
        }

        // Texto
        const text = document.createElement('span');
        text.textContent = item.text || '';
        text.style.cssText = \`color: \${CONFIG.textColor || '#333333'};\`;
        contentEl.appendChild(text);

        itemEl.appendChild(contentEl);
        container.appendChild(itemEl);
      });

      return container;
    }

    // Agregar items segÃºn alineaciÃ³n
    if (alignment === 'space-between' && rightItems.length > 0) {
      // Modo distribuido: izquierda y derecha
      if (leftItems.length > 0) {
        mainContainer.appendChild(createItemGroup(leftItems));
      }
      if (rightItems.length > 0) {
        mainContainer.appendChild(createItemGroup(rightItems));
      }
    } else {
      // Modo normal: todos juntos
      const allItems = [...leftItems, ...rightItems];
      if (allItems.length > 0) {
        mainContainer.appendChild(createItemGroup(allItems));
      }
    }

    header.appendChild(mainContainer);

    // Agregar estilos responsive para mobile
    const responsiveStyles = document.createElement('style');
    responsiveStyles.textContent = \`
      /* Asegurar que el header de TiendaNube estÃ© por encima */
      header, .site-header, .header {
        position: relative !important;
        z-index: 1000 !important;
      }
      
      /* Asegurar que el menÃº de navegaciÃ³n estÃ© por encima */
      nav, .navigation, .main-nav, .navbar, .menu {
        position: relative !important;
        z-index: 1001 !important;
      }
      
      @media (max-width: 768px) {
        #pn-top-header {
          padding: 8px 10px !important;
          font-size: 11px !important;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }
        #pn-top-header > div {
          flex-direction: row !important;
          gap: 12px !important;
          width: max-content !important;
          min-width: 100%;
          justify-content: flex-start !important;
        }
        #pn-top-header > div > div {
          gap: 8px !important;
          flex-shrink: 0;
        }
        #pn-top-header span {
          font-size: 11px !important;
        }
        #pn-top-header a, #pn-top-header > div > div > div {
          white-space: nowrap !important;
        }
      }
      @media (max-width: 480px) {
        #pn-top-header {
          font-size: 10px !important;
          padding: 6px 8px !important;
        }
        #pn-top-header span {
          font-size: 10px !important;
        }
      }
    \`;
    document.head.appendChild(responsiveStyles);

    // Insertar ANTES del header de TiendaNube (arriba de todo)
    tiendanubeHeader.parentNode.insertBefore(header, tiendanubeHeader);

    console.log('[PromoNube] Top Header creado âœ…');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTopHeader);
  } else {
    createTopHeader();
  }

})();
`;

    res.send(script);
  } catch (error) {
    console.error("Error generando top-header-widget:", error);
    res.status(500).send("// Error interno: " + error.message);
  }
});

// GET /api/top-announcement-bar-widget.js - Barra de ofertas SUPERIOR
app.get("/api/top-announcement-bar-widget.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    const styleDoc = await db.collection("promonube_style_config").doc(store).get();
    
    if (!styleDoc.exists) {
      return res.send("// No hay configuraciÃ³n");
    }

    const config = styleDoc.data();

    if (!config.topAnnouncementBar || !config.topAnnouncementBar.enabled) {
      return res.send("// Top Announcement Bar disabled");
    }

    const barConfig = config.topAnnouncementBar;

    const script = `
(function() {
  'use strict';

  const CONFIG = ${JSON.stringify(barConfig)};

  if (window.pnTopAnnouncementBarLoaded) return;
  window.pnTopAnnouncementBarLoaded = true;

  function createTopAnnouncementBar() {
    console.log('[PromoNube] Creando Top Announcement Bar...');

    // Verificar visibilidad por dispositivo
    const visibility = CONFIG.visibility || 'both';
    const isMobileDevice = window.innerWidth <= 768;
    if (visibility === 'desktop' && isMobileDevice) {
      console.log('[PromoNube] Top Announcement Bar oculta en mobile (config: solo desktop)');
      return;
    }
    if (visibility === 'mobile' && !isMobileDevice) {
      console.log('[PromoNube] Top Announcement Bar oculta en desktop (config: solo mobile)');
      return;
    }

    if (!CONFIG.messages || CONFIG.messages.length === 0) {
      console.log('[PromoNube] No hay mensajes configurados');
      return;
    }

    // Verificar si ya existe
    if (document.getElementById('pn-top-announcement-bar')) {
      console.log('[PromoNube] Top Announcement Bar ya existe');
      return;
    }

    // Cargar fuente de Google Fonts si es necesaria
    const fontFamily = CONFIG.fontFamily || 'system-ui';
    if (fontFamily !== 'system-ui' && fontFamily.includes("'")) {
      const fontName = fontFamily.split("'")[1];
      if (!document.querySelector(\`link[href*="\${fontName.replace(' ', '+')}"]\`)) {
        const link = document.createElement('link');
        link.href = \`https://fonts.googleapis.com/css2?family=\${fontName.replace(' ', '+')}:wght@300;400;500;600;700&display=swap\`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }

    // Crear la barra
    const bar = document.createElement('div');
    bar.id = 'pn-top-announcement-bar';
    
    // Construir estilos de borde
    let borderStyles = '';
    if (CONFIG.borderEnabled) {
      const borderWidth = CONFIG.borderWidth || 1;
      const borderStyle = CONFIG.borderStyle || 'solid';
      const borderColor = CONFIG.borderColor || '#000000';
      
      if (CONFIG.borderTop) borderStyles += \`border-top: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
      if (CONFIG.borderBottom) borderStyles += \`border-bottom: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
      if (CONFIG.borderLeft) borderStyles += \`border-left: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
      if (CONFIG.borderRight) borderStyles += \`border-right: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
    }
    
    bar.style.cssText = \`
      background-color: \${CONFIG.backgroundColor || '#1a1a1a'};
      color: \${CONFIG.textColor || '#ffffff'};
      padding: \${CONFIG.padding || 11}px 20px;
      text-align: center;
      font-size: \${CONFIG.fontSize || 13}px;
      font-weight: \${CONFIG.fontWeight || 500};
      font-family: \${fontFamily};
      letter-spacing: 0.3px;
      position: relative;
      z-index: 40;
      overflow: visible;
      display: block !important;
      width: 100% !important;
      clear: both !important;
      box-sizing: border-box;
      flex-basis: 100% !important;
      flex-shrink: 0 !important;
      \${borderStyles}
    \`;

    // Detectar si es mobile
    const isMobile = window.innerWidth <= 768;

    // Crear el contenedor de mensajes
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = \`
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      flex-wrap: wrap;
      line-height: 1.6;
      row-gap: 8px;
      position: relative;
      width: 100%;
    \`;

    if (isMobile && CONFIG.messages.length > 1) {
      // MOBILE: Modo carrusel - mostrar 1 mensaje a la vez con rotaciÃ³n
      let currentIndex = 0;
      const messageEl = document.createElement('div');
      messageEl.style.cssText = \`
        text-align: center;
        width: 100%;
        transition: opacity 0.5s ease;
      \`;

      function updateMessage() {
        const msg = CONFIG.messages[currentIndex];
        messageEl.innerHTML = '';
        
        if (msg.link && msg.link.trim() !== '') {
          const link = document.createElement('a');
          link.href = msg.link;
          link.textContent = msg.text || '';
          link.style.cssText = \`
            color: \${CONFIG.textColor || '#ffffff'};
            text-decoration: none;
            font-weight: 500;
            display: inline-block;
          \`;
          link.addEventListener('mouseenter', function() {
            link.style.textDecoration = 'underline';
          });
          link.addEventListener('mouseleave', function() {
            link.style.textDecoration = 'none';
          });
          messageEl.appendChild(link);
        } else {
          const textEl = document.createElement('span');
          textEl.textContent = msg.text || '';
          messageEl.appendChild(textEl);
        }
      }

      updateMessage();
      messageContainer.appendChild(messageEl);

      // Rotar cada 4 segundos
      setInterval(function() {
        messageEl.style.opacity = '0';
        setTimeout(function() {
          currentIndex = (currentIndex + 1) % CONFIG.messages.length;
          updateMessage();
          messageEl.style.opacity = '1';
        }, 500);
      }, 4000);
    } else {
      // DESKTOP: Mostrar todos con separadores |
      CONFIG.messages.forEach(function(msg, index) {
        // Agregar separador antes de cada mensaje (excepto el primero)
        if (index > 0) {
          const separator = document.createElement('span');
          separator.textContent = '|';
          separator.style.cssText = \`
            margin: 0 18px;
            color: \${CONFIG.textColor || '#ffffff'};
            opacity: 0.6;
            font-weight: 300;
            flex-shrink: 0;
            font-size: 18px;
            line-height: 1;
            display: inline-flex;
            align-items: center;
          \`;
          messageContainer.appendChild(separator);
        }

        // Wrapper para cada item (permite max-width)
        const itemWrapper = document.createElement('div');
        itemWrapper.style.cssText = \`
          max-width: 400px;
          text-align: center;
        \`;

        // Crear elemento del mensaje
        if (msg.link && msg.link.trim() !== '') {
          const link = document.createElement('a');
          link.href = msg.link;
          link.textContent = msg.text || '';
          link.style.cssText = \`
            color: \${CONFIG.textColor || '#ffffff'};
            text-decoration: none;
            font-weight: 500;
            display: inline-block;
          \`;
          link.addEventListener('mouseenter', function() {
            link.style.textDecoration = 'underline';
          });
          link.addEventListener('mouseleave', function() {
            link.style.textDecoration = 'none';
          });
          itemWrapper.appendChild(link);
        } else {
          const textEl = document.createElement('span');
          textEl.textContent = msg.text || '';
          textEl.style.cssText = 'display: inline-block;';
          itemWrapper.appendChild(textEl);
        }

        messageContainer.appendChild(itemWrapper);
      });
    }

    bar.appendChild(messageContainer);

    // Agregar estilos para asegurar jerarquÃ­a de z-index
    const styleElement = document.createElement('style');
    styleElement.textContent = \`
      /* Asegurar que el header de TiendaNube estÃ© por encima */
      header, .site-header, .header {
        position: relative !important;
        z-index: 1000 !important;
      }
      
      /* Asegurar que el menÃº de navegaciÃ³n estÃ© por encima */
      nav, .navigation, .main-nav, .navbar, .menu {
        position: relative !important;
        z-index: 1001 !important;
      }
      
      /* Prevenir que la barra quede flotando */
      #pn-top-announcement-bar {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        transform: none !important;
      }
    \`;
    document.head.appendChild(styleElement);

    // Esperar a que el DOM estÃ© completamente listo
    setTimeout(function() {
      // Verificar si ya existe para no duplicar
      if (document.getElementById('pn-top-announcement-bar')) {
        console.log('[PromoNube] Top Announcement Bar ya existe');
        return;
      }
      
      // Primero, asegurar que se inserte DENTRO del header
      const header = document.querySelector('header');
      
      if (!header) {
        console.warn('[PromoNube] âš ï¸ No se encontrÃ³ el header');
        return;
      }
      
      // Buscar logo y nav dentro del header
      let logo = header.querySelector('.logo, [class*="logo" i], a[href="/"], img[alt*="logo" i], .site-brand, .brand');
      let nav = header.querySelector('nav, [role="navigation"], .navigation, .main-nav');
      
      // Si logo es una imagen, subir al contenedor
      if (logo && logo.tagName === 'IMG' && logo.parentElement.tagName === 'A') {
        logo = logo.parentElement;
      }
      
      // Estrategia: Insertar DESPUÃ‰S del logo pero ANTES del nav
      if (logo && nav) {
        // Verificar que estÃ©n en el mismo contenedor
        if (logo.parentNode === nav.parentNode) {
          // Insertar entre logo y nav
          logo.parentNode.insertBefore(bar, nav);
          console.log('[PromoNube] âœ… Top Announcement Bar insertada entre logo y nav');
        } else {
          // Si estÃ¡n en diferentes contenedores, insertar antes del nav
          nav.parentNode.insertBefore(bar, nav);
          console.log('[PromoNube] âœ… Top Announcement Bar insertada antes del nav (diferentes contenedores)');
        }
      } else if (logo) {
        // Solo tenemos logo, insertar despuÃ©s
        if (logo.nextSibling) {
          logo.parentNode.insertBefore(bar, logo.nextSibling);
        } else {
          logo.parentNode.appendChild(bar);
        }
        console.log('[PromoNube] âœ… Top Announcement Bar insertada DESPUÃ‰S del logo');
      } else if (nav) {
        // Solo tenemos nav, insertar antes
        nav.parentNode.insertBefore(bar, nav);
        console.log('[PromoNube] âœ… Top Announcement Bar insertada ANTES del nav');
      } else {
        // No encontramos ni logo ni nav, insertar al principio del header
        if (header.firstChild) {
          header.insertBefore(bar, header.firstChild);
        } else {
          header.appendChild(bar);
        }
        console.log('[PromoNube] âš ï¸ Top Announcement Bar insertada al inicio del header');
      }
      
    }, 250);

    console.log('[PromoNube] Top Announcement Bar creada âœ…');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTopAnnouncementBar);
  } else {
    createTopAnnouncementBar();
  }

})();
`;

    res.send(script);
  } catch (error) {
    console.error("Error generando top-announcement-bar-widget:", error);
    res.status(500).send("// Error interno: " + error.message);
  }
});

// GET /api/announcement-bar-widget.js - Barra de ofertas con rotaciÃ³n
app.get("/api/announcement-bar-widget.js", async (req, res) => {
  const { store } = req.query;
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  try {
    if (!store) {
      return res.send("// Error: storeId requerido");
    }

    const styleDoc = await db.collection("promonube_style_config").doc(store).get();
    
    if (!styleDoc.exists) {
      return res.send("// No hay configuraciÃ³n");
    }

    const config = styleDoc.data();

    if (!config.announcementBar || !config.announcementBar.enabled) {
      return res.send("// Announcement Bar disabled");
    }

    const barConfig = config.announcementBar;

    const script = `
(function() {
  'use strict';

  const CONFIG = ${JSON.stringify(barConfig)};

  if (window.pnAnnouncementBarLoaded) return;
  window.pnAnnouncementBarLoaded = true;

  function createAnnouncementBar() {
    console.log('[PromoNube] Creando Announcement Bar...');

    // Verificar visibilidad por dispositivo
    const visibility = CONFIG.visibility || 'both';
    const isMobileDevice = window.innerWidth <= 768;
    if (visibility === 'desktop' && isMobileDevice) {
      console.log('[PromoNube] Announcement Bar oculta en mobile (config: solo desktop)');
      return;
    }
    if (visibility === 'mobile' && !isMobileDevice) {
      console.log('[PromoNube] Announcement Bar oculta en desktop (config: solo mobile)');
      return;
    }

    if (!CONFIG.messages || CONFIG.messages.length === 0) {
      console.log('[PromoNube] No hay mensajes configurados');
      return;
    }

    // Buscar donde insertar (antes del header o al principio del body)
    const insertPoint = document.querySelector('header, .header, #header, body');
    
    if (!insertPoint) {
      console.warn('[PromoNube] No se encontrÃ³ punto de inserciÃ³n');
      return;
    }

    // Verificar si ya existe
    if (document.getElementById('pn-announcement-bar')) {
      console.log('[PromoNube] Announcement Bar ya existe');
      return;
    }

    // Cargar fuente de Google Fonts si es necesaria
    const fontFamily = CONFIG.fontFamily || 'system-ui';
    if (fontFamily !== 'system-ui' && fontFamily.includes("'")) {
      const fontName = fontFamily.split("'")[1];
      if (!document.querySelector(\`link[href*="\${fontName.replace(' ', '+')}"]\`)) {
        const link = document.createElement('link');
        link.href = \`https://fonts.googleapis.com/css2?family=\${fontName.replace(' ', '+')}:wght@300;400;500;600;700&display=swap\`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }

    // Crear la barra
    const bar = document.createElement('div');
    bar.id = 'pn-announcement-bar';
    
    // Construir estilos de borde
    let borderStyles = '';
    if (CONFIG.borderEnabled) {
      const borderWidth = CONFIG.borderWidth || 1;
      const borderStyle = CONFIG.borderStyle || 'solid';
      const borderColor = CONFIG.borderColor || '#000000';
      
      if (CONFIG.borderTop) borderStyles += \`border-top: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
      if (CONFIG.borderBottom) borderStyles += \`border-bottom: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
      if (CONFIG.borderLeft) borderStyles += \`border-left: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
      if (CONFIG.borderRight) borderStyles += \`border-right: \${borderWidth}px \${borderStyle} \${borderColor}; \`;
    }
    
    bar.style.cssText = \`
      background-color: \${CONFIG.backgroundColor || '#8B0000'};
      color: \${CONFIG.textColor || '#ffffff'};
      padding: \${CONFIG.padding || 11}px 20px;
      text-align: center;
      font-size: \${CONFIG.fontSize || 13}px;
      font-weight: \${CONFIG.fontWeight || 500};
      font-family: \${fontFamily};
      letter-spacing: 0.3px;
      position: relative;
      z-index: 60;
      overflow: visible;
      \${borderStyles}
    \`;

    // Detectar si es mobile
    const isMobile = window.innerWidth <= 768;

    // Crear el contenedor de mensajes
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = \`
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      flex-wrap: wrap;
      line-height: 1.6;
      row-gap: 8px;
      position: relative;
      width: 100%;
    \`;

    if (isMobile && CONFIG.messages.length > 1) {
      // MOBILE: Modo carrusel - mostrar 1 mensaje a la vez con rotaciÃ³n suave
      let currentIndex = 0;
      const messageEl = document.createElement('div');
      messageEl.style.cssText = \`
        text-align: center;
        width: 100%;
        transition: opacity 0.3s ease-in-out;
        opacity: 1;
      \`;

      function updateMessage() {
        const msg = CONFIG.messages[currentIndex];
        messageEl.innerHTML = '';
        
        if (msg.link && msg.link.trim() !== '') {
          const link = document.createElement('a');
          link.href = msg.link;
          link.textContent = msg.text || '';
          link.style.cssText = \`
            color: \${CONFIG.textColor || '#ffffff'};
            text-decoration: none;
            font-weight: 500;
            display: inline-block;
          \`;
          link.addEventListener('mouseenter', function() {
            link.style.textDecoration = 'underline';
          });
          link.addEventListener('mouseleave', function() {
            link.style.textDecoration = 'none';
          });
          messageEl.appendChild(link);
        } else {
          const textEl = document.createElement('span');
          textEl.textContent = msg.text || '';
          messageEl.appendChild(textEl);
        }
      }

      updateMessage();
      messageContainer.appendChild(messageEl);

      // Rotar cada 5 segundos con transiciÃ³n suave
      setInterval(function() {
        messageEl.style.opacity = '0';
        setTimeout(function() {
          currentIndex = (currentIndex + 1) % CONFIG.messages.length;
          updateMessage();
          messageEl.style.opacity = '1';
        }, 300);
      }, 5000);
    } else {
      // DESKTOP: Mostrar todos con separadores |
      CONFIG.messages.forEach(function(msg, index) {
        // Agregar separador antes de cada mensaje (excepto el primero)
        if (index > 0) {
          const separator = document.createElement('span');
          separator.textContent = '|';
          separator.style.cssText = \`
            margin: 0 18px;
            color: \${CONFIG.textColor || '#ffffff'};
            opacity: 0.6;
            font-weight: 300;
            flex-shrink: 0;
            font-size: 18px;
            line-height: 1;
            display: inline-flex;
            align-items: center;
          \`;
          messageContainer.appendChild(separator);
        }

        // Wrapper para cada item (permite max-width)
        const itemWrapper = document.createElement('div');
        itemWrapper.style.cssText = \`
          max-width: 400px;
          text-align: center;
        \`;

        // Crear elemento del mensaje
        if (msg.link && msg.link.trim() !== '') {
          const link = document.createElement('a');
          link.href = msg.link;
          link.textContent = msg.text || '';
          link.style.cssText = \`
            color: \${CONFIG.textColor || '#ffffff'};
            text-decoration: none;
            font-weight: 500;
            display: inline-block;
          \`;
          link.addEventListener('mouseenter', function() {
            link.style.textDecoration = 'underline';
          });
          link.addEventListener('mouseleave', function() {
            link.style.textDecoration = 'none';
          });
          itemWrapper.appendChild(link);
        } else {
          const textEl = document.createElement('span');
          textEl.textContent = msg.text || '';
          textEl.style.cssText = 'display: inline-block;';
          itemWrapper.appendChild(textEl);
        }

        messageContainer.appendChild(itemWrapper);
      });
    }

    bar.appendChild(messageContainer);

    // Insertar SIEMPRE despuÃ©s del header principal de TiendaNube (no despuÃ©s del Top Header)
    const mainHeader = document.querySelector('header, .header, #header, .site-header');
    if (mainHeader) {
      if (mainHeader.nextSibling) {
        mainHeader.parentNode.insertBefore(bar, mainHeader.nextSibling);
      } else {
        mainHeader.parentNode.appendChild(bar);
      }
    } else {
      // Ãšltima opciÃ³n: al principio del body
      document.body.insertBefore(bar, document.body.firstChild);
    }

    console.log('[PromoNube] Announcement Bar creada âœ…');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createAnnouncementBar);
  } else {
    createAnnouncementBar();
  }

})();
`;

    res.send(script);
  } catch (error) {
    console.error("Error generando announcement-bar-widget:", error);
    res.status(500).send("// Error interno: " + error.message);
  }
});

// ============================================
// ENDPOINTS DE INTEGRACIONES
// ============================================

// GET /api/integrations - Obtener configuraciÃ³n de integraciones
app.get("/api/integrations", async (req, res) => {
  const storeId = req.query.storeId;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    const store = storeDoc.data();

    // Devolver solo los flags de configuraciÃ³n (no las API keys por seguridad)
    res.json({
      success: true,
      integrations: {
        perfit: {
          enabled: store.perfitEnabled || false,
          configured: !!(store.perfitApiKey && store.perfitAccountId),
          accountId: store.perfitAccountId || null,
          defaultList: store.perfitDefaultList || null
        },
        mailchimp: {
          enabled: store.mailchimpEnabled || false,
          configured: !!(store.mailchimpApiKey && store.mailchimpListId),
          listId: store.mailchimpListId || null
        },
        activecampaign: {
          enabled: store.activeCampaignEnabled || false,
          configured: !!(store.activeCampaignApiKey && store.activeCampaignUrl)
        }
      }
    });
  } catch (error) {
    console.error("Error obteniendo integraciones:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// POST /api/integrations/perfit - Configurar Perfit
app.post("/api/integrations/perfit", async (req, res) => {
  const { storeId, apiKey, accountId, defaultList, enabled } = req.body;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    const updateData = {
      perfitEnabled: enabled !== false,
      updatedAt: new Date().toISOString()
    };

    // Solo actualizar apiKey si se proporciona
    if (apiKey) {
      updateData.perfitApiKey = apiKey;
    }
    if (accountId) {
      updateData.perfitAccountId = accountId;
    }
    if (defaultList !== undefined) {
      updateData.perfitDefaultList = defaultList;
    }

    await db.collection("promonube_stores").doc(storeId).update(updateData);

    console.log("âœ… Perfit configurado para store:", storeId);
    
    res.json({
      success: true,
      message: "Perfit configurado correctamente"
    });
  } catch (error) {
    console.error("Error configurando Perfit:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// POST /api/integrations/perfit/test - Probar conexión con Perfit
app.post("/api/integrations/perfit/test", async (req, res) => {
  const { storeId } = req.body;
  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }
  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }
    const store = storeDoc.data();
    if (!store.perfitApiKey || !store.perfitAccountId) {
      return res.json({
        success: false,
        message: "Perfit no está configurado. Ingresá tu API Key y Account ID.",
        details: {
          hasApiKey: !!store.perfitApiKey,
          hasAccountId: !!store.perfitAccountId
        }
      });
    }
    // Probar la conexión haciendo GET de los contacts (para validar credenciales)
    const testResponse = await fetch(
      `https://api.perfit.io/v1/accounts/${store.perfitAccountId}/contacts?limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${store.perfitApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (testResponse.ok) {
      return res.json({ success: true, message: "Conexión con Perfit exitosa! Las credenciales son correctas." });
    } else {
      const errorBody = await testResponse.text();
      return res.json({
        success: false,
        message: `Error de autenticación con Perfit (HTTP ${testResponse.status})`,
        details: {
          status: testResponse.status,
          statusText: testResponse.statusText,
          body: errorBody.substring(0, 300)
        }
      });
    }
  } catch (error) {
    return res.json({
      success: false,
      message: "Error de red al conectar con Perfit: " + error.message,
      details: { error: error.message }
    });
  }
});

// POST /api/integrations/mailchimp - Configurar Mailchimp
app.post("/api/integrations/mailchimp", async (req, res) => {
  const { storeId, apiKey, listId, enabled } = req.body;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "storeId requerido" });
  }

  try {
    const updateData = {
      mailchimpEnabled: enabled !== false,
      updatedAt: new Date().toISOString()
    };

    if (apiKey) {
      updateData.mailchimpApiKey = apiKey;
    }
    if (listId) {
      updateData.mailchimpListId = listId;
    }

    await db.collection("promonube_stores").doc(storeId).update(updateData);

    console.log("âœ… Mailchimp configurado para store:", storeId);
    
    res.json({ 
      success: true, 
      message: "Mailchimp configurado correctamente" 
    });
  } catch (error) {
    console.error("Error configurando Mailchimp:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// POST /api/integrations/test - Probar integraciÃ³n
app.post("/api/integrations/test", async (req, res) => {
  const { storeId, integration, email } = req.body;

  if (!storeId || !integration || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "storeId, integration y email requeridos" 
    });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    const store = { id: storeDoc.id, ...storeDoc.data() };
    let result;

    const testData = {
      tags: ['test_promonube'],
      customFields: {
        'test_date': new Date().toISOString()
      }
    };

    switch (integration) {
      case 'perfit':
        result = await sendToPerfit(store, email, testData);
        break;
      case 'mailchimp':
        result = await sendToMailchimp(store, email, testData);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: "IntegraciÃ³n no vÃ¡lida" 
        });
    }

    res.json(result);
  } catch (error) {
    console.error("Error probando integraciÃ³n:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ENDPOINT PARA SUBIR IMÃGENES EN BASE64 (mÃ¡s simple)
// ============================================
app.post("/api/upload-image-base64", async (req, res) => {
  try {
    console.log('ðŸ“¤ Upload image base64 request');
    
    const { storeId, fileName, fileData, folder } = req.body;
    
    if (!storeId || !fileName || !fileData) {
      return res.json({ 
        success: false, 
        message: 'Faltan parÃ¡metros requeridos' 
      });
    }
    
    // Extraer el base64 puro (quitar el prefijo data:image/...)
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      return res.json({ 
        success: false, 
        message: 'Formato de imagen invÃ¡lido' 
      });
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    console.log(`ðŸ“¦ File: ${fileName}, Size: ${buffer.length} bytes, Type: ${mimeType}`);
    
    // Crear path Ãºnico
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder || 'images'}/${storeId}/${timestamp}-${sanitizedName}`;
    
    console.log(`ðŸ“ Uploading to: ${filePath}`);
    
    // Subir a Storage
    const fileUpload = bucket.file(filePath);
    
    await fileUpload.save(buffer, {
      metadata: {
        contentType: mimeType
      }
    });
    
    console.log('âœ… File saved');
    
    // Hacer pÃºblico
    await fileUpload.makePublic();
    
    // URL pÃºblica
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    console.log(`âœ… Public URL: ${publicUrl}`);
    
    res.json({ 
      success: true, 
      url: publicUrl 
    });
    
  } catch (error) {
    console.error('âŒ Upload error:', error);
    res.json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ENDPOINT PARA SUBIR IMÃGENES (Multer)
// ============================================
app.post("/api/upload-image", (req, res, next) => {
  console.log('ðŸ“¤ Upload request iniciado');
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Content-Type:', req.get('content-type'));
  next();
}, upload.single('image'), async (req, res) => {
  try {
    console.log('ðŸ“¤ Upload image - dentro del handler');
    console.log('req.file:', req.file ? 'SI' : 'NO');
    console.log('req.body:', JSON.stringify(req.body));
    
    // Validar que se subiÃ³ un archivo
    if (!req.file) {
      console.error('âŒ No file uploaded');
      console.error('Body recibido:', JSON.stringify(req.body));
      return res.status(400).json({ 
        success: false, 
        message: 'No se recibiÃ³ ninguna imagen. Verifica que el campo se llama "image"' 
      });
    }
    
    // Obtener storeId y folder del body
    const storeId = req.body.storeId;
    const folder = req.body.folder || 'images';
    
    if (!storeId) {
      console.error('âŒ No storeId provided');
      return res.status(400).json({ 
        success: false, 
        message: 'storeId es requerido' 
      });
    }
    
    console.log(`ðŸ“ StoreId: ${storeId}, Folder: ${folder}`);
    console.log(`ðŸ“¦ File: ${req.file.originalname}, Size: ${req.file.size} bytes`);
    
    // Crear nombre Ãºnico para el archivo
    const timestamp = Date.now();
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${storeId}/${timestamp}-${sanitizedName}`;
    
    console.log(`ðŸ“ Uploading to: ${filePath}`);
    
    // Subir a Firebase Storage
    const fileUpload = bucket.file(filePath);
    
    await fileUpload.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype
      }
    });
    
    console.log('âœ… File saved to bucket');
    
    // Hacer el archivo pÃºblico
    await fileUpload.makePublic();
    
    console.log('âœ… File made public');
    
    // Obtener URL pÃºblica
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    console.log(`âœ… Public URL: ${publicUrl}`);
    
    res.json({ 
      success: true, 
      url: publicUrl,
      message: 'Imagen subida correctamente'
    });
    
  } catch (error) {
    console.error('âŒ Upload error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: `Error al subir imagen: ${error.message}`
    });
  }
});

// ============================================
// ENDPOINTS: GESTIÃ“N DE SUSCRIPCIONES
// ============================================

// GET /api/subscription/:storeId - Obtener suscripciÃ³n actual
app.get('/api/subscription/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      // Inicializar suscripciÃ³n FREE si no existe
      await initializeStoreSubscription(storeId);
      const newDoc = await subscriptionRef.get();
      return res.json({
        success: true,
        subscription: newDoc.data(),
        availableModules: MODULES,
        availablePlans: PLANS
      });
    }

    res.json({
      success: true,
      subscription: subscriptionDoc.data(),
      availableModules: MODULES,
      availablePlans: PLANS
    });
  } catch (error) {
    console.error('Error obteniendo suscripciÃ³n:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/subscription/:storeId/activate - Activar mÃ³dulo individual
app.post('/api/subscription/:storeId/activate', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { moduleName } = req.body;

    if (!MODULES[moduleName]) {
      return res.status(400).json({ success: false, error: 'MÃ³dulo no vÃ¡lido' });
    }

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    
    await subscriptionRef.set({
      [`modules.${moduleName}`]: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `MÃ³dulo ${MODULES[moduleName].name} activado`,
      module: moduleName
    });
  } catch (error) {
    console.error('Error activando mÃ³dulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/subscription/:storeId/deactivate - Desactivar mÃ³dulo
app.post('/api/subscription/:storeId/deactivate', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { moduleName } = req.body;

    if (moduleName === 'coupons') {
      return res.status(400).json({ success: false, error: 'No se puede desactivar Cupones (mÃ³dulo gratuito)' });
    }

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    
    await subscriptionRef.set({
      [`modules.${moduleName}`]: false,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `MÃ³dulo ${MODULES[moduleName]?.name || moduleName} desactivado`,
      module: moduleName
    });
  } catch (error) {
    console.error('Error desactivando mÃ³dulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/subscription/:storeId/change-plan - Cambiar plan
app.post('/api/subscription/:storeId/change-plan', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { planId } = req.body;

    if (!PLANS[planId]) {
      return res.status(400).json({ success: false, error: 'Plan no vÃ¡lido' });
    }

    const plan = PLANS[planId];
    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    
    // Crear objeto de mÃ³dulos basado en el plan
    const modules = {
      coupons: true, // Siempre activo
      giftcards: plan.modules.includes('giftcards'),
      spinWheel: plan.modules.includes('spinWheel'),
      style: plan.modules.includes('style'),
      countdown: plan.modules.includes('countdown')
    };

    await subscriptionRef.set({
      plan: planId,
      modules: modules,
      status: 'active',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `Plan cambiado a ${plan.name}`,
      plan: planId,
      modules: modules
    });
  } catch (error) {
    console.error('Error cambiando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/subscription/:storeId/check/:module - Verificar acceso a mÃ³dulo
app.get('/api/subscription/:storeId/check/:module', async (req, res) => {
  try {
    const { storeId, module } = req.params;
    const accessCheck = await checkModuleAccess(storeId, module);

    res.json({
      success: true,
      hasAccess: accessCheck.hasAccess,
      reason: accessCheck.reason,
      module: module,
      moduleName: MODULES[module]?.name || module
    });
  } catch (error) {
    console.error('Error verificando acceso:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ENDPOINTS: MERCADO PAGO INTEGRATION
// ============================================

// POST /api/mp/create-preference - Crear preferencia de pago
app.post('/api/mp/create-preference', async (req, res) => {
  try {
    const { storeId, planId, storeEmail, storeName } = req.body;

    console.log('ðŸ“¥ Request crear preferencia:', { storeId, planId, storeEmail, storeName });
    console.log('ðŸ”‘ MP_ACCESS_TOKEN existe:', !!MP_ACCESS_TOKEN);
    console.log('ðŸ”§ mpClient existe:', !!mpClient);

    // Verificar que MP estÃ© configurado
    if (!MP_ACCESS_TOKEN || !mpClient) {
      console.error('âŒ Mercado Pago no estÃ¡ configurado');
      console.error('MP_ACCESS_TOKEN:', MP_ACCESS_TOKEN ? 'Existe' : 'No existe');
      console.error('mpClient:', mpClient ? 'Existe' : 'No existe');
      return res.status(500).json({ 
        success: false, 
        error: 'Mercado Pago no estÃ¡ configurado. Contacta al administrador.',
        details: 'El servicio de pagos no estÃ¡ disponible temporalmente' 
      });
    }

    if (!PLANS[planId]) {
      console.error('âŒ Plan invÃ¡lido:', planId);
      return res.status(400).json({ success: false, error: 'Plan invÃ¡lido' });
    }

    const plan = PLANS[planId];
    
    if (planId === 'free') {
      return res.status(400).json({ success: false, error: 'El plan Free no requiere pago' });
    }

    console.log('ðŸ’³ Creando preferencia de pago:', { storeId, planId, amount: plan.price });

    // Crear preferencia de pago
    const preference = new Preference(mpClient);
    
    const preferenceData = {
      items: [
        {
          title: `PromoNube - ${plan.name}`,
          description: `SuscripciÃ³n mensual a ${plan.name}`,
          quantity: 1,
          unit_price: plan.price,
          currency_id: 'ARS'
        }
      ],
      payer: {
        email: storeEmail || 'cliente@tienda.com',
        name: storeName || 'Cliente'
      },
      back_urls: {
        success: `https://pedidos-lett-2.web.app/payment-success?plan=${planId}`,
        failure: `https://pedidos-lett-2.web.app/payment-failure`,
        pending: `https://pedidos-lett-2.web.app/payment-pending`
      },
      auto_return: 'approved',
      notification_url: `https://apipromonube-jlfopowzaq-uc.a.run.app/api/mp/webhook`,
      external_reference: JSON.stringify({
        storeId: storeId,
        planId: planId,
        timestamp: Date.now()
      }),
      metadata: {
        store_id: storeId,
        plan_id: planId
      }
    };

    console.log('ðŸ“¦ Enviando a MP:', JSON.stringify(preferenceData, null, 2));

    const result = await preference.create({ body: preferenceData });

    console.log('âœ… Preferencia creada:', result.id);

    // Guardar referencia en Firestore
    await db.collection('promonube_payments').doc(result.id).set({
      storeId: storeId,
      planId: planId,
      preferenceId: result.id,
      amount: plan.price,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point
    });

  } catch (error) {
    console.error('âŒ Error creando preferencia MP:', error);
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Stack:', error.stack);
    console.error('Causa:', error.cause);
    console.error('Response:', error.response?.data);
    
    res.status(500).json({ 
      success: false, 
      error: 'Error al procesar el pago',
      details: error.message || 'Error desconocido',
      technical: error.cause?.message || error.response?.data?.message || 'Sin detalles tÃ©cnicos'
    });
  }
});

// POST /api/mp/webhook - Webhook para notificaciones de MP
app.post('/api/mp/webhook', async (req, res) => {
  try {
    console.log('ðŸ“© Webhook MP recibido:', req.body);
    console.log('ðŸ“‹ Headers:', req.headers);

    const { type, data } = req.body;

    // ValidaciÃ³n opcional de firma (si quieres mayor seguridad)
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    
    if (xSignature) {
      console.log('ðŸ” Signature recibida:', xSignature);
      // La validaciÃ³n de firma es opcional pero recomendada para producciÃ³n
      // Por ahora logueamos para debugging
    }

    // Responder rÃ¡pido a MP (200 dentro de 10 segundos)
    res.status(200).send('OK');

    // Procesar en background
    if (type === 'payment') {
      const paymentId = data.id;
      
      console.log('ðŸ’³ Procesando pago:', paymentId);

      // Obtener informaciÃ³n del pago desde MP
      const payment = new Payment(mpClient);
      const paymentData = await payment.get({ id: paymentId });

      console.log('ðŸ’° Estado del pago:', paymentData.status);
      console.log('ðŸ“¦ Metadata:', paymentData.metadata);

      // Si el pago estÃ¡ aprobado, activar el plan
      if (paymentData.status === 'approved') {
        const storeId = paymentData.metadata?.store_id;
        const planId = paymentData.metadata?.plan_id;

        if (!storeId || !planId) {
          console.error('âŒ Faltan datos en metadata:', paymentData.metadata);
          return;
        }

        console.log(`âœ… Pago aprobado - Activando plan ${planId} para store ${storeId}`);

        // Actualizar documento de pago
        const paymentRef = db.collection('promonube_payments').doc(paymentData.id.toString());
        await paymentRef.update({
          status: 'approved',
          paymentData: {
            id: paymentData.id,
            status: paymentData.status,
            statusDetail: paymentData.status_detail,
            transactionAmount: paymentData.transaction_amount,
            payer: paymentData.payer,
            paymentMethodId: paymentData.payment_method_id,
            dateApproved: paymentData.date_approved
          },
          approvedAt: FieldValue.serverTimestamp()
        });

        // Activar plan en la suscripciÃ³n
        const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
        const subscriptionDoc = await subscriptionRef.get();

        const plan = PLANS[planId];
        if (!plan) {
          console.error('âŒ Plan no encontrado:', planId);
          return;
        }

        // Calcular fecha de expiraciÃ³n (30 dÃ­as)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        if (subscriptionDoc.exists) {
          // Actualizar suscripciÃ³n existente
          await subscriptionRef.update({
            plan: planId,
            modules: modulesArrayToObject(plan.modules),
            status: 'active',
            activatedAt: FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            lastPaymentId: paymentData.id.toString(),
            lastPaymentAmount: paymentData.transaction_amount
          });
        } else {
          // Crear nueva suscripciÃ³n
          await subscriptionRef.set({
            storeId: storeId,
            plan: planId,
            modules: modulesArrayToObject(plan.modules),
            status: 'active',
            activatedAt: FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            lastPaymentId: paymentData.id.toString(),
            lastPaymentAmount: paymentData.transaction_amount,
            createdAt: FieldValue.serverTimestamp()
          });
        }

        console.log(`ðŸŽ‰ Plan ${planId} activado exitosamente para store ${storeId}`);
        console.log(`ðŸ“… Expira el: ${expiresAt.toISOString()}`);

      } else if (payment.status === 'rejected') {
        console.log('âŒ Pago rechazado:', payment.status_detail);
        
        // Actualizar estado del pago
        const paymentRef = db.collection('promonube_payments').doc(payment.id.toString());
        await paymentRef.update({
          status: 'rejected',
          statusDetail: payment.status_detail,
          rejectedAt: FieldValue.serverTimestamp()
        });

      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        console.log('â³ Pago pendiente:', payment.status_detail);
        
        // Actualizar estado del pago
        const paymentRef = db.collection('promonube_payments').doc(payment.id.toString());
        await paymentRef.update({
          status: payment.status,
          statusDetail: payment.status_detail
        });
      }

    }

  } catch (error) {
    console.error('âŒ Error en webhook MP:', error);
  }
});

// ============================================
// ENDPOINTS: ADMIN PANEL
// ============================================

// GET /api/admin/stores - Obtener todas las tiendas con suscripciones
app.get('/api/admin/stores', async (req, res) => {
  try {
    // Obtener todas las tiendas desde promonube_stores
    const storesSnapshot = await db.collection('promonube_stores').get();
    
    const stores = [];
    
    // Procesar cada tienda y obtener su suscripciÃ³n
    for (const storeDoc of storesSnapshot.docs) {
      const storeId = storeDoc.id;
      const storeData = storeDoc.data();
      
      // Obtener suscripciÃ³n actual desde stores/{storeId}/subscription/current
      let subscription = null;
      try {
        const subDoc = await db.collection('stores').doc(storeId).collection('subscription').doc('current').get();
        if (subDoc.exists) {
          const subData = subDoc.data();
          
          // Formatear fechas correctamente
          let activatedAt = null;
          if (subData.activatedAt) {
            activatedAt = typeof subData.activatedAt === 'string' ? subData.activatedAt : subData.activatedAt.toDate?.().toISOString();
          }
          
          let expiresAt = null;
          if (subData.demoExpiresAt) {
            expiresAt = typeof subData.demoExpiresAt === 'string' ? subData.demoExpiresAt : subData.demoExpiresAt.toDate?.().toISOString();
          } else if (subData.expiresAt) {
            expiresAt = typeof subData.expiresAt === 'string' ? subData.expiresAt : subData.expiresAt.toDate?.().toISOString();
          }
          
          // Formatear createdAt/installedAt
          let createdAt = null;
          if (subData.createdAt) {
            createdAt = typeof subData.createdAt === 'string' ? subData.createdAt : subData.createdAt.toDate?.().toISOString();
          } else if (subData.installedAt) {
            createdAt = typeof subData.installedAt === 'string' ? subData.installedAt : subData.installedAt.toDate?.().toISOString();
          } else if (storeData.installedAt) {
            createdAt = typeof storeData.installedAt === 'string' ? storeData.installedAt : storeData.installedAt.toDate?.().toISOString();
          }

          subscription = {
            plan: subData.plan || 'free',
            status: subData.status || 'inactive',
            modules: subData.modules || { coupons: true },
            isDemoAccount: subData.isDemoAccount || false,
            activatedAt: activatedAt,
            createdAt: createdAt,
            expiresAt: expiresAt,
            updatedAt: subData.updatedAt
          };
        }
      } catch (err) {
        console.log(`No se pudo obtener suscripciÃ³n para store ${storeId}:`, err.message);
      }
      
      // Si no hay suscripciÃ³n, usar datos de instalaciÃ³n de promonube_stores
      if (!subscription && storeData.installedAt) {
        const installedDate = typeof storeData.installedAt === 'string' ? storeData.installedAt : storeData.installedAt.toDate?.().toISOString();
        subscription = {
          plan: 'free',
          status: 'inactive',
          modules: { coupons: true },
          isDemoAccount: false,
          createdAt: installedDate
        };
      }

      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription: subscription || {
          plan: 'free',
          status: 'inactive',
          modules: { coupons: true },
          isDemoAccount: false
        }
      });
    }

    res.json({ success: true, stores });
  } catch (error) {
    console.error('Error obteniendo tiendas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/payments - Obtener todos los pagos
app.get('/api/admin/payments', async (req, res) => {
  try {
    const paymentsSnapshot = await db.collection('promonube_payments')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const payments = [];
    paymentsSnapshot.forEach(doc => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : null,
        approvedAt: data.approvedAt?._seconds ? new Date(data.approvedAt._seconds * 1000).toISOString() : null
      });
    });

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/uninstalls - Obtener todas las desinstalaciones
app.get('/api/admin/uninstalls', async (req, res) => {
  try {
    const uninstallsSnapshot = await db.collection('promonube_uninstalls')
      .orderBy('uninstalledAt', 'desc')
      .limit(100)
      .get();
    
    const uninstalls = [];
    uninstallsSnapshot.forEach(doc => {
      const data = doc.data();
      uninstalls.push({
        id: doc.id,
        storeId: data.storeId,
        storeName: data.storeName,
        country: data.country,
        installedAt: data.installedAt?._seconds ? new Date(data.installedAt._seconds * 1000).toISOString() : 
                     data.installedAt?.toDate ? data.installedAt.toDate().toISOString() : 
                     data.installedAt || null,
        uninstalledAt: data.uninstalledAt?._seconds ? new Date(data.uninstalledAt._seconds * 1000).toISOString() : 
                       data.uninstalledAt?.toDate ? data.uninstalledAt.toDate().toISOString() :
                       data.uninstalledAt || null,
        reason: data.reason || 'No especificado',
        reasonDetail: data.reasonDetail || null,
        plan: data.plan || 'free',
        isDemoAccount: data.isDemoAccount || false
      });
    });

    res.json({ success: true, uninstalls });
  } catch (error) {
    console.error('Error obteniendo desinstalaciones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/activate-plan - Activar plan manualmente
app.post('/api/admin/activate-plan', async (req, res) => {
  try {
    const { storeId, planId } = req.body;

    if (!storeId || !planId) {
      return res.status(400).json({ success: false, error: 'Faltan parÃ¡metros' });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Plan invÃ¡lido' });
    }

    // Calcular fecha de expiraciÃ³n (30 dÃ­as)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    await subscriptionRef.set({
      storeId: storeId,
      plan: planId,
      modules: modulesArrayToObject(plan.modules),
      status: 'active',
      activatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      manuallyActivated: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`ðŸ‘¨â€ðŸ’¼ Plan ${planId} activado manualmente para store ${storeId}`);

    res.json({
      success: true,
      message: `Plan ${plan.name} activado hasta ${expiresAt.toLocaleDateString()}`
    });
  } catch (error) {
    console.error('Error activando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/deactivate-plan - Desactivar plan
app.post('/api/admin/deactivate-plan', async (req, res) => {
  try {
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'Falta storeId' });
    }

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    await subscriptionRef.update({
      status: 'inactive',
      deactivatedAt: FieldValue.serverTimestamp()
    });

    console.log(`ðŸ›‘ Plan desactivado para store ${storeId}`);

    res.json({ success: true, message: 'Plan desactivado exitosamente' });
  } catch (error) {
    console.error('Error desactivando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NUBECATEGORIES ENDPOINTS
// ============================================

// GET: Obtener todas las categorÃ­as de TiendaNube
app.get('/api/nubecategories/:storeId/categories', async (req, res) => {
  try {
    const { storeId } = req.params;
    
    // Obtener token de la tienda
    const storeDoc = await db.collection('CategoriesNube_stores').doc(storeId.toString()).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    
    const { access_token } = storeDoc.data();
    
    // Obtener categorÃ­as de TiendaNube
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${access_token}`,
        'User-Agent': 'NubeCategories'
      }
    });
    
    const tiendanubeCategories = await response.json();

    // Guardar en cachÃ© en Firestore
    await db.collection('CategoriesNube_categories').doc(storeId).set({
      store_id: storeId,
      categories: tiendanubeCategories.results || tiendanubeCategories,
      last_synced: FieldValue.serverTimestamp(),
      total: tiendanubeCategories.paging?.total || tiendanubeCategories.results?.length || 0
    });

    res.json({
      success: true,
      categories: tiendanubeCategories.results || tiendanubeCategories,
      total: tiendanubeCategories.paging?.total || tiendanubeCategories.results?.length || 0
    });
  } catch (error) {
    console.error('âŒ Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Crear nueva categorÃ­a
app.post('/api/nubecategories/:storeId/categories', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { name, parent, description, seo_title, seo_description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const storeDoc = await db.collection('CategoriesNube_stores').doc(storeId.toString()).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    
    const { access_token } = storeDoc.data();

    // Crear en TiendaNube
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/categories`, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${access_token}`,
        'User-Agent': 'NubeCategories',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        parent: parent || null,
        description,
        seo_title,
        seo_description,
        handle: req.body.handle
      })
    });

    const newCategory = await response.json();

    // Guardar log en Firestore
    await db.collection('CategoriesNube_changes').add({
      store_id: storeId,
      action: 'create',
      category_id: newCategory.id,
      category_name: name,
      timestamp: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      category: newCategory,
      message: `Category "${name}" created successfully`
    });
  } catch (error) {
    console.error('âŒ Error creating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT: Actualizar categorÃ­a
app.put('/api/nubecategories/:storeId/categories/:categoryId', async (req, res) => {
  try {
    const { storeId, categoryId } = req.params;
    const { name, parent, description, seo_title, seo_description, visibility } = req.body;

    const storeDoc = await db.collection('CategoriesNube_stores').doc(storeId.toString()).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    
    const { access_token } = storeDoc.data();

    const updateData = {};
    if (name) updateData.name = { es: name };
    if (parent !== undefined) updateData.parent = parent;
    if (description) updateData.description = { es: description };
    if (seo_title) updateData.seo_title = { es: seo_title };
    if (seo_description) updateData.seo_description = { es: seo_description };
    if (visibility) updateData.visibility = visibility;

    // Actualizar en TiendaNube
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `bearer ${access_token}`,
        'User-Agent': 'NubeCategories',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const updatedCategory = await response.json();

    // Guardar log en Firestore
    await db.collection('CategoriesNube_changes').add({
      store_id: storeId,
      action: 'update',
      category_id: categoryId,
      category_name: name || 'Unknown',
      changes: Object.keys(updateData),
      timestamp: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      category: updatedCategory,
      message: `Category updated successfully`
    });
  } catch (error) {
    console.error('âŒ Error updating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Eliminar categorÃ­a
app.delete('/api/nubecategories/:storeId/categories/:categoryId', async (req, res) => {
  try {
    const { storeId, categoryId } = req.params;
    
    const storeDoc = await db.collection('CategoriesNube_stores').doc(storeId.toString()).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }
    
    const { access_token } = storeDoc.data();

    // Eliminar de TiendaNube
    await fetch(`https://api.tiendanube.com/v1/${storeId}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `bearer ${access_token}`,
        'User-Agent': 'NubeCategories'
      }
    });

    // Guardar log en Firestore
    await db.collection('CategoriesNube_changes').add({
      store_id: storeId,
      action: 'delete',
      category_id: categoryId,
      timestamp: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: `Category deleted successfully`
    });
  } catch (error) {
    console.error('âŒ Error deleting category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Obtener historial de cambios
app.get('/api/nubecategories/:storeId/changes', async (req, res) => {
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
    console.error('âŒ Error fetching changes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NUBECATEGORIES AUTH ENDPOINTS
// ============================================

// POST: Intercambiar cÃ³digo OAuth por token
app.post("/api/auth/nubecategories/exchange-code", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'CÃ³digo de autorizaciÃ³n requerido' 
      });
    }

    console.log('ðŸ” Intercambiando cÃ³digo:', code);

    // En TiendaNube, el cÃ³digo ya contiene el access_token
    // Hacemos una prueba llamando a la API para obtener el user_id
    // El cÃ³digo debe enviarse como Bearer token
    let storeId = null;
    
    try {
      const testResponse = await fetch('https://api.tiendanube.com/v1/me', {
        headers: { 
          'Authentication': `bearer ${code}`,
          'User-Agent': 'NubeCategories'
        }
      });

      if (testResponse.ok) {
        const userData = await testResponse.json();
        storeId = userData.id?.toString();
        console.log('âœ… Usuario validado, storeId:', storeId);
      } else {
        console.log('âŒ Status testResponse:', testResponse.status);
        const errorText = await testResponse.text();
        console.log('Error response:', errorText);
        throw new Error(`API error: ${testResponse.status}`);
      }
    } catch (error) {
      console.error('Error validando cÃ³digo:', error);
      throw new Error('CÃ³digo invÃ¡lido o expirado');
    }

    if (!storeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se pudo obtener el ID de la tienda' 
      });
    }

    // Guardar o actualizar la tienda en Firestore
    const storeRef = db.collection("CategoriesNube_stores").doc(storeId);
    const storeDoc = await storeRef.get();

    // El cÃ³digo actÃºa como access_token en TiendaNube
    const access_token = code;

    if (!storeDoc.exists) {
      // Nueva tienda - obtener info de la API
      try {
        const storeInfoResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}`, {
          headers: { 
            'Authentication': `bearer ${access_token}`,
            'User-Agent': 'NubeCategories'
          }
        });

        if (storeInfoResponse.ok) {
          const storeInfo = await storeInfoResponse.json();
          
          await storeRef.set({
            storeId,
            access_token,
            store_name: storeInfo.name || 'Sin nombre',
            email: storeInfo.email || '',
            domain: storeInfo.domain || '',
            createdAt: FieldValue.serverTimestamp(),
            installedAt: FieldValue.serverTimestamp()
          });

          console.log('âœ… Tienda nueva creada:', storeId);
        }
      } catch (error) {
        console.error('Error obtener info de tienda:', error);
        // Guardar solo con lo bÃ¡sico
        await storeRef.set({
          storeId,
          access_token,
          createdAt: FieldValue.serverTimestamp(),
          installedAt: FieldValue.serverTimestamp()
        });
      }
    } else {
      // Tienda existente - actualizar token
      await storeRef.update({
        access_token,
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log('âœ… Token actualizado para tienda:', storeId);
    }

    res.json({
      success: true,
      storeId,
      installed: !storeDoc.exists
    });

  } catch (error) {
    console.error('âŒ Error intercambiando cÃ³digo:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Registro de usuario NubeCategories
app.post("/api/auth/nubecategories/register", async (req, res) => {
  try {
    const { email, password, name, storeId } = req.body;

    if (!email || !password || !name || !storeId) {
      return res.json({ 
        success: false, 
        message: 'Todos los campos son requeridos' 
      });
    }

    // Verificar que la tienda existe en CategoriesNube_stores
    const storeDoc = await db.collection("CategoriesNube_stores").doc(storeId.toString()).get();
    if (!storeDoc.exists) {
      return res.json({ 
        success: false, 
        message: 'Tienda no encontrada' 
      });
    }

    // Verificar que no exista otro usuario con ese email
    const existingUser = await db.collection("CategoriesNube_users")
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return res.json({ 
        success: false, 
        message: 'El email ya estÃ¡ registrado' 
      });
    }

    // Crear usuario
    const userId = `nubecategories_user_${Date.now()}`;
    const userData = {
      userId,
      storeId: storeId.toString(),
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp()
    };

    await db.collection("CategoriesNube_users").doc(userId).set(userData);

    // Obtener datos del store
    const store = storeDoc.data();

    console.log(`âœ… Usuario NubeCategories registrado: ${email} para store ${storeId}`);
    
    res.json({ 
      success: true,
      user: {
        storeId: storeId.toString(),
        name,
        email: email.toLowerCase()
      },
      store: {
        accessToken: store.access_token,
        storeName: `Store #${storeId}`
      },
      message: 'Registro exitoso' 
    });
  } catch (error) {
    console.error('âŒ NubeCategories Register error:', error);
    res.json({ 
      success: false, 
      message: 'Error al registrar usuario' 
    });
  }
});

// POST: Login de usuario NubeCategories
app.post("/api/auth/nubecategories/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ 
        success: false, 
        message: 'Email y contraseÃ±a son requeridos' 
      });
    }

    const usersSnapshot = await db.collection("CategoriesNube_users")
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.json({ 
        success: false, 
        message: 'Email o contraseÃ±a incorrectos' 
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Verificar contraseÃ±a
    if (!verifyPassword(password, userData.passwordHash)) {
      return res.json({ 
        success: false, 
        message: 'Email o contraseÃ±a incorrectos' 
      });
    }

    // Obtener datos del store
    const storeDoc = await db.collection("CategoriesNube_stores")
      .doc(userData.storeId)
      .get();

    if (!storeDoc.exists) {
      return res.json({ 
        success: false, 
        message: 'Tienda no encontrada' 
      });
    }

    const store = storeDoc.data();

    // Actualizar last login
    await db.collection("CategoriesNube_users").doc(userDoc.id).update({
      lastLogin: FieldValue.serverTimestamp()
    });

    console.log(`âœ… Login NubeCategories: ${email}`);

    res.json({
      success: true,
      user: {
        storeId: userData.storeId,
        name: userData.name,
        email: userData.email
      },
      store: {
        accessToken: store.access_token,
        storeName: `Store #${userData.storeId}`
      },
      message: 'Login exitoso'
    });
  } catch (error) {
    console.error('âŒ NubeCategories Login error:', error);
    res.json({ 
      success: false, 
      message: 'Error al ingresar' 
    });
  }
});

// ============================================
// MÓDULO POPUPS - CRUD
// ============================================

// GET /api/popups?storeId=xxx - Listar popups de una tienda
app.get("/api/popups", async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return res.json({ success: false, message: "storeId requerido" });

    const snapshot = await db.collection("promonube_popups")
      .where("storeId", "==", storeId)
      .orderBy("createdAt", "desc")
      .get();

    const popups = snapshot.docs.map(doc => ({ popupId: doc.id, ...doc.data() }));
    res.json({ success: true, popups });
  } catch (error) {
    console.error("Error listando popups:", error);
    res.json({ success: false, message: error.message });
  }
});

// POST /api/popups - Crear popup
app.post("/api/popups", async (req, res) => {
  try {
    const { storeId, name, type, trigger, targeting, content, design, active } = req.body;
    if (!storeId || !name) return res.json({ success: false, message: "storeId y name requeridos" });

    const newPopup = {
      storeId,
      name,
      type: type || "modal",           // modal | banner | slide_in
      active: active !== undefined ? active : false,
      trigger: trigger || {
        event: "delay",                 // onLoad | delay | exitIntent | scroll
        delaySeconds: 5,
        scrollPercent: 50
      },
      targeting: targeting || {
        pages: "all",                   // all | home | product | cart | checkout
        devices: "all",                 // all | desktop | mobile
        showOnce: true,
        frequency: "once"              // once | every_visit
      },
      content: content || {
        popupType: "promo",             // promo | email_capture | announcement
        title: "¡Oferta exclusiva!",
        subtitle: "Solo por tiempo limitado",
        body: "",
        imageUrl: "",
        ctaText: "Ver oferta",
        ctaUrl: "",
        ctaStyle: "primary",
        showEmailField: false,
        emailPlaceholder: "Tu email...",
        emailButtonText: "Suscribirme",
        discountCode: "",
        discountValue: ""
      },
      design: design || {
        position: "center",             // center | top | bottom | bottom-right | bottom-left
        width: "480px",
        backgroundColor: "#ffffff",
        textColor: "#1a1a1a",
        accentColor: "#7C7CFF",
        buttonColor: "#7C7CFF",
        buttonTextColor: "#ffffff",
        overlayColor: "rgba(0,0,0,0.7)",
        borderRadius: "16px",
        animation: "fadeInUp",          // fadeInUp | fadeIn | slideInRight | slideInBottom | bounce
        fontFamily: "inherit",
        showCloseButton: true,
        closeAfterSeconds: 0            // 0 = no auto-close
      },
      analytics: {
        views: 0,
        clicks: 0,
        closes: 0,
        emailCaptures: 0,
        lastViewedAt: null
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("promonube_popups").add(newPopup);
    res.json({ success: true, popupId: docRef.id, message: "Popup creado" });
  } catch (error) {
    console.error("Error creando popup:", error);
    res.json({ success: false, message: error.message });
  }
});

// GET /api/popups/:popupId - Obtener popup por ID
app.get("/api/popups/:popupId", async (req, res) => {
  try {
    const { popupId } = req.params;
    const { storeId } = req.query;

    const doc = await db.collection("promonube_popups").doc(popupId).get();
    if (!doc.exists) return res.json({ success: false, message: "Popup no encontrado" });

    const data = doc.data();
    if (storeId && data.storeId !== storeId) {
      return res.json({ success: false, message: "Acceso denegado" });
    }

    res.json({ success: true, popup: { popupId: doc.id, ...data } });
  } catch (error) {
    console.error("Error obteniendo popup:", error);
    res.json({ success: false, message: error.message });
  }
});

// PUT /api/popups/:popupId - Actualizar popup
app.put("/api/popups/:popupId", async (req, res) => {
  try {
    const { popupId } = req.params;
    const { storeId, ...updates } = req.body;

    const doc = await db.collection("promonube_popups").doc(popupId).get();
    if (!doc.exists) return res.json({ success: false, message: "Popup no encontrado" });

    const data = doc.data();
    if (storeId && data.storeId !== storeId) {
      return res.json({ success: false, message: "Acceso denegado" });
    }

    await doc.ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true, message: "Popup actualizado" });
  } catch (error) {
    console.error("Error actualizando popup:", error);
    res.json({ success: false, message: error.message });
  }
});

// DELETE /api/popups/:popupId - Eliminar popup
app.delete("/api/popups/:popupId", async (req, res) => {
  try {
    const { popupId } = req.params;
    const { storeId } = req.query;

    const doc = await db.collection("promonube_popups").doc(popupId).get();
    if (!doc.exists) return res.json({ success: false, message: "Popup no encontrado" });

    const data = doc.data();
    if (storeId && data.storeId !== storeId) {
      return res.json({ success: false, message: "Acceso denegado" });
    }

    await doc.ref.delete();
    res.json({ success: true, message: "Popup eliminado" });
  } catch (error) {
    console.error("Error eliminando popup:", error);
    res.json({ success: false, message: error.message });
  }
});

// PATCH /api/popups/:popupId/toggle - Activar/desactivar popup
app.patch("/api/popups/:popupId/toggle", async (req, res) => {
  try {
    const { popupId } = req.params;
    const { storeId } = req.body;

    const doc = await db.collection("promonube_popups").doc(popupId).get();
    if (!doc.exists) return res.json({ success: false, message: "Popup no encontrado" });

    const data = doc.data();
    if (storeId && data.storeId !== storeId) {
      return res.json({ success: false, message: "Acceso denegado" });
    }

    const newActive = !data.active;
    await doc.ref.update({ active: newActive, updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true, active: newActive });
  } catch (error) {
    console.error("Error toggling popup:", error);
    res.json({ success: false, message: error.message });
  }
});

// POST /api/popups/:popupId/track - Registrar evento (view/click/close/email)
app.post("/api/popups/:popupId/track", async (req, res) => {
  try {
    const { popupId } = req.params;
    const { event, storeId, email } = req.body; // event: view | click | close | email_capture

    const doc = await db.collection("promonube_popups").doc(popupId).get();
    if (!doc.exists) return res.json({ success: false });

    const updates = { updatedAt: FieldValue.serverTimestamp() };

    if (event === "view") {
      updates["analytics.views"] = FieldValue.increment(1);
      updates["analytics.lastViewedAt"] = FieldValue.serverTimestamp();
    } else if (event === "click") {
      updates["analytics.clicks"] = FieldValue.increment(1);
    } else if (event === "close") {
      updates["analytics.closes"] = FieldValue.increment(1);
    } else if (event === "email_capture") {
      updates["analytics.emailCaptures"] = FieldValue.increment(1);
      // Opcionalmente guardar el email en subcolección
      if (email) {
        await doc.ref.collection("captured_emails").add({
          email,
          storeId,
          capturedAt: FieldValue.serverTimestamp()
        });
      }
    }

    await doc.ref.update(updates);
    res.json({ success: true });
  } catch (error) {
    // Silenciar errores de tracking para no afectar la experiencia del usuario
    res.json({ success: false });
  }
});

// GET /api/popups/:popupId/analytics - Obtener analytics de un popup
app.get("/api/popups/:popupId/analytics", async (req, res) => {
  try {
    const { popupId } = req.params;
    const { storeId } = req.query;

    const doc = await db.collection("promonube_popups").doc(popupId).get();
    if (!doc.exists) return res.json({ success: false, message: "Popup no encontrado" });

    const data = doc.data();
    if (storeId && data.storeId !== storeId) {
      return res.json({ success: false, message: "Acceso denegado" });
    }

    const analytics = data.analytics || {};
    const views = analytics.views || 0;
    const clicks = analytics.clicks || 0;
    const closes = analytics.closes || 0;
    const emailCaptures = analytics.emailCaptures || 0;

    res.json({
      success: true,
      analytics: {
        views,
        clicks,
        closes,
        emailCaptures,
        ctr: views > 0 ? ((clicks / views) * 100).toFixed(1) : "0.0",
        closeRate: views > 0 ? ((closes / views) * 100).toFixed(1) : "0.0",
        conversionRate: views > 0 ? ((emailCaptures / views) * 100).toFixed(1) : "0.0",
        lastViewedAt: analytics.lastViewedAt || null
      }
    });
  } catch (error) {
    console.error("Error obteniendo analytics de popup:", error);
    res.json({ success: false, message: error.message });
  }
});

// GET /api/popup-widget.js?store=xxx - Script embebido para tiendas
app.get("/api/popup-widget.js", async (req, res) => {
  const { store } = req.query;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300"); // 5 min cache

  try {
    if (!store) return res.send("// Error: store requerido");

    // Buscar popups activos para esta tienda
    const snapshot = await db.collection("promonube_popups")
      .where("storeId", "==", store)
      .where("active", "==", true)
      .get();

    if (snapshot.empty) return res.send("// No hay popups activos para esta tienda");

    const popups = snapshot.docs.map(doc => ({ popupId: doc.id, ...doc.data() }));

    const script = `
/**
 * PromoNube - Popup Widget
 * Tienda: ${store}
 * Popups activos: ${popups.length}
 */
(function() {
  'use strict';

  if (window.__promonubePopupLoaded) return;
  window.__promonubePopupLoaded = true;

  const POPUPS = ${JSON.stringify(popups)};
  const API_URL = "https://apipromonube-jlfopowzaq-uc.a.run.app";
  const STORE_ID = "${store}";

  // ----- UTILIDADES -----

  function getStorageKey(popupId) { return 'pn_popup_' + popupId; }

  function shouldShow(popup) {
    const targeting = popup.targeting || {};
    const key = getStorageKey(popup.popupId);

    // Frequency cap
    if (targeting.showOnce || targeting.frequency === 'once') {
      if (localStorage.getItem(key)) return false;
    }

    // Device targeting
    const isMobile = window.innerWidth < 768;
    if (targeting.devices === 'desktop' && isMobile) return false;
    if (targeting.devices === 'mobile' && !isMobile) return false;

    // Page targeting (básico por path)
    const path = window.location.pathname;
    if (targeting.pages === 'home' && path !== '/') return false;
    if (targeting.pages === 'product' && !path.includes('/product') && !path.includes('/produtos') && !path.includes('/productos')) return false;
    if (targeting.pages === 'cart' && !path.includes('/cart') && !path.includes('/carrito')) return false;

    return true;
  }

  function markShown(popupId) {
    try { localStorage.setItem(getStorageKey(popupId), '1'); } catch(e) {}
  }

  function track(popupId, event, email) {
    try {
      fetch(API_URL + '/api/popups/' + popupId + '/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, storeId: STORE_ID, email: email || undefined })
      }).catch(function(){});
    } catch(e) {}
  }

  // ----- ESTILOS -----

  function injectStyles() {
    if (document.getElementById('pn-popup-styles')) return;
    const style = document.createElement('style');
    style.id = 'pn-popup-styles';
    style.textContent = \`
      .pn-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: var(--pn-overlay, rgba(0,0,0,0.7));
        z-index: 2147483640;
        display: flex; align-items: center; justify-content: center;
        animation: pnFadeIn 0.25s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .pn-overlay.pn-pos-top { align-items: flex-start; }
      .pn-overlay.pn-pos-bottom, .pn-overlay.pn-pos-bottom-right, .pn-overlay.pn-pos-bottom-left { align-items: flex-end; justify-content: flex-end; padding: 24px; background: transparent; pointer-events: none; }
      .pn-overlay.pn-pos-bottom-left { justify-content: flex-start; }
      .pn-overlay.pn-type-banner { align-items: flex-start; justify-content: stretch; background: transparent; pointer-events: none; padding: 0; }
      .pn-overlay.pn-type-banner-bottom { align-items: flex-end; }

      .pn-popup {
        background: var(--pn-bg, #ffffff);
        color: var(--pn-color, #1a1a1a);
        border-radius: var(--pn-radius, 16px);
        max-width: var(--pn-width, 480px);
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        pointer-events: all;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        animation: pnSlideUp 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .pn-popup.pn-anim-fadeIn { animation: pnFadeIn 0.3s ease-out; }
      .pn-popup.pn-anim-slideInRight { animation: pnSlideRight 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      .pn-popup.pn-anim-slideInBottom { animation: pnSlideBottom 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      .pn-popup.pn-anim-bounce { animation: pnBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
      .pn-popup.pn-type-banner { border-radius: 0; max-width: 100%; width: 100%; }
      .pn-popup.pn-type-slide_in { max-width: 360px; }

      .pn-close-btn {
        position: absolute; top: 12px; right: 12px;
        background: rgba(0,0,0,0.08); border: none; border-radius: 50%;
        width: 32px; height: 32px; font-size: 18px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; color: inherit; z-index: 1;
      }
      .pn-close-btn:hover { background: rgba(0,0,0,0.15); transform: scale(1.1); }

      .pn-image { width: 100%; max-height: 220px; object-fit: cover; border-radius: var(--pn-radius, 16px) var(--pn-radius, 16px) 0 0; display: block; }
      .pn-body { padding: 28px 28px 24px; }
      .pn-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; background: var(--pn-accent, #7C7CFF); color: #fff; }
      .pn-title { font-size: 24px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; color: var(--pn-color, #1a1a1a); }
      .pn-subtitle { font-size: 15px; margin: 0 0 8px; opacity: 0.75; font-weight: 500; }
      .pn-text { font-size: 14px; line-height: 1.6; opacity: 0.8; margin: 0 0 20px; }
      .pn-code-box { background: rgba(0,0,0,0.05); border: 2px dashed rgba(0,0,0,0.15); border-radius: 10px; padding: 14px 18px; margin: 16px 0; text-align: center; }
      .pn-code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; display: block; margin-bottom: 4px; }
      .pn-code-value { font-size: 22px; font-weight: 800; font-family: monospace; color: var(--pn-accent, #7C7CFF); letter-spacing: 3px; }
      .pn-email-form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
      .pn-email-input { padding: 14px 16px; border: 2px solid rgba(0,0,0,0.12); border-radius: 10px; font-size: 15px; outline: none; background: rgba(0,0,0,0.03); color: inherit; transition: border-color 0.2s; }
      .pn-email-input:focus { border-color: var(--pn-accent, #7C7CFF); }
      .pn-cta-btn { width: 100%; padding: 15px 24px; border: none; border-radius: 12px; background: var(--pn-btn-bg, #7C7CFF); color: var(--pn-btn-color, #ffffff); font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; margin-top: 4px; }
      .pn-cta-btn:hover { opacity: 0.92; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
      .pn-cta-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .pn-success-msg { text-align: center; padding: 8px 0; font-weight: 600; color: #16a34a; font-size: 15px; }

      @keyframes pnFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes pnSlideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes pnSlideRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes pnSlideBottom { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pnBounce { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }

      @media (max-width: 600px) {
        .pn-popup { max-width: 100% !important; border-radius: 16px 16px 0 0 !important; }
        .pn-overlay.pn-pos-bottom-right, .pn-overlay.pn-pos-bottom-left { padding: 0; justify-content: stretch; align-items: flex-end; }
        .pn-body { padding: 22px 18px 20px; }
        .pn-title { font-size: 20px; }
      }
    \`;
    document.head.appendChild(style);
  }

  // ----- RENDER POPUP -----

  function renderPopup(popup) {
    const { content = {}, design = {}, popupId } = popup;
    const type = popup.type || 'modal';

    const overlay = document.createElement('div');
    overlay.className = 'pn-overlay pn-type-' + type;
    if (type === 'banner' && (design.position === 'bottom' || design.position === 'banner-bottom')) {
      overlay.classList.add('pn-type-banner-bottom');
    }
    const posClass = 'pn-pos-' + (design.position || 'center');
    if (type !== 'banner') overlay.classList.add(posClass);

    const pnEl = document.createElement('div');
    pnEl.className = 'pn-popup pn-type-' + type + ' pn-anim-' + (design.animation || 'fadeInUp');

    // CSS variables
    pnEl.style.setProperty('--pn-bg', design.backgroundColor || '#ffffff');
    pnEl.style.setProperty('--pn-color', design.textColor || '#1a1a1a');
    pnEl.style.setProperty('--pn-accent', design.accentColor || '#7C7CFF');
    pnEl.style.setProperty('--pn-btn-bg', design.buttonColor || '#7C7CFF');
    pnEl.style.setProperty('--pn-btn-color', design.buttonTextColor || '#ffffff');
    pnEl.style.setProperty('--pn-radius', design.borderRadius || '16px');
    pnEl.style.setProperty('--pn-width', design.width || '480px');
    if (design.fontFamily && design.fontFamily !== 'inherit') {
      pnEl.style.fontFamily = design.fontFamily;
    }
    overlay.style.setProperty('--pn-overlay', design.overlayColor || 'rgba(0,0,0,0.7)');

    // Botón cerrar
    if (design.showCloseButton !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'pn-close-btn';
      closeBtn.innerHTML = '\u00D7';
      closeBtn.setAttribute('aria-label', 'Cerrar');
      closeBtn.onclick = function() {
        track(popupId, 'close');
        overlay.remove();
      };
      pnEl.appendChild(closeBtn);
    }

    // Imagen
    if (content.imageUrl) {
      const img = document.createElement('img');
      img.src = content.imageUrl;
      img.className = 'pn-image';
      img.alt = content.title || '';
      pnEl.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'pn-body';

    // Código de descuento destacado (si lo hay)
    if (content.discountValue) {
      const badge = document.createElement('div');
      badge.className = 'pn-badge';
      badge.textContent = content.discountValue;
      body.appendChild(badge);
    }

    // Título
    if (content.title) {
      const title = document.createElement('h2');
      title.className = 'pn-title';
      title.textContent = content.title;
      body.appendChild(title);
    }

    // Subtítulo
    if (content.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'pn-subtitle';
      sub.textContent = content.subtitle;
      body.appendChild(sub);
    }

    // Cuerpo
    if (content.body) {
      const bodyText = document.createElement('p');
      bodyText.className = 'pn-text';
      bodyText.textContent = content.body;
      body.appendChild(bodyText);
    }

    // Código de cupón
    if (content.discountCode) {
      const codeBox = document.createElement('div');
      codeBox.className = 'pn-code-box';
      codeBox.innerHTML = '<span class="pn-code-label">Usá el código</span><span class="pn-code-value">' + content.discountCode + '</span>';
      body.appendChild(codeBox);
    }

    // Captura de email
    if (content.showEmailField || content.popupType === 'email_capture') {
      const form = document.createElement('div');
      form.className = 'pn-email-form';

      const input = document.createElement('input');
      input.type = 'email';
      input.className = 'pn-email-input';
      input.placeholder = content.emailPlaceholder || 'Tu email...';
      form.appendChild(input);

      const submitBtn = document.createElement('button');
      submitBtn.className = 'pn-cta-btn';
      submitBtn.textContent = content.emailButtonText || 'Suscribirme';
      submitBtn.onclick = function() {
        const emailVal = input.value.trim();
        if (!emailVal || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailVal)) {
          input.style.borderColor = '#ef4444';
          setTimeout(function() { input.style.borderColor = ''; }, 1500);
          return;
        }
        submitBtn.disabled = true;
        track(popupId, 'email_capture', emailVal);
        track(popupId, 'click');

        // Mostrar mensaje de éxito
        form.innerHTML = '<p class="pn-success-msg">\\u2713 \\u00A1Gracias! Te enviamos tu descuento.</p>';
        markShown(popupId);
        setTimeout(function() { overlay.remove(); }, 2500);
      };
      form.appendChild(submitBtn);
      body.appendChild(form);
    } else if (content.ctaText) {
      // CTA simple
      const cta = document.createElement('button');
      cta.className = 'pn-cta-btn';
      cta.textContent = content.ctaText;
      cta.onclick = function() {
        track(popupId, 'click');
        markShown(popupId);
        if (content.ctaUrl) {
          window.location.href = content.ctaUrl;
        } else {
          overlay.remove();
        }
      };
      body.appendChild(cta);
    }

    pnEl.appendChild(body);
    overlay.appendChild(pnEl);

    // Cerrar click en overlay (solo si es modal)
    if (type === 'modal') {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          track(popupId, 'close');
          overlay.remove();
        }
      });
    }

    document.body.appendChild(overlay);
    track(popupId, 'view');
    markShown(popupId);

    // Auto-cerrar
    if (design.closeAfterSeconds && design.closeAfterSeconds > 0) {
      setTimeout(function() {
        if (document.body.contains(overlay)) {
          overlay.remove();
        }
      }, design.closeAfterSeconds * 1000);
    }
  }

  // ----- INICIAR POPUP -----

  function initPopup(popup) {
    if (!shouldShow(popup)) return;

    const trigger = popup.trigger || {};
    const event = trigger.event || 'delay';

    if (event === 'onLoad') {
      renderPopup(popup);
    } else if (event === 'delay') {
      const ms = ((trigger.delaySeconds || 5) * 1000);
      setTimeout(function() { renderPopup(popup); }, ms);
    } else if (event === 'exitIntent') {
      let fired = false;
      document.addEventListener('mouseleave', function handler(e) {
        if (fired || e.clientY > 20) return;
        fired = true;
        document.removeEventListener('mouseleave', handler);
        renderPopup(popup);
      });
    } else if (event === 'scroll') {
      const threshold = trigger.scrollPercent || 50;
      let fired = false;
      window.addEventListener('scroll', function handler() {
        if (fired) return;
        const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (scrolled >= threshold) {
          fired = true;
          window.removeEventListener('scroll', handler);
          renderPopup(popup);
        }
      });
    }
  }

  // ----- ARRANCAR -----

  injectStyles();

  function run() {
    POPUPS.forEach(function(popup) {
      try { initPopup(popup); } catch(e) { console.warn('[PromoNube Popup] Error:', e); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
`;

    res.send(script);
  } catch (error) {
    console.error("Error generando popup widget:", error);
    res.send("// Error interno generando popup widget");
  }
});

// ============================================
// EXPORTAR CLOUD FUNCTION
// ============================================
exports.apipromonube = functions.https.onRequest({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 3,
  concurrency: 80
}, app);

// ============================================
// ENDPOINT DE PRUEBA: Verificar campos de producto TiendaNube
// ============================================
app.get("/api/test/product-fields/:storeId/:productId", async (req, res) => {
  try {
    const { storeId, productId } = req.params;
    
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }
    
    const accessToken = storeDoc.data().accessToken;
    
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/products/${productId}`, {
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'PromoNube (info@techdi.com.ar)'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        message: `TiendaNube API error: ${response.status}` 
      });
    }
    
    const product = await response.json();
    
    res.json({
      success: true,
      product: product,
      fields: Object.keys(product),
      hasCreatedAt: !!product.created_at,
      createdAt: product.created_at || null
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// =====================================================
// ðŸ§¹ CLEANUP - Limpieza automÃ¡tica de cupones expirados
// =====================================================

// FunciÃ³n programada que se ejecuta cada hora
exports.cleanupExpiredCoupons = functions.scheduler.onSchedule('every 24 hours', async (event) => {
  console.log('ðŸ§¹ Iniciando limpieza de cupones EXPIRADOS DE RULETA...');
  
  try {
    const now = new Date();
    let deletedCount = 0;
    let errorCount = 0;
    
    // Buscar SOLO cupones de ruleta expirados no usados
    const expiredCouponsQuery = await db.collection('promonube_coupons')
      .where('source', '==', 'spin_wheel')  // ðŸŽ¯ SOLO cupones de ruleta
      .where('used', '==', false)
      .where('expiresAt', '<', now.toISOString())
      .get();
    
    console.log(`ðŸ“Š Encontrados ${expiredCouponsQuery.size} cupones de RULETA expirados para eliminar`);
    
    for (const doc of expiredCouponsQuery.docs) {
      const coupon = doc.data();
      
      try {
        // 1. Eliminar de TiendaNube
        if (coupon.tiendanubeCouponId && coupon.storeId) {
          const store = await getStoreById(coupon.storeId);
          if (store && store.access_token) {
            try {
              await fetch(`https://api.tiendanube.com/v1/${coupon.storeId}/coupons/${coupon.tiendanubeCouponId}`, {
                method: 'DELETE',
                headers: {
                  'Authentication': `bearer ${store.access_token}`,
                  'User-Agent': 'PromoNube (tinyjoys.com.ar)'
                }
              });
              console.log(`âœ… CupÃ³n ruleta ${coupon.code} eliminado de TiendaNube`);
            } catch (tnError) {
              console.error(`âš ï¸ Error eliminando de TiendaNube (cupÃ³n: ${coupon.code}):`, tnError.message);
              // Continuar aunque falle en TiendaNube
            }
          }
        }
        
        // 2. Eliminar de Firestore
        await doc.ref.delete();
        deletedCount++;
        console.log(`ðŸ—‘ï¸ CupÃ³n ruleta ${coupon.code} eliminado de Firestore`);
        
      } catch (error) {
        errorCount++;
        console.error(`âŒ Error eliminando cupÃ³n ${coupon.code}:`, error);
      }
    }
    
    console.log(`âœ… Limpieza completada: ${deletedCount} cupones de RULETA eliminados, ${errorCount} errores`);
    
    return { success: true, deleted: deletedCount, errors: errorCount };
    
  } catch (error) {
    console.error('âŒ Error en limpieza de cupones:', error);
    return { success: false, error: error.message };
  }
});
