# Plan de mejoras — Kinetiba Hero 3D

El hero usa React Three Fiber + GSAP ScrollTrigger + un cubo Rubik 3D cerámico.
Dev server: `npm run dev` → localhost:5173

---

## FASE 1: Limpieza inmediata ✅ COMPLETADA

Archivos modificados:
- `src/KinetibaHero/index.jsx` — Debug HUD y keyboard listeners condicionados con `import.meta.env.DEV || ?debug`; Canvas usa `shadows={{ type: THREE.VSMShadowMap }}`
- `src/KinetibaHero/overlay/Overlay.jsx` — Eliminados: LocationGlitch, coordenadas GPS, indicadores unicode. Texto estático "México" reemplazado por nuevo layout (ver Fase 2)
- `src/KinetibaHero/scene/Scene.jsx` — `multisampling={0}` en ambos EffectComposer

## FASE 2: Reestructurar jerarquía visual ✅ COMPLETADA

Archivos modificados:
- `src/KinetibaHero/overlay/Overlay.jsx` — Rewrite: headline centrado verticalmente con flex, fontSize subido a clamp(36px, 5.5vw, 72px), subtítulo debajo, CTA "Solicita tu demo" con glassmorphism, scroll hint al bottom
- `src/KinetibaHero/index.jsx` — HeroOverlay ahora pasa onCtaClick al Overlay
- `src/KinetibaHero/scene/scrollTriggers.js` — Cubo offset targetX: 2.0 por default (a la derecha)
- `src/KinetibaHero/scene/useScrollAnimation.js` — Initial scrollState con targetX: 2.0 y cubeX: 2.0

---

## FASE 3: Mejorar las secciones de producto ⬚ PENDIENTE

### 3.1 — Sección BI: agregar visual
Archivo: `src/KinetibaHero/sections/BiSection.jsx`
Problema: solo tiene H2 + 4 bullets alineados a la izquierda, 70% del viewport es fondo vacío.
Tarea: Agregar un componente visual al lado derecho — un mini-dashboard SVG/CSS con datos animados (barras, líneas, números). No necesita ser funcional, solo comunicar "BI" visualmente. Usar los mismos colores del sistema (#eeeee4, #c8c8bc, rgba(230,230,220,x)).

### 3.2 — Sección ERP: agregar diferenciación visual
Archivo: `src/KinetibaHero/sections/ErpSection.jsx`
Problema: solo tiene H2 + bullets técnicos, mucho espacio vacío.
Tarea: Agregar un visual de factura CFDI estilizado o iconos de los PACs/ERPs compatibles. Similar al approach de BI — un componente decorativo CSS/SVG que comunique "facturación".

### 3.3 — Sección CTA: agregar social proof
Archivo: `src/KinetibaHero/sections/CtaSection.jsx`
Problema: solo heading + botón, sin urgencia ni proof points.
Tarea: Agregar una línea encima del botón: "Setup en 3 minutos · Sin tarjeta de crédito" en estilo mono. Opcionalmente un contador: "300+ PyMEs en México".

---

## FASE 4: Optimización y pulido ⬚ PENDIENTE

### 4.1 — Mejorar contraste de texto
El off-white (#eeeee4) sobre gradiente sage (#8a9684 → #535f52) es borderline WCAG AA.
Tarea: Agregar un overlay semitransparente oscuro detrás de las zonas de texto del overlay (backdrop con gradient), O subir el color a blanco puro en headings. Verificar con herramienta de contraste.

### 4.2 — FOV del canvas
Archivo: `src/KinetibaHero/index.jsx`, línea del Canvas `fov: 36`
Tarea: Cambiar a `fov: 42` para dar más aire al cubo. Verificar que no se rompa el framing en las secciones.

### 4.3 — Reducir scroll height total
Actualmente ~11,400px (6 secciones con pins). La sección [S1] "zoom-in" (120vh) es solo transitional.
Tarea: Reducir S1 de 120vh a 60vh. Reducir ERP de 120vh a 100vh. Ajustar scroll ranges en `scrollTriggers.js` proporcionalmente.

### 4.4 — Cubo semántico (opcional, complejo)
Archivo: `src/KinetibaHero/scene/RubiksCube.jsx` y `utils/textureGenerator`
Tarea: Que al scrollear a cada sección, las caras frontales del cubo muestren iconos relevantes (BI → gráficas, WhatsApp → chat, ERP → factura). Requiere modificar la generación procedural de texturas.

---

## Orden de ejecución recomendado para lo que falta

1. Fase 3.3 — social proof en CTA (15 min, rápido)
2. Fase 4.1 — contraste texto (30 min)
3. Fase 4.2 — FOV canvas (5 min)
4. Fase 3.1 — visual en BI (1-2 hrs)
5. Fase 3.2 — visual en ERP (1-2 hrs)
6. Fase 4.3 — reducir scroll height (30 min, ajustar ranges)
7. Fase 4.4 — cubo semántico (2-3 hrs, el más complejo, opcional)

---

## Prompt para Claude Code

Copia y pega esto en una sesión de Claude Code apuntando al repo:

```
Lee el archivo HERO_IMPROVEMENT_PLAN.md en la raíz del repo. Las Fases 1 y 2 ya están completadas — no las toques.

Ejecuta las Fases 3 y 4 en este orden:

1. Fase 3.3 — En CtaSection.jsx, agrega "Setup en 3 minutos · Sin tarjeta de crédito" como línea de social proof arriba del botón, en estilo mono.

2. Fase 4.1 — En Overlay.jsx, agrega un backdrop gradient sutil detrás del contenido hero para mejorar contraste. Algo como un div con background: linear-gradient(to right, rgba(83,95,82,0.6) 0%, rgba(83,95,82,0.3) 40%, transparent 60%) detrás del texto.

3. Fase 4.2 — En index.jsx, cambia fov: 36 a fov: 42 en el Canvas.

4. Fase 3.1 — En BiSection.jsx, agrega un componente visual al lado derecho: un mini-dashboard estilizado con SVG/CSS (barras, un número grande, una línea de tendencia). Debe usar los colores del sistema (#eeeee4, rgba(230,230,220,x)). No funcional, puramente decorativo.

5. Fase 3.2 — En ErpSection.jsx, agrega un visual de factura CFDI estilizada o iconos decorativos similares.

6. Fase 4.3 — Reduce el scroll height: cambia la sección S1 (zoom-in) de 120vh a 60vh, ERP de 120vh a 100vh. Ajusta los scroll ranges en scrollTriggers.js proporcionalmente.

El dev server corre en localhost:5173 con Vite HMR. Verifica que compile sin errores después de cada cambio.
```
