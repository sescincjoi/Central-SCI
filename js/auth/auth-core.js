/**
 * AUTH CORE
 * Central SCI Joinville - Sistema de Autenticação
 * 
 * Gerencia toda a lógica de autenticação:
 * - Login com matrícula/senha
 * - Cadastro de novos usuários
 * - Verificação de matrícula habilitada
 * - Recuperação de senha
 * - Gerenciamento de sessão
 */

import { auth, db, CONFIG } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/**
 * CLASSE PRINCIPAL DE AUTENTICAÇÃO
 */
class AuthCore {
  constructor() {
    this.initialized = false; // ← ADICIONADO
    this.currentUser = null;
    this.userRole = null;
    this.userMatricula = null;
    this.listeners = [];
    this.isRegistering = false;
    
    // Inicializar listener de mudança de autenticação
    this.initAuthStateListener();
  }

  /**
   * LISTENER DE ESTADO DE AUTENTICAÇÃO
   * Detecta quando usuário faz login/logout
   */
  initAuthStateListener() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (this.isRegistering) return;
      if (firebaseUser) {
        // Usuário logado
        console.log('🔐 Usuário autenticado:', firebaseUser.uid);
        
        // Buscar dados completos do usuário
        await this.loadUserData(firebaseUser);
        
        // Marcar como inicializado após primeiro carregamento
        if (!this.initialized) {
          this.initialized = true;
          console.log('✅ AuthCore totalmente inicializado');
          
          // Disparar evento global de inicialização
          window.dispatchEvent(new CustomEvent('auth-initialized'));
        }
        
        // Notificar listeners
        this.notifyListeners('login', this.currentUser);
        
        // Disparar evento global de mudança de estado
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user: this.currentUser } 
        }));
      } else {
        // Usuário deslogado
        console.log('🔓 Usuário desautenticado');
        this.currentUser = null;
        this.userRole = null;
        this.userMatricula = null;
        
        // Marcar como inicializado mesmo sem usuário
        if (!this.initialized) {
          this.initialized = true;
          console.log('✅ AuthCore inicializado (sem usuário)');
          
          // Disparar evento global de inicialização
          window.dispatchEvent(new CustomEvent('auth-initialized'));
        }
        
        // Notificar listeners
        this.notifyListeners('logout', null);
        
        // Disparar evento global de mudança de estado
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user: null } 
        }));
      }
    });
  }

  /**
   * CARREGAR DADOS DO USUÁRIO DO FIRESTORE
   */
  async loadUserData(firebaseUser) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        this.currentUser = {
          uid: firebaseUser.uid,
          email: userData.email,
          displayName: userData.displayName,
          matricula: userData.matricula,
          role: userData.role,
          base: userData.base || "JOI",
          ativo: userData.ativo,
          cadastradoEm: userData.cadastradoEm,
          ultimoAcesso: userData.ultimoAcesso
        };
        
        this.userRole = userData.role;
        this.userMatricula = userData.matricula;
        
        // Atualizar último acesso
        await updateDoc(doc(db, 'usuarios', firebaseUser.uid), {
          ultimoAcesso: serverTimestamp()
        });
        
        console.log('✅ Dados do usuário carregados:', this.currentUser.matricula);
        
      } else {
        // Aguarda até 3 segundos para o cadastro terminar de gravar
        let attempts = 0;
        let userData = null;
      
        while (attempts < 6 && !userData) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
          if (retryDoc.exists()) {
            userData = retryDoc.data();
          }
          attempts++;
        }
      
        if (userData) {
          // Documento apareceu, carrega normalmente
          this.currentUser = {
            uid: firebaseUser.uid,
            email: userData.email,
            displayName: userData.displayName,
            matricula: userData.matricula,
            role: userData.role,
            base: userData.base || "JOI",
            ativo: userData.ativo,
            cadastradoEm: userData.cadastradoEm,
            ultimoAcesso: userData.ultimoAcesso
          };
      
          this.userRole = userData.role;
          this.userMatricula = userData.matricula;
      
          await updateDoc(doc(db, 'usuarios', firebaseUser.uid), {
            ultimoAcesso: serverTimestamp()
          });
      
          console.log('✅ Dados do usuário carregados (retry):', this.currentUser.matricula);
        } else {
          console.error('❌ Documento do usuário não encontrado após retries');
          await this.logout();
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do usuário:', error);
      throw error;
    }
  }

  /**
   * VALIDAR FORMATO DE MATRÍCULA
   * Retorna: { valid: boolean, message: string }
   */
  validateMatricula(matricula) {
    if (!matricula || matricula.trim() === '') {
      return { valid: false, message: 'Matrícula é obrigatória' };
    }
    
    const matriculaUpper = matricula.toUpperCase().trim();
    
    if (!CONFIG.matriculaPattern.test(matriculaUpper)) {
      return { 
        valid: false, 
        message: 'Matrícula deve ter 3 letras seguidas de 4 números (ex: ABC1234)' 
      };
    }
    
    return { valid: true, matricula: matriculaUpper };
  }

  /**
   * VALIDAR SENHA
   * Retorna: { valid: boolean, message: string }
   */
  validateSenha(senha) {
    if (!senha || senha.length < CONFIG.senhaMinLength) {
      return { 
        valid: false, 
        message: `Senha deve ter no mínimo ${CONFIG.senhaMinLength} caracteres` 
      };
    }
    
    const requirements = CONFIG.senhaRequirements;
    const errors = [];
    
    if (requirements.uppercase && !/[A-Z]/.test(senha)) {
      errors.push('uma letra maiúscula');
    }
    
    if (requirements.lowercase && !/[a-z]/.test(senha)) {
      errors.push('uma letra minúscula');
    }
    
    if (requirements.number && !/\d/.test(senha)) {
      errors.push('um número');
    }
    
    if (requirements.special) {
      const specialRegex = new RegExp(`[${CONFIG.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
      if (!specialRegex.test(senha)) {
        errors.push('um caractere especial');
      }
    }
    
    if (errors.length > 0) {
      return {
        valid: false,
        message: `Senha deve conter pelo menos: ${errors.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  /**
   * VERIFICAR SE MATRÍCULA ESTÁ HABILITADA
   * Retorna: { habilitada: boolean, usada: boolean, role: string }
   */
  async verificarMatriculaHabilitada(matricula) {
    try {
      const matriculaDoc = await getDoc(doc(db, 'matriculas', matricula));
      
      if (!matriculaDoc.exists()) {
        return { 
          habilitada: false, 
          message: 'Matrícula não autorizada. Contate o administrador.' 
        };
      }
      
      const data = matriculaDoc.data();
      
      if (data.usada) {
        return { 
          habilitada: false, 
          message: 'Matrícula já foi utilizada para cadastro.' 
        };
      }
      
      if (!data.habilitada) {
        return { 
          habilitada: false, 
          message: 'Matrícula desabilitada. Contate o administrador.' 
        };
      }
      
      return { 
        habilitada: true, 
        role: data.role || 'user',
        observacao: data.observacao
      };
      
    } catch (error) {
      console.error('❌ Erro ao verificar matrícula:', error);
      throw new Error('Erro ao verificar matrícula. Tente novamente.');
    }
  }

  /**
   * CADASTRAR NOVO USUÁRIO
   */
  async cadastrar(matricula, senha, confirmarSenha, email, nomeCompleto, nomeBA) {
    try {
      // 1. Validar matrícula
      const matriculaValidation = this.validateMatricula(matricula);
      if (!matriculaValidation.valid) {
        throw new Error(matriculaValidation.message);
      }
      const matriculaUpper = matriculaValidation.matricula;
      
      // 2. Validar senha
      if (senha !== confirmarSenha) {
        throw new Error('As senhas não coincidem');
      }
      
      const senhaValidation = this.validateSenha(senha);
      if (!senhaValidation.valid) {
        throw new Error(senhaValidation.message);
      }
      
      // 3. Validar email
      if (!email || !email.includes('@')) {
        throw new Error('Email inválido');
      }
      
      // 4. Validar nome
      if (!nomeCompleto || nomeCompleto.trim().length < 3) {
        throw new Error('Nome completo deve ter pelo menos 3 caracteres');
      }
      
      if (!nomeBA || nomeBA.trim().length < 2) {
        throw new Error('Nome de BA deve ter pelo menos 2 caracteres');
      }
      
      // 5. Verificar se matrícula está habilitada
      const matriculaCheck = await this.verificarMatriculaHabilitada(matriculaUpper);
      if (!matriculaCheck.habilitada) {
        throw new Error(matriculaCheck.message);
      }
      
      // 6. Verificar se matrícula já está em uso (double-check)
      const usuariosQuery = query(
        collection(db, 'usuarios'), 
        where('matricula', '==', matriculaUpper)
      );
      const usuariosSnapshot = await getDocs(usuariosQuery);
      
      if (!usuariosSnapshot.empty) {
        throw new Error('Matrícula já cadastrada no sistema');
      }
      
      // 7. Criar email virtual para autenticação Firebase
      const emailVirtual = `${matriculaUpper}${CONFIG.emailDomain}`;
      
      // 8. Criar usuário no Firebase Auth
      this.isRegistering = true;
      const userCredential = await createUserWithEmailAndPassword(auth, emailVirtual, senha);
      const user = userCredential.user;
      
      // 9. Atualizar profile com nome
      await updateProfile(user, {
        displayName: nomeBA.trim()
      });
      
      // 10. Criar documento do usuário no Firestore
      await setDoc(doc(db, 'usuarios', user.uid), {
        matricula: matriculaUpper,
        email: email.toLowerCase().trim(),
        nomeCompleto: nomeCompleto.trim(),
        displayName: nomeBA.trim(),
        role: matriculaCheck.role,
        base: "JOI",
        ativo: true,
        cadastradoEm: serverTimestamp(),
        ultimoAcesso: serverTimestamp()
      });
      
      // 11. Marcar matrícula como usada
      await updateDoc(doc(db, 'matriculas', matriculaUpper), {
        usada: true,
        usadaEm: serverTimestamp(),
        usadaPor: user.uid
      });

      this.isRegistering = false;  // libera o listener
      console.log('✅ Cadastro realizado com sucesso:', matriculaUpper);
      
      // Carrega dados completos do usuário no this.currentUser
      await this.loadUserData(user);
      
      // Dispara manualmente agora que tudo está gravado
      this.notifyListeners('login', this.currentUser);
      
      // Disparar evento global de mudança de estado
      window.dispatchEvent(new CustomEvent('auth-state-changed', { 
        detail: { user: this.currentUser } 
      }));
      
      // NÃO precisa fazer login manual - Firebase já autenticou automaticamente!
      // O onAuthStateChanged vai detectar e carregar os dados
      
      return { 
        success: true, 
        message: `Bem-vindo(a), ${nomeBA}!`,
        autoLogin: true,
        user: {
          uid: user.uid,
          matricula: matriculaUpper,
          displayName: nomeBA.trim()
        }
      };
      
    } catch (error) {
      console.error('❌ Erro no cadastro:', error);
      
      // Traduzir erros do Firebase
      let message = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        message = 'Esta matrícula já está cadastrada';
      } else if (error.code === 'auth/weak-password') {
        message = 'Senha muito fraca';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Erro de conexão. Verifique sua internet.';
      }
      
      throw new Error(message);
    }
  }

  /**
   * FAZER LOGIN
   */
  async login(matricula, senha) {
    try {
      // 1. Validar matrícula
      const matriculaValidation = this.validateMatricula(matricula);
      if (!matriculaValidation.valid) {
        throw new Error(matriculaValidation.message);
      }
      const matriculaUpper = matriculaValidation.matricula;
      
      // 2. Buscar usuário pela matrícula
      const usuariosQuery = query(
        collection(db, 'usuarios'), 
        where('matricula', '==', matriculaUpper)
      );
      const usuariosSnapshot = await getDocs(usuariosQuery);
      
      if (usuariosSnapshot.empty) {
        throw new Error('Matrícula não cadastrada');
      }
      
      const userData = usuariosSnapshot.docs[0].data();
      
      // 3. Verificar se usuário está ativo
      if (!userData.ativo) {
        throw new Error('Usuário desativado. Contate o administrador.');
      }
      
      // 4. Criar email virtual para login
      const emailVirtual = `${matriculaUpper}${CONFIG.emailDomain}`;
      
      // 5. Fazer login no Firebase
      await signInWithEmailAndPassword(auth, emailVirtual, senha);
      
      console.log('✅ Login realizado com sucesso:', matriculaUpper);
      
      return { 
        success: true, 
        message: 'Login realizado com sucesso!'
      };
      
    } catch (error) {
      console.error('❌ Erro no login:', error);
      
      // Traduzir erros do Firebase
      let message = 'Matrícula ou senha incorretos';
      
      if (error.code === 'auth/wrong-password') {
        message = 'Senha incorreta';
      } else if (error.code === 'auth/user-not-found') {
        message = 'Matrícula não cadastrada';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Muitas tentativas. Tente novamente mais tarde.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Erro de conexão. Verifique sua internet.';
      } else if (error.message && !error.code) {
        message = error.message;
      }
      
      throw new Error(message);
    }
  }

  /**
   * FAZER LOGOUT
   */
  async logout() {
    try {
      await signOut(auth);
      console.log('✅ Logout realizado');
      return { success: true };
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      throw error;
    }
  }

  /**
   * RECUPERAR SENHA
   */
  async recuperarSenha(matricula) {
    try {
      // 1. Validar matrícula
      const matriculaValidation = this.validateMatricula(matricula);
      if (!matriculaValidation.valid) {
        throw new Error(matriculaValidation.message);
      }
      const matriculaUpper = matriculaValidation.matricula;
      
      // 2. Buscar usuário pela matrícula
      const usuariosQuery = query(
        collection(db, 'usuarios'), 
        where('matricula', '==', matriculaUpper)
      );
      const usuariosSnapshot = await getDocs(usuariosQuery);
      
      if (usuariosSnapshot.empty) {
        throw new Error('Matrícula não cadastrada');
      }
      
      const userData = usuariosSnapshot.docs[0].data();
      const emailRecuperacao = userData.email;
      
      // 3. Enviar email de recuperação para o email REAL do usuário
      // Nota: Firebase não envia para emails virtuais, então enviamos para o email de recuperação
      await sendPasswordResetEmail(auth, emailRecuperacao);
      
      console.log('✅ Email de recuperação enviado para:', emailRecuperacao);
      
      return { 
        success: true, 
        message: `Email de recuperação enviado para ${emailRecuperacao}`,
        email: emailRecuperacao
      };
      
    } catch (error) {
      console.error('❌ Erro na recuperação de senha:', error);
      
      let message = error.message;
      
      if (error.code === 'auth/user-not-found') {
        message = 'Matrícula não cadastrada';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Muitas tentativas. Tente novamente mais tarde.';
      }
      
      throw new Error(message);
    }
  }

  /**
   * VERIFICAR SE USUÁRIO É ADMIN
   */
  isAdmin() {
    return this.userRole === 'admin';
  }

  /**
   * VERIFICAR SE É SUPER ADMIN
   */
  isSuperAdmin() {
    if (!this.currentUser) return false;
    return this.currentUser.role === 'super-admin';
  }
  
  /**
   * OBTER BASE DO USUÁRIO
   */
  getBaseUsuario() {
    return this.currentUser?.base || null;
  }
  
  /**
   * VERIFICAR SE É ADMIN DE UMA BASE ESPECÍFICA
   */
  isAdminDaBase(baseId) {
    if (!this.currentUser) return false;
    return this.currentUser.role === 'admin' && this.currentUser.base === baseId;
  }

  /**
   * VERIFICAR SE USUÁRIO ESTÁ LOGADO
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * ADICIONAR LISTENER PARA MUDANÇAS DE AUTENTICAÇÃO
   * callback recebe (event, user) onde event = 'login' ou 'logout'
   */
  addAuthListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * NOTIFICAR TODOS OS LISTENERS
   */
  notifyListeners(event, user) {
    this.listeners.forEach(callback => {
      try {
        callback(event, user);
      } catch (error) {
        console.error('❌ Erro em listener:', error);
      }
    });
  }
}

// Criar instância global
const authCore = new AuthCore();

// Exportar
export default authCore;

// Também exportar para uso global (se necessário)
window.authCore = authCore;

console.log('✅ AuthCore carregado');
