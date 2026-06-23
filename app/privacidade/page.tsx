import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_PRODUCT_NAME,
  LEGAL_CONTACT,
  PRIVACY_CONTACT,
  PRIVACY_POLICY_VERSION,
  SUPPORT_EMAIL,
} from '@/lib/legal';

export const metadata = {
  title: 'Política de Privacidade | MedSupAPP',
};

export default function PrivacidadePage() {
  return (
    <LegalDocumentLayout title="Política de Privacidade" version={PRIVACY_POLICY_VERSION}>
      <p>
        O {COMPANY_PRODUCT_NAME} (&quot;MedSupAPP&quot;, &quot;nós&quot;) respeita sua privacidade
        e trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei
        nº 13.709/2018) e orientações da Autoridade Nacional de Proteção de Dados (ANPD).
      </p>
      <p>
        Esta Política descreve como coletamos, usamos, armazenamos e compartilhamos dados no
        contexto do software de gestão para médicos e clínicas operado por {COMPANY_LEGAL_NAME}.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Papéis na LGPD</h2>
      <p>
        <strong>Controlador dos dados de pacientes:</strong> o médico ou clínica contratante,
        que define finalidades e meios do tratamento clínico.
      </p>
      <p>
        <strong>Operador:</strong> o MedSupAPP, que processa dados em nome do Controlador para
        prestar o serviço contratado (agenda, formulários, comunicação, etc.).
      </p>
      <p>
        <strong>Controlador dos dados da conta do profissional:</strong> o MedSupAPP, quanto a
        cadastro, cobrança, suporte e operação do SaaS.
      </p>
      <p>
        Pacientes devem exercer direitos junto ao consultório ou clínica. Auxiliamos o
        Controlador quando aplicável ({PRIVACY_CONTACT}).
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Dados que tratamos</h2>
      <h3 className="text-lg font-semibold text-gray-900 mt-4">2.1 Conta do profissional</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>E-mail Google, identificador Google (sub), nome;</li>
        <li>CRM, especialidade, CNPJ, WhatsApp, endereço profissional;</li>
        <li>Dados de onboarding, plano, assinatura e pagamento (via Asaas);</li>
        <li>Registro de consentimento (versão dos termos, data/hora).</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">2.2 Dados operacionais (Supabase)</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>Consultas, lembretes, configurações de mensagens e horários;</li>
        <li>Links de formulário e agendamento, tokens públicos;</li>
        <li>
          Templates de mensagem e metadados de comunicação (telefone do cliente); envio via{' '}
          <strong>links wa.me</strong> abertos pelo profissional — sem API oficial WhatsApp/Meta;
        </li>
        <li>Códigos de verificação de e-mail e registros de rate limit;</li>
        <li>Índices operacionais (ex.: telefone → paciente para agendamento).</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">2.3 Formulários públicos</h3>
      <p>
        Dados enviados pelo paciente ficam temporariamente em nossa infraestrutura até
        sincronização para o Google Drive do profissional, quando são removidos da nossa base
        operacional conforme o fluxo do produto.
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">2.4 Google (Drive, Calendar, Contatos)</h3>
      <p>
        Com autorização explícita do Usuário, acessamos recursos Google conforme escopos
        concedidos. Arquivos de pacientes e prontuários permanecem no Drive do Usuário (escopo{' '}
        <code className="text-sm bg-gray-100 px-1 rounded">drive.file</code> para arquivos criados
        pelo app).
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">2.5 O que não fazemos</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>Não vendemos dados pessoais;</li>
        <li>Não usamos dados de pacientes para marketing de terceiros;</li>
        <li>Não armazenamos prontuários completos em nossa nuvem de forma permanente;</li>
        <li>Não utilizamos cookies de publicidade ou remarketing no site do produto.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Bases legais</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Execução de contrato</strong> — prestação do SaaS, conta, cobrança e suporte;
        </li>
        <li>
          <strong>Legítimo interesse</strong> — segurança, prevenção a fraudes, melhoria do
          serviço, logs técnicos;
        </li>
        <li>
          <strong>Consentimento</strong> — quando exigido (ex.: aceite de termos, formulário do
          paciente, cookies não essenciais se vierem a existir);
        </li>
        <li>
          <strong>Obrigação legal</strong> — cumprimento de ordens judiciais ou regulatórias.
        </li>
      </ul>
      <p className="mt-2">
        Dados sensíveis de saúde são tratados pelo Controlador (profissional/clínica). Nosso
        tratamento é limitado ao necessário para operar o serviço e, quando aplicável,
        transitório até sincronização ao Drive.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Finalidades</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Autenticar e manter a sessão do Usuário;</li>
        <li>Operar agenda, clientes, financeiro, backup e comunicação;</li>
        <li>Processar pagamentos e assinaturas;</li>
        <li>Enviar códigos de verificação e comunicações de serviço;</li>
        <li>Cumprir obrigações legais e responder a incidentes de segurança;</li>
        <li>Melhorar estabilidade e desempenho (dados agregados ou anonimizados quando possível).</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Compartilhamento e suboperadores</h2>
      <p>Podemos compartilhar dados com prestadores que nos auxiliam na operação:</p>
      <ul className="list-disc pl-6 space-y-2 mt-2">
        <li><strong>Google</strong> — OAuth, Drive, Calendar, Contatos;</li>
        <li><strong>Supabase</strong> — banco de dados operacional;</li>
        <li><strong>Vercel</strong> — hospedagem da aplicação;</li>
        <li><strong>Resend</strong> — envio de e-mails transacionais;</li>
        <li><strong>Asaas</strong> — cobrança e assinaturas.</li>
      </ul>
      <p className="mt-2">
        Exigimos medidas de segurança compatíveis com a LGPD. Transferências internacionais
        podem ocorrer quando esses provedores processam dados fora do Brasil, com mecanismos
        previstos em lei (cláusulas contratuais, garantias dos provedores, etc.).
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Retenção</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Conta ativa: enquanto durar a relação contratual e obrigações legais;</li>
        <li>Formulários públicos: até sincronização ao Drive do profissional;</li>
        <li>Códigos OTP e rate limits: prazo curto, conforme necessidade de segurança;</li>
        <li>Registros de consentimento: enquanto exigido para comprovação legal;</li>
        <li>Após encerramento: exclusão ou anonimização quando não houver obrigação de guarda.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Segurança</h2>
      <p>Medidas incluem, entre outras:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Autenticação Google e verificação de e-mail;</li>
        <li>Tokens Google em cookies httpOnly no servidor;</li>
        <li>APIs autenticadas com isolamento por conta;</li>
        <li>Row Level Security no Supabase; service role apenas no servidor;</li>
        <li>Remoção de respostas de formulário após sync ao Drive.</li>
      </ul>
      <p className="mt-2">
        Nenhum sistema é 100% seguro. Em caso de incidente relevante, notificaremos o
        Controlador e, quando aplicável, a ANPD e titulares conforme a lei.
      </p>

      <h2 id="cookies" className="text-xl font-semibold text-gray-900 mt-8 scroll-mt-24">
        8. Cookies e tecnologias similares
      </h2>
      <p>
        Utilizamos cookies e armazenamento local para operar o serviço, em linha com a LGPD e
        orientações da ANPD sobre transparência.
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.1 Cookies essenciais</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Sessão (NextAuth):</strong> mantém login seguro após autenticação Google.
        </li>
        <li>
          <strong>Integração Google:</strong> cookies como{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">google_calendar_token</code>,{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">google_drive_token</code> e{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">google_contacts_token</code> —
          tokens httpOnly para serviços que você autorizou.
        </li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.2 Armazenamento local</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>Preferência do aviso de cookies (localStorage);</li>
        <li>Progresso do tour do produto e preferências técnicas do navegador;</li>
        <li>Dados operacionais locais em alguns fluxos (ex.: cache de agenda) — sem publicidade.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.3 O que não utilizamos</h3>
      <p>
        Não utilizamos cookies de publicidade, remarketing ou perfilamento comportamental de
        terceiros. Se isso mudar, solicitaremos consentimento prévio e atualizaremos esta
        política.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Direitos do titular (art. 18 LGPD)</h2>
      <p>Você pode solicitar, mediante requisição a {PRIVACY_CONTACT}:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Confirmação e acesso aos dados;</li>
        <li>Correção de dados incompletos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>Portabilidade, quando aplicável;</li>
        <li>Informação sobre compartilhamento;</li>
        <li>Revogação do consentimento;</li>
        <li>Oposição a tratamento baseado em legítimo interesse, quando cabível.</li>
      </ul>
      <p className="mt-2">
        Responderemos em prazo razoável, em geral até <strong>15 dias</strong>, prorrogável
        conforme a lei. Podemos solicitar informações para confirmar identidade.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">10. Encarregado / canal de privacidade</h2>
      <p>
        Para questões sobre proteção de dados: <strong>{PRIVACY_CONTACT}</strong>.
        Suporte técnico: {SUPPORT_EMAIL}. Contato geral: {LEGAL_CONTACT}.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">11. Crianças e adolescentes</h2>
      <p>
        O serviço destina-se a profissionais de saúde e clínicas. Dados de menores inseridos
        como pacientes são responsabilidade do Controlador, que deve observar a LGPD e o ECA.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">12. Alterações desta política</h2>
      <p>
        Publicaremos nova versão nesta página. Mudanças materiais podem exigir novo aceite no
        login. A versão vigente está indicada no topo do documento.
      </p>

      <LegalCrossLinks />
    </LegalDocumentLayout>
  );
}
