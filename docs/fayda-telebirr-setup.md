# Fayda Sign-In and Telebirr Paywall Setup

This app can support Fayda sign-in and a Telebirr paywall without rebuilding the frontend in Ionic. The web app can stay Vue/Vite and run as a PWA; the sensitive identity and payment work belongs in the Django API.

## Fayda Sign-In

Fayda uses OAuth 2.0 and OpenID Connect through Fayda eSignet. Start by registering the app in the Fayda partner portal, then use the issued client credentials in the Django API. Public entry point: https://id.gov.et/authentication

### Required Environment Variables

Add these to the API environment, not the frontend:

```env
FAYDA_CLIENT_ID=your-client-id
FAYDA_CLIENT_SECRET=your-client-secret
FAYDA_REDIRECT_URI=http://127.0.0.1:8000/auth/fayda/callback/
FAYDA_AUTHORIZE_URL=https://provider-authorize-url
FAYDA_TOKEN_URL=https://provider-token-url
FAYDA_USERINFO_URL=https://provider-userinfo-url
FAYDA_SCOPE=openid profile email
```

For production, replace `FAYDA_REDIRECT_URI` with the public HTTPS API callback URL registered in the Fayda portal.

### App Endpoints

The current backend exposes:

```text
POST /auth/fayda/start/
GET  /auth/fayda/callback/?code=...&state=...
POST /auth/fayda/callback/
```

`/auth/fayda/start/` creates the authorization URL and stores a CSRF-style OAuth `state` value in the session. The callback exchanges the authorization code for a token, calls the userinfo endpoint, then creates or signs in the local user.

### Security Checklist

- Keep `FAYDA_CLIENT_SECRET` only on the backend.
- Register only HTTPS redirect URLs in production.
- Keep the `state` check enabled.
- Store the Fayda subject as an external identity mapping before going live if multiple identity providers will be supported.
- Decide whether Fayda users should default to listener or creator, then let them switch to artist / creator through the profile flow.

## Telebirr Paywall

Use Telebirr through Ethio telecom's developer portal or an approved payment gateway that supports Telebirr. Official developer portal: https://developer.ethiotelecom.et/user/home

The app already lets creators mark a work as payable and set an ETB price. Free works can be streamed directly. Payable works should send the user through checkout before unlocking stream/download access.

### Required Environment Variables

The current API integration expects a checkout URL and merchant code:

```env
TELEBIRR_CHECKOUT_BASE_URL=https://your-telebirr-or-gateway-checkout-url
TELEBIRR_MERCHANT_CODE=your-merchant-code
```

The existing implementation returns `501 Telebirr checkout is not configured` until those values exist.

### App Endpoint

```text
POST /works/<work_id>/pay/
```

The endpoint checks that the work exists, is public, and is marked payable. It then returns:

```json
{
  "provider": "telebirr",
  "checkoutUrl": "https://...",
  "amount": "100.00",
  "currency": "ETB"
}
```

The frontend redirects the user to `checkoutUrl`.

### Production Paywall Flow

1. Creator uploads a work.
2. Creator sets `Payable through Telebirr` and `Price in ETB` in My Creations.
3. Listener clicks `Pay`.
4. API creates a Telebirr order through the official Telebirr API or gateway.
5. Listener pays on the hosted checkout page.
6. Telebirr or the gateway calls a backend webhook.
7. Backend verifies the webhook signature and payment status.
8. Backend records a purchase entitlement for that user and work.
9. Stream/download endpoints allow access when the user owns the entitlement.

### Backend Work Still Needed Before Real Money

- Add a `Purchase` or `WorkEntitlement` model with user, work, amount, currency, provider, provider order ID, status, and timestamps.
- Add a webhook endpoint for Telebirr payment success/failure.
- Verify webhook signatures or provider tokens server-side.
- Block payable stream/download until the request belongs to an entitled user.
- Keep free previews separate from paid full files if creators need samples.
- Never trust a frontend "paid" flag.

## Local Development

Run migrations after pulling the auth/payment changes:

```powershell
python apps/api/manage.py migrate
```

Run the API and web app:

```powershell
python apps/api/manage.py runserver 127.0.0.1:8000
npm run dev --workspace apps/web
```

Frontend default API origin is derived from:

```env
VITE_API_URL=http://127.0.0.1:8000/graphql/
```

## PWA Note

You do not need Ionic just to make this installable. The existing Vue app can remain a PWA with:

- `manifest.webmanifest`
- service worker
- responsive sidebar/bottom navigation
- HTTPS production hosting
- mobile-safe media playback controls

Ionic is only worth considering if you want native mobile plugins, app-store packaging, or a heavily native-looking UI.
