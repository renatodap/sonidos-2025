(() => {
  'use strict';
  const appURL = new URL('./', document.currentScript.src);
  const ua = navigator.userAgent;
  const ipad = /iPad/.test(ua) || (/Macintosh|MacIntel/.test(ua + ' ' + navigator.platform) && navigator.maxTouchPoints > 1);
  const ios = ipad || /iPhone|iPod/.test(ua);
  const android = /Android/.test(ua);
  const mac = !ios && /Mac/.test(navigator.platform + ua);
  const windows = /Windows/.test(ua);
  const embedded = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\/|Snapchat|TikTok|Bytedance|LinkedInApp|;\s*wv[;)]/i.test(ua);
  const browser = /EdgiOS|EdgA|Edg\//.test(ua) ? 'edge'
    : /SamsungBrowser/.test(ua) ? 'samsung'
      : /FxiOS|Firefox\//.test(ua) ? 'firefox'
        : /CriOS|Chrome\/|Chromium\//.test(ua) ? 'chrome'
          : /Safari\//.test(ua) ? 'safari' : 'unknown';
  const lang = /^pt\b/i.test(navigator.language || '') ? 'pt' : 'en';
  const pt = lang === 'pt';
  const label = (en, br) => pt ? br : en;
  const displayMode = matchMedia('(display-mode: standalone)');
  const standalone = () => displayMode.matches || navigator.standalone === true;
  let deferredPrompt = null;
  let busy = false;
  let installed = false;
  let dialog;
  let nativeButton;
  let lastTrigger;
  let triggers = [];

  // Capture the real browser event before the page UI is initialized.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    if (nativeButton) nativeButton.hidden = false;
    updateButtons();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    if (dialog && dialog.open) dialog.close();
    updateButtons();
  });
  if (displayMode.addEventListener) displayMode.addEventListener('change', updateButtons);

  function updateButtons() {
    for (const button of triggers) {
      const landing = button.dataset.sonidosInstall === 'landing';
      const ready = standalone() || installed;
      button.hidden = !landing && ready;
      button.textContent = ready ? label('Open Sonidos', 'Abrir Sonidos')
        : landing ? label('Install Sonidos app', 'Instalar app Sonidos') : label('Install', 'Instalar');
      button.disabled = busy;
    }
    if (nativeButton) {
      nativeButton.hidden = !deferredPrompt || installed || standalone();
      nativeButton.disabled = busy;
    }
  }

  function guide() {
    const share = ['share', label('Tap Share', 'Toque em Compartilhar'),
      label('Look for the square with an arrow pointing up in your browser.', 'Procure o quadrado com a seta para cima no navegador.')];
    const home = ['home', label('Add to Home Screen', 'Adicionar à Tela de Início'),
      label('Scroll down in the Share menu to find it.', 'Role o menu Compartilhar para encontrar essa opção.')];
    const add = ['check', label('Tap Add', 'Toque em Adicionar'),
      label('Keep “Open as Web App” on, if shown. Sonidos will appear on your Home Screen.', 'Mantenha “Abrir como App da Web” ativado, se aparecer. Sonidos ficará na Tela de Início.')];
    if (embedded) return {
      id: ios ? 'embedded-ios' : 'embedded-android',
      device: label('Inside another app', 'Dentro de outro app'),
      steps: [
        ['copy', label('Copy the Sonidos link', 'Copie o link do Sonidos'), label('Use Copy link below.', 'Use Copiar link abaixo.')],
        ['browser', ios ? label('Open Safari', 'Abra o Safari') : label('Open Chrome', 'Abra o Chrome'),
          label('Paste the link in the address bar.', 'Cole o link na barra de endereço.')],
        ['download', label('Tap Install again', 'Toque em Instalar novamente'),
          label('We’ll show the steps for that browser.', 'Vamos mostrar as instruções desse navegador.')]
      ], openCopy: true
    };
    if (ios) {
      if (browser === 'safari') share[2] = ipad
        ? label('Tap Share, then More if needed.', 'Toque em Compartilhar e, se necessário, em Mais.')
        : label('Tap the Share icon. In the compact layout, open the page menu first.', 'Toque no ícone Compartilhar. No layout compacto, abra o menu da página primeiro.');
      if (browser === 'chrome' || browser === 'firefox') share[2] =
        label('Use the Share button beside the address bar.', 'Use o botão Compartilhar ao lado da barra de endereço.');
      const known = ['safari', 'chrome', 'edge', 'firefox'].includes(browser);
      return {id: known ? 'ios-' + browser : 'ios-generic',
        device: (ipad ? 'iPad' : 'iPhone') + (ipad && browser === 'safari' ? '' : ' · ' + ({safari:'Safari',chrome:'Chrome',edge:'Edge',firefox:'Firefox'}[browser] || label('Browser','Navegador'))),
        steps: [share, home, add]};
    }
    if (android) {
      if (browser === 'samsung') return {id:'android-samsung',device:'Android · Samsung Internet',steps:[
        ['menu', label('Open the menu ☰', 'Abra o menu ☰'), label('In Samsung Internet.', 'No Samsung Internet.')],
        ['home', label('Add page to → Home screen', 'Adicionar página a → Tela inicial'), ''],
        ['check', label('Confirm Add', 'Confirme em Adicionar'), label('Sonidos will appear on your Home Screen.', 'Sonidos ficará na sua Tela inicial.')]
      ]};
      if (browser === 'firefox') return {id:'android-firefox',device:'Android · Firefox',steps:[
        ['dots', label('Open the menu ⋮', 'Abra o menu ⋮'), ''],
        ['home', label('Add app to Home screen', 'Adicionar app à tela inicial'),
          label('It may say “Add to Home screen”.', 'Pode aparecer como “Adicionar à tela inicial”.')],
        ['check', label('Confirm Add', 'Confirme em Adicionar'), '']
      ]};
      if (browser === 'chrome' || browser === 'edge') return {id:'android-chrome',device:'Android · ' + (browser === 'edge' ? 'Edge' : 'Chrome'),steps:[
        ['dots', label('Open the browser menu', 'Abra o menu do navegador'), label('Look for ⋮ or ….', 'Procure ⋮ ou ….')],
        ['download', label('Install app', 'Instalar app'),
          label('May appear as “Install and create shortcut” or “Add to Home screen”.', 'Pode aparecer como “Instalar e criar atalho” ou “Adicionar à tela inicial”.')],
        ['check', label('Confirm Install', 'Confirme em Instalar'), label('If it already says “Open”, Sonidos is installed.', 'Se aparecer “Abrir”, o Sonidos já está instalado.')]
      ]};
    }
    if (mac && browser === 'safari') return {id:'desktop-safari',device:'Mac · Safari',steps:[
      ['menu', label('Open File', 'Abra Arquivo'), label('In the menu bar at the top of your Mac.', 'Na barra de menus do Mac.')],
      ['home', label('Choose Add to Dock', 'Escolha Adicionar ao Dock'), label('Available on macOS Sonoma 14 or later.', 'Disponível no macOS Sonoma 14 ou posterior.')],
      ['check', label('Click Add', 'Clique em Adicionar'), label('Open Sonidos from your Dock.', 'Abra o Sonidos pelo Dock.')]
    ]};
    if (!ios && !android && browser === 'chrome') return {id:'desktop-chrome',device:'Chrome',steps:[
      ['dots', label('Open the menu ⋮', 'Abra o menu ⋮'), ''],
      ['download', label('Cast, save, and share', 'Transmitir, salvar e compartilhar'),
        label('Choose “Install page as app”. You can also use the install icon in the address bar.', 'Escolha “Instalar página como app”. Você também pode usar o ícone de instalação na barra de endereço.')],
      ['check', label('Confirm Install', 'Confirme em Instalar'), '']
    ]};
    if (!ios && !android && browser === 'edge') return {id:'desktop-edge',device:'Microsoft Edge',steps:[
      ['dots', label('Open the menu …', 'Abra o menu …'), ''],
      ['download', label('More tools → Apps', 'Mais ferramentas → Aplicativos'),
        label('Choose “Install this site as an app”.', 'Escolha “Instalar este site como aplicativo”.')],
      ['check', label('Confirm Install', 'Confirme em Instalar'), '']
    ]};
    if (windows && browser === 'firefox') return {id:'desktop-firefox',device:'Windows · Firefox',steps:[
      ['browser', label('Find the web apps button', 'Encontre o botão de apps da web'),
        label('At the right of the address bar in current Firefox for Windows.', 'À direita da barra de endereço nas versões atuais do Firefox para Windows.')],
      ['home', label('Add Sonidos', 'Adicione o Sonidos'), label('Follow Firefox’s prompt.', 'Siga a confirmação do Firefox.')],
      ['check', label('No web apps button?', 'O botão não aparece?'),
        label('Update Firefox, or open this link in Chrome or Edge.', 'Atualize o Firefox ou abra este link no Chrome ou Edge.')]
    ]};
    return {id:'unsupported',device:label('Open in a supported browser','Abra em um navegador compatível'),openCopy:true,steps:[
      ['copy', label('Copy the Sonidos link', 'Copie o link do Sonidos'), label('Use Copy link below.', 'Use Copiar link abaixo.')],
      ['browser', mac ? label('Open Safari or Chrome', 'Abra o Safari ou Chrome') : label('Open Chrome or Edge', 'Abra o Chrome ou Edge'),
        label('Paste the link in the address bar.', 'Cole o link na barra de endereço.')],
      ['download', label('Tap Install again', 'Toque em Instalar novamente'), '']
    ]};
  }

  function icon(name) {
    const paths = {
      share:'M8 10H5v11h14V10h-3M12 16V2m-4 4 4-4 4 4',
      home:'M3 3h18v18H3zM12 7v10M7 12h10',
      check:'M5 12l4 4L19 6',
      download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
      copy:'M8 8h12v13H8zM16 8V3H3v13h5',
      browser:'M3 4h18v17H3zM3 9h18M6 6.5h1m2 0h1',
      menu:'M4 6h16M4 12h16M4 18h16',
      dots:'M12 5h.01M12 12h.01M12 19h.01',
      close:'m6 6 12 12M6 18 18 6'
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width', name === 'dots' ? '3.5' : '1.7');
    svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
    const path = document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name] || paths.download);svg.append(path);
    return svg;
  }
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function buildDialog() {
    dialog = element('dialog','si-dialog');dialog.id = 'sonidos-install-dialog';dialog.lang = lang;
    dialog.setAttribute('aria-labelledby','sonidos-install-title');
    const header = element('div','si-header');
    const mark = element('img','si-logo');mark.src = new URL('icons/apple-touch-icon.png',appURL).href;mark.alt = '';mark.width = 48;mark.height = 48;
    const titles = element('div');
    const device = element('p','si-device');device.id = 'sonidos-install-device';
    const title = element('h2','si-title',label('Install Sonidos','Instalar Sonidos'));title.id = 'sonidos-install-title';
    titles.append(device,title);
    const close = element('button','si-close');close.type = 'button';close.setAttribute('aria-label',label('Close installation guide','Fechar instruções de instalação'));close.append(icon('close'));close.addEventListener('click',()=>dialog.close());
    header.append(mark,titles,close);
    const steps = element('ol','si-steps');steps.id = 'sonidos-install-steps';
    const status = element('p','si-status');status.id = 'sonidos-install-status';status.setAttribute('role','status');status.hidden = true;
    nativeButton = element('button','si-primary',label('Install now','Instalar agora'));nativeButton.id = 'sonidos-install-native';nativeButton.type = 'button';nativeButton.hidden = true;nativeButton.addEventListener('click',tryInstall);
    const fallback = element('details','si-alternative');fallback.id = 'sonidos-install-alternative';
    fallback.append(element('summary','',label('Can’t find this option?','Não encontrou essa opção?')));
    const hint = element('p','',ios
      ? label('If this opened inside another app, copy the link and open it in Safari.', 'Se este link abriu dentro de outro app, copie e abra no Safari.')
      : label('If this opened inside another app, copy the link and open it in Chrome or Edge.', 'Se este link abriu dentro de outro app, copie e abra no Chrome ou Edge.'));
    const copyRow = element('div','si-copy-row');
    const url = element('input');url.type = 'text';url.value = new URL('install/',appURL).href;url.readOnly = true;url.setAttribute('aria-label',label('Sonidos installation link','Link de instalação do Sonidos'));
    const copy = element('button','si-copy',label('Copy link','Copiar link'));copy.type = 'button';copy.id = 'sonidos-install-copy';
    copy.addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(url.value); copy.textContent = label('Copied','Copiado'); }
      catch { url.focus();url.select();status.textContent = label('Copy the selected link, then open it in your browser.','Copie o link selecionado e abra no navegador.');status.hidden = false; }
    });
    copyRow.append(url,copy);fallback.append(hint,copyRow);dialog.append(header,steps,status,nativeButton,fallback);
    dialog.addEventListener('click',event=>{
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('keydown',event=>{
      if(event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
        .filter(node=>{
          const closedDetails = node.closest('details:not([open])');
          if(closedDetails && !(node.tagName === 'SUMMARY' && node.parentElement === closedDetails)) return false;
          return node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' &&
            (!node.checkVisibility || node.checkVisibility());
        });
      if(!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length-1];
      if(event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))){
        event.preventDefault();last.focus();
      } else if(!event.shiftKey && document.activeElement === last){
        event.preventDefault();first.focus();
      }
    });
    dialog.addEventListener('close',()=>{document.documentElement.classList.remove('si-modal-open');if(lastTrigger && !lastTrigger.hidden) lastTrigger.focus();});
    document.body.append(dialog);
  }
  function showGuide(message) {
    const selected = guide();dialog.dataset.guide = selected.id;
    dialog.querySelector('#sonidos-install-device').textContent = selected.device;
    const list = dialog.querySelector('#sonidos-install-steps');list.replaceChildren();
    selected.steps.forEach((step,index)=>{
      const row = element('li','si-step');
      const visual = element('div','si-visual');visual.setAttribute('aria-hidden','true');visual.append(icon(step[0]),element('span','si-number',String(index+1)));
      const text = element('div','si-step-copy');text.append(element('h3','',step[1]));
      if(step[2]) text.append(element('p','',step[2]));
      row.append(visual,text);list.append(row);
    });
    const status = dialog.querySelector('#sonidos-install-status');status.textContent = message || '';status.hidden = !message;
    dialog.querySelector('#sonidos-install-alternative').open = !!selected.openCopy;
    updateButtons();
    if(!dialog.open){dialog.showModal();document.documentElement.classList.add('si-modal-open');}
  }
  async function tryInstall() {
    if(busy) return;
    if(standalone() || installed){location.assign(appURL.href);return;}
    if(!deferredPrompt){showGuide();return;}
    const prompt = deferredPrompt;deferredPrompt = null;busy = true;updateButtons();
    try {
      // prompt() must run synchronously from the user's tap.
      await prompt.prompt();
      await prompt.userChoice;
      if(dialog.open) dialog.close();
    } catch {
      showGuide(label('The install prompt could not open. Follow these browser steps.','Não foi possível abrir a instalação. Siga as instruções do navegador.'));
    } finally {busy = false;updateButtons();}
  }
  function init() {
    triggers = Array.from(document.querySelectorAll('[data-sonidos-install]'));
    if(!triggers.length) return;
    buildDialog();
    for(const button of triggers) button.addEventListener('click',()=>{lastTrigger = button;tryInstall();});
    updateButtons();
    if('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register(new URL('sw.js',appURL),{scope:appURL.pathname}).catch(()=>{});
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
