import { Link, Navigate } from 'react-router-dom';
import { Scissors, Calendar, Users, TrendingUp, Star, ArrowRight, CheckCircle, Zap, BarChart2, MessageSquare, Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/AuthContext';

export default function LandingPage() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();

  // Usuário já logado: super admin → /master, demais → /app/dashboard.
  // Evita ficar preso na landing após login.
  if (!isLoadingAuth && isAuthenticated && user) {
    if (user.is_super_admin) return <Navigate to="/master" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#2563EB] backdrop-blur border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={36} />
            <span className="font-bold text-lg text-white tracking-wide">O CORTE</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/demo/dashboard" className="hidden sm:block">
              <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white hover:text-[#2563EB] transition-all">
                Ver Demo
              </Button>
            </Link>
            <Link to="/checkout">
              <Button className="bg-white text-[#2563EB] hover:bg-white/90 font-bold">
                Começar agora
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-[#60A5FA]/15 text-[#2563EB] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3 h-3" />
              Parte do ecossistema TurboSaaS
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-[#1B1C1E] leading-tight mb-6">
              O sistema completo<br />
              para <span className="bg-gradient-to-r from-[#2563EB] to-[#60A5FA] bg-clip-text text-transparent">barbearias</span><br />
              que crescem.
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mb-10 leading-relaxed">
              Agenda online, gestão de clientes, controle financeiro, equipe, relatórios e IA de crescimento — tudo em uma plataforma feita especialmente para barbearias e estúdios masculinos premium.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/checkout">
                <Button size="lg" className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-8 py-4 text-base font-semibold rounded-lg h-auto">
                  Começar agora — 7 dias grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/demo/dashboard">
                <Button size="lg" variant="outline" className="border-black/20 text-gray-700 px-8 py-4 text-base font-medium rounded-lg h-auto hover:border-[#2563EB] hover:text-[#2563EB]">
                  Ver demo gratuita
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-gradient-to-r from-[#2563EB] to-[#60A5FA]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '2.400+', label: 'Barbearias ativas' },
            { value: '180k+', label: 'Agendamentos/mês' },
            { value: '98%', label: 'Taxa de retenção' },
            { value: '4.9★', label: 'Avaliação média' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl md:text-4xl font-black text-white mb-1">{s.value}</div>
              <div className="text-sm text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-[#1B1C1E] mb-4">Tudo que sua barbearia precisa</h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">Uma plataforma completa para operar e crescer. Sem complicação.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Calendar, title: 'Agenda Inteligente', desc: 'Visualização por dia, semana ou profissional. Arraste, edite, confirme e acompanhe em tempo real.', color: 'bg-blue-50 text-blue-700' },
              { icon: Users, title: 'Gestão de Clientes', desc: 'Histórico completo, frequência, ticket médio, tags automáticas e segmentação por comportamento.', color: 'bg-green-50 text-green-700' },
              { icon: Globe, title: 'Link Público de Agendamento', desc: 'Cada barbearia recebe seu link único. Cliente agenda 24/7 sem precisar ligar.', color: 'bg-purple-50 text-purple-700' },
              { icon: TrendingUp, title: 'Financeiro Simplificado', desc: 'Faturamento, ticket médio, entradas e saídas. Visão clara do dinheiro da operação.', color: 'bg-orange-50 text-orange-700' },
              { icon: BarChart2, title: 'Relatórios Completos', desc: 'Serviços mais vendidos, profissionais mais ativos, horários de pico e tendências.', color: 'bg-pink-50 text-pink-700' },
              { icon: Zap, title: 'AI Growth Engine', desc: 'IA detecta clientes inativos, horários fracos e gera mensagens prontas para reativação.', color: 'bg-yellow-50 text-yellow-700' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-black/8 p-8 hover:shadow-lg transition-all hover:-translate-y-0.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1B1C1E] mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-[#1B1C1E] mb-4">Como funciona</h2>
            <p className="text-gray-500 text-lg">Em minutos, sua barbearia está operando com O CORTE</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Cadastre sua barbearia', desc: 'Configure nome, logo, serviços e profissionais em minutos.' },
              { step: '02', title: 'Personalize seu link', desc: 'Seu link público fica disponível em /agendar/suabarbearia' },
              { step: '03', title: 'Clientes agendam online', desc: 'Sem ligação, sem app. Cliente acessa, escolhe e agenda.' },
              { step: '04', title: 'Gerencie e cresça', desc: 'Painel completo para operar, com IA orientando o crescimento.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 bg-[#2563EB] text-white rounded-2xl flex items-center justify-center text-2xl font-black mx-auto mb-5">
                  {s.step}
                </div>
                <h3 className="font-bold text-[#1B1C1E] mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Growth */}
      <section className="py-24 px-6 bg-[#F8F7F3]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#60A5FA]/15 text-[#2563EB] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3 h-3" />
              AI Growth Engine
            </div>
            <h2 className="text-4xl font-black text-[#1B1C1E] mb-6">IA que trabalha enquanto você corta</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">O sistema analisa automaticamente seus clientes, identifica quem está sumindo, detecta padrões de frequência e gera mensagens prontas para você enviar no WhatsApp e trazer de volta.</p>
            <div className="space-y-3">
              {['Detecção de clientes inativos', 'Análise de horários fracos', 'Mensagens prontas para reativação', 'Insights de serviços com baixa demanda'].map(f => (
                <div key={f} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <CheckCircle className="w-5 h-5 text-[#2563EB] flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link to="/demo/ai-growth">
                <Button className="bg-[#2563EB] text-white hover:bg-[#2563EB]/90">
                  Ver AI Growth na Demo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

            </div>
          </div>
          <div className="bg-white rounded-2xl border border-black/10 p-8 space-y-4">
            {[
              { title: '12 clientes inativos detectados', sub: 'Última visita há +30 dias. Mensagem pronta para enviar.', badge: 'Reativar', color: 'bg-[#60A5FA]/15 text-[#2563EB]' },
              { title: 'Segunda-feira às 14h está vazia', sub: 'Horário com 0 agendamentos nas últimas 4 semanas.', badge: 'Oportunidade', color: 'bg-[#60A5FA]/15 text-[#2563EB]' },
              { title: '8 clientes VIP sem retorno', sub: 'Clientes que gastaram +R$500 não voltam há 21 dias.', badge: 'VIP', color: 'bg-[#2563EB] text-white' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4 p-4 bg-[#F8F7F3] rounded-xl">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-[#1B1C1E] mb-1">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.sub}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${item.color}`}>{item.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1B1C1E] mb-4">Planos simples e claros</h2>
            <p className="text-gray-500">Comece grátis. Cresça com o plano certo para sua operação.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: 'R$97', per: '/mês', desc: 'Para barbearias que estão começando', features: ['Até 2 profissionais', 'Agenda online', 'Link público', 'Gestão de clientes', 'Financeiro básico'] },
              { name: 'Pro', price: 'R$197', per: '/mês', desc: 'Para barbearias em crescimento', features: ['Até 8 profissionais', 'Tudo do Starter', 'AI Growth Engine', 'Relatórios avançados', 'Suporte prioritário'], highlight: true },
              { name: 'Enterprise', price: 'R$397', per: '/mês', desc: 'Para redes e estúdios premium', features: ['Profissionais ilimitados', 'Tudo do Pro', 'White-label total', 'Multi-unidade', 'Onboarding dedicado'] },
            ].map(p => (
              <div key={p.name} className={`rounded-2xl p-8 border ${p.highlight ? 'bg-gradient-to-br from-[#2563EB] to-[#60A5FA] border-[#2563EB]' : 'bg-white border-black/10'}`}>
                <div className={`text-sm font-semibold mb-2 ${p.highlight ? 'text-white/70' : 'text-gray-500'}`}>{p.name}</div>
                <div className={`text-4xl font-black mb-1 ${p.highlight ? 'text-white' : 'text-[#1B1C1E]'}`}>{p.price}<span className={`text-lg font-normal ${p.highlight ? 'text-white/60' : 'text-gray-400'}`}>{p.per}</span></div>
                <div className={`text-sm mb-8 ${p.highlight ? 'text-white/70' : 'text-gray-500'}`}>{p.desc}</div>
                <div className="space-y-3 mb-8">
                  {p.features.map(f => (
                    <div key={f} className={`flex items-center gap-2 text-sm ${p.highlight ? 'text-white/90' : 'text-gray-600'}`}>
                      <CheckCircle className={`w-4 h-4 ${p.highlight ? 'text-white' : 'text-[#2563EB]'}`} />
                      {f}
                    </div>
                  ))}
                </div>
                <Link to={`/checkout?plano=${p.name.toLowerCase()}`} className="block">
                  <Button className={`w-full ${p.highlight ? 'bg-white text-[#2563EB] hover:bg-white/90' : 'bg-[#2563EB] text-white hover:bg-[#2563EB]/90'}`}>
                    Começar agora
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-gradient-to-r from-[#2563EB] to-[#60A5FA]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Pronto para transformar sua barbearia?</h2>
          <p className="text-white/80 text-lg mb-10">Explore a demo completa e veja como O CORTE funciona na prática.</p>
          <Link to="/checkout">
            <Button size="lg" className="bg-white text-[#2563EB] hover:bg-white/90 px-10 py-4 text-base font-bold h-auto">
              Começar agora — 7 dias grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#111418]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-white tracking-wide">O CORTE</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/termos-de-uso" className="text-white/50 hover:text-white">Termos</Link>
            <Link to="/politica-de-privacidade" className="text-white/50 hover:text-white">Privacidade</Link>
            <span className="text-white/40">© 2026 O CORTE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}