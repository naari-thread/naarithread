# Wallet Feature — Flow & File Reference

## Overview

The wallet lets customers redeem refund credits at checkout. Wallet credits are issued when an admin processes a refund-to-wallet instead of a bank refund. At checkout, the customer can apply their balance to reduce or eliminate the Razorpay charge.

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `wallets` | One document per user (`wallets/{userId}`). Holds `balance` (number, in ₹). |
| `walletTransactions` | All credits and debits. Each doc has `userId`, `type`, `amount`, `orderId`, `source`, `idempotencyKey`, timestamps. |
| `walletCheckouts` | Temporary record for partial-wallet Razorpay orders. Stores `walletAmount` so the verify route can deduct the correct amount after Razorpay captures. |

### Transaction Types (`WalletTransactionType`)
| Type | When |
|---|---|
| `refund_credit` | Admin issues a refund-to-wallet |
| `checkout_debit` | Wallet balance used at checkout |
| `withdrawal_paid` | Withdrawal processed (future) |
| `withdrawal_released` | Withdrawal released (future) |

---

## Credit Flow (Admin → Customer Wallet)

1. **Admin issues refund-to-wallet** via the admin orders panel.
2. `app/api/admin/orders/refund-to-wallet/route.ts` — validates the order belongs to the user and calls `creditWallet()`.
3. `lib/appwrite/wallet-server.ts` → `creditWallet()` — Firestore transaction: adds `amount` to `wallets/{userId}.balance`, writes a `refund_credit` row in `walletTransactions`.

---

## Checkout Debit Flows

### Zero-Pay (Wallet Covers Entire Order)

```
Customer ticks "Use Wallet" → total ≤ wallet balance → Razorpay skipped entirely

POST /api/payments/razorpay/create-order
  ↳ reads live balance (getWalletBalance)
  ↳ chargeAmount = 0
  ↳ creates order as status:"placed", paymentStatus:"paid"
  ↳ creates payment doc (provider:"wallet")
  ↳ deductWalletForCheckout()
  ↳ runPostPaymentActions() — stock, coupon, email, notification
  ↳ returns { zeroPay: true, internalOrderId, orderNumber, summary }

Client (cart-page-client.tsx):
  ↳ detects zeroPay response
  ↳ clears cart, shows OrderSuccessScreen — no Razorpay modal
```

### Partial-Wallet (Razorpay + Wallet)

```
Customer ticks "Use Wallet" → total > wallet balance → Razorpay charged the remainder

POST /api/payments/razorpay/create-order
  ↳ walletDiscount = min(balance, total)
  ↳ chargeAmount = total - walletDiscount  (charged via Razorpay)
  ↳ creates order (status:"initiated")
  ↳ setWalletCheckout(orderId, { userId, walletAmount, createdAt })
  ↳ creates Razorpay order for chargeAmount
  ↳ returns razorpayOrderId, keyId, summary.walletDiscount

Client opens Razorpay modal → payment captured

POST /api/payments/razorpay/verify
  ↳ getWalletCheckout(orderId) → walletAmountRs
  ↳ expectedAmount = toPaise(totalAmount - walletAmountRs)  ← adjusts for wallet
  ↳ signature + amount verified
  ↳ reconcileCapturedPayment() → marks payment "paid"
  ↳ deductWalletForCheckout()  ← idempotent, safe to retry
  ↳ runPostPaymentActions() — stock, coupon, email, notification
```

---

## Idempotency

`deductWalletForCheckout()` (in `lib/appwrite/wallet-server.ts`) checks for an existing `checkout_debit` transaction with the same `orderId` before debiting. This prevents double-deductions if the verify endpoint is called more than once.

---

## File Reference

| File | Role |
|---|---|
| `lib/appwrite/wallet-server.ts` | Core wallet logic — `getWalletBalance`, `creditWallet`, `deductWalletForCheckout`, `getWalletSummary` |
| `lib/firebase/wallet-checkouts.ts` | `setWalletCheckout` / `getWalletCheckout` — persists partial-wallet amount for verify route |
| `app/api/payments/razorpay/create-order/route.ts` | Checkout entrypoint — zero-pay path, partial-wallet Razorpay path |
| `app/api/payments/razorpay/verify/route.ts` | Post-payment verification — deducts wallet after Razorpay capture |
| `app/api/admin/orders/refund-to-wallet/route.ts` | Admin action — issues refund credit to customer wallet |
| `app/api/account/wallet/route.ts` | Customer-facing — returns wallet balance and transaction history |
| `app/components/wallet-details-modal.tsx` | Customer UI — shows balance, transaction history (credit/debit/checkout) |
| `app/components/cart-page-client.tsx` | Cart/checkout UI — wallet toggle, discount line, zero-pay button label |

---

## Customer Dashboard Display

`app/components/wallet-details-modal.tsx` shows each transaction with:
- `refund_credit` → green badge, "Refund credited", `+₹amount`
- `checkout_debit` → blue badge, "Used at checkout", `-₹amount`
- `withdrawal_paid` / `withdrawal_released` → purple/gray badges

The balance displayed (`getWalletBalance`) is the live Firestore balance from `wallets/{userId}.balance`.
