# ⚠️ Git não encontrado - SOLUÇÃO RÁPIDA

## 🔴 Problema
PowerShell não consegue encontrar Git (comando não reconhecido)

---

## ✅ SOLUÇÃO 1: Use o Script Batch (MAIS FÁCIL)

```batch
deploy.bat
```

Duplo clique no arquivo `deploy.bat` que criamos. Ele usa Git Bash automaticamente.

---

## ✅ SOLUÇÃO 2: Abra Git Bash Manualmente

1. **Clique com botão direito** na pasta MedSupAPP
2. Selecione: **"Git Bash Here"**
3. Cole os comandos:

```bash
git add vercel.json next.config.ts .gitignore VERCEL_DEPLOYMENT_GUIDE.md
git commit -m "feat: Configurar Vercel para deploy automatico"
git push origin main
```

(Ou `master` se for esse o branch)

---

## ✅ SOLUÇÃO 3: Instale Git Corretamente

### Windows:

1. **Baixe:** https://git-scm.com/download/win
2. **Instale** com opção: "Add Git to PATH"
3. **Reinicie o PowerShell**
4. **Execute:** `.\deploy.ps1`

---

## ✅ SOLUÇÃO 4: Abra Terminal VS Code

1. **Abra VS Code** no projeto
2. **Terminal → New Terminal**
3. **Mude para Bash:** (clique na aba "PowerShell" em baixo)
4. **Execute:**

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🎯 RECOMENDADO: Use o .bat

**Mais fácil e funciona agora:**

```
C:\Users\pedro\OneDrive\Documents\medsupapp\deploy.bat
```

Duplo clique = Deploy automático ✅

---

## ❓ Qual você prefere?

- **Mais rápido (2 cliques):** deploy.bat
- **Mais control:** Git Bash Here
- **Terminal VS Code:** Copiar/colar comandos

Qualquer uma funciona! 🚀
