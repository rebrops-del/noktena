from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected one target, found {text.count(old)}')
    return text.replace(old, new, 1)


# --- admin/admin.js ---
p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')

s = replace_once(s,
"""  function authHeaders(extra = {}, token = null) {
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${token || state.session?.access_token || cfg.supabaseAnonKey}`,
      ...extra
    };
  }

  async function request(path, options = {}) {
    const r = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {})
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      if (r.status === 401) {
        localStorage.removeItem(SESSION_KEY);
      }
      throw new Error(text || `HTTP ${r.status}`);
    }
    if (r.status === 204 || options.headers?.Prefer?.includes('return=minimal')) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
""",
"""  function authHeaders(extra = {}, token = null) {
    const headers = {apikey: cfg.supabaseAnonKey, ...extra};
    const bearer = token || state.session?.access_token;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return headers;
  }

  function publicAuthHeaders(extra = {}) {
    return {apikey: cfg.supabaseAnonKey, ...extra};
  }

  async function refreshSession() {
    const refreshToken = state.session?.refresh_token;
    if (!refreshToken) throw new Error('Нет refresh token');
    const r = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
      method:'POST',
      headers:publicAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({refresh_token:refreshToken})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || 'Сессия истекла');
    state.session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  }

  async function request(path, options = {}, retried = false) {
    const r = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {})
    });
    if (r.status === 401 && !retried && state.session?.refresh_token) {
      try {
        await refreshSession();
        return request(path, options, true);
      } catch (_) {
        localStorage.removeItem(SESSION_KEY);
        state.session = null;
      }
    }
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(text || `HTTP ${r.status}`);
    }
    if (r.status === 204 || options.headers?.Prefer?.includes('return=minimal')) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
""",
'auth headers and refresh')

s = replace_once(s,
"""  async function signIn(email, password) {
    const r = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders({'Content-Type':'application/json'}, cfg.supabaseAnonKey),
      body: JSON.stringify({email, password})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || 'Не удалось войти');
    state.session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  }

  function restoreSession() {
""",
"""  async function signIn(email, password) {
    const r = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: publicAuthHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({email, password})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || data.error || 'Не удалось войти');
    state.session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  }

  async function updatePassword(password) {
    const token = state.session?.access_token;
    if (!token) throw new Error('Сессия не найдена. Войдите заново.');
    const r = await fetch(`${baseUrl()}/auth/v1/user`, {
      method:'PUT',
      headers:authHeaders({'Content-Type':'application/json'}, token),
      body:JSON.stringify({password})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Не удалось изменить пароль');
    return data;
  }

  async function sendRecovery(email) {
    const redirectTo = `${location.origin}/admin/`;
    const r = await fetch(`${baseUrl()}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method:'POST',
      headers:publicAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({email})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Не удалось отправить письмо');
  }

  function adoptRecoverySession() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (hash.get('type') !== 'recovery' || !hash.get('access_token')) return false;
    state.session = {
      access_token: hash.get('access_token'),
      refresh_token: hash.get('refresh_token') || '',
      token_type: hash.get('token_type') || 'bearer',
      expires_in: Number(hash.get('expires_in')) || 3600,
      user: null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    return true;
  }

  function restoreSession() {
""",
'sign in and password helpers')

# Add password/recovery handlers before the normal logout binding.
s = replace_once(s,
"""    $('#logoutBtn').addEventListener('click', () => { localStorage.removeItem(SESSION_KEY); location.reload(); });
""",
"""    $('#forgotPasswordBtn').addEventListener('click', async () => {
      const email = $('#loginEmail').value.trim().toLowerCase();
      const status = $('#recoveryStatus');
      status.textContent = '';
      if (!email) { status.textContent = 'Введите e-mail администратора.'; return; }
      const btn = $('#forgotPasswordBtn');
      btn.disabled = true;
      btn.textContent = 'Отправляем…';
      try {
        await sendRecovery(email);
        status.style.color = '#16704a';
        status.textContent = 'Ссылка для смены пароля отправлена на e-mail.';
      } catch (err) {
        status.style.color = '#c93845';
        status.textContent = err.message || 'Не удалось отправить письмо.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Забыли пароль?';
      }
    });

    $('#resetPasswordForm').addEventListener('submit', async e => {
      e.preventDefault();
      const pass = $('#resetPassword').value;
      const repeat = $('#resetPasswordRepeat').value;
      const status = $('#resetPasswordStatus');
      status.textContent = '';
      if (pass.length < 8) { status.textContent = 'Пароль должен содержать минимум 8 символов.'; return; }
      if (pass !== repeat) { status.textContent = 'Пароли не совпадают.'; return; }
      const btn = $('#resetPasswordSubmit');
      btn.disabled = true;
      btn.textContent = 'Сохраняем…';
      try {
        await updatePassword(pass);
        localStorage.removeItem(SESSION_KEY);
        state.session = null;
        history.replaceState(null, '', '/admin/');
        $('#recoveryScreen').classList.add('hidden');
        $('#loginScreen').classList.remove('hidden');
        $('#loginError').style.color = '#16704a';
        $('#loginError').textContent = 'Пароль изменён. Войдите с новым паролем.';
      } catch (err) {
        status.textContent = err.message || 'Не удалось изменить пароль.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить новый пароль';
      }
    });

    $('#changePasswordBtn').addEventListener('click', () => {
      $('#changePasswordForm').reset();
      $('#changePasswordStatus').textContent = '';
      $('#passwordModal').classList.remove('hidden');
    });
    $$('[data-close-password]').forEach(el => el.addEventListener('click', () => $('#passwordModal').classList.add('hidden')));
    $('#changePasswordForm').addEventListener('submit', async e => {
      e.preventDefault();
      const current = $('#currentPassword').value;
      const next = $('#newPassword').value;
      const repeat = $('#newPasswordRepeat').value;
      const status = $('#changePasswordStatus');
      status.textContent = '';
      if (next.length < 8) { status.textContent = 'Новый пароль должен содержать минимум 8 символов.'; return; }
      if (next !== repeat) { status.textContent = 'Новые пароли не совпадают.'; return; }
      const email = state.session?.user?.email || $('#adminEmail').textContent.trim();
      if (!email) { status.textContent = 'Не удалось определить e-mail администратора.'; return; }
      const btn = $('#changePasswordSubmit');
      btn.disabled = true;
      btn.textContent = 'Сохраняем…';
      try {
        await signIn(email, current);
        await updatePassword(next);
        $('#passwordModal').classList.add('hidden');
        toast('Пароль изменён');
      } catch (err) {
        status.textContent = err.message || 'Не удалось изменить пароль.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Изменить пароль';
      }
    });

    $('#logoutBtn').addEventListener('click', () => { localStorage.removeItem(SESSION_KEY); state.session = null; location.reload(); });
""",
'password handlers')

s = replace_once(s,
"""  async function init() {
    bind();
    if (!configured()) {
      $('#setupScreen').classList.remove('hidden');
      return;
    }
    restoreSession();
    if (!state.session) {
      $('#loginScreen').classList.remove('hidden');
      return;
    }
    await enterApp();
  }
""",
"""  async function init() {
    bind();
    if (!configured()) {
      $('#setupScreen').classList.remove('hidden');
      return;
    }
    if (adoptRecoverySession()) {
      $('#loginScreen').classList.add('hidden');
      $('#recoveryScreen').classList.remove('hidden');
      return;
    }
    restoreSession();
    if (!state.session) {
      $('#loginScreen').classList.remove('hidden');
      return;
    }
    try {
      if (state.session.refresh_token) await refreshSession();
      await enterApp();
    } catch (err) {
      console.error(err);
      localStorage.removeItem(SESSION_KEY);
      state.session = null;
      $('#app').classList.add('hidden');
      $('#loginScreen').classList.remove('hidden');
      $('#loginError').textContent = 'Сессия истекла. Войдите снова.';
    }
  }
""",
'init auth flow')

p.write_text(s, encoding='utf-8')


# --- admin/index.html ---
p = Path('admin/index.html')
s = p.read_text(encoding='utf-8')

s = replace_once(s,
"""    <button class="primary-btn" type="submit">Войти</button>
    <div id="loginError" class="form-error"></div>
    <a href="/" class="text-link">← Вернуться на сайт</a>
""",
"""    <button class="primary-btn" type="submit">Войти</button>
    <button id="forgotPasswordBtn" class="ghost-btn" type="button">Забыли пароль?</button>
    <div id="recoveryStatus" class="form-error"></div>
    <div id="loginError" class="form-error"></div>
    <a href="/" class="text-link">← Вернуться на сайт</a>
""",
'login recovery control')

s = replace_once(s,
"""</section>

<div id="app" class="app hidden">
""",
"""</section>

<section id="recoveryScreen" class="auth-screen hidden">
  <form id="resetPasswordForm" class="auth-card">
    <div class="brand-mark">N</div>
    <div class="eyebrow">НОКТЕНА · ADMIN</div>
    <h1>Новый пароль</h1>
    <p>Введите новый пароль для учётной записи администратора.</p>
    <label>Новый пароль<input id="resetPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Минимум 8 символов"></label>
    <label>Повторите пароль<input id="resetPasswordRepeat" type="password" autocomplete="new-password" minlength="8" required></label>
    <button id="resetPasswordSubmit" class="primary-btn" type="submit">Сохранить новый пароль</button>
    <div id="resetPasswordStatus" class="form-error"></div>
  </form>
</section>

<div id="app" class="app hidden">
""",
'recovery screen')

s = replace_once(s,
"""    <div class="sidebar-bottom"><div id="adminEmail" class="admin-email"></div><button id="logoutBtn" class="ghost-btn">Выйти</button></div>
""",
"""    <div class="sidebar-bottom"><div id="adminEmail" class="admin-email"></div><button id="changePasswordBtn" class="ghost-btn">Сменить пароль</button><button id="logoutBtn" class="ghost-btn">Выйти</button></div>
""",
'sidebar password button')

s = replace_once(s,
"""<div id="bulkModal" class="modal hidden" role="dialog" aria-modal="true">
""",
"""<div id="passwordModal" class="modal hidden" role="dialog" aria-modal="true">
  <div class="modal-backdrop" data-close-password></div>
  <div class="modal-card bulk-modal">
    <div class="modal-head"><div><div class="eyebrow">БЕЗОПАСНОСТЬ</div><h2>Сменить пароль</h2></div><button class="close-btn" type="button" data-close-password>×</button></div>
    <form id="changePasswordForm">
      <label>Текущий пароль<input id="currentPassword" type="password" autocomplete="current-password" required></label>
      <label>Новый пароль<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Минимум 8 символов"></label>
      <label>Повторите новый пароль<input id="newPasswordRepeat" type="password" autocomplete="new-password" minlength="8" required></label>
      <div id="changePasswordStatus" class="form-error"></div>
      <div class="modal-actions"><span></span><div class="right-actions"><button class="ghost-btn" type="button" data-close-password>Отмена</button><button id="changePasswordSubmit" class="primary-btn" type="submit">Изменить пароль</button></div></div>
    </form>
  </div>
</div>

<div id="bulkModal" class="modal hidden" role="dialog" aria-modal="true">
""",
'password modal')

s = s.replace('admin.js?v=20260919-colorphotos1', 'admin.js?v=20260919-authfix1')
s = s.replace('bootstrap-ui.js?v=20260919-1', 'bootstrap-ui.js?v=20260919-authfix1')
p.write_text(s, encoding='utf-8')


# --- admin/bootstrap-ui.js ---
# Primary bootstrap is intentionally removed after the first administrator exists.
p = Path('admin/bootstrap-ui.js')
p.write_text("""(() => {
  'use strict';
  function applyBrandLogo() {
    if (!document.getElementById('noktenaAdminBrandStyles')) {
      const style = document.createElement('style');
      style.id = 'noktenaAdminBrandStyles';
      style.textContent = `
        .brand-mark.noktena-full-logo{width:min(228px,100%);height:70px;border-radius:0;background:transparent;color:transparent;display:flex;align-items:center;justify-content:flex-start;overflow:visible}
        .brand-mark.noktena-full-logo img{display:block;width:auto;height:64px;max-width:100%;object-fit:contain}
        .admin-brand.noktena-sidebar-brand{min-height:74px;padding:8px 12px 12px!important;margin:0 0 8px;background:#fff;border:1px solid rgba(255,255,255,.18);border-radius:15px;justify-content:center!important;box-shadow:0 8px 22px rgba(0,0,0,.10)}
        .admin-brand.noktena-sidebar-brand .admin-sidebar-logo{display:block;width:100%;max-width:188px;height:auto;object-fit:contain}
        @media(max-width:1050px) and (min-width:761px){.admin-brand.noktena-sidebar-brand{padding:7px!important;min-height:58px;border-radius:12px}.admin-brand.noktena-sidebar-brand .admin-sidebar-logo{max-width:54px}}
        @media(max-width:760px){.admin-brand.noktena-sidebar-brand{margin:0 auto 0 0;min-height:44px;padding:4px 8px!important;border-radius:10px}.admin-brand.noktena-sidebar-brand .admin-sidebar-logo{width:auto;height:36px;max-width:142px}.brand-mark.noktena-full-logo{height:62px}.brand-mark.noktena-full-logo img{height:56px}}
      `;
      document.head.appendChild(style);
    }
    document.querySelectorAll('.brand-mark').forEach(mark => {
      if (mark.classList.contains('noktena-full-logo')) return;
      mark.classList.add('noktena-full-logo');
      mark.innerHTML = '<img src="../assets/logo-noktena-final.png?v=20260908-final2" alt="НОКТЕНА — федеральная онлайн-сеть">';
    });
    const adminBrand = document.querySelector('.admin-brand');
    if (adminBrand && !adminBrand.classList.contains('noktena-sidebar-brand')) {
      adminBrand.classList.add('noktena-sidebar-brand');
      adminBrand.innerHTML = '<img class="admin-sidebar-logo" src="../assets/logo-noktena-final.png?v=20260908-final2" alt="НОКТЕНА — федеральная онлайн-сеть">';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBrandLogo);
  else applyBrandLogo();
})();
""", encoding='utf-8')

print('Admin auth patch applied')
