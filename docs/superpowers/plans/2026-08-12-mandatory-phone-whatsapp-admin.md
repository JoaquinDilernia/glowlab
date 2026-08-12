# Mandatory Registration Phone + Admin WhatsApp Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a contact phone number at merchant registration, and expose it as a clickable WhatsApp link in the internal admin panel's stores table.

**Architecture:** `Register.jsx` gains a required phone field wired into its existing `formData`/validation pattern; `/api/auth/register` rejects registrations missing it and saves it to both `promonube_users` (canonical) and `promonube_stores` (denormalized copy, same pattern as `detectedTheme`). `GET /api/admin/stores` passes that denormalized `phone` through; `AdminPanel.jsx`'s stores table renders it as a `wa.me` link.

**Tech Stack:** React (`Register.jsx`, `AdminPanel.jsx`), Node/Express (`functions/index.js`), Firestore (`promonube_users`, `promonube_stores`).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-12-mandatory-phone-whatsapp-admin-design.md`.
- Phone format: full number with country code, no leading `0`/`15`, exactly the shape `App.jsx`'s existing WhatsApp support link already uses (`5491164212370`). No auto-formatting/prefixing — the field asks for this shape explicitly via help text, and validation only checks digit count, not correctness of the country code.
- `POST /dev-login` (`functions/index.js:1130`) is a local-dev-only shortcut, out of scope — do not touch it.
- Existing stores registered before this change have no `phone` — the admin table must render a plain placeholder for them, not throw or show `undefined`.
- `functions/index.js` cannot be `require()`'d standalone locally (missing Firebase credentials, pre-existing, unrelated) — use `node --check functions/index.js` for sanity checks.
- No automated frontend test suite exists in this repo — verification is `npm run build` / `npx eslint` plus manual checks where noted.

---

## Task 1: Require and store `phone` in `/api/auth/register`

**Files:**
- Modify: `functions/index.js:977` (`POST /api/auth/register`)

**Interfaces:**
- Produces: the endpoint now requires `phone` in the request body (breaking change for that one endpoint, intentional per spec) and persists it on both `promonube_users.{userId}.phone` and `promonube_stores.{storeId}.phone`. Task 2's `Register.jsx` is the only caller and is updated in this same plan.

- [ ] **Step 1: Require `phone` and save it**

Read `functions/index.js` around line 977. Find:

```js
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, storeId } = req.body;

    if (!email || !password || !name || !storeId) {
      return res.json({ 
        success: false, 
        message: 'Todos los campos son requeridos' 
      });
    }
```

Replace with:

```js
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, storeId, phone } = req.body;

    if (!email || !password || !name || !storeId || !phone) {
      return res.json({ 
        success: false, 
        message: 'Todos los campos son requeridos' 
      });
    }
```

Then find the `userData` object and the `promonube_stores` update immediately after it:

```js
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
```

Replace with:

```js
    // Crear usuario
    const userId = `user_${Date.now()}`;
    const userData = {
      userId,
      storeId,
      email: email.toLowerCase(),
      name,
      phone,
      passwordHash: hashPassword(password),
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp()
    };

    await db.collection("promonube_users").doc(userId).set(userData);

    // Actualizar store con el userId y telefono de contacto
    await db.collection("promonube_stores").doc(storeId).update({
      userId: userId,
      phone: phone
    });
```

- [ ] **Step 2: Sanity check**

Run: `node --check functions/index.js` from repo root.
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: require and store contact phone on merchant registration"
```

---

## Task 2: Add the phone field to `Register.jsx`

**Files:**
- Modify: `src/pages/Register.jsx`

**Interfaces:**
- Consumes: none new.
- Produces: sends `phone` in the `POST /api/auth/register` body, matching what Task 1 now requires.

- [ ] **Step 1: Add `Phone` to the lucide-react import**

Find (line 3):

```jsx
import { Zap, User, Mail, Lock, CheckCircle } from 'lucide-react';
```

Replace with:

```jsx
import { Zap, User, Mail, Phone, Lock, CheckCircle } from 'lucide-react';
```

- [ ] **Step 2: Add `phone` to form state**

Find (lines 10-15):

```jsx
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
```

Replace with:

```jsx
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
```

- [ ] **Step 3: Validate phone before submit**

Find, inside `handleSubmit` (lines 44-48):

```jsx
    // Validaciones
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
```

Replace with:

```jsx
    // Validaciones
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setError('Ingresá un teléfono válido con código de país');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
```

- [ ] **Step 4: Send `phone` to the API**

Find (lines 57-66):

```jsx
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          storeId: storeId
        })
      });
```

Replace with:

```jsx
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          storeId: storeId
        })
      });
```

- [ ] **Step 5: Add the form field**

Find, between the Email field and the Contraseña field (lines 122-141):

```jsx
          <div className="form-group">
            <label>
              <Mail size={18} />
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Lock size={18} />
              Contraseña
            </label>
```

Replace with:

```jsx
          <div className="form-group">
            <label>
              <Mail size={18} />
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Phone size={18} />
              Teléfono / WhatsApp
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="5491123456789"
              value={formData.phone}
              onChange={handleChange}
              required
            />
            <small>Incluí código de país, sin el 0 ni el 15 (ej: 5491123456789). Lo usamos para contactarte por WhatsApp.</small>
          </div>

          <div className="form-group">
            <label>
              <Lock size={18} />
              Contraseña
            </label>
```

- [ ] **Step 6: Verify**

Run: `npx eslint src/pages/Register.jsx` — expect no new errors.
Run: `npm run build` — expect success.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Register.jsx
git commit -m "feat: add required phone field to registration form"
```

---

## Task 3: Return `phone` from `GET /api/admin/stores`

**Files:**
- Modify: `functions/index.js:15452` (`GET /api/admin/stores`)

**Interfaces:**
- Produces: each object in the `stores` array now includes `phone: string | null`. Task 4 consumes this.

- [ ] **Step 1: Add the field**

Find (`functions/index.js:15506-15511`):

```js
      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription,
        detectedTheme: storeData.detectedTheme || null
      });
```

Replace with:

```js
      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription,
        detectedTheme: storeData.detectedTheme || null,
        phone: storeData.phone || null
      });
```

- [ ] **Step 2: Sanity check**

Run: `node --check functions/index.js` — expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: expose store contact phone in the admin stores endpoint"
```

---

## Task 4: WhatsApp column in `AdminPanel.jsx`

**Files:**
- Modify: `src/pages/AdminPanel.jsx`
- Modify: `src/pages/AdminPanel.css`

**Interfaces:**
- Consumes: `store.phone` from Task 3's `GET /api/admin/stores` response.

- [ ] **Step 1: Import `MessageCircle`**

Find (line 3):

```jsx
import { Shield, Users, Package, TrendingUp, Search, LogOut, ArrowLeft, Sparkles, Lock, Calendar, CheckCircle, XCircle, Palette } from 'lucide-react';
```

Replace with:

```jsx
import { Shield, Users, Package, TrendingUp, Search, LogOut, ArrowLeft, Sparkles, Lock, Calendar, CheckCircle, XCircle, Palette, MessageCircle } from 'lucide-react';
```

- [ ] **Step 2: Add the table header**

Find (`AdminPanel.jsx:342-349`):

```jsx
                <th>TIENDA</th>
                <th>STORE ID</th>
                <th>PLAN</th>
                <th>ESTADO</th>
                <th>MÓDULOS</th>
                <th>FECHA ACTIVACIÓN</th>
                <th>EXPIRA</th>
                <th>ACCIONES</th>
```

Replace with:

```jsx
                <th>TIENDA</th>
                <th>STORE ID</th>
                <th>PLAN</th>
                <th>ESTADO</th>
                <th>MÓDULOS</th>
                <th>FECHA ACTIVACIÓN</th>
                <th>EXPIRA</th>
                <th>WHATSAPP</th>
                <th>ACCIONES</th>
```

(This is the first of three `<th>TIENDA</th>` occurrences in the file — the one inside the "stores" tab's table, which is also the only one immediately followed by `<th>STORE ID</th>` then `<th>PLAN</th>`. Confirm with Read before editing that this is the "stores" tab table, not "Desinstalaciones" or "Temas".)

- [ ] **Step 3: Add the table cell**

Find, immediately before the actions `<td>` (`AdminPanel.jsx:394-398`):

```jsx
                    <td>
                      {untilDate ? new Date(untilDate).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <div className="actions-cell">
```

Replace with:

```jsx
                    <td>
                      {untilDate ? new Date(untilDate).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      {store.phone ? (
                        <a
                          href={`https://wa.me/${store.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-whatsapp-link"
                          title={`Escribir a ${store.storeName} por WhatsApp`}
                        >
                          <MessageCircle size={18} />
                        </a>
                      ) : (
                        <span className="admin-whatsapp-none" title="Sin teléfono registrado">—</span>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
```

- [ ] **Step 4: Add the CSS**

Read `src/pages/AdminPanel.css`. Find (lines 436-440):

```css
.actions-cell {
  display: flex;
  gap: 8px;
}
```

Insert immediately above it:

```css
.admin-whatsapp-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: rgba(16, 185, 129, 0.2);
  border: 2px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  color: #6ee7b7;
  cursor: pointer;
  transition: all 0.2s;
}

.admin-whatsapp-link:hover {
  background: rgba(16, 185, 129, 0.3);
  border-color: rgba(16, 185, 129, 0.5);
}

.admin-whatsapp-none {
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
}

.actions-cell {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 5: Verify**

Run: `npx eslint src/pages/AdminPanel.jsx` — expect no new errors.
Run: `npm run build` — expect success.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminPanel.jsx src/pages/AdminPanel.css
git commit -m "feat: add clickable WhatsApp icon to admin stores table"
```

---

## Task 5: Manual end-to-end verification

**Files:** none — verification only.

**Interfaces:** none.

- [ ] **Step 1: Registration form**

Run the dev server (`npm run dev`), navigate to `/#/` with a valid `?store_id=X&installed=true` (or trigger the real Tiendanube install flow if available). Confirm: the phone field renders between Email and Contraseña, is required, and submitting with fewer than 8 digits shows "Ingresá un teléfono válido con código de país" without hitting the network.

- [ ] **Step 2: Admin table**

Navigate to `/#/admin`, log in, open the "Tiendas" tab. Confirm: a "WHATSAPP" column appears before "ACCIONES". For any store with a `phone` on its Firestore doc, the green icon renders and clicking it opens `https://wa.me/<digits>` in a new tab. For stores without `phone`, a muted `—` renders instead, no console error.

- [ ] **Step 3: No commit needed** — verification only. If either check fails, return to the relevant task, fix, and re-run its build/lint verification before a new commit.
