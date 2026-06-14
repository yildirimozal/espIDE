// pinout.js — Secili kartin pin diyagramini cizer.
// Pinler tiklanabilir; her pinin durumu (HIGH/LOW) gorsel olarak ayarlanabilir
// -> ileride gercek pin durumlarini canli gostermek icin hazir.

let pinEls = new Map(); // gpio -> element
let clickCb = null;

function pinRow(pin, side) {
  const row = document.createElement('div');
  row.className = 'pin-row ' + side + ' type-' + pin.type;
  if (pin.gpio !== null && pin.type === 'io') row.classList.add('clickable');

  const pad = document.createElement('span');
  pad.className = 'pin-pad';
  pad.textContent = pin.gpio !== null ? pin.gpio : '';

  const label = document.createElement('span');
  label.className = 'pin-label';
  label.textContent = pin.label;

  const fns = document.createElement('span');
  fns.className = 'pin-fns';
  fns.textContent = pin.fns.join(' · ');

  // Soldaki pinlerde pad disa baksin (sira: label - pad), sagda (pad - label)
  if (side === 'left') {
    row.appendChild(fns);
    row.appendChild(label);
    row.appendChild(pad);
  } else {
    row.appendChild(pad);
    row.appendChild(label);
    row.appendChild(fns);
  }

  if (pin.gpio !== null) {
    pinEls.set(pin.gpio, row);
    if (pin.type === 'io') {
      row.addEventListener('click', () => {
        const now = row.classList.toggle('active');
        if (clickCb) clickCb(pin.gpio, now, pin);
      });
    }
  }
  return row;
}

export function renderPinout(container, board, onPinClick) {
  pinEls = new Map();
  clickCb = onPinClick || null;
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'board';

  const colL = document.createElement('div');
  colL.className = 'pin-col left';
  board.left.forEach((p) => colL.appendChild(pinRow(p, 'left')));

  const body = document.createElement('div');
  body.className = 'board-body';
  body.innerHTML = `<div class="chip-name">${board.name}</div>
    <div class="usb">▢ USB</div>
    <div class="led-dot" id="board-led" title="Dahili LED (GPIO ${board.led})"></div>
    <div class="led-cap">LED: GPIO${board.led}</div>`;

  const colR = document.createElement('div');
  colR.className = 'pin-col right';
  board.right.forEach((p) => colR.appendChild(pinRow(p, 'right')));

  wrap.appendChild(colL);
  wrap.appendChild(body);
  wrap.appendChild(colR);
  container.appendChild(wrap);
}

// Simulasyon/canli gosterim icin: pinin durumunu ayarla (true=HIGH)
export function setPinState(gpio, high) {
  const el = pinEls.get(gpio);
  if (el) el.classList.toggle('active', !!high);
}

export function setLed(on) {
  const led = document.getElementById('board-led');
  if (led) led.classList.toggle('on', !!on);
}

// Tum pin durumlarini sifirla
export function clearPins() {
  pinEls.forEach((el) => el.classList.remove('active'));
}
