// Visor de PDF con pdf.js: páginas perezosas, zoom con pellizco, ajuste al ancho
// y conservación de la posición al recompilar.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AppLauncher } from '@capacitor/app-launcher';

pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdf.worker.min.mjs';

export function createPdfViewer(root) {
  root.classList.add('pdfv');
  root.innerHTML = `
    <div class="pdfv-scroll" tabindex="0"><div class="pdfv-pages"></div>
      <div class="pdfv-empty">Compila para ver el PDF aquí</div></div>
    <button class="pdfv-back" hidden>← Volver</button>
    <div class="pdfv-bar">
      <button class="icon-btn" data-act="out" title="Alejar" aria-label="Alejar">−</button>
      <button class="pdfv-zoom" data-act="fit" title="Ajustar al ancho">Ajustar</button>
      <button class="icon-btn" data-act="in" title="Acercar" aria-label="Acercar">+</button>
      <span class="pdfv-page">–</span>
    </div>`;
  const scroller = root.querySelector('.pdfv-scroll');
  const pagesEl = root.querySelector('.pdfv-pages');
  const emptyEl = root.querySelector('.pdfv-empty');
  const pageLabel = root.querySelector('.pdfv-page');
  const zoomLabel = root.querySelector('.pdfv-zoom');
  const backBtn = root.querySelector('.pdfv-back');

  let doc = null;
  let pages = []; // {el, canvas, page, vp1, rendered, task}
  let fit = true;
  let scale = 1;
  let loadToken = 0;
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);
  const destroyDoc = (d) => { try { (d.loadingTask || d).destroy(); } catch { /* ya destruido */ } };

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const p = pages[+en.target.dataset.index];
      if (!p) continue;
      p.visible = en.isIntersecting;
      if (en.isIntersecting) renderPage(p);
    }
    updatePageLabel();
  }, { root: scroller, rootMargin: '600px 0px' });

  function fitScale() {
    if (!pages.length) return 1;
    const w = scroller.clientWidth - 24;
    return Math.max(0.2, w / pages[0].vp1.width);
  }

  function layout() {
    if (fit) scale = fitScale();
    zoomLabel.textContent = fit ? 'Ajustar' : Math.round(scale * 100) + '%';
    for (const p of pages) {
      const vp = p.page.getViewport({ scale });
      p.el.style.width = vp.width + 'px';
      p.el.style.height = vp.height + 'px';
      if (p.renderedScale !== scale) p.rendered = false;
      if (p.visible) renderPage(p);
    }
  }

  async function renderPage(p) {
    if (!p.links) addLinks(p);
    if (p.rendered || p.rendering) return;
    p.rendering = true;
    const s = scale;
    const vp = p.page.getViewport({ scale: s * dpr() });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    try {
      p.task = p.page.render({ canvas, viewport: vp });
      await p.task.promise;
      if (s === scale) {
        p.el.querySelector('canvas')?.remove();
        p.el.appendChild(canvas);
        p.rendered = true;
        p.renderedScale = s;
      }
    } catch (e) {
      if (e && e.name !== 'RenderingCancelledException') console.warn(e);
    } finally {
      p.rendering = false;
      if (s !== scale && p.visible) renderPage(p);
    }
  }

  // ---------- Enlaces del PDF (hyperref: \ref, \cite, índice, \url) ----------
  // Se superponen como zonas tocables en porcentajes de la página, así sirven a cualquier zoom.
  async function addLinks(p) {
    p.links = true;
    try { await addLinksInner(p); } catch (err) { console.warn('enlaces del PDF', err); }
  }
  async function addLinksInner(p) {
    let annots = [];
    try { annots = await p.page.getAnnotations({ intent: 'display' }); } catch { return; }
    const owner = doc;
    const layer = document.createElement('div');
    layer.className = 'pdfv-links';
    for (const a of annots) {
      if (a.subtype !== 'Link' || !a.rect || (!a.dest && !a.url && !a.unsafeUrl)) continue;
      const [x1, y1] = p.vp1.convertToViewportPoint(a.rect[0], a.rect[1]);
      const [x2, y2] = p.vp1.convertToViewportPoint(a.rect[2], a.rect[3]);
      const left = Math.min(x1, x2), top = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      if (w < 1 || h < 1) continue;
      const link = document.createElement('a');
      link.draggable = false;
      link.className = 'pdfv-link' + (a.dest ? '' : ' ext');
      const url = a.url || a.unsafeUrl;
      if (url) { link.href = url; link.title = url; } else link.href = '#';
      Object.assign(link.style, { left: (left / p.vp1.width * 100) + '%', top: (top / p.vp1.height * 100) + '%', width: (w / p.vp1.width * 100) + '%', height: (h / p.vp1.height * 100) + '%' });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) return; // Ctrl + clic es para ir al código
        if (a.dest) goToDest(a.dest);
        else openExternal(url);
      });
      layer.appendChild(link);
    }
    if (owner === doc && layer.childElementCount) p.el.appendChild(layer);
  }

  async function goToDest(dest) {
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(explicit)) return;
      const ref = explicit[0];
      const idx = typeof ref === 'number' ? ref : await doc.getPageIndex(ref);
      const p = pages[idx];
      if (!p) return;
      const kind = explicit[1] && explicit[1].name;
      let top = null, left = null;
      if (kind === 'XYZ') { left = explicit[2]; top = explicit[3]; }
      else if (kind === 'FitH' || kind === 'FitBH') top = explicit[2];
      else if (kind === 'FitR') { left = explicit[2]; top = explicit[5]; }
      const k = p.el.clientWidth / p.vp1.width;
      const yPdf = top == null ? 0 : p.vp1.convertToViewportPoint(left || 0, top)[1];
      // recordar dónde estabas para «← Volver»
      backStack.push({ top: scroller.scrollTop, left: scroller.scrollLeft });
      if (backStack.length > 20) backStack.shift();
      showBack();
      stopGlide();
      scroller.scrollTo({ top: Math.max(0, p.el.offsetTop + yPdf * k - 12), behavior: 'smooth' });
      // marca breve del destino
      const mark = document.createElement('div');
      mark.className = 'pdfv-dest';
      mark.style.top = Math.max(0, yPdf * k - 2) + 'px';
      p.el.appendChild(mark);
      setTimeout(() => mark.classList.add('fade'), 900);
      setTimeout(() => mark.remove(), 1900);
    } catch (e) { console.warn('destino del enlace', e); }
  }

  function openExternal(url) {
    if (!url) return;
    AppLauncher.openUrl({ url }).then((r) => { if (r && r.completed === false) window.open(url, '_blank'); }).catch(() => window.open(url, '_blank'));
  }

  const backStack = [];
  let backTimer = 0;
  function showBack() {
    backBtn.hidden = !backStack.length;
    clearTimeout(backTimer);
    if (backStack.length) backTimer = setTimeout(() => { backBtn.hidden = true; backStack.length = 0; }, 15000);
  }
  backBtn.addEventListener('click', () => {
    const pos = backStack.pop();
    if (pos) { stopGlide(); scroller.scrollTo({ top: pos.top, left: pos.left, behavior: 'smooth' }); }
    showBack();
  });

  function currentPage() {
    const mid = scroller.scrollTop + scroller.clientHeight / 3;
    let idx = 0;
    for (let i = 0; i < pages.length; i++) if (pages[i].el.offsetTop <= mid) idx = i;
    return idx;
  }

  function updatePageLabel() {
    pageLabel.textContent = pages.length ? `${currentPage() + 1} / ${pages.length}` : '–';
  }

  async function load(bytes) {
    const token = ++loadToken;
    const rel = scroller.scrollHeight > 0 ? scroller.scrollTop / scroller.scrollHeight : 0;
    const left = scroller.scrollLeft;
    const task = pdfjsLib.getDocument({
      data: bytes.slice(),
      cMapUrl: './assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: './assets/standard_fonts/',
      isEvalSupported: false,
    });
    const newDoc = await task.promise;
    if (token !== loadToken) { destroyDoc(newDoc); return; }
    const newPages = [];
    for (let i = 1; i <= newDoc.numPages; i++) {
      const page = await newDoc.getPage(i);
      const el = document.createElement('div');
      el.className = 'pdfv-page-el';
      el.dataset.index = String(i - 1);
      newPages.push({ el, page, vp1: page.getViewport({ scale: 1 }), rendered: false, visible: false });
    }
    if (token !== loadToken) { destroyDoc(newDoc); return; }
    io.disconnect();
    const old = doc;
    doc = newDoc;
    pages = newPages;
    pagesEl.replaceChildren(...pages.map((p) => p.el));
    emptyEl.hidden = true;
    backStack.length = 0; showBack();
    layout();
    pages.forEach((p) => io.observe(p.el));
    requestAnimationFrame(() => {
      scroller.scrollTop = rel * scroller.scrollHeight;
      scroller.scrollLeft = left;
      updatePageLabel();
    });
    if (old) setTimeout(() => destroyDoc(old), 0);
  }

  function setZoom(newScale, anchorY = scroller.clientHeight / 2) {
    if (!pages.length) return;
    const ratio = (scroller.scrollTop + anchorY) / Math.max(1, scroller.scrollHeight);
    fit = false;
    scale = Math.max(0.25, Math.min(newScale, 5));
    layout();
    scroller.scrollTop = ratio * scroller.scrollHeight - anchorY;
  }

  root.querySelector('.pdfv-bar').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'in') setZoom(scale * 1.2);
    if (act === 'out') setZoom(scale / 1.2);
    if (act === 'fit') { fit = true; layout(); }
  });
  scroller.addEventListener('scroll', updatePageLabel, { passive: true });

  // Zoom con pellizco (dos dedos) y doble toque.
  let pinch = null;
  let lastTap = 0;
  // Mantener presionado (dedo) = ir al código. Vibra al cumplirse el tiempo y salta al soltar,
  // cancelando ese último toque para que no caiga sobre el código que aparece debajo.
  let hold = null;
  const cancelHold = () => { if (hold) clearTimeout(hold.timer); hold = null; };
  scroller.addEventListener('touchstart', (e) => {
    cancelHold();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      hold = { x: t.clientX, y: t.clientY, fired: false };
      hold.timer = setTimeout(() => { if (hold) { hold.fired = true; if (navigator.vibrate) navigator.vibrate(12); } }, 550);
    }
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (hold && !hold.fired && e.touches[0] && Math.hypot(e.touches[0].clientX - hold.x, e.touches[0].clientY - hold.y) > 10) cancelHold();
  }, { passive: true });
  scroller.addEventListener('touchend', (e) => {
    const h = hold;
    cancelHold();
    if (h && h.fired) {
      e.preventDefault(); // sin el «clic» que el navegador crea al levantar el dedo
      requestSource(h.x, h.y);
    }
  }, { passive: false });
  scroller.addEventListener('touchcancel', cancelHold);
  scroller.addEventListener('contextmenu', (e) => e.preventDefault());
  scroller.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: scale, y: (a.clientY + b.clientY) / 2 - scroller.getBoundingClientRect().top };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (fit) setZoom(scale * 1.8, e.touches[0].clientY - scroller.getBoundingClientRect().top);
        else { fit = true; layout(); }
        lastTap = 0;
      } else lastTap = now;
    }
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pagesEl.style.transformOrigin = `50% ${scroller.scrollTop + pinch.y}px`;
    pagesEl.style.transform = `scale(${d / pinch.d})`;
    pinch.k = d / pinch.d;
  }, { passive: false });
  scroller.addEventListener('touchend', (e) => {
    if (pinch && e.touches.length < 2) {
      pagesEl.style.transform = '';
      if (pinch.k) setZoom(pinch.s * pinch.k, pinch.y);
      pinch = null;
    }
  });
  // Ctrl + rueda en tablets con teclado/mouse.
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientY - scroller.getBoundingClientRect().top);
  }, { passive: false });

  // Mouse (tablet con mouse o mini PC): arrastrar con el clic de la ruedita —o con el clic
  // izquierdo— mueve el PDF como un dedo, con inercia al soltar. Doble clic = zoom.
  let drag = null;
  let glide = 0;
  let lastPointer = '';
  const stopGlide = () => { if (glide) cancelAnimationFrame(glide); glide = 0; };
  scroller.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    if (e.pointerType !== 'mouse' || (e.button !== 0 && e.button !== 1)) return;
    if (e.target.closest('.pdfv-bar, button, input, a:not(.pdfv-link)')) return;
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) { // Ctrl + clic: ir al código
      e.preventDefault();
      requestSource(e.clientX, e.clientY);
      return;
    }
    stopGlide();
    if (e.button === 1) e.preventDefault(); // sin el «autodesplazamiento» del navegador
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false, vx: 0, vy: 0, t: performance.now(), px: e.clientX, py: e.clientY };
  });
  scroller.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return; // un clic simple sigue siendo un clic
      drag.moved = true;
      scroller.setPointerCapture(e.pointerId);
      scroller.classList.add('grabbing');
    }
    e.preventDefault();
    scroller.scrollLeft = drag.left - dx;
    scroller.scrollTop = drag.top - dy;
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.vx = 0.8 * ((drag.px - e.clientX) / dt) + 0.2 * drag.vx;
    drag.vy = 0.8 * ((drag.py - e.clientY) / dt) + 0.2 * drag.vy;
    drag.t = now; drag.px = e.clientX; drag.py = e.clientY;
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    scroller.classList.remove('grabbing');
    if (!d.moved || performance.now() - d.t > 80) return; // se detuvo antes de soltar: sin inercia
    let vx = d.vx * 16, vy = d.vy * 16; // px por cuadro
    const step = () => {
      vx *= 0.94; vy *= 0.94;
      if (Math.abs(vx) < 0.4 && Math.abs(vy) < 0.4) { glide = 0; return; }
      scroller.scrollLeft += vx; scroller.scrollTop += vy;
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  scroller.addEventListener('pointerup', endDrag);
  scroller.addEventListener('pointercancel', endDrag);
  scroller.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
  scroller.addEventListener('wheel', stopGlide, { passive: true });
  scroller.addEventListener('dblclick', (e) => {
    if (lastPointer !== 'mouse' || e.target.closest('.pdfv-bar')) return; // el dedo ya tiene su doble toque
    const y = e.clientY - scroller.getBoundingClientRect().top;
    if (fit) setZoom(scale * 1.8, y); else { fit = true; layout(); }
  });

  // ---------- SyncTeX: puntos del PDF y resaltado ----------
  let sourceHandler = null;
  function pointAt(clientX, clientY) {
    const elx = document.elementFromPoint(clientX, clientY)?.closest('.pdfv-page-el');
    if (!elx) return null;
    const r = elx.getBoundingClientRect();
    const k = r.width / pages[+elx.dataset.index].vp1.width; // px por punto PDF
    return { page: +elx.dataset.index + 1, x: (clientX - r.left) / k, y: (clientY - r.top) / k };
  }
  function requestSource(clientX, clientY) {
    const pt = pointAt(clientX, clientY);
    if (pt && sourceHandler) sourceHandler(pt);
  }
  function highlight(rect) {
    const p = pages[rect.page - 1];
    if (!p) return false;
    const k = p.el.clientWidth / p.vp1.width;
    p.el.querySelectorAll('.pdfv-hl').forEach((n) => n.remove());
    const pad = 3;
    const hl = document.createElement('div');
    hl.className = 'pdfv-hl';
    Object.assign(hl.style, { left: (rect.x * k - pad) + 'px', top: (rect.y * k - pad) + 'px', width: (rect.w * k + 2 * pad) + 'px', height: (rect.h * k + 2 * pad) + 'px' });
    p.el.appendChild(hl);
    // centrar el resaltado en pantalla (vertical y, si hay zoom, horizontal)
    const top = p.el.offsetTop + rect.y * k - scroller.clientHeight / 3;
    const left = p.el.offsetLeft + rect.x * k - 24;
    stopGlide();
    scroller.scrollTo({ top: Math.max(0, top), left: scroller.scrollWidth > scroller.clientWidth ? Math.max(0, left) : scroller.scrollLeft, behavior: 'smooth' });
    setTimeout(() => hl.classList.add('fade'), 1600);
    setTimeout(() => hl.remove(), 2600);
    return true;
  }

  new ResizeObserver(() => { if (fit && pages.length) layout(); }).observe(scroller);

  return {
    load,
    clear() { io.disconnect(); pages = []; pagesEl.replaceChildren(); emptyEl.hidden = false; if (doc) destroyDoc(doc); doc = null; updatePageLabel(); },
    get pageCount() { return pages.length; },
    scrollToPage(n) { const p = pages[n - 1]; if (p) scroller.scrollTop = p.el.offsetTop - 8; },
    highlight,
    onSource(fn) { sourceHandler = fn; },
  };
}
