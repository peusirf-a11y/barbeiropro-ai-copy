/**
 * seedTestData — Popula dados de teste realistas para "O Corte / Vintage"
 * 
 * Execução em fases para evitar rate limit.
 * Fase passada via payload: { phase: 1..7 }
 * 
 * Fase 1: Unidades
 * Fase 2: Profissionais + Serviços + Categorias
 * Fase 3: Clientes (80)
 * Fase 4: Agendamentos + FinancialEntries (batch 1 - passado)
 * Fase 5: Agendamentos + FinancialEntries (batch 2 - recente)
 * Fase 6: Caixas + Comissões + Reviews
 * Fase 7: Assinaturas + WhatsApp + CustomerPlans
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const COMPANY_ID = '69f0c9df92e7ccb302c43542';

// Helper: delay para evitar rate limit entre batches
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: data ISO relativa
function daysAgo(n, hour = 10, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function dateOnly(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (user.email !== 'pedrojesantos@hotmail.com' && !user.is_super_admin) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const phase = parseInt(body?.phase) || 1;
    const sdk = base44.asServiceRole;

    // ════════════════════════════════════════════
    // FASE 1 — Unidades
    // ════════════════════════════════════════════
    if (phase === 1) {
      // Verificar se já existem unidades
      const existing = await sdk.entities.Unit.filter({ company_id: COMPANY_ID });
      
      const created = [];
      const unit1Data = {
        company_id: COMPANY_ID,
        name: 'Matriz Centro',
        address: 'Rua do Comércio, 250 - Centro, Santos/SP',
        phone: '13996466910',
        whatsapp: '13996466910',
        active: true,
        is_default: true,
        sort_order: 1,
        business_hours: {
          seg: { open: '08:00', close: '19:00', active: true },
          ter: { open: '08:00', close: '19:00', active: true },
          qua: { open: '08:00', close: '19:00', active: true },
          qui: { open: '08:00', close: '19:00', active: true },
          sex: { open: '08:00', close: '20:00', active: true },
          sab: { open: '08:00', close: '18:00', active: true },
          dom: { open: '09:00', close: '14:00', active: false },
        }
      };
      const unit2Data = {
        company_id: COMPANY_ID,
        name: 'Filial Praia Grande',
        address: 'Av. Presidente Kennedy, 1100 - Ocian, Praia Grande/SP',
        phone: '13991234567',
        whatsapp: '13991234567',
        active: true,
        is_default: false,
        sort_order: 2,
        business_hours: {
          seg: { open: '09:00', close: '18:00', active: true },
          ter: { open: '09:00', close: '18:00', active: true },
          qua: { open: '09:00', close: '18:00', active: true },
          qui: { open: '09:00', close: '18:00', active: true },
          sex: { open: '09:00', close: '19:00', active: true },
          sab: { open: '08:00', close: '18:00', active: true },
          dom: { open: '09:00', close: '14:00', active: false },
        }
      };

      // Só criar se não existir unidade com esse nome
      const hasMatriz = existing.some(u => u.name === 'Matriz Centro');
      const hasPG = existing.some(u => u.name === 'Filial Praia Grande');

      let unit1 = existing.find(u => u.name === 'Matriz Centro');
      let unit2 = existing.find(u => u.name === 'Filial Praia Grande');

      if (!hasMatriz) {
        unit1 = await sdk.entities.Unit.create(unit1Data);
        created.push('Unidade Matriz Centro criada');
      } else {
        created.push('Matriz Centro já existia');
      }

      await sleep(300);

      if (!hasPG) {
        unit2 = await sdk.entities.Unit.create(unit2Data);
        created.push('Unidade Filial Praia Grande criada');
      } else {
        created.push('Filial Praia Grande já existia');
      }

      return Response.json({ 
        phase: 1, 
        done: true, 
        created,
        unit1_id: unit1?.id,
        unit2_id: unit2?.id,
      });
    }

    // ════════════════════════════════════════════
    // FASE 2 — Categorias + Serviços + Profissionais
    // ════════════════════════════════════════════
    if (phase === 2) {
      const { unit1_id, unit2_id } = body;
      if (!unit1_id || !unit2_id) return Response.json({ error: 'Informe unit1_id e unit2_id' }, { status: 400 });

      const created = [];

      // Categorias
      const existingCats = await sdk.entities.ServiceCategory.filter({ company_id: COMPANY_ID });
      let catCorte = existingCats.find(c => c.name === 'Cortes');
      let catBarba = existingCats.find(c => c.name === 'Barba & Estética');
      let catTratamento = existingCats.find(c => c.name === 'Tratamentos');

      if (!catCorte) {
        catCorte = await sdk.entities.ServiceCategory.create({ company_id: COMPANY_ID, name: 'Cortes', sort_order: 1, active: true });
        created.push('Cat Cortes');
      }
      await sleep(200);
      if (!catBarba) {
        catBarba = await sdk.entities.ServiceCategory.create({ company_id: COMPANY_ID, name: 'Barba & Estética', sort_order: 2, active: true });
        created.push('Cat Barba');
      }
      await sleep(200);
      if (!catTratamento) {
        catTratamento = await sdk.entities.ServiceCategory.create({ company_id: COMPANY_ID, name: 'Tratamentos', sort_order: 3, active: true });
        created.push('Cat Tratamentos');
      }
      await sleep(300);

      // Serviços
      const existingServices = await sdk.entities.Service.filter({ company_id: COMPANY_ID });
      const serviceNames = existingServices.map(s => s.name);

      const servicesToCreate = [
        { name: 'Corte Masculino', category_id: catCorte.id, duration_minutes: 30, price: 45, active: true, featured: true },
        { name: 'Corte + Barba', category_id: catCorte.id, duration_minutes: 60, price: 75, active: true, featured: true },
        { name: 'Barba Completa', category_id: catBarba.id, duration_minutes: 30, price: 35, active: true, featured: false },
        { name: 'Sobrancelha', category_id: catBarba.id, duration_minutes: 15, price: 20, active: true, featured: false },
        { name: 'Corte Infantil', category_id: catCorte.id, duration_minutes: 25, price: 35, active: true, featured: false },
        { name: 'Corte + Barba + Sobrancelha', category_id: catCorte.id, duration_minutes: 75, price: 90, active: true, featured: false },
        { name: 'Hidratação Capilar', category_id: catTratamento.id, duration_minutes: 45, price: 60, active: true, featured: false },
        { name: 'Platinado / Descolorido', category_id: catTratamento.id, duration_minutes: 120, price: 150, active: true, featured: false },
        { name: 'Pigmentação', category_id: catTratamento.id, duration_minutes: 60, price: 80, active: true, featured: false },
      ];

      const createdServices = [...existingServices];
      for (const svc of servicesToCreate) {
        if (!serviceNames.includes(svc.name)) {
          const s = await sdk.entities.Service.create({ company_id: COMPANY_ID, ...svc });
          createdServices.push(s);
          created.push(`Serviço: ${svc.name}`);
          await sleep(150);
        }
      }

      // Profissionais
      const existingPros = await sdk.entities.Professional.filter({ company_id: COMPANY_ID });
      const proNames = existingPros.map(p => p.name);
      const allServiceIds = createdServices.filter(s => s.active !== false).map(s => s.id);

      const prosToCreate = [
        // Matriz
        { name: 'João Corte', specialty: 'Cortes Clássicos', active: true, unit_ids: [unit1_id], commission_type: 'percent', commission_value: 40 },
        { name: 'Rafael Fade', specialty: 'Fade & Degradê', active: true, unit_ids: [unit1_id], commission_type: 'percent', commission_value: 45 },
        { name: 'Bruno Navalha', specialty: 'Barba & Navalha', active: true, unit_ids: [unit1_id], commission_type: 'percent', commission_value: 40 },
        // Praia Grande
        { name: 'Lucas Barber', specialty: 'Cortes Modernos', active: true, unit_ids: [unit2_id], commission_type: 'percent', commission_value: 40 },
        { name: 'Felipe Degradê', specialty: 'Degradê & Low Fade', active: true, unit_ids: [unit2_id], commission_type: 'percent', commission_value: 42 },
        { name: 'Caio Tesoura', specialty: 'Corte Social & Infantil', active: true, unit_ids: [unit2_id], commission_type: 'fixed', commission_value: 15 },
      ];

      const createdPros = [...existingPros];
      for (const pro of prosToCreate) {
        if (!proNames.includes(pro.name)) {
          const p = await sdk.entities.Professional.create({
            company_id: COMPANY_ID,
            service_ids: allServiceIds,
            work_schedule: {
              seg: { start: '08:00', end: '18:00', active: true },
              ter: { start: '08:00', end: '18:00', active: true },
              qua: { start: '08:00', end: '18:00', active: true },
              qui: { start: '08:00', end: '18:00', active: true },
              sex: { start: '08:00', end: '19:00', active: true },
              sab: { start: '08:00', end: '17:00', active: true },
              dom: { start: '09:00', end: '13:00', active: false },
            },
            ...pro,
          });
          createdPros.push(p);
          created.push(`Profissional: ${pro.name}`);
          await sleep(200);
        }
      }

      return Response.json({ 
        phase: 2, done: true, created,
        service_ids: createdServices.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration_minutes })),
        pro_ids: createdPros.map(p => ({ id: p.id, name: p.name, unit_ids: p.unit_ids, commission_type: p.commission_type, commission_value: p.commission_value })),
      });
    }

    // ════════════════════════════════════════════
    // FASE 3 — Clientes (80)
    // ════════════════════════════════════════════
    if (phase === 3) {
      const { unit1_id, unit2_id } = body;
      if (!unit1_id || !unit2_id) return Response.json({ error: 'Informe unit1_id e unit2_id' }, { status: 400 });

      const existingCustomers = await sdk.entities.Customer.filter({ company_id: COMPANY_ID });
      const existingPhones = new Set(existingCustomers.map(c => c.phone));

      const nomes = [
        'André Oliveira','Carlos Mendes','Diego Ferreira','Eduardo Lima','Fábio Santos',
        'Gabriel Costa','Henrique Souza','Igor Alves','Jorge Rocha','Kleber Martins',
        'Leonardo Nunes','Marcelo Araújo','Nicolas Pereira','Otávio Silva','Paulo Batista',
        'Rafael Moreira','Samuel Nascimento','Thiago Gomes','Vitor Barbosa','William Cardoso',
        'Alexandre Torres','Bernardo Ramos','Cristiano Melo','Danilo Freitas','Emerson Ribeiro',
        'Fabiano Costa','Gustavo Lopes','Hélio Pinto','Ivan Carvalho','José Correia',
        'Leandro Teixeira','Márcio Fonseca','Nathan Borges','Orlando Campos','Pedro Andrade',
        'Quintino Rezende','Rodrigo Cunha','Sandro Vieira','Tiago Medeiros','Ugo Fernandes',
        'Valdir Nogueira','Xavier Castro','Yago Macedo','Zé Roberto Pires','Adriano Queiroz',
        'Breno Salazar','César Duarte','Denis Monteiro','Evandro Moura','Felipe Coelho',
        'Guilherme Pacheco','Humberto Dias','Ivã Azevedo','João Vitor Bastos','Kevin Lima',
        'Luís Otávio Matos','Murilo Farias','Nilton Soares','Omar Tavares','Plínio Brito',
        'Renato Guimarães','Sérgio Lacerda','Túlio Brandão','Ulisses Vaz','Vagner Rangel',
        'Washington Paiva','Alex Moreira','Bruno Coutinho','Caio Monteiro','David Leite',
        'Erick Zanetti','Fernando Vidal','Geraldo Neto','Hermes Caldas','Isaac Menezes',
        'Josué Barros','Lino Rodrigues','Marcos Chaves','Naldo Severo','Osiris Falcão',
      ];

      const created = [];
      let idx = 0;

      for (const nome of nomes) {
        const phoneBase = `1399${String(6000000 + idx).padStart(7,'0')}`;
        if (existingPhones.has(phoneBase)) { idx++; continue; }

        // Distribuição: 50% Matriz, 50% Filial
        const unit_id = idx % 2 === 0 ? unit1_id : unit2_id;
        
        // Lifecycle: 0-49 ativos frequentes, 50-69 ocasionais, 70-79 inativos
        let lifecycle_status, last_completed;
        if (idx < 50) {
          lifecycle_status = idx < 10 ? 'fiel' : 'primeira_visita';
          last_completed = daysAgo(randomInt(1, 20));
        } else if (idx < 70) {
          lifecycle_status = 'em_risco';
          last_completed = daysAgo(randomInt(25, 45));
        } else {
          lifecycle_status = 'inativo';
          last_completed = daysAgo(randomInt(60, 120));
        }

        const status = idx < 5 ? 'vip' : 'active';
        const total = lifecycle_status === 'fiel' ? randomInt(8, 25) : lifecycle_status === 'primeira_visita' ? randomInt(1, 4) : randomInt(0, 3);

        await sdk.entities.Customer.create({
          company_id: COMPANY_ID,
          unit_id,
          name: nome,
          phone: phoneBase,
          email: `${nome.toLowerCase().replace(/ /g, '.').normalize('NFD').replace(/[^\x00-\x7F]/g, '')}@email.com`,
          status,
          lifecycle_status,
          last_completed_at: last_completed,
          last_appointment_at: last_completed,
          total_appointments: total,
          lifecycle_updated_at: new Date().toISOString(),
        });

        created.push(nome);
        idx++;
        await sleep(80);
      }

      return Response.json({ phase: 3, done: true, created_count: created.length, skipped: nomes.length - created.length });
    }

    // ════════════════════════════════════════════
    // FASE 4 — Agendamentos históricos (dias 60-31)
    // ════════════════════════════════════════════
    if (phase === 4) {
      const { unit1_id, unit2_id, pro_ids, service_ids } = body;
      if (!pro_ids || !service_ids) return Response.json({ error: 'Informe pro_ids e service_ids' }, { status: 400 });

      const customers = await sdk.entities.Customer.filter({ company_id: COMPANY_ID });
      const u1Customers = customers.filter(c => c.unit_id === unit1_id);
      const u2Customers = customers.filter(c => c.unit_id === unit2_id);

      const u1Pros = pro_ids.filter(p => p.unit_ids?.includes(unit1_id));
      const u2Pros = pro_ids.filter(p => p.unit_ids?.includes(unit2_id));

      const svcs = service_ids.filter(s => s.price <= 90);
      const created = [];

      // Slots de horário
      const slots = ['08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

      // Gerar 200 agendamentos para dias 60-31
      for (let dayAgo = 60; dayAgo >= 31; dayAgo--) {
        const dayOfWeek = new Date(Date.now() - dayAgo * 86400000).getDay();
        if (dayOfWeek === 0) continue; // pula domingo

        // 3-5 agendamentos por dia por unidade
        const countU1 = randomInt(2, 5);
        const countU2 = randomInt(2, 4);

        for (let i = 0; i < countU1 && u1Customers.length > 0 && u1Pros.length > 0; i++) {
          const customer = randomItem(u1Customers);
          const pro = randomItem(u1Pros);
          const svc = randomItem(svcs);
          const slot = slots[randomInt(0, slots.length - 1)];
          const [h, m] = slot.split(':');
          const apptDate = new Date(Date.now() - dayAgo * 86400000);
          apptDate.setHours(parseInt(h), parseInt(m), 0, 0);

          // 80% concluídos no passado
          const statuses = ['concluido','concluido','concluido','concluido','concluido','concluido','concluido','concluido','cancelado','faltou'];
          const status = statuses[randomInt(0, statuses.length - 1)];
          const paymentMethods = ['dinheiro','pix','cartao_credito','cartao_debito'];
          const pm = randomItem(paymentMethods);

          const appt = await sdk.entities.Appointment.create({
            company_id: COMPANY_ID,
            unit_id: unit1_id,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            professional_id: pro.id,
            professional_name: pro.name,
            service_id: svc.id,
            service_name: svc.name,
            scheduled_at: apptDate.toISOString(),
            status,
            price: svc.price,
            source: 'interno',
            payment_method: 'avulso',
            paid: status === 'concluido',
            completed_at: status === 'concluido' ? apptDate.toISOString() : undefined,
            commission_created: status === 'concluido',
          });

          // FinancialEntry para concluídos
          if (status === 'concluido') {
            await sdk.entities.FinancialEntry.create({
              company_id: COMPANY_ID,
              unit_id: unit1_id,
              professional_id: pro.id,
              customer_id: customer.id,
              type: 'entrada',
              entry_kind: 'entrada',
              origin: 'agendamento',
              payment_method: pm,
              description: `${svc.name} - ${customer.name}`,
              amount: svc.price,
              date: dateOnly(dayAgo),
              status: 'confirmado',
              reference_appointment_id: appt.id,
              is_locked: true,
            });

            // Comissão
            const commValue = pro.commission_type === 'percent' ? (svc.price * pro.commission_value / 100) : pro.commission_value;
            await sdk.entities.Commission.create({
              company_id: COMPANY_ID,
              professional_id: pro.id,
              professional_name: pro.name,
              appointment_id: appt.id,
              service_name: svc.name,
              service_price: svc.price,
              commission_type: pro.commission_type,
              commission_value: pro.commission_value,
              amount: Math.round(commValue * 100) / 100,
              earned_at: apptDate.toISOString(),
              status: dayAgo > 14 ? 'pago' : 'pendente',
            });
          }

          created.push(`U1 dia-${dayAgo} ${status}`);
          await sleep(60);
        }

        for (let i = 0; i < countU2 && u2Customers.length > 0 && u2Pros.length > 0; i++) {
          const customer = randomItem(u2Customers);
          const pro = randomItem(u2Pros);
          const svc = randomItem(svcs);
          const slot = slots[randomInt(0, slots.length - 1)];
          const [h, m] = slot.split(':');
          const apptDate = new Date(Date.now() - dayAgo * 86400000);
          apptDate.setHours(parseInt(h), parseInt(m), 0, 0);
          const statuses = ['concluido','concluido','concluido','concluido','concluido','concluido','cancelado','faltou'];
          const status = statuses[randomInt(0, statuses.length - 1)];
          const pm = randomItem(['dinheiro','pix','cartao_credito','cartao_debito']);

          const appt = await sdk.entities.Appointment.create({
            company_id: COMPANY_ID,
            unit_id: unit2_id,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            professional_id: pro.id,
            professional_name: pro.name,
            service_id: svc.id,
            service_name: svc.name,
            scheduled_at: apptDate.toISOString(),
            status,
            price: svc.price,
            source: 'interno',
            payment_method: 'avulso',
            paid: status === 'concluido',
            completed_at: status === 'concluido' ? apptDate.toISOString() : undefined,
            commission_created: status === 'concluido',
          });

          if (status === 'concluido') {
            await sdk.entities.FinancialEntry.create({
              company_id: COMPANY_ID,
              unit_id: unit2_id,
              professional_id: pro.id,
              customer_id: customer.id,
              type: 'entrada',
              entry_kind: 'entrada',
              origin: 'agendamento',
              payment_method: pm,
              description: `${svc.name} - ${customer.name}`,
              amount: svc.price,
              date: dateOnly(dayAgo),
              status: 'confirmado',
              reference_appointment_id: appt.id,
              is_locked: true,
            });

            const commValue = pro.commission_type === 'percent' ? (svc.price * pro.commission_value / 100) : pro.commission_value;
            await sdk.entities.Commission.create({
              company_id: COMPANY_ID,
              professional_id: pro.id,
              professional_name: pro.name,
              appointment_id: appt.id,
              service_name: svc.name,
              service_price: svc.price,
              commission_type: pro.commission_type,
              commission_value: pro.commission_value,
              amount: Math.round(commValue * 100) / 100,
              earned_at: apptDate.toISOString(),
              status: dayAgo > 14 ? 'pago' : 'pendente',
            });
          }

          created.push(`U2 dia-${dayAgo} ${status}`);
          await sleep(60);
        }
      }

      return Response.json({ phase: 4, done: true, created_count: created.length });
    }

    // ════════════════════════════════════════════
    // FASE 5 — Agendamentos recentes (dias 30-0)
    // ════════════════════════════════════════════
    if (phase === 5) {
      const { unit1_id, unit2_id, pro_ids, service_ids } = body;
      if (!pro_ids || !service_ids) return Response.json({ error: 'Informe pro_ids e service_ids' }, { status: 400 });

      const customers = await sdk.entities.Customer.filter({ company_id: COMPANY_ID });
      const u1Customers = customers.filter(c => c.unit_id === unit1_id);
      const u2Customers = customers.filter(c => c.unit_id === unit2_id);
      const u1Pros = pro_ids.filter(p => p.unit_ids?.includes(unit1_id));
      const u2Pros = pro_ids.filter(p => p.unit_ids?.includes(unit2_id));
      const svcs = service_ids.filter(s => s.price <= 90);
      const created = [];

      const slots = ['08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

      for (let dayAgo = 30; dayAgo >= 0; dayAgo--) {
        const dayOfWeek = new Date(Date.now() - dayAgo * 86400000).getDay();
        if (dayOfWeek === 0) continue;

        // Sexta/Sábado tem mais movimento
        const isFriSat = dayOfWeek === 5 || dayOfWeek === 6;
        const countU1 = isFriSat ? randomInt(5, 8) : randomInt(3, 6);
        const countU2 = isFriSat ? randomInt(4, 7) : randomInt(2, 5);

        // Futuros: agendado/confirmado; passados: concluído/cancelado/faltou
        const isFuture = dayAgo === 0 ? false : dayAgo < 0;
        
        for (let i = 0; i < countU1 && u1Customers.length > 0 && u1Pros.length > 0; i++) {
          const customer = randomItem(u1Customers);
          const pro = randomItem(u1Pros);
          const svc = randomItem(svcs);
          const slot = slots[randomInt(0, slots.length - 1)];
          const [h, m] = slot.split(':');
          const apptDate = new Date(Date.now() - dayAgo * 86400000);
          apptDate.setHours(parseInt(h), parseInt(m), 0, 0);

          let status;
          if (dayAgo > 1) {
            const s = ['concluido','concluido','concluido','concluido','concluido','concluido','cancelado','faltou'];
            status = s[randomInt(0, s.length - 1)];
          } else if (dayAgo === 0 || dayAgo === 1) {
            status = randomItem(['agendado','confirmado','concluido']);
          } else {
            status = randomItem(['agendado','confirmado']);
          }

          const pm = randomItem(['dinheiro','pix','cartao_credito','cartao_debito']);

          const appt = await sdk.entities.Appointment.create({
            company_id: COMPANY_ID,
            unit_id: unit1_id,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            professional_id: pro.id,
            professional_name: pro.name,
            service_id: svc.id,
            service_name: svc.name,
            scheduled_at: apptDate.toISOString(),
            status,
            price: svc.price,
            source: dayAgo % 7 === 0 ? 'online' : 'interno',
            payment_method: 'avulso',
            paid: status === 'concluido',
            completed_at: status === 'concluido' ? apptDate.toISOString() : undefined,
            commission_created: status === 'concluido',
          });

          if (status === 'concluido') {
            await sdk.entities.FinancialEntry.create({
              company_id: COMPANY_ID, unit_id: unit1_id,
              professional_id: pro.id, customer_id: customer.id,
              type: 'entrada', entry_kind: 'entrada', origin: 'agendamento',
              payment_method: pm,
              description: `${svc.name} - ${customer.name}`,
              amount: svc.price, date: dateOnly(dayAgo),
              status: 'confirmado', reference_appointment_id: appt.id, is_locked: true,
            });

            const commValue = pro.commission_type === 'percent' ? (svc.price * pro.commission_value / 100) : pro.commission_value;
            await sdk.entities.Commission.create({
              company_id: COMPANY_ID, professional_id: pro.id,
              professional_name: pro.name, appointment_id: appt.id,
              service_name: svc.name, service_price: svc.price,
              commission_type: pro.commission_type, commission_value: pro.commission_value,
              amount: Math.round(commValue * 100) / 100,
              earned_at: apptDate.toISOString(), status: 'pendente',
            });

            // Review para ~40% dos concluídos recentes
            if (randomInt(1, 10) <= 4 && dayAgo > 0) {
              const ratings = [5,5,5,5,4,4,4,3,3,2];
              const rating = randomItem(ratings);
              const comments = [
                'Serviço excelente! Muito profissional.','Ótimo atendimento, voltarei sempre!',
                'Corte perfeito, recomendo a todos!','Ambiente agradável e atendimento rápido.',
                'Profissional muito habilidoso.','Bom serviço, dentro do esperado.',
                'Poderia melhorar um pouco o tempo de espera.','Serviço ok, mas já tive melhor.',
                'Não gostei muito do resultado desta vez.','Atendimento bem abaixo do esperado.',
              ];
              await sdk.entities.Review.create({
                company_id: COMPANY_ID,
                appointment_id: appt.id,
                customer_id: customer.id,
                customer_name: customer.name,
                professional_id: pro.id,
                professional_name: pro.name,
                service_name: svc.name,
                rating,
                nps_score: rating >= 5 ? randomInt(9,10) : rating >= 4 ? randomInt(7,8) : rating >= 3 ? randomInt(5,6) : randomInt(1,4),
                comment: comments[randomInt(0, comments.length - 1)],
                published: rating >= 3,
                status: 'submitted',
                source: 'whatsapp',
                submitted_at: apptDate.toISOString(),
              });
            }

            // WhatsApp confirmação
            await sdk.entities.WhatsAppMessage.create({
              company_id: COMPANY_ID, unit_id: unit1_id,
              customer_id: customer.id, appointment_id: appt.id,
              phone: customer.phone, customer_name: customer.name,
              type: 'pos_atendimento',
              message_text: `Valeu por colar na Vintage, ${customer.name}! 🔥 Se puder, deixa sua avaliação!`,
              status: 'enviado', sent_at: apptDate.toISOString(),
            });
          }

          created.push(`U1 dia-${dayAgo} ${status}`);
          await sleep(60);
        }

        // Unidade 2
        for (let i = 0; i < countU2 && u2Customers.length > 0 && u2Pros.length > 0; i++) {
          const customer = randomItem(u2Customers);
          const pro = randomItem(u2Pros);
          const svc = randomItem(svcs);
          const slot = slots[randomInt(0, slots.length - 1)];
          const [h, m] = slot.split(':');
          const apptDate = new Date(Date.now() - dayAgo * 86400000);
          apptDate.setHours(parseInt(h), parseInt(m), 0, 0);

          let status;
          if (dayAgo > 1) {
            const s = ['concluido','concluido','concluido','concluido','concluido','cancelado','faltou'];
            status = s[randomInt(0, s.length - 1)];
          } else {
            status = randomItem(['agendado','confirmado','concluido']);
          }
          const pm = randomItem(['dinheiro','pix','cartao_credito','cartao_debito']);

          const appt = await sdk.entities.Appointment.create({
            company_id: COMPANY_ID, unit_id: unit2_id,
            customer_id: customer.id, customer_name: customer.name,
            customer_phone: customer.phone, professional_id: pro.id,
            professional_name: pro.name, service_id: svc.id,
            service_name: svc.name, scheduled_at: apptDate.toISOString(),
            status, price: svc.price, source: 'interno',
            payment_method: 'avulso', paid: status === 'concluido',
            completed_at: status === 'concluido' ? apptDate.toISOString() : undefined,
            commission_created: status === 'concluido',
          });

          if (status === 'concluido') {
            await sdk.entities.FinancialEntry.create({
              company_id: COMPANY_ID, unit_id: unit2_id,
              professional_id: pro.id, customer_id: customer.id,
              type: 'entrada', entry_kind: 'entrada', origin: 'agendamento',
              payment_method: pm,
              description: `${svc.name} - ${customer.name}`,
              amount: svc.price, date: dateOnly(dayAgo),
              status: 'confirmado', reference_appointment_id: appt.id, is_locked: true,
            });

            const commValue = pro.commission_type === 'percent' ? (svc.price * pro.commission_value / 100) : pro.commission_value;
            await sdk.entities.Commission.create({
              company_id: COMPANY_ID, professional_id: pro.id,
              professional_name: pro.name, appointment_id: appt.id,
              service_name: svc.name, service_price: svc.price,
              commission_type: pro.commission_type, commission_value: pro.commission_value,
              amount: Math.round(commValue * 100) / 100,
              earned_at: apptDate.toISOString(), status: 'pendente',
            });
          }

          created.push(`U2 dia-${dayAgo} ${status}`);
          await sleep(60);
        }
      }

      return Response.json({ phase: 5, done: true, created_count: created.length });
    }

    // ════════════════════════════════════════════
    // FASE 6 — Caixas históricos + Saídas manuais
    // ════════════════════════════════════════════
    if (phase === 6) {
      const { unit1_id, unit2_id } = body;
      const created = [];

      // 8 caixas fechados por unidade (últimas 4 semanas)
      for (let week = 4; week >= 1; week--) {
        for (const [unit_id, unitName] of [[unit1_id, 'Matriz'], [unit2_id, 'Filial']]) {
          const openedDaysAgo = week * 7;
          const closedDaysAgo = openedDaysAgo - 1;
          
          // Buscar entries desse período
          const entries = await sdk.entities.FinancialEntry.filter({ company_id: COMPANY_ID, unit_id });
          const dayEntries = entries.filter(e => {
            const d = new Date(e.date);
            const open = new Date(Date.now() - openedDaysAgo * 86400000);
            const close = new Date(Date.now() - closedDaysAgo * 86400000);
            return d >= open && d <= close;
          });

          const totalIn = dayEntries.filter(e => e.type === 'entrada').reduce((s, e) => s + (e.amount || 0), 0);
          const totalOut = dayEntries.filter(e => e.type === 'saida').reduce((s, e) => s + (e.amount || 0), 0);
          const initial = randomInt(50, 200);
          const sangria = randomInt(0, 1) === 1 ? randomInt(100, 500) : 0;
          const suprimento = randomInt(0, 1) === 1 ? randomInt(50, 200) : 0;
          const expected = initial + totalIn - totalOut - sangria + suprimento;
          const finalAmt = expected + randomInt(-20, 20); // pequena diferença

          const paymentBreakdown = {
            dinheiro: Math.round(totalIn * 0.3),
            pix: Math.round(totalIn * 0.4),
            cartao_credito: Math.round(totalIn * 0.2),
            cartao_debito: Math.round(totalIn * 0.1),
          };

          const openedAt = new Date(Date.now() - openedDaysAgo * 86400000);
          openedAt.setHours(8, 0, 0, 0);
          const closedAt = new Date(Date.now() - closedDaysAgo * 86400000);
          closedAt.setHours(19, 30, 0, 0);

          const register = await sdk.entities.CashRegister.create({
            company_id: COMPANY_ID,
            unit_id,
            opened_at: openedAt.toISOString(),
            closed_at: closedAt.toISOString(),
            initial_amount: initial,
            final_amount: finalAmt,
            expected_amount: expected,
            difference: finalAmt - expected,
            total_in: totalIn,
            total_out: totalOut,
            total_sangria: sangria,
            total_suprimento: suprimento,
            payment_breakdown: paymentBreakdown,
            status: 'fechado',
            opened_by: 'pedrojesantos@hotmail.com',
            closed_by: 'pedrojesantos@hotmail.com',
            notes: `Fechamento semana ${5 - week} — ${unitName}`,
          });

          // Sangria se houver
          if (sangria > 0) {
            await sdk.entities.FinancialEntry.create({
              company_id: COMPANY_ID, unit_id,
              type: 'saida', entry_kind: 'sangria',
              origin: 'manual',
              description: 'Sangria de caixa',
              amount: sangria,
              date: dateOnly(openedDaysAgo),
              status: 'confirmado',
              cash_register_id: register.id,
              justification: 'Retirada para depósito bancário',
              is_locked: false,
            });
          }

          // Saídas operacionais
          const saidas = [
            { desc: 'Produtos de limpeza', valor: randomInt(30, 80) },
            { desc: 'Insumos / produtos químicos', valor: randomInt(50, 150) },
          ];
          for (const saida of saidas) {
            if (randomInt(1, 3) === 1) {
              await sdk.entities.FinancialEntry.create({
                company_id: COMPANY_ID, unit_id,
                type: 'saida', entry_kind: 'saida',
                origin: 'manual', payment_method: 'dinheiro',
                description: saida.desc,
                amount: saida.valor,
                date: dateOnly(openedDaysAgo),
                status: 'confirmado',
                cash_register_id: register.id,
                is_locked: false,
              });
            }
          }

          created.push(`Caixa ${unitName} semana ${5 - week}`);
          await sleep(300);
        }
      }

      // Caixa aberto hoje para cada unidade
      for (const [unit_id, unitName] of [[unit1_id, 'Matriz'], [unit2_id, 'Filial']]) {
        const todayEntries = await sdk.entities.FinancialEntry.filter({ company_id: COMPANY_ID, unit_id });
        const todayOnly = todayEntries.filter(e => e.date === dateOnly(0));
        const totalIn = todayOnly.filter(e => e.type === 'entrada').reduce((s, e) => s + (e.amount || 0), 0);
        const openedAt = new Date(); openedAt.setHours(8, 0, 0, 0);
        
        await sdk.entities.CashRegister.create({
          company_id: COMPANY_ID, unit_id,
          opened_at: openedAt.toISOString(),
          initial_amount: 150,
          status: 'aberto',
          opened_by: 'pedrojesantos@hotmail.com',
          notes: `Caixa do dia - ${unitName}`,
        });
        created.push(`Caixa aberto hoje ${unitName}`);
        await sleep(200);
      }

      return Response.json({ phase: 6, done: true, created_count: created.length, details: created });
    }

    // ════════════════════════════════════════════
    // FASE 7 — CustomerPlans + Assinaturas + WhatsApp histórico
    // ════════════════════════════════════════════
    if (phase === 7) {
      const { unit1_id, unit2_id, service_ids } = body;
      const created = [];

      // CustomerPlans
      const existingPlans = await sdk.entities.CustomerPlan.filter({ company_id: COMPANY_ID });
      let planMensal = existingPlans.find(p => p.name === 'Plano Mensal Premium');
      let planBasico = existingPlans.find(p => p.name === 'Plano Básico');

      const corteSvcId = service_ids?.find(s => s.name === 'Corte Masculino')?.id;
      const corteBarbaSvcId = service_ids?.find(s => s.name === 'Corte + Barba')?.id;

      if (!planMensal) {
        planMensal = await sdk.entities.CustomerPlan.create({
          company_id: COMPANY_ID,
          name: 'Plano Mensal Premium',
          description: '2 cortes por mês com desconto especial',
          price_monthly: 79,
          type: 'limited',
          usage_limit: 2,
          service_ids: corteSvcId ? [corteSvcId, corteBarbaSvcId].filter(Boolean) : [],
          rollover: false,
          active: true,
        });
        created.push('Plano Mensal Premium');
        await sleep(200);
      }

      if (!planBasico) {
        planBasico = await sdk.entities.CustomerPlan.create({
          company_id: COMPANY_ID,
          name: 'Plano Básico',
          description: '1 corte mensal com valor fixo',
          price_monthly: 45,
          type: 'limited',
          usage_limit: 1,
          service_ids: corteSvcId ? [corteSvcId] : [],
          rollover: false,
          active: true,
        });
        created.push('Plano Básico');
        await sleep(200);
      }

      // Assinaturas para 15 clientes
      const customers = await sdk.entities.Customer.filter({ company_id: COMPANY_ID });
      const existingSubs = await sdk.entities.CustomerSubscription.filter({ company_id: COMPANY_ID });
      const existingSubCustomers = new Set(existingSubs.map(s => s.customer_id));

      const subCandidates = customers.filter(c => 
        c.lifecycle_status === 'fiel' && !existingSubCustomers.has(c.id)
      ).slice(0, 15);

      const now = new Date();
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      for (const customer of subCandidates) {
        const plan = randomItem([planMensal, planBasico]);
        const usesTotal = plan.usage_limit || 1;
        const usesConsumed = randomInt(0, usesTotal);

        await sdk.entities.CustomerSubscription.create({
          company_id: COMPANY_ID,
          customer_id: customer.id,
          plan_id: plan.id,
          plan_name_snapshot: plan.name,
          plan_price_snapshot: plan.price_monthly,
          plan_type_snapshot: 'limited',
          plan_usage_limit_snapshot: plan.usage_limit,
          status: 'active',
          started_at: daysAgo(randomInt(30, 90)),
          current_cycle_start: cycleStart.toISOString(),
          current_cycle_end: cycleEnd.toISOString(),
          uses_remaining: Math.max(0, usesTotal - usesConsumed),
          uses_consumed_total: usesConsumed,
          last_payment_status: 'pago',
          last_payment_at: daysAgo(randomInt(1, 10)),
        });

        created.push(`Assinatura: ${customer.name}`);
        await sleep(100);
      }

      // WhatsApp histórico de confirmações
      const appointments = await sdk.entities.Appointment.filter({ company_id: COMPANY_ID, status: 'confirmado' });
      const sample = appointments.slice(0, 30);

      for (const appt of sample) {
        if (!appt.customer_phone) continue;
        await sdk.entities.WhatsAppMessage.create({
          company_id: COMPANY_ID,
          unit_id: appt.unit_id,
          customer_id: appt.customer_id,
          appointment_id: appt.id,
          phone: appt.customer_phone,
          customer_name: appt.customer_name,
          type: 'confirmacao',
          message_text: `Olá, ${appt.customer_name}! Seu horário na Vintage foi confirmado. Te esperamos! 💈`,
          status: 'enviado',
          sent_at: new Date(new Date(appt.scheduled_at).getTime() - 86400000).toISOString(),
        });
        created.push(`WhatsApp confirmação: ${appt.customer_name}`);
        await sleep(60);
      }

      return Response.json({ phase: 7, done: true, created_count: created.length, details: created.slice(0, 20) });
    }

    return Response.json({ error: 'Fase inválida. Use phase 1 a 7.' }, { status: 400 });

  } catch (error) {
    console.error('[seedTestData] error:', error.message, error.stack);
    return Response.json({ error: error.message, stack: error.stack?.slice(0, 500) }, { status: 500 });
  }
});