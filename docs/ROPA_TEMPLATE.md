# ROPA — Registro de Operações de Tratamento (template)

Preencher com parecer jurídico. Versão interna; não publicar como página do produto.

**Controlador (titular do tratamento de dados de pacientes):** profissional / clínica usuária do MedSupAPP  
**Operador:** MedSupAPP (`privacidade@medsupapp.com.br`)  
**Última revisão:** _[data]_

---

## 1. Tratamentos por finalidade

| # | Finalidade | Categorias de dados | Titulares | Base legal (LGPD) | Retenção | Compartilhamento |
|---|------------|---------------------|-----------|-------------------|----------|------------------|
| 1 | Conta e autenticação | E-mail, nome Google, sub OAuth | Profissional | Execução de contrato | Vigência + obrigações legais | Google, Supabase, Vercel |
| 2 | Cobrança | CPF/CNPJ, dados de pagamento | Profissional | Execução de contrato | Conforme Asaas / fiscal | Asaas |
| 3 | Agenda operacional | Nome paciente, telefone, horários, tipo consulta | Paciente / profissional | Execução de contrato (operador); controlador define base para prontuário | Enquanto conta ativa; metadados após encerramento conforme política | Supabase; sync Calendar |
| 4 | Prontuário / fichas | Dados clínicos e cadastro | Paciente | Controlador (profissional/clínica) | No Drive do profissional | Google Drive (`drive.file`) |
| 5 | Formulário público | Respostas do formulário | Paciente | Consentimento | Transitório até sync Drive | Supabase → Drive → delete |
| 6 | Comunicação wa.me | Telefone, templates | Paciente | Legítimo interesse / contrato (controlador) | Templates na conta | Sem API Meta |
| 7 | Segurança | IP, logs, rate limit | Profissional / visitante | Legítimo interesse | Prazo curto | Vercel, Supabase |

## 2. Transferência internacional

| Suboperador | País provável | Mecanismo |
|-------------|---------------|-----------|
| Google | EUA / global | Cláusulas contratuais / termos Google |
| Supabase | EUA / UE | DPA Supabase |
| Vercel | EUA | DPA Vercel |
| Resend | EUA | DPA Resend |
| Asaas | Brasil | Local |

## 3. Medidas de segurança (resumo)

- RLS Supabase; service role só no servidor
- Tokens OAuth httpOnly
- OTP e rate limit
- Remoção de formulários após sync
- Backup/export CSV pelo titular da conta SaaS
- Agendamento público: API `identificar` retorna apenas `nome_parcial`

## 4. Direitos dos titulares

| Canal | Responsável |
|-------|-------------|
| Dados no prontuário / ficha | Profissional / clínica (controlador) |
| Conta SaaS e metadados operacionais | `privacidade@medsupapp.com.br` |
| Export CSV | `/backup` na conta do profissional |

## 5. Incidentes

- Registro interno: data, escopo, mitigação, comunicação ANPD/titulares se aplicável
- Contato técnico: `suporte@medsupapp.com.br`

## 6. Revisão

| Data | Alteração | Responsável |
|------|-----------|-------------|
| | Versão inicial template | |
