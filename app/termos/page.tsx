import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_PRODUCT_NAME,
  LEGAL_CONTACT,
  LEGAL_FORUM,
  PRIVACY_CONTACT,
  SUPPORT_EMAIL,
  TERMS_VERSION,
} from '@/lib/legal';

export const metadata = {
  title: 'Termos de Uso | MedSupAPP',
};

export default function TermosPage() {
  return (
    <LegalDocumentLayout title="Termos de Uso" version={TERMS_VERSION}>
      <p>
        Estes Termos de Uso (&quot;Termos&quot;) regulam o acesso e a utilização do{' '}
        {COMPANY_PRODUCT_NAME} (&quot;MedSupAPP&quot;, &quot;Plataforma&quot;, &quot;nós&quot;),
        software de gestão para consultórios e clínicas oferecido por {COMPANY_LEGAL_NAME}.
        Ao criar conta, concluir onboarding ou utilizar o serviço, você (&quot;Usuário&quot;,
        &quot;Contratante&quot;) declara ter lido, compreendido e aceito integralmente estes
        Termos e a{' '}
        <a href="/privacidade" className="text-emerald-600 hover:underline">
          Política de Privacidade
        </a>
        .
      </p>
      <p>
        Se você não concordar, não utilize a Plataforma. O uso continuado após alterações
        materiais poderá exigir novo aceite eletrônico.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Definições</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Usuário / Contratante:</strong> médico, clínica ou representante legal que
          contrata o serviço.
        </li>
        <li>
          <strong>Paciente / Titular:</strong> pessoa cujos dados são inseridos pelo Usuário ou
          por formulários públicos vinculados à conta do Usuário.
        </li>
        <li>
          <strong>Dados clínicos:</strong> prontuários, anamneses, exames, evoluções e demais
          informações de saúde, em geral dados pessoais sensíveis na LGPD.
        </li>
        <li>
          <strong>Integrações:</strong> Google (Drive, Calendar, Contatos), WhatsApp (envio
          manual via wa.me), Asaas (cobrança) e demais serviços de terceiros.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Natureza do serviço</h2>
      <p>
        O MedSupAPP é uma ferramenta de <strong>apoio administrativo e operacional</strong>{' '}
        (agenda, cadastro de clientes, comunicação, financeiro, backup).{' '}
        <strong>Não constitui prontuário eletrônico certificado</strong>, sistema de
        prescrição, diagnóstico automatizado, telemedicina regulada ou substituto do
        julgamento clínico do profissional.
      </p>
      <p>
        O serviço é fornecido &quot;como está&quot; e &quot;conforme disponível&quot;, com
        evolução contínua. Funcionalidades podem ser alteradas, incluídas ou descontinuadas,
        com aviso razoável quando materialmente relevante.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Elegibilidade e conta</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Acesso via <strong>Google OAuth</strong>. Você deve ser maior de 18 anos e ter
          capacidade civil para contratar.
        </li>
        <li>
          É obrigatória a <strong>verificação de e-mail</strong> e o aceite dos documentos
          legais vigentes.
        </li>
        <li>
          Você é responsável por manter a segurança da conta Google, revogar acessos indevidos
          e notificar-nos em caso de uso não autorizado ({SUPPORT_EMAIL}).
        </li>
        <li>
          Período de teste (&quot;trial&quot;) e planos pagos seguem regras exibidas no produto
          e na página de planos. A cobrança recorrente é processada pelo Asaas ou meio indicado.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">
        4. Papéis na LGPD e dados de pacientes
      </h2>
      <p>
        Para dados de pacientes inseridos ou coletados em seu nome, o{' '}
        <strong>Usuário é o Controlador</strong> nos termos da Lei nº 13.709/2018 (LGPD) e o
        MedSupAPP atua predominantemente como <strong>Operador</strong>, tratando dados conforme
        suas instruções para prestar o serviço contratado.
      </p>
      <p>
        O Usuário declara que: (i) possui base legal adequada para o tratamento (consentimento,
        tutela da saúde, execução de contrato ou outra prevista em lei); (ii) cumpre o CFM,
        resoluções aplicáveis e normas de prontuário; (iii) informa os pacientes quando
        necessário; (iv) não inserirá dados sem autorização ou em violação à lei.
      </p>
      <p>
        Dados clínicos detalhados e arquivos de pacientes são armazenados no{' '}
        <strong>Google Drive da conta do Usuário</strong>, não na nuvem proprietária do
        MedSupAPP. Dados operacionais transitórios (formulários antes da sincronização, filas,
        metadados) seguem a Política de Privacidade.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Uso permitido e proibições</h2>
      <p>É permitido utilizar o MedSupAPP para gestão lícita de consultório ou clínica.</p>
      <p className="mt-2">É vedado:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Violar leis, LGPD, sigilo profissional ou direitos de terceiros;</li>
        <li>Tentar acessar contas, dados ou áreas não autorizadas;</li>
        <li>Engenharia reversa, scraping abusivo ou sobrecarga intencional dos sistemas;</li>
        <li>Armazenar conteúdo ilícito, malware ou material que viole direitos autorais;</li>
        <li>Revender ou sublicenciar o serviço sem autorização escrita;</li>
        <li>Utilizar o sistema para fins de triagem ou decisão clínica automatizada sem supervisão profissional.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Integrações de terceiros</h2>
      <p>
        O funcionamento de Calendar, Drive, Contatos, WhatsApp e pagamentos depende de
        terceiros. Não garantimos disponibilidade, precisão ou continuidade desses serviços.
        O Usuário deve aceitar os termos dos respectivos provedores e gerenciar permissões no
        Google e demais plataformas.
      </p>
      <p>
        O envio de mensagens WhatsApp é <strong>semi-manual</strong> (link wa.me); não há
        garantia de entrega, leitura ou conformidade com políticas da Meta/WhatsApp Business.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Propriedade intelectual</h2>
      <p>
        O MedSupAPP, sua marca, código, layout e documentação são de titularidade do{' '}
        {COMPANY_LEGAL_NAME} ou licenciadores. Concedemos licença limitada, não exclusiva,
        intransferível e revogável para uso conforme estes Termos.
      </p>
      <p>
        Dados, prontuários e arquivos do Usuário e de seus pacientes permanecem sob controle do
        Usuário. O MedSupAPP não reivindica propriedade sobre conteúdo clínico armazenado no
        Drive do Usuário.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Backup e guarda de prontuário</h2>
      <p>
        O Usuário é exclusivamente responsável pela guarda legal de prontuários, backups
        periódicos e retenção conforme CFM e legislação aplicável. A funcionalidade de backup
        da Plataforma é auxiliar; não substitui política de contingência do consultório.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Cobrança, suspensão e rescisão</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Planos pagos renovam conforme condições exibidas no checkout (Asaas).</li>
        <li>Inadimplência pode resultar em suspensão de acesso após aviso razoável.</li>
        <li>O Usuário pode encerrar o uso a qualquer momento; dados no Drive permanecem na conta Google.</li>
        <li>
          Podemos suspender ou encerrar contas em caso de violação destes Termos, fraude, risco
          à segurança ou exigência legal.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">
        10. Isenção de garantias
      </h2>
      <p>
        Na máxima extensão permitida pela lei, o serviço é fornecido sem garantias expressas ou
        implícitas de adequação a finalidade específica, ausência de erros, disponibilidade
        ininterrupta ou resultados clínicos, financeiros ou comerciais.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">
        11. Limitação de responsabilidade
      </h2>
      <p>
        O MedSupAPP, seus sócios, administradores e colaboradores{' '}
        <strong>não serão responsáveis</strong> por: (a) decisões clínicas, diagnósticos ou
        condutas médicas; (b) perda ou corrupção de dados no Google Drive ou dispositivos do
        Usuário; (c) indisponibilidade de terceiros; (d) lucros cessantes, perda de receita,
        danos indiretos, incidentais ou consequenciais; (e) reclamações de pacientes contra o
        Usuário.
      </p>
      <p>
        Quando a responsabilidade não puder ser excluída por lei, ela fica limitada ao valor
        total pago pelo Usuário ao MedSupAPP nos <strong>12 (doze) meses</strong> anteriores ao
        evento que deu causa à reclamação.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">12. Indenização</h2>
      <p>
        O Usuário concorda em indenizar e isentar o MedSupAPP de reclamações, perdas e despesas
        (incluindo honorários advocatícios razoáveis) decorrentes de: uso ilícito da
        Plataforma; violação destes Termos ou da LGPD por culpa do Usuário; conteúdo inserido
        pelo Usuário; e descumprimento de obrigações profissionais ou regulatórias.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">13. Privacidade e segurança</h2>
      <p>
        O tratamento de dados pessoais rege-se pela Política de Privacidade. Medidas técnicas
        incluem autenticação Google, verificação de e-mail, isolamento por conta nas APIs e
        uso de service role apenas no servidor. O Usuário deve adotar boas práticas (senha
        forte na Google, dispositivos seguros, PIN de prontuário quando habilitado).
      </p>
      <p>
        Dúvidas sobre privacidade: {PRIVACY_CONTACT}. Suporte técnico: {SUPPORT_EMAIL}.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">14. Alterações</h2>
      <p>
        Podemos alterar estes Termos. Mudanças materiais serão publicadas nesta página com nova
        versão e, quando aplicável, exigirão novo aceite eletrônico para continuidade do
        serviço.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">15. Lei aplicável e foro</h2>
      <p>
        Estes Termos regem-se pelas leis da República Federativa do Brasil. Fica eleito o foro
        da {LEGAL_FORUM}, com renúncia a qualquer outro, por mais privilegiado que seja, salvo
        disposição legal imperativa em favor do consumidor pessoa física.
      </p>

      <p className="mt-6 text-sm text-gray-500">
        Contato geral: {LEGAL_CONTACT}
      </p>

      <LegalCrossLinks />
    </LegalDocumentLayout>
  );
}
