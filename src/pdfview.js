// Visor de PDF con pdf.js: páginas perezosas, zoom con pellizco, ajuste al ancho
// y conservación de la posición al recompilar.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdf.worker.min.mjs';

export function createPdfViewer(root) {
  root.classList.add('pdfv');
  root.innerHTML = `
    <div class="pdfv-scroll" tabindex="0"><div class="pdfv-pages"></div>
      <div class="pdfv-empty">Compila para ver el PDF aquí</div></div>
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

  new ResizeObserver(() => { if (fit && pages.length) layout(); }).observe(scroller);

  return {
    load,
    clear() { io.disconnect(); pages = []; pagesEl.replaceChildren(); emptyEl.hidden = false; if (doc) destroyDoc(doc); doc = null; updatePageLabel(); },
    get pageCount() { return pages.length; },
    scrollToPage(n) { const p = pages[n - 1]; if (p) scroller.scrollTop = p.el.offsetTop - 8; },
  };
}
