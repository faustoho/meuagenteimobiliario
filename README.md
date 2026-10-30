# Meu Agente Imobiliário

Site institucional e vitrine imobiliária. Projeto inicial com Next.js (App Router), TypeScript e Tailwind CSS.

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse http://localhost:3000.

## Estado atual

- Página inicial responsiva
- Rotas iniciais de imóveis, compra, venda e contato
- Identidade visual provisória

## Próximas etapas

- Validar identidade visual, conteúdo e foto autorizada do corretor
- Adicionar cadastro de imóveis e links externos
- Implementar formulários com persistência e proteção contra spam
- Configurar WhatsApp e painel administrativo com autenticação segura
- Publicar e conectar o domínio

**Segurança:** nunca publique senhas, tokens, dados de clientes ou arquivos `.env` no repositório.

## Painel administrativo

O `/admin` usa uma sessão assinada no Worker. Cadastre `ADMIN_PASSWORD` e
`SESSION_SECRET` em **Settings → Runtime variables and secrets → Production**,
como Secret. Os segredos da seção **Builds** não ficam disponíveis no runtime.
Os valores nunca devem ser incluídos no código ou nos logs.

O painel lista os registros da tabela D1 `imoveis` e permite criar um rascunho
com os dados principais. A criação sempre grava `rascunho`; não publica na
vitrine. A vitrine estática e o imóvel de referência 11472745 permanecem
preservados até a etapa de migração. Edição, fotografias e publicação serão
implementadas nas próximas etapas.

As rotas `GET/POST /api/admin/imoveis` exigem sessão válida. Operações de escrita
também validam origem e campos no servidor. Nenhuma alteração de esquema é
necessária para esta etapa.

Validação:

```bash
node --test worker/admin.test.mjs
npm run build
```
