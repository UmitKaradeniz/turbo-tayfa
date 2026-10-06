// Yerel uygulama (Capacitor) mı, tarayıcı mı? Uygulamada sayfa `https://localhost`tan gelir;
// sunucu adresleri bu yüzden sabit verilir.
export const IS_APP = !!window.Capacitor?.isNativePlatform?.();
export const APP_HOSTS = ['turbo-tayfa.cgame.workers.dev', 'turbo-tayfa.onrender.com']; // önce Cloudflare, yedek Render
export const SITE_ORIGIN = IS_APP ? `https://${APP_HOSTS[0]}` : location.origin;
