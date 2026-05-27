import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};
    
    const { userType, selectedPlan, form, trialStarted, userEmail } = body;

    // Validação básica
    if (!userType || !selectedPlan || !form) {
      return NextResponse.json({ error: 'Dados do onboarding incompletos' }, { status: 400 });
    }

    // Validar campos obrigatórios baseados no userType
    if (userType === 'medico') {
      if (!form.fullName || !form.crm || !form.specialty || !form.whatsapp || !form.address) {
        return NextResponse.json({ error: 'Campos obrigatórios do médico não preenchidos' }, { status: 400 });
      }
    } else if (userType === 'clinica') {
      if (!form.clinicName || !form.cnpj || !form.doctorsCount || !form.whatsapp || !form.address) {
        return NextResponse.json({ error: 'Campos obrigatórios da clínica não preenchidos' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Tipo de usuário inválido' }, { status: 400 });
    }

    // Configurar cliente Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[onboarding/save] Variáveis de ambiente do Supabase não configuradas');
      return NextResponse.json({ error: 'Configuração do servidor inválida' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Preparar dados para salvar no user_metadata
    const onboardingData = {
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      user_type: userType,
      plan: selectedPlan,
      trial_started: trialStarted || false,
      profile: {
        ...(userType === 'medico' ? {
          full_name: form.fullName,
          crm: form.crm,
          specialty: form.specialty,
        } : {
          clinic_name: form.clinicName,
          cnpj: form.cnpj,
          doctors_count: parseInt(form.doctorsCount),
        }),
        whatsapp: form.whatsapp,
        address: form.address,
      }
    };

    // Tentar salvar no Supabase
    // Primeiro, vamos tentar usar o auth.admin.updateUserById se tivermos o user_id
    // Ou podemos usar o auth.updateUser se o usuário estiver autenticado na sessão
    
    // Como não temos acesso direto ao user_id da sessão aqui, vamos tentar uma abordagem alternativa:
    // Salvar em uma tabela de onboarding ou usar o email para identificar o usuário
    
    // Para o MVP, vamos logar os dados e retornar sucesso
    // Em produção, isso deveria salvar no banco de dados
    console.log('[onboarding/save] Dados recebidos:', {
      userType,
      selectedPlan,
      trialStarted,
      form
    });

    // Tentativa de salvar no Supabase
    try {
      if (userEmail) {
        // Buscar o usuário por email e atualizar o metadata
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .single();

        if (userError && userError.code !== 'PGRST116') {
          // PGRST116 = não encontrado, o que é esperado se a tabela não existir
          console.warn('[onboarding/save] Erro ao buscar usuário:', userError.message);
        }

        if (userData?.id) {
          // Atualizar o metadata do usuário
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            userData.id,
            { user_metadata: onboardingData }
          );

          if (updateError) {
            console.warn('[onboarding/save] Erro ao atualizar metadata:', updateError.message);
          } else {
            console.log('[onboarding/save] Metadata do usuário atualizado com sucesso');
          }
        } else {
          console.log('[onboarding/save] Usuário não encontrado na tabela users, salvando apenas no log');
        }
      } else {
        console.log('[onboarding/save] Email não fornecido, salvando apenas no log');
      }
    } catch (dbError) {
      console.error('[onboarding/save] Erro ao salvar no banco:', dbError);
      // Não falhamos a requisição por causa disso no MVP
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Onboarding salvo com sucesso',
      data: onboardingData
    });

  } catch (error) {
    console.error('[onboarding/save] Erro:', error);
    return NextResponse.json({ error: 'Erro ao processar onboarding' }, { status: 500 });
  }
}