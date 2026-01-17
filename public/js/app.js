// API Helper
const api = {
    async get(url) {
        const res = await fetch(url);
        if (res.status === 401) { window.location.href = '/login'; return null; }
        return res.json();
    },
    async post(url, data) {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        return res.json();
    },
    async put(url, data) {
        const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        return res.json();
    },
    async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        return res.json();
    }
};

// Toast
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Link copiado!'));
}

// Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Load user info
async function loadUserInfo() {
    const user = await api.get('/api/auth/me');
    if (user && !user.error) {
        const nameEl = document.getElementById('user-name');
        const emailEl = document.getElementById('user-email');
        if (nameEl) nameEl.textContent = user.name;
        if (emailEl) emailEl.textContent = user.email;
        // Salvar dados do usuário no localStorage para usar no perfil
        localStorage.setItem('user', JSON.stringify(user));
    }
}

// Check auth
async function checkAuth() {
    const user = await api.get('/api/auth/me');
    if (!user || user.error) { window.location.href = '/login'; return null; }
    return user;
}

// Logout
async function logout() {
    await api.post('/api/auth/logout', {});
    localStorage.removeItem('theme');
    window.location.href = '/login';
}

// Phone mask
function phoneMask(input) {
    input.addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 0) {
            if (v.length <= 2) v = '(' + v;
            else if (v.length <= 7) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
            else v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
        }
        e.target.value = v;
    });
}

// Theme (only for logged in pages)
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Loading
function hideLoading() {
    const loading = document.getElementById('loading-screen');
    if (loading) loading.classList.add('hidden');
}

// Sidebar toggle
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

function initSidebar() {
    const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (collapsed) document.querySelector('.sidebar')?.classList.add('collapsed');
}

// Mobile menu
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSidebar();
    document.querySelectorAll('input[type="tel"]').forEach(phoneMask);
    setTimeout(hideLoading, 500);
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.addEventListener('click', closeMobileMenu);
});
