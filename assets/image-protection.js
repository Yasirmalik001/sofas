(function () {
  'use strict';

  function isProtectedImage(target) {
    return target instanceof HTMLImageElement || target.closest('picture');
  }

  document.addEventListener('contextmenu', function (event) {
    if (isProtectedImage(event.target)) {
      event.preventDefault();
    }
  });

  document.addEventListener('dragstart', function (event) {
    if (isProtectedImage(event.target)) {
      event.preventDefault();
    }
  });
})();
