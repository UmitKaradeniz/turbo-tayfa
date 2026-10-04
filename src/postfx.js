import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

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

// Keskinleştirme (CAS benzeri): komşu piksellerin ortalamasından sapmayı artırır; FXAA/SMAA bulanıklığını geri alır.
const SharpenShader = {
  uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(1, 1) }, amount: { value: 0.2 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb;
      vec3 w = texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb;
      vec3 sharp = c + (c - (n + s + e + w) * 0.25) * amount * 2.0;
      gl_FragColor = vec4(clamp(sharp, 0.0, 1.0), 1.0);
    }`,
};

// Son işlem zinciri: [bloom] → kenar yumuşatma (FXAA/SMAA/MSAA) → [keskinleştirme]. Hiçbiri yoksa composer kullanılmaz, doğrudan çizilir.
export function createPostFX(renderer, scene, camera, quality) {
  if (!quality.composer) {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      setPixelRatio: () => {},
    };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // HDR hedefte MSAA pahalı (4x ≈ 12 ms, iGPU'da ölçüldü): hafif seçenek FXAA/SMAA (≈1-2 ms)
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality.msaa });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  let sanitize = null;
  if (quality.bloom) {
    sanitize = new ShaderPass(SanitizeShader);
    composer.addPass(sanitize);
    // Eşik > 1: sadece HDR parlak şeyler (kıvılcımlar, güneş) parlasın
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.45, 1.0));
  }
  composer.addPass(new OutputPass());
  let fxaa = null;
  let smaa = null;
  let sharpen = null;
  if (quality.fxaa) {
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
  } else if (quality.smaa) {
    smaa = new SMAAPass(size.x, size.y);
    composer.addPass(smaa);
  }
  if (quality.sharpen > 0) {
    sharpen = new ShaderPass(SharpenShader);
    sharpen.material.uniforms.amount.value = quality.sharpen;
    composer.addPass(sharpen);
  }
  const syncSize = () => {
    const px = renderer.getDrawingBufferSize(new THREE.Vector2());
    fxaa?.material.uniforms.resolution.value.set(1 / px.x, 1 / px.y);
    sharpen?.material.uniforms.texel.value.set(1 / px.x, 1 / px.y);
    smaa?.setSize(px.x, px.y);
  };
  syncSize();
  return {
    render: () => composer.render(),
    setSize: (w, h) => {
      composer.setSize(w, h);
      syncSize();
    },
    // Dinamik çözünürlük: composer'ın iç görüntüleri de yeni piksel oranıyla boyutlansın
    setPixelRatio: (pr) => {
      composer.setPixelRatio(pr);
      syncSize();
    },
    sanitize, // geliştirme/test için erişim
  };
}
