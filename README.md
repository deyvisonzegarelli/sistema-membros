# Sistema de Membros (Node.js + Express + SQLite)

## Requisitos
- Node.js 18+
- Internet para carregar CSS/JS via CDN (Bootstrap)

## Como rodar
1. Extraia o `.zip`.
2. No terminal, acesse a pasta:
   ```bash
   cd sistema-membros
   npm install
   npm start
   ```
3. Abra no navegador: http://localhost:4000

## Login
- Usuário: **admin**
- Senha: **123**

> O banco começa **zerado** (sem membros e sem contribuições).

## Estrutura
- `server.js` — API + servidor estático
- `data/membros.db` — SQLite (criado automaticamente na primeira execução)
- `public/` — páginas HTML (login, dashboard, membros, contribuições)

## Rotas principais (API)
- `POST /api/login` `{ username, password }`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/membros` — lista
- `POST /api/membros` — cria
- `PUT /api/membros/:id` — atualiza
- `DELETE /api/membros/:id` — remove
- `GET /api/contribuicoes` — lista (com nome do membro)
- `POST /api/contribuicoes` — cria
- `DELETE /api/contribuicoes/:id` — remove
- `GET /api/resumo` — dados do dashboard

## Observações
- Sessões são salvas em arquivo (`data/sessions.db`). Para ambiente de produção, considere um store dedicado.
- Para trocar a porta, edite `PORT` no `server.js`.
- Para trocar a senha do admin:
  - Apague o arquivo `data/membros.db` e rode `npm start` novamente **OU**
  - Atualize direto no banco com uma ferramenta SQLite e um hash bcrypt da nova senha.
