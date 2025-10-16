🧾 Sistema de Membros

Aplicação simples para controle de membros e contribuições, desenvolvida com Node.js + Express + SQLite.

📌 Funcionalidades

Login de administrador com autenticação simples.

Cadastro, listagem, edição e exclusão de membros.

Registro e controle de contribuições por membro.

Resumo geral no dashboard (com totais e estatísticas).

Interface leve e responsiva, utilizando Bootstrap via CDN.

🚀 Como usar

Certifique-se de ter o Node.js 18+ instalado.

Extraia o projeto .zip ou clone o repositório.

No terminal, execute os comandos:

cd sistema-membros
npm install
npm start


Abra o navegador e acesse: http://localhost:4000

🔐 Login Padrão

Usuário: admin

Senha: 123

O banco de dados inicia zerado, sem registros de membros ou contribuições.

🧩 Estrutura do Projeto
sistema-membros/
├── server.js              # API + servidor estático
├── data/
│   ├── membros.db         # Banco SQLite (gerado automaticamente)
│   └── sessions.db        # Sessões locais
├── public/                # Páginas HTML (login, dashboard, etc.)
└── package.json

🔗 Rotas Principais (API)
Método	Rota	Descrição
POST	/api/login	Autentica o usuário
POST	/api/logout	Finaliza a sessão
GET	/api/me	Retorna dados do usuário logado
GET	/api/membros	Lista todos os membros
POST	/api/membros	Cadastra novo membro
PUT	/api/membros/:id	Atualiza dados do membro
DELETE	/api/membros/:id	Remove membro
GET	/api/contribuicoes	Lista contribuições (com nome do membro)
POST	/api/contribuicoes	Registra contribuição
DELETE	/api/contribuicoes/:id	Exclui contribuição
GET	/api/resumo	Dados do dashboard
⚙️ Observações

Sessões são armazenadas localmente em data/sessions.db.

Para produção, recomenda-se um store dedicado.

Para alterar a porta, edite a variável PORT no arquivo server.js.

Para redefinir a senha do admin:

Exclua o arquivo data/membros.db e reinicie com npm start, ou

Atualize diretamente no banco SQLite com um novo hash bcrypt.

💡 Objetivo do Projeto

Este sistema foi desenvolvido para praticar conceitos fundamentais de backend com Node.js, incluindo:

Criação de APIs RESTful com Express 🧠

Persistência de dados com SQLite 💾

Gerenciamento de sessões e autenticação 🔐

Organização modular de rotas e estrutura de projeto
