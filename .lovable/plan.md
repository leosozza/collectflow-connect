
# Garantias de preservação — adendo ao plano

Resumo direto: **nada do que já existe muda de comportamento visível**. Toda a evolução é aditiva e idempotente. Pagamentos antigos, baixas confirmadas, acordos vigentes/quebrados, status atual da carteira e o frontend continuam exatamente iguais. O que muda é a **fonte de leitura interna** ficar única e confiável.

## Princípios obrigatórios da migração

1. **Aditivo, nunca destrutivo**
   - Nenhuma coluna existente é removida nas Fases 1–4. As "aposentadorias" da Fase 5 só ocorrem depois de 100% das leituras estarem migradas e validadas em produção.
   - `clients.valor_pago`, `clients.status`, `agreements.status`, `manual_payments.installment_number`, `negociarie_cobrancas.installment_key`, `client_events` — **todas permanecem**.

2. **SSOTs já estabelecidas são respeitadas**
   - `client_profiles` continua SSOT de contato (CPF/tenant). Não é tocada.
   - `client_events` continua SSOT da timeline omnichannel. Não é tocada.
   - `tipos_status.regras.papel_sistema` continua SSOT semântica de status. A nova SSOT de **parcela paga** (`agreement_installments`) se conecta a ela, não a substitui.
   - Hierarquia de status por CPF/Credor (QUITADO > ACORDO VIGENTE > … > EM DIA) é preservada e passa a ser calculada a partir da SSOT, não recalculada de novo.
   - Regra do `client_profiles` canônico, anti-leak de `negociarie_cobrancas` (Andreia Simão), `papel_sistema` em `tipos_status`, RLS via `get_my_tenant_id()`, paginação por `.range()` — tudo mantido.

3. **Backfill 1:1 com o estado atual**
   - A nova `agreement_installments` será populada lendo exatamente o que `classifyInstallment` enxerga hoje (manual_payments confirmados + negociarie_cobrancas pagas + portal_payments confirmados + cancelled_installments). 
   - Critério de aceite do backfill: para 100% dos acordos, `paid_count` materializado == `paid_count` calculado em runtime hoje. Diferença zero.
   - Backfill rodado em batch por tenant, idempotente, com checkpoint. Pode rodar/re-rodar sem efeito colateral.

4. **Dual-read antes de single-read** (zero downtime)
   - Fase 2 cria a tabela e os triggers, mas o frontend continua lendo das tabelas atuais.
   - Em paralelo, criamos um **shadow check**: edge function compara, por amostragem, o resultado da SSOT vs o classifier antigo. Só quando 0 divergências em N dias, mudamos a leitura.
   - Quando a leitura migra, o classifier antigo permanece como fallback por mais um ciclo, atrás de feature flag.

5. **Frontend não muda**
   - `AgreementInstallments.tsx`, `AcordosPage`, dashboard, ClientDetail continuam consumindo a mesma forma. O wrapper do classifier passa a ler a SSOT internamente — assinatura e shape de retorno preservados.
   - Nenhuma rota, nenhum botão, nenhum status visível muda de nome, cor ou regra.

6. **Constraints novas só onde os dados já estão limpos**
   - Antes de criar `UNIQUE (agreement_id, installment_key)` em `manual_payments`/`negociarie_cobrancas`, rodamos diagnóstico e, se houver duplicata histórica, criamos a constraint como `NOT VALID` + `VALIDATE` separadamente, com fix-up dirigido caso a caso. Nunca quebra insert existente.
   - `clients.tenant_id NOT NULL` só após varredura confirmar zero órfãos (com tabela de quarentena se aparecer algum).

7. **Reversibilidade**
   - Cada fase é uma migration isolada com migration de rollback equivalente.
   - Triggers novos podem ser desativados via `ALTER TABLE … DISABLE TRIGGER` sem perder dado (a tabela materializada vira só cache; o sistema volta a calcular do jeito antigo).

8. **Validação por tenant antes de avançar**
   - Vamos escolher 1 tenant piloto (sugiro um pequeno + Y.brasil, que já tem casos conhecidos como Andreia Simão) para validar Fase 2 antes de propagar.
   - Critério de promoção: shadow-check com 0 divergência em 7 dias corridos.

## O que muda na ordem das fases (ajuste por causa da preservação)

| Fase | O que faz | Risco visível p/ usuário |
|---|---|---|
| 1 | Índices + UNIQUE parciais + `tenant_id NOT NULL` (após backfill) | Zero. Só performance + integridade. |
| 2 | Cria `agreement_installments` + triggers + backfill + shadow-check (sem mudar leitura) | Zero. Frontend continua igual. |
| 3 | Migrar leitura do classifier para SSOT atrás de feature flag, tenant a tenant | Zero esperado. Rollback por flag. |
| 4 | `agreements.paid_count`, `last_paid_at`, status agregado mantidos por trigger | Zero. Substitui cálculos JS por valor já pronto. |
| 5 (opcional, futuro) | Aposentar enum `clients.status` em favor de `status_cobranca_id` | Adiada até termos certeza. Pode ficar coexistindo indefinidamente. |

## Garantias específicas para o que você levantou

- **Baixas já realizadas (manual_payments confirmadas)**: continuam exatamente onde estão, sem reprocessamento. O backfill apenas as **lê** para popular a SSOT.
- **Clientes que já pagaram (negociarie_cobrancas pagas + portal_payments confirmados)**: idem, leitura apenas. Nenhum status volta atrás.
- **Acordos quitados/quebrados/ativos**: o status atual de `agreements.status` é preservado. A trigger de Fase 4 só passa a manter o valor a partir da SSOT — o estado inicial é o atual.
- **Carteira importada (`clients`)**: nenhuma linha é alterada. `valor_pago`, `status`, `status_cobranca_id` continuam como estão. O ajuste futuro (Fase 5) é opcional e só acontece com aprovação separada.
- **Histórico (`client_events`)**: intocado.

## Próximo passo

Aprovar a **Fase 1** isolada (índices + constraints com `NOT VALID`/`VALIDATE` + diagnóstico de órfãos antes de qualquer `NOT NULL`). É 100% segura, dá ganho imediato e nos dá o relatório de "está tudo limpo?" para decidir com confiança a Fase 2.
