/**
 * AUTH LOCK - VERSÃO COMPATÍVEL
 * Central SCI Joinville - Sistema de Bloqueio
 * 
 * MELHORIAS:
 * - Mensagens diferentes por perfil
 * - Card ajustado ao elemento (sem botão)
 * - Click no card abre modal
 * - Blur reduzido
 * - SEM optional chaining (compatibilidade)
 */

export default {
    initialized: false,
    lockedElements: new WeakMap(),
    
    init() {
        console.log('🔒 Aguardando sistema de autenticação...');
        
        const waitForAuth = setInterval(() => {
            if (window.authCore && window.authCore.initialized) {
                clearInterval(waitForAuth);
                this.initialized = true;
                console.log('🔒 Sistema de bloqueio inicializado');
                this.checkAuthAndLock();
                
                window.addEventListener('auth-state-changed', () => {
                    this.checkAuthAndLock();
                });
            }
        }, 100);
        
        setTimeout(() => {
            if (!this.initialized) {
                console.warn('⚠️ Sistema de autenticação não carregou, desbloqueando elementos');
                this.unlockAll();
            }
        }, 10000);
    },

    checkAuthAndLock() {
        const isAuthenticated = window.authCore && window.authCore.currentUser !== null;
        const elements = document.querySelectorAll('[data-auth-required]');
        
        console.log(`🔒 Verificando bloqueios: ${isAuthenticated ? 'LOGADO' : 'NÃO LOGADO'}`);
        console.log(`🔒 Elementos protegidos: ${elements.length}`);
        
        elements.forEach(element => {
            if (isAuthenticated) {
                this.unlock(element);
            } else {
                this.lock(element);
            }
        });
    },

    unlockAll() {
        const elements = document.querySelectorAll('[data-auth-required]');
        elements.forEach(element => this.unlock(element));
    },

    /**
     * DETERMINAR MENSAGEM BASEADA NO PERFIL
     */
    getLockMessage(element) {
        const isAuthenticated = window.authCore && window.authCore.currentUser !== null;
        const isAdmin = window.authCore && window.authCore.isAdmin && window.authCore.isAdmin() || false;
        const isSuperAdmin = window.authCore && window.authCore.isSuperAdmin && window.authCore.isSuperAdmin() || false;
        const requiredRole = element.getAttribute('data-role');
        
        // Usuário comum tentando acessar área admin
        if (isAuthenticated && !isAdmin && requiredRole === 'super-admin') {
            return {
                title: 'Acesso Restrito',
                subtitle: 'Apenas administradores podem acessar'
            };
        }
        
        // Não está logado
        if (!isAuthenticated) {
            return {
                title: 'Acesso Restrito',
                subtitle: 'Faça login para acessar esta funcionalidade'
            };
        }
        
        // Fallback genérico
        return {
            title: 'Acesso Restrito',
            subtitle: 'Você não tem permissão para acessar'
        };
    },

    lock(element) {
        console.log('🔒 Bloqueando elemento:', element.id || element.className);
        
        element.classList.add('auth-locked');
        
        if (element.querySelector('.auth-lock-overlay')) {
            console.log('⚠️ Elemento já estava bloqueado');
            return;
        }
        
        this.saveAndRemoveInteractivity(element);
        
        // Obter mensagem apropriada
        const message = this.getLockMessage(element);
        
        // Criar overlay
        const overlay = document.createElement('div');
        overlay.className = 'auth-lock-overlay';
        
        // Criar card (SEM botão, clicável)
        const card = document.createElement('div');
        card.className = 'auth-lock-message';
        card.style.cursor = 'pointer';
        
        card.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px; display: block;">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <p style="font-size: 16px; font-weight: 700; color: #1d1d1f; margin: 0 0 6px 0;">
                ${message.title}
            </p>
            <p style="font-size: 13px; color: #6b7280; margin: 0; line-height: 1.4;">
                ${message.subtitle}
            </p>
        `;
        
        // Click no card abre modal de login
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (window.authUI && window.authUI.openModal) {
                window.authUI.openModal('login');
            }
        });
        
        // Hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.02)';
            card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        });
        
        overlay.appendChild(card);
        
        // Garantir posicionamento relativo
        const position = window.getComputedStyle(element).position;
        if (position === 'static') {
            element.style.position = 'relative';
        }
        
        element.appendChild(overlay);
        
        this.blockAllEvents(element);
        
        console.log('✅ Elemento bloqueado com sucesso');
    },

    unlock(element) {
        console.log('🔓 Desbloqueando elemento:', element.id || element.className);
        
        element.classList.remove('auth-locked');
        
        const overlay = element.querySelector('.auth-lock-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        this.restoreInteractivity(element);
        this.unblockAllEvents(element);
        
        console.log('✅ Elemento desbloqueado com sucesso');
    },

    saveAndRemoveInteractivity(element) {
        const savedData = {
            element: new Map(),
            children: []
        };
        
        const dangerousAttrs = [
            'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
            'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown',
            'onkeyup', 'onkeypress', 'href', 'action', 'formaction'
        ];
        
        dangerousAttrs.forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) {
                savedData.element.set(attr, value);
                element.removeAttribute(attr);
            }
        });
        
        const allChildren = element.querySelectorAll('*');
        allChildren.forEach((child, index) => {
            const childData = new Map();
            
            dangerousAttrs.forEach(attr => {
                const value = child.getAttribute(attr);
                if (value) {
                    childData.set(attr, value);
                    child.removeAttribute(attr);
                }
            });
            
            if (childData.size > 0) {
                savedData.children.push({ index, data: childData, element: child });
            }
        });
        
        this.lockedElements.set(element, savedData);
        
        console.log(`💾 Salvos ${savedData.element.size} atributos do elemento principal`);
        console.log(`💾 Salvos dados de ${savedData.children.length} elementos filhos`);
    },

    restoreInteractivity(element) {
        const savedData = this.lockedElements.get(element);
        
        if (!savedData) {
            console.warn('⚠️ Nenhum dado salvo encontrado para este elemento');
            return;
        }
        
        savedData.element.forEach((value, attr) => {
            element.setAttribute(attr, value);
        });
        
        savedData.children.forEach(({ element: child, data }) => {
            data.forEach((value, attr) => {
                child.setAttribute(attr, value);
            });
        });
        
        this.lockedElements.delete(element);
        
        console.log(`♻️ Restaurados ${savedData.element.size} atributos do elemento principal`);
        console.log(`♻️ Restaurados dados de ${savedData.children.length} elementos filhos`);
    },

    blockAllEvents(element) {
        const blockEvent = (e) => {
            // ✅ CORREÇÃO: Verificar se o clique é NO card ou DENTRO do card
            const clickedOnCard = e.target.classList.contains('auth-lock-message') || 
                                 e.target.closest('.auth-lock-message');
            
            if (clickedOnCard) {
                // Deixa o evento passar para o card processar
                return true;
            }
            
            // Bloqueia todos os outros eventos
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            return false;
        };
        
        const events = [
            'click', 'dblclick', 'mousedown', 'mouseup',
            'touchstart', 'touchend', 'touchmove',
            'keydown', 'keyup', 'keypress',
            'submit', 'change', 'input',
            'focus', 'blur'
        ];
        
        events.forEach(eventName => {
            element.addEventListener(eventName, blockEvent, true);
        });
        
        element.__blockEventHandler = blockEvent;
        element.__blockedEvents = events;
    },

    unblockAllEvents(element) {
        if (!element.__blockEventHandler || !element.__blockedEvents) return;
        
        element.__blockedEvents.forEach(eventName => {
            element.removeEventListener(eventName, element.__blockEventHandler, true);
        });
        
        delete element.__blockEventHandler;
        delete element.__blockedEvents;
    }
};
