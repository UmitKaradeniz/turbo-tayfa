import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Bloom öncesi güvenlik: tek bir NaN/sonsuz piksel bile bloom'un bulanıklaştırma
// katmanlarında büyüyüp ekranda yanıp sönen koyu dikdörtgenlere dönüşür (bazı
// GPU sürücülerinde). Bu adım bozuk pikselleri sıfırlar, aşırı parlakları sınırlar.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(isnan(c)) || any(isinf(c)) || c.r != c.r || c.g != c.g || c.b != c.b;
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(clamp(c.rgb, 0.0, 32.0), c.a);
    }`,
};

// Hafif bloom. Düşük kalitede composer hiç kullanılmaz, doğrudan çizilir.
export function createPostFX(renderer, scene, camera, quality) {
  if (!quality.bloom) {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      setPixelRatio: () => {},
    };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality.msaa });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const sanitize = new ShaderPass(SanitizeShader);
  composer.addPass(sanitize);
  // Eşik > 1: sadece HDR parlak şeyler (kıvılcımlar, güneş) parlasın
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.45, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSize: (w, h) => composer.setSize(w, h),
    // Dinamik çözünürlük: composer'ın iç görüntüleri de yeni piksel oranıyla boyutlansın
    setPixelRatio: (pr) => composer.setPixelRatio(pr),
    sanitize, // geliştirme/test için erişim
  };
}
