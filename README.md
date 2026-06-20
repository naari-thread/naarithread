This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Razorpay Integration

Razorpay is integrated end-to-end with:

- server-side order creation
- server-side signature verification
- webhook reconciliation for async payment updates
- Firebase Firestore order and payment persistence

### Routes

- `POST /api/payments/razorpay/create-order`
- `POST /api/payments/razorpay/verify`
- `POST /api/payments/razorpay/webhook`

### Required Environment Variables

Add these values in your deployment provider (Vercel) and local `.env.local`:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

All current variables are listed in `.env.example`.

### Razorpay Dashboard Setup

1. Create Razorpay account and complete KYC.
2. Enable both domestic and international payments in account settings.
3. Copy test credentials into environment variables.
4. Configure webhook endpoint:
	- URL: `https://<your-domain>/api/payments/razorpay/webhook`
	- Secret: use the same value as `RAZORPAY_WEBHOOK_SECRET`
	- Events: include at least `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`

### Notes on Currency

The current catalog pricing is INR-based and checkout creates INR Razorpay orders. Razorpay can still process international cards on INR orders after your account is enabled for international payments.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
