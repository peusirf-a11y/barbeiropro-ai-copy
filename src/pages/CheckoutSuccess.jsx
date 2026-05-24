import PostCheckoutAccessCard, { PostCheckoutPageShell } from '@/components/onboarding/PostCheckoutAccessCard';

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

export default function CheckoutSuccess() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const email = params.get('email') || '';
  const planKey = params.get('plano') || '';
  const planName = PLAN_LABELS[planKey] || null;

  return (
    <PostCheckoutPageShell>
      <PostCheckoutAccessCard email={email} planName={planName} />
    </PostCheckoutPageShell>
  );
}