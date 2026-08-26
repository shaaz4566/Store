# SZC Store

Premium multi-category e-commerce starter for Kerala, India.

## Stack
- Plain HTML/CSS/JavaScript
- Firebase Web SDK via CDN
- Firebase Authentication (Google)
- Cloud Firestore
- Firebase Storage ready
- GitHub Pages friendly single-folder structure

## Files
- `index.html` — customer storefront
- `admin.html` — admin dashboard
- `style.css` — storefront styling
- `admin.css` — admin styling
- `app.js` — customer logic
- `admin.js` — admin logic
- `firebase.js` — Firebase initialization

## Firebase setup
1. In Firebase Authentication, enable Google sign-in.
2. Create/enable Cloud Firestore.
3. Enable Storage if you will store product images.
4. Add your GitHub Pages domain and local development domain to Authentication > Settings > Authorized domains.
5. Replace/add Firestore Security Rules appropriate for your real deployment.

Firebase recommends using Authentication together with Firestore Security Rules to secure browser-accessed data. See the official Firebase documentation:
https://firebase.google.com/docs/firestore
https://firebase.google.com/docs/auth/web/start

## Admin security
The included admin UI is intentionally not treated as a security boundary. Before production, the included `firestore.rules` authorizes administrator UID `ihSDHUk86DY8McVcLN7gjzt96Bm1`. Never make all `products`, `orders`, or user data publicly writable.

## Payments
The storefront does not fake successful payments. UPI/Google Pay support requires a legitimate merchant payment flow. A merchant payment gateway should create/verify payments server-side. Do not put private gateway keys in `index.html`, `app.js`, `admin.html`, or any public GitHub file.

The current order flow records a `pending_verification` payment state. Connect your merchant provider/webhook/server before treating an order as paid.

## GitHub
Upload all files in this folder to one repository. Because the site uses browser ES modules and Firebase CDN imports, no npm/build step is required.

## Product images
The admin form currently accepts image URLs. For production, replace that field with Firebase Storage upload logic if you want images hosted inside your Firebase project.

## Important
Firestore rules must be configured before public launch. Do not leave Firestore in unrestricted test mode.
