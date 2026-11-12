// Public config for the browser. The publishable key is meant to be public:
// it can only do what the project's settings allow anonymous visitors to do.
// Never put a secret / service_role key here.
export const SUPABASE_URL = 'https://equfmjzxtutugdtoxwnr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1KVrubtP-pepQlrZTs_y6g_SAOO6eMl';

// Featured jobs. In Stripe: Payment Links → New, a one-time $199 product, then paste its
// https://buy.stripe.com/… address here. Empty = the employer page shows a notify-me form.
// The page adds ?client_reference_id=<job slug> so each payment says which job it's for.
export const FEATURED_PAYMENT_LINK = '';
export const FEATURED_PRICE = '$199';
export const FEATURED_DAYS = 30;
