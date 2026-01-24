// API Helper - COM TRATAMENTO DE ERROS MELHORADO
const api = {
    async get(url) {
        try {
            const res = await fetch(url);
            if (res.status === 401) {
                window.location.href = '/login';
                return null;
            }
            if (!res.ok) {
                const error = await res.text();
                console.error('API Error:', error);
                return { error: error || 'Erro na requisicao' };
            }
            return res.json();
        } catch (error) {
            console.error('API Error:', error);
            return { error: 'Erro de conexao' };
        }
    },
    async post(url, data) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok && res.status !== 400) {
                return { error: 'Erro na requisicao' };
            }
            return res.json();
        } catch (error) {
            console.error('API Error:', error);
            return { error: 'Erro de conexao' };
        }
    },
    async put(url, data) {
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok && res.status !== 400) {
                return { error: 'Erro na requisicao' };
            }
            return res.json();
        } catch (error) {
            console.error('API Error:', error);
            return { error: 'Erro de conexao' };
        }
    },
    async delete(url) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok && res.status !== 400) {
                return { error: 'Erro na requisicao' };
            }
            return res.json();
        } catch (error) {
            console.error('API Error:', error);
            return { error: 'Erro de conexao' };
        }
    }
};

// Toast - SINGLETON PATTERN (reutiliza elemento)
let toastContainer = null;
let toastTimeout = null;

function showToast(message, type = 'success') {
    // Limpar timeout anterior
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Criar container se nao existe
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast';
        document.body.appendChild(toastContainer);
    }

    // Atualizar conteudo e classe
    toastContainer.className = `toast toast-${type}`;
    toastContainer.textContent = message;

    // Mostrar
    setTimeout(() => toastContainer.classList.add('show'), 10);

    // Esconder apos 3s
    toastTimeout = setTimeout(() => {
        toastContainer.classList.remove('show');
    }, 3000);
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

// Load user info - OTIMIZADO: salvar apenas dados essenciais
async function loadUserInfo() {
    const user = await api.get('/api/auth/me');
    if (user && !user.error) {
        const nameEl = document.getElementById('user-name');
        const emailEl = document.getElementById('user-email');
        if (nameEl) nameEl.textContent = user.name;
        if (emailEl) emailEl.textContent = user.email;
        // Salvar apenas dados essenciais no localStorage
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
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

// Phone mask - funcao mantida para compatibilidade
function phoneMask(input) {
    input.addEventListener('input', handlePhoneMask);
}

// Handler para mascara de telefone
function handlePhoneMask(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 0) {
        if (v.length <= 2) v = '(' + v;
        else if (v.length <= 7) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
        else v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    }
    e.target.value = v;
}

// Event delegation para inputs dinamicos
document.addEventListener('input', function(e) {
    if (e.target.matches('input[type="tel"]')) {
        handlePhoneMask(e);
    }
});

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
