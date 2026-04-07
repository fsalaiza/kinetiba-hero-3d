# D2C Life Science vs Kinetiba Hero 3D - Análisis comparativo

## Lo que hace D2C Life Science (Awwwards SOTD)

### 1. Cubo Rubik 3D
- **Origen**: Modelado en Blender, exportado como GLB
- **Geometría**: Bevels perfectos, UVs mapeados, materiales PBR
- **Comportamiento**: 
  - Se "auto-resuelve" (rotaciones algorítmicas, no aleatorias)
  - "Bursts" - explosión dramática donde las piezas vuelan lejos del centro
  - "Morphs into a pill" - se transforma en una forma de píldora
- **Materiales**: Colores sólidos por cara, acabado semi-matte, bordes definidos

### 2. Color palette (ultra minimal)
- `#879186` - Sage verde (fondo principal)
- `#E6F7ED` - Mint claro (acentos, texto)
- Solo 2 colores = coherencia visual extrema

### 3. Scroll animation
- GSAP ScrollTrigger
- La cámara orbita alrededor del cubo mientras scrolleas
- El cubo rota, se resuelve, explota, y se transforma
- Transiciones cinemáticas entre estados

### 4. Post-processing
- Color grading sutil
- Vignette
- Bloom controlado (no excesivo)
- Sombras suaves de contacto

### 5. Tipografía y layout
- Minimalista, mucho espacio en blanco
- Texto grande, legible
- Secciones cortas, impactantes

---

## Lo que hace Kinetiba actualmente

### 1. Cubo Rubik 3D
- **Origen**: GLB básico + decals procedurales con Canvas2D
- **Geometría**: Bevels del modelo GLB, sin UVs custom
- **Comportamiento**: 
  - Rotaciones aleatorias de caras
  - Explosión sutil (0.2-0.7 unidades)
  - No hay morphing
- **Materiales**: Cerámico procedural, color base `#C8C3B8`, normal map generado

### 2. Color palette
- Fondo: gradiente sage `#8a9684` → `#535f52`
- Texto: `#eeeee4`, `#c8c8bc`, `#d4d4c8`
- Acentos: `#8B9A6B`, `#6A7B8B`, `#7B6A5A`
- ~8 colores = más variedad pero menos cohesión

### 3. Scroll animation
- GSAP ScrollTrigger
- El cubo se mueve en X, cambia escala, rota
- La cámara NO se mueve
- Pinning en BI y ERP

### 4. Post-processing
- Bloom (0.32)
- N8AO
- Vignette
- SMAA

### 5. Tipografía y layout
- Secciones con H2 + bullets + visual
- Más contenido, menos aire

---

## Gap analysis - Qué necesita Kinetiba para alcanzar el nivel D2C

### CRÍTICO (cambios que marcan diferencia visual inmediata)

#### A. Iluminación de estudio tipo producto
D2C usa iluminación que resalta bordes y crea sombras dramáticas. Nuestro lighting es genérico.
**Fix**: Reconfigurar las 4 directional lights para crear un setup tipo "3-point lighting + rim":
- Key light fuerte desde arriba-derecha
- Fill light suave desde izquierda
- Rim/back light para separar el cubo del fondo
- Ambient muy bajo para no lavar

#### B. Colores más cohesivos y saturados
Nuestro cubo es demasiado neutro. D2C usa colores que contrastan con el fondo.
**Fix**: 
- Cambiar el color base del cubo a algo con más personalidad
- Los decals necesitan más contraste (fondos más oscuros, iconos más blancos)
- Reducir la paleta de colores a 3-4 tonos principales

#### C. Explosión más dramática
Nuestra explosión es de 0.2-0.7 unidades. D2C "bursts" = las piezas vuelan lejos.
**Fix**: Subir targetExplode a 1.5-2.0 en la sección CTA, con easing dramático

#### D. Cámara que se mueve
Actualmente la cámara está fija. D2C orbita la cámara.
**Fix**: Agregar movimiento de cámara en `useScrollAnimation` - la cámara orbita ligeramente según el scroll

#### E. Rotación algorítmica vs aleatoria
Nuestras rotaciones de caras son aleatorias. D2C tiene un patrón de "self-solving".
**Fix**: Modificar `useFaceRotation` para que las rotaciones sigan un patrón que parezca resolver el cubo, no desordenarlo

### IMPORTANTE (mejoras de polish)

#### F. Transiciones más cinemáticas
- Agregar easing curves custom en GSAP
- Usar `scrub: 0.5` en lugar de `scrub: true` para un lag sutil que se sienta premium

#### G. Sombras más dramáticas
- ContactShadows con más opacidad y blur
- Posiblemente agregar shadow map de mayor resolución

#### H. Tipografía más impactante
- Headings más grandes
- Más espacio entre secciones
- Menos texto, más impacto

### OPCIONAL (nice-to-have, complejo)

#### I. Morphing del cubo
Transformar el cubo en otra forma (como D2C hace con la píldora).
**Fix**: Requeriría modelar formas alternativas en Blender o usar morph targets

#### J. Partículas o efectos durante transiciones
D2C probablemente tiene partículas o efectos visuales durante las transiciones.

---

## Orden de implementación recomendado

1. **Iluminación de estudio** (15 min) - Cambio inmediato, sin riesgo
2. **Colores del cubo más cohesivos** (20 min) - Material + decals
3. **Explosión más dramática** (10 min) - Solo números
4. **Cámara orbital** (30 min) - useScrollAnimation
5. **Rotación algorítmica** (45 min) - useFaceRotation
6. **Easing cinemático** (15 min) - GSAP config
7. **Sombras dramáticas** (10 min) - ContactShadows
8. **Tipografía impactante** (20 min) - Sections
