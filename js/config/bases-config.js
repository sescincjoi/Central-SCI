/**
 * BASES CONFIGURATION
 * Central SCI - Sistema Multi-Base
 * 
 * Gerencia configurações de bases carregadas do Firestore
 */

import { db } from '../auth/firebase-config.js';
import { doc, getDoc, collection, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class BasesConfig {
  constructor() {
    this.bases = {};
    this.initialized = false;
    this.listeners = [];
    this.unsubscribe = null;
  }

  /**
   * INICIALIZAR - Carrega configurações do Firestore
   */
  async init() {
    if (this.initialized) return;

    console.log('🔧 Carregando configurações de bases...');

    try {
      await this.carregarBases();
      
      // Escutar mudanças em tempo real
      this.escutarMudancas();
      
      this.initialized = true;
      console.log('✅ Configurações de bases carregadas:', Object.keys(this.bases));
      
      // Disparar evento
      window.dispatchEvent(new CustomEvent('bases-config-loaded', {
        detail: { bases: this.bases }
      }));
      
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
      throw error;
    }
  }

  /**
   * CARREGAR BASES DO FIRESTORE
   */
  async carregarBases() {
    try {
      const basesDocRef = doc(db, 'system-config', 'bases');
      const basesDoc = await getDoc(basesDocRef);

      if (basesDoc.exists()) {
        const data = basesDoc.data();
        
        // Converter para objeto de bases
        this.bases = {};
        Object.keys(data).forEach(baseId => {
          if (data[baseId] && typeof data[baseId] === 'object') {
            this.bases[baseId] = data[baseId];
          }
        });

        console.log(`📍 ${Object.keys(this.bases).length} bases carregadas`);
      } else {
        console.warn('⚠️ Documento de bases não encontrado no Firestore');
        this.bases = {};
      }
    } catch (error) {
      console.error('❌ Erro ao carregar bases:', error);
      throw error;
    }
  }

  /**
   * ESCUTAR MUDANÇAS EM TEMPO REAL
   */
  escutarMudancas() {
    const basesDocRef = doc(db, 'system-config', 'bases');
    
    this.unsubscribe = onSnapshot(basesDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        
        // Atualizar bases
        this.bases = {};
        Object.keys(data).forEach(baseId => {
          if (data[baseId] && typeof data[baseId] === 'object') {
            this.bases[baseId] = data[baseId];
          }
        });

        console.log('🔄 Configurações de bases atualizadas');
        
        // Notificar listeners
        this.notifyListeners();
        
        // Disparar evento
        window.dispatchEvent(new CustomEvent('bases-config-updated', {
          detail: { bases: this.bases }
        }));
      }
    }, (error) => {
      console.error('❌ Erro ao escutar mudanças:', error);
    });
  }

  /**
   * OBTER BASE POR ID
   */
  getBase(baseId) {
    return this.bases[baseId] || null;
  }

  /**
   * OBTER TODAS AS BASES
   */
  getAllBases() {
    return { ...this.bases };
  }

  /**
   * OBTER BASES ATIVAS
   */
  getBasesAtivas() {
    const ativas = {};
    Object.keys(this.bases).forEach(id => {
      if (this.bases[id].ativo) {
        ativas[id] = this.bases[id];
      }
    });
    return ativas;
  }

  /**
   * LISTAR BASES (para dropdowns)
   */
  listarBases(apenasAtivas = true) {
    const bases = apenasAtivas ? this.getBasesAtivas() : this.bases;
    
    return Object.keys(bases).map(id => ({
      id: bases[id].id,
      nome: bases[id].nome,
      nomeCompleto: bases[id].nomeCompleto,
      icao: bases[id].icao,
      logoUrl: bases[id].logoUrl
    }));
  }

  /**
   * VERIFICAR SE BASE EXISTE
   */
  baseExiste(baseId) {
    return this.bases.hasOwnProperty(baseId);
  }

  /**
   * VERIFICAR SE BASE ESTÁ ATIVA
   */
  baseAtiva(baseId) {
    return this.bases[baseId]?.ativo === true;
  }

  /**
   * ADICIONAR LISTENER PARA MUDANÇAS
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * NOTIFICAR LISTENERS
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.bases);
      } catch (error) {
        console.error('Erro ao notificar listener:', error);
      }
    });
  }

  /**
   * LIMPAR LISTENERS
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.listeners = [];
  }
}

// Criar instância global
const basesConfig = new BasesConfig();

// Exportar
export default basesConfig;

// Disponibilizar globalmente
window.basesConfig = basesConfig;

console.log('✅ BasesConfig carregado');
