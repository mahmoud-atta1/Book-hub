const API_BASE_URL = (() => {
  const isFileProtocol = window.location.protocol === 'file:';
  const isLocalStaticServer =
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1') &&
    window.location.port !== '3000';

  if (isFileProtocol || isLocalStaticServer) {
    const localHost = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
    return `http://${localHost}:3000/api/v1`;
  }

  return `${window.location.origin}/api/v1`;
})();

const EMPTY_AVATAR_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

let token = localStorage.getItem('token');
let currentUser = null;
let allBooks = [];
let myTransactions = [];
let adminTransactions = [];
let catalogStats = null;
let transactionStats = null;
let lastPendingAdminNotice = null;
let syncIntervalId = null;
let isSyncing = false;
let currentSection = 'auth';
let adminSyncTick = 0;
let userSyncTick = 0;
let lastMyTransactionsSignature = '';
let lastAdminTransactionsSignature = '';
let enhancedSelectEventsBound = false;

const bookFilters = {
  search: '',
  priceSort: 'default',
};

const uiFilters = {
  ordersStatus: 'all',
  adminTransactions: 'all',
};

document.addEventListener('DOMContentLoaded', () => {
  const profileImage = document.getElementById('profile-image');
  if (profileImage) {
    setProfileAvatarEmpty();
  }

  initializeEnhancedSelects();
  switchAuthMode('login');
  showSection('auth');
  checkApiAvailability();

  if (token) {
    getCurrentUser();
  }
});

function initializeEnhancedSelects() {
  const selects = document.querySelectorAll('.toolbar-selects select');
  if (!selects.length) return;

  selects.forEach((select) => {
    if (select.dataset.enhanced === 'true') return;

    select.dataset.enhanced = 'true';
    select.classList.add('native-select-hidden');

    const pretty = document.createElement('div');
    pretty.className = 'pretty-select';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'pretty-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerText = document.createElement('span');
    triggerText.className = 'pretty-select-value';

    const triggerIcon = document.createElement('i');
    triggerIcon.className = 'fas fa-chevron-down pretty-select-caret';
    triggerIcon.setAttribute('aria-hidden', 'true');

    trigger.appendChild(triggerText);
    trigger.appendChild(triggerIcon);

    const menu = document.createElement('div');
    menu.className = 'pretty-select-menu';
    menu.setAttribute('role', 'listbox');

    const optionButtons = Array.from(select.options).map((option) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'pretty-select-option';
      optionButton.textContent = option.textContent;
      optionButton.dataset.value = option.value;

      optionButton.addEventListener('click', () => {
        if (select.value === option.value) {
          closeEnhancedSelects();
          return;
        }

        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeEnhancedSelects();
      });

      menu.appendChild(optionButton);
      return optionButton;
    });

    const syncFromNativeSelect = () => {
      const currentOption = select.options[select.selectedIndex];
      triggerText.textContent = currentOption ? currentOption.textContent : '';

      optionButtons.forEach((optionButton) => {
        optionButton.classList.toggle('active', optionButton.dataset.value === select.value);
      });
    };

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = pretty.classList.contains('open');
      closeEnhancedSelects(pretty);
      if (!isOpen) {
        pretty.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    select.addEventListener('change', syncFromNativeSelect);
    syncFromNativeSelect();

    pretty.appendChild(trigger);
    pretty.appendChild(menu);
    select.insertAdjacentElement('afterend', pretty);
  });

  if (enhancedSelectEventsBound) return;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.pretty-select')) {
      closeEnhancedSelects();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeEnhancedSelects();
    }
  });

  enhancedSelectEventsBound = true;
}

function closeEnhancedSelects(exceptElement = null) {
  document.querySelectorAll('.pretty-select.open').forEach((element) => {
    if (exceptElement && element === exceptElement) return;
    element.classList.remove('open');

    const trigger = element.querySelector('.pretty-select-trigger');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function buildTransactionsSignature(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) return '0';
  return `${transactions.length}|${transactions
    .map((tx) => `${tx._id}:${tx.status}:${tx.updatedAt || tx.createdAt || ''}`)
    .join(';')}`;
}

async function readJsonSafe(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractApiError(data, fallbackMessage) {
  if (data && typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (data && Array.isArray(data.errors) && data.errors.length > 0) {
    const firstError = data.errors[0];
    if (firstError && typeof firstError.msg === 'string' && firstError.msg.trim()) {
      return firstError.msg;
    }
  }

  return fallbackMessage;
}

async function checkApiAvailability() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`);
    if (!response.ok) {
      showToast('API not reachable. Run npm run dev.', 'error');
    }
  } catch (_error) {
    showToast('API not reachable. Run npm run dev.', 'error');
  }
}

function switchAuthMode(mode) {
  const loginPanel = document.getElementById('auth-login-panel');
  const registerPanel = document.getElementById('auth-register-panel');
  const loginTab = document.getElementById('auth-tab-login');
  const registerTab = document.getElementById('auth-tab-register');
  const sideTitle = document.getElementById('auth-side-title');
  const sideText = document.getElementById('auth-side-text');
  const sideBtn = document.getElementById('auth-side-btn');

  if (!loginPanel || !registerPanel || !loginTab || !registerTab) return;

  if (mode === 'register') {
    loginPanel.classList.add('hidden');
    registerPanel.classList.remove('hidden');
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
    if (sideTitle) sideTitle.textContent = 'Already have an account?';
    if (sideText) sideText.textContent = 'Sign in to continue.';
    if (sideBtn) {
      sideBtn.textContent = 'Sign In';
      sideBtn.setAttribute('onclick', "switchAuthMode('login')");
    }
    return;
  }

  registerPanel.classList.add('hidden');
  loginPanel.classList.remove('hidden');
  registerTab.classList.remove('active');
  loginTab.classList.add('active');
  if (sideTitle) sideTitle.textContent = 'New here?';
  if (sideText) {
    sideText.textContent = 'Create an account in seconds.';
  }
  if (sideBtn) {
    sideBtn.textContent = 'Create Account';
    sideBtn.setAttribute('onclick', "switchAuthMode('register')");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.target;

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm').value;

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirmPassword }),
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      showToast(extractApiError(data, 'Registration failed'), 'error');
      return;
    }

    token = data.token;
    localStorage.setItem('token', token);
    currentUser = data.data.user;

    form.reset();
    showToast('Account created successfully', 'success');
    await initializeApp();
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      showToast(extractApiError(data, 'Login failed'), 'error');
      return;
    }

    token = data.token;
    localStorage.setItem('token', token);
    currentUser = data.data.user;

    form.reset();
    showToast('Welcome back', 'success');
    await initializeApp();
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      logout(false);
      return;
    }

    const data = await readJsonSafe(response);
    if (!data || !data.data || !data.data.user) {
      logout(false);
      return;
    }

    currentUser = data.data.user;
    await initializeApp();
  } catch (error) {
    console.error(error);
    logout(false);
  }
}

async function initializeApp() {
  updateUI();
  await Promise.all([loadBooks(), loadTransactionStats()]);

  if (isAdmin()) {
    await Promise.all([loadCatalogStats(), loadAdminTransactions()]);
  } else {
    await loadMyTransactions();
  }

  showSection('marketplace');
  startAutoSync();
}

function logout(showMessage = true) {
  token = null;
  currentUser = null;
  allBooks = [];
  myTransactions = [];
  adminTransactions = [];
  catalogStats = null;
  transactionStats = null;
  lastMyTransactionsSignature = '';
  lastAdminTransactionsSignature = '';
  localStorage.removeItem('token');
  stopAutoSync();

  if (showMessage) {
    showToast('Logged out', 'success');
  }

  showSection('auth');
  updateUI();
  renderBooks([]);
  renderMyTransactions([]);
  renderAdminTransactions([]);
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

async function loadBooks() {
  try {
    const response = await fetch(`${API_BASE_URL}/books`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) logout();
      return;
    }

    const data = await readJsonSafe(response);
    if (!data || !data.data || !Array.isArray(data.data.books)) return;

    allBooks = data.data.books;
    applyBookFilters();
    updateMarketStats();
  } catch (error) {
    console.error(error);
  }
}

async function loadMyTransactions() {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) logout();
      return;
    }

    const data = await readJsonSafe(response);
    if (!data || !data.data || !Array.isArray(data.data.transactions)) return;
    const nextTransactions = data.data.transactions;
    const nextSignature = buildTransactionsSignature(nextTransactions);
    if (nextSignature === lastMyTransactionsSignature) return;

    myTransactions = nextTransactions;
    lastMyTransactionsSignature = nextSignature;
    renderMyTransactions(myTransactions, true);
    updateMarketStats();
  } catch (error) {
    console.error(error);
  }
}

async function loadTransactionStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/stats/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) logout();
      return;
    }

    const data = await readJsonSafe(response);
    if (!data || !data.data) return;

    transactionStats = data.data;
    updateMarketStats();
    updateAdminStats();
  } catch (error) {
    console.error(error);
  }
}

async function loadCatalogStats() {
  if (!isAdmin()) return;

  try {
    const response = await fetch(`${API_BASE_URL}/books/stats/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const data = await readJsonSafe(response);
    if (!data || !data.data) return;

    catalogStats = data.data;
    updateAdminStats();
  } catch (error) {
    console.error(error);
  }
}

async function loadAdminTransactions() {
  if (!isAdmin()) return;

  try {
    const response = await fetch(`${API_BASE_URL}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const data = await readJsonSafe(response);
    if (!data || !data.data || !Array.isArray(data.data.transactions)) return;
    const nextTransactions = data.data.transactions;
    const nextSignature = buildTransactionsSignature(nextTransactions);
    if (nextSignature === lastAdminTransactionsSignature) return;

    adminTransactions = nextTransactions;
    lastAdminTransactionsSignature = nextSignature;
    const pendingCount = adminTransactions.filter((tx) => tx.status === 'pending').length;
    if (pendingCount > 0 && pendingCount !== lastPendingAdminNotice) {
      showToast(`${pendingCount} pending request${pendingCount > 1 ? 's' : ''}`, 'info');
    }
    lastPendingAdminNotice = pendingCount;
    renderAdminTransactions(adminTransactions, true);
  } catch (error) {
    console.error(error);
  }
}

function updateMarketStats() {
  const totalBooks = allBooks.length;
  const inStockBooks = allBooks.filter((book) => Number(book.stock || 0) > 0).length;
  const pendingOrders = myTransactions.filter((tx) => tx.status === 'pending').length;

  setText('market-stat-books', String(totalBooks));
  setText('market-stat-stock', String(inStockBooks));
  setText('market-stat-pending', String(pendingOrders));
}

function setProfileAvatarEmpty() {
  const profileImage = document.getElementById('profile-image');
  if (!profileImage) return;
  profileImage.src = EMPTY_AVATAR_PIXEL;
  profileImage.classList.add('avatar-empty');
}

function updateAdminStats() {
  if (!isAdmin()) return;

  const totalCatalogBooks = catalogStats ? Number(catalogStats.totalBooks || 0) : 0;
  const totalSalesRevenue = transactionStats ? Number(transactionStats.totalSalesRevenue || 0) : 0;
  const totalOrders = transactionStats ? Number(transactionStats.totalTransactions || 0) : 0;
  const pendingRequests = transactionStats ? Number(transactionStats.pendingRequests || 0) : 0;
  const inTransitOrders = transactionStats ? Number(transactionStats.inTransitOrders || 0) : 0;
  const completedOrders = transactionStats ? Number(transactionStats.completedOrders || 0) : 0;

  setText('admin-stat-total-books', String(totalCatalogBooks));
  setText('admin-stat-sales', formatCurrency(totalSalesRevenue));
  setText('admin-stat-total-orders', String(totalOrders));
  setText('admin-stat-pending', String(pendingRequests));
  setText('admin-stat-in-transit', String(inTransitOrders));
  setText('admin-stat-completed', String(completedOrders));
}

function setBookSearch(value) {
  bookFilters.search = String(value || '').trim().toLowerCase();
  applyBookFilters();
}

function setPriceSort(value) {
  const allowed = ['default', 'low_to_high', 'high_to_low'];
  bookFilters.priceSort = allowed.includes(value) ? value : 'default';
  applyBookFilters();
}

function applyBookFilters() {
  let filtered = [...allBooks];

  if (bookFilters.search) {
    filtered = filtered.filter((book) => {
      const searchable = `${book.title || ''} ${book.author || ''} ${book.genre || ''}`.toLowerCase();
      return searchable.includes(bookFilters.search);
    });
  }

  if (bookFilters.priceSort === 'low_to_high') {
    filtered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (bookFilters.priceSort === 'high_to_low') {
    filtered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  }

  renderBooks(filtered);
}

function renderBooks(books) {
  const grid = document.getElementById('books-grid');
  if (!grid) return;

  if (!books.length) {
    grid.innerHTML = `<div class="empty panel"><p>No books found for current filters.</p></div>`;
    return;
  }

  grid.innerHTML = books
    .map((book) => {
      const stock = Number(book.stock || 0);
      const canBuy = book.availableForSale && stock > 0;
      const cover = book.coverImage ? escapeAttribute(book.coverImage) : '';

      return `
      <article class="book-card panel">
        <div class="book-cover-wrap">
          ${
            cover
              ? `<img class="book-cover" src="${cover}" alt="${escapeAttribute(book.title)}" />`
              : `<div class="book-cover cover-placeholder"><i class="fas fa-book-open"></i></div>`
          }
        </div>

        <div class="book-head">
          <h3>${escapeHtml(book.title)}</h3>
          <p>by ${escapeHtml(book.author)}</p>
        </div>

        <div class="book-meta">
          <span>${escapeHtml(book.genre || 'General')}</span>
          <span>Stock: ${stock}</span>
          ${book.featured ? '<span>Featured</span>' : ''}
        </div>

        <p class="book-desc">${escapeHtml(book.description || 'No description provided.')}</p>

        <div class="pricing">
          <div><strong>${formatCurrency(book.price)}</strong><small>Buy</small></div>
        </div>

        <div class="book-actions">
          <button class="btn btn-primary compact" ${canBuy ? '' : 'disabled'} onclick="openDealModal('${book._id}')">
            Buy
          </button>
          ${
            isAdmin()
              ? `<button class="btn btn-secondary compact" onclick="openBookModal('${book._id}')">Edit</button>
                 <button class="btn btn-danger compact" onclick="deleteBook('${book._id}')">Delete</button>`
              : ''
          }
        </div>
      </article>
      `;
    })
    .join('');
}

function setOrdersStatusFilter(value) {
  uiFilters.ordersStatus = value;
  renderMyTransactions(myTransactions, true);
}

function applyOrdersFilters(transactions) {
  return transactions.filter((tx) =>
    uiFilters.ordersStatus === 'all' ? true : tx.status === uiFilters.ordersStatus
  );
}

function updateOrderStats(transactions) {
  const total = transactions.length;
  const pendingOrders = transactions.filter((tx) => tx.status === 'pending').length;
  const completedOrders = transactions.filter((tx) => tx.status === 'completed').length;
  const rejectedOrders = transactions.filter((tx) => tx.status === 'rejected').length;

  setText('order-stat-total', String(total));
  setText('order-stat-pending', String(pendingOrders));
  setText('order-stat-completed', String(completedOrders));
  setText('order-stat-rejected', String(rejectedOrders));
}

function getStatusBadgeClass(status) {
  if (status === 'pending') return 'status-badge status-pending';
  if (status === 'in_transit') return 'status-badge status-info';
  if (status === 'completed') return 'status-badge status-success';
  if (status === 'rejected') return 'status-badge status-danger';
  if (status === 'cancelled') return 'status-badge status-danger';
  return 'status-badge status-muted';
}

function formatStatusLabel(status) {
  if (!status) return 'Unknown';
  if (status === 'in_transit') return 'On The Way';
  return String(status).charAt(0).toUpperCase() + String(status).slice(1);
}

function getDisplayName(user) {
  const rawName = String(user?.name || '').trim();
  const email = String(user?.email || '').trim();

  if (rawName && !rawName.includes('@')) return rawName;

  if (email.includes('@')) {
    const usernamePart = email.split('@')[0].trim();
    if (usernamePart) {
      return usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1);
    }
  }

  return 'User';
}

function getOrderCardClass(status) {
  if (status === 'pending') return 'order-card panel status-pending';
  if (status === 'in_transit') return 'order-card panel status-in-transit';
  if (status === 'completed') return 'order-card panel status-completed';
  if (status === 'rejected') return 'order-card panel status-rejected';
  if (status === 'cancelled') return 'order-card panel status-cancelled';
  return 'order-card panel';
}

function canAdminSetStatus(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  if (currentStatus === 'completed' || currentStatus === 'cancelled') return false;

  if (currentStatus === 'pending') {
    return nextStatus === 'in_transit' || nextStatus === 'completed' || nextStatus === 'rejected';
  }

  if (currentStatus === 'in_transit') {
    return nextStatus === 'pending' || nextStatus === 'completed' || nextStatus === 'rejected';
  }

  if (currentStatus === 'rejected') {
    return nextStatus === 'pending' || nextStatus === 'in_transit' || nextStatus === 'completed';
  }

  return false;
}

function renderMyTransactions(transactions, applyFilters = false) {
  const list = document.getElementById('orders-list');
  if (!list) return;

  updateOrderStats(transactions);
  const source = applyFilters ? applyOrdersFilters(transactions) : transactions;

  if (!source.length) {
    list.innerHTML = `<div class="empty panel"><p>No transactions yet.</p></div>`;
    return;
  }

  list.innerHTML = source
    .map((tx) => {
      const title = tx.book?.title || 'Book Removed';
      const rejectionMeta =
        tx.status === 'rejected' && tx.rejectionReason
          ? `<p>Reason: ${escapeHtml(tx.rejectionReason)}</p>`
          : '';

      return `
      <article class="${getOrderCardClass(tx.status)}">
        <div class="order-header">
          <h3>${escapeHtml(title)}</h3>
          <span class="${getStatusBadgeClass(tx.status)}">${escapeHtml(formatStatusLabel(tx.status))}</span>
        </div>
        <p>Type: Buy</p>
        <p>Qty: ${Number(tx.quantity || 1)}</p>
        <p>Created: ${new Date(tx.createdAt).toLocaleString()}</p>
        ${rejectionMeta}
      </article>
      `;
    })
    .join('');
}

function setAdminTransactionsFilter(value) {
  uiFilters.adminTransactions = value;
  renderAdminTransactions(adminTransactions, true);
}

function applyAdminTransactionsFilter(transactions) {
  if (uiFilters.adminTransactions === 'all') return transactions;
  if (uiFilters.adminTransactions === 'pending') {
    return transactions.filter((tx) => tx.status === 'pending');
  }
  if (uiFilters.adminTransactions === 'in_transit') {
    return transactions.filter((tx) => tx.status === 'in_transit');
  }
  if (uiFilters.adminTransactions === 'completed') {
    return transactions.filter((tx) => tx.status === 'completed');
  }
  if (uiFilters.adminTransactions === 'rejected') {
    return transactions.filter((tx) => tx.status === 'rejected');
  }
  return transactions;
}

function renderAdminTransactions(transactions, applyFilters = false) {
  const list = document.getElementById('admin-transactions-list');
  if (!list) return;

  const source = applyFilters ? applyAdminTransactionsFilter(transactions) : transactions;

  if (!source.length) {
    list.innerHTML = `<div class="empty panel"><p>No transactions recorded.</p></div>`;
    return;
  }

  list.innerHTML = source
    .map((tx) => {
      const title = tx.book?.title || 'Book Removed';
      const userName = tx.user?.name || 'Unknown User';
      const adminNote =
        tx.status === 'rejected' && tx.rejectionReason
          ? `<p>Reason: ${escapeHtml(tx.rejectionReason)}</p>`
          : '';
      const statusOptions = [
        { value: 'pending', label: 'Under Review' },
        { value: 'in_transit', label: 'On The Way' },
        { value: 'completed', label: 'Completed' },
        { value: 'rejected', label: 'Rejected' },
      ];
      const statusControl = `<div class="admin-status-control">
        ${statusOptions
          .map((option) => {
            const isActive = tx.status === option.value;
            const canChange = canAdminSetStatus(tx.status, option.value);
            const disabledAttr = canChange ? '' : 'disabled';
            const disabledClass = canChange ? '' : ' disabled';
            const clickAction =
              canChange && !isActive
                ? `onclick="updateOrderStatus('${tx._id}', '${option.value}', '${tx.status}')"`
                : '';

            return `<button type="button" class="status-chip ${isActive ? 'active' : ''}${disabledClass}" ${disabledAttr} ${clickAction}>
              ${option.label}
            </button>`;
          })
          .join('')}
      </div>`;

      return `
      <article class="${getOrderCardClass(tx.status)}">
        <div class="order-header">
          <h3>${escapeHtml(title)}</h3>
          <span class="${getStatusBadgeClass(tx.status)}">${escapeHtml(formatStatusLabel(tx.status))}</span>
        </div>
        <p>User: ${escapeHtml(userName)}</p>
        <p>Phone: ${escapeHtml(tx.customerPhone || 'N/A')}</p>
        <p>Address: ${escapeHtml(tx.customerAddress || 'N/A')}</p>
        <p>Type: Buy</p>
        <p>Total: ${formatCurrency(tx.totalPrice)}</p>
        <p>Qty: ${Number(tx.quantity || 1)}</p>
        <p>Created: ${new Date(tx.createdAt).toLocaleString()}</p>
        ${adminNote}
        <div class="order-actions">${statusControl}</div>
      </article>
      `;
    })
    .join('');
}

function openDealModal(bookId) {
  const book = allBooks.find((item) => item._id === bookId);
  if (!book) return;

  setText('deal-modal-title', 'Confirm Purchase');

  document.getElementById('deal-book-id').value = book._id;
  document.getElementById('deal-quantity').value = '1';
  document.getElementById('deal-customer-name').value = getDisplayName(currentUser);
  document.getElementById('deal-phone').value = '';
  document.getElementById('deal-address').value = '';
  document.getElementById('deal-notes').value = '';

  const summary = `
    <p><strong>${escapeHtml(book.title)}</strong> by ${escapeHtml(book.author)}</p>
    <p>Stock: ${Number(book.stock || 0)}</p>
    <p>Price: ${formatCurrency(book.price)}</p>
  `;
  document.getElementById('deal-book-summary').innerHTML = summary;

  document.getElementById('deal-modal').classList.add('show');
}

async function confirmDeal(event) {
  event.preventDefault();

  const bookId = document.getElementById('deal-book-id').value;
  const quantity = Number(document.getElementById('deal-quantity').value || 1);
  const customerName = document.getElementById('deal-customer-name').value.trim();
  const customerPhone = document.getElementById('deal-phone').value.trim();
  const customerAddress = document.getElementById('deal-address').value.trim();
  const customerNotes = document.getElementById('deal-notes').value.trim();

  if (!customerName || !customerPhone || !customerAddress) {
    showToast('Name, phone, and address are required', 'error');
    return;
  }

  const endpoint = 'purchase';
  const payload = { bookId, quantity, customerName, customerPhone, customerAddress, customerNotes };

  try {
    const response = await fetch(`${API_BASE_URL}/transactions/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      showToast(extractApiError(data, 'Operation failed'), 'error');
      return;
    }

    closeModal('deal-modal');
    showToast('Request sent to admin', 'success');

    await Promise.all([loadBooks(), loadMyTransactions(), loadTransactionStats()]);
    if (isAdmin()) {
      await Promise.all([loadCatalogStats(), loadAdminTransactions()]);
    }
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

async function updateOrderStatus(transactionId, status, currentStatus = '') {
  if (!isAdmin()) return;
  if (!canAdminSetStatus(currentStatus, status)) {
    showToast('This status change is not allowed', 'info');
    return;
  }
  if (currentStatus === status) return;

  let reason = '';

  if (status === 'rejected') {
    reason = window.prompt('Rejection reason (optional):', '') || '';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, reason }),
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      showToast(extractApiError(data, 'Status update failed'), 'error');
      return;
    }

    showToast(`Order updated: ${formatStatusLabel(status)}`, 'success');
    await Promise.all([loadBooks(), loadCatalogStats(), loadAdminTransactions(), loadTransactionStats()]);
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

function stopAutoSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

function startAutoSync() {
  stopAutoSync();
  if (!token || !currentUser) return;
  const intervalMs = isAdmin() ? 20000 : 15000;
  adminSyncTick = 0;
  userSyncTick = 0;

  syncIntervalId = setInterval(async () => {
    if (!token || !currentUser || isSyncing || document.hidden) return;

    isSyncing = true;
    try {
      if (isAdmin()) {
        if (currentSection !== 'admin') return;
        adminSyncTick += 1;
        if (adminSyncTick % 3 === 0) {
          await Promise.all([loadAdminTransactions(), loadTransactionStats(), loadCatalogStats()]);
        } else {
          await loadAdminTransactions();
        }
      } else {
        if (currentSection !== 'orders') return;
        userSyncTick += 1;
        if (userSyncTick % 2 === 0) {
          await Promise.all([loadMyTransactions(), loadTransactionStats()]);
        } else {
          await loadMyTransactions();
        }
      }
    } finally {
      isSyncing = false;
    }
  }, intervalMs);
}

function openBookModal(bookId = null) {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    return;
  }

  const form = document.getElementById('book-form');
  form.reset();
  document.getElementById('book-id').value = '';
  document.getElementById('book-featured').checked = false;

  if (!bookId) {
    setText('book-modal-title', 'Add Catalog Book');
    document.getElementById('book-modal').classList.add('show');
    return;
  }

  const book = allBooks.find((item) => item._id === bookId);
  if (!book) return;

  setText('book-modal-title', 'Edit Catalog Book');
  document.getElementById('book-id').value = book._id;
  document.getElementById('book-title').value = book.title || '';
  document.getElementById('book-author').value = book.author || '';
  document.getElementById('book-genre').value = book.genre || 'General';
  document.getElementById('book-isbn').value = book.isbn || '';
  document.getElementById('book-price').value = book.price ?? 0;
  document.getElementById('book-stock').value = book.stock ?? 0;
  document.getElementById('book-cover-image').value = book.coverImage || '';
  document.getElementById('book-description').value = book.description || '';
  document.getElementById('book-featured').checked = Boolean(book.featured);

  document.getElementById('book-modal').classList.add('show');
}

function buildBookPayloadFromForm() {
  return {
    title: document.getElementById('book-title').value.trim(),
    author: document.getElementById('book-author').value.trim(),
    genre: document.getElementById('book-genre').value.trim() || 'General',
    isbn: document.getElementById('book-isbn').value.trim() || undefined,
    price: Number(document.getElementById('book-price').value || 0),
    stock: Number(document.getElementById('book-stock').value || 0),
    coverImage: document.getElementById('book-cover-image').value.trim(),
    description: document.getElementById('book-description').value.trim(),
    availableForSale: true,
    featured: document.getElementById('book-featured').checked,
  };
}

async function handleBookSubmit(event) {
  event.preventDefault();

  const bookId = document.getElementById('book-id').value;
  const payload = buildBookPayloadFromForm();

  if (payload.price < 0 || payload.stock < 0) {
    showToast('Price and stock must be non-negative', 'error');
    return;
  }

  const url = bookId ? `${API_BASE_URL}/books/${bookId}` : `${API_BASE_URL}/books`;
  const method = bookId ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      showToast(extractApiError(data, 'Unable to save book'), 'error');
      return;
    }

    closeModal('book-modal');
    showToast(bookId ? 'Book updated' : 'Book added', 'success');

    await Promise.all([loadBooks(), loadCatalogStats()]);
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

async function deleteBook(bookId) {
  if (!isAdmin()) return;
  if (!window.confirm('Delete this book from catalog?')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/books/${bookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      showToast(extractApiError(data, 'Delete failed'), 'error');
      return;
    }

    showToast('Book deleted', 'success');
    await Promise.all([loadBooks(), loadCatalogStats()]);
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

function showSection(section) {
  let activeSection = section;

  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('marketplace-section').classList.add('hidden');
  document.getElementById('orders-section').classList.add('hidden');
  document.getElementById('admin-section').classList.add('hidden');

  if (section === 'auth') {
    document.getElementById('auth-section').classList.remove('hidden');
  } else if (section === 'marketplace') {
    document.getElementById('marketplace-section').classList.remove('hidden');
  } else if (section === 'orders') {
    if (isAdmin()) {
      showToast('Orders page is for users only', 'info');
      document.getElementById('admin-section').classList.remove('hidden');
      activeSection = 'admin';
    } else {
      document.getElementById('orders-section').classList.remove('hidden');
      loadMyTransactions();
      loadTransactionStats();
    }
  } else if (section === 'admin') {
    if (!isAdmin()) {
      showToast('Admin access required', 'error');
      document.getElementById('marketplace-section').classList.remove('hidden');
      activeSection = 'marketplace';
    } else {
      document.getElementById('admin-section').classList.remove('hidden');
    }
  }

  updateLayoutMode(activeSection);
  currentSection = activeSection;
  updateNavigation();
  setActiveNav(activeSection);
}

function updateLayoutMode(section) {
  const appLayout = document.getElementById('app-layout');
  if (!appLayout) return;
  appLayout.classList.toggle('auth-mode', section === 'auth');
}

function updateNavigation() {
  const hasUser = Boolean(currentUser);
  const admin = isAdmin();

  document.getElementById('nav-auth').classList.toggle('hidden', hasUser);
  document.getElementById('nav-marketplace').classList.toggle('hidden', !hasUser);
  document.getElementById('nav-orders').classList.toggle('hidden', !hasUser || admin);
  document.getElementById('nav-logout').classList.toggle('hidden', !hasUser);
  document.getElementById('nav-admin').classList.toggle('hidden', !admin);
  document.getElementById('admin-market-actions').classList.toggle('hidden', !admin);
  document.getElementById('user-profile').classList.toggle('hidden', !hasUser);
}

function setActiveNav(section) {
  const map = {
    auth: 'nav-auth',
    marketplace: 'nav-marketplace',
    orders: 'nav-orders',
    admin: 'nav-admin',
  };

  Object.values(map).forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.classList.remove('active');
  });

  const target = map[section];
  if (!target) return;
  const targetElement = document.getElementById(target);
  if (targetElement && !targetElement.classList.contains('hidden')) {
    targetElement.classList.add('active');
  }
}

function updateUI() {
  const roleBadge = document.getElementById('user-role-badge');
  const emailElement = document.getElementById('user-email');

  if (!currentUser) {
    setText('user-name', 'Guest');
    setText('user-email', 'guest@example.com');
    setText('user-role-badge', 'User');
    if (emailElement) emailElement.classList.remove('hidden');
    if (roleBadge) roleBadge.classList.remove('admin');
    setProfileAvatarEmpty();
    updateNavigation();
    return;
  }

  const displayName = getDisplayName(currentUser);
  const email = String(currentUser.email || '').trim();
  const isDuplicate = displayName.toLowerCase() === email.toLowerCase();

  setText('user-name', displayName);
  setText('user-email', email);
  setText('user-role-badge', isAdmin() ? 'Admin' : 'User');
  if (emailElement) emailElement.classList.toggle('hidden', !email || isDuplicate);
  if (roleBadge) roleBadge.classList.toggle('admin', isAdmin());
  setProfileAvatarEmpty();
  updateNavigation();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('show');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 200);
  }, 2400);
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return String(value).replace(/'/g, '&#039;').replace(/"/g, '&quot;');
}

window.onclick = (event) => {
  const bookModal = document.getElementById('book-modal');
  const dealModal = document.getElementById('deal-modal');
  if (event.target === bookModal) closeModal('book-modal');
  if (event.target === dealModal) closeModal('deal-modal');
};
