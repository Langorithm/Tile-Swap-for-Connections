(function () {
  'use strict';

  const SITE = (() => {
    const h = location.hostname;
    if (h.includes('nytimes.com')) return 'nyt';
    if (h.includes('connectionsgame.org')) return 'cgame';
    return null;
  })();

  if (!SITE) return;

  let dragSrc = null;
  let dragOverTarget = null;
  let dropTarget = null;
  let orderMap = new Map();  // cardKey -> CSS order index
  let lastCardCount = 0;
  let debounceTimer = null;

  function getContainer() {
    if (SITE === 'nyt') return document.querySelector('[class*="Cards-module_cardsContainer"]');
    return document.getElementById('grid');
  }

  function getCardsByDom() {
    const c = getContainer();
    if (!c) return [];
    if (SITE === 'nyt') return [...c.querySelectorAll('[data-testid="card-label"]')];
    return [...c.querySelectorAll('.word')];
  }

  function getCardKey(card) {
    if (SITE === 'nyt') return card.dataset.flipId;
    return card.textContent.trim();
  }

  // Reset orderMap from current DOM order and stamp CSS order values to match.
  // Called on initial load and after shuffle.
  function syncFromDom() {
    const cards = getCardsByDom();
    if (cards.length === 0) return;
    orderMap.clear();
    cards.forEach((card, i) => {
      orderMap.set(getCardKey(card), i);
      card.style.order = i;
    });
  }

  // After a category is solved (tiles removed), preserve user's order for remaining tiles.
  function applyOrderMap() {
    const cards = getCardsByDom();
    const present = new Set(cards.map(c => getCardKey(c)));

    const sorted = [...orderMap.entries()]
      .filter(([id]) => present.has(id))
      .sort(([, a], [, b]) => a - b)
      .map(([id]) => id);

    cards.filter(c => !orderMap.has(getCardKey(c))).forEach(c => sorted.push(getCardKey(c)));

    const cardMap = new Map(cards.map(c => [getCardKey(c), c]));
    orderMap.clear();
    sorted.forEach((id, i) => {
      orderMap.set(id, i);
      if (cardMap.has(id)) cardMap.get(id).style.order = i;
    });
  }

  // Swap CSS order values (no DOM node movement — React never sees this),
  // then FLIP-animate both tiles sliding to their new positions.
  function animateSwap(a, b) {
    const aId = getCardKey(a);
    const bId = getCardKey(b);
    const aOrder = orderMap.get(aId) ?? 0;
    const bOrder = orderMap.get(bId) ?? 0;

    if (aOrder === bOrder) return;

    // Record positions before the visual change
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();

    // Swap CSS order (visually repositions tiles without touching DOM structure)
    a.style.order = bOrder;
    b.style.order = aOrder;
    orderMap.set(aId, bOrder);
    orderMap.set(bId, aOrder);

    // Force reflow to get the post-swap positions
    const aNewRect = a.getBoundingClientRect();
    const bNewRect = b.getBoundingClientRect();

    const aDx = aRect.left - aNewRect.left;
    const aDy = aRect.top  - aNewRect.top;
    const bDx = bRect.left - bNewRect.left;
    const bDy = bRect.top  - bNewRect.top;

    if (aDx === 0 && aDy === 0 && bDx === 0 && bDy === 0) return;

    // Snap both tiles back to their pre-swap visual positions (no transition yet)
    a.style.transition = 'none';
    b.style.transition = 'none';
    a.style.transform = `translate(${aDx}px, ${aDy}px)`;
    b.style.transform = `translate(${bDx}px, ${bDy}px)`;

    // Force the browser to commit the snap in this frame before we animate
    a.getBoundingClientRect();

    // In the next frame, enable the transition and release the transform so they slide home
    requestAnimationFrame(() => {
      const timing = 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      a.style.transition = timing;
      b.style.transition = timing;
      a.style.transform = '';
      b.style.transform = '';

      const cleanup = el => () => { el.style.transition = ''; el.style.transform = ''; };
      a.addEventListener('transitionend', cleanup(a), { once: true });
      b.addEventListener('transitionend', cleanup(b), { once: true });
    });
  }

  function initCard(card) {
    if (card.dataset.cnxDnd) return;
    card.dataset.cnxDnd = '1';
    card.setAttribute('draggable', 'true');
    const key = getCardKey(card);
    if (orderMap.has(key)) {
      card.style.order = orderMap.get(key);
    }
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragenter', onDragEnter);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('drop', onDrop);
    card.addEventListener('dragend', onDragEnd);
  }

  function initCards() {
    getCardsByDom().forEach(c => { if (!c.dataset.cnxDnd) initCard(c); });
  }

  function onDragStart(e) {
    dragSrc = this;
    dropTarget = null;
    e.dataTransfer.setData('text/plain', getCardKey(this) || '');
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => this.classList.add('cnx-dragging'));
  }

  function onDragEnter(e) {
    if (!dragSrc || dragSrc === this) return;
    e.preventDefault();
    if (dragOverTarget && dragOverTarget !== this) dragOverTarget.classList.remove('cnx-drag-over');
    dragOverTarget = this;
    this.classList.add('cnx-drag-over');
  }

  function onDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
      this.classList.remove('cnx-drag-over');
      if (dragOverTarget === this) dragOverTarget = null;
    }
  }

  function onDragOver(e) {
    if (!dragSrc || dragSrc === this) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSrc || dragSrc === this) return;
    dropTarget = this;
  }

  function onDragEnd() {
    this.classList.remove('cnx-dragging');
    if (dragOverTarget) {
      dragOverTarget.classList.remove('cnx-drag-over');
      dragOverTarget = null;
    }

    if (dropTarget) {
      animateSwap(dragSrc, dropTarget);
      // NYT needs a synthetic click to clear any tile selection state after drag
      if (SITE === 'nyt') {
        dragSrc.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      dropTarget = null;
    }

    dragSrc = null;
  }

  // Track explicit shuffle/reset clicks so we know when to accept a new DOM order.
  let shuffleClicked = false;
  document.addEventListener('click', e => {
    if (SITE === 'nyt' && e.target.closest('[data-testid="shuffle-btn"]')) shuffleClicked = true;
    if (SITE === 'cgame' && (e.target.closest('#shuffle') || e.target.closest('#replayGame'))) shuffleClicked = true;
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const count = getCardsByDom().length;
      const prev = lastCardCount;
      lastCardCount = count;

      if (count > 0 && count < prev) {
        // Category solved — re-apply user's order to remaining tiles
        applyOrderMap();
      } else if (orderMap.size === 0 && count > 0) {
        // First time we see tiles (initial load) — snapshot the DOM order
        syncFromDom();
      } else if (shuffleClicked) {
        // User clicked Shuffle — accept whatever order the game produced
        shuffleClicked = false;
        syncFromDom();
      } else {
        // Any other mutation (re-render, FLIP animation, tile selection, etc.)
        // — reassert our custom order so the game can't clobber it
        applyOrderMap();
      }

      initCards();
    }, 50);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  syncFromDom();  // Handle tiles already in the DOM when the script loads
  initCards();
})();
