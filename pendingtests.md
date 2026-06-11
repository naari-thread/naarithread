# Pending Tests — NaariThread

Tracking manual tests to run once credentials are available (Razorpay test keys, Cloudinary keys).
Check items off as they pass.

---

## Prerequisites / Setup
- [ ] Set `RAZORPAY_KEY_ID` (`rzp_test_…`), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in `.env`
- [ ] Razorpay dashboard webhook → `https://nonradioactive-intriguedly-tatiana.ngrok-free.dev/api/payments/razorpay/webhook`, all events, secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `.env`
- [ ] Create Cloudinary **signed upload preset(s)** with the restrictions documented in the plan (allowed formats jpg/png/webp, max file size, dimension cap)
- [x] Run `npm run appwrite:setup-db` — DONE (created `reviews.imageUrls`; `users.address` left at 500 since Appwrite can't resize an existing attribute; storing JSON there is non-fatal). Also fixed a pre-existing 37-char index key that was aborting the migration.
- [ ] `npm run dev` + ngrok pointed at the dev port

---

## Phase 1 — Payments hardening & data integrity

### Checkout happy path
- [ ] Add to cart → checkout; shipping form is **prefilled** from saved profile (for returning user)
- [ ] Pay with Razorpay **success** test card → order shows `placed` / `paid` in account modal
- [ ] Same order/payment present in Appwrite with correct `totalAmount`, `itemsJson` (incl. size/color), `shippingAddress`
- [ ] Cart clears after success
- [ ] Address is written back to `users` profile (re-open checkout → still prefilled with the new address)

### Checkout failure / retry
- [ ] Pay with **failure** test card → order becomes `payment_failed`
- [ ] **Retry Payment** button appears and starts a fresh Razorpay order
- [ ] Successful retry moves the same order to `placed` / `paid`

### Idempotency & webhooks
- [ ] Razorpay dashboard → webhook delivery log shows deliveries arriving via ngrok
- [ ] **Resend** a `payment.captured` event multiple times → order/payment do **not** change again, no status downgrade
- [ ] **Resend** an `order.paid` event → handled, no duplicate writes
- [ ] Terminal shows structured `payments.webhook` JSON logs incl. `duplicate_event_skipped` on replays
- [ ] `payment.failed` webhook moves a pending order to `payment_failed` (guarded — does not override an already `paid` order)

### Duplicate-click guard
- [ ] Rapidly clicking "Proceed to Buy" twice reuses the same open order (no duplicate Razorpay orders / order rows)

### Logging / error hygiene
- [ ] Forced failure returns a `correlationId` to the client (no raw internal error message leaked)
- [ ] Matching `correlationId` is present in the server log line

---

## Phase 2 — Cloudinary uploads, admin order-status, review images

### Cloudinary signed upload (security)
- [ ] `/api/uploads/sign` rejects unauthenticated requests
- [ ] Product-image signing requires an **admin** session; review-image signing requires a logged-in user
- [ ] `CLOUDINARY_API_SECRET` is never exposed to the browser (not in network responses / client bundle)

### Admin — product images
- [ ] Add a new product with an uploaded image → image uploads to `naarithread/products` folder in Cloudinary
- [ ] `secure_url` is saved to `sku.mainImageUrl`; product image renders on storefront via `CloudinaryImage`
- [ ] Edit an existing product and replace its image → new URL persisted
- [ ] Upload additional images → saved to `sku.otherImageUrls`
- [ ] Oversize / invalid file type is rejected (client + server)

### Admin — order status workflow
- [ ] Move a paid order: `confirmed → shipped → out_for_delivery → delivered → completed`
- [ ] Each change updates `orders.status` in Appwrite
- [ ] Each change creates a `notifications` row for the customer
- [ ] Status reflects in the customer's Orders modal
- [ ] Invalid/backward transitions are blocked
- [ ] Cancel order path works and is guarded appropriately
- [ ] A late payment webhook does **not** revert an admin-set status (e.g. `shipped` stays `shipped`)

### Customer — review images
- [ ] Submit a review with 1–3 images under the size cap → images upload to `naarithread/reviews`
- [ ] `reviews.imageUrls` persisted with the Cloudinary `secure_url`s
- [ ] Review images render on the product page
- [ ] More than 3 images / oversize / wrong type is rejected (client + server)
- [ ] Review without images still works

### Admin UX overhaul (no Razorpay needed)
- [ ] Admin tabs are Products / AddOns / Orders / Payments (no Dashboard); default landing is Products
- [ ] Create Product form shows: Name, Category (dropdown), Sub Category (dropdown), Original/Discount price, Stock Qty, Description, Sizes (chips), Colors (chips + add custom), Main Image, Other Images — and NO SKU/Slug/InStock/Active fields
- [ ] Category & Sub Category dropdowns list the DB enum values
- [ ] Creating a product succeeds; SKU + slug auto-generated; `inStock` true when stock > 0; `size` set from first selected size
- [ ] Sizes/colors save as arrays; custom color can be added
- [ ] Image preview is larger; clicking a thumbnail opens a zoom overlay; × removes it; no URL text box shown
- [ ] AddOns subtitle reads "Manage banners and coupons."; list scrolls; no pagination
- [ ] Orders & Payments: search box + From/To date filters work; lists scroll; no pagination
- [ ] Mobile admin navbar shows a "Website" button (→ /products) instead of call/bot icons

### Regression
- [ ] `npm run build` passes
- [ ] Cloudinary dashboard shows uploads in expected folders; credit usage minimal
