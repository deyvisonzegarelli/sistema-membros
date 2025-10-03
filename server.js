const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const path = require("path");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

// 🔹 Conexão PostgreSQL (Render fornece a URL no env DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render exige SSL
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: "session"
    }),
    secret: "sistema-membros-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2h
  })
);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// 🔹 Inicializar tabelas
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'admin',
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS membros (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT,
      endereco TEXT,
      funcao TEXT,
      data_entrada DATE,
      observacoes TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contribuicoes (
      id SERIAL PRIMARY KEY,
      membro_id INTEGER REFERENCES membros(id),
      tipo TEXT NOT NULL,
      valor NUMERIC NOT NULL,
      data DATE NOT NULL,
      observacoes TEXT
    );
  `);

  // 🔹 Criar admin se não existir
  const res = await pool.query("SELECT id FROM usuarios WHERE username = $1", [
    "admin"
  ]);
  if (res.rows.length === 0) {
    const hash = bcrypt.hashSync("123", 10);
    await pool.query(
      "INSERT INTO usuarios (username, senha_hash, perfil) VALUES ($1, $2, 'admin')",
      ["admin", hash]
    );
    console.log("✅ Usuário admin criado (senha: 123)");
  }
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: "Não autenticado" });
}

// 🔹 Rotas de autenticação
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE username = $1 AND ativo = TRUE",
      [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const ok = bcrypt.compareSync(password, user.senha_hash);
    if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    req.session.user = { id: user.id, username: user.username, perfil: user.perfil };
    res.json({ message: "Logado", user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: "Erro no login" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logout efetuado" }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});

// 🔹 Rotas de Membros
app.get("/api/membros", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM membros ORDER BY nome");
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar" });
  }
});

app.post("/api/membros", requireAuth, async (req, res) => {
  const { nome, telefone, endereco, funcao, data_entrada, observacoes, ativo = true } = req.body;
  if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });
  try {
    const result = await pool.query(
      `INSERT INTO membros (nome, telefone, endereco, funcao, data_entrada, observacoes, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [nome, telefone, endereco, funcao, data_entrada, observacoes, ativo]
    );
    res.json({ id: result.rows[0].id });
  } catch {
    res.status(500).json({ error: "Erro ao inserir" });
  }
});

app.put("/api/membros/:id", requireAuth, async (req, res) => {
  const { nome, telefone, endereco, funcao, data_entrada, observacoes, ativo = true } = req.body;
  try {
    await pool.query(
      `UPDATE membros SET nome=$1, telefone=$2, endereco=$3, funcao=$4, data_entrada=$5, observacoes=$6, ativo=$7 WHERE id=$8`,
      [nome, telefone, endereco, funcao, data_entrada, observacoes, ativo, req.params.id]
    );
    res.json({ message: "Atualizado" });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar" });
  }
});

app.delete("/api/membros/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM membros WHERE id=$1", [req.params.id]);
    res.json({ message: "Excluído" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir" });
  }
});

// 🔹 Rotas de Contribuições
app.get("/api/contribuicoes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, m.nome as membro_nome
       FROM contribuicoes c
       JOIN membros m ON m.id = c.membro_id
       ORDER BY date(c.data) DESC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar" });
  }
});

app.post("/api/contribuicoes", requireAuth, async (req, res) => {
  const { membro_id, tipo, valor, data, observacoes } = req.body;
  if (!membro_id || !tipo || !valor || !data)
    return res.status(400).json({ error: "Campos obrigatórios: membro_id, tipo, valor, data" });

  try {
    const result = await pool.query(
      `INSERT INTO contribuicoes (membro_id, tipo, valor, data, observacoes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [membro_id, tipo, valor, data, observacoes]
    );
    res.json({ id: result.rows[0].id });
  } catch {
    res.status(500).json({ error: "Erro ao inserir" });
  }
});

app.delete("/api/contribuicoes/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM contribuicoes WHERE id=$1", [req.params.id]);
    res.json({ message: "Excluído" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir" });
  }
});

// 🔹 Resumo
app.get("/api/resumo", requireAuth, async (req, res) => {
  try {
    const totalMembros = await pool.query("SELECT COUNT(*) as total FROM membros WHERE ativo=TRUE");
    const totalMes = await pool.query(
      `SELECT COALESCE(SUM(valor),0) as totalMes
       FROM contribuicoes WHERE date_trunc('month', data) = date_trunc('month', CURRENT_DATE)`
    );
    const ultimas = await pool.query(
      `SELECT c.*, m.nome as membro_nome
       FROM contribuicoes c JOIN membros m ON m.id=c.membro_id
       ORDER BY date(c.data) DESC LIMIT 5`
    );

    res.json({
      totalMembros: totalMembros.rows[0].total,
      totalMes: totalMes.rows[0].totalmes,
      ultimas: ultimas.rows
    });
  } catch {
    res.status(500).json({ error: "Erro no resumo" });
  }
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
});
