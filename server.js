
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;


// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
  secret: 'sistema-membros-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2h
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// DB setup
const dbFile = path.join(__dirname, 'data', 'membros.db');
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new sqlite3.Database(dbFile);

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'admin', -- admin, tesoureiro, membro
    ativo INTEGER NOT NULL DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS membros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT,
    endereco TEXT,
    funcao TEXT,
    data_entrada TEXT,
    observacoes TEXT,
    ativo INTEGER NOT NULL DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contribuicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    membro_id INTEGER NOT NULL,
    tipo TEXT NOT NULL, -- dizimo | oferta | outro
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    observacoes TEXT,
    FOREIGN KEY(membro_id) REFERENCES membros(id)
  )`);

  // Ensure admin user exists (password: 123)
  const adminPass = bcrypt.hashSync('123', 10);
  db.get(`SELECT id FROM usuarios WHERE username = ?`, ['admin'], (err, row) => {
    if (err) { console.error('Erro ao consultar admin:', err); return; }
    if (!row) {
      db.run(`INSERT INTO usuarios (username, senha_hash, perfil) VALUES (?, ?, 'admin')`,
        ['admin', adminPass],
        (err2) => {
          if (err2) console.error('Erro ao criar admin:', err2);
        });
    }
  });
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Não autenticado' });
}

// Routes - Auth
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM usuarios WHERE username = ? AND ativo = 1`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no banco' });
    if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    const ok = bcrypt.compareSync(password, user.senha_hash);
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    req.session.user = { id: user.id, username: user.username, perfil: user.perfil };
    res.json({ message: 'Logado', user: req.session.user });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logout efetuado' }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

// Routes - Membros
app.get('/api/membros', requireAuth, (req, res) => {
  db.all(`SELECT * FROM membros ORDER BY nome`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao listar' });
    res.json(rows);
  });
});

app.post('/api/membros', requireAuth, (req, res) => {
  const { nome, telefone, endereco, funcao, data_entrada, observacoes, ativo = 1 } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  db.run(`INSERT INTO membros (nome, telefone, endereco, funcao, data_entrada, observacoes, ativo)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [nome, telefone, endereco, funcao, data_entrada, observacoes, ativo],
          function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao inserir' });
            res.json({ id: this.lastID });
          });
});

app.put('/api/membros/:id', requireAuth, (req, res) => {
  const { nome, telefone, endereco, funcao, data_entrada, observacoes, ativo = 1 } = req.body;
  db.run(`UPDATE membros SET nome=?, telefone=?, endereco=?, funcao=?, data_entrada=?, observacoes=?, ativo=? WHERE id=?`,
    [nome, telefone, endereco, funcao, data_entrada, observacoes, ativo, req.params.id],
    function(err){
      if (err) return res.status(500).json({ error: 'Erro ao atualizar' });
      res.json({ changes: this.changes });
    });
});

app.delete('/api/membros/:id', requireAuth, (req, res) => {
  db.run(`DELETE FROM membros WHERE id=?`, [req.params.id], function(err){
    if (err) return res.status(500).json({ error: 'Erro ao excluir' });
    res.json({ changes: this.changes });
  });
});

// Routes - Contribuições
app.get('/api/contribuicoes', requireAuth, (req, res) => {
  db.all(`SELECT c.*, m.nome as membro_nome 
          FROM contribuicoes c 
          JOIN membros m ON m.id = c.membro_id
          ORDER BY date(c.data) DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao listar' });
    res.json(rows);
  });
});

app.post('/api/contribuicoes', requireAuth, (req, res) => {
  const { membro_id, tipo, valor, data, observacoes } = req.body;
  if (!membro_id || !tipo || !valor || !data) return res.status(400).json({ error: 'Campos obrigatórios: membro_id, tipo, valor, data' });
  db.run(`INSERT INTO contribuicoes (membro_id, tipo, valor, data, observacoes)
          VALUES (?, ?, ?, ?, ?)`,
          [membro_id, tipo, valor, data, observacoes],
          function(err){
            if (err) return res.status(500).json({ error: 'Erro ao inserir' });
            res.json({ id: this.lastID });
          });
});

app.delete('/api/contribuicoes/:id', requireAuth, (req, res) => {
  db.run(`DELETE FROM contribuicoes WHERE id=?`, [req.params.id], function(err){
    if (err) return res.status(500).json({ error: 'Erro ao excluir' });
    res.json({ changes: this.changes });
  });
});

// Routes - Dashboard/Resumo
app.get('/api/resumo', requireAuth, (req, res) => {
  const resumo = {};
  db.get(`SELECT COUNT(*) as total FROM membros WHERE ativo=1`, [], (err, row1) => {
    if (err) return res.status(500).json({ error: 'Erro no resumo 1' });
    resumo.totalMembros = row1.total;

    // Entradas no mês atual
    db.get(`SELECT IFNULL(SUM(valor), 0) as totalMes FROM contribuicoes 
            WHERE strftime('%Y-%m', data) = strftime('%Y-%m', 'now')`, [], (err2, row2) => {
      if (err2) return res.status(500).json({ error: 'Erro no resumo 2' });
      resumo.totalMes = row2.totalMes;

      // Últimas 5 contribuições
      db.all(`SELECT c.*, m.nome as membro_nome 
              FROM contribuicoes c JOIN membros m ON m.id=c.membro_id
              ORDER BY date(c.data) DESC LIMIT 5`, [], (err3, rows3) => {
        if (err3) return res.status(500).json({ error: 'Erro no resumo 3' });
        resumo.ultimas = rows3;
        res.json(resumo);
      });
    });
  });
});

// Fallback to login
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
