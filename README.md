# ReNewKart — Refurbished & Second-Hand Store

ReNewKart is a responsive full-stack store for refurbished mobiles, laptops, tablets, smart watches, headphones and cameras, plus pre-loved books and device trade-ins. The interface is built with React, Tailwind CSS and Vite; the API uses Django REST Framework with SQLite locally and PostgreSQL on Render.

## Features

- 47 seeded products across seven product categories, with category/brand/condition/price filters, search and sorting.
- Product pages with image galleries, condition and warranty details, stock, ratings and purchase-verified reviews.
- Token-authenticated registration, login, logout, profile management and password reset.
- Persistent cart and wishlist, saved delivery addresses, coupon validation, checkout and order tracking.
- Cash on Delivery and Razorpay Checkout with server-side signature verification.
- Stock reservation when an order is placed and stock restoration when an unpaid order is cancelled.
- Exchange estimate submissions with up to three validated device photos, visible in the staff admin panel.
- Contact form submissions saved to the database.
- Staff-only admin dashboard for sales/order metrics, products, image uploads, categories, inventory, order status, customers and coupon codes.
- Accessible responsive layouts for mobile, tablet and desktop.

## Tech stack

- Frontend: React 19, React Router, Tailwind CSS 4, Vite, Axios, Lucide
- Backend: Django 5.2+, Django REST Framework, Token Authentication
- Database: SQLite locally; Render PostgreSQL in production
- Payments: Razorpay Checkout (test credentials supported) and Cash on Delivery
- Product photography: Unsplash

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.10+

## Run locally (Windows PowerShell)

Open two terminals from the project root.

### 1. Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py makemigrations store
python manage.py migrate
python manage.py seed_store
python manage.py createsuperuser
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/api/`. Django admin is at `http://127.0.0.1:8000/django-admin/`.

The reset-password email backend prints the one-time reset link in the backend terminal. Set `FRONTEND_URL` if the frontend uses a different address.

### 2. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Razorpay test checkout

Create Razorpay **Test Mode** API keys and set them in the backend process before starting Django:

```powershell
$env:RAZORPAY_KEY_ID = "rzp_test_your_key_id"
$env:RAZORPAY_KEY_SECRET = "your_test_secret"
python manage.py runserver
```

If Razorpay keys are not set, online checkout returns an explicit configuration error; Cash on Delivery remains available. Do not commit credentials or use test keys in production.

## Database and sample catalogue

SQLite data is stored in `backend/db.sqlite3`. Run `python manage.py seed_store` to create or refresh seven product categories (Mobiles, Laptops, Books, Tablets, Smart Watches, Headphones & Earbuds, and Cameras), 47 catalogue products and the `RENEW10` coupon. The Exchange Zone remains available as a dedicated page rather than a product category. Product, cart, order, review, address, exchange and contact form data are persisted in the database. Seeded product photos use local image files; uploaded product and exchange photos are stored under `backend/media/`.

Create the first staff account using `createsuperuser`. Only staff accounts can access `/admin` in the frontend or the `/api/admin/` endpoints.

## Deploy to Render

The root `render.yaml` defines a Django API service, a Vite static site and a PostgreSQL database. Connect the repository in Render as a Blueprint and review all three resources before deploying.

1. The API service installs dependencies and collects static files during build. At startup it migrates PostgreSQL, idempotently loads the checked-in `backend/store/data/catalogue.json` snapshot exported from the local database, and provisions the administrator if its environment variables are set.
2. PostgreSQL uses Render's internal connection URL. The persistent disk mounted at `/var/data` stores uploaded media only.
3. Set `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, and a unique, strong `DJANGO_SUPERUSER_PASSWORD` in Render. The password is not stored in `render.yaml`; an existing account's password is not reset on each restart.
4. Enter SMTP credentials when prompted. Password reset uses SMTP when `DJANGO_DEBUG=0`; production startup intentionally fails if `EMAIL_HOST` is missing.
5. Enter Razorpay **Test Mode** keys if online checkout should be enabled. Without those keys, the API keeps Cash on Delivery available and returns an explicit configuration error for Razorpay.
6. Confirm the API responds at `https://renewkart-api.onrender.com/api/products/` and `https://renewkart-api.onrender.com/api/categories/`, then open the frontend at `https://renewkart-web.onrender.com`. If you change either service's Render domain, update `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`, and `VITE_API_URL` to match.

## Deploy the frontend to Vercel

Create a Vercel project for this repository with `frontend` as its Root Directory, `npm run build` as its Build Command, and `dist` as its Output Directory. Set the build-time environment variable `VITE_API_URL` to `https://renewkart-api.onrender.com/api` for Production (and Preview if previews should use the live API). Vite bundles this value into the frontend at build time.

The Render Blueprint includes `https://renewkart.vercel.app` in `CORS_ALLOWED_ORIGINS`; Django also allows HTTPS `*.vercel.app` origins and the local Vite origin without enabling CORS for all origins. If you have overridden `CORS_ALLOWED_ORIGIN_REGEXES` in your deployment, ensure it retains the Vercel rule. Product requests use `/products/` relative to `VITE_API_URL`, resulting in `https://renewkart-api.onrender.com/api/products/`.

Set production secrets in Render's environment settings, not in `.env` files or source control. To refresh the deployment catalogue from the local SQLite database, run `python manage.py export_catalogue_snapshot` from `backend/` and commit the generated snapshot. The Blueprint uses Render's free PostgreSQL plan, which expires after its free-plan retention period; choose a paid plan in Render for persistent production data.

## Useful API routes

- `GET /api/products/`, `GET /api/categories/`, `GET /api/products/<slug>/`
- `POST /api/auth/register/`, `POST /api/auth/login/`, `POST /api/auth/logout/`
- `GET|POST|PATCH|DELETE /api/cart/`, `GET|POST|DELETE /api/wishlist/`
- `GET|POST /api/addresses/`, `GET|POST /api/orders/`, `GET /api/orders/<order-number>/`
- `POST /api/payments/razorpay/create/`, `POST /api/payments/razorpay/verify/`
- `POST /api/exchange/estimate/`, `POST /api/contact/`
- Staff-only `/api/admin/stats/`, `/api/admin/products/`, `/api/admin/categories/`, `/api/admin/orders/`, `/api/admin/users/`, `/api/admin/coupons/`

## Validation

```powershell
cd backend
python manage.py check
python manage.py test
cd ..\frontend
npm run build
```
