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

O painel lista os registros D1 e permite criar e editar os dados completos:
referência, título, descrição, tipo, finalidade, cidade, bairro, preço, área,
quartos, banheiros, vagas e URL de origem. A criação sempre grava `rascunho`;
a edição preserva o status e as fotografias. O seletor de status exige
**Aplicar status** e confirmação para publicar, desativar, marcar como vendido
ou voltar a rascunho. Upload de fotografias fica para a próxima etapa.
URLs aceitam somente HTTP/HTTPS sem credenciais.

O botão **Integrar imóvel da vitrine** chama `POST /api/admin/migrar-vitrine`
com sessão e validação de origem. A operação usa uma transação D1 (`batch`)
para inserir a referência 11472745 e registrar a foto local existente, sem
duplicações nem sobrescrever cadastros. A foto continua em
`public/imoveis/msn-11472745-capa.webp`; não depende de R2 nesta etapa.
O imóvel migrado mantém `publicado`, pois já é um anúncio público.
A vitrine consome `GET /api/imoveis`, sem login, com dados do D1 e apenas
registros com status `publicado`. Rascunhos, vendidos e inativos não são
retornados. As fotos seguem a ordem de principal, ordem e id. Nesta fase,
são servidas apenas fotos locais validadas em `/imoveis/`.
As respostas usam `Cache-Control: no-store`. A vitrine consulta novamente
ao abrir, atualizar ou voltar à aba. Uma falha da API exibe opção de tentar
novamente, sem voltar a anúncios estáticos potencialmente desativados.
Os dados de `src/data/imoveis.ts` permanecem como referência histórica da
migração e não alimentam mais a vitrine pública.

As rotas `GET/POST /api/admin/imoveis` e `GET/PUT /api/admin/imoveis/:id`
exigem sessão válida. Operações de escrita
também validam origem e campos no servidor. Nenhuma alteração de esquema é
necessária para esta etapa.
`PATCH /api/admin/imoveis/:id/status` altera exclusivamente o status, com a
mesma proteção de sessão e origem. A criação e a edição de dados continuam
ignorando campos de status enviados fora dessa rota.

Validação:

```bash
node --test worker/admin.test.mjs worker/properties.test.mjs
npm run build
```
