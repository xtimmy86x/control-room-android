const root = document.querySelector('#app');

if (root) {
  root.innerHTML = `
    <section data-boot-screen style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#080c12;color:#dce5ef;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center">
      <div>
        <div style="width:46px;height:46px;margin:0 auto 14px;display:grid;place-items:center;border:1px solid #31516e;border-radius:12px;background:#13202d;color:#8fc9fb;font-size:12px;font-weight:800">CR</div>
        <strong style="display:block;font-size:16px">HA Control Room</strong>
        <span data-boot-message style="display:block;margin-top:6px;color:#8390a0;font-size:10px">Avvio app…</span>
      </div>
    </section>`;

  setTimeout(() => {
    const bootScreen = document.querySelector('[data-boot-screen]');
    const message = document.querySelector('[data-boot-message]');
    if (bootScreen && message) {
      message.textContent = 'Errore durante l’avvio dell’app. Chiudi e riapri l’app oppure reinstalla la build più recente.';
    }
  }, 5000);
}
