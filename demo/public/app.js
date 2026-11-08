(function initDemo() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const stamp = document.querySelector('[data-vrt="timestamp"]');
  const requestId = document.querySelector('[data-vrt="random-id"]');
  const avatar = document.querySelector('[data-vrt="avatar"]');
  const ad = document.querySelector('[data-vrt="ad-copy"]');
  const ready = document.querySelector('[data-testid="app-ready"]');

  function randomChar() {
    const index = Math.floor(Math.random() * alphabet.length);
    return alphabet.charAt(index);
  }

  function renderStamp() {
    if (stamp) {
      stamp.textContent = new Date().toISOString();
    }
  }

  renderStamp();
  window.setInterval(renderStamp, 1000);

  if (requestId) {
    let value = 'req_';
    for (let index = 0; index < 8; index += 1) {
      value += randomChar();
    }
    requestId.textContent = value;
  }

  if (avatar) {
    const hue = Math.floor(Math.random() * 360);
    avatar.style.background = 'hsl(' + hue + ' 65% 46%)';
    avatar.textContent = randomChar().toUpperCase();
  }

  if (ad) {
    const ads = [
      'Harbor Summit · 12 seats left',
      'Switch to annual and save 20%',
      'New cohort report is ready',
      'Invite your data team',
    ];
    const choice = ads[Math.floor(Math.random() * ads.length)] || ads[0];
    ad.textContent = choice;
  }

  if (ready) {
    ready.setAttribute('data-ready', 'true');
  }
})();
