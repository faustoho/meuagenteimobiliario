// Worker de entrada para o site estático.
// As rotas administrativas e de API serão implementadas em etapas futuras,
// com autenticação e autorização antes de qualquer acesso ao D1 ou R2.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
