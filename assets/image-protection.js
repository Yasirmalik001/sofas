(function () {
  'use strict';

  function isImage(target) {
    if (!(target instanceof Element)) return false;
    return target instanceof HTMLImageElement || Boolean(target.closest('picture'));
  }

  document.addEventListener('contextmenu', function (event) {
    if (isImage(event.target)) {
      event.preventDefault();
    }
  });

  document.addEventListener('dragstart', function (event) {
    if (isImage(event.target)) {
      event.preventDefault();
    }
  });
})();
