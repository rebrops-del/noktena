(() => {
  'use strict';
  const cfg = window.NOKTENA_ADMIN_CONFIG || {};
  const errText = code => ({
    bootstrap_already_used: 'Первичный администратор уже создан. Используйте обычный вход.',
    invalid_bootstrap_code: 'Неверный код первичной настройки.',
    email_not_allowed: 'Для первичной настройки разрешён другой e-mail.',
    password_too_short: 'Пароль должен содержать минимум 8 символов.',
    missing_fields: 'Заполните e-mail, пароль и код первичной настройки.'
  }[code] || code || 'Не удалось создать администратора.');

  function applyBrandLogo() {
    if (!document.getElementById('noktenaAdminBrandStyles')) {
      const style = document.createElement('style');
      style.id = 'noktenaAdminBrandStyles';
      style.textContent = `
        .brand-mark.noktena-full-logo{
          width:min(228px,100%);height:70px;border-radius:0;background:transparent;color:transparent;
          display:flex;align-items:center;justify-content:flex-start;overflow:visible;
        }
        .brand-mark.noktena-full-logo img{
          display:block;width:auto;height:64px;max-width:100%;object-fit:contain;
        }
        .admin-brand.noktena-sidebar-brand{
          min-height:74px;padding:8px 12px 12px!important;margin:0 0 8px;background:#fff;border:1px solid rgba(255,255,255,.18);
          border-radius:15px;justify-content:center!important;box-shadow:0 8px 22px rgba(0,0,0,.10);
        }
        .admin-brand.noktena-sidebar-brand .admin-sidebar-logo{
          display:block;width:100%;max-width:188px;height:auto;object-fit:contain;
        }
        @media(max-width:1050px) and (min-width:761px){
          .admin-brand.noktena-sidebar-brand{padding:7px!important;min-height:58px;border-radius:12px;}
          .admin-brand.noktena-sidebar-brand .admin-sidebar-logo{max-width:54px;}
        }
        @media(max-width:760px){
          .admin-brand.noktena-sidebar-brand{margin:0 auto 0 0;min-height:44px;padding:4px 8px!important;border-radius:10px;}
          .admin-brand.noktena-sidebar-brand .admin-sidebar-logo{width:auto;height:36px;max-width:142px;}
          .brand-mark.noktena-full-logo{height:62px;}
          .brand-mark.noktena-full-logo img{height:56px;}
        }
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

  function init() {
    applyBrandLogo();
    const form = document.getElementById('loginForm');
    if (!form || document.getElementById('bootstrapToggle')) return;
    const back = form.querySelector('.text-link');

    const toggle = document.createElement('button');
    toggle.id = 'bootstrapToggle';
    toggle.type = 'button';
    toggle.className = 'secondary-btn';
    toggle.textContent = 'Первичная настройка администратора';

    const panel = document.createElement('div');
    panel.id = 'bootstrapPanel';
    panel.className = 'hidden';
    panel.style.cssText = 'display:grid;gap:12px;padding:15px;border:1px solid #dfe8e3;border-radius:14px;background:#f7faf8';
    panel.innerHTML = '<div style="font-size:12px;line-height:1.5;color:#66786f">Используется только один раз для создания первого владельца админ-панели.</div>' +
      '<label>E-mail<input id="bootstrapEmail" type="email" value="noktena@mail.ru" autocomplete="username" required></label>' +
      '<label>Пароль<input id="bootstrapPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Минимум 8 символов"></label>' +
      '<label>Код первичной настройки<input id="bootstrapCode" type="text" autocomplete="one-time-code" required placeholder="Код из сообщения"></label>' +
      '<button id="bootstrapSubmit" class="primary-btn" type="button">Создать администратора</button>' +
      '<div id="bootstrapStatus" class="form-error" style="min-height:0"></div>';

    form.insertBefore(toggle, back || null);
    form.insertBefore(panel, back || null);

    toggle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      toggle.textContent = panel.classList.contains('hidden') ? 'Первичная настройка администратора' : 'Скрыть первичную настройку';
    });

    document.getElementById('bootstrapSubmit').addEventListener('click', async () => {
      const button = document.getElementById('bootstrapSubmit');
      const status = document.getElementById('bootstrapStatus');
      const email = document.getElementById('bootstrapEmail').value.trim().toLowerCase();
      const password = document.getElementById('bootstrapPassword').value;
      const code = document.getElementById('bootstrapCode').value.trim();
      status.textContent = '';
      if (!email || !password || !code) { status.textContent = errText('missing_fields'); return; }
      button.disabled = true;
      button.textContent = 'Создаём…';
      try {
        const r = await fetch(String(cfg.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/bootstrap-admin', {
          method: 'POST',
          headers: {'Content-Type':'application/json', apikey: cfg.supabaseAnonKey},
          body: JSON.stringify({email, password, code})
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.ok) throw new Error(errText(data.error));
        status.style.color = '#16704a';
        status.textContent = 'Администратор создан. Выполняем вход…';
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
        setTimeout(() => form.requestSubmit(), 500);
      } catch (error) {
        status.style.color = '#c93845';
        status.textContent = error && error.message ? error.message : 'Не удалось создать администратора.';
      } finally {
        button.disabled = false;
        button.textContent = 'Создать администратора';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
