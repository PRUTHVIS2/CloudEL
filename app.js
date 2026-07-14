// ===== SmartSpend App with Auth =====
const API_URL = "https://s6p8e9xtw3.execute-api.ap-south-1.amazonaws.com/prod/expenses";
const USERS_KEY = 'smartspend_users';
const SESSION_KEY = 'smartspend_session';
let currentUser = null;
let expenses = [];
let monthlyBudget = 10000;
let deleteTargetId = null;

// Category config
const CATEGORIES = {
    Food: { emoji: '🍔', color: '#f59e0b' },
    Travel: { emoji: '✈️', color: '#06b6d4' },
    Shopping: { emoji: '🛍️', color: '#ec4899' },
    Bills: { emoji: '📄', color: '#6366f1' },
    Entertainment: { emoji: '🎬', color: '#a855f7' },
    Health: { emoji: '🏥', color: '#22c55e' },
    Education: { emoji: '📚', color: '#3b82f6' },
    Other: { emoji: '📦', color: '#94a3b8' }
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    bindAuth();
    checkSession();
});

// ========================================
// AUTH MODULE
// ========================================

function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function hashPassword(pw) {
    // Simple hash for demo — in production, use AWS Cognito
    let hash = 0;
    for (let i = 0; i < pw.length; i++) {
        const char = pw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

function bindAuth() {
    // Toggle between login & signup
    document.getElementById('show-signup').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('signup-card').style.display = 'block';
        document.getElementById('signup-card').style.animation = 'slideUp .4s ease';
    });
    document.getElementById('show-login').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('signup-card').style.display = 'none';
        document.getElementById('login-card').style.display = 'block';
        document.getElementById('login-card').style.animation = 'slideUp .4s ease';
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        const users = getUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            showToast('No account found with this email', 'error');
            return;
        }
        if (user.passwordHash !== hashPassword(password)) {
            showToast('Incorrect password', 'error');
            return;
        }

        // Success
        loginUser(user);
    });

    // Signup form
    document.getElementById('signup-form').addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim().toLowerCase();
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;

        if (password !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }

        const users = getUsers();
        if (users.find(u => u.email === email)) {
            showToast('An account with this email already exists', 'error');
            return;
        }

        const newUser = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name,
            email,
            passwordHash: hashPassword(password),
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);
        loginUser(newUser);
        showToast(`Welcome to SmartSpend, ${name}! 🎉`, 'success');
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        logoutUser();
    });
}

function checkSession() {
    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (sessionEmail) {
        const users = getUsers();
        const user = users.find(u => u.email === sessionEmail);
        if (user) {
            loginUser(user, true);
            return;
        }
    }
    showAuthScreen();
}

async function loginUser(user, isResumed = false) {
    currentUser = user;
    localStorage.setItem(SESSION_KEY, user.email);

    // Load user-scoped data
    await loadExpensesFromCloud(user.id);
    monthlyBudget = Number(localStorage.getItem(`budget_${user.id}`)) || 10000;

    // Update sidebar profile
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;

    // Show app, hide auth
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';

    // Init app
    setCurrentDate();
    setDefaultDate();
    bindNavigation();
    bindForm();
    bindQuickAdd();
    bindModals();
    bindSearch();
    bindMobileMenu();
    bindSettings();
    bindExport();
    updateGreeting();
    populateSettings();
    refreshAll();

    if (!isResumed) {
        showToast(`Welcome back, ${user.name}!`, 'success');
    }
}

function logoutUser() {
    currentUser = null;
    expenses = [];
    localStorage.removeItem(SESSION_KEY);

    // Reset app state
    document.getElementById('app-shell').style.display = 'none';
    showAuthScreen();
    showToast('Logged out successfully', 'info');

    // Clear forms
    document.getElementById('login-form').reset();
    document.getElementById('signup-form').reset();
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('login-card').style.display = 'block';
    document.getElementById('signup-card').style.display = 'none';
}

// ========================================
// APP LOGIC (unchanged except storage is user-scoped)
// ========================================

// ===== Navigation =====
function bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchPage(link.dataset.page);
        });
    });
}

function switchPage(pageName) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
    if (activeLink) activeLink.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.remove('active');
        void page.offsetWidth;
        page.classList.add('active');
    }

    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger-btn');
    sidebar.classList.remove('open');
    hamburger.classList.remove('open');

    refreshAll();
}

// ===== Mobile Menu =====
function bindMobileMenu() {
    const btn = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    btn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        btn.classList.toggle('open');
    });
    document.getElementById('main-content').addEventListener('click', () => {
        sidebar.classList.remove('open');
        btn.classList.remove('open');
    });
}

// ===== Date Helpers =====
function setCurrentDate() {
    const d = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = d.toLocaleDateString('en-IN', options);
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expense-date').value = today;
}

// ===== Form =====
function bindForm() {
    document.getElementById('expense-form').addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('expense-title').value.trim();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const date = document.getElementById('expense-date').value;
        const category = document.getElementById('expense-category').value;
        const note = document.getElementById('expense-note').value.trim();

        if (!title || !amount || !date || !category) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        const expense = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            title, amount, date, category, note,
            createdAt: new Date().toISOString()
        };

        await addExpenseToCloud(expense);

        document.getElementById('expense-form').reset();
        setDefaultDate();
    });
}

// ===== Quick Add =====
function bindQuickAdd() {
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('expense-title').value = btn.dataset.title;
            document.getElementById('expense-amount').value = btn.dataset.amount;
            document.getElementById('expense-category').value = btn.dataset.category;
            setDefaultDate();
            showToast('Quick fill applied — review & submit', 'info');
        });
    });
}

// ===== Search & Filter =====
function bindSearch() {
    document.getElementById('search-expenses').addEventListener('input', renderHistory);
    document.getElementById('filter-category').addEventListener('change', renderHistory);
}

// ===== Modals =====
function bindModals() {
    document.getElementById('btn-cancel-delete').addEventListener('click', () => closeModal('delete-modal'));
    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
        if (deleteTargetId) {
            await deleteExpenseFromCloud(deleteTargetId);
            deleteTargetId = null;
        }
        closeModal('delete-modal');
    });

    document.getElementById('stat-budget').addEventListener('click', () => {
        document.getElementById('budget-input').value = monthlyBudget;
        openModal('budget-modal');
    });
    document.getElementById('btn-cancel-budget').addEventListener('click', () => closeModal('budget-modal'));
    document.getElementById('btn-save-budget').addEventListener('click', () => {
        const val = parseInt(document.getElementById('budget-input').value);
        if (val && val > 0) {
            monthlyBudget = val;
            if (currentUser) localStorage.setItem(`budget_${currentUser.id}`, monthlyBudget);
            refreshAll();
            showToast(`Budget set to ₹${val.toLocaleString('en-IN')}`, 'success');
        }
        closeModal('budget-modal');
    });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===== User-Scoped Storage =====
async function saveExpenses() {
    // No longer needed — DynamoDB saves automatically via Lambda 
}

async function loadExpensesFromCloud(userId) {
    try {
        const res = await fetch(`${API_URL}?userId=${userId}`);
        const data = await res.json();
        expenses = data.map(e => ({
            id: e.id,
            title: e.title,
            amount: parseFloat(e.amount),
            category: e.category,
            date: e.date,
            note: e.note || "",
            createdAt: e.date
        }));
        refreshAll();
    } catch (err) {
        console.error("Failed to load expenses:", err);
        showToast("Could not load expenses from cloud", "error");
    }
}

async function addExpenseToCloud(expense) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: expense.title,
                amount: expense.amount,
                category: expense.category,
                date: expense.date,
                note: expense.note || "",
                userId: currentUser.id
            })
        });
        if (res.ok) {
            showToast(`Added "${expense.title}" — ₹${expense.amount}`, "success");
            await loadExpensesFromCloud(currentUser.id);
        }
    } catch (err) {
        showToast("Failed to add expense", "error");
    }
}

async function deleteExpenseFromCloud(id) {
    try {
        const res = await fetch(API_URL, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        if (res.ok) {
            showToast("Expense deleted", "success");
            await loadExpensesFromCloud(currentUser.id);
        }
    } catch (err) {
        showToast("Failed to delete expense", "error");
    }
}

// ===== Refresh Everything =====
function refreshAll() {
    updateStats();
    renderRecentList();
    renderHistory();
    renderCategoryChart();
    renderMonthlyChart();
    renderAnalytics();
    updateQuickStats();
}

// ===== Stats =====
function updateStats() {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const now = new Date();
    const monthExp = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, e) => s + e.amount, 0);

    document.getElementById('total-expenses').textContent = `₹${total.toLocaleString('en-IN')}`;
    document.getElementById('month-expenses').textContent = `₹${monthExp.toLocaleString('en-IN')}`;
    document.getElementById('total-transactions').textContent = expenses.length;

    const budgetLeft = Math.max(0, monthlyBudget - monthExp);
    document.getElementById('budget-left').textContent = `₹${budgetLeft.toLocaleString('en-IN')}`;
    const pct = Math.min(100, (monthExp / monthlyBudget) * 100);
    const fill = document.getElementById('budget-fill');
    fill.style.width = pct + '%';
    if (pct > 80) fill.style.background = 'linear-gradient(90deg,#f59e0b,#ef4444)';
    else fill.style.background = 'linear-gradient(90deg,#22c55e,#f59e0b)';
}

// ===== Quick Stats (Form Page) =====
function updateQuickStats() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayTotal = expenses.filter(e => e.date === todayStr).reduce((s, e) => s + e.amount, 0);

    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekTotal = expenses.filter(e => new Date(e.date) >= weekAgo).reduce((s, e) => s + e.amount, 0);

    const monthTotal = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, e) => s + e.amount, 0);

    document.getElementById('today-spending').textContent = `₹${todayTotal.toLocaleString('en-IN')}`;
    document.getElementById('week-spending').textContent = `₹${weekTotal.toLocaleString('en-IN')}`;
    document.getElementById('form-month-spending').textContent = `₹${monthTotal.toLocaleString('en-IN')}`;
}

// ===== Recent List (Dashboard) =====
function renderRecentList() {
    const container = document.getElementById('recent-list');
    const sorted = [...expenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

    if (!sorted.length) {
        container.innerHTML = '<div class="empty-state-mini"><p>No expenses yet. Start tracking!</p></div>';
        return;
    }

    container.innerHTML = sorted.map(e => {
        const cat = CATEGORIES[e.category] || CATEGORIES.Other;
        return `<div class="recent-item">
            <div class="recent-left">
                <div class="recent-emoji">${cat.emoji}</div>
                <div class="recent-info">
                    <h4>${escapeHtml(e.title)}</h4>
                    <span>${formatDate(e.date)} · ${e.category}</span>
                </div>
            </div>
            <div class="recent-amount">-₹${e.amount.toLocaleString('en-IN')}</div>
        </div>`;
    }).join('');
}

// ===== History Table =====
function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    const emptyEl = document.getElementById('empty-history');
    const search = (document.getElementById('search-expenses')?.value || '').toLowerCase();
    const filterCat = document.getElementById('filter-category')?.value || 'all';

    let filtered = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (search) filtered = filtered.filter(e => e.title.toLowerCase().includes(search) || e.category.toLowerCase().includes(search));
    if (filterCat !== 'all') filtered = filtered.filter(e => e.category === filterCat);

    if (!filtered.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    tbody.innerHTML = filtered.map(e => {
        const cat = CATEGORIES[e.category] || CATEGORIES.Other;
        return `<tr>
            <td><strong>${escapeHtml(e.title)}</strong></td>
            <td><span class="category-badge cat-${e.category}">${cat.emoji} ${e.category}</span></td>
            <td style="font-weight:700;color:#f87171;">₹${e.amount.toLocaleString('en-IN')}</td>
            <td style="color:var(--text-secondary)">${formatDate(e.date)}</td>
            <td style="color:var(--text-muted);font-size:12px;">${escapeHtml(e.note || '—')}</td>
            <td><button class="delete-btn" onclick="confirmDelete('${e.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete</button></td>
        </tr>`;
    }).join('');
}

function confirmDelete(id) {
    deleteTargetId = id;
    openModal('delete-modal');
}

// ===== Donut Chart =====
function renderCategoryChart() {
    const canvas = document.getElementById('category-chart');
    const ctx = canvas.getContext('2d');
    const size = 220, cx = size / 2, cy = size / 2, radius = 85, lineWidth = 28;
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, size, size);

    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);

    document.getElementById('donut-total').textContent = `₹${total.toLocaleString('en-IN')}`;

    if (!entries.length) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        document.getElementById('chart-legend').innerHTML = '';
        return;
    }

    let startAngle = -Math.PI / 2;
    entries.forEach(([cat, val]) => {
        const slice = (val / total) * Math.PI * 2;
        const color = (CATEGORIES[cat] || CATEGORIES.Other).color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        startAngle += slice + 0.04;
    });

    document.getElementById('chart-legend').innerHTML = entries.map(([cat, val]) => {
        const color = (CATEGORIES[cat] || CATEGORIES.Other).color;
        const pct = ((val / total) * 100).toFixed(0);
        return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${cat} (${pct}%)</div>`;
    }).join('');
}

// ===== Bar Chart (Monthly) =====
function renderMonthlyChart() {
    const canvas = document.getElementById('monthly-chart');
    const ctx = canvas.getContext('2d');
    const w = 700, h = 260;
    canvas.width = w * 2; canvas.height = h * 2;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthData = new Array(12).fill(0);
    expenses.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === now.getFullYear()) monthData[d.getMonth()] += e.amount;
    });

    const max = Math.max(...monthData, 1);
    const barW = 36, gap = (w - 60) / 12, startX = 50, baseY = h - 40;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = baseY - (i / 4) * (baseY - 20);
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(w - 10, y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${((max * i) / 4 / 1000).toFixed(0)}k`, startX - 8, y + 3);
    }

    months.forEach((m, i) => {
        const x = startX + i * gap + gap / 2 - barW / 2;
        const barH = (monthData[i] / max) * (baseY - 30);
        const gradient = ctx.createLinearGradient(0, baseY - barH, 0, baseY);
        const isCurrentMonth = i === now.getMonth();
        gradient.addColorStop(0, isCurrentMonth ? '#818cf8' : 'rgba(99,102,241,0.4)');
        gradient.addColorStop(1, isCurrentMonth ? '#4f46e5' : 'rgba(99,102,241,0.1)');

        roundedRect(ctx, x, baseY - barH, barW, barH, 6);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.fillStyle = isCurrentMonth ? '#fff' : 'rgba(255,255,255,0.35)';
        ctx.font = isCurrentMonth ? 'bold 11px Inter' : '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(m, x + barW / 2, baseY + 16);

        if (monthData[i] > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '9px Inter';
            ctx.fillText(`₹${(monthData[i] / 1000).toFixed(1)}k`, x + barW / 2, baseY - barH - 6);
        }
    });
}

function roundedRect(ctx, x, y, w, h, r) {
    if (h < r * 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ===== Analytics =====
function renderAnalytics() {
    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const topEl = document.getElementById('top-categories');
    const maxCat = sorted[0]?.[1] || 1;

    if (sorted.length) {
        topEl.innerHTML = sorted.slice(0, 5).map(([cat, val]) => {
            const color = (CATEGORIES[cat] || CATEGORIES.Other).color;
            const pct = (val / maxCat) * 100;
            return `<div class="top-cat-item">
                <span class="top-cat-label">${(CATEGORIES[cat] || CATEGORIES.Other).emoji} ${cat}</span>
                <div class="top-cat-bar-bg"><div class="top-cat-bar" style="width:${pct}%;background:${color}"></div></div>
                <span class="top-cat-value">₹${val.toLocaleString('en-IN')}</span>
            </div>`;
        }).join('');
    } else {
        topEl.innerHTML = '<div class="empty-state-mini"><p>No data available</p></div>';
    }

    const now = new Date();
    const monthExp = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);
    const dayOfMonth = now.getDate();
    document.getElementById('daily-avg').textContent = `₹${Math.round(monthTotal / dayOfMonth).toLocaleString('en-IN')}`;

    if (expenses.length) {
        const highest = expenses.reduce((max, e) => e.amount > max.amount ? e : max, expenses[0]);
        document.getElementById('highest-expense').textContent = `₹${highest.amount.toLocaleString('en-IN')}`;
        document.getElementById('highest-expense-name').textContent = highest.title;
    }

    const insightsEl = document.getElementById('insights-list');
    const insights = [];
    if (sorted.length) {
        insights.push({ icon: '📊', text: `Your top spending category is <strong>${sorted[0][0]}</strong> at ₹${sorted[0][1].toLocaleString('en-IN')}.` });
    }
    if (monthTotal > monthlyBudget * 0.8) {
        insights.push({ icon: '⚠️', text: `You've used over 80% of your monthly budget. Consider cutting back.` });
    }
    if (expenses.length >= 5) {
        const avgAmount = Math.round(expenses.reduce((s, e) => s + e.amount, 0) / expenses.length);
        insights.push({ icon: '💰', text: `Your average transaction is <strong>₹${avgAmount.toLocaleString('en-IN')}</strong>.` });
    }
    if (!insights.length) {
        insights.push({ icon: '💡', text: 'Add expenses to get personalized insights about your spending habits.' });
    }
    insightsEl.innerHTML = insights.map(i => `<div class="insight-item"><div class="insight-icon">${i.icon}</div><p>${i.text}</p></div>`).join('');
}

// ===== Toast =====
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
}

// ===== Helpers =====
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== Greeting =====
function updateGreeting() {
    if (currentUser) {
        const firstName = currentUser.name.split(' ')[0];
        document.getElementById('greeting-name').textContent = firstName;
    }
}

// ===== Settings =====
function populateSettings() {
    if (!currentUser) return;
    document.getElementById('settings-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('settings-display-name').textContent = currentUser.name;
    document.getElementById('settings-display-email').textContent = currentUser.email;
    document.getElementById('settings-name').value = currentUser.name;
    const joined = new Date(currentUser.createdAt);
    document.getElementById('settings-joined').textContent = joined.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function bindSettings() {
    // Save profile name
    document.getElementById('btn-save-profile').addEventListener('click', () => {
        const newName = document.getElementById('settings-name').value.trim();
        if (!newName || newName.length < 2) {
            showToast('Name must be at least 2 characters', 'error');
            return;
        }
        const users = getUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx].name = newName;
            saveUsers(users);
            currentUser.name = newName;
            // Update UI
            document.getElementById('user-avatar').textContent = newName.charAt(0).toUpperCase();
            document.getElementById('user-name').textContent = newName;
            updateGreeting();
            populateSettings();
            showToast('Profile updated successfully', 'success');
        }
    });

    // Change password
    document.getElementById('btn-change-password').addEventListener('click', () => {
        const currentPw = document.getElementById('settings-current-pw').value;
        const newPw = document.getElementById('settings-new-pw').value;
        const confirmPw = document.getElementById('settings-confirm-pw').value;

        if (!currentPw || !newPw || !confirmPw) {
            showToast('Please fill all password fields', 'error');
            return;
        }
        if (hashPassword(currentPw) !== currentUser.passwordHash) {
            showToast('Current password is incorrect', 'error');
            return;
        }
        if (newPw.length < 4) {
            showToast('New password must be at least 4 characters', 'error');
            return;
        }
        if (newPw !== confirmPw) {
            showToast('New passwords do not match', 'error');
            return;
        }

        const users = getUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx].passwordHash = hashPassword(newPw);
            saveUsers(users);
            currentUser.passwordHash = users[idx].passwordHash;
            document.getElementById('settings-current-pw').value = '';
            document.getElementById('settings-new-pw').value = '';
            document.getElementById('settings-confirm-pw').value = '';
            showToast('Password changed successfully', 'success');
        }
    });
}

// ===== Export CSV =====
function bindExport() {
    document.getElementById('btn-export-csv').addEventListener('click', () => {
        if (!expenses.length) {
            showToast('No expenses to export', 'error');
            return;
        }

        const headers = ['Title', 'Category', 'Amount (₹)', 'Date', 'Note'];
        const rows = expenses.map(e => [
            `"${e.title}"`,
            e.category,
            e.amount,
            e.date,
            `"${e.note || ''}"`
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SmartSpend_Expenses_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${expenses.length} expenses to CSV`, 'success');
    });
}
