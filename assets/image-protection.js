(function () {
  'use strict';

  var IMAGE_ZONE_SELECTOR =
    'img, picture, .card-product-tabs__media, .product__media, .product__media-wrapper, swiper-gallery, media-gallery, .product-media-container';

  function isInImageZone(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(IMAGE_ZONE_SELECTOR));
  }

  document.addEventListener('contextmenu', function (event) {
    if (isInImageZone(event.target)) {
      event.preventDefault();
    }
  });

  document.addEventListener('dragstart', function (event) {
    if (isInImageZone(event.target)) {
      event.preventDefault();
    }
  });
})();
