// Tam ekran aç/kapat (telefonda yatay kilit denenir). Düğmeler `[data-go="fullscreen"]`, durum `html.fs-on` sınıfında.
const el = document.documentElement;
const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
const exit = document.exitFullscreen ?? document.webkitExitFullscreen;

export const fullscreenSupported = !!request;
export const isFullscreen = () => !!(document.fullscreenElement ?? document.webkitFullscreenElement);

export function toggleFullscreen() {
  if (isFullscreen()) {
    exit?.call(document);
    screen.orientation?.unlock?.();
    return;
  }
  Promise.resolve(request?.call(el))
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

const sync = () => el.classList.toggle('fs-on', isFullscreen());
document.addEventListener('fullscreenchange', sync);
document.addEventListener('webkitfullscreenchange', sync);
if (!fullscreenSupported) el.classList.add('no-fs');
