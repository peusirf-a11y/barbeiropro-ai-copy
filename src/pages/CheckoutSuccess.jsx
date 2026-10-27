import PostCheckoutAccessCard, { PostCheckoutPageShell } from '@/components/onboarding/PostCheckoutAccessCard';

const PLAN_LABELS = {
  classico: 'Clássico',
  master: 'Master',
  exclusivo: 'Exclusivo',
  starter: 'Starter',
  pro: 'Master',
  enterprise: 'Enterprise',
};

export default function CheckoutSuccess() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const email = params.get('email') || '';
  const planKey = (params.get('plano') || params.get('plan') || 'master').toLowerCase();
  const planName = PLAN_LABELS[planKey] || 'Master';

  return (
    <PostCheckoutPageShell>
      <PostCheckoutAccessCard email={email} planName={planName} />
    </PostCheckoutPageShell>
  );
}