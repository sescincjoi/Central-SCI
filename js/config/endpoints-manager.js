/**
 * ENDPOINTS MANAGER
 * Central SCI - Gerenciador de Endpoints Multi-Base
 * 
 * Gerencia qual base está ativa e fornece os endpoints corretos
 */

import basesConfig from './bases-config.js';

class EndpointsManager {
  constructor() {
    this.baseAtual = null;
    this.initialized = false;
  }

  /**
   * INICIALIZAR
   */
  async init() {
    if (this.initialized) return;

    console.log('🎯 Inicializando EndpointsManager...');

    // Aguardar bases-config carregar
    if (!basesConfig.initialized) {
      await basesConfig.init();
    }

    // Tentar carregar base do usuário logado
    if (window.authCore && window.authCore.currentUser) {
      const userBase = window.authCore.currentUser.base;
      
      if (userBase && basesConfig.baseExiste(userBase)) {
        this.baseAtual = userBase;
        console.log(`📍 Base do usuário: ${userBase}`);
        this.salvarPreferencia(userBase);
        this.initialized = true;
        this.notifyChange();
        return;
      }
    }

    // Caso contrário, tentar carregar do localStorage
    const baseSalva = localStorage.getItem('sci-base-selecionada');
    
    if (baseSalva && basesConfig.baseExiste(baseSalva) && basesConfig.baseAtiva(baseSalva)) {
      this.baseAtual = baseSalva;
      console.log(`📍 Base carregada do localStorage: ${baseSalva}`);
    } else {
      // Usar primeira base ativa disponível
      const basesAtivas = basesConfig.getBasesAtivas();
      const primeiraBase = Object.keys(basesAtivas)[0];
      
      if (primeiraBase) {
        this.baseAtual = primeiraBase;
        console.log(`📍 Usando primeira base disponível: ${primeiraBase}`);
      } else {
        console.error('❌ Nenhuma base ativa disponível!');
        this.baseAtual = null;
      }
    }

    this.initialized = true;
    this.notifyChange();
    
    console.log('✅ EndpointsManager inicializado');
  }

  /**
   * OBTER BASE ATUAL
   */
  getBaseAtual() {
    return this.baseAtual;
  }

  /**
   * OBTER INFORMAÇÕES DA BASE ATUAL
   */
  getBaseInfo() {
    if (!this.baseAtual) return null;
    return basesConfig.getBase(this.baseAtual);
  }

  /**
   * OBTER ENDPOINT ESPECÍFICO
   */
  getEndpoint(tipo) {
    if (!this.baseAtual) {
      console.error('❌ Nenhuma base selecionada');
      return null;
    }

    const base = basesConfig.getBase(this.baseAtual);
    
    if (!base) {
      console.error(`❌ Base ${this.baseAtual} não encontrada`);
      return null;
    }

    const endpoint = base.endpoints?.[tipo];
    
    if (!endpoint) {
      console.warn(`⚠️ Endpoint "${tipo}" não configurado para base ${this.baseAtual}`);
      return null;
    }

    return endpoint;
  }

  /**
   * OBTER TODOS OS ENDPOINTS
   */
  getAllEndpoints() {
    const base = this.getBaseInfo();
    return base?.endpoints || {};
  }

  /**
   * OBTER CONFIGURAÇÃO DA BASE
   */
  getConfig() {
    const base = this.getBaseInfo();
    return base?.config || {};
  }

  /**
   * OBTER LOGO DA BASE
   */
  getLogoUrl() {
    const base = this.getBaseInfo();
    return base?.logoUrl || 'https://via.placeholder.com/150x150?text=SCI';
  }

  /**
   * TROCAR BASE (apenas para super-admin)
   */
  setBase(baseId) {
    // Verificar se é super admin
    if (window.authCore && !window.authCore.isSuperAdmin()) {
      console.error('❌ Apenas super-admin pode trocar de base');
      return false;
    }

    if (!basesConfig.baseExiste(baseId)) {
      console.error(`❌ Base ${baseId} não existe`);
      return false;
    }

    if (!basesConfig.baseAtiva(baseId)) {
      console.error(`❌ Base ${baseId} não está ativa`);
      return false;
    }

    this.baseAtual = baseId;
    this.salvarPreferencia(baseId);
    this.notifyChange();
    
    console.log(`✅ Base alterada para: ${baseId}`);
    
    return true;
  }

  /**
   * SALVAR PREFERÊNCIA NO LOCALSTORAGE
   */
  salvarPreferencia(baseId) {
    localStorage.setItem('sci-base-selecionada', baseId);
  }

  /**
   * LISTAR BASES DISPONÍVEIS
   */
  listarBases() {
    return basesConfig.listarBases(true);
  }

  /**
   * VERIFICAR SE ENDPOINT ESTÁ DISPONÍVEL
   */
  isEndpointDisponivel(tipo) {
    const endpoint = this.getEndpoint(tipo);
    return endpoint !== null && endpoint !== undefined && endpoint !== '';
  }

  /**
   * NOTIFICAR MUDANÇA DE BASE
   */
  notifyChange() {
    window.dispatchEvent(new CustomEvent('base-changed', {
      detail: { 
        base: this.baseAtual,
        baseInfo: this.getBaseInfo()
      }
    }));
  }

  /**
   * SINCRONIZAR COM USUÁRIO LOGADO
   */
  sincronizarComUsuario() {
    if (window.authCore && window.authCore.currentUser) {
      const userBase = window.authCore.currentUser.base;
      
      // Se não for super admin, forçar base do usuário
      if (!window.authCore.isSuperAdmin() && userBase) {
        if (this.baseAtual !== userBase) {
          this.baseAtual = userBase;
          this.salvarPreferencia(userBase);
          this.notifyChange();
          console.log(`🔒 Base sincronizada com usuário: ${userBase}`);
        }
      }
    }
  }
}

// Criar instância global
const endpointsManager = new EndpointsManager();

// Exportar
export default endpointsManager;

// Disponibilizar globalmente
window.endpointsManager = endpointsManager;

// Sincronizar quando auth inicializar
window.addEventListener('auth-initialized', () => {
  endpointsManager.sincronizarComUsuario();
});

// Sincronizar quando auth mudar
window.addEventListener('auth-state-changed', () => {
  endpointsManager.sincronizarComUsuario();
});

console.log('✅ EndpointsManager carregado');
