# Mandatory Registration Phone + Admin WhatsApp Icon — Design

## Purpose

There's currently no way to contact a merchant directly — `Register.jsx` collects name/email/password only, and the internal admin panel (`src/pages/AdminPanel.jsx`) has no contact info beyond store name. This adds a required phone number to registration and surfaces it as a clickable WhatsApp shortcut in the admin stores table, so the project owner can reach any merchant in one click.

Two changes, done together because the second depends on the first:

**A. Mandatory phone at registration** — `Register.jsx` gains a required phone field; `/api/auth/register` rejects registrations without one.

**B. WhatsApp icon in the admin panel** — the stores table gets a new column with a `wa.me` link built from that phone number.

## A. Mandatory phone at registration

### Scope

Only the real merchant signup path is in scope: Tiendanube OAuth install (`GET /auth/callback`, `functions/index.js:779`) redirects to `Register.jsx`, which POSTs to `/api/auth/register` (`functions/index.js:977`). `POST /dev-login` (`functions/index.js:1130`) is an explicitly-labeled local-development shortcut ("Login manual para desarrollo local (solo dev)") that never runs for real merchants — it is not touched.

### Phone format

No auto-formatting or country-code guessing. The field asks for the full number including country code, in the exact shape the existing WhatsApp support button already uses (`App.jsx:79`, `https://wa.me/5491164212370`): country code + `9` + area code + number, no leading `0`, no `15`. Help text under the field states this explicitly with an example.

### Frontend — `src/pages/Register.jsx`

- Add `phone: ''` to the `formData` state (next to `name`/`email`/`password`/`confirmPassword`).
- Add a form field between Email and Contraseña, following the file's existing field pattern (`Phone` icon from `lucide-react`, already used elsewhere in the codebase's icon set):
  ```jsx
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
  ```
- In `handleSubmit`, add a validation check alongside the existing password checks: strip non-digits from `formData.phone` and require at least 8 digits remaining, otherwise `setError('Ingresá un teléfono válido con código de país')` and return — same pattern as the existing password-length check.
- Add `phone: formData.phone` to the `/api/auth/register` request body.

### Backend — `functions/index.js:977` (`POST /api/auth/register`)

- Destructure `phone` from `req.body` alongside the existing fields.
- Extend the required-fields check: `if (!email || !password || !name || !storeId || !phone)`.
- Add `phone` to the `userData` object saved to `promonube_users` (canonical owner of contact info, alongside `name`/`email`).
- Extend the existing `promonube_stores` update (which already sets `userId` right after creating the user) to also stamp `phone`:
  ```js
  await db.collection("promonube_stores").doc(storeId).update({
    userId: userId,
    phone: phone
  });
  ```
  This denormalized copy is what lets the admin endpoint (Part B) read the phone without a second Firestore lookup per store — the same shape already used for `detectedTheme`.

Stores registered before this change simply have no `phone` field on either document — Part B handles that as a display-only gap, no backfill.

## B. WhatsApp icon in the admin panel

### Backend — `functions/index.js:15452` (`GET /api/admin/stores`)

Add one field to the object already pushed per store (`functions/index.js:15506-15511`):
```js
stores.push({
  storeId: storeId,
  storeName: storeData.name || storeData.storeName || 'Sin nombre',
  subscription,
  detectedTheme: storeData.detectedTheme || null,
  phone: storeData.phone || null
});
```

### Frontend — `src/pages/AdminPanel.jsx`

- Import `MessageCircle` from `lucide-react` (alongside the file's existing icon imports).
- Add a `<th>WHATSAPP</th>` column to the stores table header, immediately before `<th>ACCIONES</th>` (`src/pages/AdminPanel.jsx:349`).
- Add the matching `<td>` immediately before the existing actions `<td>` (`AdminPanel.jsx:397`):
  ```jsx
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
  ```
- `src/pages/AdminPanel.css`: add `.admin-whatsapp-link` (WhatsApp green `#25D366`, hover state consistent with the file's other icon-button hovers) and `.admin-whatsapp-none` (muted gray, matches the table's existing `-` placeholders elsewhere).

This column only touches the "stores" tab's table — the "Desinstalaciones" and "Temas" tabs are unaffected.

## Out of scope

- Backfilling `phone` for existing merchants — not possible without contacting them, which is exactly what this feature is for; they'll simply show `—` until they update their info some other way (no such "edit my info" UI exists yet, and isn't part of this change).
- Editing/updating phone after registration — no settings page currently exposes it; out of scope, revisit if needed.
- Phone number format validation beyond a digit-count minimum (e.g. real libphonenumber-style validation) — the existing `whatsappPhone` merchant-facing feature (`functions/index.js` StyleConfig widget) has never needed this; matching that low bar is consistent with the rest of the codebase.
