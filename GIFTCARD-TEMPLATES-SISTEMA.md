# 🎨 Sistema de Diseños para Gift Cards

## ✅ Implementado

### **1. Gestor de Templates** 📁
Nueva página `/gift-card-templates` con:

**Features:**
- ✅ Upload de imágenes (JPG/PNG, máx 5MB)
- ✅ Preview visual de cada diseño
- ✅ Establecer template por defecto
- ✅ Eliminar templates (excepto el default)
- ✅ Info sobre medidas recomendadas (1200x628px)
- ✅ Grid responsive

**Configuración por template:**
- Nombre personalizado
- Posición del monto (arriba/centro/abajo)
- Color del texto
- Tamaño de fuente

---

### **2. Selector en CreateGiftCard** 🎯

**Features:**
- ✅ Carga automática de templates disponibles
- ✅ Preview visual en miniatura
- ✅ Selección fácil con click
- ✅ Marca el template por defecto
- ✅ Link directo para crear diseños si no hay ninguno

---

### **3. Backend Completo** 🔧

**Endpoints:**
```javascript
GET  /api/giftcard-templates?storeId=X
POST /api/giftcard-templates/create
PUT  /api/giftcard-templates/:id/set-default
DELETE /api/giftcard-templates/:id
```

**Storage:**
- Imágenes guardadas como base64 en Firestore
- Sin necesidad de Firebase Storage (por ahora)
- URLs directas en data URL format

**Estructura de datos:**
```javascript
{
  templateId: "template_1234567890",
  storeId: "12345",
  name: "Navidad 2024",
  imageUrl: "data:image/png;base64,iVBORw...",
  textPosition: "center", // top, center, bottom
  textColor: "#FFFFFF",
  fontSize: 48,
  isDefault: true,
  createdAt: Timestamp
}
```

---

## 🎯 Cómo Usar

### **Paso 1: Crear Diseños**

1. Ir a **Gift Cards** → **Diseños**
2. Click en **"Nuevo Template"**
3. Configurar:
   - Nombre (ej: "Navidad 2024")
   - Subir imagen (1200x628px recomendado)
   - Posición del monto (centro/arriba/abajo)
   - Color del texto (#FFFFFF por defecto)
   - Tamaño de fuente (48px por defecto)
4. Click en **"Crear Template"**

**El primer template creado se marca automáticamente como predeterminado** ⭐

---

### **Paso 2: Usar en Gift Cards**

1. Ir a **"Nueva Gift Card"**
2. En la sección **"Diseño de la Gift Card"**:
   - Ver todos tus diseños disponibles
   - Click en el que quieras usar
   - El seleccionado se marca con borde morado
3. El diseño se aplicará automáticamente

---

### **Paso 3: Gestionar Diseños**

**Establecer como predeterminado:**
- Click en el ícono ⭐ de cualquier template
- Se usará por defecto en nuevas gift cards

**Eliminar diseño:**
- Click en el ícono 🗑️
- No se puede eliminar el template predeterminado
- Primero establece otro como predeterminado

**Preview:**
- Click en cualquier template
- Ver cómo se vería el monto sobre tu diseño
- Ejemplo visual con $50.000

---

## 🎨 Recomendaciones de Diseño

### **Medidas Ideales**
```
Ancho: 1200 píxeles
Alto: 628 píxeles
Ratio: 1.91:1 (landscape)
Formato: JPG o PNG
Peso: Máximo 5MB
```

### **Tips de Diseño**

✅ **Deja espacio para el texto**
- Centro: Área libre de 400x200px
- Arriba: Margen de 150px desde el top
- Abajo: Margen de 150px desde el bottom

✅ **Colores del texto**
- Fondo oscuro: Texto blanco (#FFFFFF)
- Fondo claro: Texto negro (#000000)
- Con sombras: Mejor contraste

✅ **Elementos visuales**
- Logo de tu marca
- Patterns decorativos
- Gradientes suaves
- Ilustraciones temáticas

❌ **Evitar**
- Texto importante en el centro (se tapará con el monto)
- Fondos muy cargados (dificulta lectura)
- Imágenes pixeladas o de baja calidad

---

## 💡 Ejemplos de Uso

### **Ejemplo 1: Gift Card Navideña**
```
Nombre: "Navidad 2024"
Imagen: Fondo rojo con copos de nieve
Posición: Centro
Color texto: #FFFFFF (blanco)
Tamaño: 56px (más grande para destacar)
```

### **Ejemplo 2: Gift Card Minimalista**
```
Nombre: "Elegante"
Imagen: Fondo negro con detalles dorados
Posición: Centro
Color texto: #FFD700 (dorado)
Tamaño: 48px
```

### **Ejemplo 3: Gift Card Cumpleaños**
```
Nombre: "Cumpleaños"
Imagen: Fondo con globos y confeti
Posición: Arriba
Color texto: #FFFFFF
Tamaño: 52px
```

### **Ejemplo 4: Gift Card Corporativa**
```
Nombre: "Corporativo"
Imagen: Logo grande + colores de marca
Posición: Abajo
Color texto: Color principal de la marca
Tamaño: 44px
```

---

## 🚀 Roadmap: Funcionalidades Futuras

### **Fase 2: Canvas Automático** 🎨
Generar imagen dinámica con el monto superpuesto:

```javascript
// Crear canvas con template + monto
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Cargar imagen base
const img = new Image();
img.src = template.imageUrl;

// Superponer monto
ctx.font = `${template.fontSize}px Arial Black`;
ctx.fillStyle = template.textColor;
ctx.textAlign = 'center';
ctx.fillText(`$${amount}`, centerX, centerY);

// Exportar como imagen
const finalImage = canvas.toDataURL('image/png');
```

**Beneficios:**
- Gift card lista para compartir
- Preview exacto del resultado final
- Descargable directamente
- Para email marketing

---

### **Fase 3: Templates del Marketplace** 🏪

**Galería de diseños prediseñados:**
- Templates gratuitos
- Categorizados por ocasión
- Listos para usar
- Personalizables

**Categorías:**
- 🎄 Navidad
- 🎂 Cumpleaños
- 💑 San Valentín
- 🎓 Graduación
- 🌸 Primavera
- ✨ Genéricos

---

### **Fase 4: Editor Visual** ✏️

**Features avanzadas:**
- Arrastrar y posicionar texto
- Agregar logo de la marca
- Filtros y efectos
- Múltiples capas de texto
- Emoji y stickers

---

## 📊 Estructura de Archivos

### **Frontend**
```
src/pages/
  ├── GiftCardTemplates.jsx     # Gestor de templates
  ├── GiftCardTemplates.css     # Estilos
  ├── CreateGiftCard.jsx         # Selector integrado
  └── CreateGiftCard.css         # Estilos del selector
```

### **Backend**
```javascript
functions/index.js
  ├── GET  /api/giftcard-templates
  ├── POST /api/giftcard-templates/create
  ├── PUT  /api/giftcard-templates/:id/set-default
  └── DELETE /api/giftcard-templates/:id
```

### **Database**
```
Firestore
  └── giftcard_templates/
        ├── template_1234567890/
        │     ├── templateId
        │     ├── storeId
        │     ├── name
        │     ├── imageUrl (base64)
        │     ├── textPosition
        │     ├── textColor
        │     ├── fontSize
        │     ├── isDefault
        │     └── createdAt
        └── ...
```

---

## 🎯 Valor Agregado

### **Para el Negocio**
✅ Branding consistente
✅ Diferenciación visual
✅ Reutilización de diseños
✅ Templates por temporada
✅ Profesionalismo

### **Para el Cliente Final**
✅ Gift cards más atractivas
✅ Experiencia premium
✅ Fácil de compartir
✅ Memorable

### **Vs Competencia**
❌ TiendaNube: Gift cards genéricas, sin personalización
❌ Otros plugins: Diseño único, no editable
✅ **PromoNube**: Sistema completo de gestión de diseños

---

## 🔧 Mantenimiento

### **Límites Actuales**
- Imágenes en base64 (máx 5MB)
- Sin límite de templates por tienda
- Storage en Firestore (no Firebase Storage)

### **Optimizaciones Futuras**
- [ ] Migrar a Firebase Storage (URLs públicas)
- [ ] Compresión automática de imágenes
- [ ] CDN para carga rápida
- [ ] Cache de templates
- [ ] Lazy loading en el grid

---

## 📸 Screenshots

### **Lista de Templates**
```
┌─────────────────────────────────────────────────┐
│  🎨 Diseños de Gift Cards                      │
│                                        [+ Nuevo]│
├─────────────────────────────────────────────────┤
│                                                 │
│  ℹ️ Recomendaciones:                            │
│  • Tamaño: 1200x628px                          │
│  • Formato: JPG/PNG                            │
│  • Peso máx: 5MB                               │
│                                                 │
├─────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │ ⭐   │  │      │  │      │  │      │       │
│  │[IMG] │  │[IMG] │  │[IMG] │  │[IMG] │       │
│  │      │  │      │  │      │  │      │       │
│  └──────┘  └──────┘  └──────┘  └──────┘       │
│  Navidad   Elegante  Cumple   Verano          │
│  [⭐][🗑️]  [⭐][🗑️]  [⭐][🗑️]  [⭐][🗑️]        │
└─────────────────────────────────────────────────┘
```

### **Selector en CreateGiftCard**
```
┌─────────────────────────────────────────┐
│ 🎨 Diseño de la Gift Card              │
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐            │
│  │[IMG]│  │[IMG]│  │[IMG]│            │
│  │     │  │ ✓   │  │     │            │
│  └─────┘  └─────┘  └─────┘            │
│  Navidad  Elegante Cumple              │
│           (Selected)                   │
│                                         │
│ El monto se mostrará automáticamente   │
└─────────────────────────────────────────┘
```

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.0.0
