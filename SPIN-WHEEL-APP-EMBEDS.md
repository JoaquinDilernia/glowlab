# 🎡 Sistema de App Embeds para Ruleta de la Suerte

## 📚 ¿Qué son los App Embeds?

Los **App Embeds** son la forma oficial de TiendaNube para que las aplicaciones inyecten JavaScript en las tiendas. Funcionan mediante la **API de Scripts** de TiendaNube.

### Ventajas vs. Copiar/Pegar Scripts

✅ **Sistema Oficial:**
- Usa la API nativa de TiendaNube (`/scripts`)
- No requiere editar manualmente el tema
- Se activa/desactiva desde el panel de la app

✅ **Gestión Automática:**
- El script se instala automáticamente al activar la ruleta
- Se elimina al desactivar
- Se actualiza dinámicamente cuando cambias la configuración

✅ **Escalable:**
- Funciona para todas las tiendas
- No depende del tema específico
- Compatible con actualizaciones de TiendaNube

---

## 🏗️ Arquitectura Implementada

### 1. **Registro del Script (Backend)**

Endpoint en `functions/index.js`:

```javascript
// Helper para registrar script en TiendaNube
async function registerSpinWheelScript(store, wheelId) {
  // POST a https://api.tiendanube.com/v1/{storeId}/scripts
  // Crea un script tag que apunta a nuestro widget
}

// Se llama automáticamente cuando:
// - El usuario activa la ruleta (enabled: true)
// - Se crea una nueva ruleta activa
```

**Datos que se envían a TiendaNube:**
```json
{
  "src": "https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel-widget.js?wheelId=WHEEL_ID",
  "event": "onload",
  "where": "store"
}
```

### 2. **Endpoint del Widget (Público)**

`GET /api/spin-wheel-widget.js?wheelId={wheelId}`

**Este endpoint:**
- ✅ Es público (sin autenticación)
- ✅ Retorna JavaScript dinámico
- ✅ Lee la configuración de Firestore
- ✅ Genera el código del popup con los colores, textos y premios
- ✅ Incluye toda la lógica del widget (no hay archivos estáticos)

### 3. **Widget JavaScript**

El script generado incluye:

**🎨 Estilos CSS inline:**
- Diseño del popup
- Animaciones
- Responsive design

**⚙️ Lógica del widget:**
- Detecta si el usuario ya participó (localStorage)
- Maneja delays y exit-intent
- Captura email
- Anima la ruleta
- Llama a la API para procesar el giro
- Muestra el cupón ganador
- Permite copiar al portapapeles

---

## 🔄 Flujo Completo

```
1. Usuario activa ruleta desde panel
   ↓
2. registerSpinWheelScript() llama a TiendaNube API
   ↓
3. TiendaNube guarda el script tag
   ↓
4. Cuando un cliente visita la tienda:
   ↓
5. TiendaNube inyecta automáticamente:
   <script src="https://apipromonube.../api/spin-wheel-widget.js?wheelId=..."></script>
   ↓
6. Nuestro endpoint genera el JavaScript dinámico
   ↓
7. El widget se ejecuta en la tienda
   ↓
8. Usuario gira → API procesa → Crea cupón → Muestra resultado
```

---

## 💻 Código de Ejemplo

### Activar/Desactivar desde el Frontend

```javascript
// En SpinWheelConfig.jsx
const handleToggleActive = async () => {
  const data = await apiRequest(`/api/spin-wheel/${wheelId}`, {
    method: 'PUT',
    body: JSON.stringify({ 
      storeId, 
      active: true,    // Nueva propiedad
      enabled: true    // Por compatibilidad
    })
  });
  
  // El backend automáticamente:
  // - Si active cambia de false → true: Registra script en TiendaNube
  // - Si active cambia de true → false: Elimina script de TiendaNube
};
```

### Estructura del Widget (Simplificado)

```javascript
// Lo que genera /api/spin-wheel-widget.js

(function() {
  const WHEEL_CONFIG = {
    wheelId: "wheel_123",
    title: "¡Girá y Ganá!",
    prizes: [/* ... */],
    colors: {/* ... */}
  };
  
  // 1. Verificar si ya participó
  if (localStorage.getItem('promonube_wheel_' + WHEEL_CONFIG.wheelId)) {
    return; // No mostrar de nuevo
  }
  
  // 2. Crear estilos CSS
  const styles = `/* CSS del popup */`;
  document.head.appendChild(styleElement);
  
  // 3. Crear y mostrar popup
  function showWheel() {
    const overlay = document.createElement('div');
    overlay.innerHTML = `/* HTML del popup */`;
    document.body.appendChild(overlay);
  }
  
  // 4. Manejar el giro
  async function handleSpin(email) {
    // Animar rueda
    wheel.style.transform = 'rotate(' + degrees + 'deg)';
    
    // Llamar a API
    const result = await fetch('/api/spin-wheel/' + WHEEL_ID + '/spin', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    
    // Mostrar resultado
    showPrize(result.couponCode);
  }
  
  // 5. Iniciar según configuración
  if (WHEEL_CONFIG.exitIntent) {
    document.addEventListener('mouseleave', showWheel);
  } else {
    setTimeout(showWheel, WHEEL_CONFIG.delaySeconds * 1000);
  }
})();
```

---

## 📊 Ventajas del Sistema

### Para el Desarrollador:
- ✅ **Un solo archivo** (index.js) maneja todo
- ✅ **No hay archivos estáticos** que versionar
- ✅ **Cambios instantáneos**: Modificás la config en Firestore y el widget se actualiza
- ✅ **Fácil debugging**: Todo el código está en el backend

### Para el Comerciante:
- ✅ **No toca código**: Todo desde el panel
- ✅ **Activar/desactivar** en 1 click
- ✅ **Vista previa** antes de publicar
- ✅ **Sin riesgo**: No modifica el tema de la tienda

### Para el Usuario Final:
- ✅ **Carga rápida**: El script es liviano
- ✅ **No invasivo**: Solo se muestra según reglas configuradas
- ✅ **Responsive**: Funciona en mobile y desktop
- ✅ **Accesible**: Popup con buenos controles

---

## 🔐 Seguridad

- ✅ El endpoint del widget es **público** pero **read-only**
- ✅ Solo lee configuración (no expone tokens ni datos sensibles)
- ✅ El endpoint de spin requiere **email válido**
- ✅ Los cupones se crean en **servidor** (no se puede manipular desde el cliente)

---

## 🚀 Próximos Pasos

### Implementado ✅
- [x] API de registro de scripts
- [x] Endpoint dinámico del widget
- [x] Widget JavaScript completo
- [x] Integración con TiendaNube API

### Por Hacer 📝
- [ ] Analytics de visualizaciones
- [ ] A/B testing de diseños
- [ ] Más triggers (scroll %, tiempo en página)
- [ ] Templates prediseñados
- [ ] Editor visual de premios

---

## 📖 Referencias

- [TiendaNube Scripts API](https://api-docs.tiendanube.com/docs/developers/api/scripts)
- [TiendaNube App Development](https://github.com/TiendaNube)

---

## 🎯 Resumen

Este sistema permite que **cualquier tienda** instale la ruleta **sin tocar código**, usando el sistema **oficial** de TiendaNube. El script se instala **automáticamente** vía API, se **actualiza dinámicamente** desde la configuración, y se puede **activar/desactivar** con un botón.

**No más copiar/pegar scripts manualmente.** 🎉
