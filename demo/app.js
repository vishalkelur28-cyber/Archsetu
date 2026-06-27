// =============================================================================
// ArchSetu Demo File — app.js
// =============================================================================
// This file is made specifically to test every ArchSetu feature.
// Open this file in VS Code, install ArchSetu, and try each command below.
//
// HOW TO TEST:
//   1. Open this file in VS Code
//   2. Press Ctrl+Shift+P
//   3. Type "ArchSetu" and try each command
//   4. Watch the status bar at the bottom — it shows live complexity
// =============================================================================

const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const app    = express();
const router = express.Router();

app.use(express.json());

// =============================================================================
// DATABASE (fake in-memory database for demo purposes)
// =============================================================================

const users = [
    { id: 1, name: 'Alice',   email: 'alice@example.com', password: 'hashed_pw_1', role: 'admin' },
    { id: 2, name: 'Bob',     email: 'bob@example.com',   password: 'hashed_pw_2', role: 'user'  },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', password: 'hashed_pw_3', role: 'user' },
];

const posts = [
    { id: 1, userId: 1, title: 'Hello World',    body: 'My first post', likes: 10 },
    { id: 2, userId: 2, title: 'Getting Started', body: 'How to code',  likes: 5  },
];

const SECRET_KEY = 'archsetu-demo-secret';

// =============================================================================
// SECTION 1 — AUTHENTICATION FUNCTIONS
// Place your cursor inside any function below and watch the status bar change.
// These functions have different complexity scores — try navigating between them.
// =============================================================================

// Simple function — complexity score will be LOW (1-3)
// Status bar should show green when cursor is here
function getUserById(id) {
    return users.find(user => user.id === id);
}

// Simple function — complexity score LOW
function getAllUsers() {
    return users.filter(user => user.role === 'user');
}

// Medium complexity — has multiple conditions and checks
// Status bar should show orange when cursor is here
function validateUserInput(email, password, role) {
    if (!email || !password) {
        return { valid: false, error: 'Email and password are required' };
    }

    if (!email.includes('@')) {
        return { valid: false, error: 'Invalid email format' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (role && role !== 'admin' && role !== 'user') {
        return { valid: false, error: 'Role must be admin or user' };
    }

    return { valid: true };
}

// High complexity — many branches and conditions
// Status bar should show RED when cursor is anywhere in this function
// This is a good example of a function that SHOULD be split into smaller pieces
function authenticateUser(email, password, options) {
    if (!email || !password) {
        return { success: false, error: 'Missing credentials' };
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    // Check if account is locked (too many failed attempts)
    if (user.failedAttempts && user.failedAttempts >= 5) {
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return { success: false, error: 'Account locked. Try again later.' };
        } else {
            // Lock period expired — reset the counter
            user.failedAttempts = 0;
            user.lockUntil = null;
        }
    }

    // Validate the password
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
        // Track failed attempts
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        if (user.failedAttempts >= 5) {
            user.lockUntil = Date.now() + (30 * 60 * 1000); // lock for 30 minutes
        }
        return { success: false, error: 'Incorrect password' };
    }

    // Check role-based access
    if (options && options.requireAdmin && user.role !== 'admin') {
        return { success: false, error: 'Admin access required' };
    }

    // Reset failed attempts on success
    user.failedAttempts = 0;

    // Create JWT token
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: options && options.rememberMe ? '30d' : '24h' }
    );

    return { success: true, token, user: { id: user.id, name: user.name, role: user.role } };
}

// Medium complexity
function createToken(userId, role, expiresIn) {
    if (!userId || !role) {
        throw new Error('userId and role are required to create a token');
    }

    const payload = { id: userId, role };

    if (role === 'admin') {
        payload.permissions = ['read', 'write', 'delete'];
    } else {
        payload.permissions = ['read'];
    }

    return jwt.sign(payload, SECRET_KEY, { expiresIn: expiresIn || '24h' });
}

// Simple function
function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (err) {
        return null;
    }
}

// =============================================================================
// SECTION 2 — POST FUNCTIONS
// These call functions from Section 1 — great for testing the Call Graph feature.
// Run "ArchSetu: Function Graph (This File)" to see how they connect.
// =============================================================================

// Simple — calls getUserById
function getPostsByUser(userId) {
    const user = getUserById(userId);
    if (!user) { return []; }
    return posts.filter(post => post.userId === userId);
}

// Medium complexity — calls multiple other functions
function createPost(userId, title, body) {
    const user = getUserById(userId);

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    if (!title || title.trim().length === 0) {
        return { success: false, error: 'Title is required' };
    }

    if (!body || body.trim().length === 0) {
        return { success: false, error: 'Body is required' };
    }

    const newPost = {
        id: posts.length + 1,
        userId,
        title: title.trim(),
        body: body.trim(),
        likes: 0,
        createdAt: new Date().toISOString(),
    };

    posts.push(newPost);
    return { success: true, post: newPost };
}

// Calls verifyToken and getUserById — shows cross-function dependencies
function likePost(postId, token) {
    const decoded = verifyToken(token);
    if (!decoded) {
        return { success: false, error: 'Invalid or expired token' };
    }

    const post = posts.find(p => p.id === postId);
    if (!post) {
        return { success: false, error: 'Post not found' };
    }

    post.likes += 1;
    return { success: true, likes: post.likes };
}

// =============================================================================
// SECTION 3 — DEAD CODE (for testing "Find Dead Code" command)
// The functions below are NEVER called anywhere in this file.
// Run "ArchSetu: Find Dead Code" — these should appear in the results.
// =============================================================================

// This function is never called — it is dead code
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN');
}

// This function is never called — it is dead code
function calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const words = text.split(' ').length;
    return Math.ceil(words / wordsPerMinute);
}

// This function is never called — it is dead code
function legacyLogin(username, password) {
    // Old login system — replaced by authenticateUser()
    // Should have been deleted but was forgotten
    if (username === 'admin' && password === 'admin123') {
        return true;
    }
    return false;
}

// =============================================================================
// SECTION 4 — HTTP ROUTES (for testing "Detect Entry Points" command)
// Run "ArchSetu: Detect Entry Points" to see all these routes listed.
// =============================================================================

// POST /api/login — entry point
router.post('/api/login', (req, res) => {
    const { email, password, rememberMe } = req.body;
    const validation = validateUserInput(email, password);

    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    const result = authenticateUser(email, password, { rememberMe });

    if (!result.success) {
        return res.status(401).json({ error: result.error });
    }

    return res.status(200).json({ token: result.token, user: result.user });
});

// GET /api/users — entry point
router.get('/api/users', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    return res.status(200).json({ users: getAllUsers() });
});

// GET /api/posts/:userId — entry point
router.get('/api/posts/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userPosts = getPostsByUser(userId);
    return res.status(200).json({ posts: userPosts });
});

// POST /api/posts — entry point
router.post('/api/posts', (req, res) => {
    const { title, body } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = createPost(decoded.id, title, body);

    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    return res.status(201).json(result);
});

// POST /api/posts/:id/like — entry point
router.post('/api/posts/:id/like', (req, res) => {
    const postId = parseInt(req.params.id);
    const token  = req.headers.authorization?.replace('Bearer ', '');
    const result = likePost(postId, token);

    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    return res.status(200).json(result);
});

// =============================================================================
// SECTION 5 — APP START
// =============================================================================

app.use(router);

// main() — also detected as an entry point by ArchSetu
function main() {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main();
