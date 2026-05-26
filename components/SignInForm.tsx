"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabaseClient";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("medico");
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    setSupabase(createBrowserSupabase());
  }, []);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (!supabase) {
      setStatus("Aguardando carregamento do cliente... tente novamente em alguns instantes.");
      return;
    }
    event.preventDefault();
    setStatus(null);
    if (!email) {
      setStatus("Digite um e-mail válido para receber o link de acesso.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/agenda`,
      },
    });

    setIsLoading(false);
    if (error) {
      setStatus(`Erro ao enviar e-mail: ${error.message}`);
      return;
    }

    setStatus(`Link de acesso enviado para ${email}. Verifique sua caixa de entrada.`);
  }

  async function handleGoogleSignIn() {
    setStatus(null);
    if (!supabase) {
      setStatus("Aguardando carregamento do cliente... tente novamente em alguns instantes.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
        redirectTo: `${window.location.origin}/agenda`,
      },
    });
    setIsLoading(false);

    if (error) {
      setStatus(`Erro ao iniciar login com Google: ${error.message}`);
    }
  }

  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">Acesso ao MedSupAPP</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Login com e-mail ou Google</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use seu e-mail para receber um link de acesso seguro ou entre com Google para ativar a agenda sincronizada.
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            E-mail de acesso
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
              placeholder="seu@clinica.com"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Perfil
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
            >
              <option value="medico">Médico</option>
              <option value="paciente">Paciente</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex w-full justify-center rounded-2xl bg-[#90EE90] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#7ad47a] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Enviando..." : "Enviar link por e-mail"}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
          <p className="relative mx-auto max-w-max bg-white px-3 text-sm text-slate-500">ou</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
        >
          <span>Entrar com Google</span>
        </button>

        {status ? (
          <div className="rounded-3xl bg-[#f8fff8] p-4 text-sm text-slate-700">{status}</div>
        ) : null}
      </div>
    </div>
  );
}
