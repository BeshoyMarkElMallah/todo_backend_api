const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const cors = require('cors');

// Configuration
const app = express();
const port = 3000;
const dbPath = path.resolve(__dirname, 'todos.db');

// Middleware
app.use(cors()); 
app.use(express.json());

let db;

// --- Database Initialization ---
async function initializeDatabase() {
  try {
    // Open the database connection using the sqlite library with the sqlite3 driver
    db = await sqlite.open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('Successfully connected to SQLite database:', dbPath);

    // Create the Todos table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        todo TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT 0,
        userId INTEGER NOT NULL DEFAULT 1
      );
    `);
    console.log('Todo table checked/created.');

  } catch (e) {
    console.error('Database connection or initialization failed:', e);
  }
}

// --- API Endpoints (CRUD) ---

// 1. GET ALL: /todos
app.get('/todos', async (req, res) => {
  try {
    const todos = await db.all('SELECT * FROM todos ORDER BY id DESC');
    res.json({ 
        todos: todos, 
        total: todos.length, 
        skip: 0, 
        limit: todos.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch todos.', error: error.message });
  }
});

// 2. GET ONE: /todos/:id
app.get('/todos/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const todo = await db.get('SELECT * FROM todos WHERE id = ?', id);
    if (todo) {
      res.json(todo);
    } else {
      res.status(404).json({ message: `Todo with id ${id} not found.` });
    }
  } catch (error) {
    res.status(500).json({ message: `Failed to fetch todo ${id}.`, error: error.message });
  }
});

// 3. CREATE: /todos/add
app.post('/todos/add', async (req, res) => {
  const { todo, completed = false, userId = 1 } = req.body;

  if (!todo || typeof completed !== 'boolean' || typeof userId !== 'number') {
    return res.status(400).json({ message: 'Invalid data provided.' });
  }

  try {
    // Insert the new todo and get the ID of the new row
    const result = await db.run(
      'INSERT INTO todos (todo, completed, userId) VALUES (?, ?, ?)',
      [todo, completed ? true : false, userId]
    );

    // Retrieve the newly created todo item using the last ID
    const newTodo = await db.get('SELECT * FROM todos WHERE id = ?', result.lastID);

    res.status(200).json(newTodo);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create todo.', error: error.message });
  }
});

// 4. UPDATE: /todos/:id
app.put('/todos/:id', async (req, res) => {
  const id = req.params.id;
  const { todo, completed } = req.body;
  const updates = [];
  const params = [];

  if (todo !== undefined) {
    updates.push('todo = ?');
    params.push(todo);
  }

  if (completed !== undefined) {
    updates.push('completed = ?');
    // SQLite stores booleans as 0 or 1
    params.push(completed ? true : false); 
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update provided.' });
  }

  params.push(id); 

  try {
    await db.run(
      `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Return the updated item
    const updatedTodo = await db.get('SELECT * FROM todos WHERE id = ?', id);

    res.status(200).json(updatedTodo);
  } catch (error) {
    res.status(500).json({ message: `Failed to update todo ${id}.`, error: error.message });
  }
});

// 5. DELETE: /todos/:id
app.delete('/todos/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // Delete the todo
    await db.run('DELETE FROM todos WHERE id = ?', id);

    res.status(200).json({ id: parseInt(id), isDeleted: true });
  } catch (error) {
    res.status(500).json({ message: `Failed to delete todo ${id}.`, error: error.message });
  }
});


// --- Start Server ---
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Node.js Todo API listening at http://localhost:${port}`);
    console.log(`Access the list at http://localhost:${port}/todos`);
  });
});