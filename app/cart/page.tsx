export default function CartPage() {
  const cartItems = [
    {
      id: "item-1",
      name: "Indo-Western Drape Set",
      size: "M",
      color: "Ruby Wine",
      qty: 1,
      mrp: 3299,
      price: 2499,
    },
    {
      id: "item-2",
      name: "Handloom Panel Kurti",
      size: "L",
      color: "Ivory",
      qty: 2,
      mrp: 1899,
      price: 1499,
    },
  ];

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const originalTotal = cartItems.reduce((sum, item) => sum + item.mrp * item.qty, 0);
  const discount = originalTotal - subtotal;
  const delivery = subtotal > 2999 ? 0 : 99;
  const total = subtotal + delivery;

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 pt-6 text-primary sm:px-6 md:px-10 md:pb-16 md:pt-30">
      <section className="mx-auto w-full max-w-6xl">
        <header className="border-b border-primary/15 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Checkout</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Cart</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary/82 sm:text-base">
            Review items, apply coupon, and proceed with secure checkout.
          </p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-4">
            {cartItems.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-primary/15 bg-secondary p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold sm:text-lg">{item.name}</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/65">
                      Size {item.size} • {item.color}
                    </p>
                    <p className="mt-2 text-sm text-primary/75">Qty {item.qty}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-semibold">Rs. {item.price * item.qty}</p>
                    <p className="text-sm text-primary/55 line-through">Rs. {item.mrp * item.qty}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="rounded-2xl border border-primary/15 bg-secondary p-4 sm:p-5 lg:sticky lg:top-28">
            <h3 className="text-lg font-semibold">Amount Breakup</h3>

            <label className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/65">Discount Coupon</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Coupon code"
                  placeholder="Enter code"
                  className="h-11 flex-1 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none transition focus:border-primary"
                />
                <button
                  type="button"
                  aria-label="Apply coupon"
                  className="h-11 rounded-xl border border-primary/20 bg-paper px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/40"
                >
                  Apply
                </button>
              </div>
            </label>

            <div className="mt-5 space-y-2.5 border-t border-primary/12 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-primary/75">Subtotal</span>
                <span>Rs. {subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-primary/75">Discount</span>
                <span className="text-green-700">- Rs. {discount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-primary/75">Delivery</span>
                <span>{delivery === 0 ? "Free" : `Rs. ${delivery}`}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-primary/12 pt-4">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-semibold">Rs. {total}</span>
            </div>

            <button
              type="button"
              aria-label="Proceed to buy"
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
            >
              Proceed to Buy
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
