/**
 * AUTH GUARD - VERSÃO MELHORADA
 * Central SCI Joinville - Proteção de Conteúdo
 * 
 * MELHORIAS:
 * - Sempre usa modo "locked" (blur) ao invés de esconder
 * - Remove onclick e href de elementos bloqueados
 * - Maior segurança contra DevTools
 */

import authCore from './auth-core.js';
import authLock from './auth-lock.js';

class AuthGuard {
  constructor() {
    this.isInitialized = false;
    
    // Escutar mudanças de autenticação
    authCore.addAuthListener((event, user) => {
      this.handleAuthChange(event, user);
    });
    
    // Aguardar auth-initialized
    window.addEventListener('auth-initialized', () => {
      this.init();
    });
  }

  /**
   * INICIALIZAR
   */
  init() {
    if (this.isInitialized) return;
    
    console.log('🛡️ AuthGuard inicializando...');
    
    // Aplicar proteção inicial
    this.applyProtection();
    
    // Criar botão de auth no header
    this.createAuthButton();
    
    // Adicionar listeners em elementos protegidos
    this.attachClickListeners();
    
    this.isInitialized = true;
    console.log('✅ AuthGuard inicializado');
  }

  /**
   * HANDLE MUDANÇA DE AUTENTICAÇÃO
   */
  handleAuthChange(event, user) {
    console.log('🔄 Auth mudou:', event, user);
    
    // Atualizar proteção de elementos
    this.applyProtection();
    
    // Atualizar botão
    this.updateAuthButton(user);
  }

  /**
   * APLICAR PROTEÇÃO EM ELEMENTOS
   */
  applyProtection() {
    const isAuthenticated = authCore.isAuthenticated();
    const isSuperAdmin = authCore.isSuperAdmin();
    const isAdmin = authCore.isAdmin();
    
    
    console.log(`🛡️ Aplicando proteção: ${isAuthenticated ? 'LOGADO' : 'NÃO LOGADO'}`);
    
    // Encontrar todos os elementos protegidos
    const protectedElements = document.querySelectorAll('[data-auth-required]');
    
    console.log(`🛡️ Elementos protegidos encontrados: ${protectedElements.length}`);
    
    protectedElements.forEach(element => {
      const requiredRole = element.getAttribute('data-role');
      let hasAccess = false;
      
      // Verificar acesso
      if (!isAuthenticated) {
        hasAccess = false; // Não logado
      } else if (!requiredRole) {
        hasAccess = true; // Apenas requer login
      } else if (requiredRole === 'super-admin') {
        hasAccess = isSuperAdmin; // Requer super-admin
      } else if (requiredRole === 'admin') {
        hasAccess = isAdmin; // Requer admin
      } else if (requiredRole === 'user') {
        hasAccess = true; // Qualquer usuário logado
      }
      
      // Aplicar proteção usando authLock
      if (hasAccess) {
        // Tem acesso - desbloquear
        element.style.display = '';
        element.classList.remove('auth-locked');
        authLock.unlock(element);
        console.log('✅ Desbloqueado:', element.id || element.className);
      } else {
        // Não tem acesso - SEMPRE usar modo locked (blur)
        element.style.display = '';
        element.classList.add('auth-locked');
        authLock.lock(element);
        console.log('🔒 Bloqueado:', element.id || element.className);
      }
    });
  }

  /**
   * ADICIONAR LISTENERS EM ELEMENTOS PROTEGIDOS
   */
  attachClickListeners() {
    document.addEventListener('click', (e) => {
      // Verificar se clicou em elemento protegido
      const protectedElement = e.target.closest('[data-auth-required]');
      
      if (protectedElement && !authCore.isAuthenticated()) {
        // Verificar se é interativo (link, botão, etc)
        if (e.target.closest('a, button, [onclick]')) {
          e.preventDefault();
          e.stopPropagation();
          
          // Mostrar notificação
          if (window.authUI && window.authUI.showNotification) {
            window.authUI.showNotification('Faça login para acessar esta funcionalidade', 'error');
          }
          
          // Abrir modal de login após 500ms
          setTimeout(() => {
            window.authUI.openModal('login');
          }, 500);
        }
      }
    }, true); // Use capture para pegar antes de outros handlers
  }

  /**
   * CRIAR BOTÃO DE AUTH NO HEADER
   */
  createAuthButton() {
    const container = document.getElementById('auth-button-container');
    if (!container) {
      console.warn('⚠️ Container auth-button-container não encontrado');
      return;
    }
    
    container.innerHTML = `
      <div style="position: relative;">
        <button id="auth-button" class="auth-button login">
          <i data-lucide="user" class="w-4 h-4"></i>
          <span>Entrar</span>
        </button>
        
        <!-- Menu do usuário (oculto inicialmente) -->
        <div id="auth-user-menu" class="auth-user-menu">
          <div class="auth-user-info">
            <div class="auth-user-name" id="auth-user-name">--</div>
            <div class="auth-user-matricula" id="auth-user-matricula">--</div>
            <span class="auth-user-role user" id="auth-user-role">usuário</span>
          </div>
          <a href="/Central-SCI/admin/usuarios.html" class="auth-menu-item" id="auth-menu-admin" style="display: none;">
            <i data-lucide="shield" class="w-4 h-4"></i>
            <span>Painel Admin</span>
          </a>
          <a href="/Central-SCI/admin/config-bases.html" class="auth-menu-item" id="auth-menu-bases" style="display: none;">
            <i data-lucide="database" class="w-4 h-4"></i>
            <span>Configurar Bases</span>
          </a>
          <div class="auth-menu-item logout" id="auth-logout-btn">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>Sair</span>
          </div>
        </div>
      </div>
    `;
    
    // Recriar ícones
    if (window.lucide) {
      lucide.createIcons();
    }
    
    // Adicionar event listeners
    const button = document.getElementById('auth-button');
    const menu = document.getElementById('auth-user-menu');
    const logoutBtn = document.getElementById('auth-logout-btn');
    
    button.addEventListener('click', () => {
      if (authCore.isAuthenticated()) {
        // Toggle menu
        menu.classList.toggle('show');
      } else {
        // Abrir modal de login
        window.authUI.openModal('login');
      }
    });
    
    logoutBtn.addEventListener('click', async () => {
      menu.classList.remove('show');
      await authCore.logout();
    });
    
    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#auth-button') && !e.target.closest('#auth-user-menu')) {
        menu.classList.remove('show');
      }
    });
    
    // Atualizar com estado atual
    this.updateAuthButton(authCore.currentUser);
  }

  /**
   * ATUALIZAR BOTÃO DE AUTH
   */
  updateAuthButton(user) {
    const button = document.getElementById('auth-button');
    const menu = document.getElementById('auth-user-menu');
    
    if (!button) return;
    
    if (user) {
      // Usuário logado
      button.className = 'auth-button user';
      button.innerHTML = `
        <i data-lucide="user-check" class="w-4 h-4"></i>
        <span>${user.matricula}</span>
      `;
      
      // Atualizar menu
      document.getElementById('auth-user-name').textContent = user.displayName;
      document.getElementById('auth-user-matricula').textContent = `Matrícula: ${user.matricula}`;

      const roleElement = document.getElementById('auth-user-role');
      // Mostrar PainelSuperAdmin
      if (user.role === 'super-admin') {
        roleElement.textContent = 'super administrador';
        roleElement.className = 'auth-user-role admin';
        document.getElementById('auth-menu-admin').style.display = 'flex';
        document.getElementById('auth-menu-bases').style.display = 'flex';  // ← ADICIONAR
      } else if (user.role === 'admin') {
        roleElement.textContent = 'administrador';
        roleElement.className = 'auth-user-role admin';
        document.getElementById('auth-menu-admin').style.display = 'flex';
        document.getElementById('auth-menu-bases').style.display = 'none';  // ← ADICIONAR
      } else {
        roleElement.textContent = 'usuário';
        roleElement.className = 'auth-user-role user';
        document.getElementById('auth-menu-admin').style.display = 'none';
        document.getElementById('auth-menu-bases').style.display = 'none';  // ← ADICIONAR
      }
      
    } else {
      // Usuário não logado
      button.className = 'auth-button login';
      button.innerHTML = `
        <i data-lucide="user" class="w-4 h-4"></i>
        <span>Entrar</span>
      `;
      
      menu.classList.remove('show');
    }
    
    // Recriar ícones
    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

// Criar instância global
const authGuard = new AuthGuard();

// Exportar
export default authGuard;

// Disponibilizar globalmente
window.authGuard = authGuard;

console.log('✅ AuthGuard melhorado carregado');
