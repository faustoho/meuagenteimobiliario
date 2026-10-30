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
ou voltar a rascunho. O botão **Fotos** permite upload múltiplo, escolha de capa,
ordenação por setas e exclusão com confirmação. Salve capa/ordem antes de
fechar o gerenciamento. São aceitos JPG, PNG e WebP de até 8 MiB por arquivo,
com até 30 fotos por imóvel. O envio é sequencial e informa progresso e
eventuais envios parciais.
URLs aceitam somente HTTP/HTTPS sem credenciais.

A lista administrativa combina busca por título/referência/bairro/cidade
(ignorando acentos) com filtros de status, finalidade, tipo, cidade, faixas de
preço e área e mínimos de quartos, banheiros e vagas. Campos não informados
não atendem a um filtro numérico ativo. **Limpar filtros** restaura a lista;
**Atualizar lista** preserva os filtros selecionados. A filtragem é local e
não altera os dados dos imóveis nem o status de publicação.

O botão **Integrar imóvel da vitrine** chama `POST /api/admin/migrar-vitrine`
com sessão e validação de origem. A operação usa uma transação D1 (`batch`)
para inserir a referência 11472745 e registrar a foto local existente, sem
duplicações nem sobrescrever cadastros. A foto continua em
`public/imoveis/msn-11472745-capa.webp`; não depende de R2 nesta etapa.
O imóvel migrado mantém `publicado`, pois já é um anúncio público.
A vitrine consome `GET /api/imoveis`, sem login, com dados do D1 e apenas
registros com status `publicado`. Rascunhos, vendidos e inativos não são
retornados. As fotos seguem a ordem de principal, ordem e id. A vitrine abre
uma galeria com miniaturas, navegação por setas/botões e fechamento por Esc.
Fotos locais legadas em `/imoveis/` continuam disponíveis e preservadas.
Novos arquivos usam chaves aleatórias no bucket R2 `FOTOS`.
As respostas usam `Cache-Control: no-store`. A vitrine consulta novamente
ao abrir, atualizar ou voltar à aba. Uma falha da API exibe opção de tentar
novamente, sem voltar a anúncios estáticos potencialmente desativados.
Os dados de `src/data/imoveis.ts` permanecem como referência histórica da
migração e não alimentam mais a vitrine pública.

### Links individuais e compartilhamento

Cada card da vitrine oferece **Ver imóvel**, **Compartilhar no WhatsApp** e
**Copiar link**. O endereço `/imovel?id=<id D1>` é estável após editar título ou
referência e funciona com a exportação estática do Next.js. A página consulta
`GET /api/imoveis/:id`, com a mesma restrição de publicação da vitrine.
Anúncios vendidos, inativos, rascunhos ou inexistentes não expõem seus dados.
Falhas temporárias mostram opção de tentar novamente.

O compartilhamento prepara título, referência e URL no WhatsApp, deixando ao
usuário a escolha do destinatário e o envio. A cópia usa a área de transferência
do navegador; se indisponível, exibe o endereço para seleção manual.
O domínio do link é o da página aberta, permitindo a futura mudança de domínio.

As rotas `GET/POST /api/admin/imoveis` e `GET/PUT /api/admin/imoveis/:id`
exigem sessão válida. Operações de escrita
também validam origem e campos no servidor. Nenhuma alteração de esquema é
necessária para esta etapa.
`PATCH /api/admin/imoveis/:id/status` altera exclusivamente o status, com a
mesma proteção de sessão e origem. A criação e a edição de dados continuam
ignorando campos de status enviados fora dessa rota.

### API de fotos

- `GET/POST/PATCH /api/admin/imoveis/:id/fotos`: lista, envio binário de uma foto
  por requisição e gravação atômica da ordem/capa (`{ ids: number[], principal: number }`).
- `DELETE /api/admin/imoveis/:id/fotos/:fotoId`: exclui apenas uma foto daquele
  imóvel, escolhendo outra capa quando necessário.
- `GET/HEAD /api/admin/fotos/:fotoId`: imagem R2 com sessão administrativa.
- `GET/HEAD /api/fotos/:fotoId`: imagem R2 somente enquanto o imóvel está publicado.

As escritas validam sessão, origem e propriedade da foto no servidor. Uploads
têm limite de leitura e validação de MIME/assinatura, sem usar nomes fornecidos
pelo cliente como chaves. Se o registro D1 falhar, o upload R2 é removido.
A exclusão remove o registro D1 antes do objeto; falha posterior no R2 retorna
`cleanupPending` e registra um aviso para limpeza manual de objetos órfãos.
O objeto sem registro não fica acessível pelas rotas de imagens. A foto local
legada é removida somente do cadastro, nunca dos assets do repositório.
O bucket permanece privado, sem credenciais ou acesso direto no navegador.

Validação:

```bash
node --test worker/admin.test.mjs worker/properties.test.mjs
npm run build
```
