/**
 * Collection Tabs — section behaviour.
 *
 * Responsibilities:
 *   - Switch tabs and panels (ARIA-aware).
 *   - Re-route the header "View All" and arrow buttons to the active panel's
 *     slider (slider-container web component instance).
 *   - Swatch click → full variant switch (image, price, badge, URL).
 *   - Cart icon button → direct add-to-cart or open quick-add drawer.
 *
 * The script auto-initialises every `.collection-tabs` instance on the page
 * and re-initialises after Shopify section reload events in the theme editor.
 */
(function () {
  'use strict';

  const SECTION_SELECTOR = '.collection-tabs, .product-grid-container, .collection';

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }
  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function init(section) {
    if (!section || section.__collectionTabsBound) return;
    section.__collectionTabsBound = true;

    const tabs = $$('.collection-tabs__tab', section);
    const panels = $$('.collection-tabs__panel', section);
    const viewAllBtns = $$('[data-collection-tabs-view-all]', section);
    const prevBtns = $$('[data-collection-tabs-arrow="prev"]', section);
    const nextBtns = $$('[data-collection-tabs-arrow="next"]', section);

    function getActivePanel() {
      return panels.find((p) => p.classList.contains('is-active')) || panels[0];
    }

    function getActiveSliderContainer() {
      const panel = getActivePanel();
      return panel ? panel.querySelector('slider-container') : null;
    }

    function updateActions() {
      const panel = getActivePanel();
      if (!panel) return;
      const url = panel.getAttribute('data-collection-url') || '#';
      viewAllBtns.forEach((btn) => {
        if (url && url !== '#') {
          btn.setAttribute('href', url);
        }
      });
      refreshArrowState();
    }

    function refreshArrowState() {
      const sliderContainer = getActiveSliderContainer();
      const swiper = sliderContainer ? sliderContainer.swiperInstance : null;
      ensureSwiperListeners();
      if (!swiper || swiper.destroyed) {
        prevBtns.forEach((btn) => toggleArrow(btn, false));
        nextBtns.forEach((btn) => toggleArrow(btn, false));
        return;
      }
      const enabled = swiper.slides && swiper.slides.length > swiper.params.slidesPerView;
      if (!enabled) {
        prevBtns.forEach((btn) => toggleArrow(btn, false));
        nextBtns.forEach((btn) => toggleArrow(btn, false));
        return;
      }
      const prevEnabled = !swiper.isBeginning || swiper.params.loop;
      const nextEnabled = !swiper.isEnd || swiper.params.loop;
      prevBtns.forEach((btn) => toggleArrow(btn, prevEnabled));
      nextBtns.forEach((btn) => toggleArrow(btn, nextEnabled));
    }

    function ensureSwiperListeners() {
      const sliderContainer = getActiveSliderContainer();
      const swiper = sliderContainer ? sliderContainer.swiperInstance : null;
      if (!swiper || swiper.destroyed || swiper.__collectionTabsListening) return;
      swiper.__collectionTabsListening = true;
      swiper.on('slideChange transitionEnd resize init', refreshArrowState);
    }

    function toggleArrow(btn, enabled) {
      if (!btn) return;
      btn.toggleAttribute('disabled', !enabled);
      btn.classList.toggle('is-disabled', !enabled);
    }

    function activateTab(tab) {
      const targetId = tab.getAttribute('data-target');
      if (!targetId) return;

      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      panels.forEach((panel) => {
        const active = panel.id === targetId;
        panel.classList.toggle('is-active', active);
        if (active) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      updateActions();

      // Swiper sometimes mis-measures while hidden. Trigger a recalculation
      // for the newly visible panel.
      requestAnimationFrame(() => {
        const sliderContainer = getActiveSliderContainer();
        if (sliderContainer && sliderContainer.swiperInstance) {
          try {
            sliderContainer.swiperInstance.update();
          } catch (e) {
            /* noop */
          }
        }
        window.dispatchEvent(new Event('resize'));
        refreshArrowState();
        if (typeof window.refreshJudgeMeWidgets === 'function') {
          window.refreshJudgeMeWidgets(getActivePanel());
        }
      });
    }

    function bindTabs() {
      tabs.forEach((tab) => {
        tab.addEventListener('click', (event) => {
          event.preventDefault();
          activateTab(tab);
        });
        tab.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const idx = tabs.indexOf(tab);
            const nextIdx = event.key === 'ArrowRight'
              ? (idx + 1) % tabs.length
              : (idx - 1 + tabs.length) % tabs.length;
            tabs[nextIdx].focus();
            activateTab(tabs[nextIdx]);
          }
        });
      });
    }

    function bindArrows() {
      prevBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const sliderContainer = getActiveSliderContainer();
          const swiper = sliderContainer ? sliderContainer.swiperInstance : null;
          if (!swiper || swiper.destroyed || btn.disabled) return;
          swiper.slidePrev();
          requestAnimationFrame(refreshArrowState);
        });
      });
      nextBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const sliderContainer = getActiveSliderContainer();
          const swiper = sliderContainer ? sliderContainer.swiperInstance : null;
          if (!swiper || swiper.destroyed || btn.disabled) return;
          swiper.slideNext();
          requestAnimationFrame(refreshArrowState);
        });
      });
    }

    // ─── VARIANT SWITCHING (Swatches & Dropdowns) ────────────────────────────────────
    function bindVariantSelectors() {
      function updateCardVariant(card) {
        const jsonScript = card.querySelector('[data-card-variants-json]');
        if (!jsonScript) return;

        var variants;
        try {
          variants = JSON.parse(jsonScript.textContent);
        } catch (err) {
          return;
        }

        // Get currently selected swatch
        const activeSwatch = card.querySelector('.card-product-tabs__swatch.is-active');
        let swatchValue = null;
        let swatchOptionIndex = null;
        if (activeSwatch) {
          swatchValue = activeSwatch.getAttribute('data-swatch-value');
          swatchOptionIndex = parseInt(activeSwatch.getAttribute('data-swatch-option-position'), 10) - 1;
        }

        // Get currently selected size
        const sizeSelect = card.querySelector('.card-product-tabs__size-select');
        let sizeValue = null;
        let sizeOptionIndex = null;
        if (sizeSelect) {
          sizeValue = sizeSelect.value;
          sizeOptionIndex = parseInt(sizeSelect.getAttribute('data-size-option-position'), 10) - 1;
        }

        // Find the first available variant matching selected options
        var matchedVariant = null;
        for (var i = 0; i < variants.length; i++) {
          let isMatch = true;
          if (swatchValue !== null && variants[i].options[swatchOptionIndex] !== swatchValue) {
            isMatch = false;
          }
          if (sizeValue !== null && variants[i].options[sizeOptionIndex] !== sizeValue) {
            isMatch = false;
          }

          if (isMatch) {
            if (variants[i].available || !matchedVariant) {
              matchedVariant = variants[i];
              if (variants[i].available) break;
            }
          }
        }

        if (!matchedVariant) return;

        // 1. Update image
        if (matchedVariant.featured_image) {
          var primaryImg = card.querySelector('[data-card-primary-image]');
          if (primaryImg) {
            primaryImg.src = matchedVariant.featured_image.url;
            primaryImg.srcset = matchedVariant.featured_image.url + ' ' + matchedVariant.featured_image.width + 'w';
            primaryImg.alt = matchedVariant.featured_image.alt || '';
          }
        }

        // 2. Update price
        var priceContainer = card.querySelector('[data-card-price-container]');
        if (priceContainer) {
          var stripZeros = function (formatted) {
            return typeof formatted === 'string' ? formatted.replace(/\.00(\D|$)/, '$1') : formatted;
          };
          var priceFormatted = stripZeros(matchedVariant.price_formatted);
          var compareFormatted = stripZeros(matchedVariant.compare_at_price_formatted);
          var priceHtml = '';
          if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price) {
            priceHtml =
              '<div class="price price--on-sale">' +
                '<div class="price__container">' +
                  '<div class="price__sale">' +
                    '<span class="visually-hidden">Regular price</span>' +
                    '<s class="price-item price-item--regular">' + compareFormatted + '</s>' +
                    '<span class="price-item price-item--sale price-item--last">' + priceFormatted + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>';
          } else {
            priceHtml =
              '<div class="price">' +
                '<div class="price__container">' +
                  '<div class="price__regular">' +
                    '<span class="price-item price-item--regular">' + priceFormatted + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>';
          }
          priceContainer.innerHTML = priceHtml;

          var saleLabel = priceContainer.querySelector('[data-card-sale-label]');
          if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price && matchedVariant.available) {
            var savedPctLabel = Math.round((matchedVariant.compare_at_price - matchedVariant.price) / matchedVariant.compare_at_price * 100);
            if (!saleLabel) {
              saleLabel = document.createElement('span');
              saleLabel.className = 'card-product-tabs__sale-label';
              saleLabel.setAttribute('data-card-sale-label', '');
              priceContainer.appendChild(saleLabel);
            }
            saleLabel.textContent = savedPctLabel + '% OFF';
            saleLabel.style.display = '';
          } else if (saleLabel) {
            saleLabel.remove();
          }
        }

        // 3. Update badge
        var badge = card.querySelector('[data-card-badge]');
        if (badge) {
          if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price && matchedVariant.available) {
            var savedPct = Math.round((matchedVariant.compare_at_price - matchedVariant.price) / matchedVariant.compare_at_price * 100);
            badge.textContent = savedPct + '% OFF';
            badge.className = badge.className.replace(/card-product-tabs__badge--\S+/g, '');
            badge.classList.add('card-product-tabs__badge--sale');
            badge.classList.add('card-product-tabs__badge--' + (card.getAttribute('data-badge-position') || 'top-right'));
            badge.style.display = '';
          } else if (!matchedVariant.available) {
            badge.textContent = 'Sold out';
            badge.className = badge.className.replace(/card-product-tabs__badge--\S+/g, '');
            badge.classList.add('card-product-tabs__badge--soldout');
            badge.classList.add('card-product-tabs__badge--' + (card.getAttribute('data-badge-position') || 'top-right'));
            badge.style.display = '';
          }
        }

        // 4. Update cart button variant ID
        var cartBtn = card.querySelector('.card-product-tabs__cart-btn');
        if (cartBtn) {
          cartBtn.setAttribute('data-variant-id', matchedVariant.id);
        }

        // 5. Update product links (URL with variant parameter)
        var variantUrl = matchedVariant.url || card.getAttribute('data-product-url');
        var mediaLink = card.querySelector('[data-card-media-link]');
        var titleLink = card.querySelector('[data-card-title-link]');
        if (mediaLink && variantUrl) mediaLink.setAttribute('href', variantUrl);
        if (titleLink && variantUrl) titleLink.setAttribute('href', variantUrl);
      }

      // Listen for Swatch clicks
      section.addEventListener('click', function (e) {
        const swatch = e.target.closest('.card-product-tabs__swatch:not(.card-product-tabs__swatch--more)');
        if (!swatch) return;

        e.preventDefault();
        e.stopPropagation();

        const card = swatch.closest('.card-product-tabs');
        if (!card) return;

        const swatchContainer = swatch.closest('.card-product-tabs__swatches');
        if (!swatchContainer) return;

        // Update active state
        swatchContainer.querySelectorAll('.card-product-tabs__swatch').forEach(function (s) {
          s.classList.remove('is-active');
          s.setAttribute('aria-selected', 'false');
        });
        swatch.classList.add('is-active');
        swatch.setAttribute('aria-selected', 'true');

        updateCardVariant(card);
      });

      // Listen for Dropdown changes
      section.addEventListener('change', function (e) {
        const select = e.target.closest('.card-product-tabs__size-select');
        if (!select) return;

        const card = select.closest('.card-product-tabs');
        if (!card) return;

        updateCardVariant(card);
      });
    }

    // ─── CART BUTTON (Shopping Bag Icon) ─────────────────────────────
    function bindCartButtons() {
      section.addEventListener('click', function (e) {
        var cartBtn = e.target.closest('.card-product-tabs__cart-btn');
        if (!cartBtn) return;

        e.preventDefault();
        e.stopPropagation();

        var hasVariants = cartBtn.getAttribute('data-has-variants') === 'true';
        var variantId = cartBtn.getAttribute('data-variant-id');
        var card = cartBtn.closest('.card-product-tabs');

        if (hasVariants) {
          // Open the mobile quick add drawer
          openQuickAddDrawer(card, cartBtn);
        } else {
          // Direct add to cart for single-variant products
          if (!variantId) return;
          cartBtn.classList.add('is-loading');
          addVariantToCart(variantId)
            .catch(function () {
              var productUrl = cartBtn.getAttribute('data-product-url');
              if (productUrl) window.location.href = productUrl;
            })
            .finally(function () {
              cartBtn.classList.remove('is-loading');
            });
        }
      });
    }

    function openQuickAddDrawer(card, triggerBtn) {
      var drawerMain = document.querySelector('.WI_mobileQuickAddDrawer_main');
      var drawerInner = drawerMain ? drawerMain.querySelector('.WI_mobileQuickAffDrawer_in') : null;
      var drawerInfo = drawerMain ? drawerMain.querySelector('wi-quickaddproduct-info') : null;

      if (!drawerMain || !drawerInner || !drawerInfo) return;

      // Find the hidden drawer content
      var drawerContent = card.querySelector('[data-card-mobile-drawer-content]');
      if (!drawerContent) return;

      // Inject content
      drawerInfo.innerHTML = drawerContent.innerHTML;

      // Show drawer
      drawerMain.style.display = 'block';
      drawerMain.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

      setTimeout(function () {
        drawerInner.classList.add('shOw');
      }, 50);

      // Bind close button
      var closeBtn = drawerMain.querySelector('.WI_mobileQuickAffDrawer_cls');
      if (closeBtn) {
        var newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        newClose.addEventListener('click', function () {
          drawerInner.classList.remove('shOw');
          setTimeout(function () {
            drawerMain.style.display = 'none';
          }, 200);
        });
      }

      // Close on overlay click
      drawerMain.addEventListener('click', function overlayClick(ev) {
        if (ev.target === drawerMain) {
          drawerInner.classList.remove('shOw');
          setTimeout(function () {
            drawerMain.style.display = 'none';
          }, 200);
          drawerMain.removeEventListener('click', overlayClick);
        }
      });

      // Bind variant radio buttons → update ATC button
      var radios = drawerInfo.querySelectorAll('.WI_mobileQuickAdd');
      var atcBtn = drawerInfo.querySelector('.quickATC');
      radios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          if (atcBtn) {
            atcBtn.setAttribute('data-variantid', radio.value);
          }
        });
      });

      // Bind ATC button
      if (atcBtn) {
        var newAtc = atcBtn.cloneNode(true);
        atcBtn.parentNode.replaceChild(newAtc, atcBtn);
        newAtc.addEventListener('click', function (ev) {
          ev.preventDefault();
          var selectedRadio = drawerInfo.querySelector('.WI_mobileQuickAdd:checked');
          var vId = selectedRadio ? selectedRadio.value : newAtc.getAttribute('data-variantid');
          if (!vId) return;

          var spinner = newAtc.querySelector('.loading-overlay__spinner');
          var spanText = newAtc.querySelector('.Ma-span');
          if (spinner) spinner.classList.remove('hidden');
          if (spanText) spanText.classList.add('hidden');

          addVariantToCart(vId)
            .then(function () {
              drawerInner.classList.remove('shOw');
              setTimeout(function () {
                drawerMain.style.display = 'none';
              }, 200);
            })
            .catch(function () {})
            .finally(function () {
              if (spinner) spinner.classList.add('hidden');
              if (spanText) spanText.classList.remove('hidden');
            });
        });
      }
    }

    function addVariantToCart(variantId) {
      var cartDrawer = document.querySelector('cart-drawer');
      var sectionsToRequest = [];
      if (cartDrawer && typeof cartDrawer.getSectionsToRender === 'function') {
        cartDrawer.getSectionsToRender().forEach(function (s) { sectionsToRequest.push(s.id); });
      }

      var formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', 1);
      if (sectionsToRequest.length > 0) {
        formData.append('sections', sectionsToRequest.join(','));
        formData.append('sections_url', window.location.pathname);
      }

      var routeBase = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      return fetch(routeBase + 'cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Add to cart failed');
          return response.json();
        })
        .then(function (parsedState) {
          if (cartDrawer && typeof cartDrawer.renderContents === 'function' && parsedState.sections) {
            cartDrawer.renderContents(parsedState);
          } else {
            // Fallback: try to open cart page or refresh bubble
            var cartIconBubble = document.getElementById('cart-icon-bubble');
            if (cartIconBubble) {
              cartIconBubble.click();
            }
          }
        });
    }

    // Initial wiring.
    bindTabs();
    bindArrows();
    bindVariantSelectors();
    bindCartButtons();
    updateActions();

    // Re-evaluate arrows after swiper initialises / on resize.
    var refresh = function () { return requestAnimationFrame(refreshArrowState); };
    window.addEventListener('resize', refresh);
    window.addEventListener('load', refresh);
    setTimeout(refresh, 600);
  }

  function initDeliveryDates() {
    var deliveryEls = document.querySelectorAll('.js-delivery-date');
    deliveryEls.forEach(function (el) {
      var days = parseInt(el.getAttribute('data-days')) || 3;
      var targetEl = el.querySelector('.delivery-date-calc');
      if (targetEl) {
        var now = new Date();
        now.setDate(now.getDate() + days);
        var day = now.getDate();
        var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        var month = monthNames[now.getMonth()];
        var nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        targetEl.textContent = day + '-' + nextDay.getDate() + ' ' + month;
      }
    });
  }

  function initAll() {
    initDeliveryDates();
    $$(SECTION_SELECTOR).forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Shopify theme editor — re-init on section load/unload.
  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector(SECTION_SELECTOR) ||
      (event.target.classList && event.target.classList.contains('collection-tabs') ? event.target : null);
    if (section) init(section);
  });
})();
