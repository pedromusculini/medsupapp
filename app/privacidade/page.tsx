import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';

export const metadata = {
  title: 'Política de Privacidade | MedSupAPP',
};

export default function PrivacidadePage() {
  return (
    <LegalDocumentLayout title="Política de Privacidade" version={PRIVACY_POLICY_VERSION}>
      <p>
        O MedSupAPP (“nós”) oferece software de gestão para médicos e clínicas. Esta política
        descreve como tratamos dados pessoais em conformidade com a Lei Geral de Proteção de
        Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Papéis</h2>
      <p>
        O profissional ou clínica contratante é <strong>controlador</strong> dos dados de
        pacientes. O MedSupAPP atua predominantemente como <strong>operador</strong>, processando
        dados conforme instruções do controlador para prestar o serviço.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. O que não fazemos</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Não armazenamos prontuários ou documentos clínicos em nossa nuvem.</li>
        <li>
          Arquivos de pacientes ficam no Google Drive da conta do profissional (escopo{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">drive.file</code>).
        </li>
        <li>Não vendemos nem compartilhamos dados para marketing de terceiros.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Dados que tratamos</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Conta:</strong> e-mail Google, identificador, nome, CRM/CNPJ, endereço
          profissional, WhatsApp.
        </li>
        <li>
          <strong>Operacionais (Supabase):</strong> links de formulário, fila de mensagens
          WhatsApp (telefone e metadados), códigos de verificação, perfil de onboarding.
        </li>
        <li>
          <strong>Formulário público:</strong> dados enviados pelo paciente ficam temporariamente
          no servidor até sincronização para o Drive do profissional, quando são removidos da
          nossa base.
        </li>
        <li>
          <strong>Google:</strong> agenda (Calendar) e arquivos criados pelo app (Drive), sob
          permissões que você concede e pode revogar.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Bases legais</h2>
      <p>
        Execução de contrato e legítimo interesse para operação do SaaS; consentimento quando
        exigido (ex.: formulário do paciente, comunicações). Dados sensíveis de saúde são
        tratados pelo controlador; nosso tratamento é mínimo e transitório quando aplicável.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Suboperadores</h2>
      <p>
        Podemos usar Google, Supabase, Vercel, Resend e Meta (WhatsApp Business), com contratos
        e medidas de segurança compatíveis com a LGPD. Transferências internacionais seguem
        mecanismos previstos em lei.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Retenção e segurança</h2>
      <p>
        Mantemos dados apenas pelo tempo necessário à finalidade. Aplicamos autenticação Google,
        verificação de e-mail, isolamento por conta nas APIs e endurecimento de acesso ao banco
        (service role apenas no servidor).
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Direitos do titular</h2>
      <p>
        Você pode solicitar acesso, correção, exclusão, portabilidade e revogação de
        consentimento pelo e-mail de contato. Pacientes devem contatar a clínica/médico
        controlador; auxiliamos o controlador quando aplicável.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Alterações</h2>
      <p>
        Publicaremos nova versão nesta página. O uso continuado após mudanças materiais pode
        exigir novo aceite.
      </p>

      <LegalCrossLinks />
    </LegalDocumentLayout>
  );
}
