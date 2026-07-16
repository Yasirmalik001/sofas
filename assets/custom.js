

  class FAQItem extends HTMLElement {
  constructor() {
    super();
    this.handleToggle = this.handleToggle.bind(this);
  }

  connectedCallback() {
    this.question = this.querySelector(".faqrs-question");
    this.answer = this.querySelector(".faqrs-answer");
    if (this.question && this.answer) {
      this.question.addEventListener("click", this.handleToggle);
    }
  }

  disconnectedCallback() {
    if (this.question) {
      this.question.removeEventListener("click", this.handleToggle);
    }
  }

  handleToggle() {
    const isActive = this.classList.contains("faqrs-active");
    const allItems = document.querySelectorAll("faq-item");
    allItems.forEach(item => item.close());
    if (!isActive) {
      this.open();
    }
  }

  open() {
    this.classList.add("faqrs-active");
    this.answer.style.maxHeight = this.answer.scrollHeight + "px";
    this.question.setAttribute("aria-expanded", "true");
  }

  close() {
    this.classList.remove("faqrs-active");
    if(this.answer) {
        this.answer.style.maxHeight = null;
    }
    if(this.question) {
        this.question.setAttribute("aria-expanded", "false");
    }
  }
}
customElements.define("faq-item", FAQItem);


/* --------------------------------------------------------------------------
   Slider Container
   -------------------------------------------------------------------------- */
if (!customElements.get('slider-container')) {
    class SliderContainer extends HTMLElement {
        constructor() {
            super();
            this.swiperInstance = null;
            this._onMediaChange = this._onMediaChange.bind(this);
            this._onVisibility = this._onVisibility.bind(this);
            this._rafId = null;
        }

        connectedCallback() {
            this._rafId = requestAnimationFrame(() => this._setup());
        }

        disconnectedCallback() {
            if (this._rafId) cancelAnimationFrame(this._rafId);
            this._teardownMedia();
            this._teardownVisibility();
            this._destroySlider();
        }

        _setup() {
            this.swiperEl = this.querySelector('.swiper') || this.querySelector('.js-slider-template-swiper') || this.querySelector('.js-swiper-template') || this.querySelector('swiper-container');
            if (!this.swiperEl) return;

            // If it's a swiper-container custom element, we'll replace it or handle it.
            // Better to just let the standard JS initialize it if the classes match.
            if (this.swiperEl.tagName.toLowerCase() === 'swiper-container') {
                this.swiperEl.classList.add('swiper');
                // The wrapper inside needs to be .swiper-wrapper but swiper-container uses Shadow DOM.
                // It's recommended to change <swiper-container> to <div class="swiper"> in the liquid files.
            }

            this.config = this._parseConfig(this);
            if (!this.config) {
                this.config = this._parseConfig(this.swiperEl);
            }
            if (!this.config) return;

            this._progressFill = this.querySelector('.swiper-progress-fill') || this.querySelector('.slider-template-progress-fill');
            this._paginationEl = this.querySelector('.swiper-pagination') || this.querySelector('.slider-template-pagination') || this.querySelector('.swiper-custom-pagination');
            this._prevBtn = this.querySelector('.swiper-button-prev') || this.querySelector('.js-slider-template-prev') || this.querySelector('.swiper-custom-prev');
            this._nextBtn = this.querySelector('.swiper-button-next') || this.querySelector('.js-slider-template-next') || this.querySelector('.swiper-custom-next');
            this._scrollbarEl = this.querySelector('.swiper-scrollbar') || this.querySelector('.swiper-custom-scrollbar');

            this._mql = window.matchMedia('(max-width: 749px)');
            this._mql.addEventListener('change', this._onMediaChange);
            this._onMediaChange(this._mql);

            if (this.config.autoplay) {
                this._observer = new IntersectionObserver(this._onVisibility, { threshold: 0.25 });
                this._observer.observe(this);
            }
        }

        _onMediaChange(e) {
            const isMobile = e.matches;
            const shouldEnable = isMobile
                ? (this.config.enableSliderMobile !== false)
                : (this.config.enableSliderDesktop !== false);

            if (shouldEnable) {
                this.classList.remove('slider-disabled');
                this._initSlider();
            } else {
                this._destroySlider();
                this.classList.add('slider-disabled');
            }
        }

        _onVisibility(entries) {
            if (!this.swiperInstance || !this.swiperInstance.autoplay) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.swiperInstance.autoplay.start();
                } else {
                    this.swiperInstance.autoplay.stop();
                }
            });
        }

        _teardownMedia() {
            if (this._mql) {
                this._mql.removeEventListener('change', this._onMediaChange);
                this._mql = null;
            }
        }

        _teardownVisibility() {
            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
            }
        }

        _initSlider() {
            if (this.swiperInstance) return;

            // Prevent Swiper width calculation explosions
            if (this.swiperEl) {
                this.swiperEl.style.width = '100%';
                this.swiperEl.style.minWidth = '0';
            }

            const swiperParams = {
                slidesPerView: this.config.mobileSlides || 1,
                spaceBetween: this.config.mobileSpacing || 0,
                loop: this.config.loop || false,
                speed: 500,
                grabCursor: true,
                mousewheel: { forceToAxis: true },
                breakpoints: {
                    750: {
                        slidesPerView: this.config.tabletSlides || this.config.desktopSlides || 3,
                        spaceBetween: this.config.desktopSpacing || 0,
                    },
                    990: {
                        slidesPerView: this.config.desktopSlides || 4,
                        spaceBetween: this.config.desktopSpacing || 0,
                    }
                },
                observer: true,
                observeParents: true,
                watchSlidesProgress: true,
                on: {
                    init: (swiper) => {
                        this.classList.add('is-initialized');
                        this._updateProgress(swiper);
                    },
                    progress: (swiper) => this._updateProgress(swiper),
                    slideChange: (swiper) => this._updateProgress(swiper),
                    resize: (swiper) => this._updateProgress(swiper),
                },
            };

            if (this._paginationEl) {
                swiperParams.pagination = {
                    el: this._paginationEl,
                    type: 'bullets',
                    clickable: true,
                    dynamicBullets: (this.config.desktopSlides > 5),
                };
            }

            if (this._prevBtn && this._nextBtn) {
                swiperParams.navigation = {
                    nextEl: this._nextBtn,
                    prevEl: this._prevBtn,
                };
            }

            if (this._scrollbarEl) {
                swiperParams.scrollbar = {
                    el: this._scrollbarEl,
                    draggable: true,
                    hide: false
                };
            }

            if (this.config.autoplay) {
                swiperParams.autoplay = {
                    delay: this.config.autoplayInterval || 3000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                };
            }

            try {
                this.swiperInstance = new Swiper(this.swiperEl, swiperParams);
            } catch (err) {
                console.warn('[slider-component] Swiper init failed:', err);
            }
        }

        _destroySlider() {
            if (!this.swiperInstance) return;

            this.swiperInstance.destroy(true, true);
            this.swiperInstance = null;
            this.classList.remove('is-initialized');

            const wrapper = this.swiperEl?.querySelector('.swiper-wrapper');
            if (wrapper) wrapper.removeAttribute('style');

            this.querySelectorAll('.swiper-slide').forEach((slide) => {
                slide.removeAttribute('style');
            });
        }

        _updateProgress(swiper) {
            if (!this._progressFill) return;
            const total = swiper.slides.length - swiper.params.slidesPerView;
            if (total <= 0) {
                this._progressFill.style.width = '100%';
                return;
            }
            const pct = Math.min(100, (swiper.realIndex / total) * 100);
            this._progressFill.style.width = `${pct}%`;
        }

        _parseConfig(el) {
            if (!el || !el.hasAttribute('data-swiper-config')) return null;
            try {
                const parsed = JSON.parse(el.dataset.swiperConfig);
                if (parsed.desktopSlides) parsed.desktopSlides = parseFloat(parsed.desktopSlides);
                if (parsed.tabletSlides) parsed.tabletSlides = parseFloat(parsed.tabletSlides);
                if (parsed.mobileSlides) parsed.mobileSlides = parseFloat(parsed.mobileSlides);
                return parsed;
            } catch {
                return null;
            }
        }
    }

    customElements.define('slider-container', SliderContainer);
}


document.addEventListener("DOMContentLoaded", function() {
  const accordionToggles = document.querySelectorAll(".mobile-accordion-toggle");

  accordionToggles.forEach(function(toggle) {
    toggle.addEventListener("click", function() {
      // Only act on mobile (CSS hides content on mobile)
      if (window.innerWidth >= 750) return;

      // Toggle the active class to flip the arrow
      this.classList.toggle("is-active");

      // Find the content sibling and toggle visibility
      let content = this.nextElementSibling;
      while (content && !content.classList.contains("footer-block__details-content")) {
        content = content.nextElementSibling;
      }
      if (content) {
        content.classList.toggle("is-open");
      }
    });
  });
});


document.addEventListener('DOMContentLoaded', () => {
  const timers = document.querySelectorAll('.cx-promo-timer-display, .woc-drawer-promo__timer');
  
  timers.forEach(timer => {
    const autoRestart = timer.getAttribute('data-auto-restart');
    if (!autoRestart) return;
    
    const autoRestartHours = parseInt(autoRestart, 10);
    if (isNaN(autoRestartHours) || autoRestartHours <= 0) return;
    
    const referenceDate = new Date('2024-01-01T00:00:00Z').getTime();
    const millisToAdd = autoRestartHours * 60 * 60 * 1000;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = now - referenceDate;
      const distance = millisToAdd - (diff % millisToAdd);

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const hhEl = timer.querySelector('.cx-time-hh');
      const mmEl = timer.querySelector('.cx-time-mm');
      const ssEl = timer.querySelector('.cx-time-ss');

    if(hhEl) hhEl.innerText = hours.toString().padStart(2, '0');
      if(mmEl) mmEl.innerText = minutes.toString().padStart(2, '0');
      if(ssEl) ssEl.innerText = seconds.toString().padStart(2, '0');
    }, 1000);
  });
});

