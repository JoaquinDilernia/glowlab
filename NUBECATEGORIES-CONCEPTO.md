# NubeCategories - App de Gestión Inteligente de Categorías

## 🎯 Problema que Resuelve

**Pain Points identificados en AltoRancho (caso real):**
- ❌ Actualizar categorías es manual y lento
- ❌ Mover productos entre categorías: límite de 20 productos
- ❌ URLs no SEO-friendly difíciles de cambiar
- ❌ Árboles de categorías grandes = caos
- ❌ Crear categorías de promo manualmente (ej: Black Friday)
- ❌ Mantener categorías por % descuento actualizadas

## ✨ Features Principales

### 1. Bulk Category Manager
- Seleccionar 100+ productos a la vez
- Mover/copiar masivamente entre categorías
- Remover en batch
- Sin límites de 20 productos

### 2. SEO URL Optimizer
- Auto-generar URLs SEO-friendly
- Bulk update de URLs
- Redirects automáticos 301
- Ejemplo: `/categoria-123` → `/zapatillas-nike-running`

### 3. Category Tree Visualizer
- Vista de árbol drag & drop
- Reorganizar visualmente
- Duplicar estructuras completas
- Exportar/importar categorías

### 4. 🤖 Smart Category Rules (FEATURE ESTRELLA)

**Sistema de automatización con condiciones y acciones:**

#### Condiciones disponibles:
- ✅ Está en categoría X
- ✅ Tiene descuento (%, rango)
- ✅ Precio entre $X y $Y
- ✅ Stock mayor/menor a N
- ✅ Tags contienen palabras
- ✅ Fecha de creación (últimos X días)
- ✅ Marca/fabricante
- ✅ Sin ventas en últimos X días

#### Acciones disponibles:
- ✅ Agregar a categoría
- ✅ Remover de categoría
- ✅ Mover a categoría
- ✅ Actualizar tags
- ✅ Cambiar visibilidad
- ✅ Enviar notificación

#### Ejecución:
- Manual (on-demand)
- Automática (cada 30min, 1h, 6h, diaria)
- Por webhook (en tiempo real cuando cambia producto)

### 5. Category Analytics
- Productos por categoría
- Categorías vacías (detectar)
- Categorías con 1 solo producto
- Performance de cada categoría
- Tendencias de tráfico

### 6. CSV/Excel Import Advanced
- Importar categorías completas
- Asignar productos masivamente
- Templates predefinidos descargables

## 📋 Casos de Uso Reales

### Caso 1: Black Friday Automático
```
REGLA: "Black Friday Muebles"
────────────────────────────────
SI:
  ✓ Producto está en "Muebles"
  ✓ Tiene descuento > 20%
  ✓ Stock disponible > 0

ENTONCES:
  → Agregar a categoría "Black Friday/Muebles"
  → Agregar tag "promo-bf"
  
EJECUTAR: Cada 1 hora
```

### Caso 2: Categoría por % Descuento
```
REGLA: "Descuentos 20-30%"
────────────────────────────────
SI:
  ✓ Tiene descuento entre 20% y 30%
  ✓ Stock > 0

ENTONCES:
  → Agregar a "Ofertas/20-30%"
  
EJECUTAR: Cada 30 minutos
```

### Caso 3: Novedades Auto-renovables
```
REGLA: "Novedades"
────────────────────────────────
SI:
  ✓ Fecha de creación < 30 días
  ✓ Stock > 5

ENTONCES:
  → Agregar a "Novedades"
  
AL CUMPLIR 30 DÍAS:
  → Remover de "Novedades"
  
EJECUTAR: Diaria a las 00:00
```

### Caso 4: Outlet Inteligente
```
REGLA: "Outlet Automático"
────────────────────────────────
SI:
  ✓ Stock < 3 unidades
  ✓ Producto sin ventas en últimos 90 días
  ✓ NO está en descuento actualmente

ENTONCES:
  → Agregar a "Outlet"
  → Sugerir descuento 40% (notificación)
  
EJECUTAR: Diaria
```

### Caso 5: Organización por Precio
```
REGLA: "Segmentación Premium"
────────────────────────────────
SI:
  ✓ Precio > $100,000
  ✓ Está en "Zapatillas"

ENTONCES:
  → Agregar también a "Premium/Zapatillas"
  
EJECUTAR: Cada 6 horas
```

### Caso 6: Auto-categorizar por Marca
```
REGLA: "Nike Auto-category"
────────────────────────────────
SI:
  ✓ Nombre contiene "Nike"
  O tags contienen "nike"

ENTONCES:
  → Agregar a "Marcas/Nike"
  
EJECUTAR: Cada 1 hora
```

## 💰 Pricing Sugerido

```
PLAN FREE
├─ Hasta 50 productos
├─ 10 categorías
├─ Acciones básicas manuales
└─ 1 regla automática

PLAN STARTER ($15/mes)
├─ Hasta 500 productos
├─ 30 categorías
├─ Bulk actions hasta 100
├─ SEO URL optimizer
└─ 3 reglas automáticas (cada 6h)

PLAN GROWTH ($30/mes) ← MOST POPULAR
├─ Hasta 2,000 productos
├─ Categorías ilimitadas
├─ Bulk actions ilimitadas
├─ 10 reglas automáticas (cada 1h)
├─ Smart assignments
└─ Analytics avanzado

PLAN PRO ($60/mes)
├─ Productos ilimitados
├─ Reglas ilimitadas (cada 30min)
├─ Webhooks en tiempo real
├─ API access
└─ Soporte prioritario
```

## 🎨 Stack Técnico

**Frontend:**
- React 18
- react-beautiful-dnd (drag & drop árbol)
- recharts (analytics)
- react-query (data fetching)

**Backend:**
- Firebase Functions (Node.js 22)
- Firestore (reglas, logs)
- Cloud Scheduler (ejecución automática)
- TiendaNube API

**Colecciones Firestore:**
```
promonube_automation_rules
├─ ruleId
├─ storeId
├─ name
├─ enabled
├─ conditions { operator, rules[] }
├─ actions []
├─ schedule { type, frequency }
├─ lastRun
├─ productsAffected
└─ stats { totalRuns, avgProductsAffected }

promonube_category_history
├─ storeId
├─ timestamp
├─ action (bulk_move, rule_executed)
├─ productsAffected
└─ metadata
```

## 📊 Market Opportunity

**TiendaNube Stats:**
- ~150,000 tiendas activas
- 30% con +200 productos = **45,000 target**
- 2% conversión = **900 clientes potenciales**
- Ticket promedio: $25 USD/mes
- **Potencial: $22.5K USD/mes**

**Ventaja competitiva:**
- ❌ NO existe competencia directa en TN
- ✅ Primera app de automation de categorías
- ✅ Resuelve problema operativo diario
- ✅ ROI claro (ahorro de tiempo)

## 🚀 MVP Roadmap (4 semanas)

**Semana 1: Core Functionality**
- Listar categorías + productos
- Bulk move (sin límite 20)
- Crear/editar categorías

**Semana 2: Automation Rules**
- UI para crear reglas
- Engine de evaluación de condiciones
- Ejecutor manual

**Semana 3: Scheduler + Advanced**
- Cloud Scheduler (auto-ejecutar)
- Vista previa de reglas
- Logs de ejecución

**Semana 4: SEO + Analytics**
- Optimizador de URLs
- Dashboard de analytics
- Tree view drag & drop

## 🎯 Go-to-Market Strategy

**Fase 1: Beta Testing**
- Usar en AltoRancho (caso real)
- Documentar tiempo ahorrado
- Screenshots antes/después

**Fase 2: Soft Launch**
- Landing page con video demo
- Lista de espera
- Pre-venta: 50% OFF primeros 50

**Fase 3: Content Marketing**
- Blog: "Cómo estructurar categorías para SEO"
- Video: "Organiza 1000 productos en 5 minutos"
- Grupo ecommerce: Ofrecer auditoría gratis

**Pitch perfecto:**
```
"¿Tu tienda tiene +100 productos?
¿Perdés horas organizando categorías?

NubeCategories automatiza todo:
✅ Categorías de promo que se actualizan solas
✅ Outlet automático para productos sin stock
✅ URLs SEO-friendly en 1 clic

Caso real: AltoRancho ahorró 15hs/semana."
```

## 📈 Proyección 18 meses

```
Mes 3:   50 clientes x $20 = $1,000/mes
Mes 6:  150 clientes x $22 = $3,300/mes
Mes 12: 400 clientes x $25 = $10,000/mes
Mes 18: 700 clientes x $25 = $17,500/mes

MRR objetivo: $15K USD/mes en 18 meses
```

## ✅ Validación Pre-desarrollo

**Antes de codear, validar:**

1. **Encuesta en grupo ecommerce:**
   - ¿Cuántos productos tenés?
   - ¿Cuánto tiempo te lleva organizar categorías?
   - ¿Pagarias $20/mes por automatizarlo?

2. **Landing page MVP:**
   - Mockups del producto
   - Video explicativo (Loom)
   - Formulario de pre-registro

3. **Meta de validación:**
   - 50+ emails registrados
   - 10+ dispuestos a pagar
   - → GREEN LIGHT para desarrollar

## 💡 Features Futuras (Post-MVP)

- Sugerencias IA de categorización
- A/B testing de estructuras
- Integraciones: Google Merchant, Facebook Catalog
- Templates de industria (moda, tech, hogar)
- Duplicación de estructura entre tiendas
- API pública para agencias

---

## 📝 Notas Importantes

- **Timing:** Desarrollar DESPUÉS de que PromoNube y NubeSheets estén aprobadas
- **Diferenciador clave:** Automatización de reglas (nadie lo tiene)
- **Target perfecto:** Tiendas +200 productos preocupadas por SEO
- **Complementa portfolio:** NubeSheets (operativo) + PromoNube (marketing) + NubeCategories (catálogo)

---

**Última actualización:** Noviembre 2025
**Status:** Concepto validado - Pendiente desarrollo
**Prioridad:** App #3 del roadmap 2025-2026
