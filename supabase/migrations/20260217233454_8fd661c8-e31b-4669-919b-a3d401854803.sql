
-- Insert default quick replies for all existing tenants
INSERT INTO quick_replies (tenant_id, shortcut, content, category)
SELECT t.id, s.shortcut, s.content, s.category
FROM tenants t
CROSS JOIN (VALUES
  ('/saudacao', 'Olá, {{nome_cliente}}! Aqui é {{nome_operador}}. Como posso ajudá-lo hoje?', 'atendimento'),
  ('/debito', '{{nome_cliente}}, seu débito atual com {{credor}} é de R$ {{valor_parcela}} por parcela, com {{parcelas_abertas}} parcela(s) em aberto de um total de {{total_parcelas}}.', 'cobranca'),
  ('/vencimento', 'Sua próxima parcela vence em {{vencimento}}, no valor de R$ {{valor_parcela}}.', 'cobranca'),
  ('/negociacao', '{{nome_cliente}}, temos condições especiais para regularizar sua situação com {{credor}}. Posso apresentar uma proposta?', 'negociacao'),
  ('/encerramento', 'Obrigado pelo contato, {{nome_cliente}}! Qualquer dúvida, estamos à disposição. Um abraço, {{nome_operador}}.', 'atendimento')
) AS s(shortcut, content, category)
WHERE NOT EXISTS (
  SELECT 1 FROM quick_replies qr WHERE qr.tenant_id = t.id AND qr.shortcut = s.shortcut
);
