const PDV_DB_NAME = 'lf_pdv_offline';
const PDV_DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDV_DB_NAME, PDV_DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('produtos')) {
        db.createObjectStore('produtos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('clientes')) {
        db.createObjectStore('clientes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('vendas_pendentes')) {
        db.createObjectStore('vendas_pendentes', { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function salvarProdutos(produtos) {
  try {
    const db = await openDB();
    const tx = db.transaction('produtos', 'readwrite');
    const store = tx.objectStore('produtos');
    store.clear();
    for (const p of produtos) store.put(p);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] salvarProdutos:', err);
  }
}

export async function getProdutos() {
  try {
    const db = await openDB();
    const req = db.transaction('produtos', 'readonly').objectStore('produtos').getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] getProdutos:', err);
    return [];
  }
}

export async function salvarClientes(clientes) {
  try {
    const db = await openDB();
    const tx = db.transaction('clientes', 'readwrite');
    const store = tx.objectStore('clientes');
    store.clear();
    for (const c of clientes) store.put(c);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] salvarClientes:', err);
  }
}

export async function getClientes() {
  try {
    const db = await openDB();
    const req = db.transaction('clientes', 'readonly').objectStore('clientes').getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] getClientes:', err);
    return [];
  }
}

export async function salvarVendaPendente(venda) {
  try {
    const db = await openDB();
    const req = db.transaction('vendas_pendentes', 'readwrite')
      .objectStore('vendas_pendentes')
      .add({ ...venda, _queued_at: new Date().toISOString() });
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] salvarVendaPendente:', err);
    return null;
  }
}

export async function getVendasPendentes() {
  try {
    const db = await openDB();
    const req = db.transaction('vendas_pendentes', 'readonly').objectStore('vendas_pendentes').getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] getVendasPendentes:', err);
    return [];
  }
}

export async function contarVendasPendentes() {
  try {
    const db = await openDB();
    const req = db.transaction('vendas_pendentes', 'readonly').objectStore('vendas_pendentes').count();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result || 0); };
      req.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    return 0;
  }
}

export async function removerVendaPendente(id) {
  try {
    const db = await openDB();
    const tx = db.transaction('vendas_pendentes', 'readwrite');
    tx.objectStore('vendas_pendentes').delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = (e) => { db.close(); reject(e.target.error); };
    });
  } catch (err) {
    console.warn('[PDV Offline] removerVendaPendente:', err);
  }
}
