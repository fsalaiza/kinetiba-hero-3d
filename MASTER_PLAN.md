# Kinetiba Hero 3D — Master Plan de Transformación

## Inspiración: D2C Life Science (Awwwards Site of the Day)
**URL:** https://www.d2c-lifescience.com/
**Análisis basado en:** 188 frames de video del scroll completo (0-100%)
**Fecha del plan:** 2026-04-06

---

## Estado actual vs Estado deseado

### Lo que tenemos
- Cubo Rubik 3x3x3 (27 piezas) con decals procedurales 2D
- Fondo sage con texto hero overlay
- 4 secciones: BI, WhatsApp, ERP, CTA
- GSAP ScrollTrigger con scrub
- Iluminación tipo estudio (mejorada)
- Cámara orbital básica
- Bloom + AO + Vignette + SMAA

### Lo que tiene D2C (y nosotros NO)
- Cubo 4x4x4 (64 piezas) con iconos embossados 3D tallados
- Superficie speckled/grainy como terrazo
- Bordes coloreados sutiles por pieza
- Piezas cream/off-white sobre fondo sage (NO al revés)
- El cubo se DESPLIEGA en grid plana (unfold)
- El cubo se transforma en campo infinito de piezas volando
- Morphing final: piezas forman una hélice de DNA
- Cámara dramática con zooms extremos
- Layout: cubo SIEMPRE protagonista, texto a los lados
- 6 secciones (pillars) con navegación visual

---

## FASE 0: Documentación y preparación

### 0.1 — Referencias visuales
- [x] Video grabado de D2C (188 frames extraídos)
- [x] Ubicación: `screenshots/d2c_reference/` (frame_001.jpg → frame_188.jpg)
- [ ] Crear carpeta `docs/d2c_reference/` con los frames más representativos
- [ ] Crear moodboard visual con los 10 frames clave

### 0.2 — Análisis técnico de D2C
- [ ] Inspeccionar el DOM de d2c-lifescience.com para ver si usan Three.js + R3F o vanilla Three.js
- [ ] Identificar si el modelo 3D es un GLB o generado proceduralmente
- [ ] Determinar si usan post-processing custom o estándar
- [ ] Documentar las easing curves de GSAP

---

## FASE 1: Cambios visuales inmediatos (bajo riesgo, alto impacto)

### 1.1 — Invertir relación de color del cubo
**Archivo:** `src/KinetibaHero/scene/CubePiece.jsx`

El cubo de D2C es cream/off-white (`#E8E4D8`) sobre fondo sage. Nuestro cubo es grisáceo (`#B8B3A8`). Cambiar:

```javascript
color="#E8E4D8"        // en lugar de #B8B3A8
emissive="#E8E4D8"     // en lugar de #B8B3A8
```

Y ajustar las sombras de las piezas para que los iconos blancos resalten:
- Base de la pieza: cream claro
- Icono: blanco puro embossado
- Sombra del icono: sutil hacia abajo

**Tiempo estimado:** 15 min
**Riesgo:** Bajo

### 1.2 — Iconos blancos embossados (no decals de colores)
**Archivos:** `src/KinetibaHero/utils/generateTextures.js`, `src/KinetibaHero/utils/iconDrawers.js`

Actualmente los iconos son dibujos 2D con colores variables. D2C tiene iconos blancos tallados que parecen embossados.

Cambiar todos los `iconDrawers` para que dibujen:
1. Sombra del icono (offset 2px abajo-derecha, alpha 0.15, color oscuro)
2. Icono blanco (alpha 0.9, sin sombra adicional)
3. Fondo cream con textura speckled (ver 1.3)

**Tiempo estimado:** 30 min
**Riesgo:** Bajo

### 1.3 — Textura speckled/grainy en las piezas
**Archivo:** `src/KinetibaHero/utils/generateTextures.js`

D2C tiene una textura como terrazo/concreto speckled. Agregar al canvas de cada cara:

```javascript
// Después del fillRect del fondo cream
for (let i = 0; i < 3000; i++) {
  const x = Math.random() * size;
  const y = Math.random() * size;
  const brightness = 180 + Math.random() * 40;
  ctx.fillStyle = `rgba(${brightness},${brightness-5},${brightness-10},0.15)`;
  ctx.fillRect(x, y, 1, 1);
}
```

**Tiempo estimado:** 10 min
**Riesgo:** Bajo

### 1.4 — Bordes coloreados en las piezas
**Archivo:** `src/KinetibaHero/utils/generateTextures.js`

D2C tiene bordes sutiles coloreados en las piezas (verde, púrpura, azul, naranja). Agregar:

```javascript
// Borde coloreado sutil
const edgeColors = ['#8B9A6B', '#6B5A8B', '#5A7B8B', '#8B6B5A'];
const edgeColor = edgeColors[(gx + gy + gz + faceIdx) % edgeColors.length];
ctx.strokeStyle = edgeColor;
ctx.lineWidth = 2;
ctx.globalAlpha = 0.3;
// Dibujar borde alrededor del decal
ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);
ctx.globalAlpha = 1;
```

**Tiempo estimado:** 15 min
**Riesgo:** Bajo

### 1.5 — Cubo más grande y centrado
**Archivos:** `src/KinetibaHero/scene/RubiksCube.jsx`, `src/KinetibaHero/scene/scrollTriggers.js`

El cubo de D2C domina la pantalla. Ajustar:

```javascript
// En RubiksCube.jsx, scale del outerRef:
scale={1.2}  // en lugar de 0.85

// En scrollTriggers.js, targetX del hero:
st.targetX = 0;  // centrado, no a la derecha (2.0)
```

**Tiempo estimado:** 15 min
**Riesgo:** Bajo (puede requerir ajustes de layout del overlay)

### 1.6 — Cámara más dramática
**Archivo:** `src/KinetibaHero/scene/Scene.jsx`, `src/KinetibaHero/utils/scrollHelpers.js`

La cámara de D2C tiene zooms extremos. Amplificar la órbita:

```javascript
// En getCameraOrbit():
const radius = 10 - scrollProgress * 4;  // zoom in dramático de 10 a 6
const theta = Math.PI * 0.25 + scrollProgress * Math.PI * 0.5;  // más rotación
const phi = Math.PI * 0.35 - Math.sin(scrollProgress * Math.PI) * 0.15;  // más bob
```

**Tiempo estimado:** 10 min
**Riesgo:** Bajo

### 1.7 — Explosión MUCHO más dramática
**Archivo:** `src/KinetibaHero/scene/scrollTriggers.js`

D2C tiene un "burst" donde las piezas vuelan lejos. Subir:

```javascript
// Sección CTA:
targetExplode: 3.5  // en lugar de 1.8
```

Y en `useScrollAnimation.js`, verificar que el multiply del explode no esté limitado:

```javascript
// Quitar o subir el clamp de effectiveExplode
const effectiveExplode = st.explode;  // sin limitar
```

**Tiempo estimado:** 10 min
**Riesgo:** Bajo

---

## FASE 2: Reestructuración del layout y secciones

### 2.1 — Cubo como protagonista, texto a los lados
**Archivos:** `src/KinetibaHero/overlay/Overlay.jsx`, `src/KinetibaHero/index.jsx`

D2C NO tiene texto sobre el cubo. El cubo siempre es el foco y el texto aparece en los laterales.

Eliminar el hero overlay que cubre el lado izquierdo. En su lugar:
- Cubo centrado en el canvas (siempre)
- Texto de cada sección aparece a la izquierda O derecha según la sección
- El hero "TUS DATOS. TU VENTAJA." se fade out completamente cuando entra la primera sección

**Tiempo estimado:** 1 hr
**Riesgo:** Medio (requiere reestructurar el overlay)

### 2.2 — Navegación visual tipo D2C
**Archivo:** `src/KinetibaHero/overlay/Overlay.jsx`

D2C tiene indicadores visuales en la esquina inferior izquierda (3 iconos que representan secciones) y dots de progreso a la derecha.

Agregar:
- Indicadores de sección en bottom-left (iconos mini del cubo)
- Dots de progreso en bottom-right
- Ambos con estilo minimalista, blanco con alpha

**Tiempo estimado:** 45 min
**Riesgo:** Bajo

### 2.3 — Reducir texto, aumentar impacto
**Archivos:** Todas las secciones en `src/KinetibaHero/sections/`

D2C usa headings enormes + párrafos cortos. Nuestras secciones tienen mucho texto.

- BI: Heading grande + 1 párrafo corto + bullets mínimos
- WhatsApp: Heading + párrafo corto (el phone mockup está bien)
- ERP: Heading + párrafo corto + CFDI visual más compacto
- CTA: Heading + social proof + botón (ya está bien)

**Tiempo estimado:** 30 min
**Riesgo:** Bajo

### 2.4 — Agregar sección de "Agentes"
**Nuevo archivo:** `src/KinetibaHero/sections/AgentSection.jsx`

Como el ERP tendrá naturaleza agéntica, agregar una 5ta sección entre ERP y CTA:

- Heading: "Inteligencia Agéntica"
- Subtítulo: "Agentes que aprenden de tu operación"
- Visual: Un icono de red neuronal o engranaje (similar al style del cubo)
- Bullets mínimos: "Automatización inteligente", "Decisiones basadas en datos", "Escalable sin intervención"

**Tiempo estimado:** 1 hr
**Riesgo:** Medio (requiere ajustar scroll ranges)

### 2.5 — Ajustar scroll ranges para 5 secciones
**Archivo:** `src/KinetibaHero/scene/scrollTriggers.js`

Recalcular todos los ranges para acomodar la nueva sección:
- S0: Hero (100vh)
- S1: Zoom-in (60vh)
- S2: BI (pinned, 200vh)
- S3: WhatsApp (no pin, 100vh)
- S4: ERP (pinned, 200vh)
- S5: Agentes (no pin, 100vh)
- S6: CTA (no pin, 100vh)

**Tiempo estimado:** 30 min
**Riesgo:** Medio (hay que coordinar con sectionOpacity ranges)

---

## FASE 3: Animaciones avanzadas del cubo

### 3.1 — Rotación algorítmica "self-solving"
**Archivo:** `src/KinetibaHero/scene/useFaceRotation.js`

Actualmente las rotaciones son aleatorias. D2C tiene un patrón donde las rotaciones parecen resolver el cubo.

Implementar un algoritmo de "solving" simplificado:
1. Definir un estado "resuelto" (todas las caras con el mismo icono)
2. Definir un estado "desordenado" (aleatorio)
3. Las rotaciones siguen un camino del desorden al orden
4. Usar un algoritmo de Rubik's cube solver simplificado (CFOP method)

**Tiempo estimado:** 2 hrs
**Riesgo:** Alto (lógica compleja)

### 3.2 — Transición de "unfold" (cubo se despliega en grid)
**Archivos:** `src/KinetibaHero/scene/useScrollAnimation.js`, `src/KinetibaHero/scene/RubiksCube.jsx`

D2C despliega el cubo en una grid plana de 3x6 piezas. Implementar:

```javascript
// En scrollTriggers.js, agregar un estado "unfold":
gsap.to(st, {
  targetUnfold: 1,  // 0 = cubo, 1 = grid plana
  scrollTrigger: { ... }
});

// En useScrollAnimation.js, interpolación entre cubo y grid:
if (st.unfold > 0) {
  // Las piezas se reorganizan en una grid 3x6
  const gridX = (i % 6) - 2.5;
  const gridY = 1 - Math.floor(i / 6);
  const gridZ = 0;
  // Lerp entre posición de cubo y posición de grid
}
```

**Tiempo estimado:** 2 hrs
**Riesgo:** Alto (nueva animación, puede romper el cubo existente)

### 3.3 — Transición de "campo infinito" de piezas
**Archivos:** Nuevos + modificaciones

D2C transforma el cubo en un campo infinito de piezas volando. Esto requiere:
1. Generar muchas más piezas (100+) más allá del cubo
2. Distribuir las piezas en un campo 3D
3. Animar la transición del cubo al campo
4. Las piezas del campo tienen los mismos iconos embossados

**Opción A:** Usar InstancedMesh para rendimiento (miles de piezas)
**Opción B:** Limitar a ~50 piezas extra con LOD

**Tiempo estimado:** 3 hrs
**Riesgo:** Muy Alto (nuevo sistema de renderizado)

### 3.4 — Morphing a forma de DNA
**Archivos:** Nuevos + modificaciones

D2C transforma las piezas en una hélice de DNA. Esto es lo más complejo:
1. Definir posiciones de una hélice de DNA (espiral doble)
2. Mapear las piezas del cubo a posiciones en la hélice
3. Animar la transición con easing cinematográfico
4. Las piezas rotan mientras se mueven a su posición de DNA

**Opción:** No hacer DNA literal, sino una forma abstracta que sugiera "conexión" o "red" (más fácil de implementar y más relevante para un ERP con agentes)

**Tiempo estimado:** 4 hrs
**Riesgo:** Muy Alto (nuevo sistema de morphing)

---

## FASE 4: Detalles de polish y micro-interacciones

### 4.1 — Hover en las piezas del cubo
**Archivo:** `src/KinetibaHero/scene/CubePiece.jsx`

D2C tiene hover en las piezas. Cuando el mouse pasa sobre una pieza:
- La pieza se ilumina sutilmente (emissive glow)
- La pieza se escala ligeramente (1.05)
- Aparece un tooltip con info (opcional)

**Tiempo estimado:** 30 min
**Riesgo:** Bajo

### 4.2 — Click en las piezas
**Archivo:** `src/KinetibaHero/scene/CubePiece.jsx`

D2C permite hacer click en las piezas para explorar un pillar. Implementar:
- Click en pieza → pieza se separa del cubo
- Aparece info del pillar/sección
- Click fuera → pieza regresa al cubo

**Tiempo estimado:** 1 hr
**Riesgo:** Medio

### 4.3 — Easing curves cinematográficas
**Archivo:** `src/KinetibaHero/scene/scrollTriggers.js`

D2C usa easing curves custom. Cambiar de `scrub: true` a:

```javascript
scrub: 0.5,  // lag sutil que se siente premium
ease: "power2.inOut",  // aceleración y desaceleración suaves
```

**Tiempo estimado:** 15 min
**Riesgo:** Bajo

### 4.4 — Partículas ambientales
**Nuevo archivo:** `src/KinetibaHero/scene/Particles.jsx`

D2C tiene partículas flotantes sutiles en el fondo. Agregar:
- ~200 partículas blancas con alpha muy bajo (0.1)
- Movimiento lento tipo "nieve"
- Se mueven con el scroll (parallax)

**Tiempo estimado:** 45 min
**Riesgo:** Bajo

### 4.5 — Color grading cinematográfico
**Archivo:** `src/KinetibaHero/scene/Scene.jsx`

D2C tiene un color grading específico. Agregar un shader pass custom:
- Tint sutil hacia sage en las sombras
- Highlight ligeramente cálido
- Contraste aumentado

**Opción más simple:** Usar ColorCorrection en el EffectComposer

**Tiempo estimado:** 30 min
**Riesgo:** Medio

### 4.6 — Transiciones de entrada/salida de secciones
**Archivos:** Todas las secciones

D2C tiene transiciones suaves entre secciones. Mejorar:
- Las secciones no aparecen/desaparecen de golpe
- Fade in/out con delay escalonado
- Texto entra desde abajo con slide

**Tiempo estimado:** 45 min
**Riesgo:** Bajo

---

## FASE 5: Rendimiento y optimización

### 5.1 — LOD (Level of Detail) para el cubo
**Archivo:** `src/KinetibaHero/scene/CubePiece.jsx`

Cuando el cubo está lejos (zoom out), usar geometría simplificada:
- Cerca: geometría completa con bevels
- Lejos: box geometry simple

**Tiempo estimado:** 30 min
**Riesgo:** Medio

### 5.2 — InstancedMesh para el campo infinito
**Nuevo archivo:** `src/KinetibaHero/scene/CubeField.jsx`

Si se implementa el campo infinito, usar InstancedMesh:
- 1 mesh instance = 1 pieza del cubo
- Actualizar matrices en el useFrame
- Máximo ~500 instancias

**Tiempo estimado:** 1 hr
**Riesgo:** Medio

### 5.3 — Frustum culling optimizado
**Archivo:** `src/KinetibaHero/scene/RubiksCube.jsx`

Ocultar piezas que están fuera de la vista de la cámara:
- Calcular frustum de la cámara
- No renderizar piezas fuera del frustum

**Tiempo estimado:** 30 min
**Riesgo:** Bajo

### 5.4 — Code splitting del 3D
**Archivo:** `src/KinetibaHero/index.jsx`

Cargar el canvas 3D solo cuando es visible:
- Lazy load del Scene component
- Suspense boundary con HeroFallback

**Tiempo estimado:** 20 min
**Riesgo:** Bajo

---

## FASE 6: Accesibilidad y SEO

### 6.1 — ARIA labels y roles
**Archivos:** Todos los componentes

- Agregar `role="img"` y `aria-label` al canvas 3D
- Agregar `aria-hidden="true"` a elementos decorativos
- Agregar skip links funcionales

**Tiempo estimado:** 20 min
**Riesgo:** Bajo

### 6.2 — Reduced motion
**Archivos:** `src/KinetibaHero/utils/useReducedMotion.js`, todos los componentes

Ya existe `reducedMotion` prop. Verificar que:
- Sin rotaciones de cubo
- Sin explosiones
- Solo fade in/out de secciones
- Sin cámara orbital

**Tiempo estimado:** 30 min
**Riesgo:** Bajo

### 6.3 — Meta tags y Open Graph
**Archivo:** `index.html`

- Agregar meta description
- Agregar Open Graph tags
- Agregar Twitter Card tags
- Agregar favicon optimizado

**Tiempo estimado:** 15 min
**Riesgo:** Bajo

---

## Orden de ejecución recomendado

```
FASE 1 (bajo riesgo, alto impacto visual):
  1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
  Tiempo total: ~1.5 hrs

FASE 2 (reestructuración):
  2.1 → 2.2 → 2.3 → 2.4 → 2.5
  Tiempo total: ~3 hrs

FASE 3 (animaciones avanzadas):
  3.1 → 3.2 → 3.3 → 3.4
  Tiempo total: ~11 hrs
  ⚠️ Riesgo alto, hacer con testing visual constante

FASE 4 (polish):
  4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6
  Tiempo total: ~3.5 hrs

FASE 5 (rendimiento):
  5.1 → 5.2 → 5.3 → 5.4
  Tiempo total: ~2.5 hrs

FASE 6 (accesibilidad):
  6.1 → 6.2 → 6.3
  Tiempo total: ~1 hr

TOTAL ESTIMADO: ~22 hrs
```

---

## Checklist de verificación visual

Después de cada fase, verificar:

- [ ] El cubo se ve bien en todos los ángulos de cámara
- [ ] Las transiciones entre secciones son suaves
- [ ] No hay flickering o parpadeo en las texturas
- [ ] El scroll no tiene jumps o saltos
- [ ] Las animaciones son fluidas a 60fps
- [ ] El texto es legible sobre el fondo
- [ ] Los botones y CTAs son clickeables
- [ ] No hay elementos que se superpongan incorrectamente
- [ ] El cubo no se "rompe" (piezas volando sin control)
- [ ] La cámara no se mueve de forma desorientadora

---

## Referencias visuales

### Frames clave del video de D2C

| Frame | Descripción | Ubicación |
|-------|-------------|-----------|
| 001 | Hero: cubo centrado, texto "DATA DRIVEN GMP" | `screenshots/d2c_reference/frame_001.jpg` |
| 020 | Cubo rotando, acercamiento | `screenshots/d2c_reference/frame_020.jpg` |
| 040 | Cubo close-up, iconos embossados visibles | `screenshots/d2c_reference/frame_040.jpg` |
| 060 | Cubo se despliega en grid (unfold) | `screenshots/d2c_reference/frame_060.jpg` |
| 070 | Sección "DATA-DRIVEN INSIGHTS", cubo a la derecha | `screenshots/d2c_reference/frame_070.jpg` |
| 110 | "SIX PILLARS", cubo desplegado a la izquierda | `screenshots/d2c_reference/frame_110.jpg` |
| 120 | Cubo explota (burst), piezas volando | `screenshots/d2c_reference/frame_120.jpg` |
| 130 | Close-up de piezas con textura speckled | `screenshots/d2c_reference/frame_130.jpg` |
| 140 | Piezas reorganizándose | `screenshots/d2c_reference/frame_140.jpg` |
| 150 | Pieza individual flotando | `screenshots/d2c_reference/frame_150.jpg` |
| 160 | Campo infinito de piezas | `screenshots/d2c_reference/frame_160.jpg` |
| 170 | Campo de piezas, vista cenital | `screenshots/d2c_reference/frame_170.jpg` |
| 180 | Sección "AUDIT", DNA helicoidal aparece | `screenshots/d2c_reference/frame_180.jpg` |
| 188 | DNA helicoidal con piezas orbitando | `screenshots/d2c_reference/frame_188.jpg` |

### Paleta de colores de D2C

| Color | Hex | Uso |
|-------|-----|-----|
| Fondo sage | `#6B7A6B` | Background principal |
| Pieza cream | `#E8E4D8` | Color base de las piezas |
| Icono blanco | `#F5F5F0` | Iconos embossados |
| Borde verde | `#5A7A5A` | Bordes sutiles de piezas |
| Borde púrpura | `#6B5A7A` | Bordes sutiles de piezas |
| Borde azul | `#5A6B7A` | Bordes sutiles de piezas |
| Texto principal | `#E8E4D8` | Headings y body text |
| Texto secundario | `#A8A898` | Labels y metadata |

---

## Notas técnicas importantes

### Sobre el modelo 3D de D2C
- Las piezas de D2C NO son un Rubik's cube estándar
- Tienen bevels más pronunciados (bordes redondeados)
- Los iconos son embossados 3D, NO texturas 2D
- La superficie tiene un speckle pattern (como terrazo)
- Cada pieza tiene un color de borde sutil diferente

### Sobre las animaciones de D2C
- El "unfold" es una transición de 3x3x3 a una grid 2D
- El "burst" separa las piezas a 3-5 unidades del centro
- El campo infinito usa ~100-200 piezas extras
- El DNA morph es una espiral doble con piezas orbitando
- Todas las transiciones usan easing curves custom (no lineales)

### Sobre la cámara de D2C
- La cámara NO solo orbita, también hace zoom in/out dramático
- Hay cortes cinematográficos entre secciones (no solo transiciones suaves)
- La cámara a veces está MUY cerca del cubo (macro shots)
- El FOV cambia dinámicamente (no es constante)

### Sobre el layout de D2C
- El cubo SIEMPRE está en el centro o cerca del centro
- El texto aparece en los laterales, NUNCA sobre el cubo
- Las secciones tienen mucho espacio en blanco (aire)
- Los headings son grandes, los párrafos son cortos
- Hay navegación visual (dots + iconos) siempre visible

---

## Plan de testing visual

Después de cada cambio, generar screenshots de la secuencia completa:

```bash
node scripts/screenshots.mjs
```

Comparar con los frames de referencia de D2C:
- `screenshots/d2c_reference/` (lo que queremos lograr)
- `screenshots/sequence/` (lo que tenemos)

---

## Historial de cambios

| Fecha | Fase | Cambios | Commit |
|-------|------|---------|--------|
| 2026-04-06 | FASE 1 | Cubo cream, iconos embossados, textura speckled, bordes, cámara dramática, explosión 3.5 | `96504aa` |
| 2026-04-06 | FASE 1 fix | Bloom threshold 1.0, emissive quitado, reflejos reducidos (clearcoat, specular, sheen) | `45f761c` |
| 2026-04-06 | A | Social proof, backdrop, FOV, scroll reducido, MiniDashboard, CfdiVisual, bloom, texturas | `7342470` |
| 2026-04-06 | P | Pinning, scroll flow, material contrast | `c24685e` |
| 2026-04-06 | D2C | Iluminación estudio, materiales oscuros, cámara orbital, burst, post-processing cinematográfico | `d2137c6` |
| 2026-04-06 | - | Análisis video D2C (188 frames), Master Plan | `pendiente` |

---

*Este documento es la guía maestra para la transformación del Kinetiba Hero 3D. Cualquier agente que continúe este trabajo debe seguir el orden de fases y verificar visualmente después de cada cambio.*
