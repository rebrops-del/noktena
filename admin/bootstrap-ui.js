(() => {
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
