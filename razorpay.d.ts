type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  retry?: {
    enabled?: boolean;
    max_count?: number;
  };
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    escape?: boolean;
    backdropclose?: boolean;
  };
  handler?: (response: RazorpayCheckoutResponse) => void | Promise<void>;
};

type RazorpayCheckoutInstance = {
  open: () => void;
};

type RazorpayCheckoutConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;

interface Window {
  Razorpay?: RazorpayCheckoutConstructor;
}
