// Public config for the browser. The publishable key is meant to be public:
// it can only do what the project's settings allow anonymous visitors to do.
// Never put a secret / service_role key here.
export const SUPABASE_URL = 'https://equfmjzxtutugdtoxwnr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1KVrubtP-pepQlrZTs_y6g_SAOO6eMl';

// Featured jobs. Create a one-time product in Polar, then a Checkout Link for it, and paste
// the link here. Empty = the employer page shows a notify-me form instead.
// The page adds ?reference_id=<job slug>, which Polar saves on the order's metadata, so each
// payment says which job it's for. (A Stripe Payment Link works too: it uses client_reference_id.)
export const FEATURED_PAYMENT_LINK = '';
export const FEATURED_PRICE = '$199';
export const FEATURED_DAYS = 30;
